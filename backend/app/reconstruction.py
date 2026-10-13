"""CPU body-shape approximation, NOT SAM/photogrammetry/validated anthropometry.

MediaPipe segments two photos and locates pose landmarks. The central torso
silhouettes control a smooth width/depth deformation of a CC0 MakeHuman mesh.
Head, hands, feet, facial features and much limb anatomy remain template-based.
The output is in metres, scaled to the user's self-reported height.
"""
from dataclasses import dataclass
from pathlib import Path
import threading
from typing import Callable

import numpy as np
from scipy.ndimage import binary_fill_holes, gaussian_filter1d, label
from scipy.interpolate import PchipInterpolator
import trimesh

from .config import MODELS
from .images import InvalidPhoto
from .measurements import (LEG_EXTRA, MANUAL_BANDS, RECORDED_ONLY_BANDS, all_bands, closed_torso_section,
                           estimate_from_profiles, extra_midline_targets, fit_leg_targets, fit_measurement_targets,
                           leg_girth_targets, manual_targets, measurement_limits, merge_fit_profiles, scale_lateral)

MODEL_PATH = MODELS / "pose_landmarker_full.task"
TEMPLATE_PATH = MODELS / "body-template.obj"
ENGINE = "mediapipe-two-photo-fit-v4"
# The measurement path shares the template and the fitting code but needs neither
# MediaPipe nor a photo, so it reports its own engine name.
MEASUREMENT_ENGINE = "measurement-template-fit-v2"
MANUAL_FIT_MESSAGE = "Số đo bạn nhập vượt quá dải mô phỏng của mẫu 3D. Kiểm tra lại chiều cao và các vòng đã nhập."
# Labels for the numbers that are recorded but never shaped into the avatar.
RECORDED_ONLY_LABELS = {"shoulder_width_cm": "rộng vai", "arm_length_cm": "dài tay", "inseam_cm": "dài trong chân"}

_detector = None
_detector_lock = threading.Lock()


def get_detector():
    global _detector
    if _detector is None:
        with _detector_lock:
            if _detector is None:
                import mediapipe as mp
                options = mp.tasks.vision.PoseLandmarkerOptions(
                    base_options=mp.tasks.BaseOptions(model_asset_path=str(MODEL_PATH)),
                    running_mode=mp.tasks.vision.RunningMode.IMAGE,
                    num_poses=2,
                    min_pose_detection_confidence=0.55,
                    min_pose_presence_confidence=0.55,
                    output_segmentation_masks=True,
                )
                _detector = mp.tasks.vision.PoseLandmarker.create_from_options(options)
    return _detector


def close_detector():
    global _detector
    with _detector_lock:
        if _detector is not None:
            try:
                _detector.close()
            except Exception:
                pass
            _detector = None


@dataclass
class Observation:
    mask: np.ndarray
    points: np.ndarray
    visibility: np.ndarray
    top: int
    bottom: int
    height: float
    capture_mode: str = "full_body"


def readiness() -> tuple[bool, str]:
    missing = [p.name for p in (MODEL_PATH, TEMPLATE_PATH) if not p.is_file()]
    if missing:
        return False, "Thiếu dữ liệu model: " + ", ".join(missing) + ". Chạy setup.ps1."
    try:
        import mediapipe  # noqa: F401
    except ImportError:
        return False, "Chưa cài MediaPipe. Chạy setup.ps1 để cài thư viện backend."
    return True, "Dựng hình thể ước lượng từ 2 ảnh bằng CPU; chưa hỗ trợ khuôn mặt hoặc số đo may đo."


def manual_readiness() -> tuple[bool, str]:
    """Manual entry needs the template only: no MediaPipe, no camera."""
    if not TEMPLATE_PATH.is_file():
        return False, f"Thiếu dữ liệu model: {TEMPLATE_PATH.name}. Chạy setup.ps1."
    return True, "Dựng hình thể từ số đo bạn nhập trên mẫu 3D có sẵn."


def segmentation_mask(array: np.ndarray) -> np.ndarray:
    # MediaPipe versions return either HxW or HxWx1 for a float mask.
    if array.ndim == 3 and array.shape[2] == 1:
        array = array[:, :, 0]
    if array.ndim != 2:
        raise InvalidPhoto("Định dạng mask chưa được hỗ trợ. Kiểm tra phiên bản MediaPipe.")
    return array > 0.55


