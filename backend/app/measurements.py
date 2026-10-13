"""Photo-derived estimates and closed torso sections. No validated anthropometry.

The same section bands serve both entry paths: photo silhouettes and measurements
typed in by the user. Neither path is validated against tape measurements.
"""
import numpy as np
from scipy.interpolate import PchipInterpolator
from scipy.special import ellipe
import trimesh

from .images import InvalidPhoto

# Lateral scale guard shared by both paths. It keeps the deforming map monotone
# and the avatar inside the range a single template can represent.
MIN_FIT_FACTOR, MAX_FIT_FACTOR = .70, 1.40

# Anatomical bands as fractions of the shoulder-to-hip span, exactly as the photo
# path samples them. Manual entry has no silhouette, so it uses the band midpoint
# on the photo path's level mapping: typed numbers then describe the same
# anatomical level as photo-derived ones.
MANUAL_BANDS = {
    "chest_cm": ("Ngực", .30, .44),
    "waist_cm": ("Eo", .52, .78),
    "hip_cm": ("Mông", .95, 1.12),
}
MANUAL_LEVELS = {key: .805 - (low + high) / 2 * (.805 - .515) for key, (_, low, high) in MANUAL_BANDS.items()}

# Supporting sections the manual form can also accept. There is no photo silhouette
# behind these, so each one carries its level directly (fraction of body height) and,
# for a limb, the x axis of the loop it belongs to (fraction of body height as well).
# center_x = None means the section closes around the midline (neck, head); the levels
# are the ones the viewer already annotates, so what is typed and what is drawn agree.
EXTRA_BANDS = {
    "neck_cm": ("cổ", .855, None),
    "head_cm": ("đầu", .94, None),
    "thigh_cm": ("đùi", .405, .055),
    "calf_cm": ("bắp chân", .235, .06),
    "ankle_cm": ("cổ chân", .065, .06),
}
MIDLINE_EXTRA = {key: band for key, band in EXTRA_BANDS.items() if band[2] is None}
LEG_EXTRA = {key: band for key, band in EXTRA_BANDS.items() if band[2] is not None}

# Where the legs stop being separate loops and merge into the trunk. A girth typed for
# a leg must stop deforming the avatar before this, or it would reshape the pelvis too.
CROTCH_LEVEL = .46

# Guard levels: the factor curve is pinned back to the template just above the last
# measured band, so an unmeasured region keeps its template shape. The first guard
# above the topmost level wins; above .875 the only thing left is the head, which is
# held at its own factor when the user measured it.
GUARD_LEVELS = (.38, .84, .875)

# Typed by the user, but not something one template can be reshaped to: recorded and
# labelled as the user's own number, without pretending the avatar measures it.
RECORDED_ONLY_BANDS = ("shoulder_width_cm", "arm_length_cm", "inseam_cm")


def scale_lateral(x, scale, radius):
    """Monotone lateral deformation: scale the trunk and translate outer limbs.

    Blending x * scale by a rapidly falling mask can invert vertex order near
    the armpits. This map keeps a positive derivative for our allowed scales.
    """
    radius = np.maximum(radius, .01)
    return x + (scale - 1) * radius / np.tanh(1) * np.tanh(x / radius)


def ellipse_perimeter(width: float, depth: float) -> float:
    """Full diameters and perimeter in the same unit (SciPy elliptic integral)."""
    if not np.isfinite([width, depth]).all() or min(width, depth) <= 0:
        raise InvalidPhoto("Không đủ đường viền để ước lượng số đo.")
    a, b = max(width, depth) / 2, min(width, depth) / 2
    return float(4 * a * ellipe(1 - (b / a) ** 2))


def estimate_from_profiles(fractions, widths, depths, height_cm, shoulder_ratio):
    """Corresponding shoulder-to-hip rows; circumference assumes elliptical sections."""
    circumferences = np.array([ellipse_perimeter(w, d) * height_cm for w, d in zip(widths, depths)])
    definitions = [("chest_cm", "Ngực", .30, .44, "max"), ("waist_cm", "Eo", .52, .78, "min"), ("hip_cm", "Mông", .95, 1.12, "max")]
    values = {"height_cm": round(height_cm, 1), "shoulder_width_cm": round(shoulder_ratio * height_cm, 1), "inseam_cm": None}
    targets = []
    for key, title, low, high, choice in definitions:
        candidates = np.flatnonzero((fractions >= low) & (fractions <= high))
        if not len(candidates):
            raise InvalidPhoto("Không có đủ vùng thân để ước lượng các vòng.")
        local = circumferences[candidates]
        i = int(candidates[np.argmax(local) if choice == "max" else np.argmin(local)])
        value = float(circumferences[i])
        values[key] = round(value, 1)
        targets.append({"key": key, "label": title, "target_cm": value, "level": float(.805 - fractions[i] * (.805 - .515)), "width_cm": float(widths[i] * height_cm), "depth_cm": float(depths[i] * height_cm)})
    return values, targets


