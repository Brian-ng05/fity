# Chất lượng biến dạng của engine khớp số đo — bàn giao

Cập nhật 14/10/2026. Nguồn: `D:\morph3d-ai`. Phạm vi: cải thiện **chính thuật toán biến dạng**
của engine MakeHuman hiện có (dùng chung cho cả đường ảnh `mediapipe-two-photo-fit-*` và đường
nhập tay `measurement-template-fit-*`). **Không** thay mẫu 3D, không thêm SMPL-X/MHR/parametric
model, không đổi framework frontend, không đổi hợp đồng API.

## 1. Kết luận chính — phải nói đúng

Giả thuyết ban đầu (mặt lưới có "gờ" ở đúng các vòng đo vì các trường dọc dùng `np.interp`, chỉ
C0, mà nút của `np.interp` lại **chính là** mức các vòng đo) **không đúng trên mã này**. Đã đo
trên chính lưới xuất ra: độ *tập trung* cong tại đúng mức vòng đo **không lớn hơn** mức nền ngoài
vòng đo. Nói thẳng: triệu chứng "các vòng rời rạc" không đến từ chỗ nội suy.

Điều này quan trọng vì nó chặn một cách sửa nghe rất hợp lý nhưng sai. Cách đo và bảng số ở mục 4.

## 2. Đã rà soát (Phase 1)

Đường đi của dữ liệu, đúng theo mã hiện tại:

| Bước | Ở đâu |
|---|---|
| Đọc/parse OBJ (chỉ nhóm `g body`), chuẩn hoá cao 1 đơn vị, y ∈ [0,1] | `reconstruction.read_template()` |
| Nhân theo chiều cao | `reconstruct_from_measurements()` / `deform_template()` |
| Mức giải phẫu của từng vòng (hệ số của chiều cao) | `measurements.MANUAL_LEVELS` (ngực .698, eo .617, mông .505) + `EXTRA_BANDS` (cổ .855, đầu .94, đùi .405, bắp chân .235, cổ chân .065) |
| Đổi chu vi → nửa rộng/nửa sâu theo giả định elip, giữ tỷ lệ sâu/rộng của **mặt cắt mẫu** | `manual_targets()`, `extra_midline_targets()` |
| Chọn vòng kín của mặt cắt (loại vòng tay/chân rời) | `closed_torso_section()` |
| Fit thân: 3 vòng lặp fitpoint → hệ số `target/đo được`, một đường hệ số theo chiều cao, mặt nạ vùng | `fit_measurement_targets()` |
| Fit từng chân: co giãn hướng tâm quanh trục của chính vòng chân đó | `fit_leg_targets()` |
| Xuất GLB | `mesh.export(...)` trong `reconstruction.py` |

Những gì **không** phải là nguyên nhân (đã loại trừ bằng số liệu, xem mục 4):
các mặt cắt bị "co giãn độc lập" — trong mã này **không** có chuyện đó, đã là một trường liên tục;
nút nội suy bậc 1 tại vòng đo; tâm sâu (`center_z`) bị gãy khúc.

## 3. Đã sửa

| Thay đổi | Ở đâu | Vì sao |
|---|---|---|
| `c1_profile()`: trường dọc là **monotone cubic** (Fritsch–Carlson) có đuôi phẳng, C1 tại mọi nút | `measurements.py` | `np.interp` chỉ C0 và nút của nó đúng bằng mức vòng đo. Đệm thêm một nút cùng giá trị ở mỗi đầu ⇒ đạo hàm hai đầu bằng 0 (giữ nguyên hành vi "ngoài dải đo thì giữ mẫu") mà vẫn C1. Monotone nên không tự tạo bụng giữa hai vòng |
| `smoothstep()` thay `np.clip` cho **mọi** mặt nạ vùng | `measurements.py` | `clip` là ramp bậc 1: đạo hàm nhảy tại mép, in thành gờ đúng nơi mặt nạ bắt đầu/kết thúc |
| Mặt nạ thân–tay mở rộng `0.025·h` → `0.06·h` | `fit_measurement_targets()` | Ramp hẹp 4.4 cm làm gờ ở nách khi hệ số lớn (ngực) |
| Chân: đường hệ số giữ **phẳng phía trên đùi** (bỏ nút ghim ở háng) + độ mờ háng `0.02` → `0.045` có smoothstep | `fit_leg_targets()` | Nút ghim ở háng bắt spline lao từ hệ số đùi về 1 trong ~5.5% chiều cao ⇒ bậc/bụng ở đùi trên. Giờ cả chuyển tiếp nằm trong một smoothstep; **đùi vẫn nhận đủ hệ số** vì ở mức .405 thì `(0.46−0.405)/0.045 ≥ 1` |
| Đổi nhãn phiên bản vì hình học đã đổi | `reconstruction.py` | `ENGINE` v4→**v5**, `MEASUREMENT_ENGINE` v2→**v3**, `measurement_method` nhập tay v2→**v3**. Không code nào phụ thuộc *giá trị* này (chỉ `/api/health` và `/api/measurements/limits` trả về) |