def observe(image: np.ndarray, detector, name: str, capture_mode: str = "full_body") -> Observation:
    import mediapipe as mp
    result = detector.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=image))
    if not result.pose_landmarks or not result.segmentation_masks:
        raise InvalidPhoto(f"Ảnh {name}: chưa nhận diện được toàn thân. Hãy đứng thẳng, đủ sáng và chụp lại.")
    if len(result.pose_landmarks) != 1:
        raise InvalidPhoto(f"Ảnh {name}: chỉ để một người trong khung hình.")
    mask = segmentation_mask(result.segmentation_masks[0].numpy_view())
    components, count = label(mask)
    if not count:
        raise InvalidPhoto(f"Ảnh {name}: không tách được người khỏi nền.")
    sizes = np.bincount(components.ravel()); sizes[0] = 0
    mask = binary_fill_holes(components == int(sizes.argmax()))
    yy, xx = np.where(mask)
    if not len(yy):
        raise InvalidPhoto(f"Ảnh {name}: không tìm thấy cơ thể.")
    top, bottom = int(yy.min()), int(yy.max())
    h, w = mask.shape
    if bottom - top < h * 0.42:
        raise InvalidPhoto(f"Ảnh {name}: người quá nhỏ. Hãy tiến gần camera hơn.")
    if capture_mode == "full_body" and (top < 3 or bottom >= h - 3 or xx.min() < 2 or xx.max() >= w - 2):
        raise InvalidPhoto(f"Ảnh {name}: cơ thể chạm mép ảnh. Chụp lại để đủ đầu, tay và bàn chân.")
    points = np.array([[p.x * w, p.y * h] for p in result.pose_landmarks[0]])
    visibility = np.array([p.visibility for p in result.pose_landmarks[0]])
    if not np.isfinite(points).all():
        raise InvalidPhoto("Không đọc được các mốc cơ thể. Hãy chụp lại.")
    if capture_mode == "upper_body":
        # Missing legs must never be interpreted as the person's full pixel height.
        # Scale is explicitly inferred from the template shoulder-to-hip proportion.
        shoulder = points[[11, 12]].mean(axis=0)
        hip = points[[23, 24]].mean(axis=0)
        torso = hip[1] - shoulder[1]
        visible = visibility[[11, 12, 23, 24]]
        if name == "chính diện":
            reliable = min(visible) >= .55
        else:
            reliable = max(min(visibility[[11, 23]]), min(visibility[[12, 24]])) >= .55
        if not reliable or torso < h * .2 or top < 3 or not .08*h < shoulder[1] < .65*h or not shoulder[1] < hip[1] < h*.98:
            raise InvalidPhoto("Cần thấy đầu, hai vai, eo và cạp quần/hông trên. Không cần chụp chân; lùi máy vừa đủ để thấy cạp quần.")
        if abs(hip[0]-shoulder[0]) > torso*.35:
            raise InvalidPhoto("Giữ thân thẳng và camera ngang thân; tránh cúi hoặc nghiêng người.")
        if name == "chính diện" and abs(points[11,1]-points[12,1]) > torso*.2:
            raise InvalidPhoto("Giữ vai ngang và camera thẳng khi chụp thân trên.")
        # Need visible torso margins, but cropped hands and legs are allowed.
        for fraction in (.3, .65, .78):
            y = int(shoulder[1] + fraction*torso)
            row = mask[y]
            if row[:2].any() or row[-2:].any():
                raise InvalidPhoto("Thân đang chạm cạnh ảnh. Đưa vai và eo vào giữa khung.")
        return Observation(mask, points, visibility, top, bottom, float(torso/.29), capture_mode)
    # Side-view far limbs can be occluded; inspect the better-visible side only.
    if name == "chính diện":
        required = [11, 12, 23, 24, 25, 26, 27, 28]
        if np.mean(visibility[required]) < 0.65 or np.min(visibility[[27, 28]]) < 0.35:
            raise InvalidPhoto("Ảnh chính diện: cần thấy rõ vai, hông, đầu gối và bàn chân.")
        if abs(points[11, 1] - points[12, 1]) > (bottom - top) * 0.06:
            raise InvalidPhoto("Ảnh chính diện: giữ vai ngang và camera thẳng khi chụp.")
        if max(points[27, 1], points[28, 1]) - np.mean(points[[11, 12], 1]) < (bottom - top) * 0.55:
            raise InvalidPhoto("Hãy đứng thẳng toàn thân; demo chưa hỗ trợ tư thế ngồi hoặc co chân.")
    else:
        left = np.mean(visibility[[11, 23, 25, 27]])
        right = np.mean(visibility[[12, 24, 26, 28]])
        if max(left, right) < .55 or max(visibility[27], visibility[28]) < .35:
            raise InvalidPhoto("Ảnh nghiêng: cần thấy rõ vai, hông, đầu gối và ít nhất một bàn chân.")
    if not np.isfinite(points).all():
        raise InvalidPhoto("Không đọc được các mốc cơ thể. Hãy chụp lại.")
    return Observation(mask, points, visibility, top, bottom, float(bottom - top))


