import time
from fastapi.testclient import TestClient
from app import main
from app.sizing import SizeChart, recommend_size


def make_top_chart():
    return {
        "name": "Bảng size Áo thun Demo",
        "garment": "top",
        "source": "illustrative",
        "measurement_basis": "body_cm",
        "rows": [
            {"size": "S", "chest_cm": {"min": 82, "max": 90}, "waist_cm": {"min": 66, "max": 74}},
            {"size": "M", "chest_cm": {"min": 90, "max": 98}, "waist_cm": {"min": 74, "max": 82}},
            {"size": "L", "chest_cm": {"min": 98, "max": 106}, "waist_cm": {"min": 82, "max": 90}},
        ],
    }


def make_bottom_chart():
    return {
        "name": "Bảng size Quần Demo",
        "garment": "bottom",
        "source": "illustrative",
        "measurement_basis": "body_cm",
        "rows": [
            {"size": "29", "waist_cm": {"min": 70, "max": 76}, "hip_cm": {"min": 90, "max": 96}},
            {"size": "30", "waist_cm": {"min": 74, "max": 80}, "hip_cm": {"min": 94, "max": 100}},
            {"size": "31", "waist_cm": {"min": 78, "max": 84}, "hip_cm": {"min": 98, "max": 104}},
        ],
    }


# =========================================================================
# 1. Unit Tests for recommend_size
# =========================================================================

def test_unit_size_advice_top_with_chest_and_waist():
    chart = SizeChart(**make_top_chart())
    # Upper body scan measurements where hip_cm is None
    measurements = {"height_cm": 175, "chest_cm": 94, "waist_cm": 78, "hip_cm": None}
    res = recommend_size(measurements, chart)
    assert res["status"] == "matched"
    assert res["candidates"] == ["M"]
    assert res["comparisons"][1]["fits"] is True
    assert res["comparisons"][0]["fits"] is False


def test_unit_size_advice_bottom_upper_body_missing_hip_returns_insufficient():
    chart = SizeChart(**make_bottom_chart())
    # Upper-body scan has no hip_cm
    measurements = {"height_cm": 175, "chest_cm": 94, "waist_cm": 78, "hip_cm": None}
    res = recommend_size(measurements, chart)
    assert res == {
        "status": "insufficient_measurements",
        "candidates": [],
        "message": "Chưa đủ số đo để đối chiếu bảng size.",
    }


def test_unit_size_advice_bottom_full_body_matches_range():
    chart = SizeChart(**make_bottom_chart())
    # Full-body scan provides both waist_cm and hip_cm
    measurements = {"height_cm": 175, "chest_cm": 94, "waist_cm": 77, "hip_cm": 97}
    res = recommend_size(measurements, chart)
    assert res["status"] == "matched"
    assert res["candidates"] == ["30"]


def test_unit_size_advice_no_match():
    chart = SizeChart(**make_top_chart())
    # Chest fits L but waist is too large
    measurements = {"height_cm": 175, "chest_cm": 102, "waist_cm": 110, "hip_cm": None}
    res = recommend_size(measurements, chart)
    assert res["status"] == "no_match"
    assert res["candidates"] == []
    assert "Không size nào khớp tất cả số đo" in res["message"]


# =========================================================================
# 2. Integration Tests via FastAPI endpoints
# =========================================================================

def test_api_size_advice_flow_upper_and_full_body(monkeypatch, tmp_path):
    monkeypatch.setattr(main, "DATA", tmp_path)
    monkeypatch.setattr(main, "readiness", lambda: (True, "Ready"))

    with TestClient(main.app) as client:
        # Create an upper-body completed job directly in jobs dict
        upper_key = "test-upper-job"
        main.jobs[upper_key] = main.Job(
            id=upper_key,
            status="completed",
            stage="Đã dựng hình",
            measurements={"height_cm": 172.0, "chest_cm": 93.0, "waist_cm": 76.0, "hip_cm": None},
        )

        # 1. Top advice on upper_body scan -> Matches M
        top_res = client.post(f"/api/scans/{upper_key}/size-advice", json=make_top_chart())
        assert top_res.status_code == 200
        data = top_res.json()
        assert data["status"] == "matched"
        assert data["candidates"] == ["M"]

        # 2. Bottom advice on upper_body scan (hip_cm is None) -> insufficient_measurements
        bottom_res = client.post(f"/api/scans/{upper_key}/size-advice", json=make_bottom_chart())
        assert bottom_res.status_code == 200
        assert bottom_res.json() == {
            "status": "insufficient_measurements",
            "candidates": [],
            "message": "Chưa đủ số đo để đối chiếu bảng size.",
        }

        # Create a full-body completed job with hip_cm
        full_key = "test-full-job"
        main.jobs[full_key] = main.Job(
            id=full_key,
            status="completed",
            stage="Đã dựng hình",
            measurements={"height_cm": 172.0, "chest_cm": 93.0, "waist_cm": 77.0, "hip_cm": 97.0},
        )

        # 3. Bottom advice on full_body scan -> Matches size 30
        bottom_full_res = client.post(f"/api/scans/{full_key}/size-advice", json=make_bottom_chart())
        assert bottom_full_res.status_code == 200
        full_data = bottom_full_res.json()
        assert full_data["status"] == "matched"
        assert full_data["candidates"] == ["30"]

        # 4. Out of range measurements -> no_match
        no_match_chart = make_top_chart()
        no_match_chart["rows"] = [
            {"size": "XS", "chest_cm": {"min": 50, "max": 60}, "waist_cm": {"min": 40, "max": 50}}
        ]
        no_match_res = client.post(f"/api/scans/{full_key}/size-advice", json=no_match_chart)
        assert no_match_res.status_code == 200
        assert no_match_res.json()["status"] == "no_match"
        assert no_match_res.json()["candidates"] == []

        # Cleanup test jobs
        main.jobs.pop(upper_key, None)
        main.jobs.pop(full_key, None)


# =========================================================================
# 3. Catalog API Tests
# =========================================================================

def test_api_catalog_products():
    with TestClient(main.app) as client:
        # GET all products
        res = client.get("/api/products")
        assert res.status_code == 200
        products = res.json()
        assert isinstance(products, list)
        assert len(products) > 0

        first = products[0]
        assert "id" in first
        assert "slug" in first
        assert "chart" in first

        # Query by category
        res_cat = client.get("/api/products?category=ao-thun")
        assert res_cat.status_code == 200
        cat_products = res_cat.json()
        assert len(cat_products) > 0
        assert all(p["category"] == "ao-thun" for p in cat_products)

        # Query by search
        res_search = client.get("/api/products?search=essential")
        assert res_search.status_code == 200
        search_products = res_search.json()
        assert len(search_products) > 0
        assert any("essential" in p["name"].lower() for p in search_products)

        # Query by sort
        res_asc = client.get("/api/products?sort=price_asc")
        assert res_asc.status_code == 200
        asc_prices = [p["price"] for p in res_asc.json()]
        assert asc_prices == sorted(asc_prices)

        # Get by slug
        slug = first["slug"]
        res_slug = client.get(f"/api/products/{slug}")
        assert res_slug.status_code == 200
        assert res_slug.json()["slug"] == slug

        # Get nonexistent slug
        res_404 = client.get("/api/products/nonexistent-item-xyz")
        assert res_404.status_code == 404
