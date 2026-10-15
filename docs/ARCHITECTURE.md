# Architecture

## Repository map

```
tdis-ml/
├── tdis-portal-frontend/   React 19 + Vite map UI (the main page)
├── tdis-portal-backend/    Express email server (Contact Us, subscribe, /health)
├── tdis-portal-db/         PostgreSQL migrations 001-042 + seed scripts + docs
├── tdis-ignition-api/      FastAPI service + scoring job + Azure deploy scripts (wildfire ML serving)
├── TDIS_Ignition_BIT/      Model v1 (38 features, includes lat/lon) - history
├── TDIS_Ignition_BIT_V2/   Model v2 (36 features) - training scripts, results, figures, report
├── upload_tests/           Sample daily feature parquet files for upload testing
├── 2026-10-5.parquet       A sample daily feature file
└── docs/                   This knowledge base
```

Git: branch `master`, remote `https://github.com/Gokul-bit165/tdis-ML.git`, two commits (2026-10-12).

## System 1: TDIS Portal

```
Browser (React SPA, tdis-portal-frontend)
   |-- VITE_API_URL ............. Portal FastAPI (events, LTS, hazards, flood hub, power outage)   [NOT in repo]
   |-- VITE_EMAIL_API_URL ....... POST /api/emails/send-email, /api/emails/subscribe-user-request  [tdis-portal-backend]
   |-- VITE_CUBE_API_BASE_URL ... Cube.js analytics API                                            [NOT in repo]
   |-- VITE_TILE_SERVER_BASE_URL  pg_tileserv vector tiles                                          [NOT in repo]
   |-- VITE_RAMP_API_ROOT ....... RAMP critical facilities GeoJSON                                  [NOT in repo]
   |-- VITE_TDIS_API_KEY / HELPDESK / AI services (tdisAiApi, aiAssistantService)                   [NOT in repo]
   |-- Keycloak (keycloak-js) ... login / SSO
   '-- VITE_IGNITION_API_URL .... tdis-ignition-api (default http://localhost:8001)                 [in repo]

tdis-portal-backend (Express, port 8080)
   routes: /api/emails (contact form, subscribe), /health
   middleware: cls-rtracer request id, morgan->winston logging, helmet, compression, cors, https redirect in production
   mail via config/mailer.js, templates in emails/<name>/{html.pug,style.css,subject.pug}

tdis-portal-db (PostgreSQL)
   migrate.js applies only migrations not recorded in table _migrations
   core tables: event_types, data_sources, counties, cities, events_store, batch_jobs (+ views)
   migration 042 adds wildfire_ignition_runs and wildfire_ignition_cells
```

CI/CD: `azure-pipelines.yml` exists in the frontend and backend (Azure DevOps, Key Vault secrets feed the Vite env vars).
SonarQube config in both. Backend has a Dockerfile.

## System 2: Wildfire ignition ML

```
Daily feature file (CSV/parquet: h3_cell res 8, date, 36 features)
   |  upload to Azure storage account "datatexas", container path wildfire-data/daily-features/
   v
Scoring job  wildfire-ignition-job (Azure Container Apps job, runs every 5 min, exits fast if nothing new)
   score_job.py -> ingest.py (validate) -> ignition_core.py (XGBoost + isotonic calibrator)
   sparse upload? expand to all ~251k Texas cells with KNN IDW (k=8), skip cells >150 km from any upload
   |  one transaction: insert run, COPY cells, flip is_current
   v
PostgreSQL: wildfire_ignition_runs, wildfire_ignition_cells   (migration 042; keeps newest 30 runs)
   ^
   |  read only
Ignition API  wildfire-ignition-api (FastAPI, main.py, port 8001 locally)
   ^
   |  VITE_IGNITION_API_URL
Frontend WildfireIgnitionTab (H3 hexagons coloured by risk band)
```

Same Docker image runs both modes: `RUN_MODE=api` serves HTTP, anything else runs the job.
Azure: resource group `tdis-rg`, registry `tdiswildfireacr2026`, identity `id-wildfire-job`.
Deploy with `az acr build ...` then `rollout.ps1 -Tag <tag>` (other `.ps1` scripts: deploy_all, deploy_api, deploy_job,
deploy_frontend, redeploy, update_images, upload_features, set_database_url, create_wildfire_db, go_live_db, ship_test).

## Integration points (the only places the two systems touch)

1. DB: [042_create_wildfire_ignition_tables.sql](../tdis-portal-db/migrations/042_create_wildfire_ignition_tables.sql). A copy of 003, 005 and 042 also lives in `tdis-ignition-api/sql/`.
2. API contract: `GET /api/v1/ignition/{coverage,runs,status,model-info}`, `POST /predict`, `GET /health`.
3. Frontend: [ignitionService.js](../tdis-portal-frontend/src/services/ignitionService.js) and [WildfireIgnitionTab.jsx](../tdis-portal-frontend/src/components/WildfireIgnitionTab.jsx).
4. Model files are duplicated: `TDIS_Ignition_BIT_V2/models/` (source of truth) and `tdis-ignition-api/model/` (deployed copy). Keep them in sync.

## Design decisions worth knowing

- Ignition scores live in their own tables, not `events_store`: ~250k rows per day would bury real events and break `view_events_store`.
- Runs load atomically; a half-loaded run is never visible. Rejected uploads are stored as `status='error'` runs and the last good run keeps being served.
- The API reads only from Postgres, so the map never waits on scoring.
- Resolution rule: res 4-6 are cheap statewide; res 7-8 require a `bbox` (100k+ polygons otherwise).
- Risk bands (calibrated probability): >=0.6 very_high, >=0.4 high, >=0.2 moderate, else low.
- Probabilities are calibrated on a ~30% fire-day sample, so they are relative risk, not real-world frequencies.
- Retention: newest 30 runs, about 60 MB per run (~1.8 GB for 30).
