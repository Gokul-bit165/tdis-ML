"""Postgres storage for ignition predictions.

The scoring job writes one run per scored file (wildfire_ignition_runs) and one row per Texas cell
(wildfire_ignition_cells); the tables come from tdis-portal-db migration 042. The API reads only from here. A run becomes visible to the API when it is
marked is_current, which happens in the same transaction that finishes loading its cells, so a
half-loaded run is never served.

Connection: DATABASE_URL, e.g. postgresql://user:password@host:5432/wildfire?sslmode=require
"""
from __future__ import annotations

import os
from pathlib import Path

import h3
import pandas as pd
import psycopg
from psycopg.rows import dict_row

KEEP_RUNS = int(os.environ.get("KEEP_RUNS", "30"))
PARENT_RESOLUTIONS = (4, 5, 6, 7)  # res 8 is the cell itself

MIGRATIONS_DIR = Path(os.environ.get(
    "MIGRATIONS_DIR", Path(__file__).resolve().parent.parent / "tdis-portal-db" / "migrations"))
MIGRATIONS = ("042_create_wildfire_ignition_tables.sql", "043_create_wildfire_ignition_hexes.sql")
RUNS, CELLS, HEXES = "wildfire_ignition_runs", "wildfire_ignition_cells", "wildfire_ignition_hexes"
BATCH_JOB = "Wildfire Ignition Scoring Job"
DATA_SOURCE = "Wildfire Ignition Model"

RUN_COLUMNS = ("for_date, source_file, uploaded_at, generated_at, data_source, model, status, error, n_cells, "
               "n_input_cells, n_observed_cells, n_filled_cells, n_skipped_far, fill_method, mean_probability")


def connect(url: str | None = None, **kw) -> psycopg.Connection:
    url = url or os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is not set")
    return psycopg.connect(url, **kw)


def ensure_schema(conn: psycopg.Connection) -> None:
    """Check that migrations 042 and 043 have been applied. The tables live in the shared TDIS database, so the
    job does not create them itself; AUTO_MIGRATE=1 applies the migration files (dev and tests only)."""
    def missing():
        return [t for t in (RUNS, CELLS, HEXES) if conn.execute("SELECT to_regclass(%s)", (t,)).fetchone()[0] is None]

    if missing() and os.environ.get("AUTO_MIGRATE") == "1":
        with conn.transaction():
            for name in MIGRATIONS:
                conn.execute((MIGRATIONS_DIR / name).read_text(encoding="utf-8"))
    if missing():
        raise RuntimeError(f"tables {missing()} not found: apply tdis-portal-db/migrations/"
                           "042_create_wildfire_ignition_tables.sql and 043_create_wildfire_ignition_hexes.sql "
                           "(node migrate.js) first")


LOCK_KEY = 4204201  # advisory lock so two scoring runs never overlap


def try_lock(conn: psycopg.Connection) -> bool:
    """Take the session-level scoring lock; False if another run holds it."""
    return bool(conn.execute("SELECT pg_try_advisory_lock(%s)", (LOCK_KEY,)).fetchone()[0])


def already_processed(conn: psycopg.Connection, source_file: str, uploaded_at: str) -> bool:
    """True if this exact upload (same name and upload time) already produced a run, successful or rejected."""
    return conn.execute(
        "SELECT 1 FROM wildfire_ignition_runs WHERE source_file = %s AND uploaded_at = %s::timestamptz LIMIT 1",
        (source_file, uploaded_at),
    ).fetchone() is not None


def job_started(conn: psycopg.Connection) -> None:
    """Mark the batch job STARTED in the portal's batch_jobs table (no-op if the row is absent)."""
    conn.execute("UPDATE batch_jobs SET lastrun_timestamp_start = now(), lastrun_timestamp_end = NULL, "
                 "lastrun_duration = NULL, lastrun_status = 'STARTED' WHERE batch_job = %s", (BATCH_JOB,))


