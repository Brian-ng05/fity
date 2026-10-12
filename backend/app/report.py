"""Viewer annotations with explicit provenance. Model dimensions are not body measurements."""
import numpy as np
from .measurements import closed_torso_section
from .images import InvalidPhoto


def measurement_report(mesh, measurements, profile, height_cm):
    h = height_cm / 100
    upper = profile["capture_mode"] == "upper_body"
    rows = []
    def add(key, label, value, source, points=None, color="#39d5c2"):
        rows.append({"key": key, "label": label, "value_cm": round(float(value), 1) if value is not None else None,
                     "source": source, "color": color, "points_m": np.round(points, 5).tolist() if points is not None else []})
    add("height_cm", "Chiều cao", height_cm, "user_input", [[0, 0, 0], [0, h, 0]])
    for section, color in zip(profile["sections"], ["#f17be0", "#5ce4dc", "#f0dd61"]):
        source = "template_model" if upper and section["key"] == "hip_cm" else "photo_with_prior" if upper else "photo_estimate"
        add(section["key"], section["label"], section["model_cm"] if source == "template_model" else measurements[section["key"]], source, section["points_m"], color)
    add("shoulder_width_cm", "Rộng vai", measurements.get("shoulder_width_cm"), "photo_with_prior" if upper else "photo_estimate")
    # Horizontal closed sections on the actual mesh. Anatomical levels are a
    # template prior, including for full-body uploads: never claim observation.
    for key, title, level, x, color in [
        ("head_cm", "Vòng đầu", .94, 0, "#a8eb73"),
        ("neck_cm", "Vòng cổ", .855, 0, "#a195ff"),
        ("thigh_cm", "Vòng đùi trái", .405, .055, "#bfa8dd"),
        ("calf_cm", "Vòng bắp chân trái", .235, .06, "#76cfed"),
        ("ankle_cm", "Vòng cổ chân trái", .065, .06, "#efc65b"),
    ]:
        try:
            circumference, curve = closed_torso_section(mesh,level*h,center_x_m=x*h)
            add(key, title, circumference, "template_model", curve, color)
        except InvalidPhoto:
            add(key, title, None, "unavailable", color=color)
    add("arm_length_cm", "Dài tay", None, "unavailable")
    add("inseam_cm", "Dài trong chân", None, "unavailable")
    return rows
