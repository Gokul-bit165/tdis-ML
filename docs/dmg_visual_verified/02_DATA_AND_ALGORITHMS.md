# 02. Data and algorithms

All numbers use Web Mercator at latitude 31 N (mid-Texas) and Mapbox GL's 512-pixel tiles:
ground metres per pixel = `67,091 / 2^zoom`.

## 1. Representative point

Every footprint gets one point guaranteed to lie inside it (`shapely` `representative_point()`, equivalent to PostGIS
`ST_PointOnSurface`). A centroid is not used: for an L-shaped or courtyard building the centroid can fall outside the
footprint, or in a neighbouring cell.

The point is computed once in the loader and stored as `pt`. It decides the building's H3 cell at every resolution and is
the building's point in the density view.

## 2. H3 assignment: index directly at every resolution

```
for each building b:
    for r in 4..10:
        cell[r] = latlng_to_cell(b.pt.lat, b.pt.lng, r)
```

The cell at res 6 is **not** derived as `cell_to_parent(cell at res 10, 6)`.

Why: H3's hierarchy is logical, not geometric. A parent hexagon and the union of its seven children do not cover the same
ground (the children are rotated about 19 degrees and overhang the parent's edges). Two different numbers exist for
"buildings in this res-6 cell":

| Method | What it counts | Property |
|---|---|---|
| Direct index (chosen) | Buildings whose point is inside the hexagon that is drawn | What the user sees is what is counted |
| Rollup with `cell_to_parent` | Buildings in the fractal-shaped union of descendants | Parent equals sum of children, but buildings near the edge are counted in a hexagon they are not drawn in |

The map draws hexagons and lets the user switch to footprints at the same place, so the count must match the drawn shape.

Consequence: "parent count = sum of its children's counts" is **not** an invariant and is not tested. The invariant that
replaces it is stronger and simpler: at every resolution, the cells partition the buildings, so

```
for every r:  sum(n) = n_buildings,  sum(na) = n_assessed,  sum(c_k) = total of class k
```

## 3. Resolutions and the zoom ladder

Stored resolutions: **4 to 10**.

| Res | Avg edge | Avg area | Role |
|---|---|---|---|
| 4 | 26.1 km | 1,770 km2 | Statewide |
| 5 | 9.85 km | 253 km2 | Regions |
| 6 | 3.73 km | 36.1 km2 | Counties |
| 7 | 1.41 km | 5.16 km2 | Cities |
| 8 | 531 m | 0.737 km2 | Districts |
| 9 | 201 m | 0.105 km2 | Neighbourhoods |
| 10 | 75.9 m | 15,050 m2 | Blocks |
| 11 | 28.7 m | 2,150 m2 | Not stored: one or two buildings per cell |
| 12 | 10.8 m | 307 m2 | Not stored: smaller than a building |

(These are the current H3 averages. The original plans used an older table about 13% smaller.)

The resolution is a fixed function of the **tile** zoom, so a tile's content is deterministic and cacheable:

| Tile zoom | Res | Hexagon edge on screen | Max hexagons in one tile |
|---|---|---|---|
| 0 to 5 | 4 | up to 25 px | 650 |
| 6 | 5 | 9 to 19 px | 1,140 |
| 7 to 8 | 6 | 7 to 28 px | 1,990 |
| 9 | 7 | 11 to 21 px | 870 |
| 10 to 11 | 8 | 8 to 32 px | 1,530 |
| 12 | 9 | 12 to 25 px | 670 |
| 13 and up | 10 | 9 px at z13, 19 px at z14, 37 px at z15 | 1,170 |

Each H3 step shrinks the edge by sqrt(7) = 2.65 and each zoom doubles the scale, so one resolution lasts about 1.4 zoom
levels. That is why the ladder alternates between one and two zoom levels per resolution. The on-screen edge stays between
7 and 37 pixels, and no tile can hold more than about 2,200 hexagons even if every cell has buildings.

```sql
CREATE OR REPLACE FUNCTION damage_h3_res_for_zoom(z integer) RETURNS integer
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE WHEN z <= 5 THEN 4 WHEN z = 6 THEN 5 WHEN z <= 8 THEN 6 WHEN z = 9 THEN 7
              WHEN z <= 11 THEN 8 WHEN z = 12 THEN 9 ELSE 10 END
$$;
```

The frontend never chooses a resolution. It only draws what the tile contains.

## 4. Tile functions

Parameter names `z, x, y` are required by pg_tileserv. The assessment parameter is named `aid`, not `assessment_id`: inside
an SQL function a column name wins over a parameter of the same name, and the filter would silently compare the column with
itself.

### H3 hexagons

```sql
CREATE OR REPLACE FUNCTION damage_h3_mvt(z integer, x integer, y integer, aid bigint)
RETURNS bytea LANGUAGE sql STABLE PARALLEL SAFE AS $$
  WITH b AS (
    SELECT ST_TileEnvelope(z, x, y) AS env,
           ST_Transform(ST_TileEnvelope(z, x, y, margin => 64.0 / 4096), 4326) AS box
  ), q AS (
    SELECT c.h3, c.n, c.na, c.c0, c.c1, c.c2, c.c3, c.c4, COALESCE(c.dom, -1) AS dom,
           ST_AsMVTGeom(ST_Transform(c.geom, 3857), b.env, 4096, 64, true) AS geom
    FROM damage_h3_cells c, b
    WHERE c.assessment_id = aid
      AND c.res = damage_h3_res_for_zoom(z)
      AND c.geom && b.box
  )
  SELECT ST_AsMVT(q, 'h3', 4096, 'geom') FROM q WHERE geom IS NOT NULL
$$;
```

A hexagon crossing a tile edge is clipped and appears in both tiles. Mapbox clips each tile to its own bounds, so the fill
is seamless and is not drawn twice. The 64-unit buffer keeps the cut edge outside the visible tile so outlines do not show
a seam.

### Building footprints

```sql
CREATE OR REPLACE FUNCTION damage_buildings_mvt(z integer, x integer, y integer, aid bigint)
RETURNS bytea LANGUAGE sql STABLE PARALLEL SAFE AS $$
  WITH b AS (
    SELECT ST_TileEnvelope(z, x, y) AS env,
           ST_Transform(ST_TileEnvelope(z, x, y, margin => 64.0 / 4096), 4326) AS box
  ), q AS (
    SELECT d.building_id, COALESCE(d.damage_class, -1) AS dc,
           ST_AsMVTGeom(ST_Transform(d.geom, 3857), b.env, 4096, 64, true) AS geom
    FROM damage_buildings d, b
    WHERE z >= 14
      AND d.assessment_id = aid
      AND d.geom && b.box
  )
  SELECT ST_AsMVT(q, 'buildings', 4096, 'geom') FROM q WHERE geom IS NOT NULL
$$;
```

Footprints are served at zoom 14 only (source `minzoom` 14, `maxzoom` 14) and Mapbox overzooms them:

- At z14 one pixel is 4.1 m, so every building is visible and none needs dropping or simplifying.
- One z14 tile is 2.1 km wide. With a 4096 grid its coordinate precision is 0.5 m, sharp enough at zoom 18.
- Below z14 a tile would hold too many buildings (a z13 tile in a dense city: about 35,000, estimate).
- A single tile zoom means the fewest distinct tiles and the best cache reuse.

Estimated worst case at z14: about 9,000 footprints, about 500 KB before compression. If measurement shows more, set the
source `maxzoom` to 15.

Only `building_id` and `dc` are in the tile. Everything else comes from the detail endpoint on click.

### Density points

```sql
CREATE OR REPLACE FUNCTION damage_density_mvt(z integer, x integer, y integer, aid bigint)
RETURNS bytea LANGUAGE sql STABLE PARALLEL SAFE AS $$
  WITH b AS (
    SELECT ST_TileEnvelope(z, x, y) AS env,
           ST_Transform(ST_TileEnvelope(z, x, y), 4326) AS box
  ), q AS (
    SELECT c.n AS w, ST_AsMVTGeom(ST_Transform(c.pt, 3857), b.env, 4096, 0, true) AS geom
    FROM damage_h3_cells c, b
    WHERE z < 13
      AND c.assessment_id = aid
      AND c.res = LEAST(damage_h3_res_for_zoom(z) + 1, 10)
      AND c.geom && b.box
    UNION ALL
    SELECT 1 AS w, ST_AsMVTGeom(ST_Transform(d.pt, 3857), b.env, 4096, 0, true) AS geom
    FROM damage_buildings d, b
    WHERE z >= 13
      AND d.assessment_id = aid
      AND d.geom && b.box
  )
  SELECT ST_AsMVT(q, 'density', 4096, 'geom') FROM q WHERE geom IS NOT NULL
$$;
```

Points use buffer **0**. A heatmap adds up every point it is given, so a point present in two tiles would be counted twice
along every tile edge. With buffer 0 each point is in exactly one tile. (The heatmap itself is drawn across tile borders, so
there is no seam.)

The spatial filter uses the polygon index (`geom && box`) and the clip then drops points outside the tile. A point is always
inside its own polygon, so no second index on `pt` is needed.

## 5. Colouring the H3 view

All rates are computed in the Mapbox style from the counts in the tile:

```
damaged share = (na - c0) / na          severe share = (c3 + c4) / na          valid only when na > 0
```

| Metric | Default | Colouring |
|---|---|---|
| Damaged share | Yes | Sequential steps |
| Severe share | No | Same steps |
| Dominant class | No | The five class colours |

Steps for the two share metrics (configuration; the breaks need sign-off):

| Value | Colour | Meaning |
|---|---|---|
| `na = 0` | `#9CA3AF`, opacity 0.35 | Buildings present, none assessed |
| 0% | `#22A65A`, opacity 0.35 | Assessed, no damage detected |
| above 0 to 5% | `#FFE9A8` | |
| 5 to 15% | `#FECC5C` | |
| 15 to 30% | `#FD8D3C` | |
| 30 to 50% | `#F03B20` | |
| above 50% | `#BD0026` | |

A cell with no buildings is not stored and nothing is drawn there. So the three states "no buildings", "not assessed" and
"no damage" are visually different, as required.

**Small samples.** A cell with fewer than 5 assessed buildings is drawn at opacity 0.35 instead of 0.75. The tooltip always
shows the counts ("3 of 4 assessed buildings damaged"), never a bare percentage.

**Dominant class.** `dom` is the class with the highest count among assessed buildings; a tie goes to the more severe class.
It is computed in the loader. The tooltip shows its share ("Undamaged, 46% of 212"), so a plurality is not read as a
majority. It is not the default because Undamaged wins in almost every cell and the map would hide the damage.

## 6. Density heatmap

Source points: below zoom 13, one point per non-empty H3 cell one resolution finer than the displayed hexagons, placed at the
**centre of mass of that cell's buildings** and weighted by the building count. From zoom 13, one point per building,
weight 1. Total weight is the same in both regimes, so the surface does not jump at zoom 13.

Using the centre of mass instead of the hexagon centre removes the regular dot pattern a lattice of centres would show, and
places weight where the buildings are.

Worst case per tile: about 14,000 weighted points below z13, about 35,000 building points at z13 (estimates). All buildings
count, assessed or not, damaged or not.

### Making the colour mean the same thing at every zoom

A Mapbox heatmap has a radius in pixels. Zoom out one level and each pixel covers four times the ground, so four times as
many buildings fall under the same kernel and the same suburb turns "hotter". The fix is exact:

```
heatmap-radius    = constant R pixels
heatmap-weight    = ['get', 'w']
heatmap-intensity = K * 4^zoom
```

With that, the heatmap value at a place is proportional to buildings per km2 there (smoothed over the kernel), at every zoom.
In Mapbox style syntax the 4^zoom law is exactly:

```js
['interpolate', ['exponential', 4], ['zoom'], 4, K * 4 ** 4, 16, K * 4 ** 16]
```

Starting value for `K`, from the Gaussian kernel Mapbox uses (sigma = R / 3):

```
K = 1 / (D_ref * m0^2 * 0.2785 * R^2)        m0 = 67,091 m per pixel at zoom 0, latitude 31 N
R = 24 px, D_ref = 2,500 buildings per km2 = 0.0025 per m2   ->   K = 5.5e-10
```

`D_ref` is the density that reaches the top of the colour ramp. **Calibrate `K` once** against a synthetic assessment of
known uniform density (for example 1,000 buildings per km2 must read 0.4 on the ramp), because the constant depends on
shader internals. The 4^zoom law does not.

Colour ramp (pale mint to teal, transparent at zero), with non-linear stops so rural density is visible:

| Value | 0 | 0.02 | 0.1 | 0.3 | 0.6 | 1 |
|---|---|---|---|---|---|---|
| Buildings per km2 (approx.) | 0 | 50 | 250 | 750 | 1,500 | 2,500+ |
| Colour | transparent | `#E6F7F1` | `#B5E6D8` | `#6CC9B7` | `#2FA59A` | `#0F766E` |

Legend title: **"Building density (approx. buildings per km2, smoothed)"**. Mercator scale changes about 6% north to south
across Texas, so the reading is about 12% low in the Panhandle and about 10% high in the far south. That is stated in the info
text. If exact per-area statistics are ever required they come from `damage_h3_cells` (`n` divided by the cell area), not
from the heatmap.

The heatmap fades out between zoom 15 and 16, where single buildings are visible and a smoothed surface says nothing.

## 7. Reconciliation checks (run inside the load transaction; any failure aborts the load)

| # | Check |
|---|---|
| 1 | `count(*)` of buildings equals `n_buildings`; `building_id` unique (primary key) |
| 2 | For every res 4 to 10: `sum(n) = n_buildings`, `sum(na) = n_assessed`, `sum(c_k)` equals the class total for each k |
| 3 | For every cell: `c0 + c1 + c2 + c3 + c4 = na` and `na <= n` and `n > 0` |
| 4 | Every `pt` is within its own `geom` |
| 5 | Every cell's `h3` has resolution `res`, and its `pt` is inside its `geom` |
| 6 | Assessment `bbox` lies inside the Texas envelope plus margin |

## 8. Loader sketch

```python
gdf = read_geoparquet(path).to_crs(4326)              # validated first (file 01, section 5)
pt = gdf.geometry.representative_point()
lat, lng = pt.y.to_numpy(), pt.x.to_numpy()
cls = gdf["damage_class"].map(LABEL_TO_CODE)          # NaN = not assessed; unknown label already rejected

cells = []
for r in range(4, 11):
    key = [h3.latlng_to_cell(a, o, r) for a, o in zip(lat, lng)]
    g = pd.DataFrame({"h3": key, "lat": lat, "lng": lng, "cls": cls}).groupby("h3")
    s = g.agg(n=("h3", "size"), na=("cls", "count"), lat=("lat", "mean"), lng=("lng", "mean"))
    for k in range(5):
        s[f"c{k}"] = g["cls"].apply(lambda v, k=k: int((v == k).sum()))
    counts = s[[f"c{k}" for k in range(5)]].to_numpy()
    dom = 4 - counts[:, ::-1].argmax(axis=1)            # ties resolve to the more severe class
    s["dom"] = np.where(s["na"] > 0, dom, -1)           # -1 is written as NULL
    s["res"] = r
    cells.append(s)                                     # hexagon from h3.cell_to_boundary(h): (lat, lng) pairs

order = np.argsort([h3.latlng_to_cell(a, o, 10) for a, o in zip(lat, lng)])   # disk locality
# one transaction: INSERT assessment, COPY buildings (in `order`), COPY cells, checks, publish
```

## 9. Tests

| Area | Test |
|---|---|
| Loader | A building straddling a cell edge is counted once at every resolution |
| Loader | L-shaped footprint: `pt` is inside the footprint |
| Loader | Duplicate `building_id`, unknown label, wrong CRS, geometry outside Texas: file rejected, error row written, nothing published |
| Loader | Tie between two classes gives the more severe one as `dom` |
| Loader | The six reconciliation checks, on a synthetic assessment |
| SQL | `damage_h3_res_for_zoom` returns the ladder for z 0 to 16 |
| SQL | Summing `n` over distinct `h3` across all tiles of one zoom equals `n_buildings` |
| SQL | A density point appears in exactly one tile |
| SQL | Building tile below z14 is empty; at z14 contains only footprints intersecting the tile |
| API | Unpublished or unknown assessment: 404. Empty tile: 204. Out-of-range z/x/y: 422 |
| Cross-view | For one hexagon, counts in the tile equal a direct SQL count of buildings whose `pt` falls in that hexagon |
| Heatmap | Uniform synthetic density reads the same colour at zooms 8, 11 and 14 |
