# Adding a feature: recipes

Pick the recipe that matches, then run the checklist at the bottom.

## A. New map tab in the portal (pattern: WildfireIgnitionTab)

1. Service: `src/services/<name>Service.js` with `BASE_URL` from `import.meta.env.VITE_<NAME>_API_URL`, a `getJson` helper, one function per endpoint (copy `ignitionService.js`).
2. Config (optional): `src/config/<name>LayerConfig.js` for colours, layer ids, zoom rules.
3. Hooks (optional): `src/hooks/use<Name>MapLayers.js` and `use<Name>HexInteractions.js`; reuse `useMapboxMap` and `h3ToGeoJson.js` for H3 data.
4. Component: `src/components/<Name>Tab.jsx`.
5. Register: add an entry to the tabs array in `TabNavigation.jsx` (`value`, `label`, `shortLabel`, lucide `icon`, `iconColor`); add the id constant and `{activeTab === ID && <NameTab />}` in `MainLayout.jsx`.
6. Optional gating: add `isXEnabled()` and a branch in `resolveActiveTab` in `config/featureFlags.js`.
7. Env: add the variable to `.env.example`, `README.md`, and `azure-pipelines.yml`.
8. Tests: add under `tests/features/<name>/` (mirror existing folders).

## B. New backend endpoint in the Express server

Add `routes/<name>.js` and `controllers/<name>Controller.js`, mount in `app.js` (`app.use('/api/<name>', router)`), add tests in
`__tests__/routes` and `__tests__/controllers`. Remember this server currently only does email; if the new data belongs with
events/hazards it probably belongs in the external Portal FastAPI instead (not in this repo; confirm with the user).

## C. New database objects

1. Add `tdis-portal-db/migrations/043_<what>.sql` (next number, `.sql` extension, `IF NOT EXISTS` / guarded so it is re-runnable).
2. Grants: follow 042 (`ed_app_admin` ALL, `ed_app_user` SELECT, skip if role missing).
3. If it adds a data source or batch job, insert rows like 042 does.
4. Document in `tdis-portal-db/docs/<NAME>_SCHEMA.md` (what changed, columns, rollback).
5. Apply with `node migrate.js`. Never edit an already-applied migration.

## D. Extend the ignition API or model

- New endpoint: add to `main.py` under `/api/v1/ignition`, SQL in `db.py`, update the README table and `docs/ML_AND_IGNITION_API.md`, then add a function in `ignitionService.js`.
- New field on coverage cells: it must come from `wildfire_ignition_cells` (needs a migration) or be derived in `main.py`.
- Retrain: needs the gitignored training parquet. Produce a new `BIT_V3` folder rather than overwriting V2, then copy model files into `tdis-ignition-api/model/` and redeploy with `rollout.ps1`.
- Ideas already noted in the schema doc: store `county_id` per cell for county summaries; H3 boundary view for pg_tileserv.

## E. New hazard/layer in an existing tab

Look at `config/hazardConfig.js`, `hazardMapConfig.js`, `hooks/useHazardLayers.js` and `services/hazardService.js` first.
The portal already has patterns for tile-server layers, GeoJSON layers and H3 hex layers.

## Checklist for every change

- [ ] Read the relevant doc here and the code you will touch (many frontend files are unverified in these docs).
- [ ] Match surrounding style (indentation, comment density, naming).
- [ ] New env vars documented in `.env.example`, README and the pipeline.
- [ ] No secrets committed; `.env` stays ignored.
- [ ] Tests added or updated; `npm run lint` and `npm run test:run` pass in the frontend; `npm test` in the backend.
- [ ] Docs updated: FEATURES.md (and ARCHITECTURE.md if structure changed).
- [ ] Large files (>50 MB) are not committed; GitHub rejects >100 MB.
- [ ] Commit on a branch, not directly on `master`, unless the user says otherwise.
