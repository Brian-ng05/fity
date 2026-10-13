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

---

## 6. Bổ sung (cùng ngày 13/10/2026)

### 6.1 Spinner nhập số đo

`ManualMeasurements.tsx` đổi `step=".1"` → `step="1"`: mỗi lần bấm mũi tên tăng/giảm đúng **1 cm**. Vẫn gõ được số thập phân (`88.5`) vì form dùng `noValidate` + `validateManual()`, và style lỗi bám `aria-invalid` chứ không phải `:invalid` của trình duyệt. Ô chiều cao ở chế độ camera giữ nguyên vì yêu cầu chỉ nói về chế độ nhập tay.

### 6.2 Lưu số đo để mở lại vẫn còn

`frontend/lib/manualSession.ts` (mới) lưu số đo đã gửi + id phiên vào `localStorage` (`fity-manual-measurements-v1`). `useBodyScan` lưu khi submit, và khi tải lại trang thì **nối lại phiên còn sống** (GET `/api/scans/{id}`) để hiện lại mô hình, danh sách số đo và gợi ý size; nếu phiên đã bị dịch vụ xoá thì **số đo vẫn còn** và form mở sẵn để dựng lại bằng một cú bấm. Quét camera thì bỏ id nhưng giữ số. Nút **Nhập lại** xoá cả hai.

Ranh giới có chủ ý: sau khi phiên hết hạn (1 giờ, hoặc backend khởi động lại) việc tải lại trang khôi phục **số đo**, không khôi phục mô hình. Không tự POST dựng phiên mới mỗi lần mở trang, vì như vậy chỉ cần mở một trang là sinh job và file GLB.

Phần "sửa số đo sau khi tạo model" **đã có sẵn** (nút `Sửa số đo`), nên việc bổ sung ở đây là nửa "lưu" của yêu cầu.

### 6.3 Hai lỗi thật đã phát hiện và sửa

1. **`Nhập lại` không xoá được phiên.** `FitExperience` giữ hai chiều đồng bộ giữa hook cục bộ và `ScanContext`; trong lúc reset, chiều "context → local" đẩy lại phiên vừa bị xoá vào ngay, nên màn hình kết quả không bao giờ biến mất. Đã chặn bằng cờ `resetting` cho cả hai chiều trong lúc reset (`handleReset`, `handleResetFullBody`). Lỗi này có từ trước, chỉ khó gặp trong modal cho tới khi tính năng lưu số đo làm modal luôn mở bằng một phiên đã khôi phục.
2. **Tranh chấp khi khôi phục.** Phản hồi khôi phục có thể về **sau** khi người dùng bấm `Nhập lại`, dựng lại phiên cũ. Đã kiểm tra lại `localStorage` sau khi fetch xong: nếu id đã đổi thì bỏ qua phản hồi (storage là nguồn sự thật).

### 6.4 Đổi tên thương hiệu MORPH → FITY

Phạm vi: **chỉ chữ hiển thị cho người dùng**. `MORPH STUDIO` → `FITY STUDIO`, `MORPH AI` → `FITY AI` (giữ nguyên cấu trúc logo hai tông `FITY<span>STUDIO</span>`), gồm: metadata/tiêu đề trang, header, footer, storefront, `ScanResult`, `ProductDetail`, trang `/scan`, giỏ hàng, thanh toán, đơn hàng, dữ liệu sản phẩm (`catalog_data.json`, `catalog.ts`), tiêu đề FastAPI, docstring các module, comment đầu file CSS, tiêu đề cửa sổ `start-all.bat`/`stop-all.bat`, tên cấu hình trong `.vscode/launch.json`.

Cố ý **giữ nguyên** (đã nêu rõ khi hỏi): biến môi trường `MORPH_REVIEW`, `MORPH_QA_SKIP_BUILD`, `MORPH_ORDERS_DB`; tên package `morph-ai-frontend`; khoá `localStorage` `morph-demo-cart-v1/v2` và `morph-demo-wishlist-v1`; `thread_name_prefix="morph-scan"`; và các định danh **nói về biến dạng hình học chứ không phải thương hiệu**: `morphCoord`, `morphSkin`, `morphFabric`, cache key `morph-studio-bodysuit-v1` trong `BodyViewer.tsx` (đổi nhầm sẽ làm hỏng shader).

