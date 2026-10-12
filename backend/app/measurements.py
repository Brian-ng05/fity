"""Photo-derived estimates and closed torso sections. No validated anthropometry."""
import numpy as np
from scipy.interpolate import PchipInterpolator
from scipy.special import ellipe
import trimesh

from .images import InvalidPhoto


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


def closed_torso_section(mesh, level_m):
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
        if curve[:, 0].min() >= 0 or curve[:, 0].max() <= 0:
            continue
        area = abs(np.sum(curve[:-1, 0] * curve[1:, 2] - curve[1:, 0] * curve[:-1, 2])) / 2
        loops.append((area, curve))
    if not loops:
        raise InvalidPhoto("Không tìm được vòng thân kín trên mô hình. Hãy chụp lại, tay tách khỏi thân.")
    curve = max(loops, key=lambda item: item[0])[1]
    perimeter_cm = float(np.linalg.norm(np.diff(curve, axis=0), axis=1).sum() * 100)
    return perimeter_cm, curve


def fit_measurement_targets(mesh, targets, height_cm):
    """Fit the avatar to the photo estimates; report fit residual, not accuracy."""
    mesh = mesh.copy()
    h = height_cm / 100
    ordered = sorted(targets, key=lambda t: t["level"])
    for _ in range(3):
        factors, centers_z = [], []
        for target in ordered:
            current, curve = closed_torso_section(mesh, target["level"] * h)
            centers_z.append((curve[:, 2].min() + curve[:, 2].max()) / 2)
            factor = target["target_cm"] / current
            if not .70 <= factor <= 1.40:
                raise InvalidPhoto("Số đo từ hai góc chưa nhất quán với hình thể. Chụp lại cùng tư thế, tay không che thân.")
            factors.append(factor)
        y = mesh.vertices[:, 1] / h
        knots = [0, .38] + [t["level"] for t in ordered] + [.84, 1]
        scale = PchipInterpolator(knots, [1, 1] + factors + [1, 1])(y)
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
