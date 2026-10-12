"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import {
  Filter,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
  ChevronDown,
  Check,
  ArrowUpDown,
  Tag,
} from "lucide-react";
import { CATEGORIES } from "../../lib/catalog";

export interface FilterState {
  q: string;
  category: string;
  priceRange: string; // "all" | "under-500" | "500-1000" | "over-1000"
  color: string;
  size: string;
  sort: string; // "featured" | "price_asc" | "price_desc"
}

const PRICE_OPTIONS = [
  { id: "all", label: "Tất cả mức giá", shortLabel: "Khoảng giá" },
  { id: "under-500", label: "Dưới 500.000₫", shortLabel: "< 500.000₫" },
  { id: "500-1000", label: "500.000₫ – 1.000.000₫", shortLabel: "500k – 1tr" },
  { id: "over-1000", label: "Trên 1.000.000₫", shortLabel: "> 1.000.000₫" },
];

const COMMON_COLORS = [
  { name: "Tất cả màu", value: "", hex: "" },
  { name: "Trắng / Kem", value: "trắng", hex: "#ffffff", border: "#d8d6cc" },
  { name: "Đen / Than", value: "đen", hex: "#1c1c1c" },
  { name: "Xanh forest / Rêu", value: "xanh", hex: "#164032" },
  { name: "Nâu / Đất", value: "nâu", hex: "#63432b" },
  { name: "Be / Cát", value: "be", hex: "#d5cabb" },
];

const COMMON_SIZES = ["XS", "S", "M", "L", "XL", "28", "29", "30", "31", "32"];