**Thay đổi duy nhất cho kết quả đo được** là phần chân: sai số vòng đùi 2.20 → 1.80 cm,
hồ sơ "challenging" 2.20 → 1.70 cm. Phần còn lại là đúng đắn (C1, mặt nạ không gãy khúc) nhưng
đo ra **trung tính** — xem mục 4. Giữ lại vì không tốn thời gian dựng (0.547 → 0.543 s/phiên) và
không làm gì xấu đi; người review muốn diff tối thiểu có thể bỏ phần thân và giữ phần chân.

## 4. Số liệu trước/sau (8 hồ sơ, lưới đã xuất)

Chạy: `./backend/.venv/Scripts/python.exe verification/scripts/fit-quality.py --json out.json`

| Chỉ số | Trước | Sau |
|---|---|---|
| Sai số fit lớn nhất trên mọi vòng | 2.20 cm | **1.80 cm** |
| `max_fit_error_cm` | 2.25 cm | **1.75 cm** |
| Gờ ở vòng đo / nền — thân, nửa rộng | 0.84 / 0.28 | 1.08 / 0.30 |
| Gờ ở vòng đo / nền — thân, nửa sâu | 1.22 / 0.42 | 1.21 / 0.46 |
| Gờ ở vòng đo / nền — tâm sâu | 0.44 / 0.43 | 0.46 / 0.48 |
| Gờ ở vòng đo / nền — chu vi chân | 1.72 / 0.47 | 1.73 / 0.52 |
| Ổn định (đổi 1 số 0.5 cm → dịch đỉnh lớn nhất) | 0.14 cm | 0.15 cm |
| Lệch khỏi dây cung ở giữa hai vòng | +0.97 / −1.17 cm | +0.96 / −1.16 cm (không đổi) |
| Thời gian dựng 1 phiên nhập tay | 0.547 s | 0.543 s |
| `pytest backend/tests` | 74 | **85** |

**"Gờ ở vòng đo / nền" là gì.** Ở mỗi mức, lấy `|đạo hàm 2|` (cong) tại mẫu đó chia cho cong lớn
nhất của 4 mẫu kề. Nội suy C0 có cong bằng 0 ở mọi nơi **trừ** đúng nút, nên tỉ số rất lớn tại nút;
một đỉnh cong *trơn* (bụng đùi, ngực) trải cong ra nhiều mẫu nên tỉ số ≈ 1. Cột "nền" là trung vị
của cùng tỉ số ở các mức **cách** mọi vòng đo.

Kết luận từ bảng: tỉ số tại vòng đo **nằm trong khoảng dao động của nền** ở cả hai phiên bản
⇒ **không có gờ riêng ở vòng đo**. Vì vậy mục 1 nói giả thuyết ban đầu sai. (Con số tăng nhẹ ở
"thân, nửa rộng" 0.84 → 1.08 nhỏ hơn cả phân vị 90 của nền, 1.44–1.52 — không phải hồi quy.)

Kiểm chứng riêng cho `c1_profile` — nó **thật sự** phân biệt được C0 với C1. Cùng một thử nghiệm
(đạo hàm một phía tại mức vòng, h = 1e-6):

| | .505 | .617 | .698 |
|---|---|---|---|
| `np.interp` (bước nhảy đạo hàm) | 0.357 | **0.728** | 0.370 |
| `c1_profile` | < 1e-3 | < 1e-3 | < 1e-3 |

Đây cũng chính là nội dung `backend/tests/test_fit_quality.py::test_profile_slope_is_continuous_at_every_knot`,
nên hồi quy về C0 sẽ đổ test ngay.

## 5. Đã thử và **loại bỏ**

