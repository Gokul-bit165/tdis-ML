"""Upload validation: a bad file is rejected whole, with a message an operator can act on. No database."""
import io
import json

import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
import pytest
import shapely
from shapely.geometry import Polygon, box, mapping

from ingest import IngestError, read_footprints, read_manifest, read_results

SQUARE = box(-95.3601, 29.7600, -95.3600, 29.7601)


def geoparquet(ids, geoms, crs=None, geometry_column="geometry") -> bytes:
    table = pa.table({"building_id": ids, geometry_column: pa.array([g.wkb for g in geoms], pa.binary())})
    column = {"encoding": "WKB"}
    if crs is not None:
        column["crs"] = crs
    geo = {"version": "1.0.0", "primary_column": geometry_column, "columns": {geometry_column: column}}
    table = table.replace_schema_metadata({b"geo": json.dumps(geo).encode()})
    buf = io.BytesIO()
    pq.write_table(table, buf)
    return buf.getvalue()


def parquet(frame: pd.DataFrame) -> bytes:
    buf = io.BytesIO()
    frame.to_parquet(buf, index=False)
    return buf.getvalue()


# ---------------------------------------------------------------- footprints

def test_footprints_are_read_with_a_point_inside_each():
    l_shape = Polygon([(-95.3610, 29.7600), (-95.3600, 29.7600), (-95.3600, 29.7601), (-95.3609, 29.7601),
                       (-95.3609, 29.7610), (-95.3610, 29.7610)])
    frame = read_footprints(geoparquet(["a", "b"], [SQUARE, l_shape]), "set.parquet")
    assert frame["building_id"].tolist() == ["a", "b"]
    assert shapely.contains(frame["geom"].values, frame["pt"].values).all()
    assert all(shapely.get_srid(g) == 4326 for g in frame["geom"])
    assert np.allclose(frame["lat"], shapely.get_y(frame["pt"].values))


def test_footprints_accept_geojson_and_numeric_ids():
    collection = {"type": "FeatureCollection", "features": [
        {"type": "Feature", "properties": {"building_id": 101}, "geometry": mapping(SQUARE)}]}
    frame = read_footprints(json.dumps(collection).encode(), "set.geojson")
    assert frame["building_id"].tolist() == ["101"]


def test_footprints_accept_explicit_epsg_4326_and_reject_other_crs():
    ok = {"id": {"authority": "EPSG", "code": 4326}, "name": "WGS 84"}
    assert len(read_footprints(geoparquet(["a"], [SQUARE], crs=ok), "set.parquet")) == 1
    utm = {"id": {"authority": "EPSG", "code": 32615}, "name": "WGS 84 / UTM zone 15N"}
    with pytest.raises(IngestError, match="EPSG:4326"):
        read_footprints(geoparquet(["a"], [SQUARE], crs=utm), "set.parquet")


def test_footprints_outside_texas_are_rejected():
    projected = box(270000, 3290000, 270010, 3290010)  # metres, not degrees
    with pytest.raises(IngestError, match="outside Texas"):
        read_footprints(geoparquet(["a"], [projected]), "set.parquet")


def test_footprints_with_duplicate_or_missing_ids_are_rejected():
    with pytest.raises(IngestError, match="repeated"):
        read_footprints(geoparquet(["a", "a"], [SQUARE, SQUARE]), "set.parquet")
    with pytest.raises(IngestError, match="no building_id"):
        read_footprints(geoparquet([None, "b"], [SQUARE, SQUARE]), "set.parquet")


def test_invalid_outline_is_repaired_and_a_line_is_rejected():
    bowtie = Polygon([(-95.3601, 29.7600), (-95.3600, 29.7601), (-95.3600, 29.7600), (-95.3601, 29.7601)])
    assert not bowtie.is_valid
    frame = read_footprints(geoparquet(["a"], [bowtie]), "set.parquet")
    assert shapely.is_valid(frame["geom"].values).all() and shapely.area(frame["geom"].values)[0] > 0
    line = shapely.LineString([(-95.3601, 29.7600), (-95.3600, 29.7601)])
    with pytest.raises(IngestError, match="not polygons"):
        read_footprints(geoparquet(["a"], [line]), "set.parquet")


