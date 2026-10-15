"""Postgres storage for damage assessments. Tables, view and tile functions come from migration 043
(tdis-damage-db/migrations). The loader writes; tdis-damage-api only reads.

A footprint set is loaded once. Every model run is then published as a new, immutable assessment in one
transaction: the assessment row, its results and its H3 cells are inserted, the totals are reconciled, and
only then does the transaction commit. A half-loaded or inconsistent assessment is never visible.

Connection: DATABASE_URL, e.g. postgresql://user:password@host:5432/db?sslmode=require
"""
from __future__ import annotations

import os
from pathlib import Path

import numpy as np
import pandas as pd
import psycopg
import shapely
from psycopg.rows import dict_row

from damage_core import N_CLASSES, NOT_ASSESSED, RESOLUTIONS, SRID, disk_order, envelope, hexagons

KEEP_ASSESSMENTS = int(os.environ.get("KEEP_ASSESSMENTS", "12"))
KEEP_ERROR_ROWS = 50
LOCK_KEY = 4304301  # advisory lock so two loads never overlap
BATCH_JOB = "Damage Assessment Loader Job"
TABLES = ("damage_footprint_sets", "damage_footprints", "damage_assessments", "damage_results", "damage_h3_cells")
# A cell's stored point is the mean of its buildings' points. H3 edges are great-circle arcs and the stored
# hexagon has straight sides, so allow the mean to sit this far (degrees, about 50 m) outside the polygon.
CELL_POINT_TOLERANCE_DEG = 0.0005

MIGRATION = Path(os.environ.get(
    "MIGRATION_FILE",
    Path(__file__).resolve().parent.parent / "tdis-damage-db" / "migrations" / "043_create_damage_assessment_tables.sql",
))


class ReconcileError(RuntimeError):
    """The loaded rows do not add up. The transaction is rolled back and nothing is published."""


def connect(url: str | None = None, **kw) -> psycopg.Connection:
    url = url or os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is not set")
    return psycopg.connect(url, **kw)


def apply_migration(conn: psycopg.Connection) -> None:
    with conn.transaction():
        conn.execute(MIGRATION.read_text(encoding="utf-8"))


def ensure_schema(conn: psycopg.Connection) -> None:
    """Check that migration 043 has been applied. AUTO_MIGRATE=1 applies the file (dev and tests only)."""
    def missing():
        return [t for t in TABLES if conn.execute("SELECT to_regclass(%s)", (t,)).fetchone()[0] is None]

    if missing() and os.environ.get("AUTO_MIGRATE") == "1":
        apply_migration(conn)
    if missing():
        raise RuntimeError(f"tables {missing()} not found: apply 043_create_damage_assessment_tables.sql first")


def try_lock(conn: psycopg.Connection) -> bool:
    """Take the session-level loader lock; False if another load holds it."""
    return bool(conn.execute("SELECT pg_try_advisory_lock(%s)", (LOCK_KEY,)).fetchone()[0])


def _has_batch_jobs(conn: psycopg.Connection) -> bool:
    return conn.execute("SELECT to_regclass('batch_jobs')").fetchone()[0] is not None


def job_started(conn: psycopg.Connection) -> None:
    """Mark the batch job STARTED in the portal's batch_jobs table (no-op where that table is absent)."""
    if _has_batch_jobs(conn):
        conn.execute("UPDATE batch_jobs SET lastrun_timestamp_start = now(), lastrun_timestamp_end = NULL, "
                     "lastrun_duration = NULL, lastrun_status = 'STARTED' WHERE batch_job = %s", (BATCH_JOB,))


def job_finished(conn: psycopg.Connection, ok: bool) -> None:
    if _has_batch_jobs(conn):
        conn.execute("UPDATE batch_jobs SET lastrun_timestamp_end = now(), "
                     "lastrun_duration = now() - lastrun_timestamp_start, "
                     "lastrun_status = %s::batch_job_status WHERE batch_job = %s",
                     ("COMPLETED" if ok else "FAILED", BATCH_JOB))


