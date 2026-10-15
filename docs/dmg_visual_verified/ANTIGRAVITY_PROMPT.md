# Task: build the Damage Assessment read API and frontend tab

You are working in the repository `tdis-ml`. Build two things completely, with tests, and prove they build:

1. **`tdis-damage-api/`** (new folder): a read-only FastAPI service that serves damage assessment data and vector tiles.
2. **The Damage Assessment tab** inside the existing `tdis-portal-frontend/` app.

The database schema, the SQL tile functions, the H3 algorithms and the data loader are being built by someone else in
`tdis-damage-db/` and `tdis-damage-loader/`. You consume them through the contract in section 4. You do not write them.

## 1. Read these first, in this order

| File | Why |
|---|---|
| `docs/dmg_visual_verified/README.md` | The five design decisions and the build order |
| `docs/dmg_visual_verified/01_ARCHITECTURE_AND_INFRA.md` | Sections 3, 4, 7, 8: data model, API endpoints, budgets, failure behaviour |
| `docs/dmg_visual_verified/03_FRONTEND_IMPLEMENTATION.md` | All of it. This is your frontend specification |
| `docs/dmg_visual_verified/02_DATA_AND_ALGORITHMS.md` | Sections 3, 5, 6 only: zoom ladder, colour steps, heatmap constants. You need the numbers, not the SQL |
| `docs/PORTAL_VS_OTHERS.md`, `docs/ADDING_A_FEATURE.md` | The conventions of each side of the repo |
| `tdis-ignition-api/main.py`, `Dockerfile`, `requirements.txt` | The pattern to copy for the API |
| `tdis-portal-frontend/src/components/WildfireIgnitionTab.jsx`, `TabNavigation.jsx`, `MainLayout.jsx`, `src/services/ignitionService.js`, `src/hooks/useMapboxMap.js`, `src/config/featureFlags.js` | The patterns to copy for the tab |
| `tdis-portal-frontend/tests/` (setup, mocks, `features/components/`) | How tests and the Mapbox mock are written here |

The Word files in `docs/dmg_visual/` are the superseded original brief. Use them only for the two UI screenshots. Where they
disagree with `docs/dmg_visual_verified/`, the verified folder wins.

## 2. Part A: `tdis-damage-api/`

Create:

```
tdis-damage-api/
  main.py            FastAPI app
  db.py              all SQL, one function per query
  requirements.txt   fastapi, uvicorn[standard], psycopg[binary,pool]   (no pandas, no ML libraries)
  Dockerfile         python:3.11-slim, uvicorn on ${PORT:-8000}
  .dockerignore
  README.md          endpoints, env vars, how to run locally
  tests/             pytest
```

Endpoints, all under `/api/v1/damage`, exactly as in `01_ARCHITECTURE_AND_INFRA.md` section 4:

- `GET /assessments`
- `GET /assessments/{aid}/buildings/{building_id}`
- `GET /tiles/{aid}/h3/{z}/{x}/{y}.mvt`
- `GET /tiles/{aid}/buildings/{z}/{x}/{y}.mvt`
- `GET /tiles/{aid}/density/{z}/{x}/{y}.mvt`
- `GET /health` (at the root, like the ignition API)

Required behaviour:

- Tile endpoints run `SELECT damage_h3_mvt(%s, %s, %s, %s)` (or `damage_buildings_mvt`, `damage_density_mvt`) and return
  the bytes with `Content-Type: application/vnd.mapbox-vector-tile`. Zero bytes or NULL returns **204** with no body.
- Validate before querying: `0 <= z <= 16`, `0 <= x, y < 2^z`, otherwise 422.
- Only assessments with `status = 'published'` exist for the API. Anything else is 404. Cache the set of published ids in
  memory for 30 seconds so a tile request does not cost an extra query.
- `Cache-Control`: `public, max-age=604800, immutable` on tiles and building detail; `public, max-age=30` on
  `/assessments`; none on `/health`.
- `GZipMiddleware` (minimum size 1024). CORS from `CORS_ORIGINS`, GET only.
- Connection pool like the ignition API (`psycopg_pool.ConnectionPool`, opened lazily), `max_size=8`. A database failure
  returns 503, never a stack trace.
- All SQL is parameterised. No string formatting of user input into SQL.
- Env: `DATABASE_URL` (required), `CORS_ORIGINS`, `PORT`. Local default port **8002**.
- The class code to label mapping (0 to 4) is a constant in `main.py`, matching the table in file 01 section 3.

Tests (pytest, FastAPI `TestClient`, database replaced by a fake so they run with no Postgres):

- each endpoint's success shape and headers
- 204 on empty tile, 404 on unknown or unpublished assessment, 404 on unknown building, 422 on bad z/x/y, 503 when the
  database raises
- cache headers per endpoint

## 3. Part B: the frontend tab

Implement `03_FRONTEND_IMPLEMENTATION.md` in full: every file in its section 2, the state rules in section 3, sources,
layers and paint in section 4, the view switcher in section 5, card, legend and panel in section 6, the states in section 7,
env and pipeline changes in section 8, and the tests in section 9. Its section 10 is your acceptance checklist.

