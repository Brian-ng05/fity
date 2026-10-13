"""Manual measurement entry: same template, same fit, no photo.

The pipeline runs for real here (the template mesh is fitted and a GLB is
written), because the claim under test is that an entered circumference really
is what the exported avatar measures.
"""
import time

import numpy as np
import pytest
import trimesh
from fastapi.testclient import TestClient
from scipy.special import ellipe

from app import main
from app.images import InvalidPhoto
from app.measurements import (DERIVED_BANDS, LEG_EXTRA, MANUAL_LEVELS, MIDLINE_EXTRA, closed_torso_section, ellipse_perimeter,
                              measurement_limits,
                              fit_leg_targets, leg_girth_targets, manual_targets)
from app.reconstruction import read_template, validate_measurements

VALUES = {"height_cm": 175, "chest_cm": 96, "waist_cm": 82, "hip_cm": 100}
# Every supporting band the service accepts and really reshapes the avatar to.
SUPPORTING = {**VALUES, "neck_cm": 36, "head_cm": 57, "thigh_cm": 55, "calf_cm": 36, "ankle_cm": 22}
# Bands that are recorded for the user to read back and never fitted.
RECORDED = {"shoulder_width_cm": 42, "arm_length_cm": 60, "inseam_cm": 80}


def start(client, payload):
    response = client.post("/api/scans/manual", json=payload)
    assert response.status_code == 202, response.text
    return response.json()["id"]


def finish(client, key):
    for _ in range(400):
        status = client.get(f"/api/scans/{key}").json()
        if status["status"] in {"completed", "failed"}:
            return status
        time.sleep(.02)
    raise AssertionError("manual scan did not finish")


@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.setattr(main, "DATA", tmp_path)
    main.jobs.clear()
    with TestClient(main.app) as test_client:
        yield test_client
    main.jobs.clear()


def test_manual_targets_round_trip_through_the_ellipse_model():
    """The closed form used for entered girths really inverts ellipse_perimeter."""
    template = read_template()
    targets = manual_targets(template, {"chest_cm": 96, "waist_cm": 82, "hip_cm": 100}, 175)
    assert [t["key"] for t in targets] == ["chest_cm", "waist_cm", "hip_cm"]
    for target in targets:
        assert target["level"] == MANUAL_LEVELS[target["key"]]
        assert ellipse_perimeter(target["width_cm"], target["depth_cm"]) == pytest.approx(target["target_cm"], abs=.05)
    # A blank band keeps the template's own girth scaled to the entered height.
    blank = manual_targets(template, {"chest_cm": 96, "waist_cm": 82, "hip_cm": None}, 175)
    assert [t["target_cm"] for t in blank] == [96.0, 82.0, blank[2]["target_cm"]]


def test_validation_names_the_field_that_one_template_cannot_represent():
    with pytest.raises(InvalidPhoto, match="Vòng mông"):
        validate_measurements({"chest_cm": 88, "waist_cm": 76, "hip_cm": 200}, 150)
    validate_measurements({"chest_cm": 96, "waist_cm": 82, "hip_cm": 100}, 175)


def test_manual_entry_builds_a_displayable_model_matching_the_entered_measurements(client):
    key = start(client, VALUES)
    status = finish(client, key)
    assert status["status"] == "completed", status["error"]
    # The form no longer collects neck/head/ankle: the service computed them from the
    # entered numbers, so they are numbers here, not None.
    computed = {key: status["measurements"][key] for key in DERIVED_BANDS}
    assert all(isinstance(value, float) and value > 0 for value in computed.values()), computed
    assert status["measurements"] == {"height_cm": 175.0, "chest_cm": 96.0, "waist_cm": 82.0, "hip_cm": 100.0,
                                      "thigh_cm": None, "calf_cm": None,
                                      "shoulder_width_cm": None, "arm_length_cm": None,
                                      "inseam_cm": None, **computed}
    profile = status["body_profile"]
    assert profile["capture_mode"] == "manual"
    assert profile["measurement_source"] == "manual"
    assert profile["validation"] == "not_validated"
    assert profile["derived_bands"] == sorted(DERIVED_BANDS)
    sources = {row["key"]: row["source"] for row in profile["measurement_details"]}
    assert sources["chest_cm"] == sources["waist_cm"] == sources["hip_cm"] == "user_input"
    assert sources["height_cm"] == "user_input"
    # Neck/head/ankle are computed, and must not be labelled as the user's own numbers.
    assert all(sources[key] == "derived" for key in DERIVED_BANDS)
    # Untouched anatomy stays labelled as the template's, not as the user's.
    assert sources["shoulder_width_cm"] == sources["inseam_cm"] == "unavailable"
    assert sources["thigh_cm"] == "template_model"
    # The avatar's own cross-sections are re-measured after the fit.
    for section in profile["sections"]:
        assert section["model_cm"] == pytest.approx(section["target_cm"], abs=.5)
    assert profile["max_fit_error_cm"] <= .5

    model = client.get(status["model_url"])
    assert model.status_code == 200
    assert model.content[:4] == b"glTF"
    assert model.headers["cache-control"] == "no-store"
    mesh = trimesh.load(main.DATA / f"{key}.glb").to_geometry()
    assert mesh.vertices.shape == (13380, 3)
    assert mesh.extents[1] == pytest.approx(1.75, abs=.001)
    assert mesh.is_watertight and mesh.volume > 0

    rows = client.get(f"/api/scans/{key}/measurements").json()
    assert rows["unit"] == "cm"
    assert rows["measurements"]["chest_cm"] == 96.0


