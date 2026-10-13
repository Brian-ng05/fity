"use client";

/** The cm range the 3D template can actually be scaled to, per band, at one height.
 *
 *  Comes from the service's own fit guard (`GET /api/measurements/limits`), so a slider
 *  inside this range always builds and a value outside is refused with the band named.
 *  It is a property of the template, not a reference range for a human body.
 */
export type BandRange = { label: string; base_cm: number; min_cm: number; max_cm: number };
export type BandLimits = {
  height_cm: number;
  unit: string;
  engine: string;
  bands: Record<string, BandRange>;
  note: string;
};

/** The bands the fit can shape, in the order the panels show them. */
export const FITTED_BANDS = [
  "chest_cm", "waist_cm", "hip_cm", "neck_cm", "head_cm", "thigh_cm", "calf_cm", "ankle_cm",
] as const;

/** Display names, shared with the entry form so the two never drift apart. */
export const BAND_LABELS: Record<string, string> = {
  chest_cm: "Vòng ngực", waist_cm: "Vòng eo", hip_cm: "Vòng mông", neck_cm: "Vòng cổ",
  head_cm: "Vòng đầu", thigh_cm: "Vòng đùi", calf_cm: "Vòng bắp chân", ankle_cm: "Vòng cổ chân",
};

/** Bands the user can type but the 3D model never carries a measurement for. */
export const RECORDED_BANDS = ["shoulder_width_cm", "arm_length_cm", "inseam_cm"] as const;
export const RECORDED_LABELS: Record<string, string> = {
  shoulder_width_cm: "Rộng vai", arm_length_cm: "Dài tay", inseam_cm: "Dài trong chân",
};

const cache = new Map<number, BandLimits>();

/** null means "not available"; callers must fall back rather than guess a range. */
export async function fetchBandLimits(heightCm: number | null | undefined): Promise<BandLimits | null> {
  if (heightCm == null || !Number.isFinite(heightCm) || heightCm < 100 || heightCm > 230) return null;
  const key = Math.round(heightCm * 10) / 10;
  const hit = cache.get(key);
  if (hit) return hit;
  try {
    const response = await fetch(`/api/measurements/limits?height_cm=${key}`);
    if (!response.ok) return null;
    const data = (await response.json()) as BandLimits;
    cache.set(key, data);
    return data;
  } catch {
    return null;
  }
}
