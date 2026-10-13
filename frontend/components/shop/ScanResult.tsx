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
  LoaderCircle,
  Minus,
  PencilRuler,
  Plus,
  RotateCcw,
  Rotate3D,
  Ruler,
  SlidersHorizontal,
  Sparkles,
  TriangleAlert,
  AlertCircle,
} from "lucide-react";
import type { Job, MeasurementDetail } from "../../lib/useBodyScan";
import type { Product } from "../../lib/catalog";
import type { SizeAdviceResult } from "../../lib/ScanContext";
import type { ManualInput } from "../../lib/useBodyScan";
import type { ReferenceSet } from "../../lib/measurementCompare";
import type { PreviewValues } from "../../lib/bodyPreview";
import type { PreviewState } from "../BodyViewer";
import { FITTED_BANDS } from "../../lib/bandLimits";
import { shownCm, useBandAdjust } from "../../lib/useBandAdjust";
import MeasurementAccuracy from "./MeasurementAccuracy";

const Viewer = dynamic(() => import("../BodyViewer"), {
  ssr: false,
  loading: () => <p className="scan-loading">Đang tải mô hình 3D…</p>,
});

const SOURCE: Record<MeasurementDetail["source"], string> = {
  user_input: "Bạn nhập",
  user_input_unfitted: "Bạn nhập · không dựng vào mô hình",
  derived: "Hệ thống tự tính",
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
  onOpenSizeChart,
  onResetFullBody,
  onEdit,
  reference,
  preview,
  onPreview,
  onAdjust,
  rebuilding,
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
  onOpenSizeChart?: () => void;
  onResetFullBody?: () => void;
  onEdit?: () => void;
  reference?: ReferenceSet | null;
  preview?: PreviewState | null;
  onPreview?: (values: PreviewValues) => void;
  onAdjust?: (values: ManualInput) => void;
  rebuilding?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [rotate, setRotate] = useState(false);
  const [rings, setRings] = useState(true);
  const [mode, setMode] = useState("solid");
  const [reset, setReset] = useState(0);
  const [unit, setUnit] = useState("cm");
  const [selected, setSelected] = useState("");
  const [notice, setNotice] = useState("");

  // The adjustment controls live inline in the measurement list below, so what used to be
  // a panel with its own state is a hook now.
  const adjust = useBandAdjust({
    job,
    reference: reference ?? null,
    onPreview: onPreview ?? (() => {}),
    onCommit: onAdjust ?? (() => {}),
  });
  const adjustable = Boolean(onPreview && onAdjust) && Boolean(adjust.limits);

  const rows = job.body_profile?.measurement_details || [];
  const upper = job.body_profile?.capture_mode === "upper_body";
  // The avatar was fitted to typed numbers, so no photo vocabulary applies here.
  const manual = job.body_profile?.measurement_source === "manual";
  const source = manual ? "Số đo bạn nhập" : upper ? "Webcam thân trên" : "Ảnh toàn thân";
  const value = (m: MeasurementDetail) =>
    m.value_cm == null ? "—" : (m.value_cm / (unit === "in" ? 2.54 : 1)).toFixed(1);
  // Read the note back from what the service actually reported, so it stays true
  // whichever supporting bands the user filled in.
  const fittedLabels = rows.filter((m) => m.source === "user_input" && m.key !== "height_cm").map((m) => m.label);
  const derivedLabels = rows.filter((m) => m.source === "derived").map((m) => m.label);
  const recordedLabels = rows.filter((m) => m.source === "user_input_unfitted").map((m) => m.label);

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
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "fity-body.png";
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
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
            {job.measurements?.height_cm} cm · {source} · Mô hình ước lượng
          </p>
        </div>
        <div className="scan-header-actions">
          {onEdit && (
            <button className="scan-btn-subtle" type="button" onClick={onEdit} disabled={deleting}>
              <PencilRuler size={15} />
              Sửa số đo
            </button>
          )}          <button className="scan-btn-subtle" type="button" onClick={onReset} disabled={deleting}>
            <RotateCcw size={15} />
            {deleting ? "Đang xóa…" : manual ? "Nhập lại" : "Quét lại"}
          </button>
          <button className="scan-btn-subtle" type="button" onClick={fullscreen}>
            <Expand size={15} />
            Toàn màn hình
          </button>
        </div>
      </header>

      <p className="scan-source-note">
        {manual
          ? `Dựng trên mẫu cơ thể 3D có sẵn: ${fittedLabels.join(", ")} khớp đúng số bạn nhập;${
              derivedLabels.length ? ` ${derivedLabels.join(", ")} do hệ thống tự tính theo các số đó;` : ""
            } phần bạn để trống giữ theo mẫu 3D.${recordedLabels.length ? ` ${recordedLabels.join(", ")} chỉ được ghi lại, không dựng vào mô hình.` : ""}`
          : upper
          ? "Không chụp chân. Ngực/eo dựa trên ảnh và tỷ lệ vai–hông giả định; phần đầu, mông và chân theo mẫu 3D."
          : "Ngực/eo/mông ước lượng từ hai ảnh. Các vòng đầu, cổ và chân trích từ mẫu 3D."}{" "}
        {manual ? "Số đo bạn nhập chưa được đối chứng bằng thước dây." : "Chưa kiểm chứng độ chính xác trên người thật."}
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
              <div className="scan-advice-actions" style={{ marginTop: 8 }}>
                <button className="scan-btn-subtle" type="button" onClick={onRetry}>
                  Thử lại
                </button>
                {onOpenSizeChart && (
                  <button className="scan-btn-subtle" type="button" onClick={onOpenSizeChart}>
                    Xem bảng size & chọn thủ công
                  </button>
                )}
              </div>
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
                {manual
                  ? "Bạn chưa nhập vòng mông, mà sản phẩm này cần số đo đó để đối chiếu bảng size."
                  : <>Sản phẩm này là {isBottom ? "quần/váy" : "trang phục"} cần số đo vòng mông. Webcam thân trên chỉ ước
                lượng ngực và eo từ ảnh; không quan sát vòng mông thực tế.</>}
              </p>
              <div className="scan-advice-actions">
                <button
                  className="scan-btn-subtle"
                  type="button"
                  onClick={() => {
                    if (onOpenSizeChart) {
                      onOpenSizeChart();
                    }
                  }}
                >
                  Xem bảng size & chọn thủ công
                </button>
                {onEdit ? (
                  <button className="scan-btn-subtle" type="button" onClick={onEdit} disabled={deleting}>
                    Bổ sung vòng mông
                  </button>
                ) : (
                  <button
                    className="scan-btn-subtle"
                    type="button"
                    onClick={() => {
                      if (onResetFullBody) {
                        onResetFullBody();
                      } else {
                        onReset();
                      }
                    }}
                    disabled={deleting}
                  >
                    Quét lại toàn thân
                  </button>
                )}
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
                  type="button"
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
              {onOpenSizeChart && (
                <div className="scan-advice-actions" style={{ marginTop: 8 }}>
                  <button className="scan-btn-subtle" type="button" onClick={onOpenSizeChart}>
                    Xem bảng size & chọn thủ công
                  </button>
                </div>
              )}
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
                <button key={u} type="button" onClick={() => setUnit(u)} aria-pressed={unit === u}>
                  {u}
                </button>
              ))}
            </div>
          </div>
          <p>Chọn một dòng để làm nổi đường đo tương ứng. Vòng có sẵn thì kéo hoặc bấm ± để chỉnh số ngay tại đây.</p>
          <div className="scan-rows">
            {rows.map((m) => {
              const canAdjust = adjustable && unit === "cm" && (FITTED_BANDS as readonly string[]).includes(m.key);
              const range = canAdjust ? adjust.limits?.bands[m.key] : undefined;
              const shown = adjust.draft[m.key] ?? null;
              const origin = reference?.values?.[m.key];
              const moved =
                canAdjust && typeof origin === "number" && shown != null && Math.abs(shown - origin) > 0.05;
              const bad = canAdjust && adjust.outside.includes(m.key);
              return (
                <div
                  className={`scan-row${selected === m.key ? " selected" : ""}${canAdjust ? " adjustable" : ""}`}
                  key={m.key}
                >
                  <button
                    type="button"
                    className="scan-row-pick"
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
                      <small>
                        {SOURCE[m.source]}
                        {moved && typeof origin === "number" ? ` · gốc ${shownCm(origin)} cm` : ""}
                      </small>
                    </span>
                  </button>
                  {canAdjust && range ? (
                    <div className="scan-row-stepper">
                      <button
                        type="button"
                        className="adjust-step"
                        aria-label={`Giảm ${m.label} 1 cm`}
                        disabled={shown != null && shown <= range.min_cm}
                        onClick={() => adjust.step(m.key, -1)}
                      >
                        <Minus size={13} />
                      </button>
                      <div className="scan-height-input" data-invalid={bad}>
                        <input
                          id={`adjust-${m.key}`}
                          type="number"
                          inputMode="decimal"
                          step="1"
                          min={range.min_cm}
                          max={range.max_cm}
                          value={shownCm(shown) ?? ""}
                          placeholder={String(Math.round(range.base_cm))}
                          aria-label={`${m.label} (cm)`}
                          aria-invalid={bad}
                          onChange={(event) =>
                            adjust.set(m.key, event.target.value === "" ? null : Number(event.target.value))
                          }
                        />
                        <span>cm</span>
                      </div>
                      <button
                        type="button"
                        className="adjust-step"
                        aria-label={`Tăng ${m.label} 1 cm`}
                        disabled={shown != null && shown >= range.max_cm}
                        onClick={() => adjust.step(m.key, 1)}
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  ) : (
                    <b>
                      {value(m)}
                      <small>{m.value_cm != null ? unit : ""}</small>
                    </b>
                  )}
                </div>
              );
            })}
          </div>
          {adjustable && (
            <div className="scan-adjust-foot">
              <div className="adjust-status" role="status">
                {rebuilding ? (
                  <>
                    <LoaderCircle size={13} className="spin" /> Đang dựng lại mô hình…
                  </>
                ) : adjust.changed ? (
                  "Đang xem trước…"
                ) : (
                  "Đã khớp với mô hình"
                )}
              </div>
              <p>
                Kéo số là mô hình trên trình duyệt đổi ngay; số được gửi đi dựng lại sau khi bạn dừng tay. Dải số là
                khoảng <strong>mẫu 3D dãn tới</strong>, không phải khuyến nghị về cơ thể bạn.
              </p>
              {adjust.missingCore && (
                <p className="scan-panel-warn">
                  <TriangleAlert size={14} /> Cần vòng ngực và vòng eo để dựng mô hình.
                </p>
              )}
              {adjust.outside.length > 0 && (
                <p className="scan-panel-warn">
                  <TriangleAlert size={14} /> {adjust.outside.length} số nằm ngoài dải mẫu có thể dựng nên chưa gửi đi
                  dựng lại.
                </p>
              )}
              <button
                className="scan-btn-subtle"
                type="button"
                onClick={adjust.resetToReference}
                disabled={!reference || rebuilding}
              >
                <RotateCcw size={14} /> Về số gốc
              </button>
            </div>
          )}
          <p className="scan-list-foot">
            “Theo mẫu 3D” không phải số đo cơ thể được quan sát hay do bạn nhập. “Hệ thống tự tính” là ba vòng cổ, đầu
            và cổ chân do FITY suy ra từ các số bạn nhập rồi dựng vào mô hình. “Bạn nhập · không dựng vào mô hình” là
            số bạn gõ vào nhưng mô hình 3D không được nắn theo.
          </p>
        </aside>

        <div className="scan-stage">
          <div className="scan-stage-label">
            <b>
              FITY<span> STUDIO</span>
            </b>
            <small>Mô hình ước lượng · tương tác 3D</small>
          </div>
          <div className="scan-tools">
            <button type="button" aria-pressed={rotate} onClick={() => setRotate(!rotate)}>
              <Rotate3D size={15} />
              {rotate ? "Dừng xoay" : "Tự xoay"}
            </button>
            <button
              type="button"
              onClick={() => {
                setReset((n) => n + 1);
                setRotate(false);
              }}
            >
              <RotateCcw size={15} />
              Đặt lại
            </button>
            <button type="button" aria-pressed={rings} onClick={() => setRings(!rings)}>
              <Ruler size={15} />
              Đường đo
            </button>
            <button
              type="button"
              onClick={() => setMode(mode === "solid" ? "points" : mode === "points" ? "wire" : "solid")}
            >
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
                preview={preview ?? null}
              />
            </Boundary>
          )}
          <p className="scan-stage-help">Kéo để xoay · Cuộn hoặc chụm để phóng to</p>
        </div>
      </div>

      {/* The deviation report, kept below the viewer as a small report. */}
      <MeasurementAccuracy job={job} reference={reference ?? null} unit={unit} />

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
            <button type="button" onClick={copy} className="scan-btn-subtle">
              <Copy size={15} />
              Sao chép JSON
            </button>
            <button type="button" onClick={snapshot} className="scan-btn-subtle">
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
        <summary>Cách dựng hình & Giới hạn công nghệ</summary>
        {job.warnings?.map((w) => (
          <p key={w}>{w}</p>
        ))}
        <p>
          Mô hình không tái tạo khuôn mặt và chưa mô phỏng quần áo. Các vòng đo mẫu được cắt ngang tại mức giải phẫu giả
          định; chưa dùng cho may đo thủ công.
        </p>
      </details>
    </div>
  );
}
