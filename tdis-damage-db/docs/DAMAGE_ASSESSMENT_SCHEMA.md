# Damage assessment schema (migration 043)

Adds storage and vector-tile functions for building damage results. Migration file:
`migrations/043_create_damage_assessment_tables.sql`. Nothing that already exists is altered or dropped.

## What changed

| Object | Kind | Purpose |
|---|---|---|
| `damage_footprint_sets` | table | One row per uploaded set of building outlines |
| `damage_footprints` | table | One row per building: outline and a point inside it. Stored once per set |
| `damage_assessments` | table | One row per model run, plus one row for each rejected upload |
| `damage_results` | table | One row per assessed building per run: class and optional confidence. No geometry |
| `damage_h3_cells` | table | One row per non-empty H3 cell, resolutions 4 to 10, per run. Counts only |
| `damage_buildings` | view | Every footprint of a run's set joined to its result. `damage_class IS NULL` = not assessed |
| `damage_h3_res_for_zoom(z)` | function | H3 resolution drawn at a tile zoom |
| `damage_h3_mvt(z, x, y, aid)` | function | Vector tile, layer `h3`: hexagons with `h3, n, na, c0..c4, dom` |
| `damage_buildings_mvt(z, x, y, aid)` | function | Vector tile, layer `buildings`: outlines with `building_id, dc`. Empty below zoom 14 |
| `damage_density_mvt(z, x, y, aid)` | function | Vector tile, layer `density`: points with weight `w` |
| `idx_damage_footprints_geom` | GiST index | `(footprint_set_id, geom)` |
| `idx_damage_h3_cells_geom` | GiST index | `(assessment_id, res, geom)` |
| `idx_damage_assessments_published` | index | Newest published runs |
| `data_sources`, `batch_jobs` | one row each | `Damage Assessment Model`, `Damage Assessment Loader Job`. Skipped where those tables do not exist |
| Extensions | `postgis`, `btree_gist` | Created if absent |
| Grants | | `ed_app_admin`: ALL on the tables. `ed_app_user`: SELECT on tables and view. Skipped if a role does not exist |

## Relationships

```
damage_footprint_sets 1 ---- n damage_footprints          (footprint_set_id, building_id) PK, cascade
        ^
        | footprint_set_id (NULL on error rows)
damage_assessments    1 ---- n damage_results             (assessment_id, building_id) PK, cascade
                      1 ---- n damage_h3_cells            (assessment_id, res, h3) PK, cascade

damage_buildings = damage_assessments  JOIN damage_footprints  LEFT JOIN damage_results
```

A result is tied to its outline by `building_id` within the run's footprint set. There is no foreign key from
`damage_results` to `damage_footprints`; the loader checks the link before publishing and rejects a run with any unknown id.

## Why it is shaped this way

- **Outlines are separate from results.** The model outputs only an id and a class. Outlines are large and do not change
  between runs, so they are stored once and each run adds only a small table.
- **An assessment is immutable.** Every model run gets a new `assessment_id`, which is part of every tile URL. Tiles can
  therefore be cached indefinitely, and a new run is always fetched fresh. A correction is a new run.
- **Only counts are stored in the cells.** Percentages are computed from the counts when drawn, so a wrongly averaged
  percentage cannot exist. The table enforces `c0 + c1 + c2 + c3 + c4 = na <= n`.
- **Each building is indexed directly at every resolution**, not rolled up from finer cells, so a hexagon counts exactly
  the buildings whose point lies inside it. At every resolution the cells add up to the same totals.
- **`res` is in the cell index.** Without it a statewide low-zoom tile would read every fine cell before filtering.
  The tile functions compare `res` with a `smallint` cast; without the cast the index is not used for `res`.
- **Density points are tested on a half-open interval, not clipped.** A heatmap adds every point it gets, and clipping
  keeps a point that sits on a tile edge in both tiles.

## Class codes

| `damage_class` | Label |
|---|---|
| 0 | Undamaged |
| 1 | Partial Roof Damage |
| 2 | Total Roof Damage |
| 3 | Partial Structural Collapse |
| 4 | Total Structural Collapse |
| NULL in the view, `dc = -1` in tiles | Not assessed |

## Zoom ladder

| Tile zoom | 0 to 5 | 6 | 7 to 8 | 9 | 10 to 11 | 12 | 13 and up |
|---|---|---|---|---|---|---|---|
| H3 resolution of the `h3` layer | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
| Density points | res 5 cells | res 6 | res 7 | res 8 | res 9 | res 10 | one per building |

## How it is written and read

- **Write.** `tdis-damage-loader` loads a footprint set in one transaction, and later publishes each run in one
  transaction: insert the assessment, `COPY` results and cells, run the reconciliation checks, commit. A run that fails
  a check leaves nothing behind except a `status = 'error'` row written afterwards. An advisory lock (key 4304301) stops
  two loads overlapping.
- **Read.** `tdis-damage-api` lists `status = 'published'` assessments, reads one building through the view, and returns
  the bytes of the three tile functions. The function arguments are named `z, x, y`, which is what pg_tileserv requires
  of a function layer, so pg_tileserv can serve the same functions (`?aid=<id>`).
- **Retention.** The loader keeps the newest 12 published runs (`KEEP_ASSESSMENTS`) and the newest 50 error rows.
  Footprint sets are never deleted automatically.

## Size and speed

Measured on the local PostGIS container (a development laptop) with synthetic data.

| | 200,000 buildings | 1,000,000 buildings |
|---|---|---|
| Load the footprint set | 10 s | 102 s |
| Publish one run (85% assessed) | 13 s | 85 s |
| `damage_footprints` including indexes | 63 MB | 372 MB |
| `damage_results` per run | 17 MB | 131 MB |
| `damage_h3_cells` per run | 51 MB (129,308 cells) | 205 MB (295,227 cells) |

Tiles in the densest area of each data set (size, compressed size, database time):

| Tile | 200,000 buildings | 1,000,000 buildings |
|---|---|---|
| `h3`, zoom 4 to 8 | under 11 KB, under 5 KB, 1 to 3 ms | not measured separately |
| `h3`, largest (zoom 10) | 106 KB, 31 KB, 25 ms | 109 KB, 37 KB, 26 ms |
| `density`, largest (zoom 13) | 182 KB, 49 KB, 29 ms | 242 KB, 65 KB, 56 ms |
| `buildings`, zoom 14 | 171 KB, 69 KB, 70 ms (3,846 outlines) | 273 KB, 113 KB, 155 ms (6,423 outlines) |

The outlines are synthetic rectangles; real outlines have more vertices and will be larger. Measure again on the target
server with real data.

## Rollback

`rollback/043_rollback.sql` drops the four functions, the view and the five tables, and removes the two registration rows
and the `_migrations` entry. All damage data is lost. The extensions are left in place.
