# MORPH — webcam thân trên và kết quả 3D

Cập nhật 12/10/2026. Source chính: `D:\MORPH-AI\frontend` và `D:\MORPH-AI\backend`. Tài liệu này thay thế mô tả cũ bắt buộc toàn thân trong các handoff trước.

## Trải nghiệm hiện tại

- `/`: trang mua sắm demo; mở **Tìm size của tôi** để scan ngay trong trang sản phẩm.
- `/scan`: cùng module scan, chạy thành trang riêng. Đây không còn là giao diện kỹ thuật cũ.
- Mặc định **Webcam · thân trên**: hai góc chính diện/nghiêng, từ đầu đến cạp quần/hông trên, nhập chiều cao. Không cần đầu gối hoặc bàn chân. Không hỗ trợ ảnh chỉ thấy mặt/ngực; phải thấy eo và hông trên để định vị vùng thân.
- **Ảnh toàn thân** vẫn có thể chọn; mode này giữ kiểm tra chân và cách quy đổi từ chiều cao silhouette.
- Kết quả nền tối: danh sách số đo, mô hình lớn, đường đo màu, khối đặc/điểm 3D/khung lưới, xoay và góc xem, cm/in, toàn màn hình, xuất ảnh PNG/GLB/JSON, sao chép JSON. Chọn số đo có đường vẽ để làm nổi đường tương ứng.
- Bảng dữ liệu có 12 mục, hiện 10 giá trị và 2 mục chưa đủ dữ liệu. Không bịa 19 số đo để giống sản phẩm tham khảo.

## Giới hạn thuật toán phải giữ rõ

Engine `mediapipe-two-photo-fit-v4`, không phải công nghệ độc quyền SnapMeasureAI. Website tham khảo vẫn hướng dẫn full-body; việc ảnh cắt chân được chấp nhận không chứng minh sai số đo của họ cho loại ảnh đó.

Chế độ thân trên không thể dùng chiều cao pixel của ảnh bị cắt làm chiều cao toàn thân. Backend dùng khoảng vai–hông với tỷ lệ mẫu 0.29 để suy ra tỷ lệ cm, rồi lấy bề rộng/sâu ngực và eo từ hai silhouette. Đây là giả định hình thể, chưa kiểm chứng trên người thật và có thể sai đáng kể nếu tỷ lệ cơ thể khác mẫu hoặc camera bị nghiêng.

`measurements.hip_cm` giữ **null** khi scan thân trên; size quần không được suy ra từ mông mẫu. `body_profile.measurement_details` chứa số mông/đầu/cổ/đùi/bắp chân/cổ chân trích từ mesh, gắn `template_model`. Các vòng mẫu là lát cắt ngang tại mức giải phẫu giả định, không phải đo trực tiếp cơ thể. `arm_length_cm` và `inseam_cm` để null. Chiều cao có nguồn `user_input`; ngực/eo/vai có nguồn `photo_with_prior` (thân trên) hoặc `photo_estimate` (toàn thân).

JSON và giao diện phải giữ nguồn số đo. Tỷ lệ fit mesh không được quảng cáo thành độ chính xác thực tế. Khuôn mặt vẫn theo mẫu, chưa mô phỏng vải/độ ôm áo. Chỉ chạy localhost; chưa auth, tenant isolation, checkout hoặc đơn hàng thật.

## Source và API

- `backend/app/reconstruction.py`: `observe(..., capture_mode)`, hướng dẫn tư thế, xử lý profile chỉ vùng nhìn thấy, quy đổi tỷ lệ theo mode.
- `backend/app/main.py`: `/api/capture-check` và `/api/scans` nhận form `capture_mode=upper_body|full_body`; mặc định API là full_body để tương thích client cũ.
- `backend/app/report.py`: danh sách số đo và nguồn, vòng mesh thật; không thêm dependency mới.
- `backend/app/measurements.py`: lấy vòng kín và chọn vòng gần tâm chi cho các vòng mẫu.
- `frontend/lib/useBodyScan.ts`: truyền mode, giữ lifecycle scan/delete/poll.
- `frontend/components/GuidedCamera.tsx`: hướng dẫn và tự chụp theo mode, bỏ kiểm tra chân trong chế độ laptop.
- `frontend/components/shop/ScanResult.tsx`: toàn bộ giao diện kết quả, controls và dữ liệu.
- `frontend/components/BodyViewer.tsx`: giữ geometry thật, thêm point mode và measurement highlight.
- `frontend/app/scan-result.css`: result responsive; toolbar mobile nằm ngoài vùng mô hình.

## Chạy

Mở `D:\MORPH-AI` bằng VS Code. Interpreter backend: `D:\MORPH-AI\backend\.venv\Scripts\python.exe`.

Terminal 1: `powershell -NoProfile -ExecutionPolicy Bypass -File D:\MORPH-AI\start-backend.ps1`

Terminal 2: `powershell -NoProfile -ExecutionPolicy Bypass -File D:\MORPH-AI\start-frontend.ps1`

Mở http://127.0.0.1:3000/scan hoặc trang mua sắm http://127.0.0.1:3000. Khởi động lại backend để nạp engine mới; reload trang để cập nhật frontend. Không tự dừng process không thuộc project.

## Kiểm thử và dữ liệu QA

`backend/tests/test_upper_body.py` kiểm tra thiếu chân được chấp nhận, thiếu hông vẫn từ chối, ảnh trống không sẵn sàng, vòng mẫu có nguồn và độ dài chưa biết giữ null. Bộ backend: 31 tests pass; một warning Starlette/httpx đã có từ trước.

`verification/scripts/check-upper.py` chạy reconstruct thật trên ảnh mannequin đã cắt chân; pass, mông API null và nguồn vòng mông là template_model. Đây là ảnh tổng hợp, không phải kiểm chứng độ chính xác người thật.

`verification/scripts/upper-ui.cjs` là harness hiện tại, dùng production FE 3107 và BE 8007, camera giả lập từ ảnh mannequin nhưng MediaPipe/backend thật. Xem kết quả thực tế trong `output/playwright/upper-20261012/results.json`; các harness commerce cũ là bằng chứng lịch sử trước lần thay giao diện kết quả này.

Môi trường shell của phiên làm việc từng có PATHEXT chỉ `.CPL`, làm lệnh exe không chạy đúng. Nếu gặp lại, chỉ sửa trong terminal hiện tại: `$env:PATHEXT='.COM;.EXE;.BAT;.CMD'`; không đổi cấu hình máy toàn cục.
