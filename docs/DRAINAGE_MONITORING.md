# Drainage Monitoring

Portal tab **Drainage Monitoring** (`?tab=drainage-monitoring`): AI-detected defects from drone surveys of bayous and
drainage channels, drawn as class pins (icons from the drone defect viewer, `full_stack/frontend/index.html`) with a
legend that filters classes.

Classes: vegetation overgrowth, bank erosion, structural damage, sediment accumulation, tree/log jam, tires
(a class the models add later is drawn with the "other debris" pin).

## 1. Design: files only

Inference stays on the local machine. Azure holds only a few static files, which the browser reads directly from
Blob Storage. There is no database, API or scheduled job, so nothing runs (or bills) between surveys.

```
 LOCAL                                                   AZURE                                    BROWSER
 inference → backend/data/unioned_points.geojson
                         unioned_polygons.geojson
        │
 prepare_drainage.py → manifest.json, points.geojson,  ── upload in ──▶  datatexas/drainage-data/current/  ──▶ tab
                       polygons_<x>_<y>.geojson            Azure portal   (public read, CORS: portal sites)
```

| File | Content | Size (current survey) |
| --- | --- | --- |
| `manifest.json` | survey name, publish time, version, count per class, bbox, list of outline tiles | 1 KB |
| `points.geojson` | one point per defect: `category`, `area` | 0.5 MB |
| `polygons_<x>_<y>.geojson` | simplified outlines in ~2 km tiles (0.02°); loaded only for the area in view from zoom 16 | 18 tiles, up to 0.4 MB each |

Cost: storage and downloads of ~3 MB, a few cents per month.

The manifest is fetched without caching; other files are requested with `?v=<version>` from the manifest, so a new
upload shows up on the next page load and browsers never mix files from two surveys.

## 2. Pieces

| Piece | File |
| --- | --- |
| Prepare a survey (standard library only) | `tdis-drainage/prepare_drainage.py` |
| One-time Azure setup (public container + CORS), optional upload | `deploy/azure/setup_drainage_storage.ps1` |
| Check the published files like a browser (CORS, sizes, timings) | `tdis-drainage/verify_drainage.mjs` |
| Serve a prepared folder locally for `npm run dev` | `tdis-drainage/serve_local.mjs` |
| Frontend | `src/services/drainageService.js`, `src/config/drainageConfig.js`, `src/config/drainageIcons.js`, `src/components/DrainageMonitoringTab.jsx` |
| Feature flag `VITE_ENABLE_DRAINAGE_MONITORING`, data URL `VITE_DRAINAGE_DATA_URL` | `src/config/featureFlags.js`, `.env.example`, `azure-pipelines.yml`, `deploy/azure/deploy_frontend.ps1` |

## 3. Tab

- One pin per class at every zoom. Same-class defects that would overlap (within 48 px) are merged into one pin with
  a count badge; each class is a separate clustered source, so different classes are never merged. Grouping stays
  on up to the map's maximum zoom (20), so same-class pins never stack.
- Clicking a group zooms in until it splits. A group that cannot split (defects at practically the same spot)
  opens a summary popup: count, class, combined area. Clicking a single pin shows its class and area.
- From zoom 16: the outlines in view (only the tiles covering the view are downloaded, once).
- Legend = filter: each class row is an animated on/off switch (pins fade in and out, outlines follow); "Only"
  isolates one class; All/None reset. Counts per class and "Showing N of M defects".

## 4. Runbook

### 4.1 New survey (after each inference)

1. Prepare the files on the inference machine:
   ```bash
   python tdis-drainage/prepare_drainage.py --data <full_stack>/backend/data --out ./drainage_upload --name clear-creek-2026-12
   ```
2. Azure portal → Storage accounts → **datatexas** → Containers → **drainage-data** → **Upload**.
3. Select **every file** in `drainage_upload`. Expand **Advanced**: *Upload to folder* = `current`, tick
   *Overwrite if files already exist*. Upload.
4. Reload the portal tab: it shows the new survey name and counts.

Tiles from an older survey that the new one does not use can stay; the manifest decides which are read. To tidy up,
delete the `current` folder before uploading. Alternative to the portal:
`deploy/azure/setup_drainage_storage.ps1 -Upload ./drainage_upload`.

### 4.2 One-time setup (done 2026-11-17)

`deploy/azure/setup_drainage_storage.ps1` created `datatexas/drainage-data` with anonymous read of files (listing
stays private) and a CORS rule for the portal sites and local dev ports. Pass `-Origins` to add a new portal domain.

### 4.3 Turn the tab on in the portal build

`VITE_ENABLE_DRAINAGE_MONITORING=true` and
`VITE_DRAINAGE_DATA_URL=https://datatexas.blob.core.windows.net/drainage-data/current`.
`deploy_frontend.ps1` sets both; the DevOps pipeline needs `vite_enable_drainage_monitoring` and `drainage_data_url`;
the live GitHub-built site (`wonderful-moss-0963acc10`) needs them in its workflow env and a push to its deploy branch.

### 4.4 Local development

```powershell
python tdis-drainage\prepare_drainage.py --data <full_stack>\backend\data --out .\drainage_upload --source test
node tdis-drainage\serve_local.mjs .\drainage_upload            # http://localhost:8003
cd tdis-portal-frontend; npm run dev                             # /?tab=drainage-monitoring
node tdis-drainage\verify_drainage.mjs http://localhost:8003
```
Or point `VITE_DRAINAGE_DATA_URL` at the Azure folder. Ports 8000 and 5173 are used by other containers on this
machine; Vite falls back to 5174, which the CORS rule allows.

## 5. History

An earlier version loaded uploads into a separate Postgres server through a scheduled job and served them with an
API (~$35/month, mostly for the always-on database and API). It was deployed briefly on 2026-11-17 and removed the
same day in favour of static files, which are as fast at this data size.
