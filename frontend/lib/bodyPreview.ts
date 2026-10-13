"use client";

import type { Job } from "./useBodyScan";
import { FITTED_BANDS } from "./bandLimits";

/**
 * Browser-side preview of an adjustment, so the avatar moves while the slider moves.
 *
 * This mirrors the shape of the engine's own deformation — the same anatomical levels,
 * the same factor-curve guards, the same lateral map and depth mask — but it is a
 * PREVIEW, not the engine: it is derived from the section outlines the service already
 * measured, and interpolated with our own monotone cubic. The authoritative mesh is
 * always the one the service rebuilds; this only fills the gap while that runs.
 *
 * Everything here works in the GLB's own space: metres, y from 0 to the body height,
 * which is the space the backend deforms in before the viewer rescales it.
 */

/** Same guards as measurements.py: hold the template below the lowest band and above the highest. */
const GUARD_LEVELS = [0.38, 0.84, 0.875];
/** Below this the legs are separate loops; the leg pass fades out here (measurements.py). */
const CROTCH_LEVEL = 0.46;

export type PreviewBand = {
  key: string;
  /** Fraction of body height, as the engine uses it. */
  level: number;
  /** The girth this model currently measures, in cm — the fit's own re-measurement. */
  currentCm: number;
  /** Midline bands: half the section width in metres, used as the lateral map radius. */
  halfWidthM: number;
  /** Depth centre of the section, in metres. */
  centerZM: number;
  /** True for a leg band, whose deformation is radial about its own axis. */
  leg: boolean;
  /** Leg bands only: the loop centre in x and the section's half extents, in metres. */
  axisXM?: number;
  halfXM?: number;
  halfZM?: number;
};

export type PreviewRig = { heightM: number; bands: PreviewBand[] };

export type PreviewValues = Partial<Record<string, number | null>>;

const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), high);

/** np.interp: linear between knots, clamped to the end values outside them. */
function interp(x: number, xs: number[], ys: number[]): number {
  if (!xs.length) return 0;
  if (x <= xs[0]) return ys[0];
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
  let i = 0;
  while (i < xs.length - 2 && x > xs[i + 1]) i++;
  const span = xs[i + 1] - xs[i];
  const t = span === 0 ? 0 : (x - xs[i]) / span;
  return ys[i] + (ys[i + 1] - ys[i]) * t;
}

/**
 * Monotone cubic (Fritsch–Carlson), matching scipy's PchipInterpolator in shape.
 * Endpoint slopes differ slightly from SciPy's one-sided rule; harmless for a preview.
 */
function monotoneCubic(xs: number[], ys: number[]): (x: number) => number {
  const n = xs.length;
  if (n === 0) return () => 1;
  if (n === 1) return () => ys[0];
  const h: number[] = [];
  const delta: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    h[i] = xs[i + 1] - xs[i];
    delta[i] = (ys[i + 1] - ys[i]) / h[i];
  }
  const slope: number[] = new Array(n);
  slope[0] = delta[0];
  slope[n - 1] = delta[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (delta[i - 1] * delta[i] <= 0) slope[i] = 0;
    else {
      const w1 = 2 * h[i] + h[i - 1];
      const w2 = h[i] + 2 * h[i - 1];
      slope[i] = (w1 + w2) / (w1 / delta[i - 1] + w2 / delta[i]);
    }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    const t = (x - xs[i]) / h[i];
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i]
      + (t3 - 2 * t2 + t) * h[i] * slope[i]
      + (-2 * t3 + 3 * t2) * ys[i + 1]
      + (t3 - t2) * h[i] * slope[i + 1];
  };
}

