# Existing features

"Verified" = read in code or docs. "Inferred" = from file names only, check before relying on it.

## Portal frontend

Routes (verified, [App.jsx](../tdis-portal-frontend/src/App.jsx)):

| Route | Purpose |
|---|---|
| `/` | Main map page ([MainLayout.jsx](../tdis-portal-frontend/src/components/MainLayout.jsx)), tab chosen by `?tab=` |
| `/application-in-take` | Application dataset intake form details |
| `/request-access` | Request access page |
| `/admin/signups`, `/admin/organisations`, `/admin/organisations/:id`, `/admin/pricing` | Admin console (signup requests, organisations, pricing tiers) |
| `/org/members`, `/org/subscription`, `/org/billing` | Organisation admin |
| `*` | Redirect to `/` |

Also: disclaimer overlay (acceptance stored in localStorage), Google Analytics page views, toast notifications, Footer.

Map tabs (tab ids verified in MainLayout/featureFlags; contents inferred from component names):

| Tab id | Component | Notes |
|---|---|---|
| (default) | ActiveWeatherEventsTab | Live weather events, refresh "Every 30 minutes" |
| `active-weather-events-beta` | ActiveWeatherEventsBetaTab | Baron rainfall grid layers; flag `VITE_ENABLE_ACTIVE_WEATHER_EVENTS_BETA`, off by default |
| `hmed` | HMEDTab | Impact forecast / flood hub overlays, "Every 6 hours" |
| `lts-flash-flood` | LtsFlashFloodTab | LTS flash flood layers |
| `osa` | OSATab | Infrastructure status, "Every 1 hour" |
| `wildfire-ignition` | WildfireIgnitionTab | **Wildfire ignition risk hexagons** (this ML system) |
| `ai-assistant` | AIAssistantTab | TDIS AI chat; flag `VITE_ENABLE_TDIS_AI` (default on in dev, off in production builds) |
| `tif`, `dia` | TIFTab, DIATab | Commented out in MainLayout, not shown |

Other UI: Header, Footer, SideNavigation/ResponsiveNavigation, LayerControl, MapLegend, EventCards/EventSelector,
ContactUs and EmailSubscriptionForm, WhatWeDo, WhoWorksWithUs, LastUpdated, TimeLegendCard, Mapbox style switcher.

## Portal backend (verified)

- `POST /api/emails/send-email` (Contact Us) and `POST /api/emails/subscribe-user-request`
- `GET /health`
- Request-id tracing, structured logging, security headers, gzip, CORS, HTTPS redirect in production.

## Portal database (verified from README/docs, migrations inferred)

Event types, data sources, counties (with seed), cities (with seed), events store and views (`view_events_store`,
`view_batch_jobs_latest`, hurricanes view), batch job tracking, flood sample data, and the wildfire ignition tables (042).
Seed GeoJSON: `data_import/tx_counties.geojson`, `texas_cities.geojson`. Migration `041_modify_event_date` has no `.sql` extension (check before relying on it).

## Wildfire ignition (verified unless noted)

- Daily statewide next-day ignition probability on H3 res 8 (~251k Texas cells), served at res 4-8.
- Model: XGBoost, 36 features, isotonic calibration. Test AUROC 0.8026, AUC-PR 0.7164 (on a ~30% positive sample).
- Sparse upload expansion by KNN inverse-distance weighting (k=8, 150 km cutoff).
- Rejected uploads recorded as error runs; map keeps last good run.
- Test-data banner on the map when `data_source` is not `real`.
- Estimated (non-uploaded) hexagons drawn fainter.
- API: `/coverage`, `/runs`, `/status`, `/model-info`, `/predict` (up to 10,000 rows), `/health`.
- Frontend tab fetches coverage by viewport (`bbox`) and zoom-derived resolution, and model info (WildfireIgnitionTab.jsx lines ~132 and ~214).

## Known gaps and quirks

- Ignition API has no authentication and CORS defaults to localhost:5173 only (set `CORS_ORIGINS` in production).
- `getIgnitionDates` and `getIgnitionHexes` in ignitionService.js call endpoints that do not exist; unused.
- `.env.example` says `REACT_APP_GOOGLE_ANALYTICS_TRACKING_ID`, README says `VITE_GOOGLE_ANALYTICS_TRACKING_ID`.
- READMEs of the portal folders still use old names (`event-detection-*`).
- Training data is not in the repo (gitignored), so models are not reproducible from a clone.
- Ignition probabilities are relative risk only.
- Possible follow-ups listed in the schema doc: per-cell `county_id`, H3 boundary geometry/view for pg_tileserv.
