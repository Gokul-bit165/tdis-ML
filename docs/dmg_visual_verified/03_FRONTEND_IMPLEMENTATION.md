# 03. Frontend implementation

Target: `tdis-portal-frontend` (React 19, Vite, Mapbox GL JS 3, Tailwind 4, lucide-react). Follow the wildfire tab's
conventions; names below are the real ones in this repo.

## 1. Result

One new top tab, **Damage Assessment**, next to Wildfire Ignition. Inside the map, three round buttons at the bottom-left
switch between **H3 Aggregation** (default), **Building Damage** and **Building Density**. They are view modes of one tab,
not tabs. Opening the tab or switching views never starts inference: the tab only reads tiles and JSON.

## 2. Files

New:

| File | Purpose |
|---|---|
| `src/config/damageAssessmentConfig.js` | Class codes, labels, colours, metric steps, layer and source ids, zoom constants, heatmap constants |
| `src/services/damageService.js` | `getDamageAssessments()`, `getDamageBuilding(aid, id, signal)`, `damageTileUrl(aid, layer)`. Copy the shape of `ignitionService.js` |
| `src/hooks/useDamageMapLayers.js` | Adds the three sources and their layers; applies view, metric and assessment changes |
| `src/hooks/useDamageInteractions.js` | Hover and click, feature-state, selection |
| `src/components/DamageAssessmentTab.jsx` | The tab: map, card, switcher, panel |
| `src/components/damage/DamageViewSwitcher.jsx` | The three round buttons |
| `src/components/damage/DamageLegend.jsx` | Legend for the visible layer |
| `src/components/damage/DamageDetailPanel.jsx` | Selected building or cell |
| `tests/features/components/DamageAssessmentTab.test.jsx` and tests beside the other config, hook and service tests | |

Edited:

| File | Change |
|---|---|
| `src/components/TabNavigation.jsx` | Add `{ value: 'damage-assessment', label: 'Damage Assessment', shortLabel: 'Damage', icon: ShieldAlert, iconColor: '#b91c1c' }` to `mapTabsConfig`, after `wildfire-ignition`; filter it with the feature flag as the beta tab is |
| `src/components/MainLayout.jsx` | `DAMAGE_ASSESSMENT_TAB = 'damage-assessment'`; add to `getMapProductTabs()` when enabled; render `<DamageAssessmentTab />` |
| `src/config/featureFlags.js` | `isDamageAssessmentEnabled()` from `VITE_ENABLE_DAMAGE_ASSESSMENT` (unset: on in dev, off in builds, like the AI flag); branch in `resolveActiveTab` |
| `.env.example`, `README.md`, `azure-pipelines.yml` | `VITE_DAMAGE_API_URL`, `VITE_ENABLE_DAMAGE_ASSESSMENT` |

The existing tab bar already scrolls horizontally on narrow screens, so a seventh tab needs no layout change.

## 3. State

| State | Where | Why |
|---|---|---|
| Active view: `h3`, `buildings`, `density` | URL parameter `dview` (missing = `h3`) | Each tab unmounts when another is chosen, so component state would be lost. `MainLayout.handleActiveTabChange` keeps other URL parameters, so the view survives leaving and returning, and links can be shared |
| Assessment id | URL parameter `da` (missing = newest published) | Same reason |
| H3 metric: `damaged`, `severe`, `dominant` | Component state | Minor preference |
| Selected building or cell | Component state plus Mapbox feature-state | Cleared when the view changes away from its layer, or the assessment changes |
| Assessment list | Fetched once on mount | Totals for the card and legend come from here |

Map centre and zoom are not kept across top-tab changes (no other tab does). They are kept across view switches, because
the map instance is the same.

## 4. Map, sources and layers

Create the map with the existing `useMapboxMap({ componentName: 'Damage', loadLayers })` hook, not a bare `new mapboxgl.Map`
as the wildfire tab does. The hook gives the standard controls and Texas limits, and calls `loadLayers` again after a
basemap style change, which otherwise wipes custom layers.

All sources and layers are added once in `loadLayers`. Switching view only changes `visibility`. Mapbox does not request
tiles for a source whose layers are all hidden, so a hidden view costs nothing.

