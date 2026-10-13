"use client";

import type { Job } from "./useBodyScan";
import { BAND_LABELS, FITTED_BANDS, RECORDED_BANDS, RECORDED_LABELS } from "./bandLimits";

/** The measurements a session was originally built from, kept unchanged across adjustments. */
export type ReferenceSet = {
  values: Partial<Record<string, number | null>>;
  height_cm?: number;
  /** "manual" or "photos": how the original session was produced. */
  origin?: string;
};

export type ModelOrigin = "fitted_section" | "mesh_section";

export type ComparisonRow = {
  key: string;
  label: string;
  /** What the user gave us (or the scan estimated) — never recomputed. */
  referenceCm: number | null;
  /** Re-measured from the generated mesh. Never the user's own number echoed back. */
  modelCm: number | null;
  diffCm: number | null;
  /** |model - reference| / reference * 100 */
  percent: number | null;
  /** fitted_section = the avatar was reshaped to this band; mesh_section = template value, measured off the mesh. */
  origin: ModelOrigin | null;
  note?: "no_reference" | "not_in_model";
  significant: boolean;
};

/** The backend's own "matched" threshold (measurements.py), reused so the two agree. */
export const SIGNIFICANT_CM = 1.5;

const numeric = (value: number | null | undefined): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/**
 * Reference vs model, for every band either side has something to say about.
 *
 * The model value is only ever taken from geometry: the fit's own re-measured section
 * (`body_profile.sections[].model_cm`), or a section the report measured off the mesh
 * (`source: "template_model"`). A `user_input` row's `value_cm` is the typed number, so
 * it is deliberately ignored here — using it would just echo the input back as if the
 * model had measured it.
 *
 * A band only the model has is reported with no reference (no percentage is possible),
 * and a band only the reference has is reported as absent from the model. Nothing is
 * invented to fill a gap.
 */
export function buildComparison(job: Job | null, reference: ReferenceSet | null): ComparisonRow[] {
  if (!job) return [];
  const sections = new Map((job.body_profile?.sections || []).map((section) => [section.key, section]));
  const details = new Map((job.body_profile?.measurement_details || []).map((row) => [row.key, row]));
  const rows: ComparisonRow[] = [];
  for (const key of [...FITTED_BANDS, ...RECORDED_BANDS]) {
    const referenceCm = numeric(reference?.values?.[key]);
    const section = sections.get(key);
    const detail = details.get(key);
    let modelCm: number | null = null;
    let origin: ModelOrigin | null = null;
    if (section && numeric(section.model_cm) != null) {
      modelCm = numeric(section.model_cm);
      origin = "fitted_section";
    } else if (detail?.source === "template_model" && numeric(detail.value_cm) != null) {
      modelCm = numeric(detail.value_cm);
      origin = "mesh_section";
    }
    if (referenceCm == null && modelCm == null) continue;
    const diffCm = referenceCm != null && modelCm != null ? Math.abs(modelCm - referenceCm) : null;
    const percent = diffCm != null && referenceCm ? (diffCm / referenceCm) * 100 : null;
    rows.push({
      key,
      label: BAND_LABELS[key] ?? RECORDED_LABELS[key] ?? key,
      referenceCm,
      modelCm,
      diffCm,
      percent,
      origin,
      note: referenceCm == null ? "no_reference" : modelCm == null ? "not_in_model" : undefined,
      significant: diffCm != null && diffCm > SIGNIFICANT_CM,
    });
  }
  return rows;
}

/**
 * The avatar is fitted to the supplied numbers, so a fitted band's difference is the
 * fit residual: near zero means the fit hit the value it was aimed at, not that the
 * avatar matches the person. Evaluated against the untouched reference, it also shows
 * how far an adjustment has moved the model.
 */
export const COMPARISON_NOTE =
  "Sai lệch chỉ so mô hình 3D với chính số đo gốc của phiên này. Vòng đã khớp được nắn theo số bạn nhập nên lệch nhỏ nghĩa là khớp đúng mục tiêu, không phải mô hình đúng với cơ thể thật.";
