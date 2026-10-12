"""Shared model/feature logic for the API and the batch jobs (synthetic data, scoring)."""
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.neighbors import BallTree

# Features that are fixed per H3 cell (terrain, fuels, access, population, location).
STATIC_FEATURES = [
    "ecoregion_id", "elevation_m", "slope_deg", "aspect_deg", "road_dist_km",
    "avg_burn_prob", "whp", "cfl", "flep4", "cbd", "cbh", "powerline_dist_km",
    "pop_density", "lat", "lon",
]
# Weather that varies spatially within a day.
SPATIAL_DYNAMIC = ["hrrr_tmp", "hrrr_vpd", "hrrr_wind", "hrrr_mstav", "drought_score", "fm100_5d_min"]
# Month-level constants in the training table (gridMET columns were seasonally imputed).
DAY_CONSTANT = ["erc", "fm100", "vpd", "vs", "rmax", "rmin", "tmmx", "pr"]
INTERACTIONS = {
    "bp_x_vpd": ("avg_burn_prob", "hrrr_vpd"),
    "whp_x_vpd": ("whp", "hrrr_vpd"),
    "bp_x_drought": ("avg_burn_prob", "drought_score"),
}
IDW_NEIGHBOURS = 8
FILL_MAX_KM = 150.0  # estimated cells farther than this from every uploaded cell are left out
EARTH_KM = 6371.0

# Calibrated-probability bands for the map legend.
RISK_BANDS = [(0.6, "very_high"), (0.4, "high"), (0.2, "moderate"), (0.0, "low")]

US_HOLIDAYS_2026 = {"2026-10-12", "2026-11-11", "2026-11-26", "2026-12-25"}  # Columbus, Veterans, Thanksgiving, Christmas


def risk_level(p: float) -> str:
    for floor, name in RISK_BANDS:
        if p >= floor:
            return name
    return "low"


class ModelBundle:
    """Loads a model folder laid out as: model_*.json, calibrator_*.joblib, feature_list.json
    (falls back to the features in training_results_*.json), optional training_results_*.json."""

    def __init__(self, model_dir: Path):
        model_dir = Path(model_dir)

        def find(pattern: str, required: bool = True):
            hits = sorted(model_dir.glob(pattern))
            if not hits and required:
                raise FileNotFoundError(f"no {pattern} in {model_dir}")
            return hits[0] if hits else None

        model_path = find("model_*.json")
        self.name = model_path.stem
        results_path = find("training_results_*.json", required=False)
        self.results = json.loads(results_path.read_text()) if results_path else {}
        feature_file = find("feature_list.json", required=False)
        self.features = (
            json.loads(feature_file.read_text())["features"] if feature_file else self.results["features"]
        )
        self.model = xgb.XGBClassifier()
        self.model.load_model(str(model_path))
        self.model.set_params(device="cpu")  # trained on GPU; CPU inference is fine
        if self.model.n_features_in_ != len(self.features):
            raise ValueError(
                f"model expects {self.model.n_features_in_} features but feature list has {len(self.features)}"
            )
        self.calibrator = joblib.load(find("calibrator_*.joblib"))

    def score(self, frame: pd.DataFrame):
        """Return (raw, calibrated) probabilities for a frame holding every model feature."""
        missing = [f for f in self.features if f not in frame.columns]
        if missing:
            raise ValueError(f"missing features: {missing}")
        x = frame[self.features].astype("float32")
        if x.isnull().any().any():
            bad = x.columns[x.isnull().any()].tolist()
            raise ValueError(f"null values in features: {bad}")
        raw = self.model.predict_proba(x)[:, 1]
        return raw, self.calibrator.predict(raw)


def ensure_latlon(df: pd.DataFrame) -> pd.DataFrame:
    """Add lat/lon columns from h3_cell if absent (V2 training data has no coordinates)."""
    if "lat" in df.columns and "lon" in df.columns:
        return df
    import h3

    centers = {c: h3.cell_to_latlng(c) for c in df["h3_cell"].drop_duplicates()}
    df = df.copy()
    df["lat"] = df["h3_cell"].map(lambda c: centers[c][0]).astype("float32")
    df["lon"] = df["h3_cell"].map(lambda c: centers[c][1]).astype("float32")
    return df


