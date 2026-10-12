# MORPH — luồng camera liên tục

Yêu cầu mới nhất, 12/10/2026: bỏ hình nộm trước scan và bỏ toàn bộ upload ảnh trên UI. Source chính vẫn là `D:\MORPH-AI\frontend` và `D:\MORPH-AI\backend`.

## Luồng đang dùng

1. Mở `/scan` hoặc **Tìm size của tôi** trong trang mua sắm `/`.
2. Nhập chiều cao, chọn khung webcam thân trên (mặc định), đồng ý xử lý khung hình.
3. **Mở camera & bắt đầu** → **Bắt đầu quét**.
4. AI nhận đúng góc và giữ yên → đếm ngược 5 giây → chụp chính diện.
5. Cùng camera tiếp tục mở; hiện hướng dẫn xoay 90° trong 4 giây. Khi AI nhận đúng góc nghiêng và giữ yên, tự đếm ngược 5 giây lần nữa.
6. Chụp góc nghiêng, dừng camera, tự gửi hai frame chụp tới backend và dựng kết quả. Không cần bấm xử lý riêng.

Nếu tư thế không phù hợp hoặc di chuyển, countdown bị hủy và chờ đúng tư thế. Ảnh trống không được chụp. Hủy phiên/đóng module dừng stream, timer và request; không gửi cặp ảnh chưa đủ. Camera chỉ được đổi trước khi bắt đầu; đổi camera làm mới phiên.

Camera-only mô tả **cách nhập dữ liệu**, không biến camera laptop thành cảm biến độ sâu. Engine vẫn dựng hình thể ước lượng từ hai ảnh tự chụp. Các giới hạn/nguồn số đo giữ như `UPPER_BODY_HANDOFF.md`. API multipart vẫn nhận hai ảnh vì đó là frame do camera chụp; UI không có file chooser hoặc drag/drop.

## Source

- `frontend/components/shop/CaptureSession.tsx`: state machine ready → running/front → turn → running/side → complete, một MediaStream, kiểm tra AI, countdown và cleanup.
- `frontend/components/shop/FitExperience.tsx`: chuẩn bị, consent, phiên camera, tự xử lý, kết quả. Không import/render sample viewer hoặc upload.
- `frontend/lib/useBodyScan.ts`: `scan({front,side})` nhận trực tiếp cặp vừa chụp để tránh đọc state cũ.
- `frontend/app/capture-flow.css`: bố cục mới; override kết quả mobile để toolbar và canvas nằm riêng.
- `frontend/components/shop/ScanResult.tsx`: giữ màn hình kết quả dark đã triển khai.
- `GuidedCamera.tsx`/`CameraCapture.tsx`: component cũ còn trong source nhưng không được route mới sử dụng. Không nối lại upload UI.

## Chạy và kiểm tra

Chạy `start-backend.ps1` và `start-frontend.ps1` trong hai terminal tại D:\MORPH-AI. Mở http://127.0.0.1:3000/scan. Python interpreter trong VS Code: `backend/.venv/Scripts/python.exe`.

Production build/TypeScript đã pass. `verification/scripts/camera-flow-ui.cjs` là browser harness hiện tại. Nó kiểm tra không có file input/canvas mẫu, một lần getUserMedia cho hai góc, blank rejection, countdown và tự chuyển 90°, tự reconstruct bằng backend thật, cleanup sau xong/hủy, responsive và module trong storefront. Kết quả: `output/playwright/camera-flow-20261012/results.json`.

Các ảnh người bên trong camera QA là **frame mannequin tổng hợp để giả lập webcam**, không phải hình nộm còn sót trong UI. Chưa kiểm chứng trên camera/người thật. Các harness upper-ui/commerce-ui là lịch sử trước khi bỏ upload.

Agent documenter phụ gặp giới hạn sử dụng trong phiên này; phần cập nhật tài liệu cuối được agent chính đối chiếu trực tiếp với source và ảnh kiểm thử. Review độc lập màn hình kết quả đã yêu cầu sửa toolbar mobile; sửa này được xác nhận bằng kiểm tra vị trí toolbar/canvas.
