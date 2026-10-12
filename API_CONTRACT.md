# MORPH AI — Storefront & Sizing API Contract

Tài liệu contract dùng chung giữa Frontend và Backend. Cập nhật ngày: 12/10/2026.

---

## 1. Tổng quan kiến trúc & Endpoint

- **Backend base**: `http://127.0.0.1:8000` (Frontend proxy qua `/api/*` hoặc gọi trực tiếp).
- **Frontend base**: `http://localhost:3000`.

### Danh sách Endpoint chuẩn

| Method | Endpoint | Mô tả | Request | Response |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Kiểm tra trạng thái backend & engine | None | `200 OK`: `{ ready: bool, engine: str, message: str, retention_seconds: int }` |
| `POST` | `/api/capture-check` | Hướng dẫn tư thế và kiểm tra khung camera | `multipart/form-data`: `photo` (file, max 2MB), `view` ("front"\|"side"), `consent` (bool), `capture_mode` ("upper_body"\|"full_body") | `200 OK`: `{ ready: bool, message: str, ... }` |
| `POST` | `/api/scans` | Khởi tạo phiên dựng hình 3D từ 2 ảnh | `multipart/form-data`: `front` (file), `side` (file), `height_cm` (float: 100..230), `consent` (bool), `capture_mode` ("upper_body"\|"full_body") | `202 Accepted`: `Job` object |
| `GET` | `/api/scans/{key}` | Lấy trạng thái xử lý & số đo phiên scan | Path param `key: str` | `200 OK`: `Job` object, `404`: Hết hạn hoặc không tồn tại |
| `GET` | `/api/scans/{key}/model` | Tải file mô hình GLB 3D | Path param `key: str` | `200 OK`: `model/gltf-binary`, `404`: Chưa có hoặc đã hết hạn |
| `GET` | `/api/scans/{key}/measurements`| Tải báo cáo số đo JSON | Path param `key: str` | `200 OK`: JSON file đính kèm |
| `POST` | `/api/scans/{key}/size-advice` | Đối chiếu số đo của phiên scan với bảng size sản phẩm | Body: `SizeChart` JSON | `200 OK`: `SizeAdviceResponse` JSON |
| `DELETE` | `/api/scans/{key}` | Xóa phiên scan & dữ liệu GLB ngay lập tức | Path param `key: str` | `204 No Content` |
| `GET` | `/api/products` | *(Tùy chọn backend)* Danh sách sản phẩm catalog | Query: `category`, `search`, `sort` | `200 OK`: `Product[]` |
| `GET` | `/api/products/{slug}` | *(Tùy chọn backend)* Chi tiết sản phẩm | Path param `slug: str` | `200 OK`: `Product` |

---

## 2. Chi tiết Data Contract

### 2.1 Job Status & Trạng thái xử lý
```typescript
export interface Job {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  stage: string; // Thông điệp tiếng Việt hiển thị cho user (vd: "Đang dựng hình…")
  created: number; // Unix timestamp (s)
  finished: number | null;
  model_url: string | null; // e.g. "/api/scans/{key}/model"
  error: string | null;
  warnings: string[];
  measurements: Record<string, number | null>; // chest_cm, waist_cm, hip_cm (null nếu upper_body), height_cm...
  body_profile: {
    measurement_details?: Record<string, { value_cm: number | null; source: string; confidence?: number }>;
    sections?: Record<string, any>;
  };
  elapsed_seconds: number | null;
}
```

### 2.2 SizeChart Contract (Frontend gửi lên POST `/api/scans/{key}/size-advice`)
```typescript
export interface SizeRange {
  min: number; // ge: 10, le: 250
  max: number; // ge: 10, le: 250, max >= min
}

export interface SizeRow {
  size: string; // min_length: 1, max_length: 20
  chest_cm?: SizeRange | null;
  waist_cm?: SizeRange | null;
  hip_cm?: SizeRange | null;
}

export interface SizeChart {
  name: string;
  garment: "top" | "bottom";
  source: "illustrative" | "user_provided";
  measurement_basis: "body_cm";
  rows: SizeRow[];
}
```

### 2.3 SizeAdviceResponse Contract
```typescript
export interface SizeAdviceResponse {
  status: "matched" | "no_match" | "insufficient_measurements";
  candidates: string[]; // Danh sách size phù hợp (vd: ["L"])
  chart_name: string;
  chart_source: string;
  comparisons: Array<{
    size: string;
    fits: boolean;
    checks: Record<string, { value_cm: number; min_cm: number; max_cm: number; within: boolean }>;
  }>;
  message: string;
  warning: string;
}
```

---

## 3. Quy tắc nguồn gốc số đo (Measurement Provenance)

1. **Chiều cao (`height_cm`)**: Nguồn `user_input`.
2. **Vòng ngực (`chest_cm`), Vòng eo (`waist_cm`)**:
   - `photo_with_prior` khi chụp thân trên (`capture_mode="upper_body"`).
   - `photo_estimate` khi chụp toàn thân (`capture_mode="full_body"`).
3. **Vòng mông (`hip_cm`)**:
   - **Bắt buộc là `null`** trong `measurements` khi `capture_mode="upper_body"`.
   - Nếu `SizeChart` yêu cầu `hip_cm` (ví dụ quần/váy) và scan là `upper_body`, API trả về `status: "insufficient_measurements"` kèm thông báo: *"Chưa đủ số đo để đối chiếu bảng size."*
   - Tuyệt đối không lấy số đo mông từ mesh mẫu MakeHuman gán vào `measurements.hip_cm` để giả mạo camera đo được.
4. **Chiều dài tay (`arm_length_cm`) và đũng quần (`inseam_cm`)**:
   - Giữ `null`, không bịa số.
5. **Vòng mẫu phụ (`template_model`)**:
   - Nằm trong `body_profile.measurement_details` với nhãn nguồn rõ ràng `template_model`.

---

## 4. Phân chia phạm vi và trách nhiệm

- **Agent Frontend (FE)**:
  - Sở hữu: `frontend/`
  - Đảm bảo storefront đa sản phẩm: Trang chủ, danh sách `/products`, chi tiết `/products/[slug]`, giỏ hàng đa biến thể.
  - Sử dụng chung `CaptureSession.tsx` và `FitExperience.tsx` làm module scan mở cho bất kỳ sản phẩm nào.
  - Gợi ý size gọi đúng `POST /api/scans/{key}/size-advice` với bảng size của sản phẩm đó.
  - Tái sử dụng dữ liệu tĩnh từ `frontend/lib/catalog.ts` làm fallback mượt mà nếu backend catalog chưa khởi động.
- **Agent Backend (BE)**:
  - Sở hữu: `backend/`
  - Đảm bảo các endpoint scan & size-advice tuân thủ 100% contract trên.
  - Bổ sung catalog API nhẹ nhàng nếu cần (`GET /api/products`, `GET /api/products/{slug}`) lấy nguồn dữ liệu chuẩn hoặc kiểm thử độc lập.
  - Chạy `pytest` đảm bảo test pass toàn bộ.
- **Agent Điều Phối**:
  - Sở hữu `API_CONTRACT.md` và tài liệu bàn giao chung `STOREFRONT_HANDOFF.md`.
  - Giám sát tiến độ song song, tích hợp E2E, nghiệm thu trình duyệt.
