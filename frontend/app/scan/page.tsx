"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import FitExperience from "../../components/shop/FitExperience";
import { getAllProducts, essential, type Product } from "../../lib/catalog";

export default function Page() {
  const [selectedProduct, setSelectedProduct] = useState<Product>(essential);
  const [size, setSize] = useState("");
  const allProducts = getAllProducts();

  return (
    <main className="storefront scan-standalone">
      <header className="shop-header">
        <Link href="/" className="shop-logo" aria-label="FITY Studio trang chủ">
          FITY<span>STUDIO</span>
        </Link>
        <div className="scan-product-picker">
          <label htmlFor="scan-product-select">
            Đối chiếu bảng size:
          </label>
          <select
            id="scan-product-select"
            value={selectedProduct.id}
            onChange={(e) => {
              const p = allProducts.find((item) => item.id === e.target.value);
              if (p) {
                setSelectedProduct(p);
                setSize("");
              }
            }}
          >
            {allProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.categoryName}: {p.name}
              </option>
            ))}
          </select>
        </div>
        <Link href="/" className="scan-back-link">
          <ArrowLeft size={16} /> Về trang mua sắm
        </Link>
      </header>

      {size && (
        <div className="standalone-choice" role="status">
          <span>
            <Check size={16} /> Bạn đã chọn size <strong>{size}</strong> cho{" "}
            <strong>{selectedProduct.name}</strong>.
          </span>
          <Link href={`/products/${selectedProduct.slug}?size=${size}`}>
            Xem chi tiết sản phẩm này →
          </Link>
        </div>
      )}

      <FitExperience
        product={selectedProduct}
        active
        onSelectSize={setSize}
      />
    </main>
  );
}