Chưa đổi (ngoài phạm vi đã chọn): toàn bộ `*.md`, `.impeccable/design.json`, `design/scan-reference.prompt.txt`. Lưu ý `HUONG_DAN_CHAY.md` dòng 58 vẫn ghi tên cấu hình `MORPH Backend (FastAPI)` — tên này vừa đổi trong `.vscode/launch.json` nên tài liệu đó lệch thêm một chỗ (trước đó đã lệch vì trỏ `D:\MORPH-AI`).

### 6.5 Một cái bẫy hạ tầng: hai backend dùng chung `backend/data`

`cleanup()` cố ý xoá mọi `.glb` không có phiên tương ứng trong bộ nhớ (đúng cho việc khởi động lại, nhưng **phá hoại khi có hai server cùng sống**). Khi chạy QA trong lúc backend của người dùng vẫn mở ở cổng 8000, janitor của backend kia đã xoá file mô hình của phiên QA → `GET /model` trả 404 dù job vẫn `completed`. Đã thêm `MORPH_DATA_DIR` (mặc định vẫn là `backend/data`) và harness QA dùng thư mục riêng `.cache/manual-qa-data`. Đây cũng là điều cần biết khi chạy song song dev và QA.

### 6.6 Kiểm tra đã chạy (bổ sung)

- Backend: **72 passed** (`pytest backend/tests`).
- Frontend: `npx tsc --noEmit` sạch; `next build --webpack` pass.
- Browser thật: **35/35 check pass** (trước là 30). Check mới: 12 ô đều `step=1`; thương hiệu hiện `FITY` và **không còn chuỗi `MORPH`** trên trang; **tải lại trang khôi phục đúng số đo đã lưu (170/90/35/54/78) và dựng lại avatar** (31 826 px); form mở lại đúng số đã lưu; ảnh mới `manual-restored-after-reload.png`.
- Một check cũ phải cập nhật: khối modal nay mở bằng phiên đã khôi phục nên harness phải bấm `Nhập lại` trước khi kiểm tra tạo mới từ trang sản phẩm — chính bước này đã lộ ra lỗi 6.3.1.

---

## 7. Chỉnh số đo & đối chiếu độ chính xác (13/10/2026)

### 7.1 Có gì mới

Sau khi mô hình 3D được dựng, màn hình kết quả có thêm hai khối (mục `.scan-eval`, đặt ngay dưới gợi ý size):

- **Chỉnh số đo** — thanh trượt cho 8 vòng mà engine thật sự nắn được (ngực/eo/mông/cổ/đầu/đùi/bắp chân/cổ chân) + ô số, nút **Cập nhật mô hình** và **Về số gốc**. Dải trượt lấy từ dịch vụ nên kéo trong dải luôn dựng được.
- **Đối chiếu với mô hình 3D** — mỗi dòng: số **gốc** | số **mô hình 3D** | **lệch** | **%**, kèm nhãn cho biết số mô hình là vòng đã khớp theo số nhập hay là phần mẫu giữ nguyên.

Cả hai khối có mặt cho **mọi phiên đã dựng xong**, kể cả phiên từ camera: số ước lượng từ ảnh trở thành số gốc, sửa rồi bấm Cập nhật sẽ dựng lại bằng pipeline số đo sẵn có.

### 7.2 Số "mô hình 3D" lấy từ đâu (không phải số người dùng)

- Vòng đã khớp: `body_profile.sections[].model_cm` — engine **đo lại mặt cắt trên lưới đã dựng**, không phải số đã nhập.
- Vòng không nhập nhưng mô hình có (đầu/cổ/đùi/bắp chân/cổ chân khi để trống): `measurement_details[].value_cm` với `source = "template_model"`, cũng đo trên lưới.
- Vòng chỉ để ghi lại (rộng vai, dài tay, inseam): mô hình **không có** → hiện `không có`, `%` là `—`, không bịa giá trị.
- Vòng chỉ mô hình có mà không có số gốc: hiện số mô hình, `%` là `—` (không tính được phần trăm).

`value_cm` của dòng `user_input` (tức số người dùng gõ) **bị bỏ qua có chủ ý** trong bảng so sánh — dùng nó sẽ là lặp lại số nhập rồi gọi đó là số mô hình.

