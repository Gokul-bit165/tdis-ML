"""Generate a synthetic damage assessment for development and tests. NOT real data.

Writes the same files a real upload has, in the layout `damage_job.py poll` reads:

  <out>/footprints/<set>.parquet                 GeoParquet: building_id, geometry
  <out>/assessments/<run>/results.parquet        building_id, damage_class, confidence
  <out>/assessments/<run>/manifest.json          data_source = "synthetic", so the map shows its test banner

Buildings are small rotated rectangles clustered into towns over a rural background. Damage follows a storm
track across the area: severe near the line, fading with distance. A share of buildings is left unassessed.

  python synth_damage.py --buildings 200000 --out _local/in
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
import shapely

# Greater Houston by default: (west, south, east, north)
DEFAULT_BBOX = (-95.80, 29.50, -95.00, 30.10)
M_PER_DEG_LAT = 111_320.0


def make_footprints(n: int, bbox: tuple, rng: np.random.Generator) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """n rectangles as shapely polygons, plus their centre longitudes and latitudes."""
    west, south, east, north = bbox
    n_towns = max(3, n // 15_000)
    town_lng = rng.uniform(west + 0.05, east - 0.05, n_towns)
    town_lat = rng.uniform(south + 0.05, north - 0.05, n_towns)
    town_size = rng.uniform(0.01, 0.06, n_towns)
    urban = rng.random(n) < 0.85
    town = rng.integers(0, n_towns, n)
    lng = np.where(urban, town_lng[town] + rng.normal(0, 1, n) * town_size[town], rng.uniform(west, east, n))
    lat = np.where(urban, town_lat[town] + rng.normal(0, 1, n) * town_size[town] * 0.85, rng.uniform(south, north, n))
    lng = np.clip(lng, west, east)
    lat = np.clip(lat, south, north)

    half_w = rng.uniform(4, 12, n)  # metres
    half_h = rng.uniform(4, 9, n)
    angle = rng.uniform(0, np.pi, n)
    corners = np.array([[-1, -1], [1, -1], [1, 1], [-1, 1]], dtype="float64")
    dx = corners[:, 0][None, :] * half_w[:, None]
    dy = corners[:, 1][None, :] * half_h[:, None]
    east_m = dx * np.cos(angle)[:, None] - dy * np.sin(angle)[:, None]
    north_m = dx * np.sin(angle)[:, None] + dy * np.cos(angle)[:, None]
    m_per_deg_lng = M_PER_DEG_LAT * np.cos(np.radians(lat))
    ring = np.stack([lng[:, None] + east_m / m_per_deg_lng[:, None], lat[:, None] + north_m / M_PER_DEG_LAT], axis=2)
    return shapely.polygons(ring), lng, lat


def make_classes(lng: np.ndarray, lat: np.ndarray, bbox: tuple, rng: np.random.Generator) -> np.ndarray:
    """Damage class 0 to 4 from distance to a storm track running south-west to north-east."""
    west, south, east, north = bbox
    ax, ay, bx, by = west, south + 0.25 * (north - south), east, south + 0.75 * (north - south)
    px, py = lng - ax, lat - ay
    vx, vy = bx - ax, by - ay
    t = np.clip((px * vx + py * vy) / (vx * vx + vy * vy), 0, 1)
    dist_km = np.hypot(px - t * vx, py - t * vy) * 100.0
    severity = np.exp(-(dist_km / 6.0) ** 2) * 4.2 + rng.normal(0, 0.55, len(lng))
    return np.clip(np.round(severity), 0, 4).astype("int8")


def write_geoparquet(path: Path, building_id: np.ndarray, geoms: np.ndarray) -> None:
    table = pa.table({"building_id": building_id, "geometry": pa.array(shapely.to_wkb(geoms).tolist(), pa.binary())})
    geo = {"version": "1.0.0", "primary_column": "geometry",
           "columns": {"geometry": {"encoding": "WKB", "geometry_types": ["Polygon"],
                                    "crs": {"id": {"authority": "EPSG", "code": 4326}, "name": "WGS 84"}}}}
    table = table.replace_schema_metadata({**(table.schema.metadata or {}), b"geo": json.dumps(geo).encode()})
    path.parent.mkdir(parents=True, exist_ok=True)
    pq.write_table(table, path, compression="zstd")


def generate(out: Path, n: int = 50_000, bbox: tuple = DEFAULT_BBOX, set_name: str = "synthetic_houston",
             run: str = "synthetic_run_001", assessed_share: float = 0.85, seed: int = 7,
             imagery_date: str = "2026-10-08") -> dict:
    """Write one footprint set and one run. Returns the paths and the counts that were written."""
    rng = np.random.default_rng(seed)
    geoms, lng, lat = make_footprints(n, bbox, rng)
    building_id = np.array([f"SYN-{i:08d}" for i in range(n)], dtype=object)
    cls = make_classes(lng, lat, bbox, rng)
    assessed = rng.random(n) < assessed_share

    footprints = out / "footprints" / f"{set_name}.parquet"
    write_geoparquet(footprints, building_id, geoms)

    run_dir = out / "assessments" / run
    run_dir.mkdir(parents=True, exist_ok=True)
    results = run_dir / "results.parquet"
    pd.DataFrame({
        "building_id": building_id[assessed],
        "damage_class": cls[assessed],
        "confidence": rng.uniform(0.55, 0.99, int(assessed.sum())).astype("float32"),
    }).to_parquet(results, index=False, compression="zstd")
    manifest = run_dir / "manifest.json"
    manifest.write_text(json.dumps({
        "event_name": "Synthetic storm (test data)",
        "aoi_name": "Greater Houston (synthetic)",
        "imagery_date": imagery_date,
        "model": "synthetic-generator",
        "footprint_set": set_name,
        "data_source": "synthetic",
    }, indent=2), encoding="utf-8")
    return {"footprints": footprints, "results": results, "manifest": manifest, "n_buildings": n,
            "n_assessed": int(assessed.sum()), "class_counts": np.bincount(cls[assessed], minlength=5).tolist()}


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate a synthetic damage assessment (test data)")
    parser.add_argument("--out", default="_local/in")
    parser.add_argument("--buildings", type=int, default=50_000)
    parser.add_argument("--set-name", default="synthetic_houston")
    parser.add_argument("--run", default="synthetic_run_001")
    parser.add_argument("--assessed-share", type=float, default=0.85)
    parser.add_argument("--seed", type=int, default=7)
    args = parser.parse_args()
    info = generate(Path(args.out), args.buildings, set_name=args.set_name, run=args.run,
                    assessed_share=args.assessed_share, seed=args.seed)
    for key, value in info.items():
        print(f"{key}: {value}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
