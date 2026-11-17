"""Prepare a drainage survey for the portal's Drainage Monitoring tab (files only, no database or server).

Inference runs on the local machine (full_stack/backend). This script turns its two result files into a few small
static files that are uploaded in the Azure portal to Blob Storage, where the portal reads them directly:

    python prepare_drainage.py --data <full_stack>/backend/data --out ./drainage_upload [--name clear-creek-2026-11]

Output (one flat folder; upload every file in it):
    manifest.json                 survey name, publish time, counts per class, bbox, list of outline tiles
    points.geojson                one point per defect: category + area (drawn as pins)
    polygons_<x>_<y>.geojson      defect outlines in ~2 km tiles (loaded only when zoomed in on that area)

Only class, area, location and a simplified outline are kept; image names, flights and overlays are dropped.
Standard library only.
"""

import argparse
import json
import math
import shutil
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

SCHEMA_VERSION = 1
POINT_DECIMALS = 6  # ~10 cm
OUTLINE_DECIMALS = 6
DEFAULT_TOLERANCE_DEG = 2e-6  # ~0.2 m: removes the pixel staircase of the masks without moving outlines visibly
CELL_DEG = 0.02  # outline tile size (~2 km); the map asks only for tiles in view


class InputError(ValueError):
    """The input files are not what the script expects."""


def parse_features(path):
    try:
        features = json.loads(Path(path).read_text(encoding="utf-8"))["features"]
    except (OSError, ValueError, KeyError, TypeError) as e:
        raise InputError(f"{Path(path).name}: not a readable GeoJSON FeatureCollection ({e})")
    if not isinstance(features, list):
        raise InputError(f"{Path(path).name}: 'features' is not a list")
    return features


# --- outline simplification (Douglas-Peucker) -------------------------------------------------------------

def _perp_dist_sq(p, a, b):
    ax, ay = a
    dx, dy = b[0] - ax, b[1] - ay
    if dx == 0 and dy == 0:
        return (p[0] - ax) ** 2 + (p[1] - ay) ** 2
    t = max(0.0, min(1.0, ((p[0] - ax) * dx + (p[1] - ay) * dy) / (dx * dx + dy * dy)))
    return (p[0] - ax - t * dx) ** 2 + (p[1] - ay - t * dy) ** 2


def simplify_line(points, tol):
    """Iterative Douglas-Peucker; keeps the first and last point."""
    if len(points) < 3:
        return points
    tol_sq = tol * tol
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        lo, hi = stack.pop()
        best, best_i = -1.0, -1
        for i in range(lo + 1, hi):
            d = _perp_dist_sq(points[i], points[lo], points[hi])
            if d > best:
                best, best_i = d, i
        if best > tol_sq:
            keep[best_i] = True
            stack.append((lo, best_i))
            stack.append((best_i, hi))
    return [p for p, k in zip(points, keep) if k]


def _round(ring):
    return [[round(x, OUTLINE_DECIMALS), round(y, OUTLINE_DECIMALS)] for x, y, *_ in ring]


def simplify_ring(ring, tol):
    """Simplify a closed ring; returns None if it collapses below a triangle."""
    if len(ring) < 4:
        return None
    # Split at the vertex farthest from the start so a closed ring is not reduced to one segment.
    far = max(range(len(ring)), key=lambda i: (ring[i][0] - ring[0][0]) ** 2 + (ring[i][1] - ring[0][1]) ** 2)
    out = simplify_line(ring[: far + 1], tol)[:-1] + simplify_line(ring[far:], tol)
    return _round(out) if len(out) >= 4 else None


def simplify_polygon(geom, tol):
    """Polygon or MultiPolygon -> simplified MultiPolygon (None for anything else)."""
    if not geom:
        return None
    if geom.get("type") == "Polygon":
        polys = [geom["coordinates"]]
    elif geom.get("type") == "MultiPolygon":
        polys = geom["coordinates"]
    else:
        return None
    out = []
    for rings in polys:
        shell = simplify_ring(rings[0], tol) or _round(rings[0])  # tiny shells are kept as they are
        holes = [h for h in (simplify_ring(r, tol) for r in rings[1:]) if h]
        out.append([shell] + holes)
    return {"type": "MultiPolygon", "coordinates": out}


def vertex_count(geom):
    if not geom:
        return 0
    polys = [geom["coordinates"]] if geom["type"] == "Polygon" else geom["coordinates"]
    return sum(len(r) for rings in polys for r in rings)


# --- build ------------------------------------------------------------------------------------------------

