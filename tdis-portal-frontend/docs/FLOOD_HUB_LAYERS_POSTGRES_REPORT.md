# Flood Hub map overlays — layer-by-layer report (frontend ↔ Postgres)

This document describes **each overlay** exposed in the **Flood Hub overlays** widget (`FloodHubPrdExtensionsWidget` / `FloodHubPrdControls`), what it represents in the product sense, **what the TDIS Portal frontend implements today**, **what data is still missing or mocked**, and **what to model in PostgreSQL (and serve via pg_tileserv or APIs)** so layers can move from **Static** to **Live**.

Companion docs:

- `FLOOD_HUB_DATA_REQUIREMENTS.md` — concise field checklist for frontend replacement.
- Internal PRD: `FloodHub_PRD_v4.docx` — full product scope, phases, and policies.

Coordinate system assumed everywhere: **WGS84 (EPSG:4326)** unless you explicitly store Web Mercator for tooling.

---

## 1. Gauge hex cells (vector tiles) — **Live today**

### What it is

Primary **Google Flood Hub** view on HMED: **H3 resolution 10** cells covering Texas, each cell summarizing **riverine gauge forecast** behavior (forecast peak vs. warning / danger / extreme thresholds). This is the layer users interpret as “where modeled flooding concern is elevated along the river network,” aligned to the Flood Hub gauge semantics.

### What we have (frontend)

- Mapbox **vector tile** source pointing at **pg_tileserv** (see `LAYER_CONFIG.google_flood_hub` in `src/config/hmedLayerConfig.js`).
- Fill coloring from **forecast peak** vs. thresholds (`getFloodHubPeakThresholdColorExpression` in `src/utils/hmedMapUtils.js`).
- Hex click opens the **gauge side panel** with fields merged from MVT + static fallbacks (`buildFloodHubGaugePanelModel` in `src/utils/floodHubPrdUtils.js`).
- Toggle `gauges` hides/shows hex + outline via `useHMEDFloodHubOverlays.js` (`syncFloodHubGaugeHexVisibility`).

### MVT properties the UI already reads

| Property (snake_case preferred; case-insensitive fallback in code) | Purpose                          |
| ------------------------------------------------------------------ | -------------------------------- |
| `predicted_peak`                                                   | Tier / fill color                |
| `current_value`                                                    | Side panel “current (model)”     |
| `warning_threshold`, `danger_threshold`, `extreme_threshold`       | Tier breaks                      |
| `gauge_id`                                                         | Identity; joins to detail / NWPS |
| `unit`                                                             | Display (e.g. CMS → m³/s label)  |
| `fetched_at`                                                       | Run time in UI                   |
| `h3_l10_id` or `h3_l10_hex`                                        | Cell id display                  |
| `quality_verified` / `qualityVerified`                             | Badge; relates to pin filter     |
| `nwps_url` / `nwps_gauge_url` / `authoritative_gauge_url`          | Authoritative gauge link         |
| `is_virtual` / `isVirtual`                                         | Virtual gauge treatment          |

### What is missing or incomplete

- **Staleness / freshness policy** in UI (PRD: explicit banner if hydrology older than policy) is not wired to tile metadata only via optional `fetched_at` on features.
- **72-hour horizon** and cache rules are not enforced in the browser; backend materialization should enforce freshness before tiles ship.

### PostgreSQL / pg_tileserv — what you likely have already

- A **Gold** (or equivalent) table or materialized view that **one row = one H3 L10 cell** (or polygon = cell boundary), with the columns above.
- pg_tileserv layer name should match what the frontend expects: `vectorTileSourceLayer: 'public.google_flood_hub_gauges'` (adjust if your function emits a different name).

### Suggested Postgres shape (illustrative)

```sql
-- Illustrative only — align with your existing Gold schema
CREATE TABLE gold.google_flood_hub_gauges_l10 (
  h3_l10_id       text PRIMARY KEY,           -- or bigint if you use integer H3 indexes
  geom            geometry(Polygon, 4326) NOT NULL,  -- cell boundary for MVT
  gauge_id        text NOT NULL,
  predicted_peak  double precision,
  current_value   double precision,
  warning_threshold  double precision,
  danger_threshold   double precision,
  extreme_threshold  double precision,
  unit            text,
  fetched_at      timestamptz,
  quality_verified boolean,
  is_virtual      boolean,
  nwps_url        text,
  -- optional: run_id, forecast_issue_time, source_batch_id for staleness
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fh_gauges_l10_geom
  ON gold.google_flood_hub_gauges_l10 USING gist (geom);
```

**pg_tileserv**: expose this via your standard template/function; ensure **Texas bbox** filter in the SQL function if global tables exist but the portal is Texas-only.