**Prior hình dạng lấy từ chính mẫu.** Ý tưởng: các vòng đo chỉ ghim cơ thể ở 3–5 mức, phần giữa là
nội suy thuần; dây cung là lựa chọn ít thông tin nhất, còn mẫu là một cơ thể thật nên hình dạng của
nó ở giữa hai vòng là prior dùng được. Đã cài `shape_deviation()` — sai lệch của mẫu so với **dây
cung của chính nó**, bằng 0 tại mọi nút nên **không thể** đổi số vòng đo — với cửa sổ tin cậy dừng
dưới nách (đo được: vòng thân của mẫu bắt đầu lẫn tay từ ~0.72 chiều cao; ở 0.765 nửa rộng nhảy
0.092 → 0.160 và số điểm vòng nhảy 113 → 193).

Kết quả đo, cả ba cách áp:

| Cách áp | Kết quả |
|---|---|
| Nhân vào **trường hệ số**, trong vòng lặp fitpoint | **Hình thể xấu đi rõ.** chest-heavy phình 16.9 → **20.8 cm** ở y=.57 rồi siết còn **11.1 cm** ở eo (dạng thùng + eo sâu hơn). Nguyên nhân: prior đẩy hệ số *giữa* hai vòng, chu vi *tại* vòng đo phản ứng, vòng lặp tăng hệ số tại vòng để bù ⇒ **khuếch đại** đúng cái tương phản cần làm dịu |
| Nhân vào **trường bán kính** | Gần như vô hiệu (đổi 0.05 cm): bán kính chỉ tới bề mặt qua `(scale−1)·radius`, mà gần vòng mông `scale ≈ 1` |
| Áp **sau** vòng lặp | Chưa thử tới cùng; nếu làm phải đo lại vì bản đồ phi tuyến vẫn đổi chu vi ở vòng đo |

⇒ Đã **xoá** `shape_deviation()` và `trunk_profile()` khỏi `backend/app/measurements.py` (không để
lại code chết), và ghi lại kết luận trong docstring của `fit_measurement_targets()`. Đừng thêm lại
nếu chưa sửa được vòng lặp fitpoint.

## 6. Giới hạn đã biết

- **Đùi/bắp chân vẫn vượt 1.5 cm** ở hồ sơ khó (large-thighs 1.80, challenging 1.70) nên trạng thái
  phiên vẫn là `approximate`. Giới hạn thật: mặt nạ háng và cổ chân chỉ cho hệ số tới một mức, và
  một số đo áp cho **cả hai chân**.
- Chỉ số "gờ" là một chỉ số **bằng số**, không phải mắt người. Ngưỡng nền lấy từ chính dữ liệu.
  Chưa so sánh ảnh render ba góc trước/sau; công cụ này không thay được việc nhìn.
- Giả định elip vẫn nguyên: không có ảnh nghiêng thì một chu vi không tách được thành rộng và sâu,
  nên tỷ lệ sâu/rộng **của mẫu** được giữ. Đây là lựa chọn có ghi chú, không phải số đo.
- Phần thân C1/mặt nạ smoothstep đo ra trung tính. Nếu ai muốn diff nhỏ nhất, chỉ cần giữ phần chân.
- `UPPER_BODY_HANDOFF.md` dòng 18 còn ghi engine `mediapipe-two-photo-fit-v4`; tài liệu cũ, chưa sửa
  (theo lệ thông của dự án: ghi lệch ở handoff mới thay vì viết lại handoff cũ).
- Không đụng tới: mô phỏng vải/độ chật, face identity, Mix & Match, thanh toán, deploy.

## 7. Kiểm tra đã chạy

- **Backend**: `./backend/.venv/Scripts/python.exe -m pytest backend/tests -q` → **85 passed**
  (trước 74). Test mới `backend/tests/test_fit_quality.py`: đạo hàm liên tục tại mọi nút; trường
  phẳng và đúng giá trị tại nút; monotone (không vượt); `smoothstep` đạo hàm 0 hai đầu; hệ số đùi
  không bị mất vì độ mờ háng; và sai số từng vòng nằm trong ngưỡng đã ghi (thân ≤ 0.5 cm,
  chân ≤ 2.5 cm) để không ai đổi độ trơn bằng cách phá số đo.
- **Frontend**: `npx tsc --noEmit` sạch; `next build --webpack` pass (không đổi frontend).
- **Browser thật**: `verification/scripts/manual-entry-ui.cjs` (xem kết quả ở lần chạy trong
  `verification/manual-entry-20261013/browser-results.json`).
- Công cụ đo: `verification/scripts/fit-quality.py`.
