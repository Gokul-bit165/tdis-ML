"""
TDIS Ignition BIT model API.

Serves wildfire-ignition predictions to the TDIS portal map. Predictions are written to Postgres by
the scoring job (score_job.py); this API reads only from the database, and also exposes the model
itself for scoring caller-supplied rows.

Endpoints (all under /api/v1/ignition):
  GET  /coverage?res=4..8&bbox=w,s,e,n[&date=YYYY-MM-DD]   hexagons of the current run (feeds the map)
  GET  /runs                                                recent scoring runs, newest first
  GET  /status                                              the latest run, including a rejected upload
  GET  /model-info                                          training metrics, feature list
  POST /predict                                             score caller-supplied feature rows

Env: DATABASE_URL (required), MODEL_DIR, CORS_ORIGINS.
"""
import os
import threading
import time
from contextlib import asynccontextmanager
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from psycopg_pool import ConnectionPool
from pydantic import BaseModel, Field

import db
from ignition_core import ModelBundle

HERE = Path(__file__).resolve().parent
MODEL_DIR = Path(os.environ.get("MODEL_DIR", HERE / "model"))
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")

# Calibrated-probability bands for the map legend.
RISK_BANDS = [(0.6, "very_high"), (0.4, "high"), (0.2, "moderate"), (0.0, "low")]
COVERAGE_RESOLUTIONS = (4, 5, 6, 7, 8)
BBOX_REQUIRED_FROM_RES = 7  # statewide hexagons this fine would be 100k+ polygons
CURRENT_RUN_REFRESH_SECONDS = 30
CACHE_MAX_ENTRIES = 12

state: dict = {}
_lock = threading.Lock()


def risk_level(p: float) -> str:
    for floor, name in RISK_BANDS:
        if p >= floor:
            return name
    return "low"


@asynccontextmanager
async def lifespan(_: FastAPI):
    bundle = ModelBundle(MODEL_DIR)
    pool = None
    url = os.environ.get("DATABASE_URL")
    if url:
        # Open lazily so the API still starts (and /health reports the problem) if the database is down.
        pool = ConnectionPool(url, min_size=0, max_size=4, open=False, timeout=15,
                              kwargs={"autocommit": True})
        pool.open(wait=False)
    state.update(bundle=bundle, pool=pool, current=None, current_checked=0.0, cache={})
    yield
    if pool is not None:
        pool.close()
    state.clear()


