"""End to end against PostGIS: load, publish, reconcile, and read back through the tile functions.
Skipped when no test database server is reachable (see conftest.py)."""
import json
import math

import mapbox_vector_tile
import numpy as np
import pandas as pd
import pytest

import damage_job
import db
from ingest import IngestError
from store import Store
from synth_damage import generate

BBOX = (-95.50, 29.70, -95.20, 29.95)
N_BUILDINGS = 3000


@pytest.fixture()
def upload(tmp_path):
    """A synthetic upload folder: one footprint set and one run."""
    info = generate(tmp_path, N_BUILDINGS, bbox=BBOX, set_name="test_set", run="run_001", seed=11)
    info["root"] = tmp_path
    return info


@pytest.fixture()
def published(conn, upload):
    """The synthetic upload, loaded. Returns its assessment_id and the generator's counts."""
    damage_job.load_footprints(conn, upload["footprints"].read_bytes(), "test_set.parquet", "test_set")
    aid = damage_job.load_results(conn, upload["results"].read_bytes(), "results.parquet",
                                  upload["manifest"].read_bytes())
    return {"aid": aid, **upload}


def tiles_covering(bbox, z):
    def xy(lng, lat):
        n = 2 ** z
        return (int((lng + 180) / 360 * n),
                int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n))
    (x0, y1), (x1, y0) = xy(bbox[0], bbox[1]), xy(bbox[2], bbox[3])
    return [(x, y) for x in range(x0 - 1, x1 + 2) for y in range(y0 - 1, y1 + 2)]


def features(conn, function, z, x, y, aid, layer):
    data = conn.execute(f"SELECT {function}(%s, %s, %s, %s)", (z, x, y, aid)).fetchone()[0]
    if not data:
        return []
    return mapbox_vector_tile.decode(bytes(data))[layer]["features"]


# ---------------------------------------------------------------- publishing

def test_published_assessment_matches_the_upload(conn, published):
    row = conn.execute("SELECT status, data_source, n_buildings, n_assessed, c0, c1, c2, c3, c4, published_at, "
                       "ST_XMin(bbox), ST_YMax(bbox) FROM damage_assessments WHERE assessment_id = %s",
                       (published["aid"],)).fetchone()
    assert row[0] == "published" and row[1] == "synthetic" and row[9] is not None
    assert row[2] == N_BUILDINGS and row[3] == published["n_assessed"]
    assert list(row[4:9]) == published["class_counts"]
    assert BBOX[0] - 0.01 <= row[10] and row[11] <= BBOX[3] + 0.01


def test_every_resolution_adds_up_to_the_assessment_totals(conn, published):
    rows = conn.execute("SELECT res, sum(n), sum(na), sum(c0), sum(c1), sum(c2), sum(c3), sum(c4) "
                        "FROM damage_h3_cells WHERE assessment_id = %s GROUP BY res ORDER BY res",
                        (published["aid"],)).fetchall()
    assert [r[0] for r in rows] == [4, 5, 6, 7, 8, 9, 10]
    for row in rows:
        assert row[1] == N_BUILDINGS and row[2] == published["n_assessed"]
        assert [int(v) for v in row[3:]] == published["class_counts"]


def test_view_lists_every_footprint_and_marks_unassessed_ones(conn, published):
    total, assessed = conn.execute("SELECT count(*), count(damage_class) FROM damage_buildings WHERE assessment_id = %s",
                                   (published["aid"],)).fetchone()
    assert total == N_BUILDINGS and assessed == published["n_assessed"] < N_BUILDINGS
    results = pd.read_parquet(published["results"]).iloc[0]
    row = conn.execute("SELECT damage_class, confidence, ST_Covers(geom, pt) FROM damage_buildings "
                       "WHERE assessment_id = %s AND building_id = %s", (published["aid"], results["building_id"])).fetchone()
    assert row[0] == results["damage_class"] and abs(row[1] - results["confidence"]) < 1e-6 and row[2]


def test_hexagon_counts_match_the_buildings_drawn_inside_it(conn, published):
    """Cross-view check: what a hexagon says equals a plain spatial count of the points inside its polygon."""
    for res in (6, 8, 9, 10):
        stored, spatial = conn.execute(
            """SELECT sum(c.n), sum((SELECT count(*) FROM damage_buildings b
                                    WHERE b.assessment_id = c.assessment_id AND ST_Covers(c.geom, b.pt)))
               FROM damage_h3_cells c WHERE c.assessment_id = %s AND c.res = %s""", (published["aid"], res)).fetchone()
        mismatched = conn.execute(
            """SELECT count(*) FROM damage_h3_cells c WHERE c.assessment_id = %s AND c.res = %s AND c.n <>
                   (SELECT count(*) FROM damage_buildings b WHERE b.assessment_id = c.assessment_id AND ST_Covers(c.geom, b.pt))""",
            (published["aid"], res)).fetchone()[0]
        assert stored == N_BUILDINGS
        # H3 edges are great-circle arcs, the stored hexagon has straight sides: allow a building or two on an edge.
        assert abs(int(spatial) - N_BUILDINGS) <= 2 and mismatched <= 4, (res, spatial, mismatched)


