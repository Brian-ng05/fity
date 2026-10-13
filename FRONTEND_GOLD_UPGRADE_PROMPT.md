# Nghiệm thu frontend và prompt nâng cấp MORPH

⚠️ DEGRADED: single-context (hai sub-agent review chưa trả đủ báo cáo cuối; tổng hợp dựa trên kiểm tra trực tiếp của agent chính).

Ngày: 13/10/2026. Phạm vi: source hiện tại và ảnh kiểm thử trong `output/playwright/storefront-20261012`. Source thay đổi trong lúc rà soát; đã đọc lại các file chính. Mở localhost qua trình duyệt bị timeout, nên đây là nghiệm thu source và bằng chứng hình ảnh, chưa phải xác nhận chạy lại toàn bộ E2E. Không chỉnh sửa source ứng dụng trong lần review này.

Detector `impeccable detect --json frontend/components/shop` đã chạy, trả `[]`; điều này không xác nhận chất lượng hình ảnh hay hành vi runtime. Không inject overlay, không khởi chạy server review. Questions skipped: yêu cầu gold, bo góc, animation và đầu ra prompt đã rõ.

## Kết luận

Có nền tảng shop 22 sản phẩm, lọc, trang chi tiết, giỏ hàng và luồng scan. Bản kết quả mới đã dùng nền sáng, giữ ngữ cảnh sản phẩm và đưa gợi ý size lên trước mô hình. Chưa nên chốt nghiệm thu UX: ảnh hàng chưa đúng, CTA có vấn đề tương phản, header mobile bị cắt trong ảnh kiểm thử, các trạng thái hết hạn/lỗi và hành động thay thế của scan cần sửa.

### Các phát hiện chính

- Ảnh kiểm thử homepage/mobile: chữ CTA tối trên nền xanh đậm; `.storefront a {color:inherit}` có thể thắng selector CTA. Cần đo computed styles, sửa cascade tận gốc.
- Ảnh mobile 390px: vùng giỏ hàng ở mép phải bị cắt; chỉ kiểm tra document scrollWidth không phát hiện phần tử bị ancestor overflow:hidden che mất.
- Ảnh Essential hiển thị chân dung cận mặt. `catalog.ts` còn dùng ảnh sản phẩm khác làm gallery. Tên, màu và hình ảnh chưa tạo thành bộ sản phẩm nhất quán.
- Header/hero có tuyên bố miễn phí vận chuyển, may đo chính xác/độc quyền, bảo mật tuyệt đối chưa được chứng minh trong demo hiện tại.
- `ScanContext.tsx`: cache chỉ theo product.id; mọi HTTP error và mất mạng đều fallback tính size phía client, bao gồm phiên 404. Thiếu kiểm tra hiệu lực phiên và cơ chế vô hiệu hóa cache theo job/chart.
- `ScanResult.tsx`: nút xem bảng size gọi `onSelectSize("")`; nút quét toàn thân chỉ gọi reset, không chọn full_body. Hành vi không khớp nhãn.
- `FitExperience.tsx`: chỉ đồng bộ job completed lên context; đóng modal trong lúc processing làm mất theo dõi job cục bộ.
- `ProductDetail.tsx`: nhận size từ URL và chỉ kiểm tra không rỗng trước khi thêm giỏ; cần xác thực size thuộc sản phẩm.

## Prompt giao cho agent thực thi

Bạn là agent điều phối nâng cấp MORPH Studio. Hãy trực tiếp sửa project tại D:\MORPH-AI, giữ frontend và backend riêng. Đọc AGENTS.md, frontend/AGENTS.md, DESIGN.md và các handoff hiện tại trước khi sửa. Đây là yêu cầu triển khai, kiểm thử và bàn giao, không chỉ đề xuất thiết kế.

### 1. Mục tiêu thiết kế

Nâng cấp cửa hàng thời trang nhiều sản phẩm và module scan thành một trải nghiệm đồng nhất: nền ivory ấm, vàng gold làm màu nhận diện, góc bo mềm, typography rõ và animation tinh tế. Giữ giao diện tiếng Việt, ưu tiên sản phẩm và thao tác tìm size. Bản kết quả hiện đã sáng; tiếp tục cải thiện bản này, không phục hồi giao diện dark cũ.

### 2. Chạy sub-agent song song

Sau bước kiểm tra nhanh và chốt contract cần thiết, khởi chạy cả hai sub-agent trước bất kỳ lệnh chờ nào:

