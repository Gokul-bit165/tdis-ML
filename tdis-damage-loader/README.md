# tdis-damage-loader

Loads building damage results into PostGIS for the portal's Damage Assessment tab. It stores results that a model has
already produced; it never runs a model.

```
footprints file (once)  ->  damage_footprints
results + manifest      ->  join to footprints, count per H3 cell, check totals  ->  one new published assessment
 (every model run)                                                                  read by tdis-damage-api
```

Tables and tile functions come from `tdis-damage-db/migrations/043_create_damage_assessment_tables.sql`.
Design: `docs/dmg_visual_verified/`.

## What to upload

**1. Footprints, once per area** (`footprints/<set name>.parquet`)

GeoParquet (or `.geojson`) in EPSG:4326 with two columns:

| Column | Type | Rule |
|---|---|---|
| `building_id` | text | Unique. Must be the same ids the model outputs |
| `geometry` | Polygon or MultiPolygon | The building outline |

The set name is the file name without its extension. A set cannot be changed after loading; upload changed footprints
under a new name. Include every building in the assessed area, not the whole state: a building in the set with no
result is drawn grey as "not assessed".

**2. Results, every model run** (`assessments/<run folder>/results.parquet`, or `results.csv`)

| Column | Type | Rule |
|---|---|---|
| `building_id` | text | Unique. Must exist in the footprint set |
| `damage_class` | integer 0 to 4 | Or the exact label. No empty values: leave unassessed buildings out |
| `confidence` | number 0 to 1 | Optional |
| `damage_pct` | number 0 to 100 | Optional |
| `imagery_ref`, `assessed_at` | text, timestamp | Optional |

| Code | Label |
|---|---|
| 0 | Undamaged |
| 1 | Partial Roof Damage |
| 2 | Total Roof Damage |
| 3 | Partial Structural Collapse |
| 4 | Total Structural Collapse |

**3. Manifest, with every run** (`assessments/<run folder>/manifest.json`). Upload it **last**: the run is picked up when
the manifest appears.

```json
{
  "event_name": "Hurricane Example",
  "aoi_name": "Harris County",
  "imagery_date": "2026-10-08",
  "model": "DamageTriageFormer-1.2",
  "footprint_set": "harris_2026",
  "data_source": "real"
}
```

`event_name`, `imagery_date` and `footprint_set` are required. Any `data_source` other than `real` shows a test-data
banner on the map.

## What happens to an upload

- A file is validated as a whole. One bad row rejects the file, and the reason is stored as a `status = 'error'` row
  (`python damage_job.py list` shows it). Published assessments keep being served.
- A run is published in one transaction, after these checks pass: stored results equal the file; every result has a
  footprint; at each H3 resolution 4 to 10 the cells add up to the assessment totals for buildings, assessed buildings
  and each class. If a check fails nothing is published.
- Every run becomes a new assessment id. Earlier ones stay until retention (`KEEP_ASSESSMENTS`, default 12) removes them.
- An upload is processed once, matched by name and upload time. To retry a rejected file, upload it again.

## Commands

```powershell
python -m venv .venv; .\.venv\Scripts\pip install -r requirements-dev.txt
$env:DATABASE_URL = "postgresql://damage:damage@localhost:5544/damage"   # local PostGIS, see tdis-damage-db

python damage_job.py footprints harris.parquet --name harris_2026
python damage_job.py results results.parquet --manifest manifest.json
python damage_job.py list
$env:DAMAGE_URI = "_local\in"; python damage_job.py poll                 # what the scheduled job runs
```

`DAMAGE_URI` is a local folder or `az://<account>/<container>/<prefix>` (Azure auth through `DefaultAzureCredential`).

## Synthetic data

```powershell
python synth_damage.py --buildings 200000 --out _local\in
$env:DAMAGE_URI = "_local\in"; python damage_job.py poll
```

This writes a fake footprint set and run around Houston, tagged `data_source = "synthetic"`. It is test data.

## Tests

```powershell
.\.venv\Scripts\python -m pytest -q
```

The algorithm and validation tests need nothing. The database tests create and drop their own database on the server in
`TEST_DATABASE_URL` (default: the local PostGIS on port 5544) and are skipped if it is not running.

## Docker

The image needs the migration beside it. Build from this folder after copying it:

```powershell
New-Item -ItemType Directory -Force sql | Out-Null
Copy-Item ..\tdis-damage-db\migrations\043_create_damage_assessment_tables.sql sql\
docker build -t tdis-damage-loader:dev .
```

Env: `DATABASE_URL` (required), `DAMAGE_URI` (required for `poll`), `KEEP_ASSESSMENTS`, `AUTO_MIGRATE=1` (dev only).

## Files

| File | Purpose |
|---|---|
| `damage_core.py` | Representative point, H3 assignment, per-cell aggregation |
| `ingest.py` | Reading and validating footprints, results and manifest |
| `db.py` | Writes, the publishing transaction, reconciliation checks, retention |
| `damage_job.py` | Command line and the polling job |
| `store.py` | Local folder or Azure Blob |
| `synth_damage.py` | Synthetic data generator |