def closed_torso_section(mesh, level_m, center_x_m=None):
    """Select a whole closed central loop, excluding detached arm/leg loops.

    Never trim segments by x: that creates an open curve and a false perimeter.
    Round only graph keys; retain full coordinates for length and rendering.
    """
    segments = trimesh.intersections.mesh_plane(mesh, [0, 1, 0], [0, level_m, 0])
    points, graph = {}, {}
    for segment in segments:
        a, b = (tuple(np.round(p, 6)) for p in segment)
        if a == b:
            continue
        points[a], points[b] = segment[0], segment[1]
        graph.setdefault(a, set()).add(b)
        graph.setdefault(b, set()).add(a)
    visited, loops = set(), []
    for start in graph:
        if start in visited:
            continue
        component, pending = set(), [start]
        while pending:
            node = pending.pop()
            if node in component:
                continue
            component.add(node)
            pending.extend(graph[node] - component)
        visited.update(component)
        if any(len(graph[n]) != 2 for n in component):
            continue
        ordered, previous, node = [start], None, start
        for _ in range(len(component)):
            next_node = next(n for n in graph[node] if n != previous)
            if next_node == start:
                break
            ordered.append(next_node)
            previous, node = node, next_node
        if len(ordered) != len(component):
            continue
        curve = np.array([points[n] for n in ordered + [start]])
        # A torso loop spans the body's midline; isolated arms do not.
        if center_x_m is None and (curve[:, 0].min() >= 0 or curve[:, 0].max() <= 0):
            continue
        area = abs(np.sum(curve[:-1, 0] * curve[1:, 2] - curve[1:, 0] * curve[:-1, 2])) / 2
        loops.append((area, curve))
    if not loops:
        raise InvalidPhoto("Không tìm được vòng thân kín trên mô hình. Hãy chụp lại, tay tách khỏi thân.")
    curve = max(loops, key=lambda item: item[0])[1] if center_x_m is None else min(loops, key=lambda item: abs(np.mean(item[1][:,0])-center_x_m))[1]
    perimeter_cm = float(np.linalg.norm(np.diff(curve, axis=0), axis=1).sum() * 100)
    return perimeter_cm, curve


def manual_targets(template, values, height_cm):
    """Torso targets for circumferences typed by the user.

    Without a side view a circumference cannot be split into width and depth, so
    the template's own section aspect ratio (r = depth / width) is kept. The
    ellipse perimeter is then linear in width, which gives a closed form:
    width = C / (2 * E(1 - r^2)).

    A band the user left blank falls back to the template's own circumference at
    that level, so the avatar keeps its template shape there while the section
    list stays complete for the viewer.
    """
    targets = []
    for key, (label, _, _) in MANUAL_BANDS.items():
        level = MANUAL_LEVELS[key]
        perimeter_cm, curve = closed_torso_section(template, level)
        ratio = float(np.ptp(curve[:, 2]) / np.ptp(curve[:, 0]))
        value = values.get(key)
        target_cm = float(value) if value is not None else perimeter_cm * height_cm / 100
        width_cm = target_cm / (2 * ellipe(1 - ratio ** 2))
        if not np.isfinite(width_cm) or width_cm <= 0:
            raise InvalidPhoto(f"Không dựng được vòng {label.lower()} từ số đo này.")
        targets.append({"key": key, "label": label, "target_cm": round(target_cm, 1), "level": level,
                        "width_cm": width_cm, "depth_cm": width_cm * ratio})
    return targets


def all_bands():
    """Every band a user can type: key -> (label, level, leg axis or None)."""
    bands = {key: (label, MANUAL_LEVELS[key], None) for key, (label, _, _) in MANUAL_BANDS.items()}
    bands.update({key: (label, level, center_x) for key, (label, level, center_x) in EXTRA_BANDS.items()})
    return bands


def measurement_limits(template, height_cm):
    """Circumference range the template can be scaled to at each band, in cm."""
    limits = {}
    for key, (_, level, center_x) in all_bands().items():
        perimeter_cm, _ = closed_torso_section(template, level, center_x_m=center_x)
        base_cm = perimeter_cm * height_cm / 100
        limits[key] = (round(base_cm * MIN_FIT_FACTOR, 1), round(base_cm * MAX_FIT_FACTOR, 1))
    return limits