- FE Visual: sở hữu CSS/tokens, Header, Footer, StorefrontHome, ProductCard, ProductFilter, CartDrawer, WishlistDrawer, ảnh sản phẩm; thực hiện gold theme, bo góc, responsive và motion.
- FE Flow / BE Integration: sở hữu ScanContext, useBodyScan, FitExperience, CaptureSession, ScanResult, ProductDetail và backend nếu thật sự cần; sửa vòng đời scan, lời khuyên size và hành động quay lại sản phẩm.
- Agent điều phối: thống nhất tokens, props/API, điều phối kiểm thử và tích hợp. Bản này thiên về frontend; không tạo backend mới chỉ để phân công công việc.

Hai agent bắt đầu đồng thời và không sửa chung file. Agent Flow thêm class/hook theo tokens đã thống nhất; agent Visual sở hữu styles tương ứng. Thông báo ngay khi đổi props/contract. Có thể dùng fixture trong kiểm thử, nhưng luồng scan bàn giao phải dùng API thật. Chỉ chờ ở các phụ thuộc thật sự và bước tích hợp.

### 3. Hệ màu gold dùng chung

Tạo semantic tokens thay cho tên màu forest/sage cũ. Palette khởi điểm:

- background: #FAF7F0
- surface: #FFFDFA
- surface-muted: #F2EBDD
- primary/gold: #C6A15B
- primary-hover: #B58E45
- primary-soft: #F4E8CC
- text-primary/on-primary: #26211A
- text-secondary: #6B6257
- accent-text: #77551F
- border: #E5DACA

Đo contrast thực tế trước khi chốt. CTA nền gold dùng chữ tối; chữ nhỏ trên nền sáng dùng nâu gold đậm. Không dùng chữ vàng nhạt trên trắng. Gold tập trung ở CTA, trạng thái được chọn, focus và điểm nhấn; không phủ vàng toàn trang hoặc dùng hiệu ứng kim loại bóng quá mức.

Áp dụng cùng hệ màu cho shop, product detail, cart, bảng size, chuẩn bị scan, vỏ camera, processing, kết quả và dữ liệu số đo. Video camera giữ màu gốc. Viewer dùng nền sáng ấm và vật liệu trung tính dễ đọc; giữ màu đường đo có ý nghĩa riêng. Không thay toàn bộ trạng thái lỗi/thành công và mọi đường đo thành gold.

### 4. Bo góc và bố cục

- Tokens radius: control 12px, product card/image 18px, panel 20px, modal/drawer 24px. Pill dành cho chip/badge phù hợp.
- Sửa các cạnh vuông ở CTA, ô chọn size, input/select, thumbnail, khung camera, toolbar và bảng số đo. Clip ảnh theo radius nhưng không cắt focus ring, dropdown hay tooltip.
- Tạo phân cấp rõ bằng khoảng cách và typography; tránh lồng nhiều hộp bo góc.
- Giữ hero gọn để sản phẩm xuất hiện sớm, đặc biệt trên mobile; giảm khối marketing dài cạnh hero.
- Header ở 360/390/768px phải đủ chỗ cho logo và thao tác chính; có thể đưa tìm kiếm/menu vào drawer. Không dùng overflow:hidden để che lỗi layout.
- Vùng chạm tối thiểu 44px, body text khoảng 14–16px, mô tả phụ vẫn đọc được.
- Giữ thanh ngữ cảnh sản phẩm trong scan. Size và CTA áp dụng nằm trước công cụ 3D; công cụ tải file/chi tiết nâng cao có thể thu gọn.

### 5. Motion cụ thể

- Button hover/press: 140–180ms, dịch tối đa 1–2px hoặc scale 0.98; focus rõ.
- Product card: hover ảnh scale tối đa 1.025 trong 220–280ms, không thay kích thước layout.
- Drawer/modal: fade + translate 12–24px trong 220–280ms; có cả exit animation và phục hồi focus khi đóng.
- Chuyển bước chuẩn bị → chính diện → xoay 90° → góc nghiêng → xử lý → kết quả: fade/translate ngắn 180–240ms, giữ vùng thao tác ổn định.
- Countdown có nhịp scale nhẹ theo từng số. Animation chỉ phản ánh state thật; không điều khiển thời điểm chụp và không giả tiến độ xử lý.
- Wishlist/cart có phản hồi nhỏ khi cập nhật, không rung/nảy liên tục.
- Tôn trọng prefers-reduced-motion: bỏ dịch chuyển, scale, stagger và tự xoay không thiết yếu; vẫn giữ phản hồi trạng thái. Dừng animation khi component không hiển thị.
- Ưu tiên opacity/transform và CSS có sẵn. Không thêm thư viện animation lớn nếu không cần; không scroll-jacking/parallax nặng. Không trì hoãn hiển thị sản phẩm để chạy intro.