### 7.3 Số gốc (reference) được giữ thế nào

- Số gốc được chốt khi một phiên **bắt đầu**: quét camera, hoặc gửi form nhập số đo từ màn hình bắt đầu.
- Mọi thao tác **chỉnh** mô hình — thanh trượt Cập nhật, hoặc form mở từ nút `Sửa số đo` — **không** đổi số gốc. Đây chính là yêu cầu "giữ số gốc để còn đối chiếu".
- Nút **Nhập lại** xoá cả số gốc lẫn phiên; phiên bắt đầu sau đó là số gốc mới.
- Số gốc lưu cùng phiên trong `localStorage` (`fity-manual-measurements-v1`), nên tải lại trang vẫn còn.
- Lần tải lại trang khôi phục phiên nhưng **không** tự đặt lại số gốc: hàm khôi phục kiểm tra storage sau khi fetch xong nên phản hồi về muộn không đè được.

### 7.4 Endpoint mới

`GET /api/measurements/limits?height_cm=175` → `{height_cm, unit, engine, bands: {chest_cm: {label, base_cm, min_cm, max_cm}, ...}, note}`, `422` ngoài 100–230. Đây đúng là dải ±30–40% mà `validate_measurements()` dùng, nên giá trị trong dải luôn dựng được. `band_ranges()` sinh dữ liệu này và `measurement_limits()` gọi lại nó (giá trị không đổi, có test khẳng định). `band_limits()` bọc `lru_cache(64)` vì đọc file OBJ không rẻ mà thanh trượt hỏi theo từng chiều cao.

### 7.5 Đã sửa trong lúc làm

Lỗi của chính phần này, phát hiện qua test: `saveManualSession()` ghi đè cả object nên **xoá mất số gốc** mỗi lần dựng lại; đã sửa để giữ `reference`.

### 7.6 Giới hạn phải nói đúng

- **Lệch nhỏ không phải là độ chính xác.** Vòng đã khớp thì mô hình được nắn theo đúng số đó, nên lệch ~0 chỉ nghĩa là khớp trúng mục tiêu, không phải mô hình đúng với cơ thể thật. Câu này in ngay trong bảng.
- Phiên từ ảnh: bấm Cập nhật sẽ **dựng lại từ số đo** trên mẫu 3D, nên hình thể có thể khác bản dựng theo đường viền ảnh dù không đổi số nào. Đã ghi rõ trong khối Chỉnh số đo khi phiên là từ ảnh.
- Vẫn **không có SMPL-X/SAM/PyTorch** trong dự án này; engine là MediaPipe Pose Landmarker + biến dạng mẫu MakeHuman. Yêu cầu gốc có nhắc "SMPL-X fitting pipeline" — không tồn tại, nên đã tái dùng engine thật. Muốn đổi engine phải đánh giá checkpoint/license/GPU riêng.
- Một vòng nằm ngoài dải mẫu (có thể gặp ở phiên từ ảnh) sẽ hiện cảnh báo và **chặn** nút Cập nhật, thay vì để dịch vụ từ chối sau một vòng gửi.

### 7.7 Kiểm tra đã chạy

- Backend: **74 passed** (thêm 2 test): endpoint trả đúng dải `measurement_limits()` (và `422` khi thiếu/ngoài chiều cao); một phiên dựng xong **gửi lại chính số của nó** với ngực 104 → phiên mới hoàn tất và **đo lại trên file GLB** đúng 104 cm còn vòng eo không đổi.
- Browser thật: **49/49 check pass** (trước là 35). Check mới: bảng đối chiếu giữ số gốc 96.0 trong khi mô hình 90.0 (lệch 6.0, 6.3%); số chỉ mô hình có thì không có phần trăm; số mô hình không có thì hiện `không có`; thanh trượt đúng dải dịch vụ (51.7–103.4 ở 170 cm); **Cập nhật mô hình dựng lại thật** (chest 102 → danh sách hiện 102.0, viewer vẽ lại 32 535 px); **số gốc vẫn 96.0** sau khi dựng lại; dòng lệch được tô nổi; và một **phiên camera thật** (quét ảnh upper) cũng hiện đủ hai khối, sửa ngực → 95 và số gốc 82.6 giữ nguyên.
- Ảnh: `manual-adjust-accuracy.png`, `camera-adjust-accuracy.png`.

