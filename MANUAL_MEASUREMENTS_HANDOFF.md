# Nhập số đo thủ công — bàn giao

Cập nhật 13/10/2026. Nguồn: `D:\morph3d-ai`. Phạm vi: thêm lựa chọn **nhập số đo thủ công** song song với luồng camera hai ảnh; không đổi luồng camera cũ.

## 1. Người dùng nhận được gì

- Màn hình bắt đầu của module tìm size (`/scan` và modal trên trang sản phẩm) có công tắc **Quét bằng camera / Nhập số đo thủ công**.
- Form nhập **12 ô**, chia ba nhóm rõ ràng:
  - **Số đo chính** — chiều cao (bắt buộc, 100–230 cm), vòng ngực (bắt buộc), vòng eo (bắt buộc), vòng mông (không bắt buộc).
  - **Vòng bổ sung** — vòng cổ, vòng đầu, vòng đùi, vòng bắp chân, vòng cổ chân (đều không bắt buộc). Các vòng này **được khớp thật vào mô hình 3D**.
  - **Số đo để đối chiếu** — rộng vai, dài tay, dài trong chân (không bắt buộc). Ba số này **chỉ được ghi lại**, không dựng vào mô hình.
  Mỗi ô có hướng dẫn đo, kiểm tra ngay khi gõ và thông báo lỗi cụ thể.
- Kết quả dùng lại đúng màn hình kết quả cũ: 3D viewer (4 góc, khối/lưới/điểm, đường đo), danh sách số đo kèm nguồn, gợi ý size, tải GLB/JSON/PNG, xóa phiên.
- Trong danh sách số đo, mỗi dòng tự khai nguồn: `Bạn nhập` (đã khớp vào avatar), `Bạn nhập · không dựng vào mô hình` (chỉ ghi lại), `Theo mẫu 3D`, `Chưa đủ dữ liệu`. Ghi chú trên đầu kết quả được **sinh từ chính dữ liệu backend trả về**, nên luôn đúng với tổ hợp ô người dùng đã điền.
- Trên kết quả nhập tay có nút **Sửa số đo**: form mở lại với **toàn bộ** số cũ (cả 12 ô), đổi số rồi dựng lại mô hình (phiên cũ được xóa trước khi tạo phiên mới).

## 2. Kiến trúc và lý do

Không viết lại engine. Luồng mới dùng chung template MakeHuman, chung `closed_torso_section`, chung `fit_measurement_targets`, chung `Job`/endpoint phụ trợ:

| Thành phần | Thay đổi |
|---|---|
| `backend/app/measurements.py` | `EXTRA_BANDS` (cổ/đầu trên trục giữa, đùi/bắp chân/cổ chân theo từng chân), `all_bands()`, `measurement_limits()` phủ cả 8 vòng, `extra_midline_targets()`, `leg_girth_targets()`, `leg_section_geometry()`, `fit_leg_targets()`, `merge_fit_profiles()`, `factor_knots()` |
| `backend/app/reconstruction.py` | `validate_measurements()` kiểm tra mọi ô đã nhập và nêu tên ô sai; `reconstruct_from_measurements()` khớp thân + cổ/đầu, rồi khớp từng chân, gộp hai kết luận fit, ghi cả số chỉ-để-đối-chiếu vào `measurements`; cảnh báo theo điều kiện |
| `backend/app/report.py` | Dòng số đo lấy từ `profile["sections"]` (tức từ đúng những gì đã fit) với bảng màu theo từng khoá; thêm nguồn `user_input_unfitted` |
| `backend/app/main.py` | `ManualMeasurements` thêm 8 trường không bắt buộc |
| `frontend/lib/useBodyScan.ts` | `ManualInput` 12 khoá, `Measurements` mở rộng, nguồn `user_input_unfitted` |
| `frontend/components/shop/ManualMeasurements.tsx` | 12 ô theo 3 nhóm, `draftFromJob()` map mọi khoá |
| `frontend/components/shop/ScanResult.tsx` | Nhãn nguồn mới, ghi chú sinh từ dữ liệu thật |
| `frontend/components/BodyViewer.tsx` | Màu cho vòng cổ/đầu/đùi/bắp chân/cổ chân |
| `frontend/app/capture-flow.css` | Tiêu đề nhóm `.manual-group`, responsive ≤650px |

**Vòng trên trục giữa (cổ, đầu).** Không dùng `MANUAL_BANDS` vì cấu trúc đó suy mức giải phẫu từ dải vai–hông; cổ/đầu nằm ngoài dải đó nên khai báo mức trực tiếp — **đúng mức mà viewer đang vẽ** (0.855 và 0.94), nên số người dùng gõ và vòng hiển thị nói về cùng một mặt cắt.