/** Mirror of measurements.py factor_knots(): hold 1 below the lowest and above the highest band. */
function factorKnots(levels: number[], factors: number[]): [number[], number[]] {
  const knots = [0];
  const values = [1];
  if (levels[0] > GUARD_LEVELS[0]) {
    knots.push(GUARD_LEVELS[0]);
    values.push(1);
  }
  knots.push(...levels);
  values.push(...factors);
  const guard = GUARD_LEVELS.find((level) => level > levels[levels.length - 1]);
  if (guard !== undefined) {
    knots.push(guard);
    values.push(1);
  }
  knots.push(1);
  values.push(levels[levels.length - 1] >= GUARD_LEVELS[GUARD_LEVELS.length - 1] ? factors[factors.length - 1] : 1);
  return [knots, values];
}

type Outline = { points_m: [number, number, number][] };

/** Level, centre and extents of one closed section outline, in the GLB's own space. */
function readOutline(points: [number, number, number][], heightM: number) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, sumY = 0, sumZ = 0;
  for (const [x, y, z] of points) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
    sumY += y;
    sumZ += z;
  }
  const count = points.length || 1;
  return {
    level: sumY / count / heightM,
    centerZM: sumZ / count,
    halfWidthM: Math.max((maxX - minX) / 2, 1e-4),
    halfZM: Math.max((maxZ - minZ) / 2, 1e-4),
    axisXM: (minX + maxX) / 2,
    halfXM: Math.max((maxX - minX) / 2, 1e-4),
  };
}

/**
 * Build the preview rig from what the service already reported about this model.
 *
 * A fitted band carries its own re-measured outline in body_profile.sections; a band the
 * user never supplied is annotated from the mesh with source "template_model". Both are
 * real geometry, so the rig never invents a dimension. A band with neither is left out
 * and simply does not move.
 */
export function buildPreviewRig(job: Job | null): PreviewRig | null {
  const heightCm = job?.measurements?.height_cm;
  if (!job || !heightCm) return null;
  const heightM = heightCm / 100;
  const sections = new Map((job.body_profile?.sections || []).map((section) => [section.key, section]));
  const details = new Map((job.body_profile?.measurement_details || []).map((row) => [row.key, row]));
  const bands: PreviewBand[] = [];
  for (const key of FITTED_BANDS) {
    const leg = key === "thigh_cm" || key === "calf_cm" || key === "ankle_cm";
    const section = sections.get(key);
    const detail = details.get(key);
    const outline: Outline | undefined = section ?? (detail?.source === "template_model" ? (detail as Outline) : undefined);
    const currentCm = section ? section.model_cm : detail?.source === "template_model" ? detail.value_cm : null;
    if (!outline || currentCm == null || currentCm <= 0 || outline.points_m.length < 3) continue;
    const shape = readOutline(outline.points_m, heightM);
    bands.push({ key, level: shape.level, currentCm, halfWidthM: shape.halfWidthM, centerZM: shape.centerZM,
      leg, axisXM: shape.axisXM, halfXM: shape.halfXM, halfZM: shape.halfZM });
  }
  return bands.length ? { heightM, bands } : null;
}

/** Flat array of the identity deformation — what a null preview resolves to. */
export function identityPositions(base: Float32Array): Float32Array {
  return Float32Array.from(base);
}

export type Deformer = (x: number, y: number, z: number) => [number, number, number];

/**
 * One point-wise deformation covering both passes, in the engine's own order: the trunk
 * map first, then the leg map evaluated on that result, exactly as fit_leg_targets()
 * sees the fitted mesh. Returns null when there is nothing to preview.
 */