# ---------------------------------------------------------------- tiles

@pytest.mark.parametrize("z, res", [(0, 4), (5, 4), (6, 5), (7, 6), (8, 6), (9, 7), (10, 8), (11, 8), (12, 9), (13, 10),
                                    (14, 10), (16, 10)])
def test_zoom_ladder(conn, z, res):
    assert conn.execute("SELECT damage_h3_res_for_zoom(%s)", (z,)).fetchone()[0] == res


@pytest.mark.parametrize("z", [5, 7, 9, 11, 12, 13])
def test_h3_tiles_show_every_building_once_across_a_zoom(conn, published, z):
    cells = {}
    for x, y in tiles_covering(BBOX, z):
        for f in features(conn, "damage_h3_mvt", z, x, y, published["aid"], "h3"):
            p = f["properties"]
            assert p["c0"] + p["c1"] + p["c2"] + p["c3"] + p["c4"] == p["na"] <= p["n"]
            assert (p["dom"] == -1) == (p["na"] == 0)
            cells[p["h3"]] = p  # a hexagon crossing a tile edge is in both tiles: count it once
    assert sum(p["n"] for p in cells.values()) == N_BUILDINGS
    assert sum(p["na"] for p in cells.values()) == published["n_assessed"]


@pytest.mark.parametrize("z", [6, 10, 12, 13, 14])
def test_density_points_are_in_exactly_one_tile(conn, published, z):
    """No de-duplication here on purpose: a heatmap adds up every point it is given."""
    weight = sum(f["properties"]["w"] for x, y in tiles_covering(BBOX, z)
                 for f in features(conn, "damage_density_mvt", z, x, y, published["aid"], "density"))
    assert weight == N_BUILDINGS


def test_building_tiles_start_at_zoom_14_and_carry_id_and_class(conn, published):
    assert all(not features(conn, "damage_buildings_mvt", 13, x, y, published["aid"], "buildings")
               for x, y in tiles_covering(BBOX, 13))
    expected = pd.read_parquet(published["results"]).set_index("building_id")["damage_class"].to_dict()
    seen = {}
    for x, y in tiles_covering(BBOX, 14):
        for f in features(conn, "damage_buildings_mvt", 14, x, y, published["aid"], "buildings"):
            assert set(f["properties"]) == {"building_id", "dc"}
            assert f["geometry"]["type"] in ("Polygon", "MultiPolygon")
            seen[f["properties"]["building_id"]] = f["properties"]["dc"]
    assert len(seen) == N_BUILDINGS
    assert all(dc == expected.get(building_id, -1) for building_id, dc in seen.items())
    assert sum(dc == -1 for dc in seen.values()) == N_BUILDINGS - published["n_assessed"]


