"""Damage assessment loader.

  python damage_job.py footprints <file> --name NAME [--source TEXT]   load a footprint set (once per area)
  python damage_job.py results <file> --manifest manifest.json         publish one model run
  python damage_job.py poll                                            load whatever is new in DAMAGE_URI (the default)
  python damage_job.py list                                            recent assessments, including rejected uploads
  python damage_job.py migrate                                         apply migration 043 (dev and tests only)

`poll` is what the scheduled Azure job runs. It expects this layout under DAMAGE_URI (a local folder, or
az://<account>/<container>/<prefix>):

  footprints/<set name>.parquet                 the set name is the file name without its extension
  assessments/<run folder>/results.parquet      or results.csv
  assessments/<run folder>/manifest.json        upload this LAST: a run is picked up when its manifest appears

Each upload is processed once (matched by name and upload time), so a rejected file is not retried until it is
uploaded again. Nothing here runs a model: the loader only stores results that already exist.

Env: DATABASE_URL (required), DAMAGE_URI (poll), KEEP_ASSESSMENTS (default 12), AUTO_MIGRATE=1 (dev only).
"""
from __future__ import annotations

import argparse
import posixpath
import sys
import time
from pathlib import Path

import numpy as np

import db
from damage_core import NOT_ASSESSED, aggregate
from ingest import IngestError, read_footprints, read_manifest, read_results
from store import Store

FOOTPRINT_SUFFIXES = (".parquet", ".geoparquet", ".geojson")
RESULT_NAMES = ("results.parquet", "results.csv")


def load_footprints(conn, data: bytes, file_name: str, set_name: str, source: str | None = None) -> int:
    """Validate and store one footprint set. Raises IngestError if the file or the name is not usable."""
    if db.footprint_set(conn, set_name):
        raise IngestError(f"footprint set '{set_name}' already exists; sets are immutable, load changes under a new name")
    t0 = time.time()
    footprints = read_footprints(data, file_name)
    set_id = db.load_footprint_set(conn, footprints, set_name, source, file_name)
    print(f"footprint set {set_id} '{set_name}': {len(footprints):,} buildings stored in {time.time() - t0:.1f}s")
    return set_id


def load_results(conn, results_data: bytes, results_name: str, manifest_data: bytes,
                 uploaded_at: str | None = None) -> int:
    """Validate one model run, join it to its footprint set, aggregate to H3 and publish it."""
    t0 = time.time()
    manifest = read_manifest(manifest_data)
    results = read_results(results_data, results_name)
    fset = db.footprint_set(conn, manifest["footprint_set"])
    if fset is None:
        raise IngestError(f"manifest: footprint set '{manifest['footprint_set']}' has not been loaded")

    buildings = db.footprint_points(conn, fset["footprint_set_id"])
    unknown = ~results["building_id"].isin(buildings["building_id"])
    if unknown.any():
        raise IngestError(f"results: {int(unknown.sum())} of {len(results):,} building_id values are not in footprint "
                          f"set '{fset['name']}', e.g. {', '.join(results.loc[unknown, 'building_id'].head(5))}")

    cls = (buildings["building_id"].map(results.set_index("building_id")["damage_class"])
           .fillna(NOT_ASSESSED).astype("int16").values)
    cells = aggregate(buildings["lat"].values, buildings["lng"].values, cls)
    meta = {k: manifest[k] for k in ("event_name", "aoi_name", "imagery_date", "model", "data_source")}
    aid = db.publish_assessment(conn, fset["footprint_set_id"], results, cells, cls,
                                {**meta, "source_file": results_name, "uploaded_at": uploaded_at})
    counts = np.bincount(cls[cls != NOT_ASSESSED], minlength=5)
    print(f"assessment {aid} published: {len(buildings):,} buildings, {len(results):,} assessed, "
          f"classes {counts.tolist()}, {len(cells):,} H3 cells, in {time.time() - t0:.1f}s")
    return aid


def _reject(conn, name: str, uploaded_at: str | None, error: Exception, manifest_data: bytes | None = None) -> None:
    print(f"REJECTED {name}: {error}", file=sys.stderr)
    meta = None
    if manifest_data is not None:
        try:
            meta = read_manifest(manifest_data)
        except IngestError:
            meta = None
    try:
        db.record_error(conn, name, str(error), uploaded_at, meta)
    except Exception as e:  # never let reporting hide the real result
        print(f"WARNING: could not record the error in the database: {e}", file=sys.stderr)


def poll(conn, store: Store) -> int:
    """Load every new footprint set, then every new run, oldest upload first. Returns the number of failures."""
    failures = 0
    for name, uploaded_at in store.list_info("footprints", FOOTPRINT_SUFFIXES):
        set_name = posixpath.basename(name).rsplit(".", 1)[0]
        if db.footprint_set(conn, set_name) or db.already_processed(conn, name, uploaded_at):
            continue
        try:
            load_footprints(conn, store.read_bytes(name), name, set_name, source=store.uri)
        except (IngestError, db.ReconcileError) as e:
            failures += 1
            _reject(conn, name, uploaded_at, e)

    for manifest_name, uploaded_at in store.list_info("assessments", ("manifest.json",)):
        folder = posixpath.dirname(manifest_name)
        results_name = next((f"{folder}/{n}" for n in RESULT_NAMES if store.exists(f"{folder}/{n}")), None)
        if results_name is None:
            continue  # the results file has not arrived yet
        if db.already_processed(conn, results_name, uploaded_at):
            continue
        manifest_data = store.read_bytes(manifest_name)
        try:
            load_results(conn, store.read_bytes(results_name), results_name, manifest_data, uploaded_at)
        except (IngestError, db.ReconcileError) as e:
            failures += 1
            _reject(conn, results_name, uploaded_at, e, manifest_data)
    return failures


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Damage assessment loader")
    sub = parser.add_subparsers(dest="command")
    p = sub.add_parser("footprints", help="load a footprint set")
    p.add_argument("file")
    p.add_argument("--name", required=True, help="set name that manifests will refer to")
    p.add_argument("--source", help="where the footprints came from")
    p = sub.add_parser("results", help="publish one model run")
    p.add_argument("file")
    p.add_argument("--manifest", required=True)
    sub.add_parser("poll", help="load whatever is new in DAMAGE_URI")
    sub.add_parser("list", help="recent assessments")
    sub.add_parser("migrate", help="apply migration 043 (dev only)")
    args = parser.parse_args(argv)
    command = args.command or "poll"

    conn = db.connect(autocommit=True)
    if command == "migrate":
        db.apply_migration(conn)
        print(f"applied {db.MIGRATION.name}")
        return 0
    db.ensure_schema(conn)
    if command == "list":
        for row in db.list_assessments(conn):
            print({k: (str(v) if v is not None else None) for k, v in row.items()})
        return 0
    if not db.try_lock(conn):
        print("another load is in progress; exiting")
        return 0

    db.job_started(conn)
    failures = 0
    try:
        if command == "footprints":
            path = Path(args.file)
            load_footprints(conn, path.read_bytes(), path.name, args.name, args.source)
        elif command == "results":
            path = Path(args.file)
            load_results(conn, path.read_bytes(), path.name, Path(args.manifest).read_bytes())
        else:
            import os
            failures = poll(conn, Store(os.environ["DAMAGE_URI"]))
    except (IngestError, db.ReconcileError) as e:
        failures = 1
        print(f"REJECTED: {e}", file=sys.stderr)
    db.job_finished(conn, failures == 0)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
