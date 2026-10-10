> Cập nhật 10/10/2026: đọc REVIEW_2026-10-10.md trước khi dùng tài liệu này. Camera đã chuyển sang kiểm tra landmark AI; số đo dùng hai ảnh và giả định elip; inseam không còn suy từ chiều cao; size đối chiếu bảng có thể chỉnh. Các mô tả cũ về motion-only camera, mesh slicing làm nguồn số đo, phân loại dáng và chuẩn size Á Đông bên dưới đã được thay thế.

# MORPH AI — bàn giao cho agent tiếp theo

Cập nhật: 2026-10-09. **Source chính: D:\MORPH-AI**. Đọc lại code trước khi sửa; báo cáo kiểm tra ở `VERIFICATION.md`.

## 1. Ý định và phạm vi người dùng

- Người dùng muốn demo web scan 3D tốt để trình bày cho doanh nghiệp thời trang SME/startup, tham khảo 3DLOOK và SnapMeasureAI.
- Làm scan trước; chưa tích hợp TikTok/Shopee/Lazada, chưa billing, Mix & Match hoặc thử đồ.
- Người dùng yêu cầu FE/BE riêng, tự cài môi trường Python, **tạo ảnh thiết kế trước khi code**, và giờ yêu cầu source ở D cùng hướng dẫn IDE/tài liệu bàn giao.
- Yêu cầu dài hạn gồm giữ khuôn mặt và tối thiểu dữ liệu nhập, nhưng bản hiện tại chưa đáp ứng face identity hoặc số đo. Không được đánh đồng demo hiện tại với sản phẩm đích.
- Đã chọn mặc định chạy CPU để demo chạy trên máy; câu hỏi dùng local CPU hay GPU ngoài cho SAM chưa được người dùng chốt. Không tự phát sinh chi phí thuê GPU.

## 2. Máy và cách chạy

- Windows x64, PowerShell; Node 24.19.0 và npm 11.17.0 đã có. VS Code đã cài.
- GPU đã đọc: NVIDIA MX330, 2 GB VRAM. Không khẳng định chạy được SAM 3D Body trên GPU này.
- Python 3.11.17 riêng tại `.runtime/python/python.exe`; venv được **tạo lại tại D**, không sao chép venv từ C.
- **Chạy 1-click cả FE và BE**: Double-click `D:\MORPH-AI\start-all.bat` (tự mở 2 terminal và browser `http://localhost:3000`).
- **Dừng hệ thống**: Double-click `D:\MORPH-AI\stop-all.bat` (giải phóng cổng 8000 và 3000).
- Terminal Backend: `powershell -NoProfile -ExecutionPolicy Bypass -File D:\MORPH-AI\start-backend.ps1`.
- Terminal Frontend: `powershell -NoProfile -ExecutionPolicy Bypass -File D:\MORPH-AI\start-frontend.ps1`.
- Web 127.0.0.1:3000; API 127.0.0.1:8000; Swagger `/docs`. Chỉ bind localhost.
- `.vscode/launch.json` có F5 FastAPI và đường dẫn interpreter rõ ràng. Cần Microsoft Python/Python Debugger extension.
- `setup.ps1` cài dependencies và assets. Venv không portable; tạo lại khi di chuyển project.

## 3. Kiến trúc và các file cần đọc

