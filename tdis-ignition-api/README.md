# tdis-ignition-api

Next-day wildfire ignition risk for Texas from the BIT V2 model (`model/`, 36-feature XGBoost + isotonic calibrator).
One container image, two modes (`RUN_MODE=api` serves HTTP, anything else runs the scoring job).

```
upload CSV/parquet  ->  scoring job (Azure)  ->  Postgres  ->  API  ->  map
 daily-features/        validate, fill Texas      wildfire_ignition_*    reads only
 (datatexas)            with KNN, score           (migration 042)        from Postgres
```

Everything after the upload runs in Azure. Nothing is prepared on a local PC.

## Daily use

1. Upload the day's file to `datatexas / wildfire-data / daily-features /` (CSV or parquet, any file name).
   Columns: `h3_cell` (H3 resolution 8), `date` (the day predicted) and the 36 features in `model/feature_list.json`, no blanks.
   An optional `data_source` column other than `real` marks test data.
2. The job `wildfire-ignition-job` checks every 5 minutes. When it finds an upload it has not processed, it scores it, so the map updates
   within about 5 to 6 minutes of the upload. With nothing new it exits in seconds and changes nothing.
3. It scores the most recently uploaded file (if two files arrive within one 5-minute window, only the newer is scored). A file that fails validation is recorded as an error run and the map keeps the last good run.
   See `/api/v1/ignition/status`, or `predictions/status.json` in storage.

## Sparse uploads

A file with few cells is expanded to every Texas cell (about 251,000) with K-nearest-neighbour filling. Uploaded cells keep their values.
Other cells take their fixed terrain and fuel values from `data/texas_cells.parquet` and their weather from the 8 nearest uploaded cells,
weighted by 1/distance. A cell more than 150 km from every uploaded cell is left out, so a regional upload does not paint the whole state
with one area's weather (`n_skipped_far` counts them). The map draws estimated hexagons fainter. `make_texas_cells.py` rebuilds the cell table.

## Database

The tables belong to the TDIS portal database and come from `tdis-portal-db/migrations/042_create_wildfire_ignition_tables.sql`
(documented in `tdis-portal-db/docs/WILDFIRE_IGNITION_SCHEMA.md`). Apply it with `node migrate.js` before the first run. The job does not
create tables. Set `DATABASE_URL` (`postgresql://user:password@host:5432/db?sslmode=require`) as a secret on the job and the API.

## Endpoints (`/api/v1/ignition`)

| | |
|---|---|
| `GET /coverage?res=4..8&bbox=w,s,e,n` | Hexagons of the current run. `bbox` is required from res 7. `date=` selects an earlier run. |
| `GET /runs`, `GET /status` | Recent runs, and the newest run including a rejected upload |
| `GET /model-info` | Metrics and features |
| `POST /predict` | Score caller-supplied rows (every feature required) |

## Azure resources (`tdis-rg`)

Image `tdiswildfireacr2026.azurecr.io/wildfire-ignition:<tag>`; job `wildfire-ignition-job`; API app `wildfire-ignition-api`;
identity `id-wildfire-job`; storage `datatexas`. Ship code with `az acr build ...` then `rollout.ps1 -Tag <tag>`.

## Local testing

```powershell
python -m venv .venv; .\.venv\Scripts\pip install -r requirements.txt
$env:DATABASE_URL = "postgresql://..."; $env:AUTO_MIGRATE = "1"      # AUTO_MIGRATE applies migration 042 (dev only)
$env:FEATURES_URI = "_local\in"; .\.venv\Scripts\python score_job.py
.\.venv\Scripts\python -m uvicorn main:app --port 8001
```

To re-score the newest file without a new upload, start the job with `FORCE=1` (`az containerapp job start -g tdis-rg -n wildfire-ignition-job --env-vars FORCE=1`).

Known limits: probabilities come from a model calibrated on a ~30% fire-day sample, so read colours as relative risk; the API is public.
