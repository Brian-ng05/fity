> Bản cập nhật mới nhất: đọc UPPER_BODY_HANDOFF.md. Webcam thân trên là mặc định; /scan dùng màn hình kết quả mới, không còn giao diện kỹ thuật cũ.

> Cập nhật storefront 12/10/2026: người dùng đã chọn trang mua sắm demo có sản phẩm và module tìm size. Route / là cửa hàng minh họa, /scan giữ công cụ kỹ thuật. Đọc COMMERCE_HANDOFF.md cho source và phạm vi mới.

# MORPH AI — bàn giao agent

Cập nhật 12/10/2026. Source duy nhất cần sửa: `D:\MORPH-AI`. Giữ `frontend` và `backend` riêng. Bản Documents/Codex cũ chỉ để tham khảo. Đọc AGENTS.md, README.md, HUONG_DAN_CHAY.md, VERIFICATION.md trước khi làm tiếp.

## Mục tiêu và quyết định

Demo cho fashion SME/startup: trang sản phẩm → camera hướng dẫn liên tục, chụp hai góc → ước lượng số đo → avatar body fit → gợi ý size → áp dụng size → giỏ hàng demo. Người dùng đã chọn trang mua sắm và yêu cầu refactor giao diện. Thiết kế mới theo DESIGN.md; /scan giữ công cụ kỹ thuật. Chưa kết nối nền tảng ecommerce, thanh toán, đơn hàng, Mix & Match hoặc public deployment.

## Môi trường và chạy

- Python 3.11.17 project-local `.runtime/python/python.exe`; venv `backend/.venv/Scripts/python.exe`.
- Node/Next.js/React/Three.js ở frontend; lockfiles là nguồn phiên bản chính xác.
- FastAPI, MediaPipe Pose Landmarker CPU, NumPy/SciPy, Trimesh/Pillow; không SAM/MHR/PyTorch.
- GPU MX330 2GB; không tự thuê GPU/API mất phí.
- `start-backend.ps1` → 127.0.0.1:8000; `start-frontend.ps1` → 127.0.0.1:3000; VS Code F5 đã cấu hình.
- Khi đổi Python cần khởi động lại backend nếu không có reload. Không dừng các tiến trình khác chỉ vì trùng cổng.
- `start-all.bat`/`stop-all.bat` có sẵn từ lần sửa khác; hướng dẫn chính ưu tiên hai terminal và Ctrl+C.

## Những file chính

| File | Vai trò |
|---|---|
| frontend/components/GuidedCamera.tsx | getUserMedia, chọn camera, capability zoom, AI preview, kiểm tra đứng yên, tự chụp, hủy request/timer/track |
| frontend/components/CameraCapture.tsx | Re-export GuidedCamera |
| frontend/components/BodyViewer.tsx | Mesh GLB, vật liệu/normal, bốn góc xem, vòng contour thật, nhãn DOM ngoài Canvas |
| frontend/components/SizeAdvice.tsx | Bảng khoảng số đo cơ thể minh họa hoặc nhãn hàng tự nhập |
| frontend/app/page.tsx | Trang mua sắm; components/shop và lib chứa module tìm size/giỏ hàng |
| frontend/app/scan/page.tsx | Công cụ kỹ thuật: ảnh, chiều cao, consent, scan/poll/export/delete, viewer và kết quả |
| frontend/app/scan-review.css | Camera responsive, legend, góc xem, size form |
| backend/app/reconstruction.py | Observe pose/mask, profile hai góc, biến dạng template, engine v3, export GLB normals |
| backend/app/measurements.py | Chu vi elip từ ảnh, contour kín thật, fit và residual |
| backend/app/sizing.py | Schema chart và khớp tất cả khoảng đo; thiếu dữ liệu không đoán |
| backend/app/main.py | API, queue một worker, TTL, lifecycle |

## Thuật toán và giới hạn phải giữ đúng

MediaPipe xác định landmark/segmentation; mỗi ảnh có kiểm tra toàn thân và góc chụp. Preview không suy tư thế từ pixel tĩnh. Front/side lấy đường viền theo trục vai–hông, chuẩn hóa chiều cao. Ngực/eo/mông là ước lượng chu vi elip từ hai ảnh tại vùng giải phẫu heuristic. Chiều cao do người nhập; rộng vai là khoảng cách landmark chiếu trên ảnh; inseam = null.