def capture_feedback(image: np.ndarray, view: str, capture_mode: str = "full_body") -> dict:
    """Check sampled camera frames with actual pose detection, not pixel stillness."""
    try:
        detector = get_detector()
        with _detector_lock:
            obs = observe(image, detector, "chính diện" if view == "front" else "góc nghiêng", capture_mode)
        shoulder_ratio = abs(obs.points[11, 0] - obs.points[12, 0]) / obs.height
        if view == "front" and shoulder_ratio < .12:
            raise InvalidPhoto("Hướng cả hai vai về camera để chụp chính diện.")
        if view == "side" and shoulder_ratio > .11:
            raise InvalidPhoto("Xoay người thêm, gần 90° so với camera.")
        torso_profile(obs)
        h, w = image.shape[:2]
        landmarks = [[round(float(p[0] / w), 4), round(float(p[1] / h), 4), round(float(v), 3)] for p, v in zip(obs.points, obs.visibility)]
        return {"ready": True, "message": "Đã thấy vai, eo và hông trên. Giữ yên; không cần thấy chân." if capture_mode == "upper_body" else "Đã nhận diện toàn thân và góc chụp. Giữ yên.", "landmarks": landmarks, "view": view, "capture_mode": capture_mode}
    except InvalidPhoto as exc:
        return {"ready": False, "message": str(exc), "landmarks": [], "view": view}


def center_run_width(mask: np.ndarray, y: float, center: float) -> float:
    """Width of foreground run nearest the anatomical centre, excluding arms."""
    row = mask[int(np.clip(round(y), 0, mask.shape[0] - 1))]
    padded = np.pad(row.astype(np.int8), (1, 1))
    starts = np.where(np.diff(padded) == 1)[0]
    ends = np.where(np.diff(padded) == -1)[0]
    if not len(starts):
        return float("nan")
    containing = np.where((starts <= center) & (ends > center))[0]
    idx = int(containing[0]) if len(containing) else int(np.argmin(abs((starts + ends) / 2 - center)))
    return float(ends[idx] - starts[idx])


def torso_profile(obs: Observation) -> tuple[np.ndarray, np.ndarray]:
    shoulder = obs.points[[11, 12]].mean(axis=0)
    hip = obs.points[[23, 24]].mean(axis=0)
    if hip[1] - shoulder[1] < obs.height * 0.15:
        raise InvalidPhoto("Không xác định được vùng thân. Hãy đứng thẳng và chụp lại.")
    fractions = np.linspace(0.12, 1.12, 35)
    sampled = np.minimum(fractions, .78) if obs.capture_mode == "upper_body" else fractions
    rows = shoulder[1] + sampled * (hip[1] - shoulder[1])
    centers = shoulder[0] + sampled * (hip[0] - shoulder[0])
    widths = []
    for row, center in zip(rows, centers):
        local = [center_run_width(obs.mask, row + d, center) for d in (-2, -1, 0, 1, 2)]
        widths.append(np.nanmedian(local) / obs.height)
    widths = np.asarray(widths)
    if not np.all(np.isfinite(widths)) or np.min(widths) < 0.06 or np.max(widths) > 0.40:
        raise InvalidPhoto("Đường viền cơ thể chưa rõ. Hãy dùng nền đơn giản và tránh tay che thân.")
    return fractions, gaussian_filter1d(widths, sigma=1.4)