### 7.8 Phát hiện ngoài phạm vi (chưa sửa)

Khi `Nhập lại`, client còn gọi `size-advice` cho phiên vừa xoá và nhận 404 lặp lại (~18 lần trong một lần reset). Nguyên nhân: effect gợi ý size trong `FitExperience` phụ thuộc vào `scanContext` mà giá trị provider **không được memo hoá**, nên effect chạy lại mỗi lần provider render; khi 404 thì `setJobError`/`setAdviceCache` lại gây render. Đây là lỗi có từ trước, không do tính năng này, nhưng gây gọi thừa API. Cách sửa gọn nhất là memo hoá value của `ScanContext.Provider` (hoặc bỏ `scanContext` khỏi dependency), nên làm ở một lần riêng.

---

## 8. Chỉnh số đo trực tiếp trên trình duyệt & báo cáo lệch (13/10/2026)

### 8.1 Đổi gì so với mục 7

Trước đây bấm **Cập nhật mô hình** thì phải chờ dịch vụ dựng lại rồi viewer mới đổi. Giờ **mô hình đổi ngay trên trình duyệt khi kéo**, không cần chạy lại model để thấy kết quả.

- `frontend/lib/bodyPreview.ts` (mới) — biến dạng lưới ở phía trình duyệt, **mô phỏng theo đúng cách engine làm**: cùng mức giải phẫu, cùng quy tắc ghim hệ số của `factor_knots()` (0 / .38 / .84 / .875), cùng ánh xạ ngang `scale_lateral` và cùng mặt nạ độ sâu, rồi tới lượt chân với mặt nạ bám hình dạng và độ mờ ở háng (.46). Nội suy dùng monotone cubic (Fritsch–Carlson) xấp xỉ `PchipInterpolator`. Rig lấy từ chính `body_profile.sections[].points_m` / `measurement_details[].points_m` mà dịch vụ đã đo, nên **không bịa kích thước nào**.
- `BodyViewer.tsx` — nhận `preview={{rig, values}}`, giữ **bản sao vị trí gốc cho từng geometry** (nên biến dạng luôn tính lại từ mô hình đã dựng, không cộng dồn), và **gọi `invalidate()`** — lỗi thật đã gặp: canvas chạy `frameloop="demand"`, sửa attribute của geometry thì React không biết nên **không có gì vẽ lại**; thiếu `invalidate()` thì kéo mà hình đứng yên. Vòng đo và đường đo cũng được biến dạng theo, nếu không chúng sẽ nằm lại trên thân cũ.
- `MeasurementAdjust.tsx` — mỗi vòng có **thanh trượt + nút − / + theo từng 1 cm** và ô số hiện giá trị hiện tại; cập nhật được **gộp về một lần mỗi khung hình** (rAF) vì kéo chuột phát sự kiện nhanh hơn tốc độ biến dạng 13k đỉnh.
- Không còn nút **Cập nhật mô hình**. Số được **gửi đi dựng lại sau khi ngừng tay 700 ms**, và trạng thái hiện rõ: `Đang xem trước…` → `Đang dựng lại mô hình…` → `Đã khớp với mô hình`.
- **Báo cáo lệch được chuyển xuống dưới viewer** (`ScanResult` render `MeasurementAccuracy` sau `.scan-workspace`), thu nhỏ thành báo cáo gọn.
- `useBodyScan.rebuildFromMeasurements()` (mới) — **tạo phiên mới trước, chỉ xoá phiên cũ sau khi phiên mới xong**. Hai lý do: payload bị từ chối thì người dùng vẫn còn mô hình đang xem, và phiên đang hiển thị phải giữ được file GLB để preview có thân mà biến dạng. `FitExperience` giữ `displayJob` (phiên hoàn tất gần nhất) để **vẫn hiện mô hình trong lúc dựng lại**, thay vì nhảy sang màn hình "đang xử lý".

### 8.2 Vì sao vẫn phải dựng lại ở dịch vụ

