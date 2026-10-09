# MORPH AI — demo hình thể 3D

Bản làm việc chính: **D:\MORPH-AI**. Xem [hướng dẫn VS Code](HUONG_DAN_CHAY.md) và [bàn giao agent](AGENT_HANDOFF.md).

Hai source độc lập: `frontend/` (Next.js) và `backend/` (Python/FastAPI).

## Bản này làm được gì?

- Smart Camera thông minh: tự động phát hiện độ ổn định cơ thể và tự động chụp (Auto-capture) kèm âm thanh đếm ngược.
- MediaPipe Pose chạy trên CPU nhận diện tư thế và tách đường viền người (dùng singleton detector tối ưu).
- Backend điều chỉnh bề rộng và độ sâu phần thân của mẫu MakeHuman CC0 theo hai ảnh, dịch chuyển cánh tay tránh dính lẹm thân, xuất GLB.
- Trích xuất thông số hình thể (Ngực, Eo, Mông, Rộng vai, Dài chân) bằng thuật toán cắt lát hình học vi phân 3D.
- Phân loại dáng người (Đồng hồ cát, Quả lê, Tam giác ngược, Chữ nhật, Quả táo) và gợi ý size áo/quần chuẩn Á Đông.
- Không gian 3D tương tác: xoay, zoom, khối đặc/khung lưới, vòng đo 3D phát sáng (Ruler), bóng đổ sàn ContactShadows, tải file GLB.
- Chạy 1-click tiện lợi bằng `start-all.bat` và dừng bằng `stop-all.bat`.

**Lưu ý:** Đây là demo fitting mẫu cơ thể theo silhouette và ước lượng số đo hình học vi phân từ mesh 3D phục vụ định hướng thời trang/vóc dáng; chưa phải bản sao photogrammetry hay may đo lâm sàng. Đầu, khuôn mặt và bàn tay/chân vẫn giữ theo khuôn mẫu.

Chọn hướng CPU vì máy hiện tại có NVIDIA MX330 2 GB VRAM. Không cần Java, CUDA hay PyTorch cho phiên bản này. Không thuê GPU và không gọi API AI trả phí.

## Chạy ngay trên Windows

Mở thư mục `morph-ai` trong VS Code hoặc PowerShell. Python đã được cài riêng tại `.runtime/python`, môi trường tại `backend/.venv`, không thay Python/Java/Node của hệ thống.

Terminal thứ nhất:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\start-backend.ps1
```

Terminal thứ hai, cũng tại thư mục `morph-ai`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\start-frontend.ps1
```

Mở http://localhost:3000 . Backend kiểm tra tại http://127.0.0.1:8000/api/health ; tài liệu API tại http://127.0.0.1:8000/docs . Dừng bằng Ctrl+C trong từng terminal.

Nếu báo cổng đang được dùng, kiểm tra terminal/server đang chạy trước khi mở thêm. Không cần chạy setup mỗi lần.

## Cài lại trên máy khác

Cần Windows x64, Node.js >= 20.9, npm, PowerShell và kết nối Internet.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\setup.ps1
```

Script tải Python 3.11 vào project, tạo venv, cài dependencies theo lockfile, tải model Google và asset CC0, rồi cài frontend. Nếu copy project sang nơi khác, môi trường `.venv` có thể còn đường dẫn cũ: tạo lại `.venv` bằng Python trong `.runtime` ở vị trí mới, sau đó chạy setup. Không copy `node_modules` giữa các hệ điều hành.

## Chụp ảnh để thử

1. Một người trưởng thành, mặc đồ ôm sát và đứng thẳng. Không dùng ảnh gương.
2. Máy đặt cố định, đủ sáng, nền đơn giản, có khoảng trống quanh đầu và chân.
3. Ảnh chính diện: thấy cả hai vai; tay hơi tách khỏi thân để đường viền eo không dính với tay.
4. Ảnh nghiêng: xoay người 90 độ, giữ tay hơi phía sau thân để không che bụng. Giữ cùng trang phục và chiều cao camera.
5. Mỗi ảnh JPG/PNG/WebP <= 10 MB và <= 20 megapixel. HEIC: xuất thành JPG trước.
6. Chọn đủ ảnh, nhập chiều cao, đồng ý xử lý và bấm tạo mô hình. Nếu bị từ chối, làm theo lý do hiển thị rồi chụp lại.

Camera trình duyệt chỉ chạy ở localhost hoặc HTTPS. Máy khác truy cập qua HTTP LAN có thể không mở được camera. Bản này chỉ bind localhost để chạy riêng trên máy. Muốn demo từ điện thoại bên ngoài cần cấu hình HTTPS và quyền truy cập phù hợp; chưa được deploy công khai.

## Cấu trúc

```text
morph-ai/
  frontend/                 Next.js + React Three Fiber
  backend/
    app/main.py             API, hàng đợi, thời hạn phiên
    app/images.py           Kiểm tra ảnh và EXIF
    app/reconstruction.py   Tách silhouette và fitting mesh
    models/                 Pose Landmarker + mẫu cơ thể
    data/                   Chỉ kết quả GLB tạm
    tests/                  Kiểm thử ảnh, hình học và API
  design/scan-reference.png  Ảnh thiết kế tham chiếu
  .runtime/python/          Python riêng của project
  setup.ps1
  start-backend.ps1
  start-frontend.ps1
```

## Dữ liệu và giới hạn vận hành

Ứng dụng không lưu hồ sơ ảnh. Trong quá trình upload, framework có thể ghi file tạm xuống ổ đĩa; file được đóng sau tiếp nhận. Dữ liệu ảnh được xử lý trong bộ nhớ sau đó. Kết quả GLB hết hạn sau 1 giờ, được dọn theo chu kỳ 30 giây, khi có request hoặc khi backend khởi động lại. Nút xóa phiên xóa kết quả sớm. Không dùng ảnh để huấn luyện. Giao diện giữ preview cục bộ cho đến khi xóa phiên hoặc đóng trang.

Demo chạy một worker và nhận tối đa ba job đang chờ/xử lý. Không có tài khoản, tenant isolation, billing hay bảo vệ đầy đủ cho public Internet. ID phiên là chuỗi ngẫu nhiên; người có ID và quyền truy cập backend có thể đọc kết quả. Không public dịch vụ này như production.

## Phát triển và kiểm thử

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -q
```

```powershell
cd frontend
npm.cmd run typecheck
npm.cmd run build
```

`BACKEND_URL` trong `frontend/.env.local` có thể đổi địa chỉ backend; mặc định `http://127.0.0.1:8000`. Next.js proxy `/api/*` nên trình duyệt không cần CORS riêng. Khi đổi biến môi trường, khởi động lại Next.js.

## Nâng cấp SAM sau này

Giữ frontend và hợp đồng API; thay hàm `reconstruct` bằng worker chạy SAM trên GPU phù hợp. Cần quyền checkpoint, môi trường model và benchmark riêng. Bản hiện tại chưa có worker SAM; không có nút SAM giả hoặc kết quả giả để thay thế scan thất bại.