def extra_midline_targets(template, values, height_cm):
    """Neck/head targets, on the same ellipse model as the torso bands.

    Only bands the user actually typed become targets: a blank supporting band stays
    out of the fit entirely so the avatar keeps its template shape there.
    """
    targets = []
    for key, (label, level, _) in MIDLINE_EXTRA.items():
        value = values.get(key)
        if value is None:
            continue
        perimeter_cm, curve = closed_torso_section(template, level)
        ratio = float(np.ptp(curve[:, 2]) / np.ptp(curve[:, 0]))
        target_cm = float(value)
        width_cm = target_cm / (2 * ellipe(1 - ratio ** 2))
        if not np.isfinite(width_cm) or width_cm <= 0:
            raise InvalidPhoto(f"Không dựng được vòng {label} từ số đo này.")
        targets.append({"key": key, "label": f"Vòng {label}", "target_cm": round(target_cm, 1), "level": level,
                        "width_cm": width_cm, "depth_cm": width_cm * ratio})
    return targets


def leg_girth_targets(values):
    """Per-leg girths. A blank band is kept in the list with no target: the fit then
    holds that level at its template size instead of inventing a number for it."""
    targets = []
    for key, (_, level, center_x) in LEG_EXTRA.items():
        value = values.get(key)
        targets.append({"key": key, "level": level, "center_x": center_x,
                        "target_cm": None if value is None else round(float(value), 1)})
    return targets


def leg_section_geometry(mesh, key, side, height_cm):
    """Perimeter, x/z middle and half extents of one leg's own closed loop."""
    _, level, center_x = LEG_EXTRA[key]
    h = height_cm / 100
    perimeter_cm, curve = closed_torso_section(mesh, level * h, center_x_m=side * center_x * h)
    return (perimeter_cm,
            np.array([curve[:, 0].mean(), curve[:, 2].mean()]),
            np.array([max(np.ptp(curve[:, 0]) / 2, 1e-4), max(np.ptp(curve[:, 2]) / 2, 1e-4)]))


def fit_leg_targets(mesh, targets, height_cm, inconsistent_message):
    """Scale each leg section to the typed girths, which the trunk fit cannot reach.

    A leg is its own closed loop, so each measured leg is scaled radially about its own
    axis. The mask follows the section's own outline: a circular mask under-scales an
    elongated calf and would drag the foot and the hands along with it. The factor is
    pinned back to the template below the ankle and above the crotch, so the foot and
    the pelvis keep their shape. One number shapes both legs, because a tape measure
    reading and a single template carry no left/right difference.
    """
    mesh = mesh.copy()
    h = height_cm / 100
    measured = {target["key"]: target for target in targets if target["target_cm"] is not None}
    # Ascending level: the factor curve is indexed by height.
    keys = sorted(LEG_EXTRA, key=lambda key: LEG_EXTRA[key][1])
    levels = [LEG_EXTRA[key][1] for key in keys]
    for _ in range(3):
        geometry = {side: [leg_section_geometry(mesh, key, side, height_cm) for key in keys] for side in (1, -1)}
        vertices = mesh.vertices.copy()
        y = vertices[:, 1] / h
        side = np.where(vertices[:, 0] >= 0, 1, -1)
        moved_x, moved_z = vertices[:, 0].copy(), vertices[:, 2].copy()
        for sign in (1, -1):
            picked = side == sign
            factors = []
            for key, (perimeter_cm, _, _) in zip(keys, geometry[sign]):
                target = measured.get(key)
                factor = 1. if target is None else target["target_cm"] / perimeter_cm
                if not MIN_FIT_FACTOR <= factor <= MAX_FIT_FACTOR:
                    raise InvalidPhoto(inconsistent_message)
                factors.append(factor)
            profile = PchipInterpolator([0] + levels + [CROTCH_LEVEL], [1] + factors + [1])(np.clip(y, 0, CROTCH_LEVEL))
            center = np.stack([np.interp(y, levels, [g[1][axis] for g in geometry[sign]]) for axis in (0, 1)], axis=1)
            radius = np.stack([np.interp(y, levels, [g[2][axis] for g in geometry[sign]]) for axis in (0, 1)], axis=1)
            inside = np.hypot((vertices[:, 0] - center[:, 0]) / radius[:, 0],
                              (vertices[:, 2] - center[:, 1]) / radius[:, 1])
            weight = np.clip((1.25 - inside) / .45, 0, 1) * np.clip((CROTCH_LEVEL - y) / .02, 0, 1)
            scale = 1 + (profile - 1) * weight
            scaled_x = center[:, 0] + (vertices[:, 0] - center[:, 0]) * scale
            scaled_z = center[:, 1] + (vertices[:, 2] - center[:, 1]) * scale
            moved_x[picked], moved_z[picked] = scaled_x[picked], scaled_z[picked]
        vertices[:, 0], vertices[:, 2] = moved_x, moved_z
        mesh.vertices = vertices
    sections, errors = [], []
    for key, (label, level, center_x) in LEG_EXTRA.items():
        target = measured.get(key)
        if target is None:
            continue
        perimeter_cm, curve = closed_torso_section(mesh, level * h, center_x_m=center_x * h)
        error = abs(perimeter_cm - target["target_cm"])
        errors.append(error)
        sections.append({"key": key, "label": f"Vòng {label} trái", "target_cm": target["target_cm"],
                         "model_cm": round(perimeter_cm, 1), "fit_error_cm": round(error, 2),
                         "points_m": np.round(curve, 5).tolist()})
    mesh.fix_normals()
    return mesh, {"fit_status": "matched" if max(errors, default=0.) <= 1.5 else "approximate",
                  "max_fit_error_cm": round(max(errors, default=0.), 2), "sections": sections}


