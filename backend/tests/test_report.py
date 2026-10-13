"""The viewer's measurement list: order, colours and provenance.

report.py serves both entry paths, so this pins the photo/upper-body list exactly as it
was before the supporting bands existed, and pins what manual entry adds on top.
"""
from app.reconstruction import read_template
from app.report import measurement_report

PHOTO_SECTIONS = [
    {"key": key, "label": label, "target_cm": value, "model_cm": value, "fit_error_cm": 0.,
     "points_m": [[0., 0., 0.], [0., 0., 0.]]}
    for key, label, value in (("chest_cm", "Ngực", 96.), ("waist_cm", "Eo", 82.), ("hip_cm", "Mông", 100.))
]
# The list every photo/upper-body result has always shown, in this order, with these colours.
PHOTO_KEYS = ["height_cm", "chest_cm", "waist_cm", "hip_cm", "shoulder_width_cm", "head_cm", "neck_cm",
              "thigh_cm", "calf_cm", "ankle_cm", "arm_length_cm", "inseam_cm"]
PHOTO_COLORS = ["#39d5c2", "#f17be0", "#5ce4dc", "#f0dd61", "#39d5c2", "#a8eb73", "#a195ff",
                "#bfa8dd", "#76cfed", "#efc65b", "#39d5c2", "#39d5c2"]


def test_photo_report_rows_keep_their_order_labels_and_colours():
    mesh = read_template()
    mesh.vertices *= 1.75
    measurements = {"height_cm": 175., "chest_cm": 96., "waist_cm": 82., "hip_cm": 100., "shoulder_width_cm": 40.}
    rows = measurement_report(mesh, measurements, {"capture_mode": "full_body", "sections": PHOTO_SECTIONS}, 175)
    assert [row["key"] for row in rows] == PHOTO_KEYS
    assert [row["color"] for row in rows] == PHOTO_COLORS
    assert [row["source"] for row in rows] == ["user_input"] * 1 + ["photo_estimate"] * 3 + ["photo_estimate"] \
        + ["template_model"] * 5 + ["unavailable"] * 2


def test_manual_report_separates_fitted_numbers_from_merely_recorded_ones():
    mesh = read_template()
    mesh.vertices *= 1.75
    measurements = {"height_cm": 175., "chest_cm": 96., "waist_cm": 82., "hip_cm": 100., "neck_cm": 36.,
                    "shoulder_width_cm": 42., "inseam_cm": 80., "arm_length_cm": None}
    sections = [{"key": "chest_cm", "label": "Ngực", "target_cm": 96., "model_cm": 96., "fit_error_cm": 0.,
                 "points_m": [[0., 0., 0.]]},
                {"key": "neck_cm", "label": "Vòng cổ", "target_cm": 36., "model_cm": 36., "fit_error_cm": 0.,
                 "points_m": [[0., 0., 0.]]}]
    profile = {"capture_mode": "manual", "measurement_source": "manual", "sections": sections}
    rows = {row["key"]: row for row in measurement_report(mesh, measurements, profile, 175)}
    # Typed and fitted: the user's own number, and a section the viewer can draw.
    assert rows["neck_cm"]["source"] == "user_input" and rows["neck_cm"]["value_cm"] == 36. and rows["neck_cm"]["points_m"]
    # Typed but never fitted: labelled apart, and nothing to draw.
    assert rows["shoulder_width_cm"]["source"] == "user_input_unfitted"
    assert rows["inseam_cm"]["source"] == "user_input_unfitted" and rows["inseam_cm"]["points_m"] == []
    assert rows["arm_length_cm"]["source"] == "unavailable"
    # A supporting band left blank keeps the model's own number and says so.
    assert rows["head_cm"]["source"] == "template_model" and rows["head_cm"]["value_cm"] > 0
