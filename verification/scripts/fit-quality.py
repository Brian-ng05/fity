"""Quantitative evaluation of the measurement-fit deformation.

Run with the backend venv from the repo root:

    ./backend/.venv/Scripts/python.exe verification/scripts/fit-quality.py            # table
    ./backend/.venv/Scripts/python.exe verification/scripts/fit-quality.py --json out.json

The report has three parts, all measured on the real exported geometry:

1. CIRCUMFERENCE — target vs the mesh's own re-measured section, per band, per profile.
   This is the accuracy contract; a smoothness change must not move these numbers.
2. CONTINUITY — the longitudinal half-width / depth / leg-radius fields sampled every
   5 mm along the body, scored by their discrete second difference. A C0-only field
   (piecewise linear) puts a spike of curvature exactly at every measurement band; the
   metric is therefore a direct measure of the "separate rings" artefact. Both the peak
   and the 95th percentile are reported, plus the number of derivative sign changes
   (wiggles).
3. STABILITY — the largest vertex displacement caused by a 0.5 cm change to one input,
   so a smoother result cannot come from a less responsive fit.

Nothing here is a claim about a real person: it is the avatar measured against the
numbers it was built from, exactly like the in-app comparison table.
"""
import argparse
import json
import pathlib
import sys
import tempfile
import time

import numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.measurements import (LEG_EXTRA, MANUAL_LEVELS, closed_torso_section)  # noqa: E402
from app.reconstruction import read_template, reconstruct_from_measurements  # noqa: E402

# Bands the viewer/report quote, in the order the panels show them.
TORSO_BANDS = ["chest_cm", "waist_cm", "hip_cm"]
MIDLINE_BANDS = ["neck_cm", "head_cm"]
LEG_BANDS = ["thigh_cm", "calf_cm", "ankle_cm"]

# Levels where a kink would show. The torso window stops below the armpit: further up the
# closed loop changes shape for topological reasons (the arms join it), which would swamp
# the measurement. The leg window stops above the ankle and below the crotch for the same
# reason.
TORSO_TARGET_LEVELS = sorted(MANUAL_LEVELS[key] for key in TORSO_BANDS)
TORSO_WINDOW = (0.47, 0.73)
LEG_TARGET_LEVELS = [0.235, 0.405]
LEG_WINDOW = (0.075, 0.445)

# The eight representative profiles from the task brief.
PROFILES = {
    "slim": {"height_cm": 170, "chest_cm": 84, "waist_cm": 68, "hip_cm": 88, "thigh_cm": 48, "calf_cm": 32},
    "chest-heavy": {"height_cm": 175, "chest_cm": 104, "waist_cm": 76, "hip_cm": 96},
    "broad-hips": {"height_cm": 168, "chest_cm": 88, "waist_cm": 74, "hip_cm": 118},
    "large-thighs": {"height_cm": 175, "chest_cm": 96, "waist_cm": 82, "hip_cm": 104, "thigh_cm": 68, "calf_cm": 36},
    "large-calves": {"height_cm": 175, "chest_cm": 94, "waist_cm": 80, "hip_cm": 100, "thigh_cm": 56, "calf_cm": 46},
    "required-only": {"height_cm": 172, "chest_cm": 92, "waist_cm": 78},
    "all-supplied": {"height_cm": 175, "chest_cm": 96, "waist_cm": 82, "hip_cm": 100, "thigh_cm": 55, "calf_cm": 36,
                     "shoulder_width_cm": 42, "arm_length_cm": 60, "inseam_cm": 80},
    "challenging": {"height_cm": 178, "chest_cm": 106, "waist_cm": 68, "hip_cm": 118, "thigh_cm": 70, "calf_cm": 48},
}


def build(values, destination):
    warnings, measurements, profile = reconstruct_from_measurements(
        {k: v for k, v in values.items() if k != "height_cm"}, values["height_cm"], destination, lambda _m: None)
    return measurements, profile


def band_error(profile):
    """target vs the mesh's own re-measurement, for every fitted band."""
    rows = {}
    for section in profile["sections"]:
        rows[section["key"]] = {
            "target": section["target_cm"],
            "model": section["model_cm"],
            "error": round(abs(section["model_cm"] - section["target_cm"]), 2),
        }
    return rows