def merge_fit_profiles(profile, extra):
    """One fit verdict over every band that was measured, trunk and limb alike."""
    profile["sections"] = profile["sections"] + extra["sections"]
    profile["max_fit_error_cm"] = round(max(profile["max_fit_error_cm"], extra["max_fit_error_cm"]), 2)
    profile["fit_status"] = "matched" if profile["max_fit_error_cm"] <= 1.5 else "approximate"
    return profile


PHOTO_FIT_MESSAGE = "Số đo từ hai góc chưa nhất quán với hình thể. Chụp lại cùng tư thế, tay không che thân."


def factor_knots(levels, factors):
    """Height-to-scale knots for the midline fit.

    Pinned to 1 below the lowest band and just above the highest measured band, so a
    region the user did not measure keeps its template shape. The head is the one part
    above the topmost guard: it holds its own factor when measured, else the template.
    For the three torso bands this reproduces the original knots exactly.
    """
    knots, values = [0], [1]
    if levels[0] > GUARD_LEVELS[0]:
        knots.append(GUARD_LEVELS[0]); values.append(1)
    knots.extend(levels); values.extend(factors)
    guard = next((level for level in GUARD_LEVELS if level > levels[-1]), None)
    if guard is not None:
        knots.append(guard); values.append(1)
    knots.append(1); values.append(factors[-1] if levels[-1] >= GUARD_LEVELS[-1] else 1)
    return knots, values


def fit_measurement_targets(mesh, targets, height_cm, inconsistent_message=PHOTO_FIT_MESSAGE):
    """Fit the avatar to the given targets; report fit residual, not accuracy."""
    mesh = mesh.copy()
    h = height_cm / 100
    ordered = sorted(targets, key=lambda t: t["level"])
    for _ in range(3):
        factors, centers_z = [], []
        for target in ordered:
            current, curve = closed_torso_section(mesh, target["level"] * h)
            centers_z.append((curve[:, 2].min() + curve[:, 2].max()) / 2)
            factor = target["target_cm"] / current
            if not MIN_FIT_FACTOR <= factor <= MAX_FIT_FACTOR:
                raise InvalidPhoto(inconsistent_message)
            factors.append(factor)
        y = mesh.vertices[:, 1] / h
        scale = PchipInterpolator(*factor_knots([t["level"] for t in ordered], factors))(y)
        vertices = mesh.vertices.copy()
        # Constant offset on outer arms preserves their thickness instead of scaling them.
        torso_edge = np.interp(y, [t["level"] for t in ordered], [t["width_cm"] / height_cm / 2 for t in ordered]) * h
        weight = np.clip((torso_edge * 1.15 - np.abs(vertices[:, 0])) / (.025 * h), 0, 1)
        vertices[:, 0] = scale_lateral(vertices[:, 0], scale, torso_edge)
        center_z = np.interp(y, [t["level"] for t in ordered], centers_z)
        vertices[:, 2] = center_z + (vertices[:, 2] - center_z) * (1 + (scale - 1) * weight)
        mesh.vertices = vertices
    sections, errors = [], []
    for target in targets:
        actual, curve = closed_torso_section(mesh, target["level"] * h)
        error = abs(actual - target["target_cm"])
        errors.append(error)
        sections.append({"key": target["key"], "label": target["label"], "target_cm": round(target["target_cm"], 1), "model_cm": round(actual, 1), "fit_error_cm": round(error, 2), "points_m": np.round(curve, 5).tolist()})
    mesh.fix_normals()
    fit_status = "matched" if max(errors) <= 1.5 else "approximate"
    return mesh, {"fit_status": fit_status, "max_fit_error_cm": round(max(errors), 2), "sections": sections,
                  "measurement_method": "two_photo_ellipse_v1", "validation": "not_validated",
                  "note": "Sai lệch fit chỉ so avatar với số ước lượng từ ảnh, không phải sai số so với cơ thể thật."}
