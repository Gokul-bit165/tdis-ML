# Damage Assessment tab: verified build documents

These files replace the three Word plans in `docs/dmg_visual/` as the documents to build from. The Word files are kept as
the original brief and for their reference screenshots.

| File | Read it for |
|---|---|
| [00_VALIDATION_REPORT.md](00_VALIDATION_REPORT.md) | What was right in the plans, what was wrong, and what changed |
| [01_ARCHITECTURE_AND_INFRA.md](01_ARCHITECTURE_AND_INFRA.md) | Components, data model, API, loader job, Azure requirements, budgets |
| [02_DATA_AND_ALGORITHMS.md](02_DATA_AND_ALGORITHMS.md) | H3 assignment, zoom ladder, tile SQL, colouring, density maths, checks, tests |
| [03_FRONTEND_IMPLEMENTATION.md](03_FRONTEND_IMPLEMENTATION.md) | Files to add and edit, state, layers, controls, tests, acceptance criteria |

Status on 2026-10-13: the database (`tdis-damage-db`) and loader (`tdis-damage-loader`) are built and tested against a
local PostGIS with synthetic data. The API and frontend tab exist and pass their own tests; the API has been run against
the real local database. The tab has not yet been checked in a browser, and nothing is deployed or loaded with real data.

## The five decisions that differ from the original plans

1. **Everything is a vector tile.** H3 hexagons, footprints and density points are all served as tiles keyed by one
   `assessment_id`. No bbox endpoints, no client-side fetch scheduling.
2. **Buildings are indexed directly at each H3 resolution**, not rolled up from children. The hexagon on screen contains
   exactly the buildings it counts.
3. **H3 resolutions 4 to 10 only**, chosen by tile zoom on the server. Footprints take over at zoom 14.
4. **Default colouring is the damaged share**, with small samples drawn faint. Dominant class is optional.
5. **The density heatmap is zoom-corrected** (intensity scales with 4^zoom), and below zoom 13 it is fed by weighted H3 cell
   points instead of one point per building.

## Folders and ownership

Three new top-level folders, plus new files inside the existing frontend. This splits the single `tdis-damage-api` image
described in file 01 into a loader and an API, so the two can be built independently.

| Folder | Contents | Built by |
|---|---|---|
| `tdis-damage-db/` | Migration 043 (tables, indexes, zoom function, three tile functions), schema doc, local PostGIS setup | Claude |
| `tdis-damage-loader/` | Loader job, H3 aggregation, reconciliation checks, synthetic data generator, tests | Claude |
| `tdis-damage-api/` | Read-only FastAPI: assessments, building detail, three tile endpoints | Antigravity |
| `tdis-portal-frontend/` (existing) | The Damage Assessment tab | Antigravity |

The interface between the two builders is the database contract in [ANTIGRAVITY_PROMPT.md](ANTIGRAVITY_PROMPT.md) section 4.
A copy of migration 043 also goes into `tdis-portal-db/migrations/` when it is final.

## Settled on 2026-10-13: input contract and footprint storage

The model outputs only `building_id` and a label, and only for assessed buildings. This amends file 01 sections 3 and 5.

**Two inputs instead of one file:**

| Input | Format | Columns | How often |
|---|---|---|---|
| Footprint set | GeoParquet, EPSG:4326 | `building_id` (text, unique), `geometry` (Polygon or MultiPolygon) | Once per area; again only when the footprints change |
| Results | Parquet (no geometry) | `building_id`, `damage_class` (integer 0 to 4), optional `confidence` (0 to 1) | Every model run |
| Manifest | `manifest.json` beside the results | `event_name`, `aoi_name`, `imagery_date`, `model`, `footprint_set`, `data_source` | Every model run |

The footprint set must be the same footprints the pipeline used to locate buildings, so the ids match. One row per building,
no duplicates, no rows for buildings that were not assessed.

**Storage:**

```
damage_footprint_sets(footprint_set_id, name, source, n_buildings, bbox, created_at)
damage_footprints(footprint_set_id, building_id, geom, pt)            stored once, spatially indexed
damage_results(assessment_id, building_id, damage_class, confidence)  small, one batch per model run
damage_assessments(..., footprint_set_id)                             as in file 01
damage_h3_cells(...)                                                  as in file 01
damage_buildings                                                      a VIEW joining results to footprints
```

`damage_buildings` keeps the column names in the API contract, so the API and frontend are unaffected. The building tile
function starts from the footprints in the tile and left-joins the results, so a footprint with no result is drawn grey as
"not assessed". The density view counts every footprint in the set. A result whose `building_id` is not in the footprint set
rejects the whole upload.

**Each model run is a new assessment.** The newest published one is shown by default; older ones stay selectable until
retention removes them. Tile URLs contain the assessment id, so a new run is fetched fresh and old tiles stay cached.

## Corrections found while building (the code is right; files 01 and 02 show the earlier version)

| Where | Correction |
|---|---|
| File 02 section 4, H3 and density SQL | `c.res` is compared with a `::smallint` cast. Without it the index was not used for `res` and low-zoom tiles took 30 ms instead of 1 ms |
| File 02 section 4, density SQL | Points are assigned to a tile by a half-open coordinate test with clipping off. With buffer 0 and clipping on, a point exactly on a tile edge appeared in both tiles |
| File 01 section 5 | The loader refreshes table statistics (`ANALYZE`) before its checks. Without that, one check ran for over ten minutes on a million buildings |
| File 01 section 3 | Storage follows the "Settled on 2026-10-13" section above: footprints and results are separate tables and `damage_buildings` is a view |

Measured sizes and timings are in `tdis-damage-db/docs/DAMAGE_ASSESSMENT_SCHEMA.md`.

## Open decisions (needed before or during the build)

| # | Decision | Default used in these documents | Who |
|---|---|---|---|
| 1 | Which database: the portal database (has PostGIS) or the wildfire server (no PostGIS, B1ms) | Wildfire server, with PostGIS and `btree_gist` enabled and a larger size | Infra owner |
| 2 | Is a full building inventory supplied, or only assessed buildings | Whatever is supplied is loaded; density then covers only that | Data owner |
| 3 | Meaning of `damage_percentage` and `confidence` | Stored if supplied, shown only when not null | Data owner |
| 4 | Definition of severe | The two structural-collapse classes | Product owner |
| 5 | Share breakpoints (5, 15, 30, 50%) and the small-sample threshold (5) | As listed | Product owner |
| 6 | Public or login-only access to building-level damage | Public with restricted CORS, like the ignition API | Product owner |
| 7 | Results file format | GeoParquet plus `manifest.json` | Data owner |

## Build order

1. Settle decisions 1, 2 and 7. Enable `postgis` and `btree_gist` on the chosen database.
2. Migration 043: tables, indexes, the zoom function and the three tile functions. Schema doc in `tdis-portal-db/docs/`.
3. `tdis-damage-api`: loader job, `synth_damage.py`, reconciliation checks. Load a synthetic assessment locally
   (`postgis/postgis` Docker image).
4. `tdis-damage-api`: read API. Check tiles in a browser against the synthetic data.
5. Frontend: config, service, tab registration behind the feature flag, map with the H3 view.
6. Frontend: view switcher, building view, detail panel.
7. Frontend: density view; calibrate the heatmap constant `K` on uniform synthetic data.
8. Tests on all three sides; measure the budgets in file 01 section 7 on a realistic synthetic load (dense city, rural,
   2 million buildings).
9. Deploy API and job to Azure; add the env vars to the pipeline; turn the flag on in dev.
10. Load the first real assessment; compare hexagon counts and footprints with the source data for one known area.
