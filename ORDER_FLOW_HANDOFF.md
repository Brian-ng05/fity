# MORPH Studio — Tài Liệu Bàn Giao Luồng Đặt Hàng & Hệ Thống Gold/Ivory (ORDER_FLOW_HANDOFF.md)

**Ngày cập nhật**: 13/10/2026  
**Dự án**: MORPH Studio (`D:\MORPH-AI`)  
**Tác giả**: Agent điều phối nâng cấp MORPH Studio  

---

## 1. Tổng Quan & Phạm Vi Thực Hiện

Theo yêu cầu nâng cấp toàn diện MORPH Studio thành website thương mại điện tử hoàn chỉnh, dự án đã triển khai đầy đủ kiến trúc storefront thời trang cao cấp với:
- **Hệ thống nhận diện Warm Ivory & Champagne Gold**: Nền ngà ấm `#FAF7F0`, màu nhấn vàng sâm-panh `#C6A15B`, chữ tối `#26211A` đạt tỷ lệ tương phản **6.58:1** (vượt chuẩn WCAG AA 4.5:1).
- **Hệ thống bo góc chuẩn hóa**: 12px cho controls, 18–20px cho cards, 24px cho modals/drawers, 9999px cho pills/badges.
- **Header an toàn trên mọi thiết bị**: Đã khắc phục triệt để lỗi cắt mép icon giỏ hàng trên màn hình hẹp (390px và 360px).
- **Trang Giỏ hàng chuyên dụng (`/cart`)**: Bảng giỏ hàng desktop và thẻ mobile, bộ tăng giảm số lượng stepper, đổi biến thể màu/size trực tiếp, thanh thông báo hoàn tác (Undo Toast) 7s, thanh tiến độ miễn phí giao hàng (ngưỡng 500.000đ).
- **Trang Đặt hàng nhanh (`/checkout`)**: Tiến trình 3 bước, form thông tin khách hàng mua nhanh không cần tài khoản, tự động đồng bộ báo giá từ backend (`POST /api/orders/quote`), chống đặt trùng lặp bằng `Idempotency-Key`, thông báo chính sách tiếp nhận đơn hàng minh bạch (không giả lập thanh toán online).
- **Trang Xác nhận & Tra cứu đơn hàng (`/orders/[id]?token=...`)**: Mã đơn hàng chuẩn `MPH-YYYYMMDD-XXXX`, huy hiệu trạng thái "Đã tiếp nhận", nút sao chép mã đơn, bảo mật thông tin đơn hàng bằng access token bí mật (chặn 404/403 khi truy cập trái phép).
- **Khắc phục lỗi đồng bộ phiên quét 3D**: Sửa triệt để race condition xóa nhầm `s.job` trong `FitExperience.tsx` và cấu hình rewrite proxy backend đồng bộ.

---

## 2. Kiến Trúc Backend & Cơ Sở Dữ Liệu SQLite

### 2.1 File mã nguồn & CSDL
- **Module xử lý**: `backend/app/orders.py`
- **File database**: `.runtime/orders.db` (tự động khởi tạo trong chế độ WAL mode; fallback về `backend/app/orders.db`).
- **Khởi tạo vòng đời**: `init_orders_db()` được gọi trong `lifespan` của `backend/app/main.py`.

### 2.2 Schema CSDL SQLite
```sql
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    order_code TEXT UNIQUE NOT NULL,
    token TEXT NOT NULL,
    idempotency_key TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'received',
    status_label TEXT NOT NULL DEFAULT 'Đã tiếp nhận',
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_email TEXT,
    customer_address TEXT NOT NULL,
    customer_note TEXT,
    subtotal_vnd INTEGER NOT NULL,
    shipping_fee_vnd INTEGER NOT NULL,
    total_vnd INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    product_slug TEXT NOT NULL,
    product_name TEXT NOT NULL,
    color TEXT NOT NULL,
    size TEXT NOT NULL,
    image TEXT NOT NULL,
    unit_price_vnd INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    subtotal_vnd INTEGER NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
);
```

### 2.3 API Endpoints
1. `POST /api/orders/quote`:
   - Xác thực danh sách sản phẩm, biến thể màu, size và đơn giá so với danh mục `catalog.py`.
   - Tính toán tạm tính, phí giao hàng (30.000đ hoặc 0đ nếu $\ge 500.000đ$), tổng tiền.
2. `POST /api/orders`:
   - Tiếp nhận đơn hàng, kiểm tra `Idempotency-Key` (nếu trùng trả về đơn cũ ngay lập tức mà không nhân bản dữ liệu).
   - Lưu trữ dữ liệu trong một atomic transaction.
   - Tạo mã đơn `MPH-YYYYMMDD-XXXX` và token ngẫu nhiên an toàn `secrets.token_urlsafe(24)`.
