"use client";

import Link from "next/link";
import { Heart, Trash2, X } from "lucide-react";
import { useCart } from "../../lib/CartContext";
import { getAllProducts, money } from "../../lib/catalog";

export default function WishlistDrawer() {
  const { wishlist, toggleWishlist, isWishlistOpen, setIsWishlistOpen } = useCart();

  if (!isWishlistOpen) return null;

  const allProducts = getAllProducts();
  const savedProducts = allProducts.filter((p) => wishlist.includes(p.id));

  return (
    <div className="cart-drawer-backdrop" onClick={() => setIsWishlistOpen(false)}>
      <div
        className="cart-drawer-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Danh sách yêu thích"
      >
        <div className="cart-drawer-header">
          <div className="cart-title-row">
            <Heart size={20} fill="currentColor" />
            <h2>Sản phẩm đã lưu</h2>
            <span className="cart-count-badge">({savedProducts.length})</span>
          </div>
          <button
            className="shop-icon"
            onClick={() => setIsWishlistOpen(false)}
            aria-label="Đóng danh sách yêu thích"
          >
            <X size={20} />
          </button>
        </div>

        <div className="cart-drawer-body">
          {savedProducts.length > 0 ? (
            <div className="cart-items-list">
              {savedProducts.map((p) => (
                <div className="cart-line-item" key={p.id}>
                  <Link
                    href={`/products/${p.slug}`}
                    onClick={() => setIsWishlistOpen(false)}
                    className="cart-line-img"
                  >
                    <img src={p.image} alt={p.name} width="84" height="105" />
                  </Link>

                  <div className="cart-line-details">
                    <Link
                      href={`/products/${p.slug}`}
                      onClick={() => setIsWishlistOpen(false)}
                      className="cart-line-name"
                    >
                      {p.name}
                    </Link>
                    <p className="cart-line-variant">{p.categoryName} · {p.color}</p>
                    <div className="cart-line-price">{money(p.price)}</div>

                    <div className="wishlist-actions-row">
                      <Link
                        href={`/products/${p.slug}`}
                        onClick={() => setIsWishlistOpen(false)}
                        className="shop-inline"
                      >
                        Xem chi tiết & chọn size →
                      </Link>
                      <button
                        className="remove-line-btn"
                        aria-label={`Bỏ lưu ${p.name}`}
                        onClick={() => toggleWishlist(p.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="cart-empty-state">
              <Heart size={48} strokeWidth={1.2} />
              <h3>Chưa có sản phẩm yêu thích</h3>
              <p>Nhấn vào biểu tượng trái tim ở bất kỳ sản phẩm nào để lưu lại danh sách riêng của bạn.</p>
              <button
                className="shop-primary"
                onClick={() => setIsWishlistOpen(false)}
              >
                Khám phá bộ sưu tập
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
