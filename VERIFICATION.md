# Kết quả kiểm tra — 12/10/2026

Source: `D:\MORPH-AI`. Báo cáo này thay thế trạng thái kiểm tra 09–10/10.

## Đã chạy thành công

- Backend: **27 tests pass**, một StarletteDeprecationWarning về TestClient/httpx. Test geometry gồm contour kín, loại vòng tay, chu vi elip, fit residual, biến dạng ngang đơn điệu, độc lập với gốc độ sâu và chống gai lưng do nhiễu silhouette.
- Production build Next.js Webpack: **pass**, bao gồm TypeScript, static generation và build traces. Build QA dùng `MORPH_REVIEW=1` (`.next-review`), `BACKEND_URL=http://127.0.0.1:8007`. Log `verification/review-20261012/production-build.log`.
- Browser Chrome headless trên **Next start production**, FE3107/BE8007: desktop1440×1024, mobile390×844. **Không page error, không console error, không tràn ngang** trong luồng đã kiểm tra.
- Camera: retry sau từ chối quyền; đổi camera dừng stream cũ; zoom theo capability; fallback khi không hỗ trợ zoom; giữ native aspect; camera trống không tự chụp; đóng camera dừng tracks; tự chụp đủ front và side sau kiểm tra AI.
- Pipeline MediaPipe thật chạy CPU từ hai ảnh mannequin tổng hợp: scan completed, GLB tải và hiển thị, JSON số đo xuất thành công. Inseam null; có contour kín và fit status.
- Viewer: bốn góc, khối/lưới, bật/tắt vòng đo; ảnh nghiêng đã xác nhận không còn gai lưng của phiên trước.
- Size: bảng minh họa và bảng tự nhập, khớp M trong fixture có khoảng phù hợp.
- Xóa phiên trả204 và giao diện về mô hình mẫu; không còn lỗi removeChild/React root unmount.

## Bằng chứng và tái chạy

Thư mục `verification/review-20261012/`: `browser-results.json`, log server/build, desktop/mobile, camera và avatar-side PNG.

Script `verification/scripts/review-ui.cjs` khởi chạy server QA rồi Chrome với video canvas từ fixture `verification/scripts/qa/`. Script dùng Playwright của Codex runtime đã có trên máy (đường dẫn require hiện theo máy này). Không dùng webcam thật, không đọc ảnh cá nhân. Cần build QA trước:

```powershell
cd D:\MORPH-AI\frontend
$env:MORPH_REVIEW='1'
$env:BACKEND_URL='http://127.0.0.1:8007'
npm.cmd run build
node D:\MORPH-AI\verification\scripts\review-ui.cjs
```

Dùng terminal QA riêng; các biến trên không phải cấu hình cho phiên người dùng3000/8000. Chỉ dừng process con do harness tạo. Backend tests: chạy `D:\MORPH-AI\test-backend.ps1`.

## Phạm vi chưa chứng minh

- Video test là mannequin tổng hợp, không phải người thật. Cấu hình thiết bị/quyền/zoom được mô phỏng để kiểm tra UI cleanup và fallback; chưa xác nhận camera phần cứng từng máy/trình duyệt.
- Không có dữ liệu đo thước dây đối chứng, không công bố MAE hoặc độ chính xác. Fit residual0cm của fixture chỉ là avatar khớp số ước lượng.
- Chưa giữ mặt, tái tạo mô mềm, phục dựng photogrammetry hoặc mô phỏng vải. Bảng size chỉ dùng BODY ranges, không suy độ vừa theo chất liệu.
- Chưa kiểm tra F5 trong VS Code tương tác; cấu hình interpreter/launch có sẵn. Chưa public deploy, auth, nhiều tenant hay camera qua HTTPS trên điện thoại khác máy.

Các hạn chế build/approval ở lần cũ đã được giải quyết; không còn ghi production build hiện tại là blocked.

## Review độc lập

Review camera/avatar yêu cầu sửa một lỗi trạng thái tự xoay khi chọn góc. Đã chuyển trạng thái về page, viewer và nút dùng cùng giá trị; harness xác nhận chọn góc tắt xoay và một click bật lại. Production build và luồng browser đã chạy lại thành công. Verdict pass: **resolved**, **ship** trong phạm vi finding này; không mở rộng thành chứng nhận độ chính xác AI. Tài liệu extension: DESIGN_EXTENSION_2026-10-12.md.