def second_difference(values, step):
    """Discrete second derivative, normalised by step^2 so it has curvature units."""
    if len(values) < 3:
        return np.array([0.0])
    return np.abs(np.diff(values, 2)) / (step ** 2)


def sample_torso(mesh, height_cm, low=0.47, high=0.925, step=0.005):
    """Half-width, half-depth and the depth centre of the closed trunk loop.

    The centre matters as much as the extents: it is where the cross-section sits front to
    back, so a kink there tilts whole sections against each other and shows as a crease in
    the side silhouette even when every width is correct.
    """
    h = height_cm / 100
    levels, widths, depths, centres = [], [], [], []
    for level in np.arange(low, high + 1e-9, step):
        try:
            _, curve = closed_torso_section(mesh, level * h)
        except Exception:
            continue
        levels.append(level)
        widths.append(np.ptp(curve[:, 0]) / 2)
        depths.append(np.ptp(curve[:, 2]) / 2)
        centres.append((curve[:, 2].min() + curve[:, 2].max()) / 2)
    return np.asarray(levels), np.asarray(widths), np.asarray(depths), np.asarray(centres)


def sample_leg(mesh, height_cm, low=0.075, high=0.45, step=0.005):
    """Perimeter of one leg's own loop at each level, from above the ankle to the crotch."""
    h = height_cm / 100
    center_x = LEG_EXTRA["calf_cm"][2]
    levels, perimeters = [], []
    for level in np.arange(low, high + 1e-9, step):
        try:
            perimeter_cm, _ = closed_torso_section(mesh, level * h, center_x_m=center_x * h)
        except Exception:
            continue
        levels.append(level)
        perimeters.append(perimeter_cm)
    return np.asarray(levels), np.asarray(perimeters)


def curvature(values, step):
    """|second difference| / step^2, one entry per interior sample."""
    return np.abs(np.diff(values, 2)) / (step ** 2)


def kink_ratio(levels, values, step, reference):
    """How concentrated the curvature is at one level, versus its immediate neighbours.

    A C0-only field is piecewise linear, so its curvature is zero everywhere except at the
    knot, where a single sample carries the whole slope change. A genuinely smooth apex
    (the thigh bulge, the chest) spreads the same total curvature over many samples. So the
    discriminator is the ratio at the level to the largest neighbour, not the curvature
    itself — a large curvature is normal anatomy, a *concentrated* one is the artefact.
    """
    index = int(np.argmin(np.abs(levels - reference)))
    curve = curvature(values, step)
    position = index - 1  # curve[j] is centred on values[j + 1]
    if position < 2 or position > len(curve) - 3:
        return None
    neighbours = max(curve[position - 2], curve[position - 1], curve[position + 1], curve[position + 2])
    if neighbours <= 0:
        return None
    return round(float(curve[position] / neighbours), 2)


def interband_shape(levels, values, bands):
    """How far the profile sits from a straight chord between adjacent bands, at their middle.

    A straight line between two rings is the least informed interpolation available. This
    reports, in cm, how much the surface bulges away from that line halfway between two
    bands — the region where the deformation has no measured target at all.
    """
    out = {}
    for low, high in zip(bands, bands[1:]):
        mid = (low + high) / 2
        i = int(np.argmin(np.abs(levels - mid)))
        a = values[int(np.argmin(np.abs(levels - low)))]
        b = values[int(np.argmin(np.abs(levels - high)))]
        chord = (a + b) / 2
        out[f"{low:.3f}->{high:.3f}"] = {
            "mid_cm": round(float(values[i]) * 100, 3),
            "chord_cm": round(float(chord) * 100, 3),
            "dev_cm": round(float(values[i] - chord) * 100, 3),
            "dev_pct": round(float((values[i] - chord) / chord) * 100, 2) if chord else None,
        }
    return out