def job_finished(conn: psycopg.Connection, ok: bool) -> None:
    conn.execute("UPDATE batch_jobs SET lastrun_timestamp_end = now(), "
                 "lastrun_duration = now() - lastrun_timestamp_start, "
                 "lastrun_status = %s::batch_job_status WHERE batch_job = %s",
                 ("COMPLETED" if ok else "FAILED", BATCH_JOB))


def _parents(cells: pd.Series, res: int) -> list[str]:
    cache: dict[str, str] = {}
    return [cache.setdefault(c, h3.cell_to_parent(c, res)) for c in cells.values]


def _hex_rows(frame: pd.DataFrame, run_id: int) -> pd.DataFrame:
    """Per-hexagon aggregates for resolutions 4-7, in the column order of wildfire_ignition_hexes."""
    parts = []
    for res in PARENT_RESOLUTIONS:
        g = frame.groupby(f"h3_{res}", sort=False).agg(
            lat=("lat", "mean"), lon=("lon", "mean"), probability=("probability", "mean"),
            max_probability=("probability", "max"), n_cells=("h3_cell", "size"), n_observed=("observed", "sum"),
        ).reset_index().rename(columns={f"h3_{res}": "hex_id"})
        g.insert(0, "res", res)
        parts.append(g)
    out = pd.concat(parts, ignore_index=True)
    out["n_observed"] = out["n_observed"].astype("int64")
    out.insert(0, "run_id", run_id)
    return out


def _copy_frame(conn: psycopg.Connection, table: str, frame: pd.DataFrame) -> None:
    # The column list comes from the frame itself, so the order can never disagree with the rows.
    with conn.cursor() as cur, cur.copy(f"COPY {table} ({', '.join(frame.columns)}) FROM STDIN") as copy:
        # .tolist() yields native Python values; psycopg cannot adapt numpy scalars.
        for row in zip(*(frame[c].tolist() for c in frame.columns)):
            copy.write_row(row)


def publish_run(conn: psycopg.Connection, cells: pd.DataFrame, meta: dict) -> int:
    """Load a scored run and make it current, atomically. Returns the new run_id.

    `cells` needs h3_cell, lat, lon, probability, raw_probability, observed.
    `meta` needs for_date, data_source, model and may hold the other run columns.
    """
    frame = pd.DataFrame(
        {
            "h3_cell": cells["h3_cell"].values,
            **{f"h3_{r}": _parents(cells["h3_cell"], r) for r in PARENT_RESOLUTIONS},
            "lat": cells["lat"].astype("float32").values,
            "lon": cells["lon"].astype("float32").values,
            "probability": cells["probability"].astype("float32").values,
            "raw_probability": cells["raw_probability"].astype("float32").values,
            "observed": cells["observed"].astype(bool).values,
        }
    )
    with conn.transaction():
        run_id = conn.execute(
            """INSERT INTO wildfire_ignition_runs (for_date, source_file, uploaded_at, data_source_id, data_source, model, status,
                   n_cells, n_input_cells, n_observed_cells, n_filled_cells, n_skipped_far, fill_method, mean_probability)
               VALUES (%(for_date)s, %(source_file)s, %(uploaded_at)s,
                   (SELECT data_source_id FROM data_sources WHERE data_source = 'Wildfire Ignition Model'),
                   %(data_source)s, %(model)s, 'ok',
                   %(n_cells)s, %(n_input_cells)s, %(n_observed_cells)s, %(n_filled_cells)s, %(n_skipped_far)s,
                   %(fill_method)s, %(mean_probability)s)
               RETURNING run_id""",
            {**{k: None for k in ("source_file", "uploaded_at", "n_input_cells", "n_observed_cells",
                                  "n_filled_cells", "n_skipped_far", "fill_method")},
             **meta, "n_cells": len(frame), "mean_probability": float(frame["probability"].mean())},
        ).fetchone()[0]
        frame.insert(0, "run_id", run_id)
        _copy_frame(conn, CELLS, frame)
        _copy_frame(conn, HEXES, _hex_rows(frame, run_id))
        conn.execute("UPDATE wildfire_ignition_runs SET is_current = (run_id = %s) WHERE is_current OR run_id = %s",
                     (run_id, run_id))
        # Retention: keep the newest KEEP_RUNS runs (and their cells).
        conn.execute(
            "DELETE FROM wildfire_ignition_runs WHERE run_id NOT IN "
            "(SELECT run_id FROM wildfire_ignition_runs ORDER BY run_id DESC LIMIT %s) AND NOT is_current",
            (KEEP_RUNS,),
        )
    return run_id


