"""Read and validate the three kinds of upload. Anything wrong raises IngestError and the whole file is rejected.

  footprints  GeoParquet or GeoJSON: building_id, geometry (Polygon / MultiPolygon, EPSG:4326)
  results     Parquet or CSV: building_id, damage_class (0-4 or the exact label), optional confidence,
              damage_pct, imagery_ref, assessed_at. One row per assessed building; no geometry.
  manifest    JSON: event_name, imagery_date, footprint_set, optional aoi_name, model, data_source
"""
from __future__ import annotations

import io
import json
from datetime import date

import numpy as np
import pandas as pd
import pyarrow.parquet as pq
import shapely
from shapely.geometry import shape

from damage_core import LABEL_TO_CODE, N_CLASSES, SRID, inside_texas, representative_points

GEOMETRY_COLUMNS = ("geometry", "geom", "wkb_geometry")
POLYGON_TYPES = (shapely.GeometryType.POLYGON, shapely.GeometryType.MULTIPOLYGON)


class IngestError(ValueError):
    """The upload is not usable. The message is stored with the rejected run and shown to operators."""


def _sample(values, limit: int = 5) -> str:
    values = [str(v) for v in values[:limit]]
    return ", ".join(values)


def _building_ids(column: pd.Series, what: str) -> pd.Series:
    if column.isna().any():
        raise IngestError(f"{what}: {int(column.isna().sum())} rows have no building_id")
    ids = column.astype(str).str.strip()
    if (ids == "").any():
        raise IngestError(f"{what}: {int((ids == '').sum())} rows have an empty building_id")
    dup = ids[ids.duplicated()]
    if len(dup):
        raise IngestError(f"{what}: {dup.nunique()} building_id values are repeated, e.g. {_sample(dup.unique())}")
    return ids


# ---------------------------------------------------------------- footprints

def _check_crs(geo_meta: dict | None, column: str) -> None:
    """GeoParquet stores the CRS as PROJJSON; a missing crs means OGC:CRS84 (longitude, latitude)."""
    if not geo_meta:
        return
    crs = (geo_meta.get("columns", {}).get(column) or {}).get("crs")
    if crs is None:
        return
    ident = crs.get("id") if isinstance(crs, dict) else None
    if isinstance(ident, dict) and (str(ident.get("authority")).upper(), str(ident.get("code")).upper()) in (
        ("EPSG", "4326"), ("OGC", "CRS84"),
    ):
        return
    name = crs.get("name") if isinstance(crs, dict) else crs
    raise IngestError(f"footprints must be in EPSG:4326 (longitude, latitude); the file declares '{name}'")


def _read_footprint_table(data: bytes, name: str) -> tuple[pd.Series, np.ndarray]:
    lower = name.lower()
    if lower.endswith((".parquet", ".geoparquet")):
        table = pq.read_table(io.BytesIO(data))
        column = next((c for c in GEOMETRY_COLUMNS if c in table.column_names), None)
        if column is None or "building_id" not in table.column_names:
            raise IngestError(f"footprints need the columns building_id and geometry; found {table.column_names}")
        meta = table.schema.metadata or {}
        _check_crs(json.loads(meta[b"geo"]) if b"geo" in meta else None, column)
        frame = table.select(["building_id", column]).to_pandas()
        try:
            geoms = shapely.from_wkb(frame[column].values)
        except Exception as e:
            raise IngestError(f"footprints: the geometry column is not valid WKB ({e})")
        return frame["building_id"], geoms
    if lower.endswith((".geojson", ".json")):
        try:
            features = json.loads(data)["features"]
            ids = pd.Series([(f.get("properties") or {}).get("building_id") for f in features])
            geoms = np.array([shape(f["geometry"]) if f.get("geometry") else None for f in features], dtype=object)
        except Exception as e:
            raise IngestError(f"footprints: not a GeoJSON FeatureCollection ({e})")
        return ids, geoms
    raise IngestError(f"footprints must be .parquet or .geojson, not '{name}'")


def _polygonal(geom):
    """The polygon parts of a repaired geometry (make_valid can return lines and points as well)."""
    parts = [g for g in shapely.get_parts(geom) if shapely.get_type_id(g) in POLYGON_TYPES and not g.is_empty]
    return shapely.union_all(parts) if parts else None


def read_footprints(data: bytes, name: str) -> pd.DataFrame:
    """Validated footprints: building_id, geom (shapely polygons, SRID 4326), pt, lat, lng."""
    ids, geoms = _read_footprint_table(data, name)
    if len(ids) == 0:
        raise IngestError("footprints: the file has no rows")
    ids = _building_ids(ids, "footprints")

    missing = shapely.is_missing(geoms) | shapely.is_empty(geoms)
    if missing.any():
        raise IngestError(f"footprints: {int(missing.sum())} rows have no geometry, e.g. {_sample(ids[missing].values)}")
    geoms = shapely.force_2d(geoms)
    invalid = ~shapely.is_valid(geoms)
    if invalid.any():
        geoms = geoms.copy()
        geoms[invalid] = [_polygonal(g) for g in shapely.make_valid(geoms[invalid])]
    bad = shapely.is_missing(geoms) | ~np.isin(shapely.get_type_id(geoms), POLYGON_TYPES) | (shapely.area(geoms) <= 0)
    if bad.any():
        raise IngestError(f"footprints: {int(bad.sum())} rows are not polygons with an area, "
                          f"e.g. {_sample(ids[bad].values)}")

    west, south, east, north = shapely.total_bounds(geoms)
    if not inside_texas(west, south, east, north):
        raise IngestError(f"footprints: extent ({west:.4f}, {south:.4f}, {east:.4f}, {north:.4f}) is outside Texas; "
                          "coordinates must be longitude/latitude in EPSG:4326")

    pts = representative_points(geoms)
    return pd.DataFrame({
        "building_id": ids.values,
        "geom": shapely.set_srid(geoms, SRID),
        "pt": shapely.set_srid(pts, SRID),
        "lat": shapely.get_y(pts),
        "lng": shapely.get_x(pts),
    })