```js
const base = `${DAMAGE_API}/api/v1/damage/tiles/${aid}`;

map.addSource('damage-h3',        { type: 'vector', tiles: [`${base}/h3/{z}/{x}/{y}.mvt`],        minzoom: 0,  maxzoom: 14, promoteId: 'h3' });
map.addSource('damage-buildings', { type: 'vector', tiles: [`${base}/buildings/{z}/{x}/{y}.mvt`], minzoom: 14, maxzoom: 14, promoteId: 'building_id' });
map.addSource('damage-density',   { type: 'vector', tiles: [`${base}/density/{z}/{x}/{y}.mvt`],   minzoom: 0,  maxzoom: 14 });
```

`promoteId` is required: ids are strings, and one hexagon or footprint can be split across tiles. With it, hover and
selection highlight every piece.

Layers, all inserted below the basemap's first label layer so place names stay readable:

| Layer id | Type | Source layer | Visible in view |
|---|---|---|---|
| `damage-h3-fill` | fill | `h3` | `h3`; also `buildings` below zoom 14 |
| `damage-h3-line` | line | `h3` | same |
| `damage-buildings-fill` | fill | `buildings` | `buildings` |
| `damage-buildings-line` | line | `buildings` | `buildings`; `density` as thin grey outlines from zoom 15 |
| `damage-density-heat` | heatmap | `density` | `density` |

Paint (constants live in the config file):

```js
// Building fill: dc is -1 (not assessed) or 0..4
'fill-color': ['match', ['get', 'dc'], 0, '#22A65A', 1, '#F5D547', 2, '#F28C28', 3, '#E44747', 4, '#991F36', '#9CA3AF'],
'fill-opacity': ['case', ['boolean', ['feature-state', 'selected'], false], 1, 0.85],

// Building outline: gives every class contrast on the streets basemap, yellow especially
'line-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#111827', '#374151'],
'line-width': ['case', ['boolean', ['feature-state', 'selected'], false], 2.5, 0.5],

// H3 fill, damaged-share metric. Result is -1 when nothing is assessed.
const na = ['get', 'na'];
const share = ['case', ['>', na, 0], ['/', ['-', na, ['get', 'c0']], na], -1];
'fill-color': ['step', share, '#9CA3AF', 0, '#22A65A', 0.000001, '#FFE9A8', 0.05, '#FECC5C', 0.15, '#FD8D3C', 0.30, '#F03B20', 0.50, '#BD0026'],
'fill-opacity': ['case', ['any', ['<', na, 5], ['==', ['-', na, ['get', 'c0']], 0]], 0.35, 0.75],

// Heatmap: see file 02 section 6 for K and the ramp
'heatmap-weight': ['get', 'w'],
'heatmap-radius': 24,
'heatmap-intensity': ['interpolate', ['exponential', 4], ['zoom'], 4, K * 4 ** 4, 16, K * 4 ** 16],
'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 15, 0.8, 16, 0],
```

Changing the H3 metric is one `setPaintProperty` call. No request, no reload.

Changing the assessment: `source.setTiles([...])` on the three sources, clear selection, `fitBounds` to the assessment bbox.

**Building view below zoom 14.** Footprints do not exist there. The H3 layers stay visible instead, the legend shows the H3
legend, and a chip reads "Zoom in to see individual buildings". From zoom 14 the hexagons hide and footprints show.
This is driven by layer `minzoom` / `maxzoom`, not by code reacting to zoom events.

## 5. View switcher

- Position: inside the map container, `absolute left-4 bottom-14 z-10`. The Mapbox scale control and the Mapbox logo are at
  the very bottom-left; the logo must stay visible, so the buttons sit above them.
- Three round buttons, 40 px (44 px on touch screens), 8 px gap, horizontal. Icons from lucide-react: `Hexagon`,
  `Building2`, `Radar`.
- Inactive: white at 90% opacity with a light shadow, slate icon. Active: the dark slate used by the active top tab
  (`#324755`) with a white icon.
- Accessibility: the group is `role="radiogroup"` with `aria-label="Damage map view"`; each button is `role="radio"` with
  `aria-checked` and an `aria-label` (the view name). Left and right arrow keys move the selection. Each has a tooltip using
  the existing `CustomTooltip`. A visible focus ring.
- While the newly selected view's tiles are loading, the active button shows a small spinner ring; it stays clickable.
- Do not reproduce the red annotation from the reference screenshot.

## 6. Card, legend and detail panel

A card at the bottom-right, same place and style as the wildfire card (`absolute bottom-6 right-4 z-10 w-72 rounded-lg
bg-white/95 p-4 shadow-lg`). On mobile it collapses to a title bar that expands on tap.

Card content:

