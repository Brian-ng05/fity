"""Viewer annotations with explicit provenance. Model dimensions are not body measurements."""
import numpy as np
from .measurements import closed_torso_section
from .images import InvalidPhoto

# One colour per section, shared by the 3D rings and the measurement list.
SECTION_COLORS = {"chest_cm": "#f17be0", "waist_cm": "#5ce4dc", "hip_cm": "#f0dd61",
                  "head_cm": "#a8eb73", "neck_cm": "#a195ff", "thigh_cm": "#bfa8dd",
                  "calf_cm": "#76cfed", "ankle_cm": "#efc65b"}

# Sections the viewer always annotates, with the level and leg axis the fit uses.
ANNOTATED_SECTIONS = [("head_cm", "Vòng đầu", .94, 0), ("neck_cm", "Vòng cổ", .855, 0),
                      ("thigh_cm", "Vòng đùi trái", .405, .055), ("calf_cm", "Vòng bắp chân trái", .235, .06),
                      ("ankle_cm", "Vòng cổ chân trái", .065, .06)]


def measurement_report(mesh, measurements, profile, height_cm):
    h = height_cm / 100
    upper = profile.get("capture_mode") == "upper_body"
    manual = profile.get("measurement_source") == "manual"
    rows = []

    def add(key, label, value, source, points=None, color="#39d5c2"):
        rows.append({"key": key, "label": label, "value_cm": round(float(value), 1) if value is not None else None,
                     "source": source, "color": color, "points_m": np.round(points, 5).tolist() if points is not None else []})

    def body_source(key):
        if manual:
            # Nothing here is observed: a band the user typed is their input, a
            # band they left blank keeps the model's own number.
            return "user_input" if measurements.get(key) is not None else "template_model"
        if upper and key == "hip_cm":
            return "template_model"
        return "photo_with_prior" if upper else "photo_estimate"

    def typed_but_unfitted(key):
        """A number the user entered that the avatar was never reshaped to."""
        return "user_input_unfitted" if manual and measurements.get(key) is not None else None

    add("height_cm", "Chiều cao", height_cm, "user_input", [[0, 0, 0], [0, h, 0]])
    # Every section the fit was actually given. For the photo path that is chest, waist
    # and hip; manual entry also carries the neck, head and leg girths the user typed.
    reported = set()
    for section in profile["sections"]:
        source = body_source(section["key"])
        reported.add(section["key"])
        add(section["key"], section["label"],
            section["model_cm"] if source == "template_model" else measurements[section["key"]],
            source, section["points_m"], SECTION_COLORS.get(section["key"], "#39d5c2"))
    shoulder = measurements.get("shoulder_width_cm")
    add("shoulder_width_cm", "Rộng vai", shoulder,
        typed_but_unfitted("shoulder_width_cm") or ("unavailable" if shoulder is None else ("photo_with_prior" if upper else "photo_estimate")))
    # Horizontal closed sections on the actual mesh, for the bands the fit was not given.
    # Anatomical levels are a template prior, including for full-body uploads: never
    # claim observation.
    for key, title, level, x in ANNOTATED_SECTIONS:
        if key in reported:
            continue
        try:
            circumference, curve = closed_torso_section(mesh, level * h, center_x_m=x * h)
        except InvalidPhoto:
            add(key, title, None, "unavailable", color=SECTION_COLORS[key])
            continue
        if manual and measurements.get(key) is not None:
            add(key, title, measurements[key], "user_input", curve, SECTION_COLORS[key])
        else:
            add(key, title, circumference, "template_model", curve, SECTION_COLORS[key])
    add("arm_length_cm", "Dài tay", measurements.get("arm_length_cm"), typed_but_unfitted("arm_length_cm") or "unavailable")
    add("inseam_cm", "Dài trong chân", measurements.get("inseam_cm"), typed_but_unfitted("inseam_cm") or "unavailable")
    return rows