def test_manual_hip_stays_template_and_blocks_bottom_sizing(client):
    key = start(client, {"height_cm": 168, "chest_cm": 92, "waist_cm": 78})
    status = finish(client, key)
    assert status["measurements"]["hip_cm"] is None
    hip = next(row for row in status["body_profile"]["measurement_details"] if row["key"] == "hip_cm")
    assert hip["source"] == "template_model" and hip["value_cm"] > 0
    assert any("chưa nhập vòng mông" in warning for warning in status["warnings"])

    bottom = {"name": "Quần demo", "garment": "bottom", "source": "illustrative", "measurement_basis": "body_cm",
              "rows": [{"size": "30", "waist_cm": {"min": 74, "max": 82}, "hip_cm": {"min": 94, "max": 100}}]}
    advice = client.post(f"/api/scans/{key}/size-advice", json=bottom).json()
    assert advice["status"] == "insufficient_measurements"


def test_manual_values_drive_size_advice_and_session_deletion(client):
    key = start(client, VALUES)
    assert finish(client, key)["status"] == "completed"
    bottom = {"name": "Quần demo", "garment": "bottom", "source": "illustrative", "measurement_basis": "body_cm",
              "rows": [{"size": "29", "waist_cm": {"min": 70, "max": 82}, "hip_cm": {"min": 92, "max": 102}},
                       {"size": "31", "waist_cm": {"min": 88, "max": 96}, "hip_cm": {"min": 104, "max": 112}}]}
    advice = client.post(f"/api/scans/{key}/size-advice", json=bottom).json()
    assert advice["candidates"] == ["29"]
    assert client.delete(f"/api/scans/{key}").status_code == 204
    assert client.get(f"/api/scans/{key}").status_code == 404
    assert not list(main.DATA.glob("*.glb"))


@pytest.mark.parametrize("payload", [
    {"chest_cm": 96, "waist_cm": 82, "hip_cm": 100},
    {"height_cm": 99, "chest_cm": 96, "waist_cm": 82, "hip_cm": 100},
    {"height_cm": 175, "waist_cm": 82, "hip_cm": 100},
    {"height_cm": 175, "chest_cm": "không phải số", "waist_cm": 82},
    {"height_cm": 175, "chest_cm": 20, "waist_cm": 82},
    {"height_cm": 175, "chest_cm": 96, "waist_cm": 82, "extra_cm": 40},
])
def test_invalid_manual_payloads_are_rejected_before_queueing(client, payload):
    assert client.post("/api/scans/manual", json=payload).status_code == 422
    assert main.jobs == {}


def test_measurements_one_template_cannot_reach_report_which_field(client):
    response = client.post("/api/scans/manual", json={"height_cm": 150, "chest_cm": 88, "waist_cm": 76, "hip_cm": 200})
    assert response.status_code == 400
    assert "Vòng mông" in response.json()["detail"]
    assert main.jobs == {}


def test_supporting_girths_really_shape_the_exported_avatar(client):
    """The claim is about the file on disk, so re-measure the exported GLB itself."""
    key = start(client, SUPPORTING)
    status = finish(client, key)
    assert status["status"] == "completed", status["error"]
    sections = {section["key"]: section for section in status["body_profile"]["sections"]}
    assert set(MIDLINE_EXTRA) | set(LEG_EXTRA) <= set(sections)
    for section in sections.values():
        assert section["model_cm"] == pytest.approx(section["target_cm"], abs=1.5)
    mesh = trimesh.load(main.DATA / f"{key}.glb").to_geometry()
    for field, (_, level, center_x) in {**MIDLINE_EXTRA, **LEG_EXTRA}.items():
        measured, _ = closed_torso_section(mesh, level * 1.75, center_x_m=None if center_x is None else center_x * 1.75)
        assert measured == pytest.approx(SUPPORTING[field], abs=1.5), field


