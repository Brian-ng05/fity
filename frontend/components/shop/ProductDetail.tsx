"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Heart,
  Minus,
  Plus,
  ScanLine,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import type { Product } from "../../lib/catalog";
import { getRelatedProducts, money } from "../../lib/catalog";
import { useCart } from "../../lib/CartContext";
import { useScan, type SizeAdviceResult } from "../../lib/ScanContext";
import Header from "./Header";
import Footer from "./Footer";
import ProductCard from "./ProductCard";
import CartDrawer from "./CartDrawer";
import WishlistDrawer from "./WishlistDrawer";
import Modal from "./Modal";
import SizeChartModal from "./SizeChartModal";

const FitExperience = dynamic(() => import("./FitExperience"), {
  ssr: false,
  loading: () => <div className="fit-lazy">Đang mở phòng tìm size…</div>,
});

export default function ProductDetail({ product }: { product: Product }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addToCart, isWishlisted, toggleWishlist } = useCart();
  const { job, fetchAdviceForProduct, appliedSizes, applySizeToProduct } = useScan();

  const [selectedColor, setSelectedColor] = useState(product.color || product.colors[0]?.name || "");
  const [selectedSize, setSelectedSize] = useState(() => {
    return searchParams?.get("size") || appliedSizes[product.id] || "";
  });
  const [selectedImage, setSelectedImage] = useState(product.image);
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");

  const [chartOpen, setChartOpen] = useState(false);
  const [fitOpen, setFitOpen] = useState(false);

  // Dynamic size advice from active scan session if available
  const [advice, setAdvice] = useState<SizeAdviceResult | null>(null);
  const [adviceLoading, setAdviceLoading] = useState(false);

  const favorite = isWishlisted(product.id);
  const relatedProducts = useMemo(() => getRelatedProducts(product.id, 4), [product.id]);

  // Fetch advice if scan session is active
  useEffect(() => {
    if (!job || job.status !== "completed") {
      setAdvice(null);
      return;
    }
    let active = true;
    setAdviceLoading(true);

    fetchAdviceForProduct(product)
      .then((res) => {
        if (active) {
          setAdvice(res);
          // If advice provides candidate size and no size selected yet, pre-select it
          if (res.candidates && res.candidates.length > 0 && !selectedSize) {
            setSelectedSize(res.candidates[0]);
            applySizeToProduct(product.id, res.candidates[0]);
          }
        }
      })
      .finally(() => {
        if (active) setAdviceLoading(false);
      });

    return () => {
      active = false;
    };
  }, [job?.id, job?.status, product.id, fetchAdviceForProduct, product, selectedSize, applySizeToProduct]);

  // Handle Add to Cart
  const handleAddToCart = () => {
    if (!selectedSize) {
      setMessage("Vui lòng chọn một size trước khi thêm vào giỏ.");
      return;
    }
    setMessage("");
    addToCart(
      {
        productId: product.id,
        productSlug: product.slug,
        name: product.name,
        price: product.price,
        color: selectedColor,
        size: selectedSize,
        image: selectedImage || product.image,
      },
      quantity
    );
  };

  const handleApplySizeFromScan = (sizeToApply: string) => {
    setSelectedSize(sizeToApply);
    applySizeToProduct(product.id, sizeToApply);
    setMessage(`Đã chọn size ${sizeToApply} theo gợi ý hình thể của bạn.`);
    setFitOpen(false);
  };

  return (
    <div className="storefront">
      <Header />

      <main className="shop-main product-detail-main">
        {/* Breadcrumb Navigation */}
        <nav className="shop-breadcrumb" aria-label="Điều hướng phân cấp">
          <Link href="/">Trang chủ</Link>
          <span>/</span>
          <Link href={`/?category=${product.category}#catalog`}>{product.categoryName}</Link>
          <span>/</span>
          <span className="current-crumb">{product.name}</span>
        </nav>

        {/* Product Layout Grid */}
        <div className="product-layout">
          {/* Left: Gallery */}
          <div className="product-gallery">
            <div className="product-photo">
              <img
                src={selectedImage}
                alt={`${product.name} - ${selectedColor}`}
                width="1122"
                height="1402"
                fetchPriority="high"
                className="main-detail-img"
              />
              <span className="product-photo-tag">{product.categoryName} · Thử nghiệm</span>
              <button
                className={`shop-icon favorite ${favorite ? "selected" : ""}`}
                aria-label={favorite ? "Bỏ lưu sản phẩm" : "Lưu sản phẩm yêu thích"}
                aria-pressed={favorite}
                onClick={() => toggleWishlist(product.id)}
              >
                <Heart size={20} fill={favorite ? "currentColor" : "none"} />
              </button>
            </div>

            {/* Gallery Thumbnails */}
            {product.gallery.length > 1 && (
              <div className="gallery-thumbnails" role="group" aria-label="Hình ảnh chi tiết">
                {product.gallery.map((img, idx) => (
                  <button
                    key={idx}
                    className={`thumb-btn ${selectedImage === img ? "active" : ""}`}
                    onClick={() => setSelectedImage(img)}
                    aria-label={`Xem ảnh ${idx + 1}`}
                  >
                    <img src={img} alt={`Góc nhìn ${idx + 1}`} width="80" height="100" />
                  </button>
                ))}
              </div>
            )}

            <p className="product-image-note">
              Ảnh sản phẩm thử nghiệm cho trải nghiệm số đo hình thể 3D.
            </p>
          </div>

          {/* Right: Product Info & Actions */}
          <section className="product-info" aria-label="Thông tin sản phẩm">
            <span className="detail-category-badge">{product.categoryName}</span>
            <h1>{product.name}</h1>
            <p className="product-subtitle">{product.subtitle}</p>

            <div className="product-price">
              {money(product.price)}
              {product.originalPrice && (
                <span className="original-price">{money(product.originalPrice)}</span>
              )}
              <span>Giá thử nghiệm</span>
            </div>

            <div className="product-divider" />

            {/* Color Selector */}
            <div className="product-color-selector">
              <div className="color-label-row">
                <span>
                  Màu sắc: <strong>{selectedColor}</strong>
                </span>
              </div>
              <div className="color-swatches-group" role="radiogroup" aria-label="Chọn màu sắc">
                {product.colors.map((c) => {
                  const isSelected = selectedColor === c.name;
                  return (
                    <button
                      key={c.name}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={c.name}
                      className={`color-swatch-item ${isSelected ? "selected" : ""}`}
                      onClick={() => setSelectedColor(c.name)}
                      style={{ backgroundColor: c.hex }}
                    >
                      {isSelected && (
                        <Check
                          size={14}
                          color={["#ffffff", "#fcfbf7", "#f4f1ea", "#f0ece1", "#ded6c4"].includes(c.hex) ? "#194e3d" : "#ffffff"}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Size Selector */}
            <div className="size-selector-section">
              <div className="size-heading">
                <span>
                  Kích thước{selectedSize && <strong> · {selectedSize}</strong>}
                </span>
                <button
                  type="button"
                  className="shop-inline size-chart-btn"
                  onClick={() => setChartOpen(true)}
                >
                  Bảng size chi tiết
                </button>
              </div>

              <div className="product-sizes" role="group" aria-label="Chọn kích thước">
                {product.sizes.map((s) => {
                  const isSelected = selectedSize === s;
                  const isRecommended = advice?.candidates?.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      aria-label={`Size ${s}`}
                      className={`${isSelected ? "selected" : ""} ${isRecommended ? "recommended" : ""}`}
                      aria-pressed={isSelected}
                      onClick={() => {
                        setSelectedSize(s);
                        setMessage("");
                      }}
                    >
                      {s}
                      {isRecommended && (
                        <span className="recommended-dot" title="Kích thước phù hợp với hình thể của bạn" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Fit Studio Entry Card */}
            <div className="product-fit-banner">
              <button
                type="button"
                className="fit-entry"
                onClick={() => setFitOpen(true)}
              >
                <span className="fit-entry-icon">
                  <ScanLine size={24} />
                </span>
                <span className="fit-entry-text">
                  <strong>
                    {advice?.candidates?.length
                      ? `MORPH AI gợi ý: Size ${advice.candidates.join(", ")}`
                      : advice?.status === "insufficient_measurements"
                      ? "Cần scan toàn thân để đối chiếu size này"
                      : job?.status === "completed"
                      ? "Xem lại hình thể 3D & gợi ý size"
                      : "Bạn chưa chắc về size?"}
                  </strong>
                  <small>
                    {advice?.candidates?.length
                      ? "Bấm để xem tương tác mô hình 3D và số đo của bạn"
                      : advice?.status === "insufficient_measurements"
                      ? "Webcam thân trên chưa đo vòng mông cho sản phẩm này"
                      : job?.status === "completed"
                      ? "Đối chiếu hình thể của bạn với bảng size sản phẩm"
                      : "Tìm size của tôi với MORPH AI bằng webcam 2 góc"}
                  </small>
                </span>
                <ArrowRight size={20} />
              </button>
            </div>

            {/* Quantity and Add to Cart Row */}
            <div className="purchase-actions-row">
              <div className="qty-picker">
                <button
                  type="button"
                  aria-label="Giảm số lượng"
                  disabled={quantity <= 1}
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                >
                  <Minus size={15} />
                </button>
                <span>{quantity}</span>
                <button
                  type="button"
                  aria-label="Tăng số lượng"
                  disabled={quantity >= 10}
                  onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                >
                  <Plus size={15} />
                </button>
              </div>

              <button
                type="button"
                className="shop-primary add-to-cart-btn"
                onClick={handleAddToCart}
              >
                <ShoppingBag size={18} />
                Thêm vào giỏ
                <ArrowRight size={18} />
              </button>
            </div>

            {message && (
              <p className="product-message" role="alert">
                {message}
              </p>
            )}

            <p className="product-context">
              <ShieldCheck size={16} />
              Chọn size thủ công hoặc đối chiếu trực tiếp với avatar 3D của bạn.
            </p>

            {/* Collapsible Details */}
            <div className="product-collapsibles">
              <details className="product-detail" open>
                <summary>
                  Chất liệu & Cấu tạo
                  <Plus size={16} />
                </summary>
                <p>{product.material}</p>
                <ul className="detail-bullets">
                  {product.details.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </details>

              <details className="product-detail">
                <summary>
                  Phom dáng & Thiết kế
                  <Plus size={16} />
                </summary>
                <p>{product.fit}</p>
                <p>{product.description}</p>
              </details>

              <details className="product-detail">
                <summary>
                  Lưu ý thử nghiệm
                  <Plus size={16} />
                </summary>
                <p>
                  Sản phẩm, giá bán và bảng size là dữ liệu thử nghiệm trong MORPH Studio. Giỏ hàng chỉ lưu trữ trên trình duyệt của bạn. Chưa tích hợp hệ thống thanh toán hoặc đặt hàng thật.
                </p>
              </details>
            </div>
          </section>
        </div>

        {/* Related Products Section */}
        {relatedProducts.length > 0 && (
          <section className="related-products-section">
            <div className="section-title-row">
              <h2>Có thể bạn cũng thích</h2>
              <Link href={`/?category=${product.category}#catalog`} className="shop-inline">
                Xem thêm trong danh mục {product.categoryName} →
              </Link>
            </div>
            <div className="product-grid related-grid">
              {relatedProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
      </main>

      <Footer />

      {/* Cart & Wishlist Drawers */}
      <CartDrawer />
      <WishlistDrawer />

      {/* Size Chart Modal */}
      <SizeChartModal
        product={product}
        open={chartOpen}
        onClose={() => setChartOpen(false)}
        onOpenScan={() => setFitOpen(true)}
      />

      {/* Fit Studio Modal */}
      <Modal
        open={fitOpen}
        onClose={() => setFitOpen(false)}
        title={`Tìm size của tôi · ${product.name}`}
        wide
      >
        {fitOpen && (
          <FitExperience
            product={product}
            active={fitOpen}
            onSelectSize={handleApplySizeFromScan}
          />
        )}
      </Modal>
    </div>
  );
}
