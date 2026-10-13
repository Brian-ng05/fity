"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, Minus, Plus, RotateCcw, Sliders, TriangleAlert } from "lucide-react";
import type { Job, ManualInput } from "../../lib/useBodyScan";
import { BAND_LABELS, FITTED_BANDS, RECORDED_BANDS, fetchBandLimits, type BandLimits } from "../../lib/bandLimits";
import type { ReferenceSet } from "../../lib/measurementCompare";
import type { PreviewValues } from "../../lib/bodyPreview";

const num = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const round = (value: number) => Math.round(value * 10) / 10;
const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), high);

/** How long the numbers must sit still before the service rebuilds the avatar. */
const COMMIT_DELAY_MS = 700;

/**
 * Adjust the fitted bands with live sliders.
 *
 * Every change is previewed in the browser immediately (see lib/bodyPreview) so the
 * avatar moves as the slider moves, and the same numbers are sent to the service shortly
 * after they stop changing. The service rebuild stays the authority: the exported model
 * must be the one you can see, so a preview alone is never treated as final.
 */
export default function MeasurementAdjust({
  job,
  reference,
  onPreview,
  onCommit,
  rebuilding,
  error,
}: {
  job: Job;
  reference: ReferenceSet | null;
  onPreview: (values: PreviewValues) => void;
  onCommit: (values: ManualInput) => void;
  rebuilding: boolean;
  error?: string;
}) {
  const [draft, setDraft] = useState<Record<string, number | null>>({});
  const [limits, setLimits] = useState<BandLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const heightCm = num(job.measurements?.height_cm);

  const pending = useRef<Record<string, number | null> | null>(null);
  const frame = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewRef = useRef(onPreview);
  const commitRef = useRef(onCommit);
  previewRef.current = onPreview;
  commitRef.current = onCommit;
  // Read inside the debounced commit without making it depend on them.
  const limitsRef = useRef<BandLimits | null>(null);
  const currentRef = useRef<Record<string, unknown>>({});
  limitsRef.current = limits;
  currentRef.current = (job.measurements || {}) as Record<string, unknown>;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void fetchBandLimits(heightCm).then((data) => {
      if (!alive) return;
      setLimits(data);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [heightCm]);

  // Seed from the numbers this model was actually built from, so dragging starts where
  // the avatar currently is. A new job id means a new build, so the draft re-seeds.
  useEffect(() => {
    const source = (job.measurements || {}) as Record<string, unknown>;
    const next: Record<string, number | null> = {};
    for (const key of [...FITTED_BANDS, ...RECORDED_BANDS]) next[key] = num(source[key]);
    setDraft(next);
    pending.current = null;
    if (timer.current) clearTimeout(timer.current);
    previewRef.current({});
  }, [job.id]);

  const submitPatch = useCallback((patch: Record<string, number | null>) => {
    // Coalesce to one visual update per frame: a drag fires far faster than the browser
    // can usefully deform 13k vertices.
    pending.current = { ...(pending.current ?? {}), ...patch };
    if (frame.current != null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const merged = pending.current;
      pending.current = null;
      if (!merged) return;
      setDraft((current) => {
        const next = { ...current, ...merged };
        previewRef.current(next);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          // Never send a payload the service would reject, and never rebuild for nothing:
          // an unusable or unchanged set simply stays a preview on screen.
          const ranges = limitsRef.current?.bands;
          if (next.chest_cm == null || next.waist_cm == null) return;
          const unusable = FITTED_BANDS.some((key) => {
            const value = next[key];
            const range = ranges?.[key];
            return value != null && range != null && (value < range.min_cm || value > range.max_cm);
          });
          if (unusable) return;
          const moved = FITTED_BANDS.some((key) => next[key] !== num(currentRef.current[key]));
          if (!moved) return;
          commitRef.current(toInput(next, heightCm));
        }, COMMIT_DELAY_MS);
        return next;
      });
    });
  }, [heightCm]);

  useEffect(() => () => {
    if (frame.current != null) cancelAnimationFrame(frame.current);
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const changed = useMemo(() => {
    const source = (job.measurements || {}) as Record<string, unknown>;
    return FITTED_BANDS.some((key) => draft[key] !== num(source[key]));
  }, [draft, job.measurements]);

  const outside = FITTED_BANDS.filter((key) => {
    const value = draft[key];
    const range = limits?.bands[key];
    return value != null && range != null && (value < range.min_cm || value > range.max_cm);
  });
  const missingCore = draft.chest_cm == null || draft.waist_cm == null;
  const usable = Boolean(limits) && !missingCore && outside.length === 0;
  const fromScan = job.body_profile?.measurement_source !== "manual";

  const set = (key: string, value: number | null) => submitPatch({ [key]: value });

  /** One step of the stepper: whole centimetres, never past the range the model can build. */
  const step = (key: string, delta: number) => {
    const range = limits?.bands[key];
    const current = draft[key] ?? range?.base_cm ?? 0;
    const next = clamp(Math.round(current + delta), range?.min_cm ?? 0, range?.max_cm ?? 999);
    set(key, next);
  };

  const resetToReference = () => {
    if (!reference) return;
    const patch: Record<string, number | null> = {};
    for (const key of FITTED_BANDS) patch[key] = num(reference.values?.[key]);
    submitPatch(patch);
  };

  return (
    <section className="scan-adjust" aria-label="Chỉnh số đo và dựng lại mô hình">
      <div className="scan-panel-head">
        <h3>
          <Sliders size={16} /> Chỉnh số đo
        </h3>
        <span className="adjust-status" role="status">
          {rebuilding ? (
            <>
              <LoaderCircle size={13} className="spin" /> Đang dựng lại mô hình…
            </>
          ) : loading ? (
            "Đang tải dải hợp lệ…"
          ) : !limits ? (
            "Chưa tải được dải hợp lệ"
          ) : changed ? (
            "Đang xem trước…"
          ) : (
            "Đã khớp với mô hình"
          )}
        </span>
      </div>

      {fromScan && (
        <p className="scan-panel-note">
          Phiên này dựng từ ảnh. Số đo sẽ <strong>dựng lại mô hình trên mẫu 3D</strong>, nên hình thể có thể khác bản
          dựng theo đường viền ảnh dù bạn không đổi số nào. Số gốc vẫn giữ nguyên để đối chiếu.
        </p>
      )}

      {!loading && !limits && (
        <p className="scan-panel-warn" role="status">
          Không đọc được dải số đo mẫu 3D có thể dựng ở chiều cao này, nên thanh trượt tạm ẩn. Dùng nút “Sửa số đo” để
          nhập đầy đủ.
        </p>
      )}

      {limits && (
        <>
          <div className="adjust-rows">
            {FITTED_BANDS.map((key) => {
              const range = limits.bands[key];
              const value = draft[key];
              const origin = num(reference?.values?.[key]);
              const bad = outside.includes(key);
              const shown = value == null ? null : round(value);
              const position = value == null ? range?.base_cm : clamp(value, range?.min_cm ?? value, range?.max_cm ?? value);
              return (
                <div className={`adjust-row${bad ? " adjust-row-bad" : ""}`} key={key}>
                  <label htmlFor={`adjust-${key}`}>
                    {BAND_LABELS[key]}
                    {origin != null && <small>gốc {round(origin)} cm</small>}
                  </label>
                  <input
                    id={`adjust-${key}-range`}
                    type="range"
                    min={range?.min_cm}
                    max={range?.max_cm}
                    step={1}
                    value={position ?? ""}
                    disabled={!range}
                    aria-label={`${BAND_LABELS[key]} (thanh trượt)`}
                    onChange={(event) => set(key, Number(event.target.value))}
                  />
                  <div className="adjust-stepper">
                    <button
                      type="button"
                      className="adjust-step"
                      aria-label={`Giảm ${BAND_LABELS[key]} 1 cm`}
                      disabled={value != null && range != null && value <= range.min_cm}
                      onClick={() => step(key, -1)}
                    >
                      <Minus size={14} />
                    </button>
                    <div className="scan-height-input" data-invalid={bad}>
                      <input
                        id={`adjust-${key}`}
                        type="number"
                        inputMode="decimal"
                        step="1"
                        min={range?.min_cm}
                        max={range?.max_cm}
                        value={shown ?? ""}
                        placeholder={range ? String(Math.round(range.base_cm)) : ""}
                        onChange={(event) => set(key, event.target.value === "" ? null : Number(event.target.value))}
                      />
                      <span>cm</span>
                    </div>
                    <button
                      type="button"
                      className="adjust-step"
                      aria-label={`Tăng ${BAND_LABELS[key]} 1 cm`}
                      disabled={value != null && range != null && value >= range.max_cm}
                      onClick={() => step(key, 1)}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <small className={bad ? "adjust-bad" : ""}>
                    {bad
                      ? `ngoài dải dựng được (${range?.min_cm}–${range?.max_cm})`
                      : `mẫu dựng được ${range?.min_cm}–${range?.max_cm}`}
                  </small>
                </div>
              );
            })}
          </div>

          <div className="scan-panel-foot">
            <p>
              Kéo là mô hình trên trình duyệt đổi ngay; số được gửi đi dựng lại sau khi bạn dừng tay. Dải số là khoảng{" "}
              <strong>mẫu 3D có thể dãn tới</strong> ở {round(heightCm ?? 0)} cm, không phải khuyến nghị về cơ thể bạn.
            </p>
            <div className="scan-advice-actions">
              <button className="scan-btn-subtle" type="button" onClick={resetToReference} disabled={!reference || rebuilding}>
                <RotateCcw size={14} /> Về số gốc
              </button>
            </div>
          </div>
          {missingCore && (
            <p className="scan-panel-warn">
              <TriangleAlert size={14} /> Cần vòng ngực và vòng eo để dựng mô hình.
            </p>
          )}
          {outside.length > 0 && (
            <p className="scan-panel-warn">
              <TriangleAlert size={14} /> {outside.length} số nằm ngoài dải mẫu có thể dựng nên chưa gửi đi dựng lại. Hãy
              kéo vào khoảng hợp lệ; giá trị ngoài dải sẽ bị dịch vụ từ chối để không âm thầm bóp méo mô hình.
            </p>
          )}
          {error && (
            <p className="fit-error" role="alert">
              {error}
            </p>
          )}
        </>
      )}
    </section>
  );
}

/** The full 12-key payload: the adjusted fitted bands, plus the bands only recorded. */
function toInput(draft: Record<string, number | null>, heightCm: number | null): ManualInput {
  return {
    height_cm: heightCm ?? 0,
    chest_cm: draft.chest_cm as number,
    waist_cm: draft.waist_cm as number,
    hip_cm: draft.hip_cm ?? null,
    neck_cm: draft.neck_cm ?? null,
    head_cm: draft.head_cm ?? null,
    thigh_cm: draft.thigh_cm ?? null,
    calf_cm: draft.calf_cm ?? null,
    ankle_cm: draft.ankle_cm ?? null,
    shoulder_width_cm: draft.shoulder_width_cm ?? null,
    arm_length_cm: draft.arm_length_cm ?? null,
    inseam_cm: draft.inseam_cm ?? null,
  };
}