3. `GET /api/orders/{id}?token={token}`:
   - Tra cứu đơn hàng theo `id` hoặc `order_code`.
   - Kiểm tra `token` truyền qua query param hoặc header `X-Order-Token` / `Authorization: Bearer <token>`.
   - Nếu token không khớp hoặc thiếu, trả về `404 Not Found` để bảo vệ quyền riêng tư người mua.

---

## 3. Kiến Trúc Frontend & Luồng Người Dùng

### 3.1 Cấu trúc Route
- `/`: Trang chủ Storefront với bộ lọc danh mục, tìm kiếm từ khóa, danh sách 22 sản phẩm, modal thử đồ 3D.
- `/products/[slug]`: Trang chi tiết sản phẩm, bảng chọn màu và size, modal bảng size đối chiếu và nút thêm vào giỏ.
- `/cart`: Trang giỏ hàng chuyên dụng.
- `/checkout`: Trang đặt hàng nhanh dành cho khách vãng lai.
- `/orders/[id]`: Trang xác nhận đơn hàng sau khi đặt thành công hoặc tra cứu theo token.
- `/scan`: Module phòng thử 3D độc lập.

### 3.2 Tối ưu hóa Tiếp cận (A11y) & An Toàn Kỹ Thuật
- **Hook `useDrawerA11y.ts`**: Tự động bẫy tiêu điểm (focus trap), lắng nghe phím `Escape` để đóng modal/drawer và khóa cuộn trang (`body scroll lock`) khi mở popup.
- **Xử lý Next.js 16 SSG**: Đã bọc `useSearchParams()` trong `<Suspense fallback={<HeaderFallback />}>` tại `Header.tsx` và các trang động, bảo đảm toàn bộ 29 routes biên dịch tĩnh (SSG/Dynamic) mượt mà không có lỗi de-opt.

---

## 4. Kết Quả Kiểm Thử & Bằng Chứng Nghiệm Thu

### 4.1 Bộ Test Backend (`pytest backend/tests`)
- **Kết quả**: **51/51 tests PASSED** trong 7.42 giây.
- Bao gồm 14 test cases chi tiết cho module `test_orders.py` (tính toán báo giá, miễn phí vận chuyển, kiểm tra màu/size không hợp lệ, idempotency key chống trùng, bảo mật token).

### 4.2 Bộ Test Toàn Diện E2E Playwright (`verification/scripts/frontend-gold-verification.cjs`)
Tất cả các tiêu chí kiểm thử đều đạt 100%:
- `productCount`: **22 sản phẩm** tải thành công trên trang chủ.
- `ctaContrastRatio`: **6.58:1** (chuẩn WCAG AA $\ge 4.5:1$).
- `ctaBorderRadius`: **12px** theo đúng quy định thiết kế.
- `laptopNoOverflow`: **true** (không tràn ngang tại độ phân giải 1366x768).
- `mobile390HeaderNotClipped`: **true** (icon giỏ hàng nằm gọn trong viewport 390px).
- `mobile360HeaderNotClipped`: **true** (icon giỏ hàng nằm gọn trong viewport 360px).
- `shirtCategoryFilter`: **5 sản phẩm** sơ mi hiển thị đúng.
- `searchFilterCount`: Tìm từ khóa "linen" trả về đúng 1 sản phẩm.
- `resetFilters`: Khôi phục về đủ 22 sản phẩm.
- `invalidUrlSizeRejected`: Chuỗi size sai trên URL (`?size=INVALID...`) bị từ chối, không chọn nhầm.
- `colorOriginNotePresent`: Dòng chú thích ảnh màu gốc xuất hiện khi chọn biến thể phụ.
- `addToCartFeedbackShown`: Banner thông báo thêm vào giỏ và huy hiệu header giỏ hàng cập nhật đúng.
- `sizeChartToScanInterconnection`: Chuyển đổi liền mạch từ Bảng size sang Module 3D scan.
- `manualSizeChartCallback`: Mở lại bảng size từ màn hình kết quả 3D thành công.
- `session404Handled`: Phiên quét không tồn tại trả về mã lỗi 404 an toàn.
- `cartPageHasItems`: Trang `/cart` hiển thị đúng danh sách mặt hàng đã thêm.
- `undoToastDisplayed`: Bấm xóa sản phẩm hiển thị toast hoàn tác 7s.
- `undoRemoveWorks`: Bấm Hoàn tác khôi phục sản phẩm vào giỏ hàng ngay lập tức.
- `checkoutStepActive`: Trang `/checkout` hiển thị tiến trình đang ở Bước 2 (Thông tin nhận hàng).
- `orderUrl`: Đặt hàng thành công chuyển hướng đến `/orders/ord_...?...`.
- `orderCode`: Tạo mã đơn đúng định dạng `MPH-20261013-4328`.
- `orderStatusText`: Trạng thái đơn hiển thị đúng `Đã tiếp nhận`.
- `customerDetailsConfirmed`: Thông tin khách hàng Nguyễn Văn An, số điện thoại và địa chỉ được hiển thị chính xác.
- `tokenSecurityEnforced`: Truy cập đơn hàng với token giả mạo bị chặn ngay lập tức, không để lộ dữ liệu cá nhân.

