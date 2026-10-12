import pytest
from pydantic import ValidationError
from app.sizing import SizeChart, recommend_size


def chart(**changes):
    value={'name':'Fixture only','garment':'top','source':'illustrative','measurement_basis':'body_cm','rows':[
        {'size':'S','chest_cm':{'min':80,'max':90},'waist_cm':{'min':60,'max':70}},
        {'size':'M','chest_cm':{'min':90,'max':100},'waist_cm':{'min':70,'max':80}}]}
    value.update(changes)
    return SizeChart(**value)


def test_size_must_match_all_dimensions_not_height_or_chest_alone():
    assert recommend_size({'chest_cm':95,'waist_cm':75},chart())['candidates']==['M']
    assert recommend_size({'chest_cm':95,'waist_cm':65},chart())['status']=='no_match'
    assert recommend_size({'chest_cm':150,'waist_cm':100},chart())['candidates']==[]


def test_overlapping_boundaries_returns_all_candidates_instead_of_guess():
    assert recommend_size({'chest_cm':90,'waist_cm':70},chart())['candidates']==['S','M']


def test_invalid_chart_and_missing_measurements():
    with pytest.raises(ValidationError):
        chart(measurement_basis='garment_cm')
    with pytest.raises(ValidationError):
        chart(rows=[{'size':'X','chest_cm':{'min':100,'max':90}}])
    assert recommend_size({'chest_cm':None,'waist_cm':75},chart())['status']=='insufficient_measurements'


def test_optional_dimension_in_chart_requires_a_measurement():
    custom = chart(rows=[{'size':'M','chest_cm':{'min':90,'max':100},
                         'waist_cm':{'min':70,'max':80},'hip_cm':{'min':90,'max':100}}])
    assert recommend_size({'chest_cm':95,'waist_cm':75,'hip_cm':None},custom)['status']=='insufficient_measurements'