Engine `mediapipe-two-photo-fit-v3` fit MakeHuman qua ba vùng đo bằng PCHIP. Không in mọi hàng silhouette nhiễu lên mesh: tay chồng thân ở ảnh nghiêng từng tạo gai lưng. Scale độ sâu quanh tâm lát cắt thân, không quanh gốc OBJ lệch tâm. Scale ngang dùng ánh xạ đơn điệu để không đảo thứ tự đỉnh gần nách. Điều chỉnh tiếp cho chu vi mesh khớp các ước lượng, xuất contour kín lấy từ mesh thật.

`max_fit_error_cm` chỉ là sai lệch avatar so số ước lượng, KHÔNG phải sai số so người thật. Mặt/đầu và phần lớn tay/chân theo mẫu. Template prior làm bề mặt hợp lý hơn nhưng không tái tạo mô mềm/tư thế thật. Không gọi avatar là bản sao chính xác hay thử đồ mô phỏng vải.

Size dùng BODY measurement chart (cm), áo cần ngực+eo, quần cần eo+mông; mọi dimension cung cấp đều cần dữ liệu và khớp. Trả tất cả size hợp lệ nếu ranh giới giao nhau. Không gọi bảng minh họa là chuẩn châu Á hoặc chuẩn nhãn hàng.

## Camera và viewer — lưu ý kỹ thuật

- Không ép aspectRatio portrait; width/height chỉ ideal; resizeMode none khi trình duyệt hỗ trợ, object-fit contain. Ảnh chụp dùng videoWidth/videoHeight đầy đủ.
- Zoom chỉ xuất hiện khi getCapabilities cung cấp range; min zoom không bảo đảm có lens ultrawide. Khung web rộng không tăng góc nhìn vật lý.
- Đổi camera/dóng modal phải dừng track, abort preview, hủy countdown và bỏ callback cũ. Generation token bảo vệ toBlob/zoom khi stream đổi.
- Consent AI riêng trước gửi preview; request nối tiếp, timeout 5s, nghỉ 500ms; 3 frame ổn định trước countdown 3s. Không quảng cáo đo số đo liên tục.
- Vòng đo lấy contour từ backend, chỉ scale đồng nhất để hiển thị. Không tự chỉnh hình khác với số đo.
- Nhãn DOM đặt ngoài R3F, tránh Drei Html root unmount gây removeChild khi xóa phiên trên React 19. Không tái đưa portal đó vào mà thiếu regression.
- Geometry loader cache không bị mutate; clone/dispose geometry owned. Sample normal được weld/smooth; result dùng normals GLB.

## API

- GET `/api/health`.
- POST `/api/capture-check`: photo ≤2MB, view front/side, consent=true; ready/message/landmarks. Không lưu hồ sơ preview.
- POST `/api/scans`: front/side ≤10MB mỗi ảnh, height_cm100–230, consent=true; job202.
- GET `/api/scans/{id}`: queued/processing/completed/failed, measurements/body_profile/model_url/warnings.
- GET `/api/scans/{id}/model`: GLB.
- GET `/api/scans/{id}/measurements`: JSON đơn vị cm, body_fit và warnings.
- POST `/api/scans/{id}/size-advice`: chart đã validate.
- DELETE `/api/scans/{id}`.

Job in-memory, tối đa ba queued/processing, một worker. GLB retention một giờ sau hoàn tất, cleanup30s. UploadFile có thể ghi file tạm. Không auth/public production.

## Kiểm tra và tiếp tục

Chạy `test-backend.ps1` (tắt pytest plugin autoload để tránh plugin môi trường treo), frontend `npm.cmd run typecheck`, `npm.cmd run build`. QA build dùng MORPH_REVIEW=1 → `.next-review`, BACKEND_URL http://127.0.0.1:8007; server3107/8007 để không đụng bản người dùng3000/8000. Đọc VERIFICATION.md cho kết quả mới nhất và bằng chứng.

Ưu tiên tiếp: bộ ảnh người trưởng thành tự nguyện, camera thật laptop/điện thoại, số đo thước dây đối chứng. Đánh giá từng vòng, nhiều dáng/trang phục/ánh sáng, tỷ lệ từ chối và thời gian. Browser test dùng video mannequin tổng hợp chỉ chứng minh luồng phần mềm, không chứng minh accuracy hoặc chất lượng mọi dáng người. Giữ lỗi rõ ràng khi ảnh không đạt; không trả avatar mẫu giả thành kết quả.

Không tự lấy ảnh người dùng ở thư mục/tài khoản khác. Không thêm face identity hoặc e-commerce ngoài yêu cầu. Muốn SAM/MHR sau này cần đánh giá checkpoint/license/GPU và benchmark riêng, không thay engine label trước khi thật sự triển khai.
