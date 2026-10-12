"use client";

import { useState, useTransition } from "react";
import { Filter, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { CATEGORIES, type CategoryKey } from "../../lib/catalog";

export interface FilterState {
  q: string;
  category: string;
  priceRange: string; // "all" | "under-500" | "500-1000" | "over-1000"
  color: string;
  size: string;
  sort: string; // "featured" | "price_asc" | "price_desc"
}

const PRICE_OPTIONS = [
  { id: "all", label: "Tất cả mức giá" },
  { id: "under-500", label: "Dưới 500.000₫" },
  { id: "500-1000", label: "500.000₫ – 1.000.000₫" },
  { id: "over-1000", label: "Trên 1.000.000₫" },
];

const COMMON_COLORS = [
  { name: "Tất cả", value: "" },
  { name: "Trắng / Kem", value: "trắng" },
  { name: "Đen / Than", value: "đen" },
  { name: "Xanh forest / Rêu", value: "xanh" },
  { name: "Nâu / Đất", value: "nâu" },
  { name: "Be / Cát", value: "be" },
];

const COMMON_SIZES = ["", "XS", "S", "M", "L", "XL", "28", "29", "30", "31", "32"];

export default function ProductFilter({
  filters,
  onChange,
  onReset,
  totalResults,
}: {
  filters: FilterState;
  onChange: (newFilters: FilterState) => void;
  onReset: () => void;
  totalResults: number;
}) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [, startTransition] = useTransition();

  const hasActiveFilters =
    Boolean(filters.q) ||
    Boolean(filters.category) ||
    filters.priceRange !== "all" ||
    Boolean(filters.color) ||
    Boolean(filters.size) ||
    filters.sort !== "featured";

  const update = (key: keyof FilterState, value: string) => {
    startTransition(() => {
      onChange({ ...filters, [key]: value });
    });
  };

  return (
    <div className="product-filter-section">
      {/* Desktop Quick Category Bar */}
      <div className="filter-category-bar">
        <button
          className={`category-pill ${!filters.category ? "active" : ""}`}
          onClick={() => update("category", "")}
        >
          Tất cả sản phẩm
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            className={`category-pill ${filters.category === cat.key ? "active" : ""}`}
            onClick={() => update("category", filters.category === cat.key ? "" : cat.key)}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Primary Toolbar: Search + Selectors + Sort + Mobile Button */}
      <div className="filter-toolbar">
        <div className="filter-search-box">
          <Search size={17} className="filter-search-icon" />
          <input
            type="text"
            placeholder="Tìm theo tên sản phẩm, chất liệu..."
            value={filters.q}
            onChange={(e) => update("q", e.target.value)}
            className="filter-search-input"
            aria-label="Tìm kiếm sản phẩm"
          />
          {filters.q && (
            <button
              className="clear-search-btn"
              onClick={() => update("q", "")}
              aria-label="Xóa từ khóa tìm kiếm"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Desktop Quick Dropdowns */}
        <div className="filter-desktop-controls">
          <div className="filter-control-group">
            <label htmlFor="filter-price-select" className="sr-only">
              Khoảng giá
            </label>
            <select
              id="filter-price-select"
              value={filters.priceRange}
              onChange={(e) => update("priceRange", e.target.value)}
              className="filter-select"
            >
              {PRICE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-control-group">
            <label htmlFor="filter-color-select" className="sr-only">
              Tông màu
            </label>
            <select
              id="filter-color-select"
              value={filters.color}
              onChange={(e) => update("color", e.target.value)}
              className="filter-select"
            >
              {COMMON_COLORS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.name ? `Màu: ${c.name}` : "Tất cả màu"}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-control-group">
            <label htmlFor="filter-size-select" className="sr-only">
              Kích cỡ
            </label>
            <select
              id="filter-size-select"
              value={filters.size}
              onChange={(e) => update("size", e.target.value)}
              className="filter-select"
            >
              <option value="">Tất cả kích cỡ</option>
              {COMMON_SIZES.filter(Boolean).map((s) => (
                <option key={s} value={s}>
                  Size {s}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-control-group">
            <label htmlFor="filter-sort-select" className="sr-only">
              Sắp xếp
            </label>
            <select
              id="filter-sort-select"
              value={filters.sort}
              onChange={(e) => update("sort", e.target.value)}
              className="filter-select sort-select"
            >
              <option value="featured">Mới nhất & Nổi bật</option>
              <option value="price_asc">Giá: Thấp đến cao</option>
              <option value="price_desc">Giá: Cao đến thấp</option>
            </select>
          </div>
        </div>

        {/* Mobile Filter Drawer Trigger */}
        <button
          className="mobile-filter-trigger"
          onClick={() => setMobileDrawerOpen(true)}
          aria-label="Mở bộ lọc"
        >
          <SlidersHorizontal size={17} />
          <span>Bộ lọc & Sắp xếp</span>
          {hasActiveFilters && <span className="active-dot" />}
        </button>
      </div>

      {/* Filter Status Bar */}
      <div className="filter-status-bar">
        <span className="results-count">
          Hiển thị <strong>{totalResults}</strong> sản phẩm
        </span>

        {hasActiveFilters && (
          <button className="reset-filter-btn" onClick={onReset}>
            <RotateCcw size={14} />
            <span>Xóa bộ lọc</span>
          </button>
        )}
      </div>

      {/* Mobile Drawer Modal */}
      {mobileDrawerOpen && (
        <div className="filter-drawer-backdrop" onClick={() => setMobileDrawerOpen(false)}>
          <div
            className="filter-drawer-panel"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Bộ lọc tìm kiếm sản phẩm"
          >
            <div className="filter-drawer-header">
              <h3>
                <Filter size={18} /> Bộ lọc sản phẩm
              </h3>
              <button
                className="shop-icon"
                onClick={() => setMobileDrawerOpen(false)}
                aria-label="Đóng bộ lọc"
              >
                <X size={20} />
              </button>
            </div>

            <div className="filter-drawer-body">
              <div className="drawer-filter-group">
                <label>Danh mục</label>
                <div className="drawer-pills">
                  <button
                    className={`drawer-pill ${!filters.category ? "active" : ""}`}
                    onClick={() => update("category", "")}
                  >
                    Tất cả
                  </button>
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.key}
                      className={`drawer-pill ${filters.category === cat.key ? "active" : ""}`}
                      onClick={() => update("category", cat.key)}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="drawer-filter-group">
                <label>Khoảng giá</label>
                <div className="drawer-pills">
                  {PRICE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      className={`drawer-pill ${filters.priceRange === opt.id ? "active" : ""}`}
                      onClick={() => update("priceRange", opt.id)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="drawer-filter-group">
                <label>Tông màu</label>
                <div className="drawer-pills">
                  {COMMON_COLORS.map((c) => (
                    <button
                      key={c.value}
                      className={`drawer-pill ${filters.color === c.value ? "active" : ""}`}
                      onClick={() => update("color", c.value)}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="drawer-filter-group">
                <label>Kích cỡ</label>
                <div className="drawer-pills size-pills">
                  {COMMON_SIZES.filter(Boolean).map((s) => (
                    <button
                      key={s}
                      className={`drawer-pill ${filters.size === s ? "active" : ""}`}
                      onClick={() => update("size", filters.size === s ? "" : s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="drawer-filter-group">
                <label>Sắp xếp theo</label>
                <select
                  value={filters.sort}
                  onChange={(e) => update("sort", e.target.value)}
                  className="filter-select"
                >
                  <option value="featured">Mới nhất & Nổi bật</option>
                  <option value="price_asc">Giá: Thấp đến cao</option>
                  <option value="price_desc">Giá: Cao đến thấp</option>
                </select>
              </div>
            </div>

            <div className="filter-drawer-footer">
              <button
                className="shop-secondary"
                onClick={() => {
                  onReset();
                  setMobileDrawerOpen(false);
                }}
              >
                Xóa tất cả
              </button>
              <button
                className="shop-primary"
                onClick={() => setMobileDrawerOpen(false)}
              >
                Áp dụng ({totalResults} kết quả)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
