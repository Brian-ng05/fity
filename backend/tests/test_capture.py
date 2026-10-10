from io import BytesIO
import numpy as np
from PIL import Image
from fastapi.testclient import TestClient
from app import main, reconstruction


def test_empty_background_never_counts_as_valid_pose(monkeypatch):
    class EmptyResult:
        pose_landmarks=[]
        segmentation_masks=[]
    class Detector:
        def detect(self,image): return EmptyResult()
    monkeypatch.setattr(reconstruction,'get_detector',lambda:Detector())
    feedback=reconstruction.capture_feedback(np.full((480,320,3),150,dtype=np.uint8),'front')
    assert not feedback['ready']
    assert feedback['landmarks']==[]


def test_preview_requires_explicit_consent_and_correct_view(monkeypatch):
    monkeypatch.setattr(main,'capture_feedback',lambda frame,view:{'ready':False,'message':'fixture','landmarks':[]})
    buffer=BytesIO();Image.new('RGB',(240,320),'white').save(buffer,format='JPEG')
    files={'photo':('frame.jpg',buffer.getvalue(),'image/jpeg')}
    with TestClient(main.app) as client:
        assert client.post('/api/capture-check',files=files,data={'view':'front'}).status_code==400
        assert client.post('/api/capture-check',files=files,data={'view':'other','consent':True}).status_code==422
        r=client.post('/api/capture-check',files=files,data={'view':'front','consent':True})
        assert r.status_code==200 and not r.json()['ready']
        assert r.headers['cache-control']=='no-store'
