# tdis-damage-api

Read-only FastAPI service that serves damage assessment data, building details, and Mapbox Vector Tiles (MVT) for the TDIS Portal Damage Assessment tab.

## Architecture

The API connects directly to PostgreSQL with PostGIS and the functions installed by migration 043:
- `damage_h3_mvt(z, x, y, aid)`
- `damage_buildings_mvt(z, x, y, aid)`
- `damage_density_mvt(z, x, y, aid)`

It reads from tables:
- `damage_assessments`
- `damage_buildings`
- `damage_h3_cells`

Only assessments with `status = 'published'` are accessible.

## Endpoints

All data endpoints are under `/api/v1/damage`:

| Endpoint | Method | Description | Cache-Control |
|---|---|---|---|
| `/api/v1/damage/assessments` | GET | List published assessments (newest first) with bbox and per-class counts | `public, max-age=30` |
| `/api/v1/damage/assessments/{aid}/buildings/{building_id}` | GET | Building details, damage class, label, coordinates, confidence | `public, max-age=604800, immutable` |
| `/api/v1/damage/tiles/{aid}/h3/{z}/{x}/{y}.mvt` | GET | Vector tiles with H3 aggregated cells and class summaries | `public, max-age=604800, immutable` |
| `/api/v1/damage/tiles/{aid}/buildings/{z}/{x}/{y}.mvt` | GET | Vector tiles with building footprints and damage classes | `public, max-age=604800, immutable` |
| `/api/v1/damage/tiles/{aid}/density/{z}/{x}/{y}.mvt` | GET | Vector tiles with weighted points for density heatmap | `public, max-age=604800, immutable` |
| `/health` | GET | Service and database health status | (none) |

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | (none) | PostgreSQL connection string (`postgresql://user:password@host:5432/dbname?sslmode=require`) |
| `CORS_ORIGINS` | No | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated list of allowed CORS origins |
| `PORT` | No | `8002` (local) / `8000` (Docker) | Port to bind Uvicorn |

## Local Development

```powershell
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt pytest httpx
$env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/tdis"
.\.venv\Scripts\python -m uvicorn main:app --port 8002 --reload
```

## Running Tests

```powershell
.\.venv\Scripts\python -m pytest -q
```