def read_template(path: Path = TEMPLATE_PATH) -> trimesh.Trimesh:
    # Parse only body faces: upstream OBJ also contains helper/joint geometry.
    vertices, faces = [], []
    active = True
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("v "):
            vertices.append([float(v) for v in line.split()[1:4]])
        elif line.startswith("g "):
            active = line.strip() == "g body"
        elif active and line.startswith("f "):
            indices = [int(v.split("/")[0]) - 1 for v in line.split()[1:]]
            faces.extend([[indices[0], indices[i], indices[i + 1]] for i in range(1, len(indices) - 1)])
    mesh = trimesh.Trimesh(vertices=np.asarray(vertices), faces=np.asarray(faces), process=False)
    mesh.remove_unreferenced_vertices()
    bounds = mesh.bounds
    mesh.vertices -= np.array([(bounds[0, 0] + bounds[1, 0]) / 2, bounds[0, 1], (bounds[0, 2] + bounds[1, 2]) / 2])
    mesh.vertices /= bounds[1, 1] - bounds[0, 1]
    return mesh


def deform_template(mesh: trimesh.Trimesh, fractions: np.ndarray, front_width: np.ndarray, side_depth: np.ndarray, height_cm: float) -> trimesh.Trimesh:
    mesh = mesh.copy()
    vertices = mesh.vertices.copy()
    y = vertices[:, 1]
    # Template landmarks are fixed to this CC0 asset; these are a modelling prior,
    # not detected measurements. Arms/head/legs retain template topology.
    # A hand overlapping the side silhouette can introduce a large local bulge.
    # Fit a smooth template prior through the three measured regions, rather
    # than imprinting every noisy silhouette row onto the skin.
    _, anchors = estimate_from_profiles(fractions, front_width, side_depth, height_cm, 0)
    levels = np.array([a["level"] for a in anchors])
    front_width = np.array([a["width_cm"] / height_cm for a in anchors])
    side_depth = np.array([a["depth_cm"] / height_cm for a in anchors])
    base_width, base_depth, base_center_z = [], [], []
    for level in levels:
        _, band = closed_torso_section(mesh, float(level))
        base_width.append(np.ptp(band[:, 0]))
        base_depth.append(np.ptp(band[:, 2]))
        base_center_z.append((band[:, 2].min() + band[:, 2].max()) / 2)
    width_ratio = front_width / np.maximum(base_width, 0.04)
    depth_ratio = side_depth / np.maximum(base_depth, 0.04)
    if np.any((width_ratio < 0.55) | (width_ratio > 1.9)) or np.any((depth_ratio < 0.5) | (depth_ratio > 2.2)):
        raise InvalidPhoto("Tỷ lệ hai ảnh chưa phù hợp với demo. Hãy chụp đúng góc, cùng tư thế và mặc đồ ôm sát.")
    # Blend into unmodified neck and lower legs so the mesh remains smooth.
    knots = np.concatenate(([0.0, 0.25, 0.40], levels[::-1], [0.84, 0.92, 1.0]))
    sx = np.concatenate(([1, 1, width_ratio[-1] * 0.5 + 0.5], width_ratio[::-1], [1, 1, 1]))
    sz = np.concatenate(([1, 1, depth_ratio[-1] * 0.5 + 0.5], depth_ratio[::-1], [1, 1, 1]))
    x_scale = PchipInterpolator(knots, sx)(y)
    z_scale = PchipInterpolator(knots, sz)(y)
    # Exterior arm vertices are shifted with the torso rather than thickened to
    # torso depth. Arms remain a template estimate, explicitly disclosed in UI.
    radius = np.interp(y, levels[::-1], np.asarray(base_width)[::-1] / 2)
    torso_weight = np.clip((radius * 1.35 - abs(vertices[:, 0])) / (radius * .25), 0, 1)
    torso_weight = torso_weight * torso_weight * (3 - 2 * torso_weight)
    vertices[:, 0] = scale_lateral(vertices[:, 0], x_scale, radius)
    # OBJ depth origin is not the torso centre (feet/nose affect its bounds).
    # Scaling about global zero pushes the back sideways and distorts posture.
    center_z = np.interp(y, levels[::-1], np.asarray(base_center_z)[::-1])
    vertices[:, 2] = center_z + (vertices[:, 2] - center_z) * (1 + (z_scale - 1) * torso_weight)
    vertices *= height_cm / 100
    mesh.vertices = vertices
    mesh.visual.vertex_colors = [148, 170, 146, 255]
    mesh.fix_normals()
    return mesh


