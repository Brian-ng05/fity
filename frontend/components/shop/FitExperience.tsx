"use client";
import { useEffect, useState, useCallback } from "react";
import { ArrowRight, Camera, Check, LoaderCircle, PencilRuler, RotateCcw, ScanLine, ShieldCheck, Sun } from "lucide-react";
import { useBodyScan, type Job } from "../../lib/useBodyScan";
import { money, type Product } from "../../lib/catalog";
import { useScan, type SizeAdviceResult } from "../../lib/ScanContext";
import ScanResult from "./ScanResult";
import CaptureSession from "./CaptureSession";
import ManualMeasurements, { draftFromJob, type ManualDraft } from "./ManualMeasurements";

export default function FitExperience({
  product,
  active,
  onSelectSize,
  onOpenSizeChart,
  onClose,
}: {
  product: Product;
  active: boolean;
  onSelectSize: (size: string) => void;
  onOpenSizeChart?: () => void;
  onClose?: () => void;
}) {
  const scanContext = useScan();
  const s = useBodyScan(scanContext.job);
  const [capturing, setCapturing] = useState(false);
  const [entry, setEntry] = useState<"camera" | "manual">("camera");
  const [editingManual, setEditingManual] = useState(false);
  // Keeps the last submitted numbers so a failed or interrupted attempt reopens filled in.
  const [manualDraft, setManualDraft] = useState<ManualDraft | undefined>(undefined);
  const [advice, setAdvice] = useState<SizeAdviceResult | null>(null);
  const [adviceError, setAdviceError] = useState("");
  const [retry, setRetry] = useState(0);

  // Sync active job from local hook to shared ScanContext
  useEffect(() => {
    if (s.job) {
      scanContext.setJob(s.job);
    }
  }, [s.job, scanContext]);

  // Populate local hook with shared ScanContext job if available and not yet loaded
  useEffect(() => {
    if (scanContext.job && !s.job) {
      s.setJob(scanContext.job);
    }
  }, [scanContext.job, s.job, s.setJob]);

  useEffect(() => {
    if (scanContext.jobError) {
      s.setError(scanContext.jobError);
    }
  }, [scanContext.jobError, s.setError]);

  const currentJob: Job | null = s.job || scanContext.job;
  const isBusy = s.busy || currentJob?.status === "queued" || currentJob?.status === "processing";
  // Only a session built from typed measurements can be re-entered as numbers.
  const manualJob =
    currentJob?.status === "completed" && currentJob.body_profile?.measurement_source === "manual" ? currentJob : null;
  // Manual entry needs the template only, so it is not gated on the camera engine.
  const manualReady = Boolean(s.health) && s.health?.engine !== "offline" && s.health?.manual_ready !== false;

  useEffect(() => {
    if (currentJob?.status === "completed") setEditingManual(false);
  }, [currentJob?.status]);

  useEffect(() => {
    if (!active) setCapturing(false);
  }, [active]);

  // Query size advice whenever active job or product changes
  useEffect(() => {
    if (!currentJob || currentJob.status !== "completed") return;

    let aborted = false;
    setAdvice(null);
    setAdviceError("");

    scanContext
      .fetchAdviceForProduct(product, currentJob)
      .then((data) => {
        if (!aborted) {
          if (data.status === "error") {
            setAdviceError(data.message);
            setAdvice(null);
          } else {
            setAdvice(data);
          }
        }
      })
      .catch((err) => {
        if (!aborted) {
          setAdviceError(err?.message || "Chưa đối chiếu được bảng size.");
          setAdvice(null);
        }
      });

    return () => {
      aborted = true;
    };
  }, [currentJob?.id, currentJob?.status, product.id, retry, scanContext, product]);

  const handleReset = useCallback(async () => {
    setManualDraft(undefined);
    setEditingManual(false);
    await s.clear();
    await scanContext.clearScanSession();
  }, [s, scanContext]);

  const handleResetFullBody = useCallback(async () => {
    await s.clear();
    await scanContext.clearScanSession();
    s.setCaptureMode("full_body");
    setCapturing(false);
  }, [s, scanContext]);

  const renderProductContextBar = () => {
    if (!product) return null;
    return (
      <div className="fit-product-context" aria-label={`Sản phẩm đang chọn: ${product.name}`}>
        <div className="fit-product-thumb">
          <img src={product.image} alt={product.name} />
        </div>
        <div className="fit-product-meta">
          <span className="fit-product-category">{product.categoryName} · Tìm size phù hợp cho</span>
          <strong className="fit-product-name">{product.name}</strong>
        </div>
        <div className="fit-product-price">
          <span>{money(product.price)}</span>
        </div>
      </div>
    );
  };

  if (currentJob && currentJob.status === "completed" && !editingManual) {
    return (
      <div className="fit-experience">
        {renderProductContextBar()}
        <ScanResult
          job={currentJob}
          active={active}
          onReset={handleReset}
          onResetFullBody={handleResetFullBody}
          deleting={s.deleting}
          onSelectSize={onSelectSize}
          onOpenSizeChart={onOpenSizeChart}
          advice={advice}
          adviceError={adviceError}
          onRetry={() => setRetry((n) => n + 1)}
          error={s.error || scanContext.jobError}
          product={product}
          onEdit={
            manualJob
              ? () => {
                  // The entry mode may have been reset by a remount (product modal):
                  // switching to the measurements form must not land on the camera panel.
                  s.setError("");
                  scanContext.setJobError("");
                  setEntry("manual");
                  setEditingManual(true);
                }
              : undefined
          }
        />
      </div>
    );
  }

  if (capturing && active) {
    return (
      <div className="fit-experience">
        {renderProductContextBar()}
        <CaptureSession
          mode={s.captureMode}
          onCancel={() => setCapturing(false)}
          onComplete={(pair) => {
            setCapturing(false);
            s.choose("front", pair.front);
            s.choose("side", pair.side);
            void s.scan(pair);
          }}
        />
      </div>
    );
  }

  if (isBusy) {
    return (
      <div className="fit-experience">
        {renderProductContextBar()}
        <div className="scan-processing-screen" role="status">
          <div className="scan-processing-icon">
            <ScanLine size={42} />
            <LoaderCircle size={72} className="spin" />
          </div>
          <h2>{entry === "manual" ? "Đang dựng hình thể từ số đo" : "Đang dựng hình thể của bạn"}</h2>
          <p>{currentJob?.stage || s.job?.stage || scanContext.job?.stage || "Đang gửi hai góc chụp…"}</p>
          <div>
            {entry === "manual" ? (
              <>
                <span>
                  <Check size={16} /> Chiều cao
                </span>
                <span>
                  <Check size={16} /> Các vòng · số đo bổ sung
                </span>
              </>
            ) : (
              <>
                <span>
                  <Check size={16} /> Chính diện
                </span>
                <span>
                  <Check size={16} /> Góc nghiêng 90°
                </span>
              </>
            )}
          </div>
          <p className="scan-processing-note">
            {entry === "manual"
              ? "Số đo đã được gửi. Kết quả sẽ hiện ngay tại đây."
              : "Bạn đã có thể rời camera. Kết quả sẽ hiện ngay tại đây."}
          </p>
          {(s.error || scanContext.jobError) && (
            <div role="alert" style={{ marginTop: 16 }}>
              <p>{s.error || scanContext.jobError}</p>
              <button
                className="shop-secondary"
                type="button"
                onClick={() => {
                  s.setError("");
                  scanContext.setJobError("");
                  s.setPollRetry((n) => n + 1);
                }}
              >
                Kiểm tra kết quả
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const validHeight =
    Number.isFinite(Number(s.height)) && Number(s.height) >= 100 && Number(s.height) <= 230;

  return (
    <div className="fit-experience">
      {renderProductContextBar()}
      <section className="scan-onboarding">
        <div className="scan-intro">
          <div className="scan-intro-icon">
            {entry === "manual" ? <PencilRuler size={27} /> : <ScanLine size={27} />}
          </div>
          <h1>{entry === "manual" ? "Nhập số đo của bạn." : "Tìm size từ hình thể của bạn."}</h1>
          <p>
            {entry === "manual" ? (
              <>
                Có thước dây? Nhập chiều cao, các vòng và số đo bổ sung để MORPH dựng hình thể 3D trên mẫu có sẵn và đối
                chiếu size cho <strong>{product.name}</strong>.
              </>
            ) : (
              <>
                Chỉ cần camera và chiều cao. MORPH tự chụp hai góc, dựng hình thể 3D và giúp bạn đối chiếu size cho{" "}
                <strong>{product.name}</strong>.
              </>
            )}
          </p>
        </div>
        <div className="scan-entry-switch" role="group" aria-label="Cách nhập hình thể">
          <button type="button" aria-pressed={entry === "camera"} onClick={() => setEntry("camera")}>
            <Camera size={16} />
            Quét bằng camera
          </button>
          <button
            type="button"
            aria-pressed={entry === "manual"}
            onClick={() => {
              s.setError("");
              scanContext.setJobError("");
              setEntry("manual");
            }}
          >
            <PencilRuler size={16} />
            Nhập số đo thủ công
          </button>
        </div>
        {entry === "manual" ? (
          <ManualMeasurements
            key={editingManual ? `edit-${currentJob?.id}` : `new-${manualDraft ? "retry" : "blank"}`}
            initial={manualDraft ?? (editingManual ? draftFromJob(currentJob?.status === "completed" ? currentJob.measurements : undefined) : undefined)}
            onSubmit={(values) => {
              setManualDraft(draftFromJob(values));
              // Retire the session being replaced, whichever copy of it is current.
              void s.scanManual(values, currentJob?.id);
            }}
            onCancel={editingManual ? () => setEditingManual(false) : undefined}
            submitting={s.busy || s.deleting}
            error={s.error || scanContext.jobError}
            ready={manualReady}
            notReadyMessage={s.health ? "Dịch vụ dựng hình từ số đo chưa sẵn sàng." : "Đang kết nối dịch vụ dựng hình…"}
          />
        ) : (
          <>
            <ol className="scan-journey">
          <li>
            <span>01</span>
            <div>
              <strong>Nhìn thẳng</strong>
              <p>Đếm ngược và tự chụp chính diện.</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <strong>Xoay người 90°</strong>
              <p>Tự chuyển bước, đếm ngược lần nữa.</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>Xem hình thể & size</strong>
              <p>Nhận kết quả ngay khi xử lý xong.</p>
            </div>
          </li>
        </ol>
        <div className="scan-setup">
          <div className="scan-setup-title">
            <h2>Chuẩn bị trước khi quét</h2>
            <span>Hai góc · Một phiên camera</span>
          </div>
          <div className="scan-setup-fields">
            <label htmlFor="scan-height">
              Chiều cao của bạn
              <div className="scan-height-input">
                <input
                  id="scan-height"
                  type="number"
                  inputMode="decimal"
                  min="100"
                  max="230"
                  step=".1"
                  value={s.height}
                  onChange={(e) => s.setHeight(e.target.value)}
                  aria-invalid={!validHeight}
                />
                <span>cm</span>
              </div>
              {!validHeight && <small>Nhập chiều cao từ 100 đến 230 cm.</small>}
            </label>
            <label htmlFor="scan-framing">
              Khung chụp
              <select
                id="scan-framing"
                value={s.captureMode}
                onChange={(e) => s.setCaptureMode(e.target.value as "upper_body" | "full_body")}
              >
                <option value="upper_body">Webcam · từ đầu đến cạp quần</option>
                <option value="full_body">Camera · toàn thân</option>
              </select>
            </label>
          </div>
          <div className="scan-preparation">
            <Sun size={20} />
            <p>
              Mặc đồ ôm sát, đủ sáng, tay hơi tách thân.{" "}
              {s.captureMode === "upper_body"
                ? "Giữ đầu, vai, eo và cạp quần trong khung; không cần thấy chân."
                : "Giữ đủ đầu và bàn chân trong khung."}
            </p>
          </div>
          <label className="scan-camera-consent">
            <input
              type="checkbox"
              checked={s.consent}
              onChange={(e) => s.setConsent(e.target.checked)}
            />
            <span>
              Tôi đồng ý gửi khung hình và hai ảnh chụp tới máy chủ để hướng dẫn tư thế, ước lượng
              hình thể.
            </span>
          </label>
          <button
            className="shop-primary scan-start"
            type="button"
            disabled={!s.consent || !validHeight || !s.health?.ready || s.deleting}
            onClick={() => {
              s.setError("");
              scanContext.setJobError("");
              setCapturing(true);
            }}
          >
            <Camera size={20} />
            Mở camera & bắt đầu
            <ArrowRight size={18} />
          </button>
          {!s.health?.ready && (
            <p className="scan-service" role="status">
              {s.health ? "Dịch vụ scan chưa kết nối." : "Đang kết nối dịch vụ scan…"}
              {s.health && (
                <button className="shop-inline" type="button" onClick={s.checkHealth}>
                  Thử kết nối lại
                </button>
              )}
            </p>
          )}
          {(s.error || scanContext.jobError) && (
            <p className="fit-error" role="alert">
              {s.error || scanContext.jobError}
            </p>
          )}
          <div className="scan-privacy">
            <ShieldCheck size={16} />
            <p>
              Không lưu hồ sơ ảnh. Upload camera có thể dùng file tạm; kết quả giữ tối đa một giờ và
              có thể xóa sớm.
            </p>
          </div>
        </div>
        <p className="scan-estimate-note">
          {s.captureMode === "upper_body"
            ? "Ngực/eo ước lượng từ ảnh và tỷ lệ mẫu theo chiều cao; phần mông/chân theo mẫu 3D."
            : "Ngực/eo/mông ước lượng từ hai góc chụp."}{" "}
          Chưa kiểm chứng độ chính xác trên người thật; không dùng cho may đo.
        </p>
          </>
        )}
      </section>
    </div>
  );
}
