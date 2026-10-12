# MORPH Studio — Storefront & Multi-Product Fit Handoff

Tài liệu bàn giao toàn diện tính năng cửa hàng thời trang đa sản phẩm và module Scan 3D dùng chung cho MORPH Studio.  
Cập nhật: 12/10/2026.

---

## 1. Nguồn chính và Môi trường chạy

- **Source chính**: `D:\MORPH-AI`
  - Frontend: `D:\MORPH-AI\frontend` (Next.js 16 App Router, React 19, Three.js / React Three Fiber, Turbopack)
  - Backend: `D:\MORPH-AI\backend` (Python 3.11, FastAPI, Uvicorn, MediaPipe, NumPy, Trimesh)
  - Python interpreter chuẩn: `D:\MORPH-AI\backend\.venv\Scripts\python.exe`

### Hướng dẫn chạy
Mở hai cửa sổ terminal tại thư mục gốc `D:\MORPH-AI`:

1. **Khởi động Backend** (chạy tại port 8000):
   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File D:\MORPH-AI\start-backend.ps1
   # Hoặc:
   $env:PATHEXT='.COM;.EXE;.BAT;.CMD'; D:\MORPH-AI\backend\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```

2. **Khởi động Frontend** (chạy tại port 3000):
   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File D:\MORPH-AI\start-frontend.ps1
   # Hoặc:
   cd frontend
   npm run dev
   ```

3. Mở trình duyệt tại: `http://localhost:3000` (Trang chủ Storefront) hoặc `http://localhost:3000/scan` (Module Scan độc lập).

---

## 2. Kiến trúc & Cấu trúc Dữ liệu