### 6. Sửa lỗi trước khi bàn giao

Xác minh lại trên source mới nhất vì project có thể tiếp tục được chỉnh sửa:

1. CTA: sửa specificity khiến chữ tối trên nền tối. Kiểm tra cả anchor và button, normal/hover/focus/disabled.
2. Ảnh hàng: thay ảnh chân dung Essential bằng áo đúng loại; không dùng sản phẩm khác làm góc chụp của cùng một món. Đồng bộ ảnh chính, thumbnail, card và giỏ. Nếu chưa có ảnh từng màu, ghi rõ ảnh minh họa màu gốc, không đổi alt để giả rằng ảnh đã đổi màu.
3. Nội dung: bỏ các khẳng định may đo chính xác, độc quyền, bảo mật tuyệt đối và chính sách vận chuyển chưa có thật. Mô tả đúng đây là ước lượng hình thể; giữ nhãn dữ liệu demo và nguồn số đo.
4. Vòng đời scan: cache theo jobId + productId + phiên bản/hash bảng size. Khi phiên hết hạn/404 hoặc bị xóa, vô hiệu hóa kết quả và nhãn gợi ý phụ thuộc. Không fallback thành lời khuyên hợp lệ từ phiên đã mất. Network error có thông báo và retry; không nuốt lỗi. Nếu giữ tính size offline, chỉ dùng phiên còn hiệu lực, hiển thị rõ trạng thái và bảo đảm tương đương thuật toán BE.
5. Đóng modal khi processing: job/polling do shared provider quản lý để mở lại tiếp tục theo dõi; đóng camera luôn dừng media tracks. Phân biệt đóng giao diện với hủy/xóa phiên.
6. “Xem bảng size & chọn thủ công” phải mở đúng bảng size sản phẩm qua callback riêng, không gửi size rỗng. “Quét lại toàn thân” phải thực sự đặt full_body và hiển thị hướng dẫn phù hợp.
7. Xác thực size từ URL/context thuộc product.sizes trước khi chọn/thêm giỏ; khi đổi sản phẩm không mang nhầm size/màu/ảnh của món trước. Người dùng chủ động bấm áp dụng size; không tự thêm giỏ.
8. Modal/drawer: Escape, focus trap, trả focus về nút mở, chặn tương tác nền và quản lý body-scroll đúng cả khi chuyển giữa bảng size và scan.

Giữ camera-only: một phiên camera, chụp chính diện khi tư thế đạt → hướng dẫn xoay 90° → đếm ngược chụp nghiêng → xử lý tự động. Không tái thêm upload hoặc mannequin trước scan. Upper-body không yêu cầu bàn chân; không dùng kích thước mông/chân theo mẫu như số đo camera quan sát.

### 7. Nghiệm thu bằng bằng chứng

- Build/typecheck và kiểm thử liên quan phải chạy thật.
- Chụp desktop 1440×900, laptop 1366×768, mobile 390×844 và kiểm tra chiều rộng 360px.
- Kiểm tra home/catalog, product, cart, size chart, chuẩn bị scan, camera, processing, kết quả, đường quay về sản phẩm.
- Kiểm tra tọa độ/bounding box phần tử tương tác: header không bị cắt dù document không overflow; focus ring và dropdown không bị clip.
- Test camera denied, hủy, mất mạng, 404/hết hạn, scan lại, đóng/mở khi processing, đổi sản phẩm, size URL không hợp lệ, insufficient measurements và no_match.
- Test gold contrast, keyboard-only, reduced-motion và zoom 200%.
- Tách rõ camera fixture trong kiểm thử với chụp người thật. Không tuyên bố đã kiểm chứng độ chính xác cơ thể.
- Assertion phải kiểm tra kết quả thật, không chỉ gán cờ success=true. Lỗi console/pageerror phải được xem xét trước khi ghi pass.
- Cập nhật DESIGN.md và FRONTEND_GOLD_HANDOFF.md: file thay đổi, tokens, motion, cách chạy, checks đã chạy và giới hạn. Báo cáo ảnh trước/sau và các lỗi đã sửa. Hoàn tất triển khai, không dừng ở proposal.
