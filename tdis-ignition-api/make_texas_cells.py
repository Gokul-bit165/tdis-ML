"""One-off: build data/texas_cells.parquet, one row per Texas H3 cell with its fixed features.

The scoring job uses it to expand a sparse upload to every Texas cell (nearest-neighbour weather fill).
Source: the BIT V2 training table (terrain/fuel/road/population never change per cell).
Re-run only if the cell grid or static layers change.
"""
import json
from pathlib import Path

import pandas as pd
from shapely import contains_xy
from shapely.geometry import shape

from ignition_core import STATIC_FEATURES, ensure_latlon

HERE = Path(__file__).resolve().parent
SRC = HERE.parent / "TDIS_Ignition_BIT_V2" / "data" / "processed" / "bit_v2_train_tx.parquet"
OUT = HERE / "data" / "texas_cells.parquet"

static = [c for c in STATIC_FEATURES if c not in ("lat", "lon")]
cells = pd.read_parquet(SRC, columns=["h3_cell", *static]).drop_duplicates("h3_cell").reset_index(drop=True)
cells = ensure_latlon(cells)
gj = json.loads((HERE / "data" / "texas.geojson").read_text())
texas = shape(gj["geometry"] if gj["type"] == "Feature" else gj)
inside = contains_xy(texas, cells["lon"].values.astype("float64"), cells["lat"].values.astype("float64"))
cells = cells[inside].reset_index(drop=True)
cells[static + ["lat", "lon"]] = cells[static + ["lat", "lon"]].astype("float32")
cells.to_parquet(OUT, index=False)
print(f"{len(cells):,} Texas cells -> {OUT} ({OUT.stat().st_size / 1e6:.1f} MB)")
