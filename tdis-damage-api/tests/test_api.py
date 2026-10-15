"""
Unit and integration tests for tdis-damage-api using FastAPI TestClient with mocked database.
"""
import pytest
from fastapi.testclient import TestClient

import main
import db


@pytest.fixture(autouse=True)
def reset_state():
    # Clear in-memory published cache before each test
    main.state["published_ids"] = {1, 2}
    main.state["published_checked"] = 9999999999.0
    yield
    main.state.clear()


@pytest.fixture
def client():
    return TestClient(main.app, raise_server_exceptions=False)


def test_health_success(client, monkeypatch):
    monkeypatch.setattr(main, "with_db", lambda fn: True)
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["database"] == "connected"
    assert "Cache-Control" not in resp.headers


def test_health_db_failure(client, monkeypatch):
    monkeypatch.setattr(main, "with_db", lambda fn: (_ for _ in ()).throw(Exception("DB connection failed")))
    resp = client.get("/health")
    assert resp.status_code == 503
    assert "Cache-Control" not in resp.headers


def test_get_assessments_success(client, monkeypatch):
    mock_assessments = [
        {
            "assessment_id": 1,
            "event_name": "Hurricane Beryl",
            "aoi_name": "Houston Metro",
            "imagery_date": "2026-10-08",
            "model": "DamageTriageFormer-v1",
            "source_file": "beryl_houston.parquet",
            "data_source": "real",
            "status": "published",
            "n_buildings": 10500,
            "n_assessed": 9800,
            "c0": 7000,
            "c1": 1500,
            "c2": 800,
            "c3": 350,
            "c4": 150,
            "bbox": [-95.5, 29.5, -95.2, 29.8],
            "created_at": "2026-10-09T10:00:00Z",
            "published_at": "2026-10-09T12:00:00Z",
        }
    ]
    monkeypatch.setattr(main, "with_db", lambda fn: mock_assessments)
    resp = client.get("/api/v1/damage/assessments")
    assert resp.status_code == 200
    assert resp.headers.get("Cache-Control") == "public, max-age=30"
    data = resp.json()
    assert len(data) == 1
    assert data[0]["assessment_id"] == 1
    assert data[0]["event_name"] == "Hurricane Beryl"
    assert data[0]["c4"] == 150
    assert data[0]["bbox"] == [-95.5, 29.5, -95.2, 29.8]


def test_get_building_detail_success(client, monkeypatch):
    mock_building = {
        "assessment_id": 1,
        "building_id": "TX-001",
        "damage_class": 3,
        "damage_pct": 75.5,
        "confidence": 0.92,
        "assessed_at": "2026-10-09T14:20:00Z",
        "imagery_ref": "https://storage/imagery/TX-001.tif",
        "centroid": [-95.3698, 29.7604],
        "event_name": "Hurricane Beryl",
        "imagery_date": "2026-10-08",
        "model": "DamageTriageFormer-v1",
    }
    monkeypatch.setattr(main, "with_db", lambda fn: mock_building)
    resp = client.get("/api/v1/damage/assessments/1/buildings/TX-001")
    assert resp.status_code == 200
    assert resp.headers.get("Cache-Control") == "public, max-age=604800, immutable"
    data = resp.json()
    assert data["building_id"] == "TX-001"
    assert data["damage_class"] == 3
    assert data["damage_label"] == "Partial Structural Collapse"
    assert data["confidence"] == 0.92
    assert data["centroid"] == [-95.3698, 29.7604]


def test_get_building_detail_not_found(client, monkeypatch):
    monkeypatch.setattr(main, "with_db", lambda fn: None)
    resp = client.get("/api/v1/damage/assessments/1/buildings/UNKNOWN")
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


def test_get_building_detail_unpublished_assessment(client):
    # Assessment 999 is not in published_ids {1, 2}
    resp = client.get("/api/v1/damage/assessments/999/buildings/TX-001")
    assert resp.status_code == 404
    assert "not published" in resp.json()["detail"].lower()