| File | Trách nhiệm |
|---|---|
| `frontend/app/page.tsx` | Hai ảnh, chiều cao, consent, health, tạo/poll/xóa scan, bảng số đo, gợi ý size |
| `frontend/components/BodyViewer.tsx` | R3F/Three.js, GLB kết quả, vòng đo 3D phát sáng (Ruler), lưới, xoay, contact shadows |
| `frontend/components/CameraCapture.tsx` | Smart Camera: getUserMedia fallback, auto-capture khi đứng yên, audio synth beep |
| `frontend/app/globals.css` | Giao diện responsive, Be Vietnam Pro, measurements card, fashion size card, smart camera |
| `frontend/next.config.ts` | Proxy `/api/*` đến `BACKEND_URL`, mặc định localhost:8000 |
| `backend/app/main.py` | FastAPI, job in-memory, worker, TTL, tải/xóa GLB, payload measurements & body_profile |
| `backend/app/images.py` | Kiểm tra ảnh, EXIF, kích thước, decode/resize |
| `backend/app/reconstruction.py` | MediaPipe singleton, silhouette, arm lateral shift, mesh slice measurements, size recommendation |
| `backend/scripts/prepare_assets.py` | Lấy body faces từ template để hiển thị mẫu |
| `backend/tests/` | Ảnh, hình học, số đo lát cắt và API lifecycle |
| `design/scan-reference.png` | Ảnh thiết kế tạo trước giao diện; không phải ảnh chụp sản phẩm |
| `THIRD_PARTY_NOTICES.md` | Nguồn model/mesh/font, phạm vi giấy phép cần giữ |

Frontend: Next.js 16.4.0, React 19.3, TypeScript, Three.js, React Three Fiber/Drei, Lucide, font tự host. Backend: FastAPI, MediaPipe, NumPy/SciPy, Pillow, Trimesh. Xem lockfiles để biết phiên bản thực tế. Không cài PyTorch/SAM/MHR trong bản này.

## 4. Thuật toán hiện tại — cần mô tả trung thực

Hai ảnh được MediaPipe Pose Landmarker nhận diện landmark + segmentation (dùng singleton detector tái sử dụng để tránh nạp lại file model 25MB mỗi request). Backend lấy bề rộng và chiều sâu vùng thân theo chiều cao tương đối, dịch chuyển cánh tay theo độ mở rộng thân (`shift_x`) tránh dính lẹm thân vào tay, dùng nội suy PCHIP để biến dạng phần thân của mesh MakeHuman CC0; scale toàn bộ theo chiều cao người dùng nhập, đơn vị mét, xuất GLB.

Sau khi dựng mesh, backend dùng thuật toán cắt lát phẳng (`trimesh.intersections.mesh_plane`) tại các cao độ giải phẫu để ước lượng chu vi vòng ngực, vòng eo, vòng mông, sải vai và chiều dài chân (Inseam); phân loại dáng người (Đồng hồ cát, Quả lê, Tam giác ngược, Chữ nhật, Quả táo) và gợi ý size áo/quần chuẩn Á Đông / Việt Nam.

Đầu/mặt và bàn tay/chân vẫn theo template. Không phải photogrammetry, không dựng đủ bề mặt bị che khuất, không texture khuôn mặt. Các số đo và size là ước lượng hình học vi phân từ mesh 3D phục vụ định hướng trực quan thời trang, chưa được chứng nhận may đo lâm sàng. Mẫu trước scan có nhãn “Mô hình minh họa”. Khi scan thất bại phải trả lỗi thật.

## 5. Hợp đồng API

- `GET /api/health`: ready, engine, message, retention_seconds.
- `POST /api/scans`: multipart `front`, `side`, `height_cm` (100–230), `consent=true`; trả 202 với job.
- `GET /api/scans/{id}`: status queued/processing/completed/failed, stage, model_url, measurements, body_profile, error, warnings.
- `GET /api/scans/{id}/model`: GLB khi hoàn tất, Cache-Control no-store.
- `DELETE /api/scans/{id}`: 204; xóa job và kết quả.

Ảnh tối đa 10 MB/ảnh, 20 MP, JPG/PNG/WebP; reject trùng byte, sai pose/khung hình theo heuristic. Một worker, tối đa ba job chờ/đang xử lý. GLB hết hạn một giờ sau job kết thúc; dọn theo chu kỳ 30 giây, request hoặc restart. UploadFile có thể spool xuống file tạm trước khi đọc; không được nói ảnh chỉ tồn tại trong RAM. Ứng dụng không lưu hồ sơ ảnh; GLB trong backend/data. Chưa auth, tenant isolation, rate limit public hoặc persistence. Không deploy public nguyên trạng.

## 6. Ưu tiên tiếp theo