def reconstruct(front: np.ndarray, side: np.ndarray, height_cm: float, destination: Path, report: Callable[[str], None], capture_mode: str = "full_body") -> tuple[list[str], dict[str, float | None], dict]:
    report("Đang nhận diện cơ thể trong hai ảnh…")
    detector = get_detector()
    with _detector_lock:
        frontal = observe(front, detector, "chính diện", capture_mode)
        lateral = observe(side, detector, "góc nghiêng", capture_mode)
    front_shoulders = abs(frontal.points[11, 0] - frontal.points[12, 0]) / frontal.height
    side_shoulders = abs(lateral.points[11, 0] - lateral.points[12, 0]) / lateral.height
    if front_shoulders < 0.12:
        raise InvalidPhoto("Ảnh đầu cần chụp chính diện. Hãy hướng cả hai vai về camera.")
    if side_shoulders > front_shoulders * 0.75:
        raise InvalidPhoto("Ảnh thứ hai chưa đủ nghiêng. Hãy xoay người khoảng 90° so với camera.")
    report("Đang khớp đường viền và dựng bề mặt 3D…")
    fractions, widths = torso_profile(frontal)
    _, depths = torso_profile(lateral)
    template = read_template()
    if capture_mode == "upper_body":
        # Hip silhouette is not observed. Restore template widths for those rows,
        # and mark the resulting hip as model-only rather than a photo estimate.
        for i in np.flatnonzero(fractions > .78):
            _, curve = closed_torso_section(template, float(.805-fractions[i]*.29))
            blend = min(1., (fractions[i]-.78)/.17)
            widths[i] = widths[i]*(1-blend)+np.ptp(curve[:,0])*blend
            depths[i] = depths[i]*(1-blend)+np.ptp(curve[:,2])*blend
    mesh = deform_template(template, fractions, widths, depths, height_cm)
    report("Đang trích xuất thông số kích thước cơ thể…")
    measurements, targets = estimate_from_profiles(fractions, widths, depths, height_cm, front_shoulders)
    report("Đang khớp avatar theo các vòng ước lượng…")
    mesh, profile = fit_measurement_targets(mesh, targets, height_cm)
    profile["capture_mode"] = capture_mode
    profile["scale_method"] = "height_and_template_torso_ratio" if capture_mode == "upper_body" else "height_and_full_silhouette"
    if capture_mode == "upper_body":
        measurements["hip_cm"] = None
        profile["measurement_method"] = "upper_body_ellipse_with_template_scale_v1"
    from .report import measurement_report
    profile["measurement_details"] = measurement_report(mesh, measurements, profile, height_cm)
    report("Đang hoàn thiện file 3D…")
    mesh.export(destination, file_type="glb", include_normals=True)
    warnings = [
        "Phần thân được điều chỉnh theo đường viền hai ảnh trên mẫu cơ thể có sẵn. Đây là hình thể ước lượng, không phải bản sao 3D chính xác.",
        "Ngực/eo được ước lượng từ bề rộng và độ sâu hai ảnh với giả định lát cắt elip; mông giữ theo mẫu." if capture_mode == "upper_body" else "Ngực/eo/mông được ước lượng từ bề rộng và độ sâu hai ảnh với giả định lát cắt elip. Chưa kiểm chứng sai số trên người thật.",
        "Chiều cao do bạn nhập; rộng vai là khoảng cách hai mốc vai trên ảnh. Chưa đủ cơ sở đo inseam nên không xuất số này.",
        "Đầu, khuôn mặt và bàn tay/chân giữ theo mẫu.",
        "Biên dạng thân được làm mượt qua ba vùng đo trên mẫu có sẵn; chưa tái tạo đầy đủ tư thế hoặc phân bố mô cơ thể.",
    ]
    if capture_mode == "upper_body":
        warnings.insert(0, "Chế độ webcam thân trên: tỷ lệ cm suy ra từ chiều cao và tỷ lệ vai–hông của mẫu. Ngực/eo phụ thuộc giả định này; mông và chân không được đo từ ảnh. Không dùng cho may đo.")
    return warnings, measurements, profile


