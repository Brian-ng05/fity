"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowRight, ScanLine, ShieldCheck, Sparkles } from "lucide-react";
import { getAllProducts, type Product, essential } from "../../lib/catalog";
import Header from "./Header";
import Footer from "./Footer";
import ProductCard from "./ProductCard";
import ProductFilter, { type FilterState } from "./ProductFilter";
import CartDrawer from "./CartDrawer";
import WishlistDrawer from "./WishlistDrawer";
import Modal from "./Modal";
import { useScan } from "../../lib/ScanContext";

const FitExperience = dynamic(() => import("./FitExperience"), {
  ssr: false,
  loading: () => <div className="fit-lazy">Đang mở phòng tìm size…</div>,
});

function StorefrontHomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { job } = useScan();

  const allProducts = useMemo(() => getAllProducts(), []);

  // Filter state initialized from URL
  const [filters, setFilters] = useState<FilterState>(() => ({
    q: searchParams?.get("q") || "",
    category: searchParams?.get("category") || "",
    priceRange: searchParams?.get("priceRange") || "all",
    color: searchParams?.get("color") || "",
    size: searchParams?.get("size") || "",
    sort: searchParams?.get("sort") || "featured",
  }));

  // Sync filters whenever searchParams changes from outside
  useEffect(() => {
    setFilters({
      q: searchParams?.get("q") || "",
      category: searchParams?.get("category") || "",
      priceRange: searchParams?.get("priceRange") || "all",
      color: searchParams?.get("color") || "",
      size: searchParams?.get("size") || "",
      sort: searchParams?.get("sort") || "featured",
    });
  }, [searchParams]);

  // Update URL when filters change
  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    const params = new URLSearchParams();
    if (newFilters.q) params.set("q", newFilters.q);
    if (newFilters.category) params.set("category", newFilters.category);
    if (newFilters.priceRange && newFilters.priceRange !== "all")
      params.set("priceRange", newFilters.priceRange);
    if (newFilters.color) params.set("color", newFilters.color);
    if (newFilters.size) params.set("size", newFilters.size);
    if (newFilters.sort && newFilters.sort !== "featured")
      params.set("sort", newFilters.sort);

    const qs = params.toString();
    const url = qs ? `/?${qs}#catalog` : "/#catalog";
    window.history.replaceState(null, "", url);
  };

  const handleResetFilters = () => {
    const emptyFilters: FilterState = {
      q: "",
      category: "",
      priceRange: "all",
      color: "",
      size: "",
      sort: "featured",
    };
    handleFilterChange(emptyFilters);
  };

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    return allProducts
      .filter((p) => {
        // Query search
        if (filters.q) {
          const query = filters.q.toLowerCase().trim();
          const matchName = p.name.toLowerCase().includes(query);
          const matchSub = p.subtitle.toLowerCase().includes(query);
          const matchCat = p.categoryName.toLowerCase().includes(query);
          const matchMat = p.material.toLowerCase().includes(query);
          if (!matchName && !matchSub && !matchCat && !matchMat) return false;
        }

        // Category
        if (filters.category && p.category !== filters.category) {
          return false;
        }

        // Price range
        if (filters.priceRange === "under-500" && p.price >= 500000) return false;
        if (
          filters.priceRange === "500-1000" &&
          (p.price < 500000 || p.price > 1000000)
        )
          return false;
        if (filters.priceRange === "over-1000" && p.price <= 1000000) return false;

        // Color
        if (filters.color) {
          const cQuery = filters.color.toLowerCase();
          const hasColor = p.colors.some((c) => c.name.toLowerCase().includes(cQuery));
          if (!hasColor) return false;
        }

        // Size
        if (filters.size && !p.sizes.includes(filters.size)) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (filters.sort === "price_asc") return a.price - b.price;
        if (filters.sort === "price_desc") return b.price - a.price;
        // Default featured: isFeatured and isNew first
        if (a.isFeatured && !b.isFeatured) return -1;
        if (!a.isFeatured && b.isFeatured) return 1;
        if (a.isNew && !b.isNew) return -1;
        if (!a.isNew && b.isNew) return 1;
        return 0;
      });
  }, [allProducts, filters]);

  // Modal for quick scan from home page
  const [scanOpen, setScanOpen] = useState(false);
  const [scanProduct, setScanProduct] = useState<Product>(essential);

  const openScanForProduct = (prod: Product) => {
    setScanProduct(prod);
    setScanOpen(true);
  };

  return (
    <div className="storefront">
      <Header />

      <main className="shop-main">
        {/* Compact & Refined Editorial Hero Banner */}
        <section className="shop-hero-editorial">
          <div className="hero-content">
            <span className="hero-season-tag">
              <Sparkles size={14} /> Bộ sưu tập Thu Đông 2026
            </span>
            <h1 className="hero-title">
              Vừa vặn từ phom dáng
              <br />
              đến hình thể của bạn.
            </h1>
            <p className="hero-desc">
              Thiết kế tối giản trên nền chất liệu tự nhiên cao cấp. Kết hợp công nghệ mô phỏng hình thể 3D để mỗi sản phẩm bạn chọn đều mang lại cảm giác thoải mái nhất.
            </p>

            <div className="hero-actions">
              <a href="#catalog" className="shop-primary hero-cta-btn">
                Khám phá bộ sưu tập <ArrowDown size={17} />
              </a>
              <button
                className="shop-secondary hero-scan-btn"
                onClick={() => openScanForProduct(essential)}
                aria-label="Bạn chưa chắc về size? Tìm size bằng 3D"
              >
                <ScanLine size={18} />
                {job?.status === "completed" ? "Xem lại hình thể 3D của bạn" : "Bạn chưa chắc về size? Tìm với 3D"}
              </button>
            </div>
          </div>

          <div className="hero-feature-card">
            <div className="feature-card-eyebrow">
              <span className="feature-atelier-badge">MORPH ATELIER · 3D FIT LAB</span>
              <span className="feature-status-dot" title="Sẵn sàng kết nối" />
            </div>
            <h3 className="feature-card-heading">
              May đo kỹ thuật số chuẩn xác qua 2 góc chụp máy ảnh
            </h3>
            <p className="feature-card-text">
              Không cần thước dây. AI phân tích hình thể thân trên và tự động đối chiếu với bảng size của từng món đồ, giúp bạn chọn đúng kích cỡ ngay từ lần đầu tiên.
            </p>
            <div className="feature-card-highlights">
              <div className="highlight-item">
                <span className="highlight-bullet" />
                <span>Webcam thân trên · 2 góc chụp trước & nghiêng</span>
              </div>
              <div className="highlight-item">
                <span className="highlight-bullet" />
                <span>Khớp chuẩn số đo với phom dáng từng thiết kế</span>
              </div>
              <div className="highlight-item">
                <span className="highlight-bullet" />
                <span>Bảo mật tuyệt đối · Không lưu trữ hình ảnh cá nhân</span>
              </div>
            </div>
            <button
              className="hero-scan-cta-link"
              onClick={() => openScanForProduct(essential)}
              aria-label="Trải nghiệm phòng thử 3D ngay"
            >
              <span className="cta-icon-text">
                <ScanLine size={16} />
                <span>{job?.status === "completed" ? "Xem lại mô hình 3D của bạn" : "Trải nghiệm phòng thử 3D ngay"}</span>
              </span>
              <ArrowRight size={15} />
            </button>
          </div>
        </section>

        {/* Product Catalog Section */}
        <section className="shop-catalog-section" id="catalog">
          <div className="catalog-header-row">
            <div>
              <h2 className="catalog-title">Bộ sưu tập trang phục</h2>
              <p className="catalog-subtitle">
                Được tuyển chọn kỹ lưỡng với đầy đủ bảng size cơ thể cho từng thiết kế.
              </p>
            </div>
          </div>

          {/* Filtering Bar */}
          <ProductFilter
            filters={filters}
            onChange={handleFilterChange}
            onReset={handleResetFilters}
            totalResults={filteredProducts.length}
          />

          {/* Product Grid */}
          {filteredProducts.length > 0 ? (
            <div className="product-grid">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="catalog-empty-state">
              <div className="empty-icon-wrap">
                <ScanLine size={40} />
              </div>
              <h3>Không tìm thấy sản phẩm phù hợp</h3>
              <p>
                Không có món đồ nào khớp với bộ lọc bạn đã chọn. Hãy thử xóa bớt bộ lọc hoặc tìm kiếm với từ khóa khác.
              </p>
              <button className="shop-primary" onClick={handleResetFilters}>
                Xóa tất cả bộ lọc
              </button>
            </div>
          )}
        </section>

        {/* Tasteful & Compact 3-Step Fit Guide */}
        <section className="shop-fit-story">
          <div>
            <h2>Vừa vặn bắt đầu<br />từ bạn.</h2>
            <p>
              Mỗi cơ thể là một tỉ lệ duy nhất. Công nghệ 3D của MORPH hỗ trợ bạn đưa ra quyết định chọn size tự tin hơn mà không cần phỏng đoán.
            </p>
            <button className="shop-text" onClick={() => openScanForProduct(essential)}>
              Trải nghiệm scan 3D ngay <ArrowRight size={17} />
            </button>
          </div>
          <ol>
            <li>
              <span>01</span>
              <div>
                <h3>Chụp hai góc bằng webcam</h3>
                <p>Chính diện và nghiêng 90°, AI tự căn chỉnh và đếm ngược.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <h3>Mô phỏng hình thể 3D</h3>
                <p>Xem số đo ước lượng và tương tác trực quan xoay 360°.</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <h3>Đối chiếu bảng size riêng biệt</h3>
                <p>Tự động tính toán độ vừa vặn cho từng mẫu áo, quần hay váy.</p>
              </div>
            </li>
          </ol>
          <p className="shop-story-note">
            * Tính năng đang trong giai đoạn thử nghiệm. Kết quả số đo mang tính chất tham khảo; chưa kiểm chứng thực nghiệm trên cơ thể người thật.
          </p>
        </section>
      </main>

      <Footer />

      {/* Cart & Wishlist Drawers */}
      <CartDrawer />
      <WishlistDrawer />

      {/* Scan Modal from Home */}
      <Modal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        title={`Tìm size của tôi · ${scanProduct.name}`}
        wide
      >
        {scanOpen && (
          <FitExperience
            product={scanProduct}
            active={scanOpen}
            onSelectSize={(chosenSize) => {
              setScanOpen(false);
              router.push(`/products/${scanProduct.slug}?size=${chosenSize}`);
            }}
          />
        )}
      </Modal>
    </div>
  );
}

export default function StorefrontHome() {
  return (
    <Suspense fallback={<div className="fit-lazy">Đang tải cửa hàng MORPH Studio…</div>}>
      <StorefrontHomeContent />
    </Suspense>
  );
}
