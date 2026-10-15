# Task 2: make the three Damage Assessment views look different, and fix the open UI defects

You are working in `tdis-ml`, branch `feature/damage-assessment`, in `tdis-portal-frontend/` only. The Damage Assessment
tab from task 1 works, but the owner reports that **all three round buttons show the same map**. This task fixes that,
restyles two views to match the owner's reference images, and closes the remaining defects.

No backend, database or API change is needed or allowed. Everything here is frontend styling and behaviour.

> **Status, 2026-10-13: sections 3.1, 3.2 and 3.3 are already implemented and checked in a browser. Do not redo them.**
> Differences from the text below: the Building view hides the hexagons completely (no outlines below zoom 14); the
> heatmap radius is a constant 24 px; the strength constant is `HEATMAP_K = 6e-9`, tuned by eye on the synthetic data;
> the density legend uses word labels ("Few" to "Very dense"). What remains for you is **section 3.4 only**, plus
> re-tuning `HEATMAP_K` once real footprints are loaded. Defect 2 (hidden map controls) already appears fixed; confirm it.

## 1. What is wrong today (verified in a browser on 2026-10-13)

The tab opens at about zoom 9 over the assessment area. At that zoom:

| Button | What the user sees | Why |
|---|---|---|
| H3 Aggregation | Coloured hexagons | Correct |
| Building Damage | **The same coloured hexagons**, same legend, plus a small "Zoom in" chip | Footprints only exist from zoom 14. Below that the view falls back to the H3 layer, so it is identical to the H3 view. Only `h3` tiles are requested |
| Building Density | A very faint mint haze on the same street map | The heatmap is too weak and its colours are close to the basemap's greens |

So the buttons do switch state (URL, active button and legend title change), but the picture barely changes. A user has
to zoom in five levels by hand before the building view shows a single building.

## 2. Target look

**Building Damage** must look like the owner's reference: satellite imagery, each building outlined in a bright line of
its damage colour with a light translucent fill, so the roof stays visible underneath.

**Building Density** must look like the owner's second reference: satellite imagery under a classic heatmap that runs
transparent, blue-green, yellow, red, with empty land left clear.

**H3 Aggregation** stays as it is: street basemap and filled hexagons.

## 3. Changes

### 3.1 Satellite imagery under the Building and Density views

Add one raster layer and toggle its visibility. Do not call `map.setStyle()` for this: a style change reloads the whole
map and removes the custom layers.

```js
map.addSource('damage-satellite', { type: 'raster', url: 'mapbox://mapbox.satellite', tileSize: 256 });
map.addLayer({ id: 'damage-satellite', type: 'raster', source: 'damage-satellite',
               layout: { visibility: 'none' }, paint: { 'raster-fade-duration': 150 } }, beforeId);
```

- Add it first, with the same `beforeId` the damage layers use, so it sits under every damage layer and under the place
  labels (labels must stay readable on top of the imagery).
- Visible in `buildings` and `density`; hidden in `h3`.
- Add the source and layer ids to `damageAssessmentConfig.js`, and add it inside the existing `setupLayers` so it is
  re-added after a basemap style change like the other layers.

### 3.2 Building Damage view

1. **Go to the buildings.** When the user switches to this view and the map zoom is below 14, fly to zoom 15:
   - if a hexagon is selected, to that hexagon's centre (this already exists for "Zoom to buildings");
   - otherwise to the rendered hexagon with the most collapsed buildings: take
     `map.queryRenderedFeatures({ layers: ['damage-h3-fill'] })`, pick the feature with the largest `c3 + c4`
     (ties: largest `n`), and use `cellToLatLng(h3)`;
   - if nothing is rendered, to the centre of the assessment `bbox`.
   Do this before hiding the H3 layer, in the view-change handler. If the zoom is already 14 or more, do not move the map.
2. **No filled hexagons in this view.** Below zoom 14 show hexagon **outlines only** (H3 line layer visible up to zoom 14,
   H3 fill layer hidden) and keep the "Zoom in to see individual buildings" chip. The legend in this view is always the
   five-class "Damage class" legend, never the hexagon legend.
3. **Footprint style on imagery** (constants in `damageAssessmentConfig.js`):

   | Building | Fill | Outline |
   |---|---|---|
   | Assessed, classes 0 to 4 | class colour, opacity 0.35 | class colour, opacity 1, width 2 (1.5 at zoom 14, 2.5 from zoom 17) |
   | Not assessed (`dc = -1`) | none (opacity 0) | `#BFDBFE`, width 1 |
   | Selected | class colour, opacity 0.6 | `#FFFFFF`, width 3 |

   The outline colour uses the same `match` on `dc` as the fill. Class colours do not change.

### 3.3 Building Density view

1. Satellite layer on (3.1). Keep the thin building outlines from zoom 15, in `#FFFFFF` at opacity 0.6.
2. New colour ramp, replacing `HEATMAP_RAMP`:

   | Heatmap value | 0 | 0.05 | 0.2 | 0.4 | 0.65 | 1 |
   |---|---|---|---|---|---|---|
   | Colour | `rgba(0,0,0,0)` | `rgba(43,131,186,0.55)` | `#ABDDA4` | `#FFFFBF` | `#FDAE61` | `#D7191C` |