---

## 2. Gauge pins — **Static today (GeoJSON in browser)**

### What it is

**Point symbology** at gauge locations (or stand-ins) with **tier-colored** pins (Extreme / Danger / Warning / default). PRD describes pins as matching Flood Hub **severity** conventions; “higher confidence” vs “additional coverage” switches which pins appear (`qualityVerified` filter).

### What we have (frontend)

- `FLOOD_HUB_STATIC_GAUGE_PINS` in `src/data/floodHubPrdStaticData.js` — **hard-coded GeoJSON** `Point` features.
- Map layer `flood-hub-prd-pins-circle` in `useHMEDFloodHubOverlays.js`: `circle-color` by `tier` string; filter `qualityVerified == true` when mode is `higher`.
- Clicks open the same **gauge side panel** as hex (`buildFloodHubGaugePanelModel`).

### GeoJSON properties used today

| Property                                              | Purpose                                                           |
| ----------------------------------------------------- | ----------------------------------------------------------------- |
| `gauge_id`                                            | Join key to static `FLOOD_HUB_STATIC_GAUGE_DETAILS` and live hex  |
| `tier`                                                | `Extreme` \| `Danger` \| `Warning` \| (other → default pin color) |
| `qualityVerified`                                     | Pin filter for “Higher confidence”                                |
| `isVirtual`                                           | Optional; passed through to panel                                 |
| `predicted_peak`, `current_value`, thresholds, `unit` | Panel / consistency with hex                                      |

### What is missing

- **Real WGS84 coordinates** from your gauge catalog (USGS/NWPS/API), not demo points.
- **Tier** should ideally be **derived** from the same peak/threshold rules as hex, or supplied consistently from Gold to avoid pin/hex mismatch.

### PostgreSQL / ingestion — required to go Live

**Option A — Dedicated pin table (simplest for pg_tileserv)**

- Table of points: `geom Point, 4326`, same attribute columns as above, **one row per gauge** you want to show as a pin.

**Option B — Derive pins from the same L10 table**

- Compute **representative point** per `gauge_id` (e.g. centroid of H3 cell, or authoritative lat/lon from Silver gauge master). Feed pins from a **view** or second **tile layer** so pins and hex stay aligned.

### Suggested Postgres shape (illustrative)

```sql
CREATE TABLE gold.google_flood_hub_gauge_pins (
  gauge_id         text PRIMARY KEY,
  geom             geometry(Point, 4326) NOT NULL,
  tier             text,                -- or derive in view from peak + thresholds
  quality_verified boolean,
  is_virtual       boolean,
  predicted_peak   double precision,
  current_value    double precision,
  warning_threshold double precision,
  danger_threshold  double precision,
  extreme_threshold double precision,
  unit             text,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fh_pins_geom ON gold.google_flood_hub_gauge_pins USING gist (geom);
```

**pg_tileserv**: second layer, e.g. `public.google_flood_hub_gauge_pins`, `geometry_column: geom`. Frontend would switch from `addSource(..., { type: 'geojson', data: ... })` to a **`vector` source** URL — a small change in `useHMEDFloodHubOverlays.js`.

---

## 3. Low-zoom coarse regions (H3 L5–L7 clustering) — **Static today**

### What it is

At **low map zoom**, dense hexes overplot. PRD calls for **aggregation into coarser H3 cells (L5–L7)** showing **max severity** (or similar) over many gauges. The current demo draws **large placeholder polygons** that disappear above zoom 8 (`maxzoom: 8` on the layer).

### What we have (frontend)

- `FLOOD_HUB_STATIC_COARSE_CLUSTERS` — demo polygons with `cluster_id`, `max_tier`, `gauge_count`, `dataSourceNote`.
- Layer `flood-hub-prd-cluster-fill`: sky fill, low opacity.

### What is missing

- Real **H3 parent indices** (L5–L7) with **aggregated metrics** from child L10 cells or from API aggregates.
- Stable **zoom band** contract: which H3 level at which zoom (today hard-coded `maxzoom: 8`).

### PostgreSQL — required to go Live

- Materialized aggregates, e.g. one row per **`h3_l6`** (or L5/L7 variants as separate layers):

  - `h3_coarse_id`, `geom` (cell boundary), `max_tier` or numeric `max_severity_rank`, `gauge_count`, `issue_time` / `fetched_at`.

- Refresh when Gold L10 refreshes.

### Suggested Postgres shape (illustrative)