def test_recorded_only_numbers_are_labelled_and_never_claimed_as_model_sections(client):
    key = start(client, {**VALUES, **RECORDED})
    status = finish(client, key)
    assert status["status"] == "completed", status["error"]
    rows = {row["key"]: row for row in status["body_profile"]["measurement_details"]}
    for field, value in RECORDED.items():
        # Not "user_input": that label means the avatar was reshaped to the number.
        assert rows[field]["source"] == "user_input_unfitted", field
        assert rows[field]["value_cm"] == value
        # Nothing was fitted, so the viewer must not be able to draw a section for it.
        assert rows[field]["points_m"] == [], field
    assert status["measurements"]["inseam_cm"] == RECORDED["inseam_cm"]
    assert any("ghi lại" in warning for warning in status["warnings"])


def test_blank_supporting_bands_keep_the_template_shape(client):
    """A blank limb band must not be invented, and must stay labelled as the model's.

    Thigh and calf are still typed, so leaving them blank keeps the template. Neck,
    head and ankle are no longer typed at all: the service derives them, and says so.
    """
    key = start(client, VALUES)
    status = finish(client, key)
    rows = {row["key"]: row for row in status["body_profile"]["measurement_details"]}
    for field in ("thigh_cm", "calf_cm"):
        assert rows[field]["source"] == "template_model", field
    for field in DERIVED_BANDS:
        assert rows[field]["source"] == "derived", field
    # The three derived bands are real fitted sections, not template leftovers.
    assert {section["key"] for section in status["body_profile"]["sections"]} == \
        set(VALUES) - {"height_cm"} | set(DERIVED_BANDS)
    mesh = trimesh.load(main.DATA / f"{key}.glb").to_geometry()
    template = read_template()
    for field in ("thigh_cm", "calf_cm"):
        _, level, center_x = LEG_EXTRA[field]
        measured, _ = closed_torso_section(mesh, level * 1.75, center_x_m=None if center_x is None else center_x * 1.75)
        expected, _ = closed_torso_section(template, level, center_x_m=center_x)
        assert measured == pytest.approx(expected * 1.75, abs=1.0)


def test_derived_girths_are_really_shaped_into_the_exported_avatar(client):
    """The claim is that the computed numbers land in the file, so re-measure the GLB."""
    key = start(client, VALUES)
    status = finish(client, key)
    assert status["status"] == "completed", status["error"]
    computed = {key: status["measurements"][key] for key in DERIVED_BANDS}
    sections = {section["key"]: section for section in status["body_profile"]["sections"]}
    assert set(DERIVED_BANDS) <= set(sections)
    for field, value in computed.items():
        assert sections[field]["target_cm"] == value
    mesh = trimesh.load(main.DATA / f"{key}.glb").to_geometry()
    for field in ("neck_cm", "head_cm"):
        _, level, _ = MIDLINE_EXTRA[field]
        measured, _ = closed_torso_section(mesh, level * 1.75)
        assert measured == pytest.approx(computed[field], abs=1.5), field
    _, level, center_x = LEG_EXTRA["ankle_cm"]
    measured, _ = closed_torso_section(mesh, level * 1.75, center_x_m=center_x * 1.75)
    assert measured == pytest.approx(computed["ankle_cm"], abs=1.5)


def test_derived_girths_follow_the_entered_build_and_stay_representable(client):
    """A heavier build gets a larger neck/ankle; the head barely moves; nothing is refused."""
    heights = 175.
    slim = {"height_cm": heights, "chest_cm": 84, "waist_cm": 68, "hip_cm": 88, "thigh_cm": 48, "calf_cm": 32}
    heavy = {"height_cm": heights, "chest_cm": 104, "waist_cm": 96, "hip_cm": 116, "thigh_cm": 66, "calf_cm": 42}
    derived = {}
    for payload in (slim, heavy):
        key = start(client, payload)
        status = finish(client, key)
        assert status["status"] == "completed", status["error"]
        derived[payload["chest_cm"]] = {field: status["measurements"][field] for field in DERIVED_BANDS}
    small, large = derived[84], derived[104]
    assert small["neck_cm"] < large["neck_cm"] and small["ankle_cm"] < large["ankle_cm"]
    # The head is mostly a function of height, so it must move far less than the neck.
    assert large["head_cm"] - small["head_cm"] < large["neck_cm"] - small["neck_cm"]
    # Every derived value stays inside the range one template can be scaled to.
    limits = measurement_limits(read_template(), heights)
    for values in derived.values():
        for field in DERIVED_BANDS:
            assert limits[field][0] <= values[field] <= limits[field][1], field