def _ewkb(geoms) -> list[str]:
    return shapely.to_wkb(np.asarray(geoms, dtype=object), hex=True, include_srid=True).tolist()


def _nullable(values) -> list:
    """Python values for COPY: NaN, NaT and None all become NULL."""
    series = pd.Series(values)
    return series.astype(object).where(series.notna(), None).tolist()


# ---------------------------------------------------------------- footprint sets

def footprint_set(conn: psycopg.Connection, name: str) -> dict | None:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT footprint_set_id, name, n_buildings FROM damage_footprint_sets WHERE name = %s", (name,))
        return cur.fetchone()


def load_footprint_set(conn: psycopg.Connection, footprints: pd.DataFrame, name: str,
                       source: str | None = None, source_file: str | None = None) -> int:
    """Store a validated footprint set (building_id, geom, pt, lat, lng). Returns the new footprint_set_id."""
    order = disk_order(footprints["lat"].values, footprints["lng"].values)
    ids = footprints["building_id"].values[order].tolist()
    geoms = _ewkb(footprints["geom"].values[order])
    pts = _ewkb(footprints["pt"].values[order])
    bbox = _ewkb([envelope(*shapely.total_bounds(footprints["geom"].values))])[0]

    with conn.transaction():
        set_id = conn.execute(
            "INSERT INTO damage_footprint_sets (name, source, source_file, n_buildings, bbox) "
            "VALUES (%s, %s, %s, %s, %s::geometry) RETURNING footprint_set_id",
            (name, source, source_file, len(ids), bbox),
        ).fetchone()[0]
        conn.execute("CREATE TEMP TABLE _damage_fp (ord integer, building_id text, geom geometry, pt geometry) "
                     "ON COMMIT DROP")
        with conn.cursor() as cur, cur.copy("COPY _damage_fp (ord, building_id, geom, pt) FROM STDIN") as copy:
            for row in zip(range(len(ids)), ids, geoms, pts):
                copy.write_row(row)
        # ST_Multi gives every row the column's MultiPolygon type; ORDER BY keeps neighbours together on disk.
        conn.execute("INSERT INTO damage_footprints (footprint_set_id, building_id, geom, pt) "
                     "SELECT %s, building_id, ST_Multi(geom), pt FROM _damage_fp ORDER BY ord", (set_id,))
        conn.execute("ANALYZE damage_footprints")
        n, outside, invalid = conn.execute(
            "SELECT count(*), count(*) FILTER (WHERE NOT ST_Covers(geom, pt)), count(*) FILTER (WHERE NOT ST_IsValid(geom)) "
            "FROM damage_footprints WHERE footprint_set_id = %s", (set_id,)).fetchone()
        if n != len(ids) or outside or invalid:
            raise ReconcileError(f"footprint set '{name}': stored {n} of {len(ids)} footprints, "
                                 f"{outside} with their point outside the outline, {invalid} invalid")
    return set_id


def footprint_points(conn: psycopg.Connection, set_id: int) -> pd.DataFrame:
    """building_id, lat, lng of every footprint in a set."""
    with conn.cursor() as cur, cur.copy(
        "COPY (SELECT building_id, ST_Y(pt), ST_X(pt) FROM damage_footprints WHERE footprint_set_id = %s) TO STDOUT",
        (set_id,),
    ) as copy:
        copy.set_types(["text", "float8", "float8"])
        return pd.DataFrame(list(copy.rows()), columns=["building_id", "lat", "lng"])


# ---------------------------------------------------------------- assessments

def already_processed(conn: psycopg.Connection, source_file: str, uploaded_at: str) -> bool:
    """True if this exact upload (same name and upload time) already produced a row, published or rejected."""
    return conn.execute(
        "SELECT 1 FROM damage_assessments WHERE source_file = %s AND uploaded_at = %s::timestamptz LIMIT 1",
        (source_file, uploaded_at),
    ).fetchone() is not None