**Vòng từng chân (đùi, bắp chân, cổ chân).** Mỗi chân là một vòng kín riêng, nên `fit_measurement_targets` (vốn chỉ co giãn mặt cắt cắt ngang trục giữa) không với tới được. `fit_leg_targets()` co giãn hướng tâm từng chân quanh trục của chính nó, với mặt nạ **bám theo hình dạng mặt cắt** (`hypot((x−cx)/ax, (z−cz)/az)`): mặt nạ tròn sẽ co thiếu ở bắp chân dài và kéo theo cả bàn chân lẫn bàn tay. Hệ số được ghim về 1 dưới mắt cá (0.065) và trên háng (0.46), nên bàn chân và khung chậu giữ nguyên. Vì mỗi chân là một vòng riêng nên **một số đo áp dụng cho cả hai chân** — đã ghi rõ trong cảnh báo kết quả.

**Đường cong hệ số theo chiều cao.** `factor_knots()` ghim hệ số về 1 ngay trên vòng cao nhất đã đo, để vùng không đo giữ hình dạng mẫu. Với đúng ba vòng ngực/eo/mông, hàm này **sinh ra đúng bộ nút cũ** `[0, .38] + levels + [.84, 1]`, nên luồng ảnh không đổi hành vi (có test khẳng định).

Toán quy đổi vòng trên trục giữa như cũ: không có ảnh nghiêng thì giữ nguyên tỷ lệ sâu/rộng của mẫu, `width = C / (2·E(1−r²))`, `depth = width·r`, khớp đúng dạng elip mà luồng ảnh dùng.

Ô để trống không bị bịa: vòng mông bỏ trống giữ đúng vòng mông của mẫu và được báo "Theo mẫu 3D"; gợi ý size quần/váy trả `insufficient_measurements`. Vòng bổ sung bỏ trống cũng vậy — và **không** sinh thêm nút trong `profile["sections"]`.

## 3. Kiểm tra đã chạy

- **Backend**: `./backend/.venv/Scripts/python.exe -m pytest backend/tests -q` → **72 passed** (63 → 72). Test mới chạy **engine thật**, không mock:
  - `test_supporting_girths_really_shape_the_exported_avatar` — POST đủ 8 vòng, rồi **đo lại chính file GLB** (không phải kết quả fit trong bộ nhớ) và khẳng định từng vòng bằng đúng số đã nhập (sai số ≤1.5 cm; thực tế tối đa 0.43 cm ở vòng đùi).
  - `test_recorded_only_numbers_are_labelled_and_never_claimed_as_model_sections` — rộng vai/dài tay/dài trong chân mang nguồn `user_input_unfitted` và `points_m` rỗng (không có gì để vẽ).
  - `test_blank_supporting_bands_keep_the_template_shape` — để trống thì 5 vòng bổ sung là `template_model`, `sections` chỉ còn ngực/eo/mông, và số trên mesh bằng đúng vòng của mẫu nhân chiều cao.
  - `test_leg_girths_leave_the_pelvis_and_the_feet_alone` — đo vòng đùi/bắp chân/cổ chân không làm đổi mặt cắt ngực/eo/mông lẫn đường viền bàn chân.
  - `test_out_of_template_supporting_band_names_the_field` (3 tham số) — số nằm trong dải API nhưng ngoài dải mẫu → 400 nêu đúng tên ô, không vào hàng đợi.
  - `test_report.py` (mới) — khoá **nguyên trạng** danh sách số đo của luồng ảnh: đúng thứ tự, đúng màu, đúng nguồn.
- **Frontend**: `npx tsc --noEmit` sạch; `next build --webpack` pass (29 trang, không đổi tập route).
- **Browser thật** (Chrome headless + production build QA, `verification/scripts/manual-entry-ui.cjs`) → **30/30 check pass**. Phần cũ giữ nguyên (form chặn submit khi thiếu số và khi chiều cao ngoài 100–230; viewer dựng mesh đúng hình người — 31 942 px, bbox 280×443, màu trung bình rgb 48/83/67; danh sách hiện 96/82/100 nguồn "Bạn nhập"; Sửa số đo → đổi ngực 96 → 104 tạo phiên mới và xóa phiên cũ 204; modal sản phẩm 88/70/162 mông để trống → 95.7 "Theo mẫu 3D"; không page/console error). Phần mới:
  - form chia đúng 3 nhóm (`Số đo chính | Vòng bổ sung | Số đo để đối chiếu`);
  - payload gửi lên mang **đủ 12 giá trị** đã gõ (170/90/74/96/35/56/54/35/21/40/59/78);
  - mesh vẫn dựng ra hình người sau khi thêm 5 vòng bổ sung (31 826 px, bbox 276×443);
  - 5 vòng bổ sung hiện `Bạn nhập` với **đúng số đã nhập** (35/56/54/35/21), rộng vai/dài tay/dài trong chân hiện `Bạn nhập · không dựng vào mô hình`;
  - các dòng đã fit **có đường đo để bấm**, ba dòng chỉ-ghi-lại thì **bị vô hiệu** (`disabled`) — đúng bằng chứng ở tầng UI cho `points_m` rỗng;
  - ghi chú kết quả liệt kê đúng phần đã khớp và nói rõ phần chỉ ghi lại;
  - form 12 ô ở 390 px **không thêm tràn ngang** (172 px, bằng đúng mức nền của trang camera — vốn đã có từ trước).
