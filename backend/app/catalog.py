"""Product catalog router and data access for FITY AI storefront."""
import json
from pathlib import Path
from typing import Literal
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/api/products", tags=["catalog"])

DATA_FILE = Path(__file__).resolve().parent / "catalog_data.json"


def _load_data():
    if not DATA_FILE.is_file():
        return [], []
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data.get("categories", []), data.get("products", [])


CATEGORIES, PRODUCTS = _load_data()


def get_products(category: str | None = None, search: str | None = None, sort: str | None = None) -> list[dict]:
    items = list(PRODUCTS)
    if category:
        cat_lower = category.strip().lower()
        items = [p for p in items if p.get("category", "").lower() == cat_lower]
    if search:
        query = search.strip().lower()
        items = [
            p for p in items
            if query in p.get("name", "").lower()
            or query in p.get("subtitle", "").lower()
            or query in p.get("description", "").lower()
        ]
    if sort == "price_asc":
        items.sort(key=lambda p: p.get("price", 0))
    elif sort == "price_desc":
        items.sort(key=lambda p: p.get("price", 0), reverse=True)
    return items


def get_product_by_slug(slug: str) -> dict | None:
    for p in PRODUCTS:
        if p.get("slug") == slug or p.get("id") == slug:
            return p
    return None


@router.get("", response_model=None)
@router.get("/", include_in_schema=False)
def list_products(
    category: str | None = Query(None, description="Lọc theo danh mục (vd: ao-thun, so-mi, quan, vay, ao-khoac)"),
    search: str | None = Query(None, description="Tìm kiếm theo tên hoặc mô tả"),
    sort: Literal["price_asc", "price_desc"] | None = Query(None, description="Sắp xếp theo giá (price_asc hoặc price_desc)")
):
    return get_products(category=category, search=search, sort=sort)


@router.get("/{slug}")
def get_product(slug: str):
    product = get_product_by_slug(slug)
    if not product:
        raise HTTPException(status_code=404, detail="Không tìm thấy sản phẩm.")
    return product
