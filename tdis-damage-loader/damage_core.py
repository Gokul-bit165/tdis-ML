"""Spatial algorithms for the damage assessment loader. Pure functions: no database, no files.

  representative_points  one point guaranteed inside each footprint
  cell_ids               the H3 cell of every point at one resolution
  aggregate              per-cell building and damage-class counts for resolutions 4 to 10
  hexagons               the polygon of each H3 cell

Each building is indexed directly at every resolution (never rolled up from a finer cell), so the hexagon
drawn on the map contains exactly the buildings it counts. See docs/dmg_visual_verified/02_DATA_AND_ALGORITHMS.md.
"""
from __future__ import annotations

import h3
import numpy as np
import pandas as pd
import shapely

LABELS = (
    "Undamaged",
    "Partial Roof Damage",
    "Total Roof Damage",
    "Partial Structural Collapse",
    "Total Structural Collapse",
)
LABEL_TO_CODE = {label: code for code, label in enumerate(LABELS)}
N_CLASSES = len(LABELS)
NOT_ASSESSED = -1
RESOLUTIONS = (4, 5, 6, 7, 8, 9, 10)
FINEST_RES = RESOLUTIONS[-1]
SRID = 4326

# Texas with a margin, as (west, south, east, north). Uploads outside it are rejected: it catches files in
# a projected coordinate system and files for the wrong place.
TEXAS_ENVELOPE = (-107.5, 25.0, -93.0, 37.2)


def representative_points(geoms: np.ndarray) -> np.ndarray:
    """A point inside each polygon. A centroid is not used: for an L-shaped building it can fall outside."""
    return shapely.point_on_surface(geoms)


def cell_ids(lat: np.ndarray, lng: np.ndarray, res: int) -> np.ndarray:
    """H3 cell id of every (lat, lng) at resolution `res`."""
    return np.array([h3.latlng_to_cell(a, o, res) for a, o in zip(lat.tolist(), lng.tolist())], dtype=object)


def hexagons(cells) -> np.ndarray:
    """Polygon of each H3 cell, in (lng, lat) order with SRID 4326."""
    polys = shapely.polygons([[(lng, lat) for lat, lng in h3.cell_to_boundary(c)] for c in cells])
    return shapely.set_srid(polys, SRID)


def dominant_class(counts: np.ndarray, na: np.ndarray) -> np.ndarray:
    """Most frequent class per row of an (n_cells, 5) count matrix; ties go to the more severe class.
    NOT_ASSESSED where the cell has no assessed building."""
    # argmax returns the first maximum, so search the columns from the most severe class down.
    dom = (N_CLASSES - 1) - counts[:, ::-1].argmax(axis=1)
    return np.where(na > 0, dom, NOT_ASSESSED).astype(np.int16)


def aggregate(lat: np.ndarray, lng: np.ndarray, cls: np.ndarray) -> pd.DataFrame:
    """Per-cell counts for every resolution in RESOLUTIONS.

    `cls` holds one class code per building: 0 to 4, or NOT_ASSESSED. Returns one row per non-empty cell
    with res, h3, n, na, c0..c4, dom, lat, lng, where (lat, lng) is the centre of mass of the cell's
    buildings. Only counts are returned; a percentage is always derived from them, never stored.
    """
    lat = np.asarray(lat, dtype="float64")
    lng = np.asarray(lng, dtype="float64")
    cls = np.asarray(cls, dtype="int64")
    assessed = cls != NOT_ASSESSED
    frames = []
    for res in RESOLUTIONS:
        uniq, inverse = np.unique(cell_ids(lat, lng, res), return_inverse=True)
        n = np.bincount(inverse, minlength=len(uniq))
        counts = np.zeros((len(uniq), N_CLASSES), dtype=np.int64)
        np.add.at(counts, (inverse[assessed], cls[assessed]), 1)
        na = counts.sum(axis=1)
        frame = pd.DataFrame({"res": res, "h3": uniq, "n": n, "na": na})
        for k in range(N_CLASSES):
            frame[f"c{k}"] = counts[:, k]
        frame["dom"] = dominant_class(counts, na)
        frame["lat"] = np.bincount(inverse, weights=lat, minlength=len(uniq)) / n
        frame["lng"] = np.bincount(inverse, weights=lng, minlength=len(uniq)) / n
        frames.append(frame)
    return pd.concat(frames, ignore_index=True)


def disk_order(lat: np.ndarray, lng: np.ndarray) -> np.ndarray:
    """Row order that keeps buildings close on the ground close on disk (sorted by finest H3 cell)."""
    return np.argsort(cell_ids(np.asarray(lat, dtype="float64"), np.asarray(lng, dtype="float64"), FINEST_RES),
                      kind="stable")


def envelope(west: float, south: float, east: float, north: float):
    """Rectangle polygon with SRID 4326. A zero-width or zero-height extent is padded so it stays a polygon."""
    pad = 1e-4
    if east - west < pad:
        west, east = west - pad, east + pad
    if north - south < pad:
        south, north = south - pad, north + pad
    return shapely.set_srid(shapely.box(west, south, east, north), SRID)


def inside_texas(west: float, south: float, east: float, north: float) -> bool:
    w, s, e, n = TEXAS_ENVELOPE
    return w <= west and s <= south and east <= e and north <= n
