"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Home,
  Package,
  ShoppingBag,
  Truck,
  User,
  MapPin,
  Phone,
  Mail,
  FileText,
  Calendar,
} from "lucide-react";
import Header from "../../../components/shop/Header";
import Footer from "../../../components/shop/Footer";
import CartDrawer from "../../../components/shop/CartDrawer";
import WishlistDrawer from "../../../components/shop/WishlistDrawer";
import { money } from "../../../lib/catalog";

interface OrderItemSnapshot {
  productId?: string;
  name: string;
  color: string;
  size: string;
  quantity: number;
  price: number;
  image?: string;
}

interface OrderCustomerSnapshot {
  name: string;
  phone: string;
  email?: string;
  address: string;
  notes?: string;
}

interface OrderData {
  id?: string;
  code?: string;
  orderId?: string;
  order_code?: string;
  status?: string;
  status_label?: string;
  createdAt?: string | number;
  created_at?: string | number;
  customer?: OrderCustomerSnapshot;
  items?: OrderItemSnapshot[];
  subtotal?: number;
  sub_total?: number;
  shippingFee?: number;
  shipping_fee?: number;
  total?: number;
  grand_total?: number;
}

function OrderDetailsContent() {
  const params = useParams();
  const searchParams = useSearchParams();

  const id = params?.id as string;
  const token = searchParams?.get("token") || "";

  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    const fetchOrder = async () => {
      try {
        const query = token ? `?token=${encodeURIComponent(token)}` : "";
        const res = await fetch(`/api/orders/${encodeURIComponent(id)}${query}`);

        if (!res.ok) {
          if (res.status === 404) {
            throw new Error("Không tìm thấy thông tin đơn hàng này trong hệ thống.");
          }
          if (res.status === 403 || res.status === 401) {
            throw new Error("Mã xác thực (token) không hợp lệ hoặc bạn không có quyền xem đơn hàng này.");
          }
          throw new Error(`Không thể tải đơn hàng (${res.status}). Vui lòng kiểm tra lại đường dẫn.`);
        }

        const data: OrderData = await res.json();
        if (isMounted) {
          setOrder(data);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || "Đã xảy ra lỗi khi tải thông tin đơn hàng.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchOrder();

    return () => {
      isMounted = false;
    };
  }, [id, token]);

  const orderCode = order?.order_code || order?.code || order?.orderId || order?.id || id;
  const statusLabel = order?.status_label || (order?.status === "received" || !order?.status ? "Đã tiếp nhận" : order.status);

  const handleCopy = async () => {
    if (!orderCode) return;
    try {
      await navigator.clipboard.writeText(orderCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  // Pricing calculations
  const rawSubtotal =
    order?.subtotal ??
    order?.sub_total ??
    order?.items?.reduce((s, item) => s + (item.price || 0) * (item.quantity || 1), 0) ??
    0;
  const rawShipping = order?.shippingFee ?? order?.shipping_fee ?? (rawSubtotal >= 500000 ? 0 : 30000);
  const rawTotal = order?.total ?? order?.grand_total ?? rawSubtotal + rawShipping;

  // Format date if available
  const dateValue = order?.createdAt || order?.created_at;
  const formattedDate = dateValue
    ? new Date(dateValue).toLocaleString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "Vừa xong";

  return (
    <div className="storefront">
      <Header />
      <CartDrawer />
      <WishlistDrawer />

      <main className="order-success-page">
        <div className="order-success-container">
          {loading ? (
            <div className="order-details-card" style={{ textAlign: "center", padding: "60px 24px" }}>
              <Package size={44} style={{ color: "var(--primary)", margin: "0 auto 16px" }} />
              <h2>Đang tải thông tin đơn hàng…</h2>
              <p style={{ color: "var(--text-secondary)" }}>Vui lòng đợi trong giây lát</p>
            </div>
          ) : error || !order ? (
            <div className="order-error-view order-error-card">
              <AlertCircle size={52} />
              <h2>Không tìm thấy đơn hàng</h2>
              <p>
                {error ||
                  "Đường dẫn xem đơn hàng không hợp lệ, đơn hàng đã bị xóa hoặc mã truy cập đã hết hạn."}
              </p>
              <Link href="/" className="shop-primary">
                <Home size={16} />
                <span>Quay về trang chủ</span>
              </Link>
            </div>
          ) : (
            <>
              {/* Success Banner Card */}
              <div className="order-success-header-card">
                <div className="order-success-icon-badge">
                  <CheckCircle2 size={36} />
                </div>
                <h1>Đặt hàng thành công!</h1>
                <p>
                  Cảm ơn bạn đã lựa chọn FITY Studio. Chúng tôi đã tiếp nhận đơn hàng của bạn và
                  sẽ tiến hành liên hệ xác nhận size trang phục trong thời gian sớm nhất.
                </p>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div className="order-code-pill order-code-badge">
                    <span>Mã đơn hàng:</span>
                    <strong>{orderCode}</strong>
                    <button
                      type="button"
                      className="order-code-copy-btn"
                      onClick={handleCopy}
                      aria-label="Sao chép mã đơn hàng"
                    >
                      {copied ? (
                        <>
                          <Check size={13} color="#194e3d" />
                          <span style={{ color: "#194e3d" }}>Đã chép</span>
                        </>
                      ) : (
                        <>
                          <Copy size={13} />
                          <span>Sao chép</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="order-status-badge order-status-pill">
                    <span className="order-status-dot" />
                    <span>{statusLabel}</span>
                  </div>
                </div>
              </div>

              {/* Order Details & Summary Card */}
              <div className="order-details-card">
                <h2>
                  <Package size={18} style={{ marginRight: 8, color: "var(--primary)" }} />
                  Thông tin đơn hàng & Người nhận
                </h2>

                <div className="order-info-columns">
                  {/* Customer Information Snapshot */}
                  <div className="order-info-box">
                    <label>Địa chỉ nhận hàng</label>
                    <p style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                      <User size={15} style={{ flexShrink: 0, marginTop: 4, color: "var(--accent-text)" }} />
                      <span>
                        <strong>{order.customer?.name || "Khách mua nhanh"}</strong>
                      </span>
                    </p>
                    <p style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                      <Phone size={15} style={{ flexShrink: 0, color: "var(--accent-text)" }} />
                      <span>{order.customer?.phone || "Chưa cung cấp"}</span>
                    </p>
                    {order.customer?.email && (
                      <p style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                        <Mail size={15} style={{ flexShrink: 0, color: "var(--accent-text)" }} />
                        <span>{order.customer.email}</span>
                      </p>
                    )}
                    <p style={{ display: "flex", alignItems: "flex-start", gap: 6, marginTop: 6 }}>
                      <MapPin size={15} style={{ flexShrink: 0, marginTop: 4, color: "var(--accent-text)" }} />
                      <span>{order.customer?.address || "Chưa cung cấp"}</span>
                    </p>
                    {order.customer?.notes && (
                      <p style={{ display: "flex", alignItems: "flex-start", gap: 6, marginTop: 6, color: "var(--text-secondary)" }}>
                        <FileText size={15} style={{ flexShrink: 0, marginTop: 4 }} />
                        <span>Ghi chú: {order.customer.notes}</span>
                      </p>
                    )}
                  </div>

                  {/* Order Status & Delivery Info */}
                  <div className="order-info-box">
                    <label>Trạng thái tiếp nhận</label>
                    <p style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Calendar size={15} style={{ color: "var(--accent-text)" }} />
                      <span>Thời gian: {formattedDate}</span>
                    </p>
                    <p style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                      <Truck size={15} style={{ color: "var(--accent-text)" }} />
                      <span>Hình thức: Giao hàng tận nơi & Thu hộ (COD)</span>
                    </p>
                    <div
                      style={{
                        marginTop: 12,
                        padding: "10px 14px",
                        background: "var(--surface-muted)",
                        borderRadius: "var(--radius-control)",
                        fontSize: 12,
                        lineHeight: 1.5,
                        color: "var(--text-secondary)",
                      }}
                    >
                      Nhân viên tư vấn sẽ liên hệ để xác thực thông tin và kiểm tra size trang phục
                      trước khi gửi kiện hàng.
                    </div>
                  </div>
                </div>

                {/* Purchased Items List Snapshot */}
                <h3
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    margin: "24px 0 14px",
                    paddingBottom: 8,
                    borderBottom: "1px solid var(--line)",
                  }}
                >
                  Sản phẩm đã chọn ({(order.items || []).length})
                </h3>

                <div className="order-items-summary-list">
                  {(order.items || []).map((item, idx) => (
                    <div className="order-item-summary-row" key={`${item.productId || idx}_${item.size}_${item.color}`}>
                      <div className="order-item-summary-left">
                        {item.image && (
                          <div className="order-item-thumb">
                            <img src={item.image} alt={item.name} width="52" height="64" />
                          </div>
                        )}
                        <div className="order-item-meta">
                          <strong>{item.name}</strong>
                          <span>
                            Màu: {item.color} · Size: <strong>{item.size}</strong> · Số lượng:{" "}
                            <strong>{item.quantity}</strong>
                          </span>
                        </div>
                      </div>

                      <div className="order-item-summary-price">
                        {money((item.price || 0) * (item.quantity || 1))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Price Breakdown */}
                <div
                  className="cart-summary-rows"
                  style={{
                    borderTop: "1px solid var(--line)",
                    marginTop: 24,
                    paddingTop: 18,
                  }}
                >
                  <div className="cart-summary-row">
                    <span>Tạm tính</span>
                    <strong>{money(rawSubtotal)}</strong>
                  </div>

                  <div className="cart-summary-row">
                    <span>Phí giao hàng</span>
                    <span>
                      {rawShipping === 0 ? (
                        <span className="shipping-free-badge">Miễn phí</span>
                      ) : (
                        <strong>{money(rawShipping)}</strong>
                      )}
                    </span>
                  </div>

                  <div className="cart-summary-row total-row">
                    <span>Tổng tiền thanh toán (COD)</span>
                    <strong>{money(rawTotal)}</strong>
                  </div>
                </div>

                {/* Primary CTA: Tiếp tục mua sắm */}
                <div className="order-actions-row">
                  <Link href="/" className="shop-primary" style={{ minWidth: 220 }}>
                    <ShoppingBag size={17} />
                    <span>Tiếp tục mua sắm</span>
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function OrderPage() {
  return (
    <Suspense
      fallback={
        <div className="storefront">
          <Header />
          <main className="order-success-page">
            <div className="order-success-container">
              <div className="order-details-card" style={{ textAlign: "center", padding: "60px 24px" }}>
                <Package size={44} style={{ color: "var(--primary)", margin: "0 auto 16px" }} />
                <h2>Đang tải trang xác nhận đơn hàng…</h2>
              </div>
            </div>
          </main>
          <Footer />
        </div>
      }
    >
      <OrderDetailsContent />
    </Suspense>
  );
}