def test_tiles_h3_success(client, monkeypatch):
    mock_bytes = b"fake_h3_mvt_bytes_12345"
    monkeypatch.setattr(main, "with_db", lambda fn: mock_bytes)
    resp = client.get("/api/v1/damage/tiles/1/h3/10/240/410.mvt")
    assert resp.status_code == 200
    assert resp.headers.get("Content-Type") == "application/vnd.mapbox-vector-tile"
    assert resp.headers.get("Cache-Control") == "public, max-age=604800, immutable"
    assert resp.content == mock_bytes


def test_tiles_h3_empty_204(client, monkeypatch):
    monkeypatch.setattr(main, "with_db", lambda fn: None)
    resp = client.get("/api/v1/damage/tiles/1/h3/10/240/410.mvt")
    assert resp.status_code == 204
    assert resp.headers.get("Cache-Control") == "public, max-age=604800, immutable"
    assert len(resp.content) == 0


def test_tiles_buildings_success(client, monkeypatch):
    mock_bytes = b"fake_buildings_mvt_bytes"
    monkeypatch.setattr(main, "with_db", lambda fn: mock_bytes)
    resp = client.get("/api/v1/damage/tiles/1/buildings/14/3800/6500.mvt")
    assert resp.status_code == 200
    assert resp.headers.get("Content-Type") == "application/vnd.mapbox-vector-tile"
    assert resp.headers.get("Cache-Control") == "public, max-age=604800, immutable"
    assert resp.content == mock_bytes


def test_tiles_density_success(client, monkeypatch):
    mock_bytes = b"fake_density_mvt_bytes"
    monkeypatch.setattr(main, "with_db", lambda fn: mock_bytes)
    resp = client.get("/api/v1/damage/tiles/1/density/8/60/100.mvt")
    assert resp.status_code == 200
    assert resp.headers.get("Content-Type") == "application/vnd.mapbox-vector-tile"
    assert resp.headers.get("Cache-Control") == "public, max-age=604800, immutable"
    assert resp.content == mock_bytes


def test_tiles_unpublished_assessment_404(client):
    resp = client.get("/api/v1/damage/tiles/999/h3/10/240/410.mvt")
    assert resp.status_code == 404
    assert "not published" in resp.json()["detail"].lower()


@pytest.mark.parametrize("z,x,y", [
    (-1, 0, 0),        # z < 0
    (17, 0, 0),        # z > 16
    (4, -1, 0),        # x < 0
    (4, 16, 0),        # x >= 2^4 = 16
    (4, 0, -1),        # y < 0
    (4, 0, 16),        # y >= 2^4 = 16
])
def test_tiles_invalid_coordinates_422(client, z, x, y):
    resp = client.get(f"/api/v1/damage/tiles/1/h3/{z}/{x}/{y}.mvt")
    assert resp.status_code == 422
    assert "invalid tile" in resp.json()["detail"].lower()


def test_database_error_503(client, monkeypatch):
    class FakePool:
        def connection(self):
            class FakeConn:
                def __enter__(self):
                    return None

                def __exit__(self, exc_type, exc_val, exc_tb):
                    pass

            return FakeConn()

    def raise_db_error(conn):
        raise Exception("Fatal connection loss")

    monkeypatch.setattr(main, "get_pool", lambda: FakePool())
    monkeypatch.setattr(db, "get_assessments", raise_db_error)
    resp = client.get("/api/v1/damage/assessments")
    assert resp.status_code == 503
    assert "Database unavailable" in resp.json()["detail"]


def test_published_cache_ttl(client, monkeypatch):
    calls = []

    def mock_get_ids(conn):
        calls.append(1)
        return {10, 20}

    monkeypatch.setattr(db, "get_published_assessment_ids", mock_get_ids)
    monkeypatch.setattr(main, "with_db", lambda fn: fn(None))

    # Reset cache to expired
    main.state["published_ids"] = set()
    main.state["published_checked"] = 0.0

    ids1 = main.get_published_ids()
    assert ids1 == {10, 20}
    assert len(calls) == 1

    # Call immediately again - should use cache
    ids2 = main.get_published_ids()
    assert ids2 == {10, 20}
    assert len(calls) == 1
