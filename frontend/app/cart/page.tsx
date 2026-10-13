"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { ArrowLeft, ArrowRight, Minus, Plus, ShoppingBag, Trash2, Undo2, X, Sparkles, Check, Truck } from "lucide-react";
import Header from "../../components/shop/Header";
import Footer from "../../components/shop/Footer";
import CartDrawer from "../../components/shop/CartDrawer";
import WishlistDrawer from "../../components/shop/WishlistDrawer";
import { useCart, CartItem } from "../../lib/CartContext";
import { PRODUCTS, getProductBySlug, money } from "../../lib/catalog";

const FREE_SHIPPING_THRESHOLD = 500000;
const STANDARD_SHIPPING_FEE = 30000;

interface UndoToastState {
  show: boolean;
  item: CartItem;
}

export default function CartPage() {
  const {
    cart,
    updateQuantity,
    updateVariant,
    removeItem,
    undoRemove,
    lastRemovedItem,
    totalQuantity,
    subtotal,
    hydrated,
  } = useCart();

  const [undoToast, setUndoToast] = useState<UndoToastState | null>(null);

  // Auto-dismiss undo toast after 7 seconds
  useEffect(() => {
    if (!undoToast?.show) return;
    const timer = setTimeout(() => {
      setUndoToast(null);
    }, 7000);
    return () => clearTimeout(timer);
  }, [undoToast]);

  const handleRemove = (item: CartItem) => {
    removeItem(item.productId, item.color, item.size);
    setUndoToast({ show: true, item });
  };

  const handleUndo = () => {
    undoRemove();
    setUndoToast(null);
  };

  // Pricing calculations
  const isFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD;
  const shippingFee = cart.length === 0 ? 0 : isFreeShipping ? 0 : STANDARD_SHIPPING_FEE;
  const grandTotal = subtotal + shippingFee;
  const amountToFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);

  if (!hydrated) {
    return (
      <div className="storefront">
        <Header />
        <main className="cart-page">
          <div className="cart-page-container">
            <div className="cart-page-header">
              <h1>Giỏ hàng của bạn</h1>
              <p>Đang tải giỏ hàng…</p>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="storefront">
      <Header />
      <CartDrawer />
      <WishlistDrawer />

      {/* Transient Undo Toast */}
      {undoToast?.show && (
        <div className="commerce-toast" role="status" aria-live="polite">
          <div className="toast-icon-box">
            <Trash2 size={20} />
          </div>
          <div className="toast-body">
            <div className="toast-title">Đã xóa {undoToast.item.name}</div>
            <p className="toast-desc">
              Biến thể: {undoToast.item.color} · Size {undoToast.item.size}
            </p>
          </div>
          <div className="toast-actions">
            <button
              type="button"
              className="toast-undo-btn"
              onClick={handleUndo}
              aria-label={`Hoàn tác xóa ${undoToast.item.name}`}
            >
              <Undo2 size={15} style={{ marginRight: 6 }} />
              Hoàn tác
            </button>
            <button
              type="button"
              className="toast-close-btn"
              onClick={() => setUndoToast(null)}
              aria-label="Đóng thông báo"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <main className="cart-page">
        <div className="cart-page-container">
          <div className="cart-page-header">
            <h1>Giỏ hàng ({totalQuantity})</h1>
            <p>Kiểm tra danh sách trang phục đã chọn và tiến hành đặt hàng</p>
          </div>

          {cart.length === 0 ? (
            <div className="cart-empty-view">
              <ShoppingBag size={56} strokeWidth={1.2} />
              <h2>Giỏ hàng của bạn đang trống</h2>
              <p>
                Bạn chưa chọn sản phẩm nào. Hãy khám phá bộ sưu tập và tìm những trang phục vừa vặn
                nhất với số đo cơ thể bạn.
              </p>
              <Link href="/#catalog" className="shop-primary">
                Khám phá bộ sưu tập
                <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
            <div className="cart-page-layout">
              {/* Left 2/3: Item List */}
              <div className="cart-items-section">
                {/* Desktop Table View */}
                <div className="cart-table-card">
                  <table className="cart-table" aria-label="Bảng danh sách sản phẩm trong giỏ hàng">
                    <thead>
                      <tr>
                        <th>Sản phẩm</th>
                        <th>Đơn giá</th>
                        <th>Số lượng</th>
                        <th>Thành tiền</th>
                        <th><span className="sr-only">Thao tác</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {cart.map((item) => {
                        const product = getProductBySlug(item.productSlug);
                        const availableColors = product?.colors || [{ name: item.color, hex: "#ccc" }];
                        const availableSizes = product?.sizes || [item.size];
                        const lineTotal = item.price * item.quantity;

                        return (
                          <tr key={item.id}>
                            <td>
                              <div className="cart-product-cell">
                                <Link
                                  href={`/products/${item.productSlug}`}
                                  className="cart-product-thumb"
                                >
                                  <img src={item.image} alt={item.name} width="72" height="90" />
                                </Link>
                                <div className="cart-product-info">
                                  <Link
                                    href={`/products/${item.productSlug}`}
                                    className="cart-product-name"
                                  >
                                    {item.name}
                                  </Link>

                                  {/* Inline variant changing */}
                                  <div className="cart-inline-variant">
                                    <div className="cart-variant-group">
                                      <label htmlFor={`color-${item.id}`}>Màu:</label>
                                      <select
                                        id={`color-${item.id}`}
                                        className="cart-variant-select"
                                        value={item.color}
                                        aria-label={`Đổi màu cho ${item.name}`}
                                        onChange={(e) =>
                                          updateVariant(item, e.target.value, item.size)
                                        }
                                      >
                                        {availableColors.map((c) => (
                                          <option key={c.name} value={c.name}>
                                            {c.name}
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    <div className="cart-variant-group">
                                      <label htmlFor={`size-${item.id}`}>Size:</label>
                                      <select
                                        id={`size-${item.id}`}
                                        className="cart-variant-select"
                                        value={item.size}
                                        aria-label={`Đổi size cho ${item.name}`}
                                        onChange={(e) =>
                                          updateVariant(item, item.color, e.target.value)
                                        }
                                      >
                                        {availableSizes.map((s) => (
                                          <option key={s} value={s}>
                                            {s}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td>
                              <span className="cart-product-price">{money(item.price)}</span>
                            </td>

                            <td>
                              <div className="cart-stepper">
                                <button
                                  type="button"
                                  aria-label={`Giảm số lượng ${item.name}`}
                                  disabled={item.quantity <= 1}
                                  onClick={() => updateQuantity(item.productId, item.color, item.size, -1)}
                                >
                                  <Minus size={14} />
                                </button>
                                <span className="cart-stepper-val">{item.quantity}</span>
                                <button
                                  type="button"
                                  aria-label={`Tăng số lượng ${item.name}`}
                                  disabled={item.quantity >= 10}
                                  onClick={() => updateQuantity(item.productId, item.color, item.size, 1)}
                                >
                                  <Plus size={14} />
                                </button>
                              </div>
                            </td>

                            <td>
                              <span className="cart-row-total">{money(lineTotal)}</span>
                            </td>

                            <td>
                              <button
                                type="button"
                                className="cart-remove-btn"
                                onClick={() => handleRemove(item)}
                                aria-label={`Xóa ${item.name} size ${item.size} màu ${item.color} khỏi giỏ`}
                              >
                                <Trash2 size={16} />
                                <span>Xóa</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile 1-Column Card List */}
                <div className="cart-mobile-card-list">
                  {cart.map((item) => {
                    const product = getProductBySlug(item.productSlug);
                    const availableColors = product?.colors || [{ name: item.color, hex: "#ccc" }];
                    const availableSizes = product?.sizes || [item.size];
                    const lineTotal = item.price * item.quantity;

                    return (
                      <div className="cart-mobile-item-card" key={item.id}>
                        <Link
                          href={`/products/${item.productSlug}`}
                          className="cart-mobile-item-thumb"
                        >
                          <img src={item.image} alt={item.name} width="84" height="105" />
                        </Link>

                        <div className="cart-mobile-item-details">
                          <Link
                            href={`/products/${item.productSlug}`}
                            className="cart-product-name"
                          >
                            {item.name}
                          </Link>

                          <div className="cart-inline-variant">
                            <div className="cart-variant-group">
                              <label htmlFor={`m-color-${item.id}`}>Màu:</label>
                              <select
                                id={`m-color-${item.id}`}
                                className="cart-variant-select"
                                value={item.color}
                                onChange={(e) => updateVariant(item, e.target.value, item.size)}
                              >
                                {availableColors.map((c) => (
                                  <option key={c.name} value={c.name}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="cart-variant-group">
                              <label htmlFor={`m-size-${item.id}`}>Size:</label>
                              <select
                                id={`m-size-${item.id}`}
                                className="cart-variant-select"
                                value={item.size}
                                onChange={(e) => updateVariant(item, item.color, e.target.value)}
                              >
                                {availableSizes.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="cart-mobile-price-row">
                            <span className="cart-product-price">{money(item.price)}</span>
                            <span className="cart-row-total">{money(lineTotal)}</span>
                          </div>

                          <div className="cart-mobile-actions-row">
                            <div className="cart-stepper">
                              <button
                                type="button"
                                aria-label={`Giảm số lượng ${item.name}`}
                                disabled={item.quantity <= 1}
                                onClick={() => updateQuantity(item.productId, item.color, item.size, -1)}
                              >
                                <Minus size={14} />
                              </button>
                              <span className="cart-stepper-val">{item.quantity}</span>
                              <button
                                type="button"
                                aria-label={`Tăng số lượng ${item.name}`}
                                disabled={item.quantity >= 10}
                                onClick={() => updateQuantity(item.productId, item.color, item.size, 1)}
                              >
                                <Plus size={14} />
                              </button>
                            </div>

                            <button
                              type="button"
                              className="cart-remove-btn"
                              onClick={() => handleRemove(item)}
                              aria-label={`Xóa ${item.name} khỏi giỏ`}
                            >
                              <Trash2 size={16} />
                              <span>Xóa</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ marginTop: 20 }}>
                  <Link href="/#catalog" className="cart-continue-link">
                    <ArrowLeft size={16} />
                    <span>Tiếp tục chọn thêm trang phục</span>
                  </Link>
                </div>
              </div>

              {/* Right 1/3: Order Summary Panel */}
              <aside className="cart-summary-section" aria-label="Tóm tắt giỏ hàng">
                <div className="cart-summary-card">
                  <h2>Tóm tắt đơn hàng</h2>

                  {/* Free shipping policy banner */}
                  {!isFreeShipping && amountToFreeShipping > 0 ? (
                    <div className="shipping-progress-banner">
                      <Truck size={18} />
                      <div>
                        Mua thêm <strong>{money(amountToFreeShipping)}</strong> để được{" "}
                        <span className="shipping-free-badge">Miễn phí giao hàng</span>
                      </div>
                    </div>
                  ) : (
                    <div className="shipping-progress-banner" style={{ background: "#eef6ee", borderColor: "#a9cca9" }}>
                      <Check size={18} color="#194e3d" />
                      <div>
                        <strong style={{ color: "#194e3d" }}>Bạn đủ điều kiện miễn phí vận chuyển!</strong>
                      </div>
                    </div>
                  )}

                  <div className="cart-summary-rows">
                    <div className="cart-summary-row">
                      <span>Tạm tính ({totalQuantity} sản phẩm)</span>
                      <strong>{money(subtotal)}</strong>
                    </div>

                    <div className="cart-summary-row">
                      <span>Phí giao hàng</span>
                      <span>
                        {isFreeShipping ? (
                          <span className="shipping-free-badge">Miễn phí</span>
                        ) : (
                          <strong>{money(STANDARD_SHIPPING_FEE)}</strong>
                        )}
                      </span>
                    </div>

                    <div className="cart-summary-row total-row">
                      <span>Tổng thanh toán</span>
                      <strong>{money(grandTotal)}</strong>
                    </div>
                  </div>

                  <Link href="/checkout" className="shop-primary cart-checkout-cta">
                    Tiến hành đặt hàng
                    <ArrowRight size={17} />
                  </Link>

                  <div className="cart-demo-notice" style={{ marginTop: 14 }}>
                    <p style={{ margin: 0 }}>
                      <strong>Lưu ý tiếp nhận đơn hàng:</strong>
                      <br />
                      Hệ thống tiếp nhận thông tin đơn hàng để chuẩn bị sản phẩm. Nhân viên MORPH Studio
                      sẽ liên hệ xác nhận size và thời gian giao hàng.
                    </p>
                  </div>
                </div>
              </aside>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