def continuity(levels, values, step, bands, window=None):
    """Windowed peak curvature plus the per-band kink concentration and its control."""
    if window is not None:
        inside = (levels >= window[0]) & (levels <= window[1])
    else:
        inside = np.ones(len(levels), dtype=bool)
    windowed = values[inside]
    window_levels = levels[inside]

    if len(windowed) >= 4:
        curve = curvature(windowed, step)
        peak = float(np.max(curve))
        p95 = float(np.percentile(curve, 95))
        peak_level = float(window_levels[min(int(np.argmax(curve)) + 1, len(window_levels) - 1)])
        slope = np.diff(windowed)
        sign_changes = int(np.sum(np.sign(slope)[1:] * np.sign(slope)[:-1] < 0))
    else:
        peak = p95 = peak_level = 0.0
        sign_changes = 0

    at_bands = {}
    for band in bands:
        ratio = kink_ratio(levels, values, step, band)
        if ratio is not None:
            at_bands[round(float(band), 3)] = ratio
    # Control: the same ratio at levels away from every band. Anything at or below the
    # control is ordinary anatomy rather than a crease at a measurement plane.
    control = [kink_ratio(levels, values, step, level) for level in levels[3:-3]
               if min(abs(level - band) for band in bands) > 0.025]
    control = sorted(value for value in control if value is not None)

    return {
        "peak": peak,
        "p95": p95,
        "at": round(peak_level, 3),
        "sign_changes": sign_changes,
        "n": int(len(windowed)),
        "kink_at_bands": at_bands,
        "kink_band_max": max(at_bands.values()) if at_bands else 0.0,
        "kink_control_median": round(control[len(control) // 2], 2) if control else 0.0,
        "kink_control_p90": round(control[int(len(control) * 0.9)], 2) if control else 0.0,
    }


def evaluate(values, destination):
    height_cm = values["height_cm"]
    measurements, profile = build(values, destination)
    # Measure the written GLB: that is the artefact the user actually receives.
    import trimesh

    exported = trimesh.load(destination).to_geometry()
    torso_levels, widths, depths, centres = sample_torso(exported, height_cm)
    leg_levels, legs = sample_leg(exported, height_cm)
    return {
        "bands": band_error(profile),
        "max_fit_error_cm": profile["max_fit_error_cm"],
        "fit_status": profile["fit_status"],
        "continuity": {
            "torso_half_width": continuity(torso_levels, widths, 0.005, TORSO_TARGET_LEVELS, TORSO_WINDOW),
            "torso_half_depth": continuity(torso_levels, depths, 0.005, TORSO_TARGET_LEVELS, TORSO_WINDOW),
            "torso_depth_centre": continuity(torso_levels, centres, 0.005, TORSO_TARGET_LEVELS, TORSO_WINDOW),
            "leg_perimeter": continuity(leg_levels, legs, 0.005, LEG_TARGET_LEVELS, LEG_WINDOW),
        },
        "interband": {
            "half_width": interband_shape(torso_levels, widths, TORSO_TARGET_LEVELS),
            "half_depth": interband_shape(torso_levels, depths, TORSO_TARGET_LEVELS),
        },
        "silhouette": {
            "half_width_min_cm": round(float(widths.min()) * 100, 1) if len(widths) else None,
            "half_width_max_cm": round(float(widths.max()) * 100, 1) if len(widths) else None,
            "samples": int(len(widths)),
        },
    }


def stability(values, destination):
    """Largest vertex displacement from nudging one input by 0.5 cm."""
    base_path = destination.with_name("base.glb")
    shifted_path = destination.with_name("shifted.glb")
    build(values, base_path)
    shifted = dict(values)
    shifted["waist_cm"] = values["waist_cm"] + 0.5
    build(shifted, shifted_path)
    import trimesh

    a = trimesh.load(base_path).to_geometry().vertices
    b = trimesh.load(shifted_path).to_geometry().vertices
    if a.shape != b.shape:
        return None
    return round(float(np.linalg.norm(a - b, axis=1).max()) * 100, 2)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", type=pathlib.Path, help="write the full report here")
    parser.add_argument("--profiles", nargs="*", default=sorted(PROFILES))
    args = parser.parse_args()

    out = {}
    workdir = pathlib.Path(tempfile.mkdtemp(prefix="fit-quality-"))
    print(f"{'profile':<14} {'band':<12} {'target':>8} {'model':>8} {'err':>6}")
    print("-" * 56)
    for name in args.profiles:
        values = PROFILES[name]
        destination = workdir / f"{name}.glb"
        started = time.perf_counter()
        report = evaluate(values, destination)
        report["seconds"] = round(time.perf_counter() - started, 2)
        report["stability_cm"] = stability(values, destination)
        out[name] = report

        for key, row in report["bands"].items():
            print(f"{name:<14} {key:<12} {row['target']:>8.1f} {row['model']:>8.1f} {row['error']:>6.2f}")
        con = report["continuity"]
        w = con["torso_half_width"]
        l = con["leg_perimeter"]
        print(f"{name:<14} {'KINK'!s:<12} torso W at bands: "
              + " ".join(f"{band}={value}" for band, value in w["kink_at_bands"].items())
              + f" | band_max={w['kink_band_max']} control median={w['kink_control_median']} p90={w['kink_control_p90']}")
        print(f"{name:<14} {'':<12} torso D at bands: "
              + " ".join(f"{band}={value}" for band, value in con["torso_half_depth"]["kink_at_bands"].items())
              + f" | band_max={con['torso_half_depth']['kink_band_max']} control median={con['torso_half_depth']['kink_control_median']}")
        print(f"{name:<14} {'':<12} torso CZ at bands:"
              + " ".join(f"{band}={value}" for band, value in con["torso_depth_centre"]["kink_at_bands"].items())
              + f" | band_max={con['torso_depth_centre']['kink_band_max']} control median={con['torso_depth_centre']['kink_control_median']}")
        print(f"{name:<14} {'':<12} leg at bands:     "
              + " ".join(f"{band}={value}" for band, value in l["kink_at_bands"].items())
              + f" | band_max={l['kink_band_max']} control median={l['kink_control_median']} p90={l['kink_control_p90']}")
        for interval, row in report["interband"]["half_width"].items():
            print(f"{name:<14} {'INTERBAND':<12} {interval} W/2 mid={row['mid_cm']:.2f} chord={row['chord_cm']:.2f} "
                  f"dev={row['dev_cm']:+.2f} cm ({row['dev_pct']:+.2f}%)")
        print(f"{name:<14} {'':<12} peak curv W={w['peak']:.0f} (at {w['at']}) p95={w['p95']:.0f} wiggles={w['sign_changes']} "
              f"| peak leg={l['peak']:.0f} | max_fit={report['max_fit_error_cm']:.2f} cm "
              f"| stab={report['stability_cm']} cm | {report['seconds']}s")
        print()

    worst = max((row["error"] for report in out.values() for row in report["bands"].values()), default=0.0)
    kink_w = max(report["continuity"]["torso_half_width"]["kink_band_max"] for report in out.values())
    ctrl_w = max(report["continuity"]["torso_half_width"]["kink_control_median"] for report in out.values())
    kink_d = max(report["continuity"]["torso_half_depth"]["kink_band_max"] for report in out.values())
    ctrl_d = max(report["continuity"]["torso_half_depth"]["kink_control_median"] for report in out.values())
    kink_l = max(report["continuity"]["leg_perimeter"]["kink_band_max"] for report in out.values())
    ctrl_l = max(report["continuity"]["leg_perimeter"]["kink_control_median"] for report in out.values())
    kink_c = max(report["continuity"]["torso_depth_centre"]["kink_band_max"] for report in out.values())
    ctrl_c = max(report["continuity"]["torso_depth_centre"]["kink_control_median"] for report in out.values())
    print(f"WORST band error:                {worst:.2f} cm")
    print(f"KINK at torso half-width bands:  {kink_w:.2f}   [off-band control median {ctrl_w:.2f}]")
    print(f"KINK at torso half-depth bands:  {kink_d:.2f}   [off-band control median {ctrl_d:.2f}]")
    print(f"KINK at torso depth-centre bands:{kink_c:.2f}   [off-band control median {ctrl_c:.2f}]")
    print(f"KINK at leg perimeter bands:     {kink_l:.2f}   [off-band control median {ctrl_l:.2f}]")
    print("A kink ratio near the control is ordinary anatomy; a large ratio is a crease at the band.")
    for name, report in out.items():
        for interval, row in report["interband"]["half_width"].items():
            print(f"  {name:<14} {interval}  dev from chord = {row['dev_cm']:+.2f} cm ({row['dev_pct']:+.2f}%)")

    if args.json:
        args.json.write_text(json.dumps(out, indent=2))
        print(f"wrote {args.json}")


if __name__ == "__main__":
    main()