def cell_of(lon, lat):
    return math.floor(lon / CELL_DEG), math.floor(lat / CELL_DEG)


def write_json(path, obj):
    data = json.dumps(obj, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    path.write_bytes(data)
    return len(data)


def build(data_dir, out_dir, name, source, tol):
    points = parse_features(data_dir / "unioned_points.geojson")
    if not points:
        raise InputError("unioned_points.geojson has no features")
    poly_path = data_dir / "unioned_polygons.geojson"
    outlines = {}
    if poly_path.exists():
        outlines = {f.get("properties", {}).get("id"): f.get("geometry") for f in parse_features(poly_path)}

    point_features, cells = [], defaultdict(list)
    before = after = 0
    for n, f in enumerate(points):
        p = f.get("properties") or {}
        geom = f.get("geometry") or {}
        if geom.get("type") != "Point":
            raise InputError(f"unioned_points.geojson feature {n}: needs a Point geometry")
        lon, lat = (round(v, POINT_DECIMALS) for v in geom["coordinates"][:2])
        props = {"category": p.get("category") or "unknown", "area": p.get("area_sq_meters")}
        point_features.append({"type": "Feature", "properties": props,
                               "geometry": {"type": "Point", "coordinates": [lon, lat]}})
        raw = outlines.get(p.get("id"))
        outline = simplify_polygon(raw, tol)
        before += vertex_count(raw)
        after += vertex_count(outline)
        if outline:
            # A tile holds the outlines whose defect point lies in it; the map pads its view, so edges are covered.
            cells[cell_of(lon, lat)].append({"type": "Feature", "properties": props, "geometry": outline})

    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True)
    sizes = {"points.geojson": write_json(out_dir / "points.geojson",
                                          {"type": "FeatureCollection", "features": point_features})}
    for (x, y), feats in sorted(cells.items()):
        fname = f"polygons_{x}_{y}.geojson"
        sizes[fname] = write_json(out_dir / fname, {"type": "FeatureCollection", "features": feats})

    now = datetime.now(timezone.utc)
    lons = [f["geometry"]["coordinates"][0] for f in point_features]
    lats = [f["geometry"]["coordinates"][1] for f in point_features]
    manifest = {
        "schema_version": SCHEMA_VERSION,
        "run_id": name,
        "published_at": now.isoformat(timespec="seconds").replace("+00:00", "Z"),
        "version": now.strftime("%Y%m%d%H%M%S"),  # the portal adds it to file URLs so browsers never mix surveys
        "data_source": source,
        "n_defects": len(point_features),
        "bbox": [min(lons), min(lats), max(lons), max(lats)],
        "counts": dict(Counter(f["properties"]["category"] for f in point_features)),
        "cell_deg": CELL_DEG,
        "cells": [[x, y] for x, y in sorted(cells)],
    }
    sizes["manifest.json"] = write_json(out_dir / "manifest.json", manifest)
    return manifest, sizes, before, after


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", required=True, type=Path, help="full_stack/backend/data")
    ap.add_argument("--out", required=True, type=Path, help="output folder (emptied first)")
    ap.add_argument("--name", help="survey name shown in the portal (default: today's date)")
    ap.add_argument("--source", default="drone-survey", help="'test' shows a test-data note in the portal")
    ap.add_argument("--tolerance", type=float, default=DEFAULT_TOLERANCE_DEG, help="outline simplification, degrees")
    args = ap.parse_args()
    name = args.name or datetime.now(timezone.utc).strftime("survey-%Y-%m-%d")
    try:
        manifest, sizes, before, after = build(args.data, args.out, name, args.source, args.tolerance)
    except InputError as e:
        sys.exit(f"error: {e}")
    print(f"survey {name}: {manifest['n_defects']} defects, outline vertices {before:,} -> {after:,}")
    print("by class: " + ", ".join(f"{k}={v}" for k, v in sorted(manifest["counts"].items())))
    total = sum(sizes.values())
    print(f"{len(sizes)} files, {total / 1e6:.2f} MB total (points {sizes['points.geojson'] / 1e6:.2f} MB, "
          f"largest outline tile {max(v for k, v in sizes.items() if k.startswith('polygons_')) / 1e6:.2f} MB)")
    print(f"\nUpload every file in {args.out.resolve()} to: datatexas > Containers > drainage-data > folder 'current'")
    print("(Azure portal > Upload > select all files > Advanced > Upload to folder: current > Overwrite: on)")


if __name__ == "__main__":
    main()