# ---------------------------------------------------------------- results

def _class_codes(column: pd.Series) -> np.ndarray:
    if column.isna().any():
        raise IngestError(f"results: {int(column.isna().sum())} rows have no damage_class; "
                          "leave buildings that were not assessed out of the file")
    if pd.api.types.is_numeric_dtype(column):
        values = column.astype("float64")
        ok = values.isin(range(N_CLASSES))
        if not ok.all():
            raise IngestError(f"results: damage_class must be 0 to {N_CLASSES - 1}; found {_sample(sorted(values[~ok].unique()))}")
        return values.astype("int16").values
    text = column.astype(str).str.strip()
    as_number = pd.to_numeric(text, errors="coerce")
    if as_number.notna().all():
        return _class_codes(as_number)
    codes = text.map(LABEL_TO_CODE)
    if codes.isna().any():
        raise IngestError(f"results: unknown damage_class values {_sample(sorted(text[codes.isna()].unique()))}; "
                          f"use 0 to {N_CLASSES - 1} or one of {list(LABEL_TO_CODE)}")
    return codes.astype("int16").values


def _optional_number(frame: pd.DataFrame, column: str, low: float, high: float) -> np.ndarray | None:
    if column not in frame.columns:
        return None
    values = pd.to_numeric(frame[column], errors="coerce")
    if values.isna().sum() != frame[column].isna().sum():
        raise IngestError(f"results: {column} holds values that are not numbers")
    bad = values.notna() & ((values < low) | (values > high))
    if bad.any():
        raise IngestError(f"results: {column} must be between {low:g} and {high:g}; {int(bad.sum())} rows are not")
    return values.astype("float32").values


def read_results(data: bytes, name: str) -> pd.DataFrame:
    """Validated results: building_id, damage_class (int16 0-4) and the optional columns (None where absent)."""
    lower = name.lower()
    try:
        if lower.endswith(".parquet"):
            frame = pd.read_parquet(io.BytesIO(data))
        elif lower.endswith(".csv"):
            frame = pd.read_csv(io.BytesIO(data), dtype={"building_id": str})
        else:
            raise IngestError(f"results must be .parquet or .csv, not '{name}'")
    except IngestError:
        raise
    except Exception as e:
        raise IngestError(f"results: could not read '{name}' ({e})")
    missing = [c for c in ("building_id", "damage_class") if c not in frame.columns]
    if missing:
        raise IngestError(f"results: missing column(s) {missing}; found {list(frame.columns)}")
    if frame.empty:
        raise IngestError("results: the file has no rows")

    out = pd.DataFrame({
        "building_id": _building_ids(frame["building_id"], "results").values,
        "damage_class": _class_codes(frame["damage_class"]),
    })
    out["confidence"] = _optional_number(frame, "confidence", 0, 1)
    out["damage_pct"] = _optional_number(frame, "damage_pct", 0, 100)
    out["imagery_ref"] = frame["imagery_ref"].astype(object).where(frame["imagery_ref"].notna(), None).values \
        if "imagery_ref" in frame.columns else None
    if "assessed_at" in frame.columns:
        stamps = pd.to_datetime(frame["assessed_at"], errors="coerce", utc=True)
        if stamps.isna().sum() != frame["assessed_at"].isna().sum():
            raise IngestError("results: assessed_at holds values that are not timestamps")
        out["assessed_at"] = stamps.values
    else:
        out["assessed_at"] = None
    return out


# ---------------------------------------------------------------- manifest

def read_manifest(data: bytes) -> dict:
    try:
        raw = json.loads(data)
    except Exception as e:
        raise IngestError(f"manifest: not valid JSON ({e})")
    if not isinstance(raw, dict):
        raise IngestError("manifest: must be a JSON object")
    missing = [k for k in ("event_name", "imagery_date", "footprint_set") if not str(raw.get(k) or "").strip()]
    if missing:
        raise IngestError(f"manifest: missing {missing}")
    try:
        imagery_date = date.fromisoformat(str(raw["imagery_date"]))
    except ValueError:
        raise IngestError(f"manifest: imagery_date must be YYYY-MM-DD, not '{raw['imagery_date']}'")
    return {
        "event_name": str(raw["event_name"]).strip(),
        "aoi_name": str(raw["aoi_name"]).strip() if raw.get("aoi_name") else None,
        "imagery_date": imagery_date,
        "model": str(raw["model"]).strip() if raw.get("model") else None,
        "footprint_set": str(raw["footprint_set"]).strip(),
        "data_source": str(raw.get("data_source") or "real").strip(),
    }