Preview là **xấp xỉ phía trình duyệt**, không phải engine. Nếu chỉ preview mà không dựng lại thì file GLB tải về sẽ khác thứ đang nhìn thấy — không chấp nhận được. Nên: kéo thì trình duyệt đổi ngay, dừng tay thì dịch vụ dựng lại và mô hình chính thức thay thế preview. Trạng thái `Đã khớp với mô hình` chính là lúc preview đã được trả lại cho mô hình thật.

### 8.3 Lỗi thật đã sửa trong lúc làm

1. **`invalidate()` bị thiếu** (mục 8.1) — kéo thanh trượt mà canvas không vẽ lại.
2. **Nút `Nhập lại` vẫn có thể bị "sống lại" phiên cũ.** Cờ `resetting` được nhả trong `finally`, tức **trước khi** React chạy các effect được bảo vệ, nên một render muộn vẫn đẩy phiên vừa xoá trở lại. Đã thay bằng **tập id đã xoá** (`cleared`): cả hai chiều đồng bộ bỏ qua id đó, dựa trên dữ liệu chứ không dựa vào thời điểm. Harness có check `the onboarding settles after a reset` so **cùng một node DOM sau 400 ms** để chốt việc này.
3. **Ô nhiễm vòng lặp gợi ý size** (đã nêu ở mục 7.8) — đã sửa gốc: memo hoá value của `ScanContext.Provider`, và `resetAdviceCache()` không tạo object mới khi cache đã rỗng (chính việc tạo object mới là thứ nuôi vòng lặp 404).

### 8.4 Kiểm tra đã chạy

- Backend: **74 passed** (không đổi).
- Frontend: `npx tsc --noEmit` sạch; `next build --webpack` pass.
- Browser thật: **55/55 check pass** (trước là 52). Check mới đáng chú ý:
  - `the avatar moves in the browser before any rebuild is sent` — quét vòng eo qua 56…103 và lấy mẫu lưới đã vẽ: **3013 → 3062 → 3101 → 3151 → 3209 → 3235 px**, tăng đơn điệu, và **số lượt POST vẫn là 4** trong suốt quá trình. Đây là bằng chứng trực tiếp rằng trình duyệt tự làm biến dạng.
  - `the stepper moves one centimetre and shows the current value` — 90 → 91.
  - `the deviation report sits below the 3D viewer as a small report` — so sánh trực tiếp vị trí `getBoundingClientRect` của `.scan-accuracy` với `.scan-workspace`.
  - `the preview is handed over to the rebuilt model` — trạng thái chuyển về `Đã khớp`.
  - `the onboarding settles after a reset (no remount churn)`.
- Ảnh: `manual-live-preview.png` (trạng thái đang xem trước).

### 8.5 Lưu ý khi chạy harness

Kéo thanh trượt phát sự kiện nhanh hơn nhịp debounce 700 ms, nên harness **không được lấy mẫu chậm hơn 700 ms một lần**, nếu không sẽ có commit lọt vào giữa phép đo và số đọc thành vô nghĩa. Vì vậy có thêm `canvasInkFast()` (thu nhỏ canvas rồi đếm) và mọi phép so sánh dùng nó trong lúc kéo. Ngoài ra `page.waitForFunction(fn, arg, options)` — options là **đối số thứ ba**.

---

## 9. Bỏ ba ô nhập tay (tự tính), và gộp điều chỉnh vào danh sách số đo (14/10/2026)

### 9.1 Có gì mới

- Form nhập số đo còn **9 ô** (trước 12): bỏ hẳn **Vòng cổ**, **Vòng đầu**, **Vòng cổ chân**. Ba vòng này do **dịch vụ tự tính** từ chiều cao và các số bạn nhập, rồi **được dựng vào mô hình**; trong danh sách kết quả chúng mang nguồn mới `Hệ thống tự tính`. Form có một dòng ghi chú nói rõ điều này.
- **Điều chỉnh nằm ngay trên danh sách số đo**, không còn mục “Chỉnh số đo” riêng phía trên viewer. Mỗi dòng vòng khớp được có nút **− / +** và ô số ngay trên dòng đó; kéo là mô hình trên trình duyệt đổi ngay, dừng tay thì dịch vụ dựng lại (như mục 8). Nút **Về số gốc**, dòng trạng thái (`Đang xem trước…` / `Đang dựng lại mô hình…` / `Đã khớp với mô hình`) và cảnh báo dải nằm ở chân danh sách. Danh sách vẫn bấm được để làm nổi đường đo.
- **Đối chiếu** vẫn ở dưới viewer, giờ nói rõ mục đích (kiểm tra mô hình có dựng đúng số đã nhập không) và hiện cả ba vòng tự tính với nhãn “khớp theo số hệ thống tự tính”.

