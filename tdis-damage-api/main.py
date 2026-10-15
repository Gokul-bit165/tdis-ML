"""
TDIS Damage Assessment API.
Read-only FastAPI service serving damage assessment summaries, building details,
and Mapbox Vector Tiles (MVT).
"""
import os
import threading
import time
from contextlib import asynccontextmanager
from typing import Any, Dict, Optional, Set

from fastapi import APIRouter, FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from psycopg_pool import ConnectionPool

import db

# Class code to exact human-readable label mapping (0 to 4)
DAMAGE_CLASS_LABELS: Dict[int, str] = {
    0: "Undamaged",
    1: "Partial Roof Damage",
    2: "Total Roof Damage",
    3: "Partial Structural Collapse",
    4: "Total Structural Collapse",
}

PUBLISHED_CACHE_TTL_SECONDS = 30.0

state: Dict[str, Any] = {}
_lock = threading.Lock()


def get_cors_origins() -> list[str]:
    raw = os.environ.get(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080,http://127.0.0.1:8080",
    )
    return [o.strip() for o in raw.split(",") if o.strip()]


@asynccontextmanager
async def lifespan(_: FastAPI):
    pool = None
    url = os.environ.get("DATABASE_URL")
    if url:
        pool = ConnectionPool(
            url,
            min_size=0,
            max_size=8,
            open=False,
            timeout=15,
            kwargs={"autocommit": True},
        )
        pool.open(wait=False)
    state.update(
        pool=pool,
        published_ids=set(),
        published_checked=0.0,
    )
    yield
    if pool is not None:
        pool.close()
    state.clear()


app = FastAPI(
    title="TDIS Damage Assessment API",
    version="1.0.0",
    lifespan=lifespan,
)

# GZip middleware for responses >= 1024 bytes
app.add_middleware(GZipMiddleware, minimum_size=1024)

# CORS middleware: GET only
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_methods=["GET"],
    allow_headers=["*"],
)


def get_pool() -> ConnectionPool:
    p = state.get("pool")
    if p is None:
        raise HTTPException(status_code=503, detail="DATABASE_URL is not configured on this instance.")
    return p


def with_db(fn):
    """Run fn(conn) on a pooled connection; any database failure becomes a 503."""
    try:
        with get_pool().connection() as conn:
            return fn(conn)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {type(e).__name__}")


def get_published_ids() -> Set[int]:
    """Retrieve published assessment IDs with a 30-second in-memory cache."""
    now = time.time()
    last_checked = state.get("published_checked", 0.0)
    if now - last_checked < PUBLISHED_CACHE_TTL_SECONDS and "published_ids" in state:
        return state["published_ids"]

    with _lock:
        now = time.time()
        last_checked = state.get("published_checked", 0.0)
        if now - last_checked < PUBLISHED_CACHE_TTL_SECONDS and "published_ids" in state:
            return state["published_ids"]

        ids = with_db(db.get_published_assessment_ids)
        state["published_ids"] = ids
        state["published_checked"] = now
        return ids


def validate_tile_coords(z: int, x: int, y: int):
    """Validate 0 <= z <= 16 and 0 <= x, y < 2^z, otherwise raise 422."""
    if z < 0 or z > 16:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid tile zoom {z}: must be between 0 and 16.",
        )
    max_coord = 1 << z
    if x < 0 or x >= max_coord or y < 0 or y >= max_coord:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid tile coordinate ({x}, {y}) at zoom {z}: x and y must be between 0 and {max_coord - 1}.",
        )


router = APIRouter(prefix="/api/v1/damage")


@router.get("/assessments")
def list_assessments(response: Response):
    """Return all published assessments, newest first."""
    assessments = with_db(db.get_assessments)
    response.headers["Cache-Control"] = "public, max-age=30"
    return assessments


@router.get("/assessments/{aid}/buildings/{building_id}")
def get_building(aid: int, building_id: str, response: Response):
    """Return details for a single building in a published assessment."""
    published_ids = get_published_ids()
    if aid not in published_ids:
        raise HTTPException(status_code=404, detail=f"Assessment {aid} not found or not published.")

    building = with_db(lambda conn: db.get_building_detail(conn, aid, building_id))
    if not building:
        raise HTTPException(
            status_code=404,
            detail=f"Building '{building_id}' not found in assessment {aid}.",
        )

    dc = building.get("damage_class")
    building["damage_label"] = DAMAGE_CLASS_LABELS.get(dc) if dc is not None else None

    response.headers["Cache-Control"] = "public, max-age=604800, immutable"
    return building


def serve_tile(aid: int, z: int, x: int, y: int, query_fn) -> Response:
    validate_tile_coords(z, x, y)
    published_ids = get_published_ids()
    if aid not in published_ids:
        raise HTTPException(status_code=404, detail=f"Assessment {aid} not found or not published.")

    tile_bytes = with_db(lambda conn: query_fn(conn, aid, z, x, y))
    headers = {"Cache-Control": "public, max-age=604800, immutable"}

    if not tile_bytes or len(tile_bytes) == 0:
        return Response(status_code=204, headers=headers)

    return Response(
        content=tile_bytes,
        status_code=200,
        media_type="application/vnd.mapbox-vector-tile",
        headers=headers,
    )


@router.get("/tiles/{aid}/h3/{z}/{x}/{y}.mvt")
def get_h3_tile(aid: int, z: int, x: int, y: int):
    """Vector tiles for H3 aggregated hexagons."""
    return serve_tile(aid, z, x, y, db.get_h3_mvt)


@router.get("/tiles/{aid}/buildings/{z}/{x}/{y}.mvt")
def get_buildings_tile(aid: int, z: int, x: int, y: int):
    """Vector tiles for building footprints."""
    return serve_tile(aid, z, x, y, db.get_buildings_mvt)


@router.get("/tiles/{aid}/density/{z}/{x}/{y}.mvt")
def get_density_tile(aid: int, z: int, x: int, y: int):
    """Vector tiles for building density points."""
    return serve_tile(aid, z, x, y, db.get_density_mvt)


@router.get("/health")
@app.get("/health")
def health():
    """Health check endpoint indicating service and database status."""
    db_ok = False
    try:
        db_ok = with_db(db.check_health)
    except Exception:
        db_ok = False

    if not db_ok:
        raise HTTPException(status_code=503, detail="Database unavailable")

    return {"status": "ok", "service": "tdis-damage-api", "database": "connected"}


app.include_router(router)
