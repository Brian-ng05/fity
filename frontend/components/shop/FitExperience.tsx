"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Camera, Check, LoaderCircle, PencilRuler, RotateCcw, ScanLine, ShieldCheck, Sun } from "lucide-react";
import { useBodyScan, type Job } from "../../lib/useBodyScan";
import { money, type Product } from "../../lib/catalog";
import { useScan, type SizeAdviceResult } from "../../lib/ScanContext";
import ScanResult from "./ScanResult";
import CaptureSession from "./CaptureSession";
import ManualMeasurements, { draftFromJob, type ManualDraft } from "./ManualMeasurements";
import { clearManualSession, loadManualReference, loadManualSession, saveManualReference, saveManualSession } from "../../lib/manualSession";
import type { ReferenceSet } from "../../lib/measurementCompare";
import { buildPreviewRig, type PreviewValues } from "../../lib/bodyPreview";

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
  // The measurements this session was first built from. Adjustments must not move it, or
  // the comparison would end up measuring the model against itself.
  const [reference, setReference] = useState<ReferenceSet | null>(null);
  // Live browser-side adjustment preview: the rig plus whatever is being dragged.
  const [previewValues, setPreviewValues] = useState<PreviewValues | null>(null);
  // The last finished session, kept rendered while an adjustment rebuild is in flight so
  // the avatar stays on screen (its GLB is still the one the viewer already loaded).
  const [displayJob, setDisplayJob] = useState<Job | null>(null);
  const [rebuilding, setRebuilding] = useState(false);
  const retireAfterRebuild = useRef<string | null>(null);
  // True while a session is being *started* (a scan, or the entry form opened fresh) as
  // opposed to a model being tuned. Only a new session re-baselines the reference; an
  // edit keeps it, which is the whole point of the comparison.
  const newBaseline = useRef(false);

  // The local hook and the shared store mirror each other. During a reset that mirroring
  // would push the session that was just cleared straight back in, so both directions
  // stand down until the reset has finished.
  const resetting = useRef(false);
  // Ids the user has explicitly cleared. The shared store can still hold one for a moment
  // while the reset propagates, and re-adopting it is what made "Nhập lại" look broken.
  // Keyed by id rather than by a timing flag, so a late render cannot resurrect it.
  const cleared = useRef<Set<string>>(new Set());

  // Sync active job from local hook to shared ScanContext
  useEffect(() => {
    if (resetting.current) return;
    if (s.job && !cleared.current.has(s.job.id)) {
      scanContext.setJob(s.job);
    }
  }, [s.job, scanContext]);

  // Populate local hook with shared ScanContext job if available and not yet loaded
  useEffect(() => {
    if (resetting.current) return;
    if (scanContext.job && !s.job && !cleared.current.has(scanContext.job.id)) {
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
  // Manual entry needs the template only, so it is not gated on the camera engine.
  const manualReady = Boolean(s.health) && s.health?.engine !== "offline" && s.health?.manual_ready !== false;

  useEffect(() => {
    if (currentJob?.status === "completed") setEditingManual(false);
  }, [currentJob?.status]);

  // Keep the newest finished session for display, and finish off an adjustment: retire the
  // session it replaced and drop the preview so the authoritative mesh takes over. On a
  // failed rebuild there is nothing to retire — the user keeps the model they had.
  useEffect(() => {
    if (currentJob?.status === "completed") {
      setDisplayJob(currentJob);
      setRebuilding(false);
      setPreviewValues({});
      const retire = retireAfterRebuild.current;
      retireAfterRebuild.current = null;
      if (retire && retire !== currentJob.id) void fetch(`/api/scans/${retire}`, { method: "DELETE" }).catch(() => {});
    } else if (currentJob?.status === "failed") {
      setRebuilding(false);
      retireAfterRebuild.current = null;
    }
  }, [currentJob?.id, currentJob?.status]);

  // Re-open the form on the numbers this browser last sent, so a reload or a return
  // visit does not silently lose what the user typed.
  useEffect(() => {
    const saved = loadManualSession();
    if (saved?.values) setManualDraft((current) => current ?? draftFromJob(saved.values));
    const savedReference = loadManualReference();
    if (savedReference) setReference(savedReference);
  }, []);

  // Baseline a session when one is started, and leave the baseline alone whenever an
  // existing model is tuned: an adjustment, or a restore after a reload, must never move
  // what the comparison is judged against. "Nhập lại" clears it, and the next session
  // started after that becomes the new baseline.
  useEffect(() => {
    if (currentJob?.status === "failed") {
      newBaseline.current = false;
      return;
    }
    if (currentJob?.status !== "completed") return;
    const started = newBaseline.current;
    newBaseline.current = false;
    if (!started && loadManualReference()) return;
    const next: ReferenceSet = {
      values: (currentJob.measurements || {}) as ReferenceSet["values"],
      height_cm: currentJob.measurements?.height_cm,
      origin: currentJob.body_profile?.measurement_source,
    };
    saveManualReference({ values: next.values, height_cm: next.height_cm, origin: next.origin });
    setReference(next);
  }, [currentJob?.id, currentJob?.status]);

  // Remember which session came out of those numbers, so a reload can re-attach to it.
  // Any completed session, camera or manual: a scan-derived model should come back too.
  useEffect(() => {
    if (currentJob?.status !== "completed") return;
    saveManualSession((currentJob.measurements || {}) as Partial<Record<string, number | null>>, currentJob.id);
  }, [currentJob?.id, currentJob?.status]);

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
    resetting.current = true;
    try {
      setManualDraft(undefined);
      setEditingManual(false);
      // "Nhập lại" means start over: forget the saved numbers and the baseline too.
      clearManualSession();
      setReference(null);
      if (currentJob?.id) cleared.current.add(currentJob.id);
      await s.clear();
      await scanContext.clearScanSession();
    } finally {
      resetting.current = false;
    }
  }, [s, scanContext, currentJob?.id]);

  const handleResetFullBody = useCallback(async () => {
    resetting.current = true;
    try {
      if (currentJob?.id) cleared.current.add(currentJob.id);
      await s.clear();
      await scanContext.clearScanSession();
      s.setCaptureMode("full_body");
      setCapturing(false);
    } finally {
      resetting.current = false;
    }
  }, [s, scanContext, currentJob?.id]);

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

  // While an adjustment rebuild is in flight, keep showing the session it is replacing:
  // that GLB is the one the viewer already has, so the live preview still has a body to
  // deform instead of flashing a processing screen or the sample mannequin.
  const shownJob: Job | null =
    currentJob?.status === "completed" ? currentJob : rebuilding ? displayJob : null;
  const previewRig = useMemo(() => buildPreviewRig(shownJob), [shownJob]);

  if (shownJob && !editingManual) {
    return (
      <div className="fit-experience">
        {renderProductContextBar()}
        <ScanResult
          job={shownJob}
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
          preview={previewRig ? { rig: previewRig, values: previewValues } : null}
          onPreview={setPreviewValues}
          rebuilding={rebuilding}
          onAdjust={(values) => {
            // Create the replacement first and retire the old session only once the new
            // model lands, so a refused payload never costs the user their avatar. An
            // adjustment also keeps the baseline: it is the model being tuned, not a new one.
            newBaseline.current = false;
            retireAfterRebuild.current = shownJob.id;
            setRebuilding(true);
            s.setError("");
            scanContext.setJobError("");
            void s.rebuildFromMeasurements(values);
          }}
          onEdit={
            shownJob.status === "completed"
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
          reference={reference}
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
            // A scan starts a session, so its estimates become the new baseline.
            newBaseline.current = true;
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
                Có thước dây? Nhập chiều cao, các vòng và số đo bổ sung để FITY dựng hình thể 3D trên mẫu có sẵn và đối
                chiếu size cho <strong>{product.name}</strong>.
              </>
            ) : (
              <>
                Chỉ cần camera và chiều cao. FITY tự chụp hai góc, dựng hình thể 3D và giúp bạn đối chiếu size cho{" "}
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
              saveManualSession(values);
              // Entering numbers from the onboarding form starts a session; re-entering
              // them from "Sửa số đo" is editing the one on screen and keeps its baseline.
              newBaseline.current = !editingManual;
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
