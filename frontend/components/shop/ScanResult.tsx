"use client";
import dynamic from "next/dynamic";
import { Component, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Box,
  Copy,
  Download,
  Expand,
  Image as ImageIcon,
  RotateCcw,
  Rotate3D,
  Ruler,
  SlidersHorizontal,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import type { Job, MeasurementDetail } from "../../lib/useBodyScan";
import type { Product } from "../../lib/catalog";
import type { SizeAdviceResult } from "../../lib/ScanContext";

const Viewer = dynamic(() => import("../BodyViewer"), {
  ssr: false,
  loading: () => <p className="scan-loading">Đang tải mô hình 3D…</p>,
});

const SOURCE: Record<MeasurementDetail["source"], string> = {
  user_input: "Bạn nhập",
  photo_estimate: "Ước lượng từ ảnh",
  photo_with_prior: "Ảnh + tỷ lệ mẫu",
  template_model: "Theo mẫu 3D",
  unavailable: "Chưa đủ dữ liệu",
};

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p className="scan-loading">Không mở được 3D. Số đo và file tải xuống vẫn khả dụng.</p>
    ) : (
      this.props.children
    );
  }
}

export default function ScanResult({
  job,
  active,
  onReset,
  deleting,
  onSelectSize,
  advice,
  adviceError,
  onRetry,
  error,
  product,
}: {
  job: Job;
  active: boolean;
  onReset: () => void;
  deleting: boolean;
  onSelectSize: (size: string) => void;
  advice: SizeAdviceResult | null;
  adviceError: string;
  onRetry: () => void;
  error: string;
  product?: Product;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [rotate, setRotate] = useState(false);
  const [rings, setRings] = useState(true);
  const [mode, setMode] = useState("solid");
  const [reset, setReset] = useState(0);
  const [unit, setUnit] = useState("cm");
  const [selected, setSelected] = useState("");
  const [notice, setNotice] = useState("");

  const rows = job.body_profile?.measurement_details || [];
  const upper = job.body_profile?.capture_mode === "upper_body";
  const value = (m: MeasurementDetail) =>
    m.value_cm == null ? "—" : (m.value_cm / (unit === "in" ? 2.54 : 1)).toFixed(1);

  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await host.current?.requestFullscreen();
    } catch {
      setNotice("Trình duyệt chưa mở được toàn màn hình. Bạn vẫn có thể kéo và phóng to mô hình.");
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(
          {
            unit: "cm",
            capture_mode: job.body_profile?.capture_mode,
            measurements: job.measurements,
            details: rows,
            warnings: job.warnings,
          },
          null,
          2
        )
      );
      setNotice("Đã sao chép JSON kèm nguồn số đo.");
    } catch {
      setNotice("Không sao chép được. Hãy dùng Tải JSON.");
    }
  }

  function snapshot() {
    const canvas = host.current?.querySelector("canvas");
    if (!canvas) return;
    requestAnimationFrame(() =>
      canvas.toBlob((blob) => {
        if (!blob) {
          setNotice("Không xuất được ảnh 3D.");
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "morph-body.png";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, "image/png")
    );
  }

  const isBottom = product?.chart?.garment === "bottom";

  return (
    <div className="scan-result" ref={host}>
      <header className="scan-result-heading">
        <div>
          <h2>Hình thể 3D của bạn</h2>
          <p>
            {job.measurements?.height_cm} cm · {upper ? "Webcam thân trên" : "Ảnh toàn thân"} · Mô hình ước lượng
          </p>
        </div>
        <div className="scan-header-actions">
          <button className="scan-btn-subtle" onClick={onReset} disabled={deleting}>
            <RotateCcw size={15} />
            {deleting ? "Đang xóa…" : "Quét lại"}
          </button>
          <button className="scan-btn-subtle" onClick={fullscreen}>
            <Expand size={15} />
            Toàn màn hình
          </button>
        </div>
      </header>

      <p className="scan-source-note">
        {upper
          ? "Không chụp chân. Ngực/eo dựa trên ảnh và tỷ lệ vai–hông giả định; phần đầu, mông và chân theo mẫu 3D."
          : "Ngực/eo/mông ước lượng từ hai ảnh. Các vòng đầu, cổ và chân trích từ mẫu 3D."}{" "}
        Chưa kiểm chứng độ chính xác trên người thật.
      </p>

      {/* Prominent Sizing Advice & Call To Action */}
      <section className="scan-size-panel" aria-label="Gợi ý size">
        <div className="scan-size-panel-info">
          <h3>Chọn size cho {product?.name || "sản phẩm"}</h3>
          <p>
            {isBottom
              ? "Đối chiếu vòng eo và mông của bạn với bảng size của sản phẩm."
              : "Đối chiếu vòng ngực và eo của bạn với bảng size của sản phẩm."}{" "}
            Gợi ý mang tính tham khảo.
          </p>
        </div>

        <div>
          {adviceError ? (
            <div className="scan-advice-nomatch">
              <p role="alert">{adviceError}</p>
              <button className="scan-btn-subtle" onClick={onRetry}>
                Thử lại
              </button>
            </div>
          ) : !advice ? (
            <p role="status">Đang đối chiếu size…</p>
          ) : advice.status === "insufficient_measurements" ? (
            <div className="scan-advice-insufficient">
              <h4>
                <AlertCircle size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />
                Chưa đủ dữ liệu để gợi ý (cần số đo vòng mông)
              </h4>
              <p>
                Sản phẩm này là {isBottom ? "quần/váy" : "trang phục"} cần số đo vòng mông. Webcam thân trên chỉ ước
                lượng ngực và eo từ ảnh; không quan sát vòng mông thực tế.
              </p>
              <div className="scan-advice-actions">
                <button className="scan-btn-subtle" onClick={() => onSelectSize("")}>
                  Xem bảng size & chọn thủ công
                </button>
                <button className="scan-btn-subtle" onClick={onReset}>
                  Quét lại toàn thân
                </button>
              </div>
            </div>
          ) : advice.candidates && advice.candidates.length > 0 ? (
            <div className="scan-advice-success">
              <span className="scan-advice-badge">
                <Sparkles size={16} /> Gợi ý: Size {advice.candidates.join(", ")}
              </span>
              {advice.candidates.map((size) => (
                <button
                  key={size}
                  className="scan-size-apply-btn"
                  onClick={() => onSelectSize(size)}
                >
                  Áp dụng size {size} →
                </button>
              ))}
            </div>
          ) : (
            <div className="scan-advice-nomatch">
              <p>Không có size nào khớp tất cả số đo trong bảng. Bạn hãy xem bảng size hoặc chọn size thủ công.</p>
            </div>
          )}
        </div>
      </section>

      {/* 3D Workspace */}
      <div className="scan-workspace">
        <aside className="scan-measure-list" aria-label="Danh sách số đo">
          <div className="scan-list-title">
            <strong>
              Số đo <small>{rows.length}</small>
            </strong>
            <div className="scan-units" aria-label="Đơn vị">
              {["cm", "in"].map((u) => (
                <button key={u} onClick={() => setUnit(u)} aria-pressed={unit === u}>
                  {u}
                </button>
              ))}
            </div>
          </div>
          <p>Chọn một dòng để làm nổi đường đo tương ứng trên hình thể.</p>
          <div className="scan-rows">
            {rows.map((m) => (
              <button
                key={m.key}
                className={selected === m.key ? "selected" : ""}
                onClick={() => {
                  setSelected(selected === m.key ? "" : m.key);
                  setRings(true);
                }}
                disabled={!m.points_m.length}
                aria-pressed={selected === m.key}
              >
                <i style={{ background: m.color }} />
                <span>
                  {m.label}
                  <small>{SOURCE[m.source]}</small>
                </span>
                <b>
                  {value(m)}
                  <small>{m.value_cm != null ? unit : ""}</small>
                </b>
              </button>
            ))}
          </div>
          <p className="scan-list-foot">“Theo mẫu 3D” không phải số đo cơ thể được camera quan sát.</p>
        </aside>

        <div className="scan-stage">
          <div className="scan-stage-label">
            <b>
              MORPH<span> STUDIO</span>
            </b>
            <small>Mô hình ước lượng · tương tác 3D</small>
          </div>
          <div className="scan-tools">
            <button aria-pressed={rotate} onClick={() => setRotate(!rotate)}>
              <Rotate3D size={15} />
              {rotate ? "Dừng xoay" : "Tự xoay"}
            </button>
            <button
              onClick={() => {
                setReset((n) => n + 1);
                setRotate(false);
              }}
            >
              <RotateCcw size={15} />
              Đặt lại
            </button>
            <button aria-pressed={rings} onClick={() => setRings(!rings)}>
              <Ruler size={15} />
              Đường đo
            </button>
            <button onClick={() => setMode(mode === "solid" ? "points" : mode === "points" ? "wire" : "solid")}>
              <Box size={15} />
              {mode === "solid" ? "Khối đặc" : mode === "points" ? "Điểm 3D" : "Khung lưới"}
            </button>
          </div>

          {active && (
            <Boundary>
              <Viewer
                url={job.model_url}
                wireframe={mode === "wire"}
                points={mode === "points"}
                reset={reset}
                autoRotate={rotate}
                targetHeightCm={job.measurements?.height_cm}
                showRings={rings}
                technical
                annotations={rows}
                selectedMeasurement={selected}
                onSelectView={() => setRotate(false)}
              />
            </Boundary>
          )}
          <p className="scan-stage-help">Kéo để xoay · Cuộn hoặc chụm để phóng to</p>
        </div>
      </div>

      {/* Collapsible Technical Details & Data Export */}
      <details className="scan-technical-details">
        <summary>
          <SlidersHorizontal size={16} /> Bảng số đo chi tiết & Công cụ kỹ thuật
        </summary>
        <div className="scan-technical-content">
          <div className="scan-data-grid">
            {rows.map((m) => (
              <div key={m.key}>
                <span>{m.label}</span>
                <strong>
                  {value(m)}
                  <small>{m.value_cm != null ? unit : ""}</small>
                </strong>
                <small>{SOURCE[m.source]}</small>
              </div>
            ))}
          </div>

          <div className="scan-tech-actions">
            <a href={job.model_url} download className="scan-btn-subtle">
              <Download size={15} />
              Tải file GLB 3D
            </a>
            <a href={`/api/scans/${job.id}/measurements`} download className="scan-btn-subtle">
              <Download size={15} />
              Tải báo cáo JSON
            </a>
            <button onClick={copy} className="scan-btn-subtle">
              <Copy size={15} />
              Sao chép JSON
            </button>
            <button onClick={snapshot} className="scan-btn-subtle">
              <ImageIcon size={15} />
              Xuất ảnh PNG
            </button>
          </div>
        </div>
      </details>

      {(notice || error) && (
        <p role="status" className="scan-result-notice">
          {error || notice}
        </p>
      )}

      <details className="scan-limitations">
        <summary>Cách ước lượng & Giới hạn công nghệ</summary>
        {job.warnings?.map((w) => (
          <p key={w}>{w}</p>
        ))}
        <p>
          Mô hình không tái tạo khuôn mặt và chưa mô phỏng quần áo. Vòng đo mẫu được cắt ngang tại các mức giải phẫu giả
          định; chưa dùng cho may đo thủ công.
        </p>
      </details>
    </div>
  );
}