export function makeDeformer(rig: PreviewRig, values: PreviewValues | null | undefined): Deformer | null {
  if (!values || !rig.bands.length) return null;
  // An empty patch means "no preview", so skip the vertex work entirely.
  if (!Object.keys(values).length) return null;
  const h = rig.heightM;
  const factorOf = (band: PreviewBand) => {
    const value = values[band.key];
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? value / band.currentCm : 1;
  };

  const midline = rig.bands.filter((band) => !band.leg).sort((a, b) => a.level - b.level);
  let trunk: ((yFrac: number) => number) | null = null;
  let midlineLevels: number[] = [];
  let midlineEdges: number[] = [];
  let midlineCenters: number[] = [];
  if (midline.length) {
    midlineLevels = midline.map((band) => band.level);
    const [knots, knotValues] = factorKnots(midlineLevels, midline.map(factorOf));
    trunk = monotoneCubic(knots, knotValues);
    midlineEdges = midline.map((band) => band.halfWidthM);
    midlineCenters = midline.map((band) => band.centerZM);
  }

  const legs = rig.bands.filter((band) => band.leg).sort((a, b) => a.level - b.level);
  let legScale: ((yFrac: number) => number) | null = null;
  let legLevels: number[] = [];
  let legAxes: number[] = [];
  let legCenters: number[] = [];
  let legHalfX: number[] = [];
  let legHalfZ: number[] = [];
  if (legs.length) {
    legLevels = legs.map((band) => band.level);
    legScale = monotoneCubic([0, ...legLevels, CROTCH_LEVEL], [1, ...legs.map(factorOf), 1]);
    legAxes = legs.map((band) => band.axisXM ?? 0);
    legCenters = legs.map((band) => band.centerZM);
    legHalfX = legs.map((band) => band.halfXM ?? 0.02);
    legHalfZ = legs.map((band) => band.halfZM ?? 0.02);
  }

  return (x, y, z) => {
    const yFrac = y / h;
    let nx = x;
    let nz = z;
    if (trunk) {
      const scale = trunk(yFrac);
      const edge = Math.max(interp(yFrac, midlineLevels, midlineEdges), 1e-4);
      const weight = clamp((edge * 1.15 - Math.abs(nx)) / (0.025 * h), 0, 1);
      // Same monotone lateral map as scale_lateral(): keeps vertex order near the armpits.
      nx = nx + ((scale - 1) * edge / Math.tanh(1)) * Math.tanh(nx / edge);
      const centerZ = interp(yFrac, midlineLevels, midlineCenters);
      nz = centerZ + (nz - centerZ) * (1 + (scale - 1) * weight);
    }
    if (legScale) {
      const clamped = clamp(yFrac, 0, CROTCH_LEVEL);
      const scale = legScale(clamped);
      // The rig only carries the left loop; the right leg is taken as its mirror.
      const axisX = (nx >= 0 ? 1 : -1) * interp(clamped, legLevels, legAxes);
      const centerZ = interp(clamped, legLevels, legCenters);
      const ax = Math.max(interp(clamped, legLevels, legHalfX), 1e-4);
      const az = Math.max(interp(clamped, legLevels, legHalfZ), 1e-4);
      const inside = Math.hypot((nx - axisX) / ax, (nz - centerZ) / az);
      const weight = clamp((1.25 - inside) / 0.45, 0, 1) * clamp((CROTCH_LEVEL - yFrac) / 0.02, 0, 1);
      const k = 1 + (scale - 1) * weight;
      nx = axisX + (nx - axisX) * k;
      nz = centerZ + (nz - centerZ) * k;
    }
    return [nx, y, nz];
  };
}

/** Deform a copy of `base` with the given deformer. */
export function previewPositions(base: Float32Array, deformer: Deformer): Float32Array {
  const out = Float32Array.from(base);
  for (let i = 0; i < out.length; i += 3) {
    const [x, , z] = deformer(out[i], out[i + 1], out[i + 2]);
    out[i] = x;
    out[i + 2] = z;
  }
  return out;
}

/** Deform one section outline, so the drawn ring follows the previewed body. */
export function previewLoop(points: [number, number, number][], deformer: Deformer): [number, number, number][] {
  return points.map(([x, y, z]) => deformer(x, y, z));
}

/** True when any previewed value differs from what the model currently measures. */
export function previewIsDirty(rig: PreviewRig | null, values: PreviewValues | null | undefined): boolean {
  if (!rig || !values) return false;
  return rig.bands.some((band) => {
    const value = values[band.key];
    return typeof value === "number" && Number.isFinite(value) && Math.abs(value - band.currentCm) > 0.05;
  });
}