def record_error(conn: psycopg.Connection, source_file: str | None, message: str,
                 uploaded_at: str | None = None) -> None:
    """Log a rejected upload. The current run keeps being served."""
    with conn.transaction():
        conn.execute(
            "INSERT INTO wildfire_ignition_runs (for_date, source_file, uploaded_at, status, error, data_source) "
            "VALUES (CURRENT_DATE, %s, %s, 'error', %s, 'n/a')",
            (source_file, uploaded_at, message[:2000]),
        )


# ---------------------------------------------------------------- reads (API)

def current_run(conn: psycopg.Connection, for_date: str | None = None) -> dict | None:
    """The run being served: the current one, or the newest ok run for a given prediction date."""
    with conn.cursor(row_factory=dict_row) as cur:
        if for_date:
            cur.execute(f"SELECT run_id, {RUN_COLUMNS} FROM wildfire_ignition_runs WHERE status = 'ok' AND for_date = %s "
                        "ORDER BY generated_at DESC LIMIT 1", (for_date,))
        else:
            cur.execute(f"SELECT run_id, {RUN_COLUMNS} FROM wildfire_ignition_runs WHERE is_current")
        return cur.fetchone()


def list_runs(conn: psycopg.Connection, limit: int = 30) -> list[dict]:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(f"SELECT run_id, is_current, {RUN_COLUMNS} FROM wildfire_ignition_runs ORDER BY run_id DESC LIMIT %s",
                    (limit,))
        return cur.fetchall()


def _window_sql(bbox: tuple | None) -> tuple[str, list]:
    if not bbox:
        return "", []
    west, south, east, north = bbox
    return " AND lat BETWEEN %s AND %s AND lon BETWEEN %s AND %s", [south, north, west, east]


def hexagons(conn: psycopg.Connection, run_id: int, res: int, bbox: tuple | None = None) -> list[dict]:
    """Hexagons of a run at H3 resolution `res`, optionally limited to a (w, s, e, n) window.

    Resolutions 4-7 are read from the pre-aggregated wildfire_ignition_hexes table; resolution 8 is the cell
    itself. A run published before migration 043 has no hexes rows and is aggregated live instead."""
    extra, extra_params = _window_sql(bbox)
    with conn.cursor(row_factory=dict_row) as cur:
        if res == 8:
            cur.execute("SELECT h3_cell AS hex_id, probability, probability AS max_probability, 1 AS n_cells, "
                        f"observed::int AS n_observed FROM {CELLS} WHERE run_id = %s{extra}", [run_id, *extra_params])
            return cur.fetchall()
        cur.execute("SELECT hex_id, probability, max_probability, n_cells, n_observed "
                    f"FROM {HEXES} WHERE run_id = %s AND res = %s{extra}", [run_id, res, *extra_params])
        rows = cur.fetchall()
        if rows or cur.execute(f"SELECT 1 FROM {HEXES} WHERE run_id = %s LIMIT 1", (run_id,)).fetchone():
            return rows
        # Not pre-aggregated: group the cells (slow, but correct).
        column = f"h3_{res}"
        cur.execute(f"SELECT {column} AS hex_id, avg(probability) AS probability, max(probability) AS max_probability, "
                    f"count(*) AS n_cells, sum(observed::int) AS n_observed FROM {CELLS} "
                    f"WHERE run_id = %s{extra} GROUP BY {column}", [run_id, *extra_params])
        return cur.fetchall()
