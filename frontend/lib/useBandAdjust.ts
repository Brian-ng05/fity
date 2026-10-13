"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Job, ManualInput } from "./useBodyScan";
import { FITTED_BANDS, RECORDED_BANDS, fetchBandLimits, type BandLimits } from "./bandLimits";
import type { ReferenceSet } from "./measurementCompare";
import type { PreviewValues } from "./bodyPreview";

/**
 * The live adjustment of a built avatar's fitted bands.
 *
 * This used to live in its own panel above the viewer. It is a hook now because the
 * controls sit inline in the measurement list, on the very rows they change, rather than
 * in a separate section. Every change is previewed in the browser immediately (see
 * lib/bodyPreview), and the same numbers are sent to the service shortly after they stop
 * changing. The service rebuild stays the authority: the exported model must be the one
 * you can see, so a preview alone is never treated as final.
 */

/** How long the numbers must sit still before the service rebuilds the avatar. */
const COMMIT_DELAY_MS = 700;

const num = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
const round = (value: number) => Math.round(value * 10) / 10;
const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), high);

export type BandAdjust = {
  /** True until the representable range for this height has been fetched. */
  loading: boolean;
  /** Per-band representable range, or null if it could not be read. */
  limits: BandLimits | null;
  /** What each band is set to right now: the model's value, or the value being dragged. */
  draft: Record<string, number | null>;
  /** What the current model actually measures per band, for "gốc" hints and resets. */
  base: Record<string, number | null>;
  set: (key: string, value: number | null) => void;
  step: (key: string, delta: number) => void;
  resetToReference: () => void;
  changed: boolean;
  outside: string[];
  missingCore: boolean;
};

export function useBandAdjust({
  job,
  reference,
  onPreview,
  onCommit,
}: {
  job: Job;
  reference: ReferenceSet | null;
  onPreview: (values: PreviewValues) => void;
  onCommit: (values: ManualInput) => void;
}): BandAdjust {
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

  const submitPatch = useCallback(
    (patch: Record<string, number | null>) => {
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
            commitRef.current(toInput(next, heightCm, currentRef.current));
          }, COMMIT_DELAY_MS);
          return next;
        });
      });
    },
    [heightCm]
  );

  useEffect(
    () => () => {
      if (frame.current != null) cancelAnimationFrame(frame.current);
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const set = useCallback((key: string, value: number | null) => submitPatch({ [key]: value }), [submitPatch]);

  /** One step of the stepper: whole centimetres, never past the range the model can build. */
  const step = useCallback(
    (key: string, delta: number) => {
      const range = limits?.bands[key];
      const current = draft[key] ?? range?.base_cm ?? 0;
      submitPatch({ [key]: clamp(Math.round(current + delta), range?.min_cm ?? 0, range?.max_cm ?? 999) });
    },
    [draft, limits, submitPatch]
  );

  const resetToReference = useCallback(() => {
    if (!reference) return;
    const patch: Record<string, number | null> = {};
    for (const key of FITTED_BANDS) patch[key] = num(reference.values?.[key]);
    submitPatch(patch);
  }, [reference, submitPatch]);

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

  return {
    loading,
    limits,
    draft,
    base: (job.measurements || {}) as Record<string, number | null>,
    set,
    step,
    resetToReference,
    changed,
    outside,
    missingCore,
  };
}

/** Rounded centimetres for a band, or null when it has no value. */
export const shownCm = (value: number | null | undefined) => (value == null ? null : round(value));

/**
 * The full payload for a rebuild: every fitted band, plus the bands only recorded.
 *
 * The bands the service computes itself (neck/head/ankle, see the backend's
 * derive_supporting_bands) are sent as null unless the user actually moved one here, so a
 * rebuild for another band re-derives them from the new build instead of freezing the old
 * numbers. A band the user did move keeps its explicit value, which the service honours.
 */
export function toInput(
  draft: Record<string, number | null>,
  heightCm: number | null,
  current: Record<string, unknown>
): ManualInput {
  const computed = (key: string) => (draft[key] === num(current[key]) ? null : draft[key] ?? null);
  return {
    height_cm: heightCm ?? 0,
    chest_cm: draft.chest_cm as number,
    waist_cm: draft.waist_cm as number,
    hip_cm: draft.hip_cm ?? null,
    neck_cm: computed("neck_cm"),
    head_cm: computed("head_cm"),
    thigh_cm: draft.thigh_cm ?? null,
    calf_cm: draft.calf_cm ?? null,
    ankle_cm: computed("ankle_cm"),
    shoulder_width_cm: draft.shoulder_width_cm ?? null,
    arm_length_cm: draft.arm_length_cm ?? null,
    inseam_cm: draft.inseam_cm ?? null,
  };
}
