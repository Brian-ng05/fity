# Trạng thái kiểm tra — 2026-10-09

Source chính: `D:\MORPH-AI`. Kết quả bên dưới phân biệt kiểm tra phần mềm với kiểm chứng độ chính xác scan.

## Đã xác nhận

- Python 3.11.17 và venv được tạo tại D; `pyvenv.cfg` trỏ đúng `.runtime/python` trên D.
- `pip check`: No broken requirements found.
- Backend: **9 tests passed**, một warning của Starlette về TestClient/httpx; không ảnh hưởng kết quả. Test API có mock reconstruction, không phải benchmark AI.
- Frontend typecheck đã pass. Build production trên D đã pass trước sửa aria-label; đang kiểm tra lại build cuối, xem ghi chú cập nhật bên dưới.
- Browser trên Chrome headless: desktop 1440×1024 và mobile 390×844; không page error, không tràn ngang, wireframe/rotation/reset và privacy disclosure hoạt động. Mô hình hiển thị đủ đầu và bàn chân.
- Review frontend độc lập: SHIP trong phạm vi demo sau bổ sung tên truy cập cho nút Khối đặc/Khung lưới. Chữ phụ nhỏ và nav mobile xuống dòng là điểm cải thiện sau.
- Pipeline thật qua API, dùng **hai ảnh render mannequin tổng hợp**: MediaPipe → silhouette → biến dạng template → xuất/tải GLB đã completed. Một lần đo 2,73 giây; đây không phải cam kết tốc độ cho ảnh người thật.
- File GLB của lần thử đó dài 536.112 byte; Trimesh đọc được một geometry, chiều cao khoảng 1,70000005 m với đầu vào 170 cm.

## Lỗi đã sửa khi kiểm tra

- OrbitControls reset đưa góc nhìn về gốc gây cắt mô hình: đã set camera/target rõ ràng.
- MediaPipe trả mask H×W×1 thay vì H×W: đã chuẩn hóa hai định dạng, thêm regression tests và kiểm tra lại bằng model thật.
- Polling mất kết nối: nút kiểm tra khởi động lại polling; 404 trả trạng thái tạo scan mới.
- Copy về file tạm upload trước đây nói chỉ ở RAM: đã sửa mô tả vì UploadFile có thể spool xuống ổ đĩa.
- Nút chỉ có icon trên mobile: đã có aria-label.

## Chưa được kiểm chứng

- Chưa thử bộ ảnh người thật đã được cho phép; chưa có ground truth hoặc sai số số đo.
- Chưa kiểm tra quyền camera và debug F5 trong phiên VS Code tương tác của người dùng. Cấu hình có sẵn, cần Microsoft Python/Python Debugger extension.
- Chưa public deploy hoặc thử truy cập từ điện thoại khác máy. Server bind localhost.
- Chưa có SAM/MHR, giữ mặt, texture thật hoặc đo ngực/eo/hông.

Ảnh giao diện và báo cáo máy nằm trong `verification/`. Các ảnh mannequin chỉ là fixture kiểm tra tổng hợp. Không dùng chúng làm bằng chứng scan một người thật.

## Ghi chú môi trường

QA dùng cổng frontend 3107 vì cổng 3000 có dịch vụ khác. Script người dùng vẫn dùng 3000; cần dừng phiên cũ nếu cổng bị chiếm. Không tự dừng tiến trình chưa xác định.

Một lần build lại gặp EPERM khi tạo cache Next.js. Cache cũ được giữ trong `.cache/` thay vì xóa; phần này có thể chiếm thêm dung lượng. Kết quả build cuối sẽ được bổ sung sau khi hoàn tất. Không suy ra server người dùng đã chạy từ việc QA sandbox thành công.
