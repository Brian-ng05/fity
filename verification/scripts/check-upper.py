"""Real CPU integration on synthetic camera frames cropped above the knees."""
import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'backend'))
from app.reconstruction import capture_feedback,reconstruct
photos=[np.array(Image.open(ROOT/'verification/scripts/qa'/f'upper-{view}.png').convert('RGB')) for view in ('front','side')]
for view,photo in zip(('front','side'),photos):
    print(view,capture_feedback(photo,view,'upper_body'),flush=True)
warnings,measurements,profile=reconstruct(*photos,175,ROOT/'.cache/upper-check.glb',print,'upper_body')
assert measurements['hip_cm'] is None
assert next(r for r in profile['measurement_details'] if r['key']=='hip_cm')['source']=='template_model'
assert next(r for r in profile['measurement_details'] if r['key']=='chest_cm')['source']=='photo_with_prior'
(ROOT/'.cache/upper-check.json').write_text(json.dumps({'measurements':measurements,'profile':profile,'warnings':warnings},ensure_ascii=False),encoding='utf-8')
print('UPPER RECONSTRUCTION PASSED',measurements,flush=True)
