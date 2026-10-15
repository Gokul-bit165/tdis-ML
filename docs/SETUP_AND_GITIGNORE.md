# Setup and .gitignore

## State of a fresh clone

Nothing is installed or configured. No `node_modules`, `.env`, `.venv`, `dist` or local data exist. Everything below must be created.

## Setup

```powershell
# Frontend (Node 20+)
cd tdis-portal-frontend; npm install; copy .env.example .env   # fill in tokens and URLs
npm run dev                                                    # http://localhost:5173

# Backend
cd tdis-portal-backend; npm install                            # create .env (see README), then npm start (port 8080)

# Database
cd tdis-portal-db; npm install
# create data_import/.env from data_import/.env.example: PORT, HOST, USER, PASSWORD, DATABASE
node migrate.js

# Ignition API: see ML_AND_IGNITION_API.md
```

Minimum to see the map: `VITE_MAPBOX_TOKEN` and `VITE_API_URL`. For the wildfire tab you also need the ignition API running
(default `http://localhost:8001`) against a Postgres that has migration 042 and at least one scored run.

Backend `.env` keys: `NODE_ENV`, `CONTACT_US_FORM_EMAIL_ADDRESS`, `MAIL_SERVER`, `MAIL_PORT`, `MAIL_USERNAME`,
`MAIL_DISPLAY_NAME`, `MAIL_REPLY_TO`, `MAIL_PASSWORD`.

## What each .gitignore excludes

Four files: root, `tdis-portal-backend/`, `tdis-portal-db/`, `tdis-portal-frontend/`.

| Excluded | Where | Consequence |
|---|---|---|
| `node_modules/` | all | run `npm install` per folder |
| `.env`, `*.env`, `.env.*` (keeps `.env.example`) | root, all portal folders | create your own; never commit secrets |
| `.venv/ venv/ env/ __pycache__/ *.py[cod] build/ dist/ eggs wheels .pytest_cache/` etc. | root | Python and build artifacts |
| `_local/`, `pgdata/`, `*.sqlite`, `*.sqlite3` (db folder also `*.db`) | root, db | no local DB or local scoring input |
| `TDIS_Ignition_BIT/data/bit_train_tx.parquet` | root | v1 training data (over GitHub's 100 MB limit) |
| `TDIS_Ignition_BIT_V2/data/processed/bit_v2_train_tx.csv` and `.parquet` | root | v2 training data. **Models cannot be retrained from the repo** |
| `.claude/`, `.vscode/`, `.idea/`, `.DS_Store`, `Thumbs.db` | root | editor, AI tool, OS files (frontend keeps `.vscode/extensions.json`, `settings.json`, `tasks.json`, `launch.json`) |
| `*.log`, `logs` | portal folders only | ML `.log` files are tracked on purpose |
| `coverage/`, `.cache/`, `*.tsbuildinfo`, `.eslintcache`, `.npm`, `*.tgz` | portal folders | tool output |
| `dist/`, `dist-ssr`, `*.local` | frontend | build output |
| `*.pem` | frontend | SSL certificates |
| `dump.rdb`, `.next`, `.nuxt`, `.serverless/`, etc. | backend | template leftovers from gitignore.io |

Not ignored (so committed): the 15-21 MB model JSON files, `texas_cells.parquet` (13 MB), the county/city GeoJSON (4-8 MB),
`2026-10-5.parquet`, `upload_tests/*.parquet`.

Caution: the root pattern `build/` and `dist/` also match any folder with those names anywhere in the repo, and `lib/`-style
names are not ignored. Check `git check-ignore -v <path>` if a new file does not show up in `git status`.
