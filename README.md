# MORPH AI — demo web scan hai góc

Source chính: `D:\MORPH-AI`. Frontend: `frontend/` (Next.js). Backend: `backend/` (Python/FastAPI). Cập nhật 12/10/2026.

## Chạy demo

Mở `D:\MORPH-AI` trong VS Code. Hai terminal riêng:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File D:\MORPH-AI\start-backend.ps1
```

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File D:\MORPH-AI\start-frontend.ps1
```

Mở http://127.0.0.1:3000; API http://127.0.0.1:8000/docs. Dừng bằng Ctrl+C ở từng terminal. Chi tiết interpreter và F5: [HUONG_DAN_CHAY.md](HUONG_DAN_CHAY.md).

## Luồng đã triển khai

1. Camera hướng dẫn tư thế bằng MediaPipe trên backend theo từng khung hình; đứng yên đúng góc rồi đếm ngược tự chụp. Có lựa chọn chụp thủ công và tải ảnh.
2. Chụp chính diện và nghiêng 90°, nhập chiều cao, đồng ý xử lý.
3. Ước lượng ngực/eo/mông từ bề rộng và độ sâu hai silhouette, giả định lát cắt elip.
4. Fit thân avatar MakeHuman theo ba vùng đo; xuất GLB, hiển thị vòng đo lấy từ chính mesh, xuất JSON.
5. Đối chiếu size theo khoảng số đo cơ thể của bảng minh họa hoặc bảng nhãn hàng người dùng nhập. Không tự chọn size gần nhất nếu không khớp.

Camera rộng tối đa 1120px, giữ tỷ lệ ảnh, chọn camera và zoom nếu phần cứng hỗ trợ. Viewer có góc trước/nghiêng/sau/3/4, khối/lưới, vòng đo, xoay/zoom và tải GLB.

## Giới hạn

Đây là demo ước lượng hình thể bằng CPU, chưa có sai số kiểm chứng trên người thật. Avatar khớp số ước lượng không chứng minh số đo đúng. Đầu/mặt và phần lớn tay/chân theo mẫu; inseam chưa đủ dữ liệu nên để trống. Chưa mô phỏng vải, độ co giãn hoặc độ rộng trang phục. Chưa SAM/MHR/PyTorch, chưa ecommerce, billing hay Mix & Match.

Máy hiện tại dùng NVIDIA MX330 2GB; bản này không cần CUDA/Java hoặc dịch vụ AI trả phí. Python riêng: `.runtime/python`; interpreter: `backend/.venv/Scripts/python.exe`.

## Dữ liệu

Ứng dụng không lưu hồ sơ ảnh. Upload có thể spool vào file tạm; không tuyên bố RAM-only. GLB hết hạn một giờ sau xử lý; dọn định kỳ, khi có request hoặc restart. Xóa phiên để xóa sớm. Chưa auth, tenant isolation hoặc bảo vệ cho public Internet; chạy localhost.

## Cài và kiểm tra

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File D:\MORPH-AI\setup.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File D:\MORPH-AI\test-backend.ps1
cd D:\MORPH-AI\frontend
npm.cmd run typecheck
npm.cmd run build
```

Không copy venv sang đường dẫn khác; phải tạo lại ở vị trí mới. Xem [AGENT_HANDOFF.md](AGENT_HANDOFF.md), [VERIFICATION.md](VERIFICATION.md), [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
