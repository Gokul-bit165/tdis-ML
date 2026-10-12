# HMED — LTS Flash Flood: UI features

This document lists **LTS-specific** behavior in the Hazard Monitoring & Event Detection (HMED) tab and how each piece works.

**Product copy (consistent across UI, tooltips, and API descriptions):** TIF/LTS supports **anticipatory planning and early action** using a **24-hour forecast window**. LTS and county aggregates describe **forecasted** threat and potential impact—not observed damage, losses, or ground truth. Official flood safety: [NWS flood safety](https://www.weather.gov/safety/flood). In-app Info links use the same NWS URL (`LTS_DOCUMENTATION_LINKS` in `ltsFlashFloodLayerConfig.js`).

## Layer & map

| Feature                  | How it works                                                                                                                                                                                                                                                                                                                                       |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **LTS vs precipitation** | User picks **LTS Flash Flood** in the hazard layer list. The map swaps vector tile sources/hex layers (H3 levels 7–10) instead of precipitation rasters.                                                                                                                                                                                           |
| **No time window**       | Unlike precipitation, LTS has no 3h/6h/12h/24h selector; the control panel hides the time window when LTS is active.                                                                                                                                                                                                                               |
| **Hex coloring**         | `lts_level` in MVT is 1–5. **Active tiers** in the UI are **3 = Moderate**, **4 = High**, **5 = Very High**. Levels **1–2** (legacy) use the **Moderate** fill color. Map paint uses `ltsFillColorByLevel` + `getColorExpression` in `hmedMapUtils.js`; legend uses `severityLevels` (3–5 only).                                                   |
| **Hex fill (H3)**        | LTS uses a single **`fill`** layer per H3 resolution band (`hex-l7` … `hex-l10`). Outline and fill opacity are **zoom-interpolated** so the grid stays readable at regional zoom and cleaner when zoomed in. **Clicks/hover** use the same fill layer. Tiles should expose **polygon** H3 cell geometry in `public.precipitation_lts_*` MVT views. |
| **Zoom bands**           | Different H3 resolutions load at different zoom ranges (configured in `hmedLayerConfig` / `useHMEDMapLayers`) so tiles stay usable when overzooming.                                                                                                                                                                                               |
| **Hex popup**            | Clicking a hex opens a popup with LTS-oriented fields (e.g. level, labels) from `useHMEDHexInteractions`.                                                                                                                                                                                                                                          |

## Desktop controls (right panel)

| Feature                                                 | How it works                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Anticipatory disclaimer**                             | Amber strip uses shared `LTS_ANTICIPATORY_DISCLAIMER`: 24-hour forecast outlook, forecasted threat (not observed damage), early situational awareness / preparatory action, does not replace NWS warnings.                                                                                     |
| **Threat severity legend**                              | Gradient bar + numbered chips 1–5 with labels matching the map.                                                                                                                                                                                                                                |
| **Potential impact widgets** (`HMEDLtsExposureWidgets`) | Calls **`GET /api/v1/lts-flash-flood/exposure-summary?min_lts_level=`** with **3, 4, or 5** (≥ Moderate, ≥ High, ≥ Very High). API still accepts **1–2** for legacy data. Shows population, buildings (with breakdown where provided), critical facilities, run metadata, refresh, and errors. |
| **Info modal**                                          | LTS-specific copy in `HMEDInfoModal`: 24-hour window, anticipatory planning, forecast vs. observed impacts, severity scale, NWS disclaimer, and **documentation links** from `currentLayer.documentationLinks` (e.g. NWS flood safety).                                                        |

## Desktop counties (left panel)

| Feature                                         | How it works                                                                                       |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **LTS by county** (`HMEDLtsCountySummaryPanel`) | Draggable panel (bottom-left, OSA-style) with minimize/expand.                                     |
| **Data source**                                 | **`GET /api/v1/lts-flash-flood/counties`** — all counties for the latest LTS county run.           |
| **Search**                                      | Client-side filter on county name and FIPS (`hmedLtsCountyUtils.filterLtsCountiesBySearch`).       |
| **Rows**                                        | Each row shows county name, FIPS, `lts_level` chip (colors from severity config), and `lts_label`. |
| **Refresh**                                     | Re-fetches the counties endpoint.                                                                  |

## Mobile

| Feature                     | How it works                                                                                                                                                                                                                              |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Controls FAB**            | Same slide-up sheet as precipitation; layer list includes LTS.                                                                                                                                                                            |
| **Layers \| Counties tabs** | When **LTS Flash Flood** is selected, a second tab **Counties** appears next to **Layers**. **Layers** = layer picker, disclaimer, legend, potential impact widgets. **Counties** = same list/search/refresh as desktop (compact layout). |
| **Precipitation**           | No Counties tab; single scrollable controls view.                                                                                                                                                                                         |

## APIs (reference)

- `GET .../lts-flash-flood/exposure-summary?min_lts_level=<n>` — aggregated potential impact for counties at or above the threshold.
- `GET .../lts-flash-flood/counties` — per-county rollup for the latest run (optional `countyfips` query on the API; UI currently loads full list).

Frontend service: `src/services/ltsFlashFloodService.js`.

## Base URL (local testing)

- **`npm run dev`:** LTS requests use **`http://127.0.0.1:8000/api/v1`** by default, independent of `VITE_EVENTS_API_URL`, so outages/events can still call a remote API while you exercise LTS against a local FastAPI.
- **Override:** set **`VITE_LTS_API_URL`** (include `/api/v1`, no trailing slash).
- **Production build:** LTS uses **`VITE_EVENTS_API_URL`** when `VITE_LTS_API_URL` is not set.
- **Auth:** same **`VITE_EVENTS_API_KEY`** as the main API; local API must accept that key.

## Optional / not in UI

- **Fly-to county** on row click is not implemented (would need FIPS ↔ bounds or geometry).
- **Filtered county fetch** via `countyfips` query param is available on the API but not exposed in the UI yet.
