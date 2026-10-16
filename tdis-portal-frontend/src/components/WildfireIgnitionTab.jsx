/**
 * @fileoverview Wildfire Ignition tab — H3 hexagon heatmap of next-day ignition probability
 * from the TDIS Ignition model (served by tdis-ignition-api).
 *
 * Hexagon size follows the zoom level: zoomed out you see large hexagons for the whole state,
 * zoomed in the map asks the API for finer hexagons covering only the visible area.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { h3ToGeoJson } from '../services/h3ToGeoJson';
import { getIgnitionCoverage, getIgnitionModelInfo } from '../services/ignitionService';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

const SOURCE_ID = 'ignition-hexes';
const FILL_LAYER_ID = 'ignition-hexes-fill';
const LINE_LAYER_ID = 'ignition-hexes-line';

const TEXAS_BOUNDS = [
  [-106.7, 25.8],
  [-93.5, 36.6],
];

// H3 resolution by zoom: [upper zoom bound, resolution]; at or above the last bound use FINEST_RES.
const RES_STEPS = [
  [5.6, 4],
  [7, 5],
  [8.4, 6],
  [9.8, 7],
];
const FINEST_RES = 8;
const HEX_AREA_KM2 = { 4: 1770, 5: 253, 6: 36, 7: 5.2, 8: 0.74 };
// From this resolution up the API is asked for the visible window only (statewide would be 100k+ hexagons).
const WINDOW_FROM_RES = 6;
const WINDOW_PADDING = 0.5; // fetch 50% beyond each edge so small pans don't trigger a reload
const REFRESH_DEBOUNCE_MS = 120;

const resForZoom = (zoom) => RES_STEPS.find(([maxZoom]) => zoom < maxZoom)?.[1] ?? FINEST_RES;

const RISK_LEVELS = [
  { level: 'low', label: 'Low (<20%)', color: '#22a559' },
  { level: 'moderate', label: 'Moderate (20–40%)', color: '#facc15' },
  { level: 'high', label: 'High (40–60%)', color: '#f97316' },
  { level: 'very_high', label: 'Very high (≥60%)', color: '#dc2626' },
];

const colorExpression = [
  'step',
  ['get', 'probability'],
  RISK_LEVELS[0].color,
  0.2,
  RISK_LEVELS[1].color,
  0.4,
  RISK_LEVELS[2].color,
  0.6,
  RISK_LEVELS[3].color,
];

const DAY_MS = 86400000;
/** "Wed 7 Oct 2026" for a YYYY-MM-DD string, without timezone drift. */
const longDate = (iso) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
/** "tomorrow", "today", "yesterday" or "in 3 days" for the prediction date, relative to the viewer's today. */
const relativeDay = (iso) => {
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((new Date(`${iso}T00:00:00Z`).getTime() - today) / DAY_MS);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  return diff > 0 ? `in ${diff} days` : `${-diff} days ago`;
};
const utcStamp = (iso) => (iso ? `${iso.slice(0, 16).replace('T', ' ')} UTC` : 'unknown');

const pct = (v) => `${(Number(v) * 100).toFixed(1)}%`;
const formatArea = (km2) => (km2 >= 10 ? `~${Math.round(km2).toLocaleString()} km²` : `~${km2} km²`);

/** [west, south, east, north] for the current view, grown by `ratio` on every side and clamped. */
const paddedWindow = (bounds, ratio) => {
  const w = bounds.getWest();
  const s = bounds.getSouth();
  const e = bounds.getEast();
  const n = bounds.getNorth();
  const dx = (e - w) * ratio;
  const dy = (n - s) * ratio;
  return [
    Math.max(-180, w - dx),
    Math.max(-90, s - dy),
    Math.min(180, e + dx),
    Math.min(90, n + dy),
  ];
};

const windowCovers = (outer, bounds) =>
  outer &&
  outer[0] <= bounds.getWest() &&
  outer[1] <= bounds.getSouth() &&
  outer[2] >= bounds.getEast() &&
  outer[3] >= bounds.getNorth();