### 9.2 Số tự tính lấy từ đâu

`derive_supporting_bands()` trong `backend/app/measurements.py`:

- lấy **vòng của chính mẫu 3D** ở mức giải phẫu đó, đã nhân theo chiều cao (vốn đã là một tỷ lệ hợp lý), rồi
- **nhích theo tỷ lệ cơ thể** tính từ các số đã nhập so với mẫu: cổ và đầu theo ngực–eo–mông, cổ chân theo đùi–bắp chân (thiếu thì lấy tỷ lệ thân);
- hệ số mũ đều **< 1** (cổ .55, đầu .20, cổ chân .50) nên giá trị luôn nằm trong dải ±30–40% mẫu dãn được — không bao giờ bị dịch vụ từ chối.

Ở 175 cm (giá trị mẫu đối chiếu: cổ 33.2, đầu 57.2, cổ chân 22.1):

| Nhập | → Cổ | Đầu | Cổ chân |
|---|---|---|---|
| 96/82/100 | 35.0 | 58.3 | 23.2 |
| 84/68/88 (gầy) | 32.3 | 56.6 | 21.5 |
| 104/96/116 (đậm) | 37.5 | 59.8 | 24.7 |
| không nhập gì | 33.2 | 57.2 | 22.1 |

Đầu gần như chỉ phụ thuộc chiều cao nên gần như không đổi. Chỉ điền khi ô đó **trống**: một giá trị được gửi tới (ví dụ bạn kéo ở danh sách) luôn thắng. `profile["derived_bands"]` ghi lại đúng những vòng đã tự tính, để `report.py` gán nguồn `derived` chứ không gọi đó là số bạn nhập.

### 9.3 Kiến trúc

| Thành phần | Thay đổi |
|---|---|
| `backend/app/measurements.py` | `DERIVED_BANDS`, `DERIVED_LABELS`, `DERIVED_FOLLOW`, `DERIVED_SOURCE_BANDS`, `derive_supporting_bands()`, `RECORDED_ONLY_BANDS`, `band_ranges()`, `measurement_limits()` |
| `backend/app/reconstruction.py` | `reconstruct_from_measurements()` dựng `effective = {**values, **derived}`, khớp midline + chân theo `effective`, ghi `profile["derived_bands"]`, thêm cảnh báo; cảnh báo chân chỉ còn nói về đùi/bắp chân |
| `backend/app/report.py` | nguồn `derived` trong `body_source()` và ở nhánh section phụ |
| `backend/app/main.py` | **không đổi**: `/api/scans/manual` vẫn nhận đủ 12 trường, 3 trường `null` nghĩa là tự tính |
| `frontend/components/shop/ManualMeasurements.tsx` | `MANUAL_FIELDS` còn 9 ô; `validateManual()` gửi `neck/head/ankle` là `null`; `AUTO_DERIVED_BANDS`; dòng ghi chú tự tính |
| `frontend/lib/useBandAdjust.ts` | **(mới)** state machine của điều chỉnh (seed, dải hợp lệ, preview gộp theo khung hình, debounce 700 ms, reset) + `shownCm()` + `toInput()` (gửi lại vòng tự tính là `null` trừ khi bạn đã kéo) |
| `frontend/components/shop/ScanResult.tsx` | render điều chỉnh inline trên từng dòng `.scan-row`, bỏ `.scan-eval`; nguồn `derived`; ghi chú nguồn gồm cả vòng tự tính |
| `frontend/components/shop/MeasurementAdjust.tsx` | **đã xoá** |
| `frontend/components/shop/MeasurementAccuracy.tsx`, `frontend/lib/measurementCompare.ts` | cột nhãn cho vòng tự tính, ghi chú mục đích, `ComparisonRow.derived` |
| `frontend/lib/useBodyScan.ts` | `MeasurementDetail["source"]` thêm `"derived"` |
| `frontend/app/scan-result.css`, `frontend/app/capture-flow.css` | `.scan-row*`, `.scan-adjust-foot`, `.manual-derived-note`; bỏ CSS của panel cũ |