def publish_assessment(conn: psycopg.Connection, set_id: int, results: pd.DataFrame, cells: pd.DataFrame,
                       class_of_building: np.ndarray, meta: dict) -> int:
    """Insert one model run and publish it, atomically. Returns the new assessment_id.

    `results`  validated rows from ingest.read_results
    `cells`    damage_core.aggregate output for every footprint of the set
    `class_of_building`  class code of every footprint in the set (NOT_ASSESSED where it has no result)
    `meta`     manifest fields plus source_file and uploaded_at
    """
    totals = np.bincount(class_of_building[class_of_building != NOT_ASSESSED], minlength=N_CLASSES)
    expected = {"n_buildings": int(len(class_of_building)), "n_assessed": int(totals.sum()),
                **{f"c{k}": int(totals[k]) for k in range(N_CLASSES)}}

    with conn.transaction():
        aid = conn.execute(
            """INSERT INTO damage_assessments (footprint_set_id, event_name, aoi_name, imagery_date, model, source_file,
                   uploaded_at, data_source, status, n_buildings, n_assessed, c0, c1, c2, c3, c4, bbox, published_at)
               VALUES (%(set_id)s, %(event_name)s, %(aoi_name)s, %(imagery_date)s, %(model)s, %(source_file)s,
                   %(uploaded_at)s, %(data_source)s, 'published', %(n_buildings)s, %(n_assessed)s,
                   %(c0)s, %(c1)s, %(c2)s, %(c3)s, %(c4)s,
                   (SELECT bbox FROM damage_footprint_sets WHERE footprint_set_id = %(set_id)s), now())
               RETURNING assessment_id""",
            {"source_file": None, "uploaded_at": None, "aoi_name": None, "model": None, **meta, **expected,
             "set_id": set_id},
        ).fetchone()[0]

        result_columns = ("building_id", "damage_class", "damage_pct", "confidence", "imagery_ref", "assessed_at")
        with conn.cursor() as cur, cur.copy(
            f"COPY damage_results (assessment_id, {', '.join(result_columns)}) FROM STDIN"
        ) as copy:
            for row in zip(*(_nullable(results[c]) for c in result_columns)):
                copy.write_row((aid, *row))

        count_columns = ("res", "h3", "n", "na", *(f"c{k}" for k in range(N_CLASSES)))
        dom = [None if d == NOT_ASSESSED else int(d) for d in cells["dom"].tolist()]
        geoms = _ewkb(hexagons(cells["h3"].tolist()))
        pts = _ewkb(shapely.set_srid(shapely.points(cells["lng"].values, cells["lat"].values), SRID))
        with conn.cursor() as cur, cur.copy(
            f"COPY damage_h3_cells (assessment_id, {', '.join(count_columns)}, dom, geom, pt) FROM STDIN"
        ) as copy:
            # .tolist() yields native Python values; psycopg cannot adapt numpy scalars.
            for row in zip(*(cells[c].tolist() for c in count_columns), dom, geoms, pts):
                copy.write_row((aid, *row))

        # Fresh statistics: without them the planner misjudges the just-loaded rows, here and in the tile queries.
        conn.execute("ANALYZE damage_results")
        conn.execute("ANALYZE damage_h3_cells")
        reconcile(conn, aid, set_id, expected)
        # Retention: keep the newest KEEP_ASSESSMENTS published runs, and a short history of rejected uploads.
        conn.execute(
            "DELETE FROM damage_assessments WHERE status = 'published' AND assessment_id NOT IN "
            "(SELECT assessment_id FROM damage_assessments WHERE status = 'published' ORDER BY assessment_id DESC LIMIT %s)",
            (KEEP_ASSESSMENTS,))
        conn.execute(
            "DELETE FROM damage_assessments WHERE status = 'error' AND assessment_id NOT IN "
            "(SELECT assessment_id FROM damage_assessments WHERE status = 'error' ORDER BY assessment_id DESC LIMIT %s)",
            (KEEP_ERROR_ROWS,))
    return aid


