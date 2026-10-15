# ML models and ignition API

## Models

| | v1 `TDIS_Ignition_BIT` | v2 `TDIS_Ignition_BIT_V2` (deployed) |
|---|---|---|
| Features | 38 (includes `lat`, `lon`) | 36 (lat/lon removed) |
| Rows | 2,201,289 | same |
| Split | Train 2018-07 to 2020-12, Val 2021, Test 2022 to 2026-07-29 | same |
| Positive rate | ~30% (matched sample) | same |
| Test AUROC / AUC-PR | 0.8064 / 0.7237 | 0.8026 / 0.7164 |
| Hyperparameter search | 21 trials, 2 stages | 34 trials, 3 stages, regularisation-aware selection |
| Files | `model_bit_38feat.json`, calibrator, results | `model_bit_v2_36feat.json`, `calibrator_bit_v2_36feat.joblib`, `feature_list.json` |

Reports: [BIT_TRAINING_REPORT.md](../TDIS_Ignition_BIT/BIT_TRAINING_REPORT.md), [BIT_V2_TRAINING_REPORT.md](../TDIS_Ignition_BIT_V2/BIT_V2_TRAINING_REPORT.md).
v2 also has 9 evaluation figures in `TDIS_Ignition_BIT_V2/results/figures/`.

The 36 features (order in `feature_list.json` is authoritative):
- **12 static features:** `road_dist_km`, `ecoregion_id`, `elevation_m`, `slope_deg`, `aspect_deg`, `avg_burn_prob`, `whp`, `flep4`, `cfl`, `cbd`, `cbh`, `powerline_dist_km`
- **6 calendar features:** `sin_month`, `cos_month`, `sin_dow`, `cos_dow`, `is_weekend`, `is_holiday`
- **5 weather features:** `hrrr_tmp`, `hrrr_vpd`, `hrrr_wind`, `hrrr_mstav`, `drought_score`
- **5 interaction/extra features:** `bp_x_vpd`, `whp_x_vpd`, `bp_x_drought`, `pop_density`, `fm100_5d_min`
- **8 gridMET features:** `erc`, `fm100`, `vpd`, `vs`, `rmax`, `rmin`, `tmmx`, `pr`

Retraining: scripts are `scripts/build_dataset.py`, `tune_train_model.py`, `generate_visuals.py`. They need
`TDIS_Ignition_BIT_V2/data/processed/bit_v2_train_tx.parquet`, which is **gitignored and not in the repo**. Training used a
GPU conda env (`torch_gpu`, xgboost 3.2.0, scikit-learn 1.7.2). After retraining, copy the three model files into
`tdis-ignition-api/model/` and rebuild the image.

## tdis-ignition-api files

| File | Purpose |
|---|---|
| `main.py` | FastAPI application. Serves `/coverage`, `/runs`, `/status`, `/model-info`, `/predict`, `/health`. Reads only from PostgreSQL. |
| `score_job.py` | Azure Container Apps batch job. Polling every 5 minutes, validates incoming daily files, expands Texas cells via KNN/IDW, scores with XGBoost, and commits atomic DB transactions. |
| `ignition_core.py` | `ModelBundle` class, feature loading, inference pipeline, and KNN inverse-distance weighting interpolation (`fill_texas`). |
| `ingest.py` | File validation and column verification for uploaded CSV and Parquet files. |
| `db.py` | PostgreSQL connection pool and transaction logic. Executes fast batch loads with `COPY` into `wildfire_ignition_cells`. |
| `store.py` | Cloud storage abstraction layer supporting Azure Blob (`az://`) and local files (`_local/`). |
| `make_texas_cells.py` | Script to precompute Texas H3 resolution-8 cells and static terrain/fuel features saved in `data/texas_cells.parquet`. |
| `Dockerfile` | Multi-mode container image (`RUN_MODE=api` for FastAPI HTTP server, default for scheduled batch scoring job). |
| `*.ps1` | Azure deployment, container app updating, and database setup automation scripts. |
