"""Batch job: score the newest uploaded features file and publish the result to Postgres.

Reads  the most recently uploaded .csv/.parquet in FEATURES_URI (h3_cell, date + the model features).
       The file is validated here, and the prediction date comes from its own date column.
Fills  a sparse upload out to every Texas cell: uploaded cells keep their values, the rest get their
       fixed features from data/texas_cells.parquet and their weather from the nearest uploaded
       cells (KNN, inverse-distance weighted).
Writes the run and its cells to Postgres (DATABASE_URL). The API and the map read only from there.
       A short status.json is also written to STATUS_URI so operators can see the outcome in the
       storage browser.

URIs are local folders or az://<account>/<container>/<prefix>. Azure auth uses DefaultAzureCredential
(managed identity in Azure, `az login` locally).

The job is meant to run every few minutes: it exits immediately unless the newest upload is one it has not
processed yet (FORCE=1 re-scores it anyway), so a file is scored within minutes of being uploaded.

Env: DATABASE_URL, FEATURES_URI, STATUS_URI (optional), MODEL_DIR (default ./model),
     TARGET_FILE (optional: score this file instead of the newest), FILL=0 to skip the Texas fill.
"""
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from shapely import contains_xy
from shapely.geometry import shape

import db
from ignition_core import ModelBundle, ensure_latlon, fill_texas
from ingest import IngestError, load_table, prepare
from store import Store

HERE = Path(__file__).resolve().parent
TEXAS_GEOJSON = Path(os.environ.get("TEXAS_GEOJSON", HERE / "data" / "texas.geojson"))


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def load_texas_cells():
    path = Path(os.environ.get("TEXAS_CELLS", HERE / "data" / "texas_cells.parquet"))
    if os.environ.get("FILL", "1") == "0" or not path.exists():
        return None
    return pd.read_parquet(path)


def clip_to_texas(out: pd.DataFrame) -> pd.DataFrame:
    """Keep only cells whose centre is inside Texas (uploaded files may cover a wider rectangle)."""
    if not TEXAS_GEOJSON.exists():
        print(f"WARNING: {TEXAS_GEOJSON} not found; not clipping to Texas")
        return out
    gj = json.loads(TEXAS_GEOJSON.read_text())
    texas = shape(gj["geometry"] if gj["type"] == "Feature" else gj)
    inside = contains_xy(texas, out["lon"].values.astype("float64"), out["lat"].values.astype("float64"))
    return out[inside].reset_index(drop=True)


def report(status_store, conn, name, uploaded_at, ok: bool, **info) -> None:
    """Record the outcome in status.json (best effort) and, for failures, in the database."""
    if status_store is not None:
        try:
            status_store.write_json("status.json", {"status": "ok" if ok else "error", "file": name,
                                                    "at": now_iso(), **info})
        except Exception as e:  # never let reporting hide the real result
            print(f"WARNING: could not write status.json: {e}", file=sys.stderr)
    if not ok and conn is not None:
        try:
            db.record_error(conn, name, info.get("error", "unknown error"), uploaded_at)
        except Exception as e:
            print(f"WARNING: could not record the error in the database: {e}", file=sys.stderr)


def main() -> int:
    t0 = time.time()
    features_uri = os.environ["FEATURES_URI"]
    status_uri = os.environ.get("STATUS_URI")
    model_dir = Path(os.environ.get("MODEL_DIR", HERE / "model"))

    feats = Store(features_uri)
    status_store = Store(status_uri) if status_uri else None
    conn = db.connect(autocommit=True)
    db.ensure_schema(conn)
    if not db.try_lock(conn):
        print("another scoring run is in progress; exiting")
        return 0

    def fail(name, message, uploaded_at=None) -> int:
        print(f"ERROR: {message}", file=sys.stderr)
        report(status_store, conn, name, uploaded_at, False, error=message)
        db.job_finished(conn, False)
        return 1

    files = feats.list_info((".csv", ".parquet"))
    if not files:
        return fail(None, f"no .csv or .parquet files in {features_uri}")
    target = os.environ.get("TARGET_FILE")
    if target:
        match = [f for f in files if f[0] == target]
        if not match:
            return fail(target, f"{target} not found; have {[f[0] for f in files[-5:]]}")
        name, uploaded_at = match[0]
    else:
        name, uploaded_at = files[-1]  # most recently uploaded
    if os.environ.get("FORCE") != "1" and db.already_processed(conn, name, uploaded_at):
        print(f"nothing new: {name} (uploaded {uploaded_at}) was already processed")
        return 0
    db.job_started(conn)
    print(f"scoring {name} (uploaded {uploaded_at}) from {features_uri}")

    bundle = ModelBundle(model_dir)
    try:
        df, ts, source = prepare(load_table(feats.read_bytes(name), name), bundle.features)
    except IngestError as e:
        return fail(name, str(e), uploaded_at)
    date = str(ts.date())
    n_uploaded = len(df)
    print(f"read {n_uploaded:,} rows for {date} (source={source})")

    cells = load_texas_cells()
    if cells is not None:
        # Sparse uploads are expanded to every Texas cell with nearest-neighbour weather.
        df, n_observed, n_far = fill_texas(df, bundle.features, cells)
        print(f"filled to {len(df):,} Texas cells: {n_observed:,} from the upload, {len(df) - n_observed:,} by KNN, "
              f"{n_far:,} left out as too far from any uploaded cell")
    else:
        df = ensure_latlon(df)
        df["observed"] = True
        n_observed = n_uploaded
        n_far = 0
        print("WARNING: no Texas cell table; scoring only the uploaded cells")

    raw, cal = bundle.score(df)  # raises on missing columns / nulls
    out = pd.DataFrame(
        {
            "h3_cell": df["h3_cell"].values,
            "lat": df["lat"].values.astype("float32"),
            "lon": df["lon"].values.astype("float32"),
            "raw_probability": raw.astype("float32"),
            "probability": cal.astype("float32"),
            "observed": df["observed"].values,
        }
    )
    out = clip_to_texas(out)
    n_ignored = n_uploaded - n_observed
    print(f"{len(out):,} Texas cells scored ({n_ignored:,} uploaded cells not in the Texas cell table were ignored)")
    if out.empty:
        return fail(name, "no cells inside Texas", uploaded_at)

    meta = {
        "for_date": date,
        "source_file": name,
        "uploaded_at": uploaded_at,
        "data_source": source,
        "model": bundle.name,
        "n_input_cells": int(n_uploaded),
        "n_observed_cells": int(n_observed),
        "n_filled_cells": int(len(out) - n_observed),
        "n_skipped_far": int(n_far),
        "fill_method": "knn_idw_k8" if cells is not None else "none",
    }
    try:
        run_id = db.publish_run(conn, out, meta)
    except Exception as e:
        return fail(name, f"database write failed: {e}", uploaded_at)

    report(status_store, conn, name, uploaded_at, True, for_date=date, run_id=run_id, n_cells=int(len(out)))
    db.job_finished(conn, True)
    print(f"run {run_id}: {len(out):,} cells for {date} published to Postgres "
          f"(source={source}, mean p={out['probability'].mean():.3f}) in {time.time() - t0:.1f}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