Points that are easy to get wrong:

- Use the `useMapboxMap` hook for the map, not a bare `new mapboxgl.Map`.
- All three views are **vector tile sources**. Do not write bbox fetching, debouncing or request-cancelling code for tiles.
- Set `promoteId` on the H3 and building sources.
- View switching changes layer visibility only. It must not call any service function.
- The active view lives in the URL parameter `dview`; the assessment id in `da`.
- Totals shown in the card come from `/assessments`. Never add up rendered features.
- The round buttons sit above the Mapbox scale control and logo (`bottom-14`), not on top of them.
- The tab is behind `isDamageAssessmentEnabled()`. With the flag off the app must look exactly as it does today.
- The heatmap intensity uses the `['exponential', 4]` zoom interpolation from file 02 section 6. Keep `K`, the radius and
  the ramp as named constants in `damageAssessmentConfig.js`.
- Follow the surrounding code style (JavaScript, not TypeScript; Tailwind classes; lucide icons; existing colour `#324755`).

## 4. The contract you build against

You may rely on exactly this. If something you need is missing, stop and report it; do not invent database objects.

Tables (read-only for you):

```
damage_assessments(assessment_id, event_name, aoi_name, imagery_date, model, source_file, data_source,
                   status, error, n_buildings, n_assessed, c0, c1, c2, c3, c4, bbox, created_at, published_at)
damage_buildings(assessment_id, building_id, damage_class, damage_pct, confidence, imagery_ref, assessed_at, geom, pt)
```

`damage_class` is 0 to 4 or NULL (not assessed). `bbox` is a PostGIS polygon in EPSG:4326; return it as
`[west, south, east, north]` using `ST_XMin` and friends. `pt` is a point; return it as `centroid: [lng, lat]`.

Functions, each returning `bytea`:

```
damage_h3_mvt(z integer, x integer, y integer, aid bigint)         layer "h3":        h3, n, na, c0, c1, c2, c3, c4, dom
damage_buildings_mvt(z integer, x integer, y integer, aid bigint)  layer "buildings": building_id, dc   (dc = -1 not assessed)
damage_density_mvt(z integer, x integer, y integer, aid bigint)    layer "density":   w
```

Local data: when `tdis-damage-db/` and `tdis-damage-loader/` exist, their READMEs explain how to start PostGIS and load a
synthetic assessment. Use that for a real end-to-end check. If they do not exist yet, finish everything against mocks and
say so in your report.

## 5. Boundaries

Do not create, edit or delete anything in:

- `tdis-damage-db/`, `tdis-damage-loader/`
- `tdis-portal-db/` (no migrations)
- `tdis-ignition-api/`, `TDIS_Ignition_BIT/`, `TDIS_Ignition_BIT_V2/`, `upload_tests/`
- `tdis-portal-backend/`
- `docs/` (report doc problems instead of editing)

In `tdis-portal-frontend/` you may add the new files and edit only `TabNavigation.jsx`, `MainLayout.jsx`,
`featureFlags.js`, `.env.example`, `README.md` and `azure-pipelines.yml`. One permitted extra: add the missing
`VITE_IGNITION_API_URL` line to `azure-pipelines.yml` alongside the new variables. Do not refactor or reformat existing code.

Also:

- No new npm dependencies unless unavoidable; `mapbox-gl`, `h3-js` and `lucide-react` are already installed. If you add
  one, justify it in the report.
- No secrets, tokens or real URLs in the code. No `.env` files committed.
- No deploy scripts, no Azure commands, no `git push`. Work on a branch named `feature/damage-assessment`; do not commit
  to `master`.
- Do not write any SQL that creates or alters database objects.
- Do not add code that runs or calls a model. This feature only reads stored results.

## 6. Done means all of this passes

Run these and fix what fails. Do not skip, weaken or delete a test to get a pass.

```
# frontend
cd tdis-portal-frontend
npm install
npm run lint
npm run test:run
npm run build
VITE_ENABLE_DAMAGE_ASSESSMENT=false npm run build     # the app still builds with the tab off

# api
cd tdis-damage-api
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt pytest httpx
.venv/Scripts/python -m pytest -q
.venv/Scripts/python -c "import main"
docker build -t tdis-damage-api:dev .                  # if Docker is available; otherwise say it was not run
```

Then, if a local database with a synthetic assessment is available: start the API on port 8002, start `npm run dev`, open
`/?tab=damage-assessment`, and check each line of the acceptance list in file 03 section 10 in the browser.

## 7. Final report

Finish with a short report containing:

1. Files created and files edited.
2. The exact output summary of every command in section 6 (pass or fail, counts). If a command was not run, say so and why.
3. Each acceptance criterion from file 03 section 10: verified in a browser, verified by test only, or not verified.
4. Anything in the documents that was wrong, unclear or impossible, and what you did instead.
5. Anything left unfinished.