def reconcile(conn: psycopg.Connection, aid: int, set_id: int, expected: dict) -> None:
    """Checks run inside the publishing transaction. Any mismatch raises and rolls the load back."""
    class_sums = ", ".join(f"count(*) FILTER (WHERE damage_class = {k})" for k in range(N_CLASSES))
    stored = conn.execute(f"SELECT count(*), {class_sums} FROM damage_results WHERE assessment_id = %s", (aid,)).fetchone()
    want = (expected["n_assessed"], *(expected[f"c{k}"] for k in range(N_CLASSES)))
    if tuple(stored) != want:
        raise ReconcileError(f"results stored {tuple(stored)} but expected (assessed, c0..c4) = {want}")

    footprints = conn.execute("SELECT count(*) FROM damage_footprints WHERE footprint_set_id = %s", (set_id,)).fetchone()[0]
    if footprints != expected["n_buildings"]:
        raise ReconcileError(f"footprint set holds {footprints} buildings but {expected['n_buildings']} were aggregated")
    linked = conn.execute(
        "SELECT count(*) FROM damage_results r JOIN damage_footprints f "
        "ON f.footprint_set_id = %s AND f.building_id = r.building_id WHERE r.assessment_id = %s",
        (set_id, aid)).fetchone()[0]
    if linked != expected["n_assessed"]:
        raise ReconcileError(f"{expected['n_assessed'] - linked} results have no footprint")

    # Every resolution partitions the same buildings, so each must add up to the assessment totals.
    cell_sums = ", ".join(f"sum(c{k})" for k in range(N_CLASSES))
    rows = conn.execute(
        f"SELECT res, sum(n), sum(na), {cell_sums}, count(*) FILTER (WHERE NOT ST_DWithin(geom, pt, %s)) "
        "FROM damage_h3_cells WHERE assessment_id = %s GROUP BY res ORDER BY res",
        (CELL_POINT_TOLERANCE_DEG, aid)).fetchall()
    if tuple(r[0] for r in rows) != RESOLUTIONS:
        raise ReconcileError(f"cells stored for resolutions {[r[0] for r in rows]}, expected {list(RESOLUTIONS)}")
    want = (expected["n_buildings"], *want)
    for res, *sums, stray in rows:
        if tuple(int(s) for s in sums) != want:
            raise ReconcileError(f"res {res} cells sum to {tuple(int(s) for s in sums)} but expected "
                                 f"(buildings, assessed, c0..c4) = {want}")
        if stray:
            raise ReconcileError(f"res {res}: {stray} cells have their point outside their hexagon")


def record_error(conn: psycopg.Connection, source_file: str | None, message: str,
                 uploaded_at: str | None = None, meta: dict | None = None) -> None:
    """Log a rejected upload. Published assessments keep being served."""
    meta = meta or {}
    with conn.transaction():
        conn.execute(
            "INSERT INTO damage_assessments (event_name, aoi_name, imagery_date, model, source_file, uploaded_at, "
            "data_source, status, error) VALUES (%s, %s, %s, %s, %s, %s, %s, 'error', %s)",
            (meta.get("event_name"), meta.get("aoi_name"), meta.get("imagery_date"), meta.get("model"),
             source_file, uploaded_at, meta.get("data_source") or "n/a", message[:2000]),
        )


def list_assessments(conn: psycopg.Connection, limit: int = 20) -> list[dict]:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT assessment_id, status, event_name, aoi_name, imagery_date, data_source, source_file, "
                    "n_buildings, n_assessed, c0, c1, c2, c3, c4, error, published_at, created_at "
                    "FROM damage_assessments ORDER BY assessment_id DESC LIMIT %s", (limit,))
        return cur.fetchall()