- Title "Damage Assessment", the assessment selector (event, area, imagery date), and "Loaded <timestamp>".
- The legend for what is currently drawn. Its title names the metric exactly:
  "Share of assessed buildings with any damage", "Share with structural collapse", "Most common damage class",
  "Damage class", or "Building density (approx. buildings per km2, smoothed)".
- Totals for the whole assessment (buildings, assessed, per class) taken from `/assessments`.
  **Never total what is rendered:** hexagons and footprints that cross a tile edge are present in more than one tile.
- The amber test-data banner when `data_source` is not `real`.
- One info line: definitions of damaged and severe, and that faint hexagons have fewer than 5 assessed buildings.

Hover a hexagon: outline highlight and a small tooltip: "212 buildings, 198 assessed. 61 damaged (31%), 9 collapsed (5%)."

Click a hexagon: the panel shows the H3 id and resolution, the five class counts with their colours, not-assessed count, and
a "Zoom to buildings" button (`flyTo` the cell at zoom 15 and set `dview=buildings`). All from tile properties; no request.

Click a footprint: set feature-state `selected`, then `getDamageBuilding(aid, id, signal)` with an `AbortController` so a
second click cancels the first. The panel shows building id, class as a coloured chip **with its text label**, assessment
date, imagery date, model, and confidence and damage percentage only when they are not null. Selection stays until another
building is clicked, the panel is closed, or the view changes.

Colour is never the only signal: every coloured swatch or chip has its label next to it.

## 7. Loading, empty and error states

| Situation | UI |
|---|---|
| Tiles loading | "Updating..." in the card. Use `map.on('sourcedataloading')` and `map.on('idle')` |
| No published assessment | Card text: "No damage assessment has been published yet." Map stays usable |
| Assessment list request fails | Error line in the card with a Retry button |
| Tile errors | `map.on('error')` filtered to the three source ids; one error line, not a toast per tile |
| Detail returns 404 | Panel: "This building is no longer available." |
| Density view, zoom 16 and above | Chip: "Zoom out to see building density" |

Mapbox schedules, cancels and caches tile requests itself. Do not add debounce or bbox-fetch code like the wildfire tab's
`refresh()`; it is not needed here.

## 8. Environment and build

```
# Damage Assessment API (tdis-damage-api). Defaults to http://localhost:8002
# VITE_DAMAGE_API_URL=http://localhost:8002
# Show the Damage Assessment tab. Unset: shown in `npm run dev` only.
# VITE_ENABLE_DAMAGE_ASSESSMENT=true
```

Add both to the build step of `azure-pipelines.yml`. Note that `VITE_IGNITION_API_URL` is missing from that file today, so a
pipeline build of the wildfire tab points at `http://localhost:8001`. Add it in the same change.

## 9. Tests (Vitest, with the existing Mapbox mock)

| Test | Checks |
|---|---|
| Config | Five codes map to the five exact labels and colours; unknown code maps to grey |
| Config | The share expression returns -1 when `na` is 0 |
| Tab | Opens with `h3` active when `dview` is missing; H3 layers visible, the others hidden |
| Tab | Clicking each round button updates `dview`, layer visibility and the legend title together |
| Tab | `?tab=damage-assessment&dview=density` opens directly in the density view |
| Tab | Changing view calls no service function (no network beyond tiles) |
| Tab | Empty assessment list shows the empty message and adds no sources |
| Switcher | Roles, `aria-checked`, arrow-key navigation, tooltips |
| Panel | Null `confidence` and `damage_pct` are not rendered; 404 shows the unavailable message |
| Interaction | A second building click aborts the first detail request |
| Navigation | `TabNavigation` shows the tab only when the flag is on; existing tab tests still pass |

Run `npm run lint` and `npm run test:run` before committing.

## 10. Acceptance criteria

1. Damage Assessment appears beside Wildfire Ignition when the flag is on, and nowhere when it is off.
2. Selecting it shows H3 hexagons by default.
3. Exactly three round buttons at the bottom-left of the map, above the scale bar and Mapbox logo.
4. The active button, the visible layer and the legend title always agree.
5. Building view uses real footprints with the five exact labels and colours; not-assessed buildings are grey.
6. Density view shows the same colour for the same real-world density at every zoom, and ignores damage class.
7. Hexagon counts match a database count for the same hexagon.
8. Switching views keeps centre, zoom and assessment; returning to the tab restores the view from the URL.
9. No view switch, pan, zoom or click calls anything except tile URLs and the building detail endpoint.
10. Works at 360 px width and on desktop; the other tabs are unchanged.