def test_a_supplied_value_wins_over_derivation(client):
    """An explicit number (the inline adjust can send one) is never overwritten."""
    key = start(client, {**VALUES, "neck_cm": 41})
    status = finish(client, key)
    assert status["status"] == "completed", status["error"]
    assert status["measurements"]["neck_cm"] == 41.0
    rows = {row["key"]: row for row in status["body_profile"]["measurement_details"]}
    assert rows["neck_cm"]["source"] == "user_input"
    assert "neck_cm" not in status["body_profile"]["derived_bands"]


def test_leg_girths_leave_the_pelvis_and_the_feet_alone():
    """A leg is its own loop: fitting it must not reshape the trunk or stretch a foot."""
    template = read_template()
    before = template.copy()
    before.vertices *= 1.75
    mesh, _ = fit_leg_targets(before.copy(), leg_girth_targets({"thigh_cm": 68, "calf_cm": 42, "ankle_cm": 26}), 175, "err")
    assert mesh.vertices.shape == before.vertices.shape
    for level in (.505, .617, .698):
        untouched, _ = closed_torso_section(before, level * 1.75)
        shaped, _ = closed_torso_section(mesh, level * 1.75)
        assert shaped == pytest.approx(untouched, abs=.05)
    foot = before.vertices[:, 1] < .04 * 1.75
    assert np.ptp(mesh.vertices[foot][:, 2]) == pytest.approx(np.ptp(before.vertices[foot][:, 2]), abs=.001)


@pytest.mark.parametrize("field,value,label", [("thigh_cm", 105, "Vòng đùi"), ("neck_cm", 60, "Vòng cổ"),
                                             ("calf_cm", 75, "Vòng bắp chân")])
def test_out_of_template_supporting_band_names_the_field(client, field, value, label):
    # Inside the API's wide bound, outside what one template can be scaled to, so this
    # has to be the template-aware check that answers.
    response = client.post("/api/scans/manual", json={**VALUES, field: value})
    assert response.status_code == 400
    assert label in response.json()["detail"]
    assert main.jobs == {}


def test_limits_endpoint_publishes_the_bounds_the_fit_really_enforces(client):
    """The sliders must be bounded by the same guard validate_measurements() applies."""
    body = client.get("/api/measurements/limits", params={"height_cm": 175}).json()
    limits = measurement_limits(read_template(), 175)
    assert set(body["bands"]) == set(limits)
    for key, band in body["bands"].items():
        assert (band["min_cm"], band["max_cm"]) == limits[key], key
        assert band["min_cm"] < band["base_cm"] < band["max_cm"], key
    # Outside the height range the model supports, and no height at all.
    assert client.get("/api/measurements/limits", params={"height_cm": 90}).status_code == 422
    assert client.get("/api/measurements/limits").status_code == 422


def test_a_completed_session_can_be_rebuilt_from_its_own_numbers(client):
    """What the adjust panel does: resubmit a session's own numbers and rebuild the avatar."""
    original_key = start(client, SUPPORTING)
    original = finish(client, original_key)
    assert original["status"] == "completed", original["error"]

    payload = dict(original["measurements"])
    payload["chest_cm"] = 104                      # the one adjustment
    rebuilt_key = start(client, payload)
    rebuilt = finish(client, rebuilt_key)
    assert rebuilt["status"] == "completed", rebuilt["error"]
    sections = {section["key"]: section for section in rebuilt["body_profile"]["sections"]}
    assert sections["chest_cm"]["target_cm"] == 104
    # The uploaded avatar really changed, re-measured from the file itself.
    mesh = trimesh.load(main.DATA / f"{rebuilt_key}.glb").to_geometry()
    measured, _ = closed_torso_section(mesh, MANUAL_LEVELS["chest_cm"] * 1.75)
    assert measured == pytest.approx(104, abs=1.5)
    untouched, _ = closed_torso_section(mesh, MANUAL_LEVELS["waist_cm"] * 1.75)
    assert untouched == pytest.approx(SUPPORTING["waist_cm"], abs=1.5)
