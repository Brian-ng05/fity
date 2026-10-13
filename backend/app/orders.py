"""Orders and Checkout module for FITY Studio.
Handles SQLite DB persistence, price & shipping quotes, order creation with idempotency,
and authenticated order lookup via secret token.
"""
from contextlib import contextmanager
from datetime import datetime, timezone
import logging
import os
from pathlib import Path
import re
import secrets
import sqlite3
from typing import Any, Optional, Union
import uuid

from fastapi import APIRouter, Body, Header, HTTPException, Query, Request, status
from pydantic import BaseModel, ConfigDict, Field, AliasChoices

from .catalog import PRODUCTS
from .config import ROOT

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/orders", tags=["orders"])

# Constants
FREE_SHIPPING_THRESHOLD_VND = 500000
STANDARD_SHIPPING_FEE_VND = 30000

STATUS_LABELS = {
    "received": "Đã tiếp nhận",
    "pending_confirmation": "Chờ xác nhận",
    "confirmed": "Đã xác nhận",
    "shipping": "Đang giao hàng",
    "completed": "Hoàn thành",
    "cancelled": "Đã hủy",
}


def get_db_path() -> Path:
    """Returns the path to the orders SQLite database."""
    custom = os.getenv("MORPH_ORDERS_DB")
    if custom:
        p = Path(custom)
        p.parent.mkdir(parents=True, exist_ok=True)
        return p

    # Preferred: workspace .runtime/orders.db
    workspace_runtime = ROOT.parent / ".runtime"
    try:
        workspace_runtime.mkdir(parents=True, exist_ok=True)
        return workspace_runtime / "orders.db"
    except Exception:
        pass

    # Fallback: backend/app/orders.db
    fallback = Path(__file__).resolve().parent / "orders.db"
    fallback.parent.mkdir(parents=True, exist_ok=True)
    return fallback


@contextmanager
def get_db_connection(db_path: Optional[Path | str] = None):
    """Context manager for SQLite database connection."""
    path = Path(db_path) if db_path else get_db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path), timeout=15.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    try:
        yield conn
    finally:
        conn.close()


