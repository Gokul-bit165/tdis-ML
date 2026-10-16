# Wildfire ignition schema (migration 042)

Adds storage for the daily wildfire ignition risk predictions to the TDIS portal database. Migration file:
`migrations/042_create_wildfire_ignition_tables.sql`. Nothing that already exists is altered or dropped.

## What changed

| Object | Change |
|---|---|
| `wildfire_ignition_runs` | **New table.** One row per scoring run, plus one row for each rejected upload. |
| `wildfire_ignition_cells` | **New table.** One row per Texas H3 resolution-8 cell per run, with its probability. |
| `idx_wildfire_ignition_runs_one_current` | **New unique index.** Allows at most one run with `is_current = true`. |
| `idx_wildfire_ignition_runs_date` | **New index** on `(for_date, generated_at DESC)` for "latest run for a date". |
| `idx_wildfire_ignition_cells_lat` | **New index** on `(run_id, lat)` for visible-area queries. |
| `wildfire_ignition_hexes` | **New table (migration 043).** Per-run hexagons at H3 resolutions 4-7, pre-aggregated by the scoring job so the map API reads rows instead of grouping every cell per request. Index `idx_wildfire_ignition_hexes_lat` on `(run_id, res, lat)`. Cascades with the run. |
| `data_sources` | **One row added:** `Wildfire Ignition Model`. No column change. |
| `batch_jobs` | **One row added:** `Wildfire Ignition Scoring Job`. No column change. |
| Grants | `ed_app_admin`: ALL on both tables. `ed_app_user`: SELECT on both. Skipped if a role does not exist. |

Not touched: `events_store`, `event_types`, `counties`, `cities`, the views, `precipitation_*` and `google_flood_hub_*` tables, and
every existing column and constraint. The migration does not need PostGIS.

## Why separate tables, and not `events_store`

`events_store` holds detected events: one Point per event, with a county, a date and a batch job. The ignition model produces a score
for every cell in Texas each day, about 250,000 rows, and most of them are not events. Putting scores in `events_store` would bury
real events and break `view_events_store`. The tables follow the H3-level pattern the hazard layers already use.

## Relationships

```
data_sources (existing)        batch_jobs (existing)
      ^                               ^   (matched by name, no foreign key)
      | data_source_id                |
wildfire_ignition_runs  1 ---- n  wildfire_ignition_cells
  run_id (PK)                       (run_id, h3_cell) PK, run_id -> runs, ON DELETE CASCADE
```

`batch_jobs` is updated by the job, as the other jobs do: `STARTED` at the start, then `COMPLETED` or `FAILED` with the duration.
It is matched by the name `Wildfire Ignition Scoring Job`, as the existing jobs are.

## Columns

**`wildfire_ignition_runs`**

| Column | Type | Meaning |
|---|---|---|
| `run_id` | bigserial PK | Run id |
| `for_date` | date | Day the prediction is for, from the uploaded file's `date` column |
| `source_file`, `uploaded_at` | text, timestamptz | The uploaded file and when it was uploaded |
| `generated_at` | timestamptz | When the run was scored (default `now()`) |
| `data_source_id` | int, FK to `data_sources` | The registered model source |
| `data_source` | text | Tag from the upload. Anything other than `real` marks test data and shows a banner on the map |
| `model` | text | Model name, for example `model_bit_v2_36feat` |
| `status` | text, `ok` or `error` | `error` rows record a rejected upload and have no cells |
| `error` | text | Reason a file was rejected |
| `n_cells`, `n_input_cells`, `n_observed_cells`, `n_filled_cells` | int | Stored cells, rows uploaded, cells from the upload, cells estimated by nearest neighbours |
| `n_skipped_far` | int | Texas cells left out because no uploaded cell was within 150 km |
| `fill_method` | text | For example `knn_idw_k8` |
| `mean_probability` | real | Mean calibrated probability |
| `is_current` | boolean | The one run the map shows |

**`wildfire_ignition_cells`**

| Column | Type | Meaning |
|---|---|---|
| `run_id` | bigint, FK, cascade | Owning run |
| `h3_cell` | text | H3 resolution-8 cell id |
| `h3_7`, `h3_6`, `h3_5`, `h3_4` | text | Parent cell ids, stored so the API can group by plain column |
| `lat`, `lon` | real | Cell centre |
| `probability` | real, 0 to 1 | Calibrated probability |
| `raw_probability` | real, 0 to 1 | Uncalibrated model score |
| `observed` | boolean | `true` = in the upload, `false` = estimated from neighbours |

## How it is written and read

- **Trigger.** The job runs every 5 minutes. It exits at once unless the newest upload has no run yet, so a file is scored within minutes
  of being uploaded. A run is matched to its upload by `source_file` and `uploaded_at`, which also stops a rejected file from being retried.
  A session advisory lock (key 4204201) stops two runs overlapping.
- **Write.** `tdis-ignition-api/score_job.py` runs inside Azure. It loads a whole run in one transaction: insert the run, `COPY` the cells,
  then move `is_current` to the new run. A half-loaded run is never visible. About 251,000 cells take roughly 8 seconds.
- **Read.** The map API reads only these tables. It groups `wildfire_ignition_cells` by `h3_cell`, `h3_7`, `h3_6`, `h3_5` or `h3_4`
  depending on zoom, and limits fine zoom levels to the visible area through `(run_id, lat)`.
- **Rejected uploads.** A file that fails validation is stored as a run with `status = 'error'`. The current run keeps being served.
- **Retention.** The job keeps the newest 30 runs (`KEEP_RUNS`) and deletes older ones. Their cells go with them through the cascade.
  The current run is never deleted.

## Size

Measured on 2 runs of 250,954 cells: 113 MB for `wildfire_ignition_cells`, about 60 MB per run including indexes. Thirty runs are about
1.8 GB. `wildfire_ignition_runs` stays tiny.

## Apply

From `tdis-portal-db`, with the connection set in its `.env` (`HOST`, `PORT`, `USER`, `PASSWORD`, `DATABASE`):

```
node migrate.js
```

It applies only migrations not yet in `_migrations`, so 042 runs once. The migration is also safe to run twice on its own, because
every statement is `IF NOT EXISTS` or guarded.

Check:

```sql
SELECT tablename FROM pg_tables WHERE tablename LIKE 'wildfire_ignition%';
SELECT data_source_id, data_source FROM data_sources WHERE data_source = 'Wildfire Ignition Model';
SELECT batch_job, lastrun_status FROM batch_jobs WHERE batch_job = 'Wildfire Ignition Scoring Job';
```

The scoring job does not create tables. If they are missing it stops with a message that points to this migration.

## Roll back

```sql
DROP TABLE IF EXISTS wildfire_ignition_cells;
DROP TABLE IF EXISTS wildfire_ignition_runs;
DELETE FROM batch_jobs   WHERE batch_job   = 'Wildfire Ignition Scoring Job';
DELETE FROM data_sources WHERE data_source = 'Wildfire Ignition Model';
DELETE FROM _migrations  WHERE name = '042_create_wildfire_ignition_tables.sql';
```

Drop the tables before deleting the data source, because runs reference it.

## Possible follow-ups, not done

- Store each cell's `county_id` (a one-time spatial join against `counties`) for county summaries.
- Add H3 boundary geometry, or a view, if the layer should also be served by pg_tileserv like the other hazard layers.