- Ảnh/log: `verification/manual-entry-20261013/` (`browser-results.json`, `manual-form-desktop.png`, `manual-form-errors.png`, `manual-form-mobile.png`, `manual-form-modal.png`, `manual-result-desktop.png`, `manual-regenerated-desktop.png`, `manual-supporting-desktop.png`, `manual-result-modal.png`, `backend.log`, `frontend.log`, `production-build.log`).
- Chạy lại: `node verification/scripts/manual-entry-ui.cjs` (cần `playwright-core` + Chrome; đặt `PLAYWRIGHT_CORE` nếu không nằm ở `.cache/qa/node_modules`; `MORPH_QA_SKIP_BUILD=1` để dùng lại bundle đã build). Không dùng webcam thật, không đọc ảnh cá nhân.
- **Không chạy được trong workspace này**: `verification/scripts/review-ui.cjs` và `upper-ui.cjs` hardcode `root='D:/MORPH-AI'` và một bản playwright trong profile người dùng khác, nên không chạy được ở `D:\morph3d-ai`. Luồng ảnh vì vậy chỉ được chốt bằng pytest (`test_reconstruction.py`, `test_measurements.py`, `test_photo_measurements.py`, `test_upper_body.py`, `test_report.py`), chưa bằng browser.
- **Lưu ý khi chạy harness**: build QA dùng `MORPH_REVIEW=1` nên Next ghi lại `frontend/next-env.d.ts` trỏ sang `.next-review/types/...` và `frontend/tsconfig.tsbuildinfo`. Hai file này được git theo dõi, nên sau khi chạy QA hãy `git checkout -- frontend/next-env.d.ts frontend/tsconfig.tsbuildinfo` để không commit đường dẫn của bản QA build.

## 4. Giới hạn đã biết (không được nói quá)

- Một template chỉ giãn được trong dải **±30–40%** so với tỷ lệ của mẫu. Số nằm ngoài dải đó bị từ chối kèm thông báo nêu rõ ô và khoảng hợp lệ (ở 175 cm: cổ 23.3–46.5, đầu 40–80, đùi 36.8–73.7, bắp chân 25.3–50.6, cổ chân 15.5–30.9). Đây là giới hạn của demo, không phải kết luận về cơ thể người dùng.
- **Một số đo cho cả hai chân.** Một lần đo vòng đùi/bắp chân/cổ chân được áp đối xứng cho cả hai chân; engine không mô hình chân lệch. Cảnh báo trong kết quả nói rõ điều này.
- **Rộng vai, dài tay, dài trong chân không dựng vào mô hình.** Chúng được nhận, ghi lại, hiện trong danh sách với nhãn riêng, và dòng đó không có đường đo để bấm. Không có cơ sở để nắn mô hình theo chúng (rộng vai cần một kiểu biến dạng khác; dài tay/inseam sẽ phải co giãn dọc và làm lệch chiều cao đã nhập).
- Mặt cắt vẫn giả định elip theo tỷ lệ sâu/rộng của mẫu: số vòng đúng, hình dạng riêng của từng người thì không. Đầu, cổ, tay, chân không nhập vẫn theo mẫu.
- Số đo người dùng nhập **chưa được đối chứng bằng thước dây**; `max_fit_error_cm` chỉ là sai lệch avatar so với chính số đã nhập (0.43 cm ở ca đầy đủ 8 vòng), không phải độ chính xác so với cơ thể thật.
- Không có ảnh → không thể kiểm tra tư thế, nên form chỉ kiểm tra giá trị và tính hợp lệ với template.
- Hai phát hiện ngoài phạm vi, ghi lại để không nhầm là lỗi mới:
  1. Header trang `/scan` (đã có từ trước) tràn ngang **172 px** ở viewport 390 px do `.scan-product-picker` + `.scan-back-link`; đo trên chính trạng thái camera trước khi mở form nên không do tính năng này, và form 12 ô không làm tăng thêm. Harness ghi lại bằng dòng `NOTE`.
  2. Proxy của Next + uvicorn `--timeout-keep-alive` mặc định 5 s có thể trả `ECONNRESET` (proxy → 500) cho POST đầu tiên sau một khoảng nghỉ dài. UI hiện thông báo lỗi rõ và bấm lại là được; harness QA nâng keep-alive để phép đo nói về tính năng chứ không nói về race này.
- Chưa đụng tới: Mix & Match, thanh toán, ecommerce ngoài, deploy công khai, đo bằng ảnh thật.

## 5. Bước tiếp theo

- Nếu muốn dùng số đo nhập tay cho may đo thật: cần đối chứng thước dây, và kiểm tra hình dạng mặt cắt ngoài giả định elip.
- Vòng bổ sung mới chỉ được chốt bằng pytest ở tầng backend; nên port `review-ui.cjs`/`upper-ui.cjs` sang workspace này để có browser check cho luồng ảnh.
- Chưa hỗ trợ chân lệch (trái/phải khác nhau) và chưa hỗ trợ vòng bắp tay.
- Cân nhắc sửa hai phát hiện ở mục 4 (header mobile và keep-alive proxy) trong một lần riêng, kèm ảnh kiểm tra ở 390 px.
