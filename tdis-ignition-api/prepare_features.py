"""Check a day's feature file and convert it to the exact format the Azure scoring job reads.

  python prepare_features.py my_features.csv                 # CSV or parquet in, <date>.parquet out
  python prepare_features.py my_features.csv --out .\\ready

Input: one row per H3 cell (resolution 8) for ONE date, with columns
  h3_cell, date, and the 36 model features (see model/feature_list.json). No nulls.
Output: <out>/<date>.parquet  -> upload it to  wildfire-data/daily-features/  (see upload_features.ps1)
"""
import argparse
import sys
from pathlib import Path

import h3
import pandas as pd

from ignition_core import ModelBundle, calendar_features

HERE = Path(__file__).resolve().parent


def fail(msg: str):
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input", help="CSV or parquet with h3_cell, date and the model features")
    ap.add_argument("--out", default=".", help="folder for the <date>.parquet (default: current)")
    ap.add_argument("--model-dir", default=str(HERE / "model"))
    ap.add_argument("--set-date", help="TEST ONLY: publish the rows as this date (YYYY-MM-DD) instead of the file's own "
                    "date. Calendar features are recomputed for it; weather stays as in the file.")
    ap.add_argument("--source", default="real", help="data_source tag; anything other than 'real' shows a test banner")
    args = ap.parse_args()

    features = ModelBundle(args.model_dir).features
    src = Path(args.input)
    df = pd.read_csv(src) if src.suffix.lower() == ".csv" else pd.read_parquet(src)
    print(f"read {len(df):,} rows, {df.shape[1]} columns from {src.name}")

    for col in ("h3_cell", "date"):
        if col not in df.columns:
            fail(f"missing column '{col}'")
    missing = [f for f in features if f not in df.columns]
    if missing:
        fail(f"missing {len(missing)} model feature(s): {missing}")

    if args.set_date:
        new_date = pd.Timestamp(args.set_date)
        print(f"NOTE: re-dating {df['date'].iloc[0]} -> {new_date.date()} and recomputing calendar features")
        df["date"] = new_date
        for name, value in calendar_features(new_date).items():
            if name in df.columns:
                df[name] = value
    dates = pd.to_datetime(df["date"]).dt.normalize().unique()
    if len(dates) != 1:
        fail(f"file must hold exactly one date, found {len(dates)}: {[str(d)[:10] for d in dates[:5]]}")
    date = pd.Timestamp(dates[0])

    if df["h3_cell"].duplicated().any():
        fail(f"{int(df['h3_cell'].duplicated().sum())} duplicate h3_cell rows")
    bad_cells = [c for c in df["h3_cell"].head(1000) if not h3.is_valid_cell(c)]
    if bad_cells:
        fail(f"invalid H3 cell ids, e.g. {bad_cells[:3]}")

    nulls = df[features].isnull().sum()
    if nulls.any():
        fail(f"null values in: {nulls[nulls > 0].to_dict()}")
    non_numeric = [f for f in features if not pd.api.types.is_numeric_dtype(df[f])]
    if non_numeric:
        fail(f"non-numeric feature columns: {non_numeric}")

    out = df[["h3_cell", *features]].copy()
    out[features] = out[features].astype("float32")
    out.insert(1, "date", date)
    out["data_source"] = args.source

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"{date.date()}.parquet"
    out.to_parquet(path, index=False)
    print(f"OK: {len(out):,} cells for {date.date()} -> {path}")
    print("next: .\\upload_features.ps1 -File", path)


if __name__ == "__main__":
    main()