```sql
CREATE TABLE gold.google_flood_hub_gauge_agg_l6 (
  h3_l6_id    text PRIMARY KEY,
  geom        geometry(Polygon, 4326) NOT NULL,
  max_tier    text NOT NULL,     -- e.g. Extreme|Danger|Warning|Normal
  gauge_count int NOT NULL,
  fetched_at  timestamptz,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
```

**pg_tileserv**: layer visible only at low zoom — can be done with **separate tileset** and frontend `maxzoom`, or server-side filtering by zoom in function (harder). Frontend may need a **`minzoom`** on the layer when you finalize schema.

---

## 4. Significant flood events — **Static today**

### What it is

**Significant Flood Event** polygons: basin-scale **event summaries** with **forecast window**, **impacted population**, **area**, **contributing gauges** — used for prioritization (PRD / Flood Hub API `event_polygons` concept).

### What we have (frontend)

- `FLOOD_HUB_STATIC_SIGNIFICANT_EVENTS`: **Polygon** GeoJSON with properties:

  - `event_id`, `title`, `forecast_window_hours`, `impacted_population_estimate`, `area_sq_km`, `contributing_gauge_ids`, `peak_timing_note`, `dataSourceNote`.

- Click → **side panel** (`FloodHubPrdSidePanel`, `kind === 'event'`).

### What is missing

- Real **Texas-clipped** geometries from API / Gold.
- Optional PRD-aligned fields: **impacted locations / admin names** if you add them later (panel can be extended).

### PostgreSQL — required to go Live

- Polygon table keyed by `event_id`, with issuance / validity timestamps for refresh and deduplication.

### Suggested Postgres shape (illustrative)

```sql
CREATE TABLE gold.google_flood_hub_event_polygons (
  event_id                      text PRIMARY KEY,
  geom                          geometry(MultiPolygon, 4326) NOT NULL,
  title                         text,
  forecast_window_hours         int,
  impacted_population_estimate  bigint,
  area_sq_km                    double precision,
  contributing_gauge_ids        text,  -- or text[] / join table for normalization
  forecast_issue_time           timestamptz,
  valid_until                   timestamptz,
  source_payload_hash           text,
  updated_at                    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fh_events_geom ON gold.google_flood_hub_event_polygons USING gist (geom);
```

**pg_tileserv**: polygon layer; ensure attributes are exposed with **same names** as GeoJSON today, or plan a **small frontend rename map** in `onEventSelect`.

---

## 5. Inundation probability (H3) — **Static today**

### What it is

**Inundation probability** raster from Flood Hub (native resolution per PRD ~15 m in text) **aggregated to H3 L10** for map alignment: blue cells with **opacity by probability**.

### What we have (frontend)

- `FLOOD_HUB_STATIC_INUNDATION_PROBABILITY`: polygon “cells” with:

  - `cell_id`, `probability` (0–1), `native_resolution_note`, `dataSourceNote`.

- Fill opacity interpolated from `probability` in `useHMEDFloodHubOverlays.js`.

### What is missing

- Real **area-weighted mean** (or agreed aggregate) of raster values into **H3 L10** per PRD spatial requirements.
- **Availability** semantics per gauge/cell (not every gauge has inundation maps).

### PostgreSQL — required to go Live

- Table (or view) at **H3 L10**: `h3_l10_id`, `geom`, `probability` (0–1), optional `gauge_id` / `availability` flags, `fetched_at`.

### Suggested Postgres shape (illustrative)

```sql
CREATE TABLE gold.google_flood_hub_inundation_probability_l10 (
  cell_id       text PRIMARY KEY,   -- or h3_l10_id
  geom          geometry(Polygon, 4326) NOT NULL,
  probability   double precision NOT NULL CHECK (probability >= 0 AND probability <= 1),
  native_resolution_m numeric,       -- e.g. 15 — for legend
  gauge_id      text,               -- optional linkage
  fetched_at    timestamptz,
  updated_at    timestamptz NOT NULL DEFAULT now()
);
```

**Ingestion path**: raster → PostGIS (`ST_Clip`, `ST_DumpAsPolygons`) → H3 aggregation (external H3 extension or application step) → insert into Gold.

---

## 6. Inundation history (H3) — **Static today**

### What it is

**Historical inundation frequency** (or similar summary) aggregated to **H3 L10**, with **darker fill** for higher frequency (PRD: history product semantics; separate from probability).

### What we have (frontend)

- `FLOOD_HUB_STATIC_INUNDATION_HISTORY`: properties `cell_id`, `historical_frequency` (0–1 used in opacity expression), `window_years`, `dataSourceNote`.

### What is missing

- Real Gold aggregation from Google’s **inundation history** pipeline (not the standalone long-archive products called out as excluded in PRD unless you intentionally ingest them separately).

