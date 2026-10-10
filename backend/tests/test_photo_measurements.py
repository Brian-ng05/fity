import numpy as np
import pytest
import trimesh
from app.images import InvalidPhoto
from app.measurements import ellipse_perimeter, estimate_from_profiles, closed_torso_section, fit_measurement_targets
from app.reconstruction import read_template


def cylinder(radius, x=0):
    mesh=trimesh.creation.cylinder(radius=radius,height=1.7,sections=128)
    mesh.apply_transform(trimesh.transformations.rotation_matrix(np.pi/2,[1,0,0]))
    mesh.apply_translation([x,.85,0])
    return mesh


def test_ellipse_has_correct_circle_limit_and_scale():
    assert ellipse_perimeter(40,40)==pytest.approx(40*np.pi)
    assert ellipse_perimeter(40,30)>ellipse_perimeter(40,20)
    assert ellipse_perimeter(80,40)==pytest.approx(2*ellipse_perimeter(40,20))


def test_closed_section_excludes_arms_without_cutting_open_segments():
    mesh=trimesh.util.concatenate([cylinder(.20),cylinder(.06,-.45),cylinder(.06,.45)])
    perimeter,points=closed_torso_section(mesh,.83)
    assert perimeter==pytest.approx(40*np.pi,rel=.001)
    assert np.array_equal(points[0],points[-1])
    assert np.max(np.abs(points[:,0]))<=.201


def test_no_closed_torso_returns_error_not_zero_or_default():
    with pytest.raises(InvalidPhoto):
        closed_torso_section(cylinder(.1,.5),.83)


def test_estimates_depend_on_both_views_and_do_not_invent_inseam():
    fractions=np.linspace(.12,1.12,35)
    first,_=estimate_from_profiles(fractions,np.full(35,.2),np.full(35,.14),175,.22)
    second,_=estimate_from_profiles(fractions,np.full(35,.2),np.full(35,.16),175,.22)
    assert first['chest_cm']==pytest.approx(ellipse_perimeter(35,24.5),abs=.05)
    assert second['chest_cm']>first['chest_cm']
    assert first['height_cm']==175
    assert first['inseam_cm'] is None
    assert first['shoulder_width_cm']==38.5


def test_fitted_mesh_matches_targets_and_exports_actual_sections():
    mesh=read_template();mesh.apply_scale(1.75)
    targets=[]
    for key,level,factor in [('chest_cm',.705,1.04),('waist_cm',.60,.96),('hip_cm',.505,1.03)]:
        perimeter,points=closed_torso_section(mesh,level*1.75)
        targets.append({'key':key,'label':key,'level':level,'target_cm':perimeter*factor,'width_cm':np.ptp(points[:,0])*100})
    result,profile=fit_measurement_targets(mesh,targets,175)
    assert result.extents[1]==pytest.approx(1.75)
    assert profile['fit_status']=='matched'
    assert profile['max_fit_error_cm']<=1.5
    assert not np.allclose(mesh.vertices,result.vertices)
    for section in profile['sections']:
        points=np.array(section['points_m'])
        actual=np.linalg.norm(np.diff(points,axis=0),axis=1).sum()*100
        assert actual==pytest.approx(section['model_cm'],abs=.1)