3. `heatmap-opacity`: 0.75 up to zoom 15, fading to 0 at zoom 16 (unchanged fade).
4. `heatmap-radius`: 18 at zoom 6, 26 at zoom 10, 34 at zoom 14 (linear interpolation on zoom).
5. **Calibrate the strength.** Keep the `['exponential', 4]` zoom law for `heatmap-intensity`; it is what makes a place
   keep its colour while zooming. Change only the constant: introduce `HEATMAP_DENSITY_REF` (buildings per km2 that
   reach red) and set it so that, with the synthetic assessment loaded, town centres are red, their edges yellow to
   green, and open land is clear at zooms 8, 11 and 14. Start at 800 and adjust by eye in the browser. Because the
   radius now changes with zoom, divide the intensity by `radius(z)^2 / 24^2` or re-tune so the colour of one town
   centre is the same at the three zooms.
6. Legend: title "Building density (approx. buildings per km2, smoothed)", swatches from the new ramp, and one line under
   it: **"Shows where buildings are, not how damaged they are."** Red here means many buildings, and the legend must say so.
7. The density view never uses damage classes and ignores the H3 metric selector (hide that selector in this view and in
   the building view).

### 3.4 Remaining defects from task 1

| # | Defect | Required result |
|---|---|---|
| 1 | The details panel opens over the top tab bar | The panel sits inside the map area below the tab bar and above the card, or the card moves down to make room. It never covers a tab |
| 2 | Mapbox controls (style switcher, zoom in) are hidden under the tab bar | All top-right controls are fully visible and clickable. Look at how the other `useMapboxMap` tabs offset them (`MAP_CONTROLS_CSS` in `src/config/mapConfig.js`, used by `OSATab.jsx`) |
| 3 | On a 390 px wide screen the card covers the map and the round buttons | The card starts collapsed to its title bar on small screens; the three buttons and the map stay usable |
| 4 | The "Building Density" tooltip stays visible when the pointer is elsewhere | Tooltips show only on hover or keyboard focus of their own button |
| 5 | "Updating..." and the spinner sometimes stay on after tiles have loaded | Cleared on `idle`, and also when `map.areTilesLoaded()` is true after `sourcedata` |
| 6 | Card totals for the five classes have no thousands separators | Formatted like the two totals above them |

## 4. Boundaries

- Edit only the damage files you created in task 1 (`DamageAssessmentTab.jsx`, `components/damage/*`,
  `config/damageAssessmentConfig.js`, `hooks/useDamage*.js`) and their tests. If defect 2 needs a shared file, change the
  smallest thing possible and say so in the report.
- Do not touch `tdis-damage-db/`, `tdis-damage-loader/`, `tdis-damage-api/`, `tdis-portal-db/`, the ignition folders or `docs/`.
- No new npm dependencies. No `map.setStyle()`. No bbox fetching; tiles only.
- Keep `useDamageMapLayers`' current `setupLayers` / `style.load` logic: it fixed layers never appearing on first load.
- Do not commit to `master`, do not push, do not deploy.

## 5. How to run it

```powershell
# database (already loaded with a 200,000-building synthetic assessment)
cd tdis-damage-db; docker compose up -d
# api
cd ..\tdis-damage-api; $env:DATABASE_URL = "postgresql://damage:damage@localhost:5544/damage"
.\.venv\Scripts\python -m uvicorn main:app --port 8002
# frontend (.env already has the Mapbox token and VITE_DAMAGE_API_URL)
cd ..\tdis-portal-frontend; npm run dev        # http://localhost:5173/?tab=damage-assessment
```

The site shows a disclaimer dialog first; click "I ACCEPT".

## 6. Done means

Commands, all passing, no test weakened or removed:

```
cd tdis-portal-frontend
npm run lint
npm run test:run
npm run build
```

Add or update tests for: the satellite layer's visibility per view; H3 fill hidden and H3 line visible in the building
view; the fly-to target choice (selected cell, then most collapsed rendered cell, then bbox centre; no move at zoom 14+);
the not-assessed footprint style; the new ramp constants; the metric selector hidden outside the H3 view; the card
collapsed by default on a small screen.

Browser acceptance, checked by you in a real browser and listed one by one in the report:

1. Open the tab, click each of the three buttons once without touching the map: three clearly different pictures.
2. Building Damage: the map flies in, imagery is visible, buildings have coloured outlines and light fills, and a
   not-assessed building is a thin pale outline.
3. Building Density: imagery with a blue-green to red heatmap; open land is clear; the same town centre has the same
   colour at zooms 8, 11 and 14.
4. H3 Aggregation: unchanged street map and filled hexagons; no imagery.
5. Switching views keeps the map position, except the one fly-in of 3.2.
6. Clicking a hexagon or a building opens the panel without covering the tab bar.
7. The style switcher and zoom buttons are fully visible; switching the basemap style keeps the damage layers.
8. At 390 px width the map and the three buttons are usable.
9. Leaving the tab and returning restores the view from the URL.
10. With `VITE_ENABLE_DAMAGE_ASSESSMENT=false` the app builds and the tab is absent.

## 7. Report

Files changed; the result of each command; each of the ten acceptance points marked "seen in browser", "test only" or
"not verified"; the final value of `HEATMAP_DENSITY_REF` and how you chose it; anything you could not do.
