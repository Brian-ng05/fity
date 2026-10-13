"""Deformation quality: the longitudinal fields are C1, and the fit stays accurate.

The artefact these guard against is a slope discontinuity at the measurement levels. The
first implementation built those fields with np.interp, whose knots ARE the measurement
levels, so its slope jumped exactly on the rings.

Two honest notes about this file:

* Measured on the exported mesh the band crease turned out to be small — see
  verification/scripts/fit-quality.py, where the curvature concentration at the band levels
  is no larger than the off-band control. So these tests assert the field property directly
  rather than pretending to see a crease in the silhouette.
* They also pin the band residuals so that a future change cannot buy smoothness by
  breaking the circumferences, which is the failure mode the task brief warns about.
"""
import numpy as np
import pytest

from app.measurements import (CROTCH_LEVEL, LEG_EXTRA, MANUAL_LEVELS, c1_profile, smoothstep)
from app.reconstruction import reconstruct_from_measurements

# Representative valid profiles, including ones the template can only just satisfy.
PROFILES = {
    "slim": {"height_cm": 170, "chest_cm": 84, "waist_cm": 68, "hip_cm": 88, "thigh_cm": 48, "calf_cm": 32},
    "chest-heavy": {"height_cm": 175, "chest_cm": 104, "waist_cm": 76, "hip_cm": 96},
    "required-only": {"height_cm": 172, "chest_cm": 92, "waist_cm": 78},
    "challenging": {"height_cm": 178, "chest_cm": 106, "waist_cm": 68, "hip_cm": 118, "thigh_cm": 70, "calf_cm": 48},
}


def one_sided(f, x, h=1e-6, side=-1):
    """Slope approaching x from below (-1) or above (+1), so a boundary can be probed.

    h is tiny so that the one-sided quotient is a genuine tangent rather than a secant:
    at a smooth extremum (the waist is one) the two sides would otherwise differ by h
    times the curvature, which would be mistaken for the very kink under test.
    """
    if side < 0:
        return (f(x) - f(x - h)) / h
    return (f(x + h) - f(x)) / h


def test_profile_slope_is_continuous_at_every_knot():
    """The regression test for the C0 -> C1 change: np.interp fails this at each knot."""
    levels = np.array([0.505, 0.617, 0.698])
    values = np.array([0.19, 0.15, 0.18])
    profile = c1_profile(levels, values)
    for level in levels:
        point = float(level)
        left = one_sided(lambda x: profile(np.array([x]))[0], point, side=-1)
        right = one_sided(lambda x: profile(np.array([x]))[0], point, side=+1)
        assert abs(left - right) < 1e-3, (point, left, right)


def test_profile_passes_through_the_knots_and_holds_the_template_outside():
    """Fitted values are untouched, and an unmeasured region keeps the template's number."""
    levels = np.array([0.505, 0.617, 0.698])
    values = np.array([0.19, 0.15, 0.18])
    profile = c1_profile(levels, values)
    assert profile(levels) == pytest.approx(values, abs=1e-9)
    assert profile(np.array([0.30]))[0] == pytest.approx(values[0])
    assert profile(np.array([0.95]))[0] == pytest.approx(values[-1])
    # Monotone cubic: no overshoot invented between two measured levels.
    between = profile(np.linspace(levels[0], levels[-1], 200))
    assert between.min() >= values.min() - 1e-9 and between.max() <= values.max() + 1e-9


def test_smoothstep_has_zero_slope_at_both_ends():
    assert smoothstep(np.array([-1.0])).tolist() == [0.0]
    assert smoothstep(np.array([2.0])).tolist() == [1.0]
    step = lambda x: smoothstep(np.array([x]))[0]
    # The point of using it for the region masks: the ramp starts and stops with no kink.
    assert abs(one_sided(step, 0.0, side=+1)) < 1e-3
    assert abs(one_sided(step, 1.0, side=-1)) < 1e-3


def test_the_leg_fade_holds_the_measured_thigh_and_clears_before_the_crotch():
    """The crotch transition is a smooth fade, not a spline pinned at the crotch level.

    The thigh band must still receive the full factor, or the fade would cost accuracy:
    that is exactly the trade this guards.
    """
    thigh_level = LEG_EXTRA["thigh_cm"][1]
    assert smoothstep(np.array([(CROTCH_LEVEL - thigh_level) / .045]))[0] == pytest.approx(1.0)
    assert smoothstep(np.array([(CROTCH_LEVEL - CROTCH_LEVEL) / .045]))[0] == pytest.approx(0.0)


@pytest.mark.parametrize("name", sorted(PROFILES))
def test_fitted_bands_stay_within_the_documented_residual(tmp_path, name):
    """Accuracy cannot be traded away for smoothness."""
    values = PROFILES[name]
    _, _, profile = reconstruct_from_measurements(
        {key: value for key, value in values.items() if key != "height_cm"},
        values["height_cm"], tmp_path / f"{name}.glb", lambda _stage: None)
    measured = {}
    for section in profile["sections"]:
        error = abs(section["model_cm"] - section["target_cm"])
        measured[section["key"]] = error
        # Torso and midline bands are essentially exact; the limb bands are limited by how
        # far the crotch and ankle masks let the factor reach, and get the wider bound.
        bound = 2.5 if section["key"] in LEG_EXTRA else .5
        assert error <= bound, (name, section["key"], error)
    assert set(MANUAL_LEVELS) <= set(measured)
