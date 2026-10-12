"""Validate and normalise an uploaded daily-features file (CSV or parquet). Runs inside the Azure job."""
import io

import h3
import pandas as pd


class IngestError(Exception):
    """The uploaded file cannot be scored; the message tells the uploader what to fix."""


def load_table(raw: bytes, name: str) -> pd.DataFrame:
    try:
        if name.lower().endswith(".csv"):
            return pd.read_csv(io.BytesIO(raw))
        return pd.read_parquet(io.BytesIO(raw))
    except Exception as e:  # unreadable, or not really a csv/parquet
        raise IngestError(f"cannot read {name}: {e}")


def prepare(df: pd.DataFrame, features: list[str]) -> tuple[pd.DataFrame, pd.Timestamp, str]:
    """Return (frame with h3_cell, date, features, data_source), the file's date, and its data_source."""
    for col in ("h3_cell", "date"):
        if col not in df.columns:
            raise IngestError(f"missing column '{col}'")
    missing = [f for f in features if f not in df.columns]
    if missing:
        raise IngestError(f"missing {len(missing)} model feature(s): {missing}")

    try:
        dates = pd.to_datetime(df["date"]).dt.normalize().unique()
    except Exception:
        raise IngestError("column 'date' is not a valid date (use YYYY-MM-DD)")
    if len(dates) != 1:
        raise IngestError(f"file must hold exactly one date, found {len(dates)}: {[str(d)[:10] for d in dates[:5]]}")
    date = pd.Timestamp(dates[0])

    if df["h3_cell"].duplicated().any():
        raise IngestError(f"{int(df['h3_cell'].duplicated().sum())} duplicate h3_cell rows")
    bad = [c for c in df["h3_cell"].astype(str).unique() if not h3.is_valid_cell(c)]
    if bad:
        raise IngestError(f"{len(bad)} invalid H3 cell id(s), e.g. {bad[:3]}")

    non_numeric = [f for f in features if not pd.api.types.is_numeric_dtype(df[f])]
    if non_numeric:
        raise IngestError(f"non-numeric feature columns: {non_numeric}")
    nulls = df[features].isnull().sum()
    if nulls.any():
        raise IngestError(f"empty values in: {nulls[nulls > 0].to_dict()}")

    source = str(df["data_source"].iloc[0]) if "data_source" in df.columns else "real"
    out = df[["h3_cell", *features]].copy()
    out[features] = out[features].astype("float32")
    out.insert(1, "date", date)
    out["data_source"] = source
    return out, date, source
