# tdis-drainage

Tools for the portal's Drainage Monitoring tab. Inference stays on the local machine; its results are turned into a
few static files that are uploaded in the Azure portal to `datatexas/drainage-data/current`, where the browser reads
them directly. No database, API or job.

| File | What it does |
| --- | --- |
| `prepare_drainage.py` | Turns `unioned_points.geojson` + `unioned_polygons.geojson` into `manifest.json`, `points.geojson` and outline tiles. Standard library only. |
| `verify_drainage.mjs` | Reads the published files like the portal does (CORS included) and prints sizes and timings. |
| `serve_local.mjs` | Serves a prepared folder on http://localhost:8003 for `npm run dev`. |

```bash
python prepare_drainage.py --data <full_stack>/backend/data --out ./drainage_upload --name clear-creek-2026-12
# upload every file in drainage_upload to datatexas > drainage-data > folder "current" (Azure portal)
node verify_drainage.mjs https://datatexas.blob.core.windows.net/drainage-data/current
```

Plan and runbook: [docs/DRAINAGE_MONITORING.md](../docs/DRAINAGE_MONITORING.md).