def init_db(db_path: Optional[Path | str] = None) -> None:
    """Initialize orders database schema if not existing."""
    path = Path(db_path) if db_path else get_db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(str(path), timeout=15.0) as conn:
        conn.execute("PRAGMA foreign_keys = ON;")
        if str(path) != ":memory:":
            try:
                conn.execute("PRAGMA journal_mode = WAL;")
            except Exception:
                pass
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS orders (
            id TEXT PRIMARY KEY,
            order_code TEXT UNIQUE NOT NULL,
            token TEXT NOT NULL,
            idempotency_key TEXT UNIQUE,
            status TEXT NOT NULL,
            status_label TEXT NOT NULL,
            customer_name TEXT NOT NULL,
            customer_phone TEXT NOT NULL,
            customer_email TEXT,
            customer_address TEXT NOT NULL,
            customer_note TEXT,
            subtotal_vnd INTEGER NOT NULL,
            shipping_fee_vnd INTEGER NOT NULL,
            total_vnd INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS order_items (
            id TEXT PRIMARY KEY,
            order_id TEXT NOT NULL,
            product_id TEXT NOT NULL,
            product_slug TEXT NOT NULL,
            product_name TEXT NOT NULL,
            color TEXT NOT NULL,
            size TEXT NOT NULL,
            image TEXT NOT NULL,
            unit_price_vnd INTEGER NOT NULL,
            quantity INTEGER NOT NULL,
            subtotal_vnd INTEGER NOT NULL,
            FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_orders_order_code ON orders (order_code);
        CREATE INDEX IF NOT EXISTS idx_orders_idempotency_key ON orders (idempotency_key);
        CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);
        """)


# Ensure database tables exist at import time
try:
    init_db()
except Exception as exc:
    logger.warning("Auto-init orders DB deferred: %s", exc)


# Helper & Validation Functions
def generate_order_code() -> str:
    """Generates order code matching MPH-YYYYMMDD-XXXX."""
    date_part = datetime.now(timezone.utc).strftime("%Y%m%d")
    suffix = secrets.token_hex(2).upper()
    return f"MPH-{date_part}-{suffix}"


def validate_vn_phone(phone: str) -> str:
    """
    Validates a Vietnamese phone number.
    Returns cleaned phone number starting with 0.
    Raises ValueError if invalid.
    """
    if not phone or not isinstance(phone, str):
        raise ValueError("Số điện thoại không được để trống.")

    cleaned = re.sub(r"[\s\.\-\(\)]", "", phone.strip())
    if cleaned.startswith("+84"):
        cleaned = "0" + cleaned[3:]
    elif cleaned.startswith("84") and len(cleaned) in (11, 12):
        cleaned = "0" + cleaned[2:]

    if not cleaned.isdigit():
        raise ValueError("Số điện thoại chỉ được chứa các chữ số.")

    if not (9 <= len(cleaned) <= 11):
        raise ValueError("Số điện thoại Việt Nam phải có từ 9 đến 11 chữ số.")

    if not cleaned.startswith("0"):
        raise ValueError("Số điện thoại Việt Nam phải bắt đầu bằng 0 hoặc +84.")

    return cleaned


def find_product(product_id: str) -> Optional[dict]:
    """Finds a product in catalog by id or slug (case-insensitive)."""
    target = str(product_id).strip().lower()
    for p in PRODUCTS:
        if str(p.get("id", "")).strip().lower() == target or str(p.get("slug", "")).strip().lower() == target:
            return p
    return None


def get_product_colors(product: dict) -> list[str]:
    """Extracts valid color names from a product record."""
    colors = []
    for c in product.get("colors", []):
        if isinstance(c, dict) and "name" in c:
            colors.append(c["name"])
        elif isinstance(c, str):
            colors.append(c)
    if not colors and product.get("color"):
        colors.append(product["color"])
    return colors


def validate_cart_item(item: Any) -> dict:
    """Validates an order item against the product catalog."""
    if isinstance(item, dict):
        pid = item.get("productId") or item.get("product_id")
        color_in = item.get("color", "")
        size_in = item.get("size", "")
        quantity_in = item.get("quantity", 1)
    else:
        pid = getattr(item, "productId", None) or getattr(item, "product_id", None)
        color_in = getattr(item, "color", "")
        size_in = getattr(item, "size", "")
        quantity_in = getattr(item, "quantity", 1)

    if not pid or not str(pid).strip():
        raise HTTPException(status_code=400, detail="Mã sản phẩm (productId) không được để trống.")

    product = find_product(pid)
    if not product:
        raise HTTPException(status_code=400, detail=f"Sản phẩm '{pid}' không tồn tại trong danh mục.")

    if not isinstance(quantity_in, int) or quantity_in < 1:
        raise HTTPException(status_code=400, detail="Số lượng sản phẩm phải là số nguyên lớn hơn hoặc bằng 1.")

    # Validate color
    avail_colors = get_product_colors(product)
    color_clean = str(color_in).strip().lower()
    matched_color = None
    for ac in avail_colors:
        if ac.strip().lower() == color_clean:
            matched_color = ac
            break
    if not matched_color:
        color_options = ", ".join(avail_colors) if avail_colors else "Mặc định"
        raise HTTPException(
            status_code=400,
            detail=f"Màu sắc '{color_in}' không hợp lệ cho sản phẩm '{product.get('name')}'. Màu hiện có: {color_options}."
        )

    # Validate size
    avail_sizes = product.get("sizes", [])
    size_clean = str(size_in).strip().upper()
    matched_size = None
    for asize in avail_sizes:
        if asize.strip().upper() == size_clean:
            matched_size = asize
            break
    if not matched_size:
        size_options = ", ".join(avail_sizes) if avail_sizes else "Free size"
        raise HTTPException(
            status_code=400,
            detail=f"Kích thước '{size_in}' không hợp lệ cho sản phẩm '{product.get('name')}'. Kích thước hiện có: {size_options}."
        )

    unit_price = int(product.get("price", 0))
    subtotal = unit_price * quantity_in
    image = product.get("image") or (product.get("gallery") or [""])[0]

    return {
        "productId": product.get("id"),
        "product_id": product.get("id"),
        "slug": product.get("slug", product.get("id")),
        "name": product.get("name"),
        "color": matched_color,
        "size": matched_size,
        "image": image,
        "unit_price_vnd": unit_price,
        "price": unit_price,
        "quantity": quantity_in,
        "subtotal_vnd": subtotal,
        "subtotal": subtotal,
    }


def calculate_totals(validated_items: list[dict]) -> tuple[int, int, int]:
    """Calculates subtotal, shipping fee, and total in VND."""
    subtotal_vnd = sum(item["subtotal_vnd"] for item in validated_items)
    shipping_fee_vnd = 0 if subtotal_vnd >= FREE_SHIPPING_THRESHOLD_VND else STANDARD_SHIPPING_FEE_VND
    total_vnd = subtotal_vnd + shipping_fee_vnd
    return subtotal_vnd, shipping_fee_vnd, total_vnd


def _build_order_dict(order_row: sqlite3.Row, item_rows: list[sqlite3.Row]) -> dict:
    """Builds user-facing order dict (without the secret token)."""
    items = [
        {
            "id": r["id"],
            "productId": r["product_id"],
            "product_id": r["product_id"],
            "slug": r["product_slug"],
            "name": r["product_name"],
            "color": r["color"],
            "size": r["size"],
            "image": r["image"],
            "unit_price_vnd": r["unit_price_vnd"],
            "price": r["unit_price_vnd"],
            "quantity": r["quantity"],
            "subtotal_vnd": r["subtotal_vnd"],
            "subtotal": r["subtotal_vnd"],
        }
        for r in item_rows
    ]

    return {
        "id": order_row["id"],
        "order_code": order_row["order_code"],
        "status": order_row["status"],
        "status_label": order_row["status_label"],
        "customer": {
            "name": order_row["customer_name"],
            "phone": order_row["customer_phone"],
            "email": order_row["customer_email"],
            "address": order_row["customer_address"],
            "note": order_row["customer_note"],
        },
        "items": items,
        "subtotal_vnd": order_row["subtotal_vnd"],
        "shipping_fee_vnd": order_row["shipping_fee_vnd"],
        "total_vnd": order_row["total_vnd"],
        "subtotal": order_row["subtotal_vnd"],
        "shipping_fee": order_row["shipping_fee_vnd"],
        "total": order_row["total_vnd"],
        "created_at": order_row["created_at"],
        "updated_at": order_row["updated_at"],
    }


def get_order_by_idempotency_key(key: str, db_path: Optional[Path | str] = None) -> Optional[dict]:
    """Retrieves existing order and token by idempotency key."""
    if not key or not str(key).strip():
        return None
    with get_db_connection(db_path) as conn:
        cursor = conn.execute("SELECT * FROM orders WHERE idempotency_key = ?", (str(key).strip(),))
        row = cursor.fetchone()
        if not row:
            return None
        items_cursor = conn.execute("SELECT * FROM order_items WHERE order_id = ?", (row["id"],))
        item_rows = items_cursor.fetchall()
        order_dict = _build_order_dict(row, item_rows)
        return {
            "order": order_dict,
            "token": row["token"],
        }


def get_order_by_id_or_code(identifier: str, token: str, db_path: Optional[Path | str] = None) -> Optional[dict]:
    """Retrieves order with timing-safe token authentication."""
    if not identifier or not token:
        return None
    with get_db_connection(db_path) as conn:
        cursor = conn.execute(
            "SELECT * FROM orders WHERE id = ? OR order_code = ?",
            (str(identifier).strip(), str(identifier).strip())
        )
        row = cursor.fetchone()
        if not row:
            return None

        # Constant-time comparison to prevent timing attacks
        if not secrets.compare_digest(row["token"], str(token).strip()):
            return None

        items_cursor = conn.execute("SELECT * FROM order_items WHERE order_id = ?", (row["id"],))
        item_rows = items_cursor.fetchall()
        return _build_order_dict(row, item_rows)


# Pydantic Schemas
class OrderItemInput(BaseModel):
    productId: str = Field(..., validation_alias=AliasChoices("productId", "product_id"))
    color: str
    size: str
    quantity: int = Field(default=1, ge=1)

    model_config = ConfigDict(populate_by_name=True)


class QuoteRequest(BaseModel):
    items: list[OrderItemInput]

    model_config = ConfigDict(populate_by_name=True)


class CustomerInput(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    address: str
    note: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


class CreateOrderRequest(BaseModel):
    idempotency_key: Optional[str] = None
    customer: CustomerInput
    items: list[OrderItemInput]

    model_config = ConfigDict(populate_by_name=True)


# API Routes
@router.post("/quote")
def quote_order(payload: Union[QuoteRequest, list[OrderItemInput]] = Body(...)):
    """
    Calculates subtotal, shipping fee, and total in VND for a list of items.
    Validates each product, color variant, size variant, and quantity against catalog.
    """
    if isinstance(payload, QuoteRequest):
        items = payload.items
    elif isinstance(payload, list):
        items = payload
    else:
        raise HTTPException(status_code=400, detail="Dữ liệu giỏ hàng không hợp lệ.")

    if not items:
        raise HTTPException(status_code=400, detail="Danh sách sản phẩm không được để trống.")

    validated_items = [validate_cart_item(it) for it in items]
    subtotal_vnd, shipping_fee_vnd, total_vnd = calculate_totals(validated_items)

    return {
        "subtotal_vnd": subtotal_vnd,
        "shipping_fee_vnd": shipping_fee_vnd,
        "total_vnd": total_vnd,
        "free_shipping_threshold_vnd": FREE_SHIPPING_THRESHOLD_VND,
        "items": validated_items,
        # Convenience aliases
        "subtotal": subtotal_vnd,
        "shipping_fee": shipping_fee_vnd,
        "total": total_vnd,
    }


@router.post("", status_code=status.HTTP_201_CREATED)
@router.post("/", status_code=status.HTTP_201_CREATED, include_in_schema=False)
def create_order(
    request: Request,
    payload: CreateOrderRequest,
    idempotency_key_header: Optional[str] = Header(None, alias="Idempotency-Key"),
):
    """
    Creates a new checkout order with atomic transaction snapshot and idempotency protection.
    Returns the created order and its secret access token.
    """
    idem_key = payload.idempotency_key or idempotency_key_header
    if idem_key:
        idem_key = idem_key.strip() or None

    # Idempotency check: if key already exists, return existing order immediately
    if idem_key:
        existing = get_order_by_idempotency_key(idem_key)
        if existing:
            order_dict = existing["order"]
            token = existing["token"]
            return {
                "order": order_dict,
                "token": token,
                **order_dict,
            }

    # Validate Customer Data
    cust = payload.customer
    name = (cust.name or "").strip()
    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Tên khách hàng phải có ít nhất 2 ký tự.")

    try:
        clean_phone = validate_vn_phone(cust.phone)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    email = None
    if cust.email and cust.email.strip():
        email = cust.email.strip()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
            raise HTTPException(status_code=400, detail="Địa chỉ email không hợp lệ.")

    address = (cust.address or "").strip()
    if len(address) < 5:
        raise HTTPException(status_code=400, detail="Địa chỉ nhận hàng phải có ít nhất 5 ký tự.")

    note = cust.note.strip() if cust.note and cust.note.strip() else None

    # Validate Items
    if not payload.items:
        raise HTTPException(status_code=400, detail="Đơn hàng phải có ít nhất 1 sản phẩm.")

    validated_items = [validate_cart_item(it) for it in payload.items]
    subtotal_vnd, shipping_fee_vnd, total_vnd = calculate_totals(validated_items)

    # Order Metadata
    order_id = f"ord_{uuid.uuid4().hex[:16]}"
    order_code = generate_order_code()
    token = secrets.token_urlsafe(24)
    order_status = "received"
    status_label = STATUS_LABELS.get(order_status, "Đã tiếp nhận")
    now_iso = datetime.now(timezone.utc).isoformat()

    # Atomic DB Insertion
    try:
        with get_db_connection() as conn:
            conn.execute(
                """
                INSERT INTO orders (
                    id, order_code, token, idempotency_key, status, status_label,
                    customer_name, customer_phone, customer_email, customer_address, customer_note,
                    subtotal_vnd, shipping_fee_vnd, total_vnd, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    order_id, order_code, token, idem_key, order_status, status_label,
                    name, clean_phone, email, address, note,
                    subtotal_vnd, shipping_fee_vnd, total_vnd, now_iso, now_iso,
                )
            )

            item_records = [
                (
                    f"item_{uuid.uuid4().hex[:16]}",
                    order_id,
                    it["productId"],
                    it["slug"],
                    it["name"],
                    it["color"],
                    it["size"],
                    it["image"],
                    it["unit_price_vnd"],
                    it["quantity"],
                    it["subtotal_vnd"],
                )
                for it in validated_items
            ]

            conn.executemany(
                """
                INSERT INTO order_items (
                    id, order_id, product_id, product_slug, product_name,
                    color, size, image, unit_price_vnd, quantity, subtotal_vnd
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                item_records,
            )
            conn.commit()
    except sqlite3.IntegrityError as err:
        # Handle race condition on idempotency key
        if idem_key:
            existing = get_order_by_idempotency_key(idem_key)
            if existing:
                order_dict = existing["order"]
                return {
                    "order": order_dict,
                    "token": existing["token"],
                    **order_dict,
                }
        logger.error("DB Integrity error creating order: %s", err)
        raise HTTPException(
            status_code=409,
            detail=f"Xung đột dữ liệu khi tạo đơn hàng: {err}"
        )
    except Exception as exc:
        logger.exception("Unexpected error creating order: %s", exc)
        raise HTTPException(
            status_code=500,
            detail="Lỗi hệ thống khi lưu trữ đơn hàng. Vui lòng thử lại."
        )

    order_dict = {
        "id": order_id,
        "order_code": order_code,
        "status": order_status,
        "status_label": status_label,
        "customer": {
            "name": name,
            "phone": clean_phone,
            "email": email,
            "address": address,
            "note": note,
        },
        "items": validated_items,
        "subtotal_vnd": subtotal_vnd,
        "shipping_fee_vnd": shipping_fee_vnd,
        "total_vnd": total_vnd,
        "subtotal": subtotal_vnd,
        "shipping_fee": shipping_fee_vnd,
        "total": total_vnd,
        "created_at": now_iso,
        "updated_at": now_iso,
    }

    return {
        "order": order_dict,
        "token": token,
        **order_dict,
    }


@router.get("/{order_identifier}")
def get_order(
    order_identifier: str,
    token: Optional[str] = Query(None),
    x_order_token: Optional[str] = Header(None, alias="X-Order-Token"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """
    Retrieves order details using token authentication.
    If token is missing, wrong, or order does not exist, returns 404.
    """
    effective_token = token
    if not effective_token and x_order_token:
        effective_token = x_order_token.strip()
    if not effective_token and authorization:
        auth_clean = authorization.strip()
        if auth_clean.lower().startswith("bearer "):
            effective_token = auth_clean[7:].strip()

    if not effective_token or not effective_token.strip():
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy đơn hàng hoặc phiên truy cập không hợp lệ."
        )

    order = get_order_by_id_or_code(order_identifier, effective_token.strip())
    if not order:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy đơn hàng hoặc phiên truy cập không hợp lệ."
        )

    return {
        "order": order,
        **order,
    }