def knn_interpolate(day: pd.DataFrame, cells: pd.DataFrame, columns, k: int = IDW_NEIGHBOURS):
    """K-nearest-neighbour, inverse-distance-weighted interpolation of `columns` from sampled `day` rows
    onto `cells`. Returns (values, nearest_km): the interpolated columns and, per cell, the distance in
    km to its nearest sampled row."""
    day_xy = np.radians(day[["lat", "lon"]].values.astype("float64"))
    cell_xy = np.radians(cells[["lat", "lon"]].values.astype("float64"))
    dist, ind = BallTree(day_xy, metric="haversine").query(cell_xy, k=min(k, len(day)))
    w = 1.0 / np.maximum(dist, 1e-6)
    w /= w.sum(axis=1, keepdims=True)
    out = pd.DataFrame(index=cells.index)
    for col in columns:
        vals = day[col].values.astype("float64")
        out[col] = (vals[ind] * w).sum(axis=1).astype("float32")
    return out, dist[:, 0] * EARTH_KM


def idw_interpolate(day: pd.DataFrame, cells: pd.DataFrame, columns, k: int = IDW_NEIGHBOURS) -> pd.DataFrame:
    """knn_interpolate without the distances (used by the synthetic-data generator)."""
    return knn_interpolate(day, cells, columns, k)[0]


def fill_texas(obs: pd.DataFrame, features: list, cells: pd.DataFrame, k: int = IDW_NEIGHBOURS,
               max_km: float = FILL_MAX_KM):
    """Expand uploaded rows to every Texas cell. Returns (frame, n_observed, n_skipped_far).

    Cells present in the upload keep their own values. Every other Texas cell gets its fixed features
    from the cell table, spatially varying weather by inverse-distance weighting of its k nearest
    uploaded cells (KNN), and the day-wide values (gridMET, calendar) from the upload. A cell more than
    `max_km` from every uploaded cell is dropped instead of being given weather from far away.
    """
    obs = ensure_latlon(obs)
    full = cells.copy()
    dyn, nearest_km = knn_interpolate(obs, full, SPATIAL_DYNAMIC, k)
    for col in SPATIAL_DYNAMIC:
        full[col] = dyn[col]
    for col in DAY_CONSTANT:
        full[col] = np.float32(obs[col].median())
    for col in ("sin_month", "cos_month", "sin_dow", "cos_dow", "is_weekend", "is_holiday"):
        full[col] = np.float32(obs[col].iloc[0])
    add_derived(full)

    # Uploaded cells keep exactly what was uploaded.
    seen = obs.drop_duplicates("h3_cell").set_index("h3_cell")
    is_obs = full["h3_cell"].isin(seen.index).values
    if is_obs.any():
        idx = full.index[is_obs]
        for col in features:
            full.loc[idx, col] = seen.loc[full.loc[idx, "h3_cell"], col].values
    full["observed"] = is_obs

    keep = is_obs | (nearest_km <= max_km)
    n_far = int((~keep).sum())
    return full[keep].reset_index(drop=True), int(is_obs.sum()), n_far


def add_derived(frame: pd.DataFrame) -> pd.DataFrame:
    for name, (a, b) in INTERACTIONS.items():
        frame[name] = (frame[a] * frame[b]).astype("float32")
    return frame


def calendar_features(date: pd.Timestamp) -> dict:
    return {
        "sin_month": np.sin(2 * np.pi * date.month / 12),
        "cos_month": np.cos(2 * np.pi * date.month / 12),
        "sin_dow": np.sin(2 * np.pi * date.dayofweek / 7),
        "cos_dow": np.cos(2 * np.pi * date.dayofweek / 7),
        "is_weekend": float(date.dayofweek >= 5),
        "is_holiday": float(date.strftime("%Y-%m-%d") in US_HOLIDAYS_2026),
    }
