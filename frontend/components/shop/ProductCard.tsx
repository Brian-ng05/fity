"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import type { Product } from "../../lib/catalog";
import { money } from "../../lib/catalog";
import { useCart } from "../../lib/CartContext";

export default function ProductCard({ product }: { product: Product }) {
  const { isWishlisted, toggleWishlist } = useCart();
  const favorite = isWishlisted(product.id);

  return (
    <article className="product-card" aria-label={`Sản phẩm ${product.name}`}>
      <div className="product-card-media">
        <Link href={`/products/${product.slug}`} className="product-card-image-link">
          <img
            src={product.image}
            alt={`${product.name}, màu ${product.color}`}
            loading="lazy"
            className="product-card-img"
          />
        </Link>

        {product.isNew && <span className="product-tag new-tag">Mới</span>}
        {product.isFeatured && !product.isNew && (
          <span className="product-tag featured-tag">Nổi bật</span>
        )}

        <button
          className={`shop-icon favorite-btn ${favorite ? "selected" : ""}`}
          aria-label={favorite ? `Bỏ lưu ${product.name}` : `Lưu ${product.name} vào yêu thích`}
          aria-pressed={favorite}
          onClick={(e) => {
            e.preventDefault();
            toggleWishlist(product.id);
          }}
        >
          <Heart size={18} fill={favorite ? "currentColor" : "none"} />
        </button>
      </div>

      <div className="product-card-body">
        <div className="product-card-meta">
          <span className="product-card-category">{product.categoryName}</span>
          <div className="product-card-colors" aria-label="Màu sắc có sẵn">
            {product.colors.map((c) => (
              <span
                key={c.name}
                className="color-dot"
                style={{ backgroundColor: c.hex }}
                title={c.name}
              />
            ))}
          </div>
        </div>

        <h3 className="product-card-title">
          <Link href={`/products/${product.slug}`}>{product.name}</Link>
        </h3>

        <div className="product-card-price-row">
          <div className="product-card-price">
            <strong>{money(product.price)}</strong>
            {product.originalPrice && (
              <span className="original-price">{money(product.originalPrice)}</span>
            )}
          </div>
          <span className="demo-price-tag">Giá thử nghiệm</span>
        </div>

        <div className="product-card-sizes" aria-label="Kích thước">
          {product.sizes.map((s) => (
            <span key={s} className="size-badge">
              {s}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}