def test_footprints_need_the_right_columns_and_file_type():
    table = pa.table({"id": ["a"], "geometry": pa.array([SQUARE.wkb], pa.binary())})
    buf = io.BytesIO()
    pq.write_table(table, buf)
    with pytest.raises(IngestError, match="building_id and geometry"):
        read_footprints(buf.getvalue(), "set.parquet")
    with pytest.raises(IngestError, match="must be .parquet or .geojson"):
        read_footprints(b"", "set.shp")


# ---------------------------------------------------------------- results

def test_results_accept_codes_labels_and_csv():
    codes = read_results(parquet(pd.DataFrame({"building_id": ["a", "b"], "damage_class": [0, 4]})), "results.parquet")
    assert codes["damage_class"].tolist() == [0, 4]
    assert codes["confidence"].isna().all() and codes["assessed_at"].isna().all()

    labels = read_results(parquet(pd.DataFrame({
        "building_id": ["a", "b"], "damage_class": ["Undamaged", "Total Structural Collapse"],
        "confidence": [0.9, 0.4]})), "results.parquet")
    assert labels["damage_class"].tolist() == [0, 4]
    assert labels["confidence"].tolist() == pytest.approx([0.9, 0.4], abs=1e-6)

    csv = read_results(b"building_id,damage_class\n001,2\n002,3\n", "results.csv")
    assert csv["building_id"].tolist() == ["001", "002"]  # leading zeros survive
    assert csv["damage_class"].tolist() == [2, 3]


@pytest.mark.parametrize("frame, message", [
    (pd.DataFrame({"building_id": ["a", "a"], "damage_class": [0, 1]}), "repeated"),
    (pd.DataFrame({"building_id": ["a"], "damage_class": [5]}), "must be 0 to 4"),
    (pd.DataFrame({"building_id": ["a"], "damage_class": ["Destroyed"]}), "unknown damage_class"),
    (pd.DataFrame({"building_id": ["a", "b"], "damage_class": [1, None]}), "no damage_class"),
    (pd.DataFrame({"building_id": ["a"], "damage_class": [1], "confidence": [1.4]}), "confidence must be between"),
    (pd.DataFrame({"building_id": ["a"], "damage_class": [1], "damage_pct": [-3.0]}), "damage_pct must be between"),
    (pd.DataFrame({"building_id": ["a"]}), "missing column"),
    (pd.DataFrame({"building_id": [], "damage_class": []}), "no rows"),
])
def test_bad_results_are_rejected(frame, message):
    with pytest.raises(IngestError, match=message):
        read_results(parquet(frame), "results.parquet")


def test_results_file_type():
    with pytest.raises(IngestError, match="must be .parquet or .csv"):
        read_results(b"", "results.xlsx")


# ---------------------------------------------------------------- manifest

def test_manifest_is_read_with_defaults():
    manifest = read_manifest(json.dumps({"event_name": " Storm ", "imagery_date": "2026-10-08",
                                         "footprint_set": "houston_v1"}).encode())
    assert manifest["event_name"] == "Storm" and manifest["data_source"] == "real"
    assert str(manifest["imagery_date"]) == "2026-10-08" and manifest["model"] is None


@pytest.mark.parametrize("raw, message", [
    (b"not json", "not valid JSON"),
    (b"[]", "must be a JSON object"),
    (json.dumps({"event_name": "x", "imagery_date": "2026-10-08"}).encode(), "footprint_set"),
    (json.dumps({"event_name": "x", "imagery_date": "08/10/2026", "footprint_set": "s"}).encode(), "YYYY-MM-DD"),
])
def test_bad_manifest_is_rejected(raw, message):
    with pytest.raises(IngestError, match=message):
        read_manifest(raw)
