# Google Flood Hub — data & API requirements (frontend integration)

This document lists what the **TDIS Portal frontend** expects next so **static / demo** GeoJSON and placeholder fields in `src/data/floodHubPrdStaticData.js` can be replaced with **live** Flood Forecasting API + **Gold** tile layers. It complements the internal PRD (FloodHub PRD v1.0).

For a **layer-by-layer narrative** (what each overlay is, current vs missing data, and **illustrative Postgres tables** for pg_tileserv), see **[FLOOD_HUB_LAYERS_POSTGRES_REPORT.md](./FLOOD_HUB_LAYERS_POSTGRES_REPORT.md)**.

## Already consumed from vector tiles (gauge hex layer)

| Property                                                     | Purpose                                                   | Notes                                               |
| ------------------------------------------------------------ | --------------------------------------------------------- | --------------------------------------------------- |
| `predicted_peak`                                             | Tier coloring vs thresholds                               | Used in Mapbox expression                           |
| `current_value`                                              | Popup / side panel                                        |                                                     |
| `warning_threshold`, `danger_threshold`, `extreme_threshold` | Tier breaks                                               | Snake_case or Pascal alternatives coalesced in code |
| `gauge_id`                                                   | Identity, NWPS lookup, virtual (`hybas_*`) styling        |                                                     |
| `unit`                                                       | Display (e.g. CMS → m³/s)                                 |                                                     |
| `fetched_at`                                                 | Run time in UI                                            |                                                     |
| `h3_l10_id` / `h3_l10_hex`                                   | H3 cell id in popups                                      |                                                     |
| `quality_verified` / `qualityVerified`                       | PRD “qualityVerified” badge; higher-confidence pin filter | Optional on MVT                                     |
| `nwps_url` / `nwps_gauge_url` / `authoritative_gauge_url`    | Deep link to NWPS / authoritative gauge                   | Optional; static demo fills gaps                    |
| `is_virtual` / `isVirtual`                                   | Virtual gauge badge                                       | Optional                                            |

## Needed to replace **static** significant flood events

| Data                                                                           | Source (expected)                                | Frontend use                                  |
| ------------------------------------------------------------------------------ | ------------------------------------------------ | --------------------------------------------- |
| Event polygon geometries (Texas)                                               | API `event_polygons` or Gold table → MVT/GeoJSON | Replace `FLOOD_HUB_STATIC_SIGNIFICANT_EVENTS` |
| `event_id`, forecast window, impacted population, area, contributing gauge IDs | Same                                             | Event side panel                              |

## Needed to replace **static** inundation layers

| Data                                                 | Source (expected)                                     | Frontend use                                             |
| ---------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------- |
| Inundation probability (native raster or grid)       | API / Gold; aggregate to **H3 L10** for map alignment | Replace `FLOOD_HUB_STATIC_INUNDATION_PROBABILITY`        |
| Inundation history / frequency                       | Same                                                  | Replace `FLOOD_HUB_STATIC_INUNDATION_HISTORY`            |
| Legend: native resolution & “availability” semantics | PRD callout                                           | Already described in Info modal; tie to real legend text |

## Needed to replace **urban flash flood** demo

| Data                                                | Source (expected)                               | Frontend use                           |
| --------------------------------------------------- | ----------------------------------------------- | -------------------------------------- |
| Groundsource / 24h urban likelihood                 | **Deferred** until documented API (PRD Phase 3) | Replace `FLOOD_HUB_STATIC_URBAN_FLASH` |
| Optional NWS flash flood warning deep link per cell | Warnings API or curated URL                     | Panel link                             |

## Needed to replace **coarse low-zoom clusters** (H3 L5–L7)

| Data                                                     | Source (expected)                    | Frontend use                                                                              |
| -------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------- |
| Aggregated gauge severity or max tier per coarse H3 cell | Gold tiles or on-the-fly aggregation | Replace `FLOOD_HUB_STATIC_COARSE_CLUSTERS`; align `maxzoom` / visibility with tile schema |

## Needed to replace **demo gauge pins**

Pins are **symbology only**; production may:

- Derive pin positions from gauge lat/lng in API, or
- Rely on hex centroids only and drop pins.

If pins are kept, tiles or API should expose **WGS84 coordinates** and the same `gauge_id` as the hex MVT.

## Needed for **hydrograph** (sidePanel)

| Data                                        | Source (expected)           | Frontend use                                                           |
| ------------------------------------------- | --------------------------- | ---------------------------------------------------------------------- |
| Time series of stage / discharge (e.g. 72h) | API `forecasts` per gauge   | Replace static `hydrograph` object in `FLOOD_HUB_STATIC_GAUGE_DETAILS` |
| Threshold lines                             | Already in gauge properties | Draw as reference lines in chart                                       |

## Needed for **upstream basin** toggle

| Data                           | Source (expected)                     | Frontend use                                                       |
| ------------------------------ | ------------------------------------- | ------------------------------------------------------------------ |
| Upstream network / basin graph | `gauge_models` or hydrology graph API | Replace static `upstreamBasinNote` copy with map highlight or list |

## Operational / platform (from PRD, not frontend-only)

- Ingestion cadence (daily hydrology / hourly status), staleness handling, API key in **secret manager** (never browser).
- TDDL Bronze/Silver/Gold naming for gauges, forecasts, events, inundation.
- TDIS AI NL queries over normalized Gold tables.

## Files using static data today

- `src/data/floodHubPrdStaticData.js` — GeoJSON + `FLOOD_HUB_STATIC_GAUGE_DETAILS`
- `src/hooks/useHMEDFloodHubOverlays.js` — wires GeoJSON into Mapbox
- `src/components/hmed/FloodHubPrdExtensionsWidget.jsx` — **separate** draggable / mobile sheet UI for PRD sub-layer toggles (keeps main HMED panel minimal)
- `src/utils/floodHubPrdUtils.js` — merges MVT fields with static fallbacks

When Gold tiles expose new layers, add matching **pg_tileserv** (or vector) endpoints and extend `useHMEDFloodHubOverlays` (or a sibling hook) to prefer **network sources** with fallback to static only in `import.meta.env.DEV` if desired.
