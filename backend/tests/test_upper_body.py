from types import SimpleNamespace
import numpy as np
import pytest
from app.images import InvalidPhoto
from app.reconstruction import observe, capture_feedback, read_template
from app.report import measurement_report


class TorsoDetector:
    """Cropped frame whose lower legs are outside the image and invisible."""
    def __init__(self, hip_y=.85):
        points=[SimpleNamespace(x=.5,y=.18,visibility=.9) for _ in range(33)]
        for i,x,y in [(11,.35,.3),(12,.65,.3),(23,.4,hip_y),(24,.6,hip_y)]:
            points[i]=SimpleNamespace(x=x,y=y,visibility=.95)
        for i in range(25,33):
            points[i]=SimpleNamespace(x=.5,y=1.4,visibility=.1)
        mask=np.zeros((480,640),dtype=np.float32)
        mask[30:479,215:425]=.95
        self.result=SimpleNamespace(pose_landmarks=[points],segmentation_masks=[SimpleNamespace(numpy_view=lambda:mask)])
    def detect(self,image):
        return self.result


def test_upper_capture_accepts_missing_feet_but_full_body_rejects():
    image=np.full((480,640,3),150,dtype=np.uint8)
    obs=observe(image,TorsoDetector(),"chính diện","upper_body")
    assert obs.capture_mode=="upper_body"
    assert obs.height==pytest.approx((.85-.3)*480/.29)
    with pytest.raises(InvalidPhoto):
        observe(image,TorsoDetector(),"chính diện","full_body")


def test_upper_requires_visible_waist_and_hips():
    with pytest.raises(InvalidPhoto,match="cạp quần"):
        observe(np.zeros((480,640,3),dtype=np.uint8),TorsoDetector(1.15),"chính diện","upper_body")


def test_blank_upper_never_ready(monkeypatch):
    detector=SimpleNamespace(detect=lambda _:SimpleNamespace(pose_landmarks=[],segmentation_masks=[]))
    monkeypatch.setattr("app.reconstruction.get_detector",lambda:detector)
    assert not capture_feedback(np.zeros((480,640,3),dtype=np.uint8),"front","upper_body")["ready"]


def test_model_dimensions_have_provenance_and_unknown_lengths_stay_null():
    mesh=read_template();mesh.vertices*=1.75
    rows=measurement_report(mesh,{"shoulder_width_cm":40},{"capture_mode":"upper_body","sections":[]},175)
    assert next(r for r in rows if r["key"]=="height_cm")["source"]=="user_input"
    for row in rows:
        if row["key"] in {"head_cm","neck_cm","thigh_cm","calf_cm","ankle_cm"}:
            assert row["source"]=="template_model"
            assert row["value_cm"]>0
            assert row["points_m"][0]==row["points_m"][-1]
        if row["key"] in {"inseam_cm","arm_length_cm"}:
            assert row["value_cm"] is None
            assert row["source"]=="unavailable"