### 2.1 API Contract
Tài liệu hợp đồng dữ liệu giữa FE và BE: [API_CONTRACT.md](file:///d:/MORPH-AI/API_CONTRACT.md).
- **Scan & Reconstruction**:
  - `GET /api/health`: Trạng thái máy chủ và engine MediaPipe.
  - `POST /api/capture-check`: Kiểm tra khung hình và hướng dẫn góc chụp (chính diện / nghiêng).
  - `POST /api/scans`: Khởi tạo tác vụ dựng 3D từ 2 frame camera (hỗ trợ `upper_body` và `full_body`).
  - `GET /api/scans/{key}`: Truy vấn tiến độ và kết quả số đo.
  - `GET /api/scans/{key}/model`: File mô hình 3D nhị phân (`.glb`).
  - `GET /api/scans/{key}/measurements`: Tải báo cáo số đo JSON.
  - `POST /api/scans/{key}/size-advice`: Đối chiếu số đo của phiên scan với `SizeChart` sản phẩm.
  - `DELETE /api/scans/{key}`: Hủy phiên và xóa mô hình GLB ngay lập tức.
- **Catalog API**:
  - `GET /api/products`: Danh sách sản phẩm (hỗ trợ lọc `category`, tìm kiếm `search`, sắp xếp `sort`).
  - `GET /api/products/{slug}`: Chi tiết sản phẩm kèm `SizeChart` chuẩn xác.

### 2.2 Catalog đa sản phẩm
- Tập trung tại `frontend/lib/catalog.ts` và `backend/app/catalog_data.json`.
- Gồm **22 sản phẩm hoàn chỉnh** thuộc **5 danh mục**:
  1. Áo thun (5 sản phẩm)
  2. Sơ mi (5 sản phẩm)
  3. Áo khoác (4 sản phẩm)
  4. Quần (4 sản phẩm)
  5. Váy (4 sản phẩm)
- Bảng size định lượng (`SizeChart` theo số đo cơ thể cm):
  - Áo / Áo khoác (`top`): `chest_cm` và `waist_cm`.
  - Quần / Váy (`bottom`): `waist_cm` và `hip_cm`.
- Nhận diện dữ liệu: Đầy đủ thông báo minh họa mua sắm cục bộ, không thực hiện giao dịch hoặc thu tiền thật.

---

## 3. Các Màn hình & Tính năng Storefront

### 3.1 Trang chủ Storefront (`/`)
- **Header**: Logo MORPH Studio, điều hướng 5 danh mục + Tất cả, thanh tìm kiếm live đồng bộ URL query (`/?q=...`), nút mở Wishlist Drawer kèm badge số lượng, nút mở Giỏ hàng kèm badge tổng số lượng món đồ.
- **Hero & Giới thiệu**: Hero tinh gọn, tone màu ấm ivory/forest/sage, CTA chuyển nhanh đến bộ sưu tập và lối vào nhanh phòng đo 3D.
- **Bộ lọc sản phẩm (`ProductFilter.tsx`)**:
  - Lọc theo danh mục (Pills).
  - Lọc theo khoảng giá (Dưới 500k, 500k–1tr, Trên 1tr).
  - Lọc theo màu sắc (Trắng, Đen, Xanh, Be, Nâu, Xám).
  - Lọc theo size (XS, S, M, L, XL, 28, 29, 30, 31, 32...).
  - Sắp xếp giá tăng dần / giảm dần / mới nhất.
  - Đồng bộ 2 chiều vào URL search params giúp chia sẻ hoặc reload trang không mất trạng thái lọc.
  - Trạng thái trống (Empty state) trang nhã kèm nút "Xóa bộ lọc".
  - Drawer lọc trên mobile tiện dụng.

### 3.2 Trang Chi tiết Sản phẩm (`/products/[slug]`)
- Breadcrumbs điều hướng linh hoạt: `Trang chủ / Danh mục / Tên sản phẩm`.
- Thư viện ảnh gallery phóng to, duyệt thumbnails.
- Bộ chọn màu (Color Swatches) và bộ chọn kích thước (Size Buttons).
- Dot xanh chỉ báo trực quan cho size được gợi ý từ hình thể quét 3D.
- Modal Bảng size chuẩn (`SizeChartModal.tsx`) hiển thị thông số cơ thể và nút kích hoạt scan.
- Nút "Tìm size của tôi" tích hợp `FitExperience` truyền đúng context sản phẩm hiện tại.
- Tự động áp dụng size gợi ý vào biến thể đang xem.
- Khối thông tin: Chất liệu, phom dáng và chi tiết sản phẩm.
- Khối gợi ý sản phẩm cùng danh mục hoạt động đầy đủ liên kết.

### 3.3 Giỏ hàng & Wishlist
- **Giỏ hàng (`CartDrawer.tsx`, `CartContext.tsx`)**:
  - Phân biệt biến thể chính xác theo khóa: `productId__color__size`.
  - Tăng / giảm số lượng an toàn, xóa dòng sản phẩm.
  - Tính tổng tiền VNĐ chính xác.
  - Lưu trữ bền vững qua `localStorage` (`morph-demo-cart-v2`), không mất dữ liệu khi F5/reload.
  - Trạng thái giỏ hàng trống có nút dẫn quay lại mua sắm.
  - Không giả mạo thanh toán hoàn tất (thông báo rõ giới hạn demo).
- **Danh sách yêu thích (`WishlistDrawer.tsx`)**:
  - Bật / tắt yêu thích tại từng thẻ sản phẩm và trang chi tiết.
  - Lưu trữ bền vững qua `localStorage` (`morph-demo-wishlist-v1`).

### 3.4 Module Scan 3D Dùng Chung & Đồng Nhất Giao Diện
- **Đồng nhất 100% hệ thống giao diện với Shop**:
  - Toàn bộ luồng Onboarding, Camera, Processing và 3D Result sử dụng chung bảng màu warm ivory (`#f8f7f3`, `#fffefa`), màu nhấn xanh forest (`#194e3d`), và sắc độ xám sage (`#e9eee5`). Không còn hiện tượng chuyển đổi đột ngột sang nền đen.
  - Sân khấu 3D (`.scan-stage`) sử dụng nền sage-ivory sáng, mô hình màu sage-forest điêu khắc (`#3d5c4e`) tương phản cao, bóng tiếp xúc chân thực và đường đo trực quan.
  - Bảng số đo, các nút điều khiển góc nhìn và công cụ đều đồng bộ font chữ, bo góc và hiệu ứng hover/focus với cửa hàng.
- **Thanh ngữ cảnh sản phẩm liên tục (`.fit-product-context`)**:
  - Luôn hiển thị thumbnail nhỏ, tên sản phẩm và giá ở đầu modal trong suốt cả 4 bước (Chuẩn bị, Camera, Đang xử lý, Kết quả 3D). Khách hàng không bao giờ bị mất định hướng về món đồ mình đang tìm size.
- **CTA Áp dụng size rõ ràng**:
  - Nút chính **"Áp dụng size [X] →"** màu xanh forest nổi bật. Bấm vào lập tức gán size vào sản phẩm đang xem, đóng modal nhẹ nhàng và đưa khách hàng quay lại trang chi tiết sản phẩm với vị trí cuộn và màu sắc được giữ nguyên vẹn.
- **Quy tắc số đo mông & Thông báo thiếu dữ liệu**:
  - Khi chụp thân trên webcam (`upper_body`), `hip_cm` giữ giá trị `null`.
  - Đối với sản phẩm Quần hoặc Váy (`garment === "bottom"` hoặc yêu cầu `hip_cm`), hệ thống hiển thị chính xác cảnh báo:  
    **"Chưa đủ dữ liệu để gợi ý (cần số đo vòng mông)"** kèm giải thích rõ ràng và cung cấp 2 nút thao tác: "Xem bảng size & chọn thủ công" hoặc "Quét lại toàn thân".
- **Giữ nguyên luồng camera-only liên tục**:
  - Không upload ảnh, không hình nộm trước scan.
  - Nhập chiều cao, đồng ý xử lý.
  - Một phiên camera: Đếm ngược 5s chính diện $\rightarrow$ Nhắc xoay 90° $\rightarrow$ Đếm ngược 5s nghiêng $\rightarrow$ Tự động gửi frame về backend.

---

## 4. Kết quả Kiểm thử & Nghiệm thu (Verification)

| Hạng mục kiểm thử | Công cụ / Lệnh | Kết quả | Ghi chú |
| :--- | :--- | :--- | :--- |
| **Backend Test Suite** | `pytest backend/tests/` | **37 / 37 passed** (100%) | Đã bao gồm test top, bottom, upper-body thiếu hip_cm, full-body đủ hip_cm, no_match, catalog API |
| **Frontend TypeScript** | `tsc --noEmit` | **0 errors** | Kiểm tra type an toàn tuyệt đối |
| **Frontend Production Build** | `next build` (Turbopack) | **27 / 27 pages generated** | Tối ưu hóa SSG cho 22 trang sản phẩm, trang chủ `/`, `/scan`, 404 |
| **Playwright E2E Test** | `node verification/scripts/storefront-multi-product-ui.cjs` | **12 / 12 steps passed** | Chạy trên browser Chromium headless với backend & frontend thực tế |

### Chi tiết 12 kịch bản E2E đã pass:
1. `Storefront Home`: Hiển thị đầy đủ 22 sản phẩm ban đầu.
2. `Category Filter`: Lọc tab "Sơ mi" ra đúng 5 áo sơ mi.
3. `Search Filter`: Tìm kiếm từ khóa "linen" ra chính xác sản phẩm tương ứng.
4. `Reset Filters`: Bấm nút xóa bộ lọc khôi phục lại 22 sản phẩm.
5. `Wishlist Toggle`: Bấm yêu thích sản phẩm, badge tăng lên 1.
6. `Product Detail Nav`: Chuyển trang chi tiết `/products/[slug]` mượt mà.
7. `Size Chart Modal`: Mở bảng size hiển thị số đo ngực/eo chuẩn.
8. `Add to Cart`: Chọn size M, thêm vào giỏ, mở CartDrawer, tăng số lượng lên 2.
9. `Cart Persistence`: Reload trang, badge giỏ hàng giữ nguyên 2.
10. `3D Scan Integration`: Chạy luồng chuẩn bị scan kèm thanh ngữ cảnh sản phẩm, camera đếm ngược chính diện, xoay 90°, đếm ngược nghiêng, dựng hình 3D thành công, giao diện kết quả nền sáng đồng nhất, hiển thị đúng CTA "Áp dụng size [X] →" và gán size trở lại sản phẩm.
11. `Mobile Responsive Viewport (390x844)`: Kiểm tra không phát sinh lỗi tràn ngang (`scrollWidth <= innerWidth`).
12. `Mobile Product Detail`: Trang chi tiết hiển thị chuẩn mực trên thiết bị di động.

### Ảnh chụp màn hình nghiệm thu:
Được lưu tại: `output/playwright/storefront-20261012/`
- `01-storefront-home-desktop.png`: Trang chủ cửa hàng đa sản phẩm.
- `02-product-detail-desktop.png`: Trang chi tiết sản phẩm.
- `03-size-chart-modal.png`: Modal bảng size định lượng.
- `04-cart-drawer-desktop.png`: Drawer giỏ hàng đa biến thể.
- `05a-scan-onboarding-desktop.png`: Màn hình chuẩn bị scan kèm thanh ngữ cảnh sản phẩm nền ivory/sage.
- `05b-camera-session-desktop.png`: Phiên camera với khung viền trung tính, hướng dẫn rõ nét và thanh ngữ cảnh.
- `05-fit-result-desktop.png`: Kết quả 3D nền sáng đồng nhất với avatar điêu khắc sage-forest, bảng số đo sáng và CTA Áp dụng size.
- `06-storefront-home-mobile.png`: Giao diện trang chủ mobile.
- `07-filter-drawer-mobile.png`: Drawer bộ lọc trên mobile.
- `08-mobile-menu-drawer.png`: Drawer danh mục trên mobile.
- `09-product-detail-mobile.png`: Chi tiết sản phẩm trên mobile.

---

## 5. Giới hạn hiện tại & Hướng phát triển tiếp theo

### Giới hạn hiện tại
- **Mục đích demo**: Toàn bộ hệ thống chạy localhost; không kết nối cơ sở dữ liệu bên ngoài, cổng thanh toán hoặc hệ thống đơn hàng thực tế.
- **Công nghệ 3D**: Sử dụng MediaPipe Pose/Segmentation kết hợp biến dạng mô hình mẫu MakeHuman. Đây là công nghệ ước lượng thị giác máy tính, chưa phải cảm biến chiều sâu hay đo lường may đo thực nghiệm.
- **Chế độ thân trên (Upper-body)**: Vòng mông (`hip_cm`) không được suy diễn để tránh sai số; sản phẩm quần/váy cần scan toàn thân để có gợi ý size chính xác.

### Hướng phát triển tiếp theo
- Kết nối cơ sở dữ liệu lưu trữ sản phẩm (PostgreSQL/Supabase).
- Mở rộng hỗ trợ đồng bộ tài khoản người dùng và lịch sử số đo an toàn.
- Nghiên cứu mô phỏng vải hoặc đo đạc chuyên sâu khi có phần cứng cảm biến LiDAR/RGB-D.