app = FastAPI(title="TDIS Ignition BIT API", version="2.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_methods=["GET", "POST"], allow_headers=["*"])


def pool() -> ConnectionPool:
    if state.get("pool") is None:
        raise HTTPException(503, "DATABASE_URL is not configured on this instance.")
    return state["pool"]


def with_db(fn):
    """Run fn(conn) on a pooled connection; any database failure becomes a 503."""
    try:
        with pool().connection() as conn:
            return fn(conn)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(503, f"Database unavailable: {type(e).__name__}")


def current_run(for_date: str | None) -> dict:
    """The run to serve. The current run is re-checked at most every CURRENT_RUN_REFRESH_SECONDS."""
    if for_date is None and state["current"] and time.time() - state["current_checked"] < CURRENT_RUN_REFRESH_SECONDS:
        return state["current"]
    run = with_db(lambda c: db.current_run(c, for_date))
    if run is None:
        raise HTTPException(404, f"No predictions for {for_date}." if for_date else "No predictions have been published yet.")
    if for_date is None:
        state["current"], state["current_checked"] = run, time.time()
    return run


def iso(v):
    return v.isoformat() if hasattr(v, "isoformat") else v


@app.get("/health")
def health():
    ok = False
    if state.get("pool") is not None:
        try:
            with state["pool"].connection() as conn:
                conn.execute("SELECT 1")
            ok = True
        except Exception:
            ok = False
    return {"status": "ok", "model_loaded": "bundle" in state, "model": state["bundle"].name,
            "database_configured": state.get("pool") is not None, "database_ok": ok}


@app.get("/api/v1/ignition/model-info")
def model_info():
    b = state["bundle"]
    r = b.results
    return {
        "model": b.name,
        "n_features": len(b.features),
        "features": b.features,
        "built": r.get("built"),
        "hyperparameters": r.get("final_hyperparameters"),
        "metrics_raw": r.get("metrics_raw"),
        "metrics_calibrated": r.get("metrics_calibrated"),
        "positive_rate": r.get("positive_rate"),
        "split_date_ranges": r.get("split_date_ranges"),
        "risk_bands": [{"min": f, "level": n} for f, n in reversed(RISK_BANDS)],
        "note": "Metrics are on a matched ~30% positive-rate sample, not real-population rates.",
    }


def parse_bbox(raw: str | None) -> tuple | None:
    if not raw:
        return None
    try:
        west, south, east, north = (float(x) for x in raw.split(","))
    except ValueError:
        raise HTTPException(422, "bbox must be 'west,south,east,north' in degrees")
    if not (-180 <= west < east <= 180 and -90 <= south < north <= 90):
        raise HTTPException(422, "bbox out of range")
    return west, south, east, north


def run_meta(run: dict) -> dict:
    return {
        "for_date": iso(run["for_date"]),
        "uploaded_at": iso(run["uploaded_at"]),
        "generated_at": iso(run["generated_at"]),
        "source_file": run["source_file"],
        "data_source": run["data_source"],
        "model": run["model"],
    }


@app.get("/api/v1/ignition/coverage")
def coverage(
    date: str | None = Query(None, description="Prediction date YYYY-MM-DD; defaults to the current run"),
    res: int = Query(5, description="H3 resolution of the returned hexagons (4-8)"),
    bbox: str | None = Query(None, description="west,south,east,north; required for res >= 7"),
):
    """Hexagons of the current run at H3 resolution `res`, read from Postgres."""
    if res not in COVERAGE_RESOLUTIONS:
        raise HTTPException(422, f"res must be one of {COVERAGE_RESOLUTIONS}")
    window = parse_bbox(bbox)
    if res >= BBOX_REQUIRED_FROM_RES and window is None:
        raise HTTPException(422, f"res {res} needs a bbox (west,south,east,north)")
    if date is not None:
        try:
            pd.Timestamp(date)
        except Exception:
            raise HTTPException(422, "date must be YYYY-MM-DD")

    run = current_run(date)
    key = (run["run_id"], res)
    rows = state["cache"].get(key) if window is None else None
    if rows is None:
        rows = with_db(lambda c: db.hexagons(c, run["run_id"], res, window))
        if window is None:
            with _lock:
                if len(state["cache"]) >= CACHE_MAX_ENTRIES:
                    state["cache"].pop(next(iter(state["cache"])))
                state["cache"][key] = rows

    meta = run_meta(run)
    cells = [
        {
            "hex_id": r["hex_id"],
            "probability": round(float(r["probability"]), 4),
            "max_probability": round(float(r["max_probability"]), 4),
            "n_cells": int(r["n_cells"]),
            "n_observed": int(r["n_observed"]),
            "risk_level": risk_level(float(r["probability"])),
            "for_date": meta["for_date"],
            "data_date": meta["for_date"],
            "uploaded_at": meta["uploaded_at"],
            "source_file": meta["source_file"],
            "last_updated": meta["generated_at"],
            "data_source": meta["data_source"],
        }
        for r in rows
    ]
    return {"date": meta["for_date"], **meta, "run_id": run["run_id"], "resolution": res,
            "count": len(cells), "cells": cells}


@app.get("/api/v1/ignition/runs")
def runs(limit: int = Query(30, ge=1, le=200)):
    out = with_db(lambda c: db.list_runs(c, limit))
    return {"runs": [{k: iso(v) for k, v in r.items()} for r in out]}


@app.get("/api/v1/ignition/status")
def status():
    """Newest run, successful or not, so a rejected upload is visible."""
    out = with_db(lambda c: db.list_runs(c, 1))
    if not out:
        raise HTTPException(404, "No runs yet.")
    return {k: iso(v) for k, v in out[0].items()}


class PredictRequest(BaseModel):
    rows: list[dict[str, float]] = Field(..., min_length=1, max_length=10000,
                                         description="Each row must contain every model feature (see /model-info)")


@app.post("/api/v1/ignition/predict")
def predict(req: PredictRequest):
    bundle = state["bundle"]
    frame = pd.DataFrame(req.rows)
    missing = [f for f in bundle.features if f not in frame.columns]
    if missing:
        raise HTTPException(422, {"error": "missing features", "missing": missing})
    raw, cal = bundle.score(frame)
    return {
        "predictions": [
            {"raw_probability": round(float(r), 4), "probability": round(float(c), 4),
             "risk_level": risk_level(float(c))}
            for r, c in zip(raw, cal)
        ]
    }
