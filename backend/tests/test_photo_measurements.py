import numpy as np
import pytest
import trimesh
from app.images import InvalidPhoto
from app.measurements import ellipse_perimeter, estimate_from_profiles, closed_torso_section, fit_measurement_targets, scale_lateral
from app.reconstruction import read_template, deform_template


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


@pytest.mark.parametrize('scale',[.55,.8,1.4,1.9])
def test_lateral_fit_never_folds_vertex_order_near_armpits(scale):
    x=np.linspace(-.5,.5,1001)
    result=scale_lateral(x,scale,.14)
    assert np.all(np.diff(result)>0)
    assert result[500]==pytest.approx(0)


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


def test_fitting_is_independent_of_depth_origin():
    mesh=read_template();mesh.apply_scale(1.7)
    targets=[]
    for key,level in [('chest_cm',.705),('waist_cm',.60),('hip_cm',.505)]:
        perimeter,points=closed_torso_section(mesh,level*1.7)
        targets.append({'key':key,'label':key,'level':level,'target_cm':perimeter*1.08,'width_cm':np.ptp(points[:,0])*100})
    baseline,_=fit_measurement_targets(mesh,targets,170)
    shifted=mesh.copy();shifted.apply_translation([0,0,.4])
    fitted,_=fit_measurement_targets(shifted,targets,170)
    assert np.allclose(fitted.vertices-[0,0,.4],baseline.vertices,atol=1e-6)


def test_local_side_silhouette_bump_does_not_create_a_back_spike():
    fractions=np.linspace(.12,1.12,35)
    widths=np.full(35,.18)
    depths=.13+.065*np.exp(-((fractions-.66)/.07)**2)
    result=deform_template(read_template(),fractions,widths,depths,170)
    back=[]
    for level in np.linspace(.53,.70,18):
        _,curve=closed_torso_section(result,level*1.7)
        back.append(curve[:,2].min()/1.7)
    # A smooth prior must not imprint a several-cm spur over one 1%-height band.
    assert np.max(np.abs(np.diff(back)))<.012