def validate_measurements(values: dict, height_cm: float) -> None:
    """Reject numbers one template cannot be scaled to, naming the field at fault.

    The guard range matches the lateral-scale limit used by the fit, so a value
    accepted here cannot fail later for being out of the representable range.
    """
    limits = measurement_limits(read_template(), height_cm)
    for key, (label, _, _) in all_bands().items():
        value = values.get(key)
        if value is None:
            continue
        low, high = limits[key]
        if not low <= value <= high:
            raise InvalidPhoto(
                f"Vòng {label.lower()} {value:g} cm nằm ngoài dải mô phỏng của mẫu 3D ở chiều cao {height_cm:g} cm "
                f"(khoảng {low:g}–{high:g} cm). Hãy kiểm tra lại số đo và chiều cao.")


def reconstruct_from_measurements(values: dict, height_cm: float, destination: Path, report: Callable[[str], None]) -> tuple[list[str], dict[str, float | None], dict]:
    """Build the avatar from measurements typed by the user: no photo, pose or mask.

    The template is scaled to the entered height, fitted to the entered torso, neck and
    head girths, then each leg is fitted to the entered limb girths. A band the user
    left blank keeps its template shape instead of an invented number.
    """
    report("Đang dựng hình thể từ số đo đã nhập…")
    template = read_template()
    mesh = template.copy()
    mesh.vertices *= height_cm / 100
    mesh.visual.vertex_colors = [148, 170, 146, 255]
    targets = manual_targets(template, values, height_cm) + extra_midline_targets(template, values, height_cm)
    report("Đang khớp avatar theo các vòng bạn nhập…")
    mesh, profile = fit_measurement_targets(mesh, targets, height_cm, MANUAL_FIT_MESSAGE)
    mesh, leg_profile = fit_leg_targets(mesh, leg_girth_targets(values), height_cm, MANUAL_FIT_MESSAGE)
    profile = merge_fit_profiles(profile, leg_profile)
    measurements: dict[str, float | None] = {"height_cm": round(float(height_cm), 1)}
    for key in list(all_bands()) + list(RECORDED_ONLY_BANDS):
        value = values.get(key)
        measurements[key] = round(float(value), 1) if value is not None else None
    profile["capture_mode"] = "manual"
    profile["measurement_source"] = "manual"
    profile["measurement_method"] = "manual_ellipse_template_fit_v2"
    profile["scale_method"] = "entered_circumferences"
    profile["note"] = "Sai lệch fit chỉ so avatar với số đo bạn nhập, không phải kiểm chứng số đo đó đúng với cơ thể."
    from .report import measurement_report
    profile["measurement_details"] = measurement_report(mesh, measurements, profile, height_cm)
    report("Đang hoàn thiện file 3D…")
    mesh.export(destination, file_type="glb", include_normals=True)
    warnings = [
        "Mô hình dựng từ số đo bạn nhập trên mẫu cơ thể 3D có sẵn. Đây là hình thể mô phỏng, không phải bản sao 3D chính xác của cơ thể bạn.",
        "Các vòng bạn nhập được khớp theo giả định lát cắt elip theo tỷ lệ sẵn có của mẫu, nên số vòng đúng còn hình dạng riêng của bạn thì chưa.",
        "Chiều cao do bạn nhập. Phần cơ thể bạn không nhập (kể cả tay, bàn chân và khuôn mặt) vẫn giữ theo mẫu 3D.",
        "Số đo bạn nhập chưa được đối chứng bằng thước dây. Đây là gợi ý tham khảo, không dùng cho may đo.",
    ]
    missing = [MANUAL_BANDS[key][0].lower() for key in MANUAL_BANDS if values.get(key) is None]
    if missing:
        warnings.insert(1, f"Bạn chưa nhập vòng {', '.join(missing)}: phần này giữ theo mẫu 3D và không dùng được để đối chiếu bảng size tương ứng.")
    if any(values.get(key) is not None for key in LEG_EXTRA):
        warnings.insert(2, "Vòng đùi/bắp chân/cổ chân bạn nhập được áp dụng đối xứng cho cả hai chân: một lần đo và một mẫu 3D không phân biệt chân trái với chân phải.")
    recorded = [label for key, label in RECORDED_ONLY_LABELS.items() if values.get(key) is not None]
    if recorded:
        warnings.insert(3, f"{', '.join(recorded).capitalize()} bạn nhập chỉ được ghi lại để bạn đối chiếu, không dựng vào mô hình 3D.")
    return warnings, measurements, profile
