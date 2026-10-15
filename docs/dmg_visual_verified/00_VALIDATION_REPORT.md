# Validation report: Damage Assessment visualization plans

Date: 2026-10-12

Reviewed (in `docs/dmg_visual/`):

| Short name | File |
|---|---|
| **D1** | `Damage_Triage_Visualization_Layer_Specification.docx` |
| **D2** | `Damage_Assessment_Three_View_Architecture_and_Algorithms.docx` |
| **D3** | `Damage_Assessment_Frontend_Implementation_Spec.docx` |

How it was validated: each claim was checked against (a) the code in this repo (wildfire tab, ignition API, portal DB
migrations, the portal's vector-tile layers), (b) H3 and Web Mercator geometry, worked out numerically, and (c) how Mapbox GL JS
and PostGIS actually behave. Nothing was built or run; numbers marked "estimate" must be measured on real data.

## Verdict

The product idea is sound and most principles are right. The plans are **not buildable as written**: they contradict each
other on how data is delivered, contain one algorithm error that makes a stated acceptance test impossible to pass, and leave
every infrastructure decision open. The corrected design is in files 01 to 03 of this folder.

## What is correct and kept unchanged

- Three views over one persisted dataset; no map interaction ever triggers inference.
- One building is counted in exactly one H3 cell, using a point guaranteed to be inside the footprint.
- Percentages are always computed from summed counts, never by averaging percentages.
- "Not assessed" is a different state from "Undamaged" and is drawn differently.
- The five class labels and hex colours, used identically in map, legend and panel.
- Footprints are delivered as vector tiles, never as one statewide GeoJSON.
- The density view is independent of damage class.
- Version in the tile URL so tiles can be cached as immutable.
- The worked example arithmetic (100 buildings, 60 damaged, 25 severe) is right.
- H3 basics (16 resolutions, hierarchical, pentagons exist). No pentagon falls in Texas, so none needs handling.

## Findings

Severity: **High** = wrong result, cannot scale, or blocks the build. **Medium** = misleading or wasteful. **Low** = detail.

### Algorithm

| # | Sev | Where | Problem | Fix (see file) |
|---|---|---|---|---|
| A1 | High | D1 5.3, D2 5.5, D2 11 | Parent rollup is contradictory. The pseudo-code indexes each building at every resolution **and** then sums children into parents. The two methods give different counts, because an H3 parent hexagon does not geometrically contain its seven children (they are rotated and overhang). "Sum child counts **or** recompute from records" is therefore not a free choice, and the test "parent count equals the sum of its child counts" fails under direct indexing. | Index each building directly at every stored resolution. The hexagon drawn then contains exactly the buildings it counts. Drop `parent_h3_index`. New invariant: at every resolution the cell totals sum to the assessment totals. (02, section 2) |
| A2 | High | D1 5.2, D2 5.2 | Resolutions 4 to 12 go too deep. A res 11 cell is about 2,150 m2 and a res 12 cell about 307 m2, the size of one or two houses. Aggregation there is meaningless and multiplies stored rows. | Store res 4 to 10 only. Footprints take over from zoom 14. (02, section 3) |
| A3 | Med | D1 5.2, D2 5.2 | The edge-length table is the superseded H3 table, about 13% too small (res 8 is about 0.53 km, not 0.46 km). | Corrected table with areas. (02, section 3) |
| A4 | High | D1 5.5, D2 5.7 | "Dominant class" colouring hides damage. In almost every cell the most frequent class is Undamaged, so the map is green even where 40% of buildings are damaged. | Default metric is damaged share. Dominant class stays as an option, ties go to the more severe class. (02, section 5) |
| A5 | Med | D1 5.5, D2 5.7 | No protection against tiny samples. A cell with 1 building at 100% looks identical to a cell with 900 buildings at 100%. | Cells with fewer than 5 assessed buildings are drawn faint and the count is always shown. (02, section 5) |
| A6 | High | D1 7, D2 7.2 | One point per building at every zoom does not scale. A statewide inventory is on the order of 10 million points; a low-zoom density tile would be unbounded. | Below zoom 13 the density points are H3 cell centres of mass weighted by building count. From zoom 13 they are real building points. (02, section 6) |
| A7 | Med | D1 7, D2 7.2, D3 5C | A default Mapbox heatmap changes meaning with zoom: its radius is in pixels, so the same neighbourhood looks 4 times denser each time you zoom out one level. The plans say the heatmap is "relative" but do not fix this, so the legend would be wrong at every zoom but one. | Scale intensity by 4^zoom. The colour then maps to approximate buildings per km2 at all zooms. (02, section 6) |
| A8 | Low | D1 5.4 | `mean_confidence` and `average_damage_percentage` per cell cannot be rolled up or defined yet. | Not stored in v1. If needed later, store sum and count. |

### Architecture and data delivery

| # | Sev | Where | Problem | Fix |
|---|---|---|---|---|
| B1 | High | D1 11, D3 9 vs D2 8 | The three plans disagree. D1 and D3 use bbox JSON endpoints (`/buildings?bbox=`) with no version parameter. D2 uses versioned vector tiles and has no `aoi_id`. | One contract: all three views are vector tiles keyed by `assessment_id`. One id replaces both "version" and "AOI". (01, section 4) |
| B2 | Med | D2 9, D3 9 | "Debounce viewport requests, cancel stale requests, cache H3 by bbox." Arbitrary bboxes are different on every pan, so they can never be cached by a browser or CDN. | Tiles only. Mapbox already schedules, cancels and caches tile requests, so that custom code disappears. (01, section 4) |
| B3 | Med | D1 12, D2 9 | "Recompute only affected aggregates when records change" contradicts immutable versioned caching. | An assessment is an immutable snapshot. A correction is loaded as a new assessment. (01, section 3) |
| B4 | Med | D2 6.2 | "Simplify geometries by zoom" for footprints. Not needed once footprints are only served from zoom 14, and simplifying small rectangles produces broken shapes. | No simplification. A zoom gate instead. (02, section 4) |
| B5 | Med | all | A hexagon that crosses a tile edge appears in both tiles. Any client-side summing of rendered features would double count. | Totals come from the API, never from rendered features. (03, section 6) |
| B6 | Low | D2 6.2 | `building_id` is text. Mapbox feature-state needs a numeric id unless `promoteId` is set, and one footprint can be split over two tiles. | `promoteId` on both sources. (03, section 4) |

### Infrastructure (not addressed in any of the three plans)

| # | Sev | Problem | Fix |
|---|---|---|---|
| C1 | High | "Adapt to the existing backend" has no target. The portal's data API is not in this repo, `tdis-portal-backend` only sends email, and `tdis-ignition-api` is a model server. | New small service `tdis-damage-api`, built like `tdis-ignition-api`. (01, section 2) |
| C2 | High | The wildfire database (`pg-wildfire-tdis`) is a Burstable B1ms server created without PostGIS. Vector tiles need PostGIS. | Decide the database first; enable `postgis` and `btree_gist`; size up from B1ms. (01, section 6) |
| C3 | Med | No ingestion path. The plans exclude it, but nothing can be built or tested without a way to load a dataset. | A loader job plus a synthetic data generator, mirroring the wildfire job. (01, section 5) |
| C4 | Med | No decision on who may see building-level damage. The ignition API is public. | Listed as an open decision. (README) |
| C5 | Low | New env var must reach the build pipeline. `VITE_IGNITION_API_URL` is in `.env.example` but not in `azure-pipelines.yml`, so a pipeline build falls back to `http://localhost:8001`. The new variable would repeat that. | Add the new variable to the pipeline; fix the wildfire one at the same time. (03, section 8) |

### Frontend (D3)

| # | Sev | Problem | Fix |
|---|---|---|---|
| F1 | Med | Component names (`MapWorkspace`, `TopMapNavigation`, `MapViewport`) do not exist. The real ones are `MainLayout`, `MapSection`, `TabNavigation`. | Real file list. (03, section 2) |
| F2 | Med | "Preserve the view when the user returns" cannot work as described: each tab owns its own map and is unmounted on tab change, so its state is lost. | Keep the view in the URL (`dview`), next to the existing `tab` parameter. (03, section 3) |
| F3 | Med | The bottom-left spot is already used by the Mapbox scale control and the Mapbox logo, which must stay visible. | Controls sit above them. (03, section 5) |
| F4 | Med | Green and red are hard to tell apart for colour-blind users, and the yellow is weak on the streets basemap. | Colours unchanged (they are a requirement); add a dark outline and always pair colour with a text label. (03, section 4) |
| F5 | Low | D3 refers to a "Markdown companion" with flowcharts that was not supplied. | Replaced by file 03. |
| F6 | Low | Lists in the plans are numbered continuously across sections (8 to 25). | Cosmetic. |

## What still needs an answer from the data owner

These cannot be validated from the documents or the repo. They are listed with defaults in the README.

1. Is a full building inventory supplied (including buildings not assessed), or only assessed buildings?
2. What do `damage_percentage` and `confidence` mean, and are they supplied?
3. Is "severe" the two collapse classes? (Used as the default.)
4. How many buildings per assessment, and how many assessments are live at once?
5. Public or login-only?
