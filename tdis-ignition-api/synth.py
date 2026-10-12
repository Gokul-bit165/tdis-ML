"""Generate SYNTHETIC daily features for the ignition model, for testing the pipeline end to end.

Replaces the real-time feature feed until it exists. Every row is tagged data_source='synthetic'
and the file is written to the features folder as <target-date>.parquet. Delete it (and
the matching predictions) when real data arrives.

How it fakes a day: take the real weather of a past reference day (same time of year, e.g.
2025-10-06), interpolate it to every Texas cell, then apply a random daily shift and per-cell
noise so the result is plausible but not a copy. Terrain/fuel/road features are the real
per-cell values.

  python synth.py --target-date 2026-10-06 --out az://datatexas/wildfire-data/daily-features
"""
import argparse
import json
import os
from pathlib import Path

import numpy as np
import pandas as pd
from shapely import contains_xy
from shapely.geometry import shape

from ignition_core import (
    DAY_CONSTANT, SPATIAL_DYNAMIC, STATIC_FEATURES, ModelBundle, add_derived, calendar_features,
    ensure_latlon, idw_interpolate,
)
from store import Store

HERE = Path(__file__).resolve().parent
MODEL_DIR = Path(os.environ.get("MODEL_DIR", HERE / "model"))
DATA_PATH = Path(os.environ.get(
    "DATA_PATH", HERE.parent / "TDIS_Ignition_BIT_V2" / "data" / "processed" / "bit_v2_train_tx.parquet"
))
TEXAS_GEOJSON = Path(os.environ.get("TEXAS_GEOJSON", HERE.parent / "tdis-portal-frontend" / "public" / "texas.geojson"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--target-date", required=True, help="date the features are FOR, YYYY-MM-DD")
    ap.add_argument("--reference-date", help="past day whose weather is replayed (default: same day last year)")
    ap.add_argument("--out", required=True, help="folder or az://account/container/prefix for features")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    target = pd.Timestamp(args.target_date)
    ref = pd.Timestamp(args.reference_date) if args.reference_date else target - pd.DateOffset(years=1)
    rng = np.random.default_rng(args.seed)

    features = ModelBundle(MODEL_DIR).features
    df = ensure_latlon(pd.read_parquet(DATA_PATH, columns=["h3_cell", "date", *features]))

    day = df[df["date"] == ref]
    if day.empty:  # nearest available day
        avail = df["date"].drop_duplicates()
        ref = avail.iloc[(avail - ref).abs().argmin()]
        day = df[df["date"] == ref]
    print(f"reference day {ref.date()} ({len(day)} sampled cells) -> target {target.date()}")

    # lat/lon are not model features but are needed to clip to Texas and interpolate weather.
    static = [c for c in STATIC_FEATURES if c in df.columns]
    cells = df.drop_duplicates("h3_cell")[["h3_cell", *static]].reset_index(drop=True)
    gj = json.loads(TEXAS_GEOJSON.read_text())
    texas = shape(gj["geometry"] if gj["type"] == "Feature" else gj)
    keep = contains_xy(texas, cells["lon"].values.astype("float64"), cells["lat"].values.astype("float64"))
    cells = cells[keep].reset_index(drop=True)
    print(f"{len(cells):,} Texas cells")

    out = cells.copy()
    dyn = idw_interpolate(day, cells, SPATIAL_DYNAMIC)

    # Daily shift (the whole state is a bit warmer/drier/windier than the reference day) + per-cell noise.
    n = len(cells)
    out["hrrr_tmp"] = dyn["hrrr_tmp"] + rng.normal(0, 1.5) + rng.normal(0, 0.4, n)
    out["hrrr_vpd"] = (dyn["hrrr_vpd"] * rng.lognormal(0, 0.10) * rng.lognormal(0, 0.03, n)).clip(lower=0)
    out["hrrr_wind"] = (dyn["hrrr_wind"] * rng.lognormal(0, 0.15) * rng.lognormal(0, 0.05, n)).clip(lower=0)
    out["hrrr_mstav"] = (dyn["hrrr_mstav"] + rng.normal(0, 0.02, n)).clip(lower=0)
    out["drought_score"] = (dyn["drought_score"] + rng.normal(0, 0.1) + rng.normal(0, 0.05, n)).clip(lower=0)
    out["fm100_5d_min"] = (dyn["fm100_5d_min"] + rng.normal(0, 0.8) + rng.normal(0, 0.2, n)).clip(lower=0)

    for col in DAY_CONSTANT:
        out[col] = np.float32(day[col].median())
    for k, v in calendar_features(target).items():
        out[k] = np.float32(v)
    add_derived(out)

    out = out[["h3_cell", *features]].copy()
    out[features] = out[features].astype("float32")
    out.insert(1, "date", target)
    out["data_source"] = "synthetic"
    assert not out[features].isnull().any().any(), "synthetic features contain nulls"

    store = Store(args.out)
    name = f"{target.date()}.parquet"
    store.write_parquet(name, out)
    print(f"wrote {name}: {len(out):,} rows x {len(features)} features to {args.out}")


if __name__ == "__main__":
    main()
