# Chạy MORPH AI trên máy của bạn

Bản làm việc chính nằm ở **D:\MORPH-AI**. Frontend và backend là hai source riêng, có dependencies và lệnh chạy riêng:

| Thành phần | Đường dẫn | Vai trò |
|---|---|---|
| Frontend | `D:\MORPH-AI\frontend` | Next.js: tải/chụp ảnh, xem mô hình 3D |
| Backend | `D:\MORPH-AI\backend` | Python + FastAPI: nhận ảnh, xử lý, xuất GLB |
| Python riêng | `D:\MORPH-AI\.runtime\python\python.exe` | Python 3.11.17 cài trong project |
| Môi trường backend | `D:\MORPH-AI\backend\.venv\Scripts\python.exe` | Interpreter cần chọn trong IDE |

Bạn không cần cài Python toàn hệ thống, Java hay CUDA để chạy bản này. Các script dùng đúng Python trong project. Bản ở ổ C là bản sao cũ; hãy sửa code trên D để tránh nhầm phiên bản.

## 1. IDE nên dùng: Visual Studio Code

VS Code đã có trên máy. Mở VS Code → **File → Open Folder → D:\MORPH-AI**, hoặc mở file `D:\MORPH-AI\MORPH-AI.code-workspace`.

Trong Extensions (`Ctrl+Shift+X`), cài các extension do **Microsoft** phát hành nếu chưa có: **Python**, **Pylance**, **Python Debugger**. Project đã có danh sách gợi ý ở `.vscode/extensions.json`.

Nhấn `Ctrl+Shift+P` → **Python: Select Interpreter** → **Enter interpreter path** rồi chọn:

```text
D:\MORPH-AI\backend\.venv\Scripts\python.exe
```

Cấu hình mặc định và debug đã có sẵn trong `.vscode`. Microsoft hướng dẫn cách dùng môi trường Python và debug FastAPI tại [FastAPI trong VS Code](https://code.visualstudio.com/docs/python/tutorial-fastapi) và [Python environments](https://code.visualstudio.com/docs/python/environments).

## 2. Chạy bằng hai terminal — cách đơn giản nhất

Trong VS Code chọn **Terminal → New Terminal**. Terminal số 1 chạy backend:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File D:\MORPH-AI\start-backend.ps1
```

Giữ terminal đó mở. Bấm nút `+` trên vùng terminal để tạo terminal số 2 rồi chạy frontend:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File D:\MORPH-AI\start-frontend.ps1
```

Chờ backend báo Uvicorn đang chạy và frontend báo Ready, sau đó mở:

- Giao diện: [http://127.0.0.1:3000](http://127.0.0.1:3000).
- Kiểm tra backend: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health), mong đợi `"ready": true`.
- Tài liệu/thử API: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

Các URL chỉ hoạt động khi server đang chạy. Dừng bằng `Ctrl+C` trong từng terminal. Không cần chạy lại setup mỗi ngày. `ExecutionPolicy Bypass` ở đây chỉ áp dụng cho tiến trình PowerShell chạy script, không đổi chính sách toàn máy.

## 3. Debug backend bằng F5

Mở cả thư mục `D:\MORPH-AI` trong VS Code. Dừng terminal backend trước để tránh trùng cổng 8000. Mở **Run and Debug** (`Ctrl+Shift+D`), chọn **MORPH Backend (FastAPI)** rồi nhấn `F5`.

Đặt breakpoint trong `backend/app/main.py` hoặc `backend/app/reconstruction.py`; thao tác trên web sẽ đi qua breakpoint. Frontend vẫn chạy ở terminal riêng. Dừng debug bằng `Shift+F5`. Cấu hình này không bật auto reload; khi sửa Python, dừng rồi chạy lại. Không chạy riêng `main.py` bằng nút Run Python File vì đây là ứng dụng ASGI cần Uvicorn.

## 4. Thử demo

1. Ban đầu là **mô hình minh họa**, chưa phải kết quả từ ảnh của bạn.
2. Chuẩn bị hai ảnh cùng một người: toàn thân chính diện và nghiêng 90°, đồ ôm sát, nền đơn giản, đủ sáng, không cắt đầu/bàn chân. Ảnh JPG/PNG/WebP, tối đa 10 MB mỗi ảnh.
3. Chọn hai ảnh, nhập chiều cao bằng cm, đồng ý xử lý ảnh và bấm **Tạo mô hình 3D**.
4. Khi thành công: xoay, zoom, xem lưới và tải GLB. Nếu bị từ chối, xem lý do rồi chụp lại.
5. Bấm **Xóa phiên** khi xong. GLB tự hết hạn sau một giờ kể từ khi xử lý xong; tải file trước nếu cần giữ.

Backend hiện dùng MediaPipe trên CPU và điều chỉnh mẫu cơ thể theo đường viền hai ảnh. **Chưa phải SAM 3D Body, chưa giữ khuôn mặt thật và chưa có số đo đã kiểm chứng.** Cần thử thêm ảnh người thật để đánh giá chất lượng; không dùng kết quả để may đo.

## 5. Lỗi thường gặp

| Hiện tượng | Cách xử lý |
|---|---|
| Python mở Microsoft Store | Dùng script ở trên hoặc đường dẫn `.venv\Scripts\python.exe`, không dùng `python` trần |
| VS Code gạch đỏ import | Chọn đúng interpreter trong bước 1 |
| Port 8000/3000 đang được dùng | Dừng phiên chạy cũ ở terminal tương ứng; không mở nhiều bản cùng lúc |
| Backend chưa sẵn sàng | Mở URL health và xem log terminal backend; thiếu dependency/model thì chạy setup |
| Camera không mở | Cho phép camera trên localhost; có thể tải ảnh từ máy thay thế |
| Không nhận diện được toàn thân | Chụp lại đúng hướng dẫn; không thay bằng avatar mẫu rồi coi là scan thành công |
| WebGL không hoạt động | Bật tăng tốc đồ họa trong trình duyệt và thử Chrome/Edge |

## 6. Cài lại dependencies

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File D:\MORPH-AI\setup.ps1
```

Cần Internet. Script cài Python riêng nếu thiếu, thư viện backend theo `requirements.lock.txt`, model và frontend theo `package-lock.json`. Nếu chuyển project sang ổ/thư mục khác, phải tạo lại `.venv` tại vị trí mới; không coi việc copy venv là cài đặt hợp lệ.

## 7. Đưa cho agent khác tiếp tục

Mở project `D:\MORPH-AI` trong công cụ agent, gửi:

> Hãy đọc AGENTS.md và AGENT_HANDOFF.md trong D:\MORPH-AI, kiểm tra trạng thái source thực tế rồi tiếp tục các việc ưu tiên. Giữ frontend/backend riêng. Không mô tả avatar mẫu hoặc hình thể ước lượng là scan chính xác. Chưa làm e-commerce, billing hoặc Mix & Match.

Chi tiết kỹ thuật, điểm chưa kiểm chứng và lệnh kiểm tra nằm trong `AGENT_HANDOFF.md`.