### PostgreSQL — required to go Live

- Same pattern as probability: **H3 L10** cells + `historical_frequency` + metadata for legend.

### Suggested Postgres shape (illustrative)

```sql
CREATE TABLE gold.google_flood_hub_inundation_history_l10 (
  cell_id               text PRIMARY KEY,
  geom                  geometry(Polygon, 4326) NOT NULL,
  historical_frequency  double precision NOT NULL CHECK (historical_frequency >= 0 AND historical_frequency <= 1),
  window_years_label    text,
  fetched_at            timestamptz,
  updated_at            timestamptz NOT NULL DEFAULT now()
);
```

---

## 7. Urban flash flood (beta) — **Static today; API deferred in PRD**

### What it is

**Groundsource**-style **24-hour urban flash flood likelihood** with **coarse native footprint** (~20 km in PRD). Downsampled/replicated to **H3 L10** for overlay alignment; requires **beta labeling** and **NWS** contextual link when available.

### What we have (frontend)

- `FLOOD_HUB_STATIC_URBAN_FLASH`: polygons with `cell_id`, `likelihood_24h`, `beta_label`, `nws_flash_flood_url`, `dataSourceNote`.
- Purple fill layer + click panel.

### What is missing

- **Programmatic API** access (PRD Phase 3); until then, **no authoritative live layer** from Google for this in the API — any “live” version would be **internal experimental** ingestion, not Flood Hub API parity.

### PostgreSQL — if you still want a placeholder Gold table

```sql
CREATE TABLE gold.google_flood_hub_urban_flash_l10 (
  cell_id          text PRIMARY KEY,
  geom             geometry(Polygon, 4326) NOT NULL,
  likelihood_24h   double precision CHECK (likelihood_24h >= 0 AND likelihood_24h <= 1),
  native_footprint_km double precision, -- e.g. 20
  nws_flash_flood_url text,
  beta_label       text,
  fetched_at       timestamptz,
  updated_at       timestamptz NOT NULL DEFAULT now()
);
```

Treat as **beta**; wire only when your data team approves source and license story.

---

## 8. Gauge side panel enrichments (not separate map layers)

These are **not** toggles in the overlays list but **required for PRD-complete gauge UX**.

| Capability                      | Today                                                   | Postgres / API need                                                                            |
| ------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **72h hydrograph**              | Static `hydrograph` in `FLOOD_HUB_STATIC_GAUGE_DETAILS` | Time series table or JSON from API `forecasts`: `(gauge_id, lead_time_h, value, issue_time)`   |
| **NWPS deep link**              | MVT optional fields + static fallback                   | Store authoritative URL in Silver gauge master or API payload                                  |
| **Inundation map availability** | Boolean in static detail                                | Field on gauge or join to inundation availability table                                        |
| **Upstream basin toggle**       | Static note text                                        | Graph / reaches from `gauge_models` or hydrology network tables; later: vector overlay or list |

---

## 9. “Gauge coverage” radio (Higher vs additional)

### What it is

PRD: **Higher-confidence** (quality-verified) vs **additional** virtual coverage, with **caution** on virtual-only interpretation.

### What we have

- `confidenceMode` in state: filters **pins** by `qualityVerified === true` when `higher`.
- Hexes are not filtered by this mode today (only pin layer).

### Postgres implication

- Any live pin (or gauge) row must carry **`quality_verified`** consistently with API semantics if the UI behavior should match operational policy.

---

## 10. Implementation checklist (backend + frontend)

### Backend / Postgres

1. **Confirm** Gold L10 gauge table matches MVT attribute names (or document renames).
2. Add **tile functions** (or views) for: pins, coarse aggregate, events, inundation prob/hist, urban flash (if any).
3. Add **ingestion metadata** tables for staleness (`last_success_at`, `last_hydrology_issue`, `last_status_issue`) for PRD-style banners later.
4. **Texas bbox** enforcement in tile SQL.

### Frontend (follow-on, after tiles exist)

1. Replace `geojson` sources in `useHMEDFloodHubOverlays.js` with **Mapbox `vector` sources** + `source-layer` names matching pg_tileserv.
2. Keep property names **aligned** with current GeoJSON keys to minimize UI churn, or add a thin mapping layer in the hook.
3. Optionally remove or gate **static** `floodHubPrdStaticData` behind `import.meta.env.DEV`.

---

## Document history

- **2026-04-23** — Initial layer-by-layer report for Postgres / pg_tileserv planning (aligned to current `main` frontend: `floodHubPrdStaticData.js`, `useHMEDFloodHubOverlays.js`, `hmedLayerConfig.js`, `hmedMapUtils.js`).