const SORT_OPTIONS = [
  { id: "featured", label: "Mới nhất & Nổi bật" },
  { id: "price_asc", label: "Giá: Thấp đến cao" },
  { id: "price_desc", label: "Giá: Cao đến thấp" },
];

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
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
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

  // Close dropdown on click outside or escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const toggleDropdown = (name: string) => {
    setOpenDropdown((prev) => (prev === name ? null : name));
  };

  // Helpers to get active display labels
  const selectedPriceOption =
    PRICE_OPTIONS.find((p) => p.id === filters.priceRange) || PRICE_OPTIONS[0];
  const selectedColorOption =
    COMMON_COLORS.find((c) => c.value === filters.color) || COMMON_COLORS[0];
  const selectedSortOption =
    SORT_OPTIONS.find((s) => s.id === filters.sort) || SORT_OPTIONS[0];

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

      {/* Primary Toolbar: Search + Custom Dropdowns + Sort + Mobile Button */}
      <div className="filter-toolbar" ref={dropdownRef}>
        <div className="filter-search-box">
          <Search size={16} className="filter-search-icon" />
          <input
            type="text"
            placeholder="Tìm áo, quần, chất liệu linen..."
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
              <X size={14} />
            </button>
          )}
        </div>

        {/* Desktop Custom Fashion Dropdowns */}
        <div className="filter-desktop-controls">
          {/* 1. Price Range Custom Dropdown */}
          <div className="filter-dropdown-container">
            <button
              type="button"
              className={`custom-dropdown-trigger ${filters.priceRange !== "all" ? "has-selection" : ""} ${openDropdown === "price" ? "is-open" : ""}`}
              onClick={() => toggleDropdown("price")}
              aria-expanded={openDropdown === "price"}
              aria-haspopup="listbox"
            >
              <Tag size={13} className="trigger-icon" />
              <span>{filters.priceRange === "all" ? "Khoảng giá" : selectedPriceOption.label}</span>
              <ChevronDown size={14} className="dropdown-chevron" />
            </button>

            {openDropdown === "price" && (
              <div className="custom-dropdown-menu" role="listbox">
                {PRICE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`dropdown-option-item ${filters.priceRange === opt.id ? "selected" : ""}`}
                    onClick={() => {
                      update("priceRange", opt.id);
                      setOpenDropdown(null);
                    }}
                    role="option"
                    aria-selected={filters.priceRange === opt.id}
                  >
                    <span>{opt.label}</span>
                    {filters.priceRange === opt.id && <Check size={14} className="dropdown-option-check" />}
                  </button>
                ))}
              </div>
            )}

            {/* Hidden native select for accessibility/testing compatibility */}
            <select
              id="filter-price-select"
              value={filters.priceRange}
              onChange={(e) => update("priceRange", e.target.value)}
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
            >
              {PRICE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Color Custom Dropdown */}
          <div className="filter-dropdown-container">
            <button
              type="button"
              className={`custom-dropdown-trigger ${filters.color ? "has-selection" : ""} ${openDropdown === "color" ? "is-open" : ""}`}
              onClick={() => toggleDropdown("color")}
              aria-expanded={openDropdown === "color"}
              aria-haspopup="listbox"
            >
              {selectedColorOption.hex && (
                <span
                  className="trigger-swatch"
                  style={{
                    backgroundColor: selectedColorOption.hex,
                    borderColor: selectedColorOption.border || "rgba(0,0,0,0.15)",
                  }}
                />
              )}
              <span>{filters.color ? selectedColorOption.name : "Tông màu"}</span>
              <ChevronDown size={14} className="dropdown-chevron" />
            </button>

            {openDropdown === "color" && (
              <div className="custom-dropdown-menu" role="listbox">
                {COMMON_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    className={`dropdown-option-item ${filters.color === c.value ? "selected" : ""}`}
                    onClick={() => {
                      update("color", c.value);
                      setOpenDropdown(null);
                    }}
                    role="option"
                    aria-selected={filters.color === c.value}
                  >
                    <div className="dropdown-option-content">
                      {c.hex ? (
                        <span
                          className="dropdown-color-swatch"
                          style={{
                            backgroundColor: c.hex,
                            borderColor: c.border || "rgba(0,0,0,0.2)",
                          }}
                        />
                      ) : (
                        <span className="dropdown-color-swatch all-colors-swatch" />
                      )}
                      <span>{c.name}</span>
                    </div>
                    {filters.color === c.value && <Check size={14} className="dropdown-option-check" />}
                  </button>
                ))}
              </div>
            )}

            <select
              id="filter-color-select"
              value={filters.color}
              onChange={(e) => update("color", e.target.value)}
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
            >
              {COMMON_COLORS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Size Custom Dropdown */}
          <div className="filter-dropdown-container">
            <button
              type="button"
              className={`custom-dropdown-trigger ${filters.size ? "has-selection" : ""} ${openDropdown === "size" ? "is-open" : ""}`}
              onClick={() => toggleDropdown("size")}
              aria-expanded={openDropdown === "size"}
              aria-haspopup="listbox"
            >
              <span>{filters.size ? `Size: ${filters.size}` : "Kích cỡ"}</span>
              <ChevronDown size={14} className="dropdown-chevron" />
            </button>

            {openDropdown === "size" && (
              <div className="custom-dropdown-menu size-dropdown-menu" role="listbox">
                <button
                  type="button"
                  className={`dropdown-option-item ${!filters.size ? "selected" : ""}`}
                  onClick={() => {
                    update("size", "");
                    setOpenDropdown(null);
                  }}
                  role="option"
                  aria-selected={!filters.size}
                >
                  <span>Tất cả kích cỡ</span>
                  {!filters.size && <Check size={14} className="dropdown-option-check" />}
                </button>
                <div className="dropdown-divider" />
                <div className="dropdown-size-grid">
                  {COMMON_SIZES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`dropdown-size-btn ${filters.size === s ? "selected" : ""}`}
                      onClick={() => {
                        update("size", filters.size === s ? "" : s);
                        setOpenDropdown(null);
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <select
              id="filter-size-select"
              value={filters.size}
              onChange={(e) => update("size", e.target.value)}
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
            >
              <option value="">Tất cả kích cỡ</option>
              {COMMON_SIZES.map((s) => (
                <option key={s} value={s}>
                  Size {s}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Sort Custom Dropdown */}
          <div className="filter-dropdown-container">
            <button
              type="button"
              className={`custom-dropdown-trigger sort-trigger ${filters.sort !== "featured" ? "has-selection" : ""} ${openDropdown === "sort" ? "is-open" : ""}`}
              onClick={() => toggleDropdown("sort")}
              aria-expanded={openDropdown === "sort"}
              aria-haspopup="listbox"
            >
              <ArrowUpDown size={13} className="trigger-icon" />
              <span>{selectedSortOption.label}</span>
              <ChevronDown size={14} className="dropdown-chevron" />
            </button>

            {openDropdown === "sort" && (
              <div className="custom-dropdown-menu sort-dropdown-menu" role="listbox">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`dropdown-option-item ${filters.sort === opt.id ? "selected" : ""}`}
                    onClick={() => {
                      update("sort", opt.id);
                      setOpenDropdown(null);
                    }}
                    role="option"
                    aria-selected={filters.sort === opt.id}
                  >
                    <span>{opt.label}</span>
                    {filters.sort === opt.id && <Check size={14} className="dropdown-option-check" />}
                  </button>
                ))}
              </div>
            )}

            <select
              id="filter-sort-select"
              value={filters.sort}
              onChange={(e) => update("sort", e.target.value)}
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Mobile Filter Drawer Trigger */}
        <button
          className="mobile-filter-trigger"
          onClick={() => setMobileDrawerOpen(true)}
          aria-label="Mở bộ lọc"
        >
          <SlidersHorizontal size={16} />
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
            <RotateCcw size={13} />
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
                      className={`drawer-pill color-drawer-pill ${filters.color === c.value ? "active" : ""}`}
                      onClick={() => update("color", c.value)}
                    >
                      {c.hex && (
                        <span
                          className="drawer-color-dot"
                          style={{
                            backgroundColor: c.hex,
                            borderColor: c.border || "rgba(0,0,0,0.2)",
                          }}
                        />
                      )}
                      <span>{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="drawer-filter-group">
                <label>Kích cỡ</label>
                <div className="drawer-pills size-pills">
                  {COMMON_SIZES.map((s) => (
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
                <div className="drawer-pills">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      className={`drawer-pill ${filters.sort === opt.id ? "active" : ""}`}
                      onClick={() => update("sort", opt.id)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
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
