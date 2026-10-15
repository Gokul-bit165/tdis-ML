# Frontend guide (tdis-portal-frontend)

Stack: React 19, Vite 6, Tailwind 4, Radix UI, Redux Toolkit, React Router 7, Mapbox GL 3, h3-js, keycloak-js,
motion (framer), react-markdown, Vitest 4 + Testing Library, ESLint 9 (+sonarjs), Prettier. Node 20+. ES modules (`"type": "module"`).
Path alias `@/` -> `src/` (see vite.config.js / jsconfig.json; confirm before use).

Scripts: `npm run dev` (http://localhost:5173), `build`, `preview`, `lint`, `format`, `test`, `test:run`, `test:coverage`.

## src layout

| Folder | Contents |
|---|---|
| `components/` | Page-level and tab components (38 files). Subfolders: `ai-assistant/`, `hmed/`, `osa/`, `ui/` (shadcn-style primitives, 23 files) |
| `pages/` | `RequestAccessPage`, `admin/*`, `org/*` |
| `services/` | API clients: `api.js` (RTK Query email mutations), `apiClient.js`, `eventService`, `hazardService`, `hazardMapService`, `floodHubGaugeService`, `ltsFlashFloodService`, `powerOutageService`, `criticalFacilitiesService`, `ignitionService`, `intakeService`, `keycloak`, AI services, `h3ToGeoJson` |
| `hooks/` | Map hooks (`useMapboxMap`, `useMapResize`, `use*MapLayers`, `use*HexInteractions`, `useHazardLayers`, ...), `useKeycloak`, `useThreads` |
| `config/` | Layer and API config (`portalApiConfig`, `rampApiConfig`, `mapConfig`, `mapStyles`, `hazardConfig`, `featureFlags`, `disclaimerConfig`, per-layer configs) |
| `store/` | Redux store (`index.js`) |
| `api/` | `cubeClient.js` |
| `data/` | Static data (`floodHubPrdStaticData.js`, `texasCountyFips.js`) |
| `utils/` | Helpers incl. `googleAnalytics.js` |

Other: `public/` (images, videos, `texas.geojson`, `tx_counties.geojson`, `keycloak.js`, `silent-check-sso.html`),
`docs/` (Flood Hub and HMED notes), `scripts/` (deploy and API test shell scripts), `tests/features/` (102 files) and `tests/mocks/`.

## How tabs work

1. Tab list: [TabNavigation.jsx](../tdis-portal-frontend/src/components/TabNavigation.jsx) (entry has `value`, `label`, `shortLabel`, `icon` from lucide-react, `iconColor`).
2. Rendering: [MainLayout.jsx](../tdis-portal-frontend/src/components/MainLayout.jsx) has a tab id constant (e.g. `WILDFIRE_IGNITION_TAB`) and a line `{activeTab === X && <XTab />}`.
3. Active tab comes from `?tab=` and is resolved by `resolveActiveTab` in `config/featureFlags.js`, which also gates flagged tabs.
4. Each tab owns its map layers via hooks and a layer config.

## Feature flags

Build-time Vite env, parsed in `config/featureFlags.js`: `VITE_ENABLE_TDIS_AI`, `VITE_ENABLE_ACTIVE_WEATHER_EVENTS_BETA`.
Accepted truthy values: `true`, `1`, `yes`. Add a new flag by copying the existing function pattern.

## Environment variables

See `.env.example` and README. Key ones: `VITE_MAPBOX_TOKEN`, `VITE_API_URL` (include `/api/v1`), `VITE_EMAIL_API_URL`,
`VITE_CUBE_API_BASE_URL`, `VITE_CUBEJS_TOKEN`, `VITE_TDIS_API_KEY`, `VITE_IGNITION_API_URL`, `VITE_TILE_SERVER_BASE_URL`,
`VITE_RAMP_API_ROOT`, `VITE_RAMP_API_KEY`, `VITE_RAMP_POI_COUNTY`, `VITE_ENABLE_*`.
Any new variable must be added to `.env.example`, README and `azure-pipelines.yml`.

## Conventions

- Service files: a base URL constant from `import.meta.env`, a small `getJson` helper, one exported function per endpoint (see `ignitionService.js`).
- Match the indentation of the file being edited (mixed 2 and 4 spaces).
- Prettier and ESLint configs exist; run `npm run lint` and `npm run format:check`.
- Tests live in `tests/features/`, mirroring feature areas; mocks in `tests/mocks/`.