1. **Kiểm chứng thực tế:** dùng ảnh toàn thân chính diện/nghiêng của người tự nguyện, đúng hướng dẫn. Kiểm tra từ upload trên UI → nhận diện → GLB → viewer → download → delete. Hiện chưa có bộ ảnh người thật được xác nhận dùng cho kiểm chứng. Không tự lấy ảnh khách hàng từ tài khoản hoặc thư mục khác.
2. Ghi tỷ lệ nhận diện, lỗi thường gặp, thời gian và ảnh kết quả. Sửa heuristic/thao tác hướng dẫn dựa trên bằng chứng; không nới kiểm tra chỉ để fixture giả vượt qua.
3. Đánh giá chất lượng template fitting so với mục tiêu demo. Nếu không đủ, trình bày cụ thể phần cần SAM/GPU và xin quyết định chi phí trước khi dùng dịch vụ trả tiền.
4. Làm rõ yêu cầu giữ mặt: mesh khuôn mặt, texture hay chỉ avatar có ảnh mặt là các phạm vi khác nhau; hiện chưa có.
5. Trước khi công bố số đo hoặc size suggestion, xây bộ đối chứng đo thủ công và báo sai số theo từng số đo. Không suy ra chất lượng từ việc unit test pass.
6. Public deploy, account, billing và tích hợp thương mại nằm ngoài scope hiện tại.

## 7. Kiểm tra và lưu ý môi trường agent

Trong backend:

```powershell
Set-Location D:\MORPH-AI\backend
$env:TEMP = 'D:\MORPH-AI\.cache\tmp'
$env:TMP = $env:TEMP
$env:MPLCONFIGDIR = 'D:\MORPH-AI\.cache\matplotlib'
.\.venv\Scripts\python.exe -m pytest -q --basetemp D:\MORPH-AI\.cache\pytest
```

Trong frontend:

```powershell
Set-Location D:\MORPH-AI\frontend
npm.cmd run typecheck
npm.cmd run build
```

Trước khi di chuyển có 6 test pass và production build pass. API test **mock reconstruct**, hình học test dùng dữ liệu tổng hợp: không chứng minh chính xác trên người thật. Sau khi chuyển sang D đã có 9 test pass (thêm regression cho mask H×W×1), và pipeline MediaPipe thật đã xuất GLB từ ảnh mannequin tổng hợp. Kết quả browser/build cuối được ghi riêng ở VERIFICATION.md. Fixture tổng hợp không chứng minh độ chính xác trên người thật.

- Dùng Webpack trong script Next: Turbopack từng lỗi canonicalize path dưới sandbox Windows. Không đổi lại chỉ vì mặc định framework.
- Sandbox mỗi lệnh có thể cô lập localhost. Server do agent khởi động không có nghĩa trình duyệt của người dùng truy cập được. Để kiểm tra tự động, khởi chạy server + browser trong cùng tiến trình cha; để người dùng chạy, dùng hai terminal của họ.
- `TEMP/TMP` mặc định trong sandbox từng làm ensurepip/pytest lỗi quyền; script đã chuyển temp vào project.
- Chrome headless với profile tạm mặc định từng lỗi; QA dùng persistent profile ở thư mục được phép ghi.
- Lỗi khung xem: reset OrbitControls lúc mount từng đưa target về gốc, cắt mô hình. Đã đổi sang set camera position/target rõ ràng; xem ảnh xác nhận trong verification.
- Sau mất kết nối, nút Kiểm tra kết quả khởi động lại polling; 404 trả người dùng về trạng thái tạo scan mới.

## 8. Điều kiện gọi demo hoàn tất

FE/BE khởi động từ D; backend health ready; ảnh hợp lệ tạo GLB thực, ảnh lỗi báo lý do; viewer đúng khung desktop/mobile; tải/xóa hoạt động; hướng dẫn IDE chạy được; có bằng chứng với ảnh người thật. **Chưa đánh dấu đáp ứng toàn bộ điều kiện cuối chỉ từ build và unit test.**

Chỉ sửa bản D. Bản trong Documents/Codex được giữ để tham chiếu; không có cơ chế đồng bộ tự động. Không xóa bản cũ hoặc file người dùng nếu chưa cần thiết.