### 4.3 Danh mục Ảnh Bằng Chứng (`output/playwright/gold-verification-20261013/`)
1. `01-storefront-home-desktop-1440x900.png`: Trang chủ desktop với bảng màu Gold/Ivory.
2. `02-storefront-home-laptop-1366x768.png`: Trang chủ trên laptop không tràn ngang.
3. `03-storefront-home-mobile-390x844.png`: Giao diện mobile 390px, header nguyên vẹn.
4. `04-storefront-home-mobile-360px.png`: Giao diện mobile 360px siêu hẹp, an toàn tuyệt đối.
5. `05-product-detail-desktop.png`: Trang chi tiết sản phẩm với bảng chọn biến thể.
6. `06-product-added-feedback.png`: Banner thông báo thêm vào giỏ hàng tinh tế.
7. `07-size-chart-modal.png`: Hộp thoại Bảng size chuẩn kèm CTA kết nối scan 3D.
8. `08-scan-camera-session.png`: Giao diện camera trực tiếp hai góc.
9. `09-fit-result-desktop.png`: Kết quả mô hình 3D nền sáng và gợi ý size.
10. `10-cart-page-desktop.png`: Trang Giỏ hàng `/cart` trên máy tính với bảng chi tiết và tóm tắt dính.
11. `11-cart-page-mobile-390.png`: Trang Giỏ hàng dạng danh sách thẻ trên điện thoại.
12. `12-checkout-page-desktop.png`: Trang Đặt hàng `/checkout` với form khách mua nhanh và tiến trình 3 bước.
13. `13-checkout-page-mobile-390.png`: Trang Đặt hàng tối ưu trên màn hình cảm ứng di động.
14. `14-order-confirmation-desktop.png`: Trang xác nhận đơn hàng với mã `MPH-...`, trạng thái Đã tiếp nhận và nút chép mã.
15. `15-order-confirmation-mobile-390.png`: Trang xác nhận đơn hàng trên thiết bị di động.
16. `16-order-invalid-token-error.png`: Màn hình từ chối truy cập khi dùng token không hợp lệ.

---

## 5. Hướng Dẫn Vận Hành & Khởi Chạy

### 5.1 Khởi chạy Backend
```powershell
$env:PATHEXT = '.COM;.EXE;.BAT;.CMD'
cd D:\MORPH-AI\backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### 5.2 Khởi chạy Frontend
```powershell
$env:PATHEXT = '.COM;.EXE;.BAT;.CMD'
cd D:\MORPH-AI\frontend
npm run dev
# Hoặc chạy bản build sản xuất:
npm run build
npm run start
```

### 5.3 Chạy Bộ Kiểm Thử Tự Động
```powershell
# Chạy toàn bộ test backend:
backend\.venv\Scripts\python.exe -m pytest backend/tests

# Chạy kiểm thử E2E Playwright:
node verification/scripts/frontend-gold-verification.cjs
```

---

## 6. Giới Hạn Hiện Tại & Khuyến Nghị Tiếp Theo

1. **Thanh toán trực tuyến**: Hiện tại hệ thống hoạt động theo mô hình đặt hàng COD / liên hệ điện thoại xác nhận size trước khi giao hàng (phù hợp với định vị sản phẩm thời trang cần tư vấn kỹ kích cỡ). Chưa tích hợp cổng thanh toán trực tuyến (VNPay/Momo/Stripe).
2. **Ước lượng hình thể 3D**: Sử dụng MediaPipe kết hợp MakeHuman template deformation; các số đo mang tính chất tham khảo đối chiếu tỷ lệ dáng người, chưa được chứng nhận đo may thủ công chính xác 100%. Cần giữ nguyên các nhãn nguồn và cảnh báo minh bạch đã triển khai.
3. **Quản lý đơn hàng nâng cao (Admin Panel)**: Các đơn hàng được lưu trữ bền vững trong SQLite `.runtime/orders.db`. Khi cần mở rộng thành chuỗi vận hành, có thể bổ sung route quản trị viên `/admin/orders` có xác thực mật khẩu để cập nhật trạng thái đơn (từ `Đã tiếp nhận` sang `Đang giao hàng` hoặc `Hoàn thành`).