Bất biến giữ nguyên: mỗi dòng tự khai nguồn; số “mô hình 3D” vẫn **đo lại từ lưới đã dựng**, không lặp lại số người dùng; số gốc (reference) vẫn không đổi khi chỉnh mô hình.

### 9.4 Kiểm tra đã chạy

- **Backend**: `./backend/.venv/Scripts/python.exe -m pytest backend/tests -q` → **77 passed** (trước 74). Test mới chạy engine thật: đo lại trên chính file GLB đúng ba vòng tự tính (≤1.5 cm); giá trị tự tính tăng theo người gầy→đậm nhưng vẫn nằm trong dải mẫu; số gửi tới thắng số tự tính.
- **Frontend**: `npx tsc --noEmit` sạch; `next build --webpack` pass (29 trang, không đổi tập route).
- **Browser thật** (Chrome headless + production build QA, `verification/scripts/manual-entry-ui.cjs`) → **57/57 check pass**. Đáng chú ý:
  - payload gửi lên mang `neck_cm/head_cm/ankle_cm = null` và 9 số đã nhập; mô hình vẫn dựng ra hình người (31 706 px);
  - ba vòng tự tính hiện `Hệ thống tự tính`; một vòng để trống (đùi/bắp chân) vẫn `Theo mẫu 3D`; các dòng chỉ-ghi-lại vẫn `disabled`;
  - **phiên mới dựng xong thì lệch của ba vòng tự tính là 0.0 / 0.0 / 0.1 cm** — đúng bằng chứng ở tầng UI rằng số tự tính thực sự được render vào mô hình;
  - form 9 ô, mỗi ô `step=1`, không tràn ngang ở 390 px; điều chỉnh inline: bấm + đổi 90 → 91, kéo eo 56→103 đổi lưới trên trình duyệt mà **không gửi POST nào**, sau đó commit dựng lại (ngực 102.0) và **số gốc vẫn 96.0**;
  - phiên camera thật cũng hiện điều chỉnh inline và bảng đối chiếu; sửa ngực → 95, số gốc 82.6 giữ nguyên.
- Ảnh: `verification/manual-entry-20261013/` (đã cập nhật `manual-form-*`, `manual-result-*`, `manual-live-preview.png`, `manual-adjust-accuracy.png`, `camera-adjust-accuracy.png`, `browser-results.json`).
- Chạy lại: `node verification/scripts/manual-entry-ui.cjs` (`MORPH_QA_SKIP_BUILD=1` để dùng lại bundle).
- **Lưu ý harness**: sau khi chạy QA vẫn phải `git checkout -- frontend/next-env.d.ts frontend/tsconfig.tsbuildinfo`.

### 9.5 Giới hạn đã biết

- Ba số tự tính là **tỷ lệ ước lượng theo mẫu**, **không phải số đo của bạn**. Nhãn `Hệ thống tự tính`, dòng ghi chú trong form và cảnh báo trong kết quả đều nói rõ.
- Vì luôn có thêm ba vòng được khớp, một phiên nhập tay **dựng lâu hơn trước một chút**; harness phải chờ trạng thái `Đã khớp` (hoặc số trên bảng đối chiếu) thay vì một mốc thời gian cố định.
- Hai điều chỉnh của chính harness (không phải lỗi sản phẩm, đã ghi lại để không nhầm là hồi quy):
  1. Phép đo “mô hình đổi trên trình duyệt” phải chạy **trong một `page.evaluate`** (đặt giá trị rồi đọc lưới qua vài khung hình). Đọc từ Node có thể chậm hơn nhịp debounce 700 ms và để lọt một commit vào giữa phép đo; thử lại nhiều lần thì sinh thêm POST và chạm **429** của backend.
  2. Khối modal trên trang sản phẩm phải **chờ phần khôi phục từ localStorage đáp xuống** rồi mới quyết định bấm `Nhập lại`; quyết định ngay ở lần vẽ đầu khiến phép khôi phục về muộn thay thế form vừa mở.
- Vẫn chưa hỗ trợ chân lệch, chưa có bắp tay, chưa có SMPL-X/SAM/PyTorch, chưa đối chứng bằng thước dây.
