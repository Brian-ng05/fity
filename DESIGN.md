---
name: MORPH Studio
description: Cohesive warm fashion storefront with unified ivory, sage, and forest green 3D fitting studio.
colors:
  paper: "#f8f7f3"
  surface: "#fffefa"
  surface-card: "#f2f5ee"
  surface-subtle: "#ebefe6"
  surface-well: "#e2e8dd"
  ink: "#242b27"
  ink-secondary: "#3e4842"
  muted: "#62685f"
  muted-light: "#7e877c"
  forest: "#194e3d"
  forest-hover: "#113b2d"
  forest-light: "#e6ede6"
  forest-border: "#9cb5a3"
  sage: "#e9eee5"
  sage-light: "#f2f6ee"
  line: "#dddfd6"
  line-strong: "#c2c9bd"
  white: "#ffffff"
  danger: "#9e2a2b"
  danger-bg: "#fbeeed"
  warning: "#8f5819"
  warning-bg: "#fcf2e3"
  contour-chest: "#194e3d"
  contour-waist: "#a0521e"
  contour-hip: "#285b7e"
typography:
  display:
    fontFamily: "Be Vietnam Pro, sans-serif"
    fontSize: "clamp(30px, 3.2vw, 46px)"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Be Vietnam Pro, sans-serif"
    fontSize: "29px"
    fontWeight: 500
    lineHeight: 1.28
    letterSpacing: "-0.025em"
  result-title:
    fontFamily: "Be Vietnam Pro, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Be Vietnam Pro, sans-serif"
    fontSize: "14px"
    lineHeight: 1.6
  label:
    fontFamily: "Be Vietnam Pro, sans-serif"
    fontSize: "12px"
    fontWeight: 500
  data:
    fontFamily: "Be Vietnam Pro, sans-serif"
    fontSize: "18px"
    fontWeight: 700
rounded:
  size: "4px"
  action: "6px"
  card: "10px"
  workspace: "16px"
spacing:
  tight: "8px"
  label: "12px"
  field: "16px"
  control: "20px"
  section: "24px"
  result: "24px"
---

# Design System: MORPH Studio

## Overview

**Creative North Star: "The Unified Fitting Studio"**

MORPH Studio delivers a continuous, warm fashion experience across all customer touchpoints:
1. **Khám phá bộ sưu tập & Sản phẩm** (`/`, `/products/[slug]`)
2. **Chuẩn bị scan** (Nhập chiều cao, lựa chọn khung chụp)
3. **Camera trực tiếp hai góc** (Chính diện & Nghiêng 90°)
4. **Xử lý dựng hình 3D** (Trạng thái tinh gọn, tin cậy)
5. **Xem kết quả & Áp dụng size** (Mô hình 3D, số đo, gợi ý size chính xác)
6. **Quay lại ngữ cảnh mua sắm** (Gán size vào sản phẩm, bảo toàn màu và vị trí cuộn)

Trước đây, giao diện cửa hàng sáng nhưng module scan tối màu tạo cảm giác đứt đoạn. Bản thiết kế cập nhật đã thống nhất toàn bộ hệ thống vào một bảng màu chung: **Nền ivory ấm áp (`#f8f7f3`, `#fffefa`), màu nhấn xanh forest (`#194e3d`), sắc độ xám sage êm dịu (`#e9eee5`), và đường viền tự nhiên (`#dddfd6`)**.

---

## 1. Hệ thống Màu sắc & Token Dùng Chung

### 1.1 Màu chủ đạo (Primary & Brand)
- **Forest Green (`#194e3d`)**: Màu thương hiệu chính cho mọi CTA mua sắm và áp dụng size.
- **Forest Hover (`#113b2d`)**: Trạng thái hover với độ tương phản cao.
- **Forest Light (`#e6ede6`)**: Màu nền chọn size, viền nhấn và tag hoạt động.

### 1.2 Bề mặt trung tính (Warm Ivory & Sage)
- **Paper (`#f8f7f3`)**: Nền tổng thể của toàn bộ ứng dụng và modal.
- **Surface (`#fffefa`)**: Bề mặt thẻ sản phẩm, panel số đo, hộp điều khiển.
- **Surface Card (`#f2f5ee`)**: Nền thanh thông tin sản phẩm và khối tóm tắt.
- **Surface Subtle (`#ebefe6`)**: Sân khấu 3D (3D Stage) sáng sủa, thoáng đãng.
- **Sage (`#e9eee5`)**: Sắc độ nhấn nhẹ cho badge, banner hướng dẫn, thanh tiến độ.

### 1.3 Đường đo 3D (Contour Lines)
Được chọn với độ tương phản cao ($\ge 4.5:1$) trên nền mô hình 3D sáng:
- **Vòng ngực (`contour-chest`)**: `#194e3d` (Xanh forest).
- **Vòng eo (`contour-waist`)**: `#a0521e` (Nâu hổ phách ấm).
- **Vòng mông (`contour-hip`)**: `#285b7e` (Xanh chàm slate).

---

## 2. Liên tục Ngữ cảnh Mua sắm (Shopping Continuity)