const WildfireIgnitionTab = () => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const lastFetchRef = useRef({ res: null, window: null });
  const requestIdRef = useRef(0);
  const abortRef = useRef(null);
  const debounceRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [data, setData] = useState(null);
  const [modelInfo, setModelInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState(null);

  // Fetch hexagons for the current zoom/viewport, skipping the request if what we have still fits.
  const refresh = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const res = resForZoom(map.getZoom());
    const bounds = map.getBounds();
    const needsWindow = res >= WINDOW_FROM_RES;
    const last = lastFetchRef.current;
    if (last.res === res && (!needsWindow || windowCovers(last.window, bounds))) return;

    const window = needsWindow ? paddedWindow(bounds, WINDOW_PADDING) : null;
    const requestId = ++requestIdRef.current;
    abortRef.current?.abort(); // stop the superseded request so it does not keep the server busy
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    getIgnitionCoverage(undefined, res, window, controller.signal)
      .then((result) => {
        if (requestId !== requestIdRef.current) return; // a newer request superseded this one
        lastFetchRef.current = { res, window };
        setData(result);
      })
      .catch((e) => requestId === requestIdRef.current && setError(e.message))
      .finally(() => requestId === requestIdRef.current && setLoading(false));
  }, []);

  // Map init
  useEffect(() => {
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      bounds: TEXAS_BOUNDS,
      fitBoundsOptions: { padding: 40 },
    });
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.on('load', () => {
      map.addSource(SOURCE_ID, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: FILL_LAYER_ID,
        type: 'fill',
        source: SOURCE_ID,
        // Hexagons backed by uploaded cells are solid; ones estimated from neighbours are fainter.
        paint: { 'fill-color': colorExpression, 'fill-opacity': ['case', ['>', ['get', 'n_observed'], 0], 0.7, 0.4] },
      });
      map.addLayer({
        id: LINE_LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        paint: { 'line-color': '#ffffff', 'line-width': 0.4, 'line-opacity': 0.6 },
      });

      map.on('click', FILL_LAYER_ID, (e) => {
        const p = e.features?.[0]?.properties;
        if (!p) return;
        new mapboxgl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font-size:13px;line-height:1.5">
               <strong>Mean ignition probability: ${pct(p.probability)}</strong><br/>
               Risk: ${String(p.risk_level).replace('_', ' ')}<br/>
               Hottest cell in hexagon: ${pct(p.max_probability)}<br/>
               ${Number(p.n_observed) > 0 ? `Cells: ${p.n_cells} (${p.n_observed} from uploaded data)` : `Cells: ${p.n_cells}, estimated from nearby uploaded cells`}<br/>
               <strong>Prediction for: ${longDate(p.for_date)} (${relativeDay(p.for_date)})</strong><br/>
               Data uploaded: ${utcStamp(p.uploaded_at)}<br/>
               Scored: ${utcStamp(p.last_updated)}<br/>
             </div>`
          )
          .addTo(map);
      });
      map.on('mouseenter', FILL_LAYER_ID, () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', FILL_LAYER_ID, () => (map.getCanvas().style.cursor = ''));

      map.on('zoom', () => setZoom(map.getZoom()));
      setZoom(map.getZoom());
      // Re-pick hexagon size / visible window after every pan or zoom.
      map.on('moveend', () => {
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(refresh, REFRESH_DEBOUNCE_MS);
      });
      setMapReady(true);
    });
    mapRef.current = map;
    return () => {
      clearTimeout(debounceRef.current);
      requestIdRef.current += 1; // drop any in-flight response
      abortRef.current?.abort();
      map.remove();
      mapRef.current = null;
    };
  }, [refresh]);

  // First load once the map is ready
  useEffect(() => {
    if (mapReady) refresh();
  }, [mapReady, refresh]);

  // Model info
  useEffect(() => {
    let cancelled = false;
    getIgnitionModelInfo()
      .then((info) => !cancelled && setModelInfo(info))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, []);

  // Push to map
  useEffect(() => {
    if (!mapReady || !data) return;
    mapRef.current?.getSource(SOURCE_ID)?.setData(h3ToGeoJson(data.cells));
  }, [mapReady, data]);

  const counts = RISK_LEVELS.map((r) => ({
    ...r,
    n: data?.cells.filter((c) => c.risk_level === r.level).length ?? 0,
  }));
  const hexArea = data ? HEX_AREA_KM2[data.resolution] : null;

  return (
    <div className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'auto' }}>
      <div ref={containerRef} className="w-full h-full" />

      <div className="absolute bottom-6 right-4 z-10 w-72 rounded-lg bg-white/95 p-4 shadow-lg text-[#324755]">
        <h3 className="text-base font-bold mb-1">Wildfire Ignition</h3>
        <p className="text-xs text-[#324755]/70 mb-3">
          Daily ignition probability across Texas. Zoom in for finer hexagons.
        </p>

        {data && (
          <div className="mb-3 rounded bg-sky-50 px-2 py-1.5 text-xs">
            <div className="font-semibold">
              Prediction for {longDate(data.for_date)}
              <span className="ml-1 rounded bg-sky-600 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                {relativeDay(data.for_date)}
              </span>
            </div>
            <div className="text-[#324755]/70">Data uploaded {utcStamp(data.uploaded_at)}</div>
          </div>
        )}

        <ul className="space-y-1 text-xs">
          {counts.map((r) => (
            <li key={r.level} className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: r.color }} />
              <span className="flex-1">{r.label}</span>
              <span className="tabular-nums">{r.n}</span>
            </li>
          ))}
        </ul>

        <p className="mt-3 text-[11px] text-[#324755]/60">
          {data
            ? `Zoom ${zoom == null ? '' : zoom.toFixed(1)} · ${data.count.toLocaleString()} hexagons of ${formatArea(hexArea)} each${loading ? ' · updating…' : ''}. `
            : loading
              ? 'Loading…'
              : ''}
          Faint hexagons are estimated from the nearest uploaded cells. Colours show relative risk.
          {modelInfo && ` Model test AUROC ${modelInfo.metrics_raw.test.auroc.toFixed(3)} (matched sample).`}
        </p>
        {data && data.data_source !== 'real' && (
          <p className="mt-2 rounded bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">
            Test data ({data.data_source}): these features are not real-time weather.
          </p>
        )}
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
};

export default WildfireIgnitionTab;