def test_tiles_of_an_unknown_assessment_are_empty(conn, published):
    x, y = tiles_covering(BBOX, 14)[len(tiles_covering(BBOX, 14)) // 2]
    for function in ("damage_h3_mvt", "damage_buildings_mvt", "damage_density_mvt"):
        assert not conn.execute(f"SELECT {function}(14, %s, %s, 999999)", (x, y)).fetchone()[0]


# ---------------------------------------------------------------- rejection and atomicity

def counts(conn):
    return conn.execute("SELECT (SELECT count(*) FROM damage_assessments WHERE status = 'published'), "
                        "(SELECT count(*) FROM damage_results), (SELECT count(*) FROM damage_h3_cells)").fetchone()


def test_result_for_an_unknown_building_rejects_the_whole_run(conn, upload):
    damage_job.load_footprints(conn, upload["footprints"].read_bytes(), "test_set.parquet", "test_set")
    results = pd.read_parquet(upload["results"])
    results.loc[0, "building_id"] = "NOT-IN-THE-SET"
    bad = upload["root"] / "bad.parquet"
    results.to_parquet(bad, index=False)
    with pytest.raises(IngestError, match="not in footprint set"):
        damage_job.load_results(conn, bad.read_bytes(), "bad.parquet", upload["manifest"].read_bytes())
    assert counts(conn) == (0, 0, 0)


def test_unknown_footprint_set_and_duplicate_set_name_are_rejected(conn, upload):
    with pytest.raises(IngestError, match="has not been loaded"):
        damage_job.load_results(conn, upload["results"].read_bytes(), "results.parquet", upload["manifest"].read_bytes())
    damage_job.load_footprints(conn, upload["footprints"].read_bytes(), "test_set.parquet", "test_set")
    with pytest.raises(IngestError, match="already exists"):
        damage_job.load_footprints(conn, upload["footprints"].read_bytes(), "test_set.parquet", "test_set")


def test_cells_that_do_not_add_up_roll_the_whole_load_back(conn, upload, monkeypatch):
    damage_job.load_footprints(conn, upload["footprints"].read_bytes(), "test_set.parquet", "test_set")
    real_aggregate = damage_job.aggregate

    def miscounting(lat, lng, cls):
        cells = real_aggregate(lat, lng, cls)
        cells.loc[cells.index[0], "n"] += 1  # one building counted twice
        return cells

    monkeypatch.setattr(damage_job, "aggregate", miscounting)
    with pytest.raises(db.ReconcileError, match="res 4"):
        damage_job.load_results(conn, upload["results"].read_bytes(), "results.parquet", upload["manifest"].read_bytes())
    assert counts(conn) == (0, 0, 0)


# ---------------------------------------------------------------- repeated runs, polling, retention

def test_each_run_is_a_new_assessment_and_old_ones_stay(conn, published, upload):
    results = pd.read_parquet(upload["results"])
    results["damage_class"] = 4
    second = upload["root"] / "second.parquet"
    results.to_parquet(second, index=False)
    aid2 = damage_job.load_results(conn, second.read_bytes(), "second.parquet", upload["manifest"].read_bytes())
    assert aid2 > published["aid"]
    first = conn.execute("SELECT c4 FROM damage_assessments WHERE assessment_id = %s", (published["aid"],)).fetchone()[0]
    latest = conn.execute("SELECT c4, n_assessed FROM damage_assessments WHERE assessment_id = %s", (aid2,)).fetchone()
    assert first == published["class_counts"][4] and latest[0] == latest[1] == published["n_assessed"]
    assert conn.execute("SELECT count(*) FROM damage_footprints").fetchone()[0] == N_BUILDINGS  # outlines stored once


def test_poll_loads_new_uploads_once_and_records_rejections(conn, upload):
    store = Store(str(upload["root"]))
    assert damage_job.poll(conn, store) == 0
    assert counts(conn)[0] == 1
    assert damage_job.poll(conn, store) == 0  # nothing new
    assert counts(conn)[0] == 1

    broken = upload["root"] / "assessments" / "run_002"
    broken.mkdir()
    pd.DataFrame({"building_id": ["SYN-00000001"], "damage_class": [9]}).to_parquet(broken / "results.parquet", index=False)
    (broken / "manifest.json").write_text(upload["manifest"].read_text())
    assert damage_job.poll(conn, store) == 1
    status, error = conn.execute("SELECT status, error FROM damage_assessments ORDER BY assessment_id DESC LIMIT 1").fetchone()
    assert status == "error" and "must be 0 to 4" in error
    assert damage_job.poll(conn, store) == 0  # the rejected file is not retried
    assert counts(conn)[0] == 1

    waiting = upload["root"] / "assessments" / "run_003"
    waiting.mkdir()
    (waiting / "manifest.json").write_text(json.dumps({"event_name": "x", "imagery_date": "2026-10-09",
                                                       "footprint_set": "test_set"}))
    assert damage_job.poll(conn, store) == 0  # manifest without results: wait, do not fail


def test_retention_keeps_the_newest_runs(conn, published, upload, monkeypatch):
    monkeypatch.setattr(db, "KEEP_ASSESSMENTS", 2)
    ids = [published["aid"]]
    for _ in range(2):
        ids.append(damage_job.load_results(conn, upload["results"].read_bytes(), "results.parquet",
                                           upload["manifest"].read_bytes()))
    kept = [r[0] for r in conn.execute("SELECT assessment_id FROM damage_assessments ORDER BY assessment_id")]
    assert kept == ids[1:]
    assert conn.execute("SELECT count(*) FROM damage_results WHERE assessment_id = %s", (ids[0],)).fetchone()[0] == 0
    assert conn.execute("SELECT count(DISTINCT assessment_id) FROM damage_h3_cells").fetchone()[0] == 2
    assert np.isclose(conn.execute("SELECT count(*) FROM damage_footprints").fetchone()[0], N_BUILDINGS)