Hành trình của người dùng được duy trì liền mạch:
1. **Thanh ngữ cảnh sản phẩm cố định (`.fit-product-context`)**:
   Khi mở modal "Tìm size của tôi" từ bất kỳ sản phẩm nào, phần trên cùng luôn hiển thị rõ:
   - Thumbnail sản phẩm (44×44px).
   - Tên sản phẩm đang tìm size (ví dụ: *Áo thun Essential Cotton*).
   - Danh mục và giá bán VNĐ.
   Thanh này xuất hiện xuyên suốt các bước Onboarding, Camera, Processing và Result.
2. **Áp dụng size về đúng sản phẩm**:
   - Khi có size gợi ý phù hợp, nút chính **"Áp dụng size [X] →"** được nhấn mạnh bằng màu forest.
   - Nhấp vào nút này sẽ gán size [X] vào biến thể đang chọn, đóng modal nhẹ nhàng và đưa người dùng quay lại trang chi tiết sản phẩm.
   - Không tự động thêm vào giỏ hay đặt hàng; không reload lại toàn bộ trang; giữ nguyên màu sắc và vị trí cuộn của khách hàng.
3. **Trường hợp thiếu số đo (Webcam thân trên vs Quần/Váy)**:
   - Khi quét thân trên cho sản phẩm Quần hoặc Váy (yêu cầu số đo vòng mông `hip_cm`), hệ thống hiển thị thông báo rõ ràng: *"Chưa đủ dữ liệu để gợi ý (cần số đo vòng mông)"*.
   - Cung cấp hai lựa chọn rõ ràng: "Xem bảng size & chọn thủ công" hoặc "Quét lại toàn thân".

---

## 3. Không gian 3D (3D Workspace) Nền Sáng

- **Sân khấu 3D (`.scan-stage`)**: Sử dụng nền warm sage (`#ebefe6`) đồng bộ với toàn bộ modal, không chuyển sang nền đen.
- **Mô hình cơ thể**: Sử dụng sắc thái sage-forest điêu khắc (`#3d5c4e`), tương phản rõ nét với nền sáng.
- **Ánh sáng**:
  - Ánh sáng bán cầu (Hemisphere light): Bầu trời trắng tinh khôi kết hợp ánh phản chiếu xanh xám từ mặt đất (`#ffffff`, `#7c8e81`).
  - Đèn chiếu chính (Key light intensity 2.2) tạo bóng đổ đổ khối tự nhiên và bóng tiếp xúc (`ContactShadows`) mềm mại dưới chân.
- **Lưới tọa độ mặt sàn**: Lưới mảnh màu xám sage nhạt (`#c2cdbf`, `#d8e1d5`) tạo cảm giác không gian mà không gây rối mắt.

---

## 4. Trải nghiệm Camera Hai Góc

- **Khung chứa video (`.capture-live`)**:
  - Giữ hình ảnh camera nguyên bản (object-fit: contain). Phần letterbox đệm quanh video sử dụng màu xám rêu trung tính (`#18231e`).
  - Viền hướng dẫn (`.capture-frame-mark`): Mảnh, nét đứt mềm; khi AI nhận diện tư thế sẵn sàng, chuyển sang viền đặc xanh sáng và hiệu ứng phát sáng nhẹ.
- **Đếm ngược lớn (`.capture-count`)**:
  - Huy hiệu tròn nổi bật ở tâm với nền xanh forest mờ và số đếm 64px màu trắng, rất dễ nhìn từ khoảng cách đứng chụp 1.5 - 2m.
- **Hướng dẫn tư thế (`.capture-instruction`)**:
  - Băng dính mờ ở đáy video với chữ trắng sắc nét, không che khuất đầu, vai, eo hay cạp quần.
- **Tự động chuyển bước**:
  - Chụp xong chính diện $\rightarrow$ Màn hình nhắc xoay 90° màu sáng $\rightarrow$ AI nhận diện góc nghiêng $\rightarrow$ Đếm ngược 5 giây $\rightarrow$ Tự động gửi frame sang backend và chuyển màn hình xử lý.

---

## 5. Danh mục & Bảng số đo Tinh giản

- **Ưu tiên kích thước gợi ý**: Đặt ngay phía trên hoặc cạnh mô hình 3D, dễ dàng nhìn thấy và thao tác ngay.
- **Danh sách số đo trực quan**: Nằm bên trái mô hình, cho phép bấm vào từng số đo để làm nổi bật đường đo tương ứng trên hình thể.
- **Công cụ kỹ thuật nâng cao được xếp gọn**: Các tính năng xuất dữ liệu (Tải file GLB 3D, Tải báo cáo JSON, Sao chép JSON, Xuất ảnh PNG, Lưới 3D) được đặt trong khu vực thu gọn (`details.scan-technical-details`), vừa tiện lợi cho người dùng chuyên sâu vừa tránh gây quá tải thông tin cho khách mua sắm phổ thông.

---

## 6. Đáp ứng Di động (Mobile Responsive)

- Không phát sinh thanh cuộn ngang (`overflow-x: hidden`).
- Trên màn hình nhỏ ($< 650\text{px}$):
  - Mô hình 3D cao tối thiểu 440px, hiển thị đầu tiên và rõ ràng.
  - Thanh công cụ 3D nằm gọn phía dưới, không che mất avatar hay nút áp dụng size.
  - Bảng số đo và gợi ý size xếp theo cột dọc, nút bấm có kích thước tối thiểu 48px để dễ thao tác cảm ứng.
