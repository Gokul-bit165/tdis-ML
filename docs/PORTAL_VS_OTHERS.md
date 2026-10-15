# Portal (`tdis-portal-*`) vs the other folders

The repo holds two different codebases with different languages, tooling, deployment and habits.
Work in one must follow that side's conventions. Authorship of each side is not recorded in git (only two commits), so this file
describes what the code shows, not who or what wrote it.

- **Portal side:** `tdis-portal-frontend`, `tdis-portal-backend`, `tdis-portal-db`
- **Other side:** `tdis-ignition-api`, `TDIS_Ignition_BIT`, `TDIS_Ignition_BIT_V2`, `upload_tests/`, `2026-10-5.parquet`
  (the wildfire ignition ML system, a later add-on that plugs into the portal)

## 1. Side by side

| | Portal (`tdis-portal-*`) | Others (ignition ML) |
|---|---|---|
| Purpose | Public Texas disaster map and portal (UI, admin/org pages, contact emails, DB schema) | Train a wildfire-ignition model and serve its daily predictions |
| Language | JavaScript (frontend ES modules + JSX; backend CommonJS `require`; DB runner in Node) | Python (FastAPI, pandas, XGBoost, scikit-learn) plus PowerShell scripts |
| Frameworks | React 19, Vite 6, Tailwind 4, Radix UI, Redux Toolkit, React Router 7, Mapbox GL, Express | FastAPI, Pydantic, psycopg pool, XGBoost, joblib |
| Data store | PostgreSQL, schema by numbered SQL migrations (`001`-`042`) applied by `node migrate.js` | Writes into the same PostgreSQL (tables from migration 042); model files on disk; uploads in Azure Blob storage |
| Config | `.env` files (gitignored) and build-time `VITE_*` variables | Environment variables (`DATABASE_URL`, `MODEL_DIR`, `CORS_ORIGINS`, `RUN_MODE`, ...) |
| Build and deploy | Azure DevOps `azure-pipelines.yml` in frontend and backend, Key Vault secrets, Static Web App config, backend Dockerfile | One Docker image, Azure CLI and PowerShell scripts (`az acr build`, `rollout.ps1`), Azure Container Apps (API app + scheduled job) |
| Code quality | ESLint, Prettier, SonarQube, Semgrep ignore, Vitest (~105 frontend test files), `__tests__` for backend (9 files) | No test files, no lint config, no CI pipeline file seen in `tdis-ignition-api` |
| Docs style | Short READMEs, some stale (`event-detection-*` names) | Detailed README and training reports with metrics, tables and figures |
| Large files in git | Static GeoJSON and images | Model JSON (15-21 MB), parquet (13 MB), figures; training data excluded by `.gitignore` |
| Naming | `tdis-portal-*` kebab-case folders | Mix: `TDIS_Ignition_BIT*` (snake/caps) and `tdis-ignition-api` (kebab) |
| Run time | Browser SPA + always-on Node server | Always-on API plus a job that wakes every 5 minutes |

## 2. Architecture and flow

### Portal flow (request-driven, user-initiated)

```
User -> React SPA (tabs on a Mapbox map)
          |-- Keycloak login
          |-- fetch -> Portal FastAPI (events, hazards, flood, outages)   [outside this repo]
          |-- fetch -> Cube.js, pg_tileserv, RAMP, AI services            [outside this repo]
          '-- POST  -> tdis-portal-backend /api/emails/*  -> SMTP mail
All portal data tables: PostgreSQL (tdis-portal-db migrations)
```

Data arrives from external batch jobs into `events_store` (tracked in `batch_jobs`); the UI only reads and displays.

### Others flow (schedule-driven, file-initiated)

```
Daily feature file uploaded to Azure storage
   -> scheduled job (every 5 min) validates, fills Texas cells, scores with XGBoost
   -> one atomic DB transaction into wildfire_ignition_runs / _cells
   -> read-only FastAPI -> portal tab WildfireIgnitionTab draws hexagons
```

### Training flow (offline, manual)

```
Raw data -> build_dataset.py -> parquet (gitignored) -> tune_train_model.py (GPU, XGBoost, staged search)
   -> model + calibrator + feature_list.json + results + figures -> copy into tdis-ignition-api/model/ -> rebuild image
```

## 3. Method differences

| Topic | Portal | Others |
|---|---|---|
| State management | Redux Toolkit store, RTK Query for email calls, React hooks for map layers | Stateless request handlers; a small in-memory cache and a connection pool in `main.py` |
| Layering | UI components -> hooks -> services -> config | `main.py` (HTTP) -> `db.py` (SQL) -> `ignition_core.py` (model) |
| Feature switching | Build-time flags in `featureFlags.js` | `RUN_MODE`, `FORCE`, `AUTO_MIGRATE` environment switches |
| Schema changes | Add a migration, never edit applied ones | Never creates tables itself; points to migration 042 |
| Failure handling | Toasts and loading states in the UI; winston/morgan logs in the backend | Rejected uploads stored as `status='error'` runs; DB failures return HTTP 503; last good run keeps serving |
| Versioning | Single working tree, migration numbers | Model versions as sibling folders (`..._BIT`, `..._BIT_V2`) |

## 4. Where the two sides touch (do not break these)

1. DB migration [042](../tdis-portal-db/migrations/042_create_wildfire_ignition_tables.sql) (copy in `tdis-ignition-api/sql/`).
2. API contract under `/api/v1/ignition` consumed by [ignitionService.js](../tdis-portal-frontend/src/services/ignitionService.js).
3. Tab wiring in `TabNavigation.jsx`, `MainLayout.jsx` and `WildfireIgnitionTab.jsx`.
4. Env var `VITE_IGNITION_API_URL`.

Everything else is independent: the portal builds and runs without any ignition folder, and the ignition system needs only
Postgres plus storage.

## 5. Rules of thumb for agents

- Portal change: use JavaScript, copy an existing tab/service/hook, add tests in `tests/features/`, run `npm run lint` and `npm run test:run`, add env vars to `.env.example`, README and the pipeline.
- Backend or DB change: new migration number, `.sql` extension, guarded statements, document it in `tdis-portal-db/docs/`.
- ML/API change: Python, keep to `tdis-ignition-api`, add a new model folder instead of overwriting, keep the two model copies in sync, remember there are no tests, so verify by running the job and API locally.
- A feature that needs data from the portal DB should read it through the existing Portal FastAPI or migrations, not by importing across the two sides.
- If a task does not name a side, ask which one before editing.
