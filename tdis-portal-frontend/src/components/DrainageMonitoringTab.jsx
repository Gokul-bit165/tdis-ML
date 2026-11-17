/**
 * @fileoverview Drainage Monitoring tab — AI-detected defects from drone surveys of bayous and drainage
 * channels, drawn as class pins. The data are static files in Blob Storage (see drainageService.js).
 *
 * Each class has its own clustered source, so same-class defects that would overlap become one pin with a count
 * badge, at every zoom up to the map's maximum. Clicking a group zooms in until it splits; a group that never
 * splits (defects at practically the same spot) shows a summary instead. The legend toggles classes with a fade.
 * Zoomed in, the outline tiles covering the visible area are downloaded.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MapboxStyleSwitcherControl } from 'mapbox-gl-style-switcher';
import 'mapbox-gl-style-switcher/styles.css';
import { mapStyles } from '../config/mapStyles';
import {
  CLUSTER_MAX_ZOOM,
  CLUSTER_RADIUS_PX,
  DRAINAGE_GROUPS,
  DRAINAGE_ICONS,
  OTHER_CLASS,
  OUTLINE_MIN_ZOOM,
  classColorExpression,
  drainageClassIconUrl,
  getDrainageClass,
  groupFilter,
  groupIdFor,
} from '../config/drainageConfig';
import { BADGE_ICON_URL, ICON_PIXEL_RATIO } from '../config/drainageIcons';
import {
  getDrainagePoints,
  getDrainagePolygons,
  getDrainageSummary,
} from '../services/drainageService';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

const OUTLINES_SOURCE = 'drainage-outlines';
const OUTLINES_FILL_LAYER = 'drainage-outlines-fill';
const OUTLINES_LINE_LAYER = 'drainage-outlines-line';
const EMPTY = { type: 'FeatureCollection', features: [] };
const ALL_GROUP_IDS = DRAINAGE_GROUPS.map((g) => g.id);

// Per-class source and layer ids.
const sourceId = (groupId) => `drainage-pts-${groupId}`;
const pinLayer = (groupId) => `drainage-pts-${groupId}-pin`;
const countLayer = (groupId) => `drainage-pts-${groupId}-count`;
const PIN_LAYERS = DRAINAGE_GROUPS.map((g) => pinLayer(g.id));
const COUNT_FONT = ['DIN Pro Bold', 'Arial Unicode MS Bold'];
const BADGE_ICON = 'drainage-badge';

// Clustering stays on up to the map's maximum zoom, so same-class pins never stack on each other.
const MAP_MAX_ZOOM = CLUSTER_MAX_ZOOM;

// Pin sizes (icons are 64x80 units) and where the count badge sits: top-right of a grouped pin's head.
// The badge offset is in screen pixels ('viewport'), so it stays on the pin when the map is rotated or tilted.
const PIN_SIZE = 0.5;
const GROUP_PIN_SIZE = 0.62;
const BADGE_OFFSET = [14, -46];

// Legend toggles fade a class in or out on the map.
const FADE_MS = 250;
const FADE = { duration: FADE_MS, delay: 0 };
// [layer id, paint properties that fade] for one class.
const fadingLayers = (groupId) => [
  [pinLayer(groupId), ['icon-opacity']],
  [countLayer(groupId), ['icon-opacity', 'text-opacity']],
];

// Survey area (Clear Creek bayous, Houston); replaced by the published run's bbox.
const DEFAULT_BOUNDS = [
  [-95.23, 29.49],
  [-95.06, 29.57],
];
const WINDOW_PADDING = 0.3; // fetch 30% beyond each edge so small pans don't trigger a reload
const MAX_WINDOW_DEG = 0.25; // never request outlines for a view wider than this (only reached when zoomed in)

/** Rasterise the class pins once; resolves to [{ id, img }] (failed images are skipped). */
const loadIcons = () =>
  Promise.all(
    [...DRAINAGE_ICONS, { id: BADGE_ICON, url: BADGE_ICON_URL }].map(
      ({ id, url }) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ id, img });
          img.onerror = () => resolve(null);
          img.src = url;
        })
    )
  ).then((icons) => icons.filter(Boolean));

/** One FeatureCollection per class group. */
const splitByGroup = (fc) => {
  const groups = Object.fromEntries(ALL_GROUP_IDS.map((id) => [id, []]));
  (fc?.features ?? []).forEach((f) => groups[groupIdFor(f.properties?.category)].push(f));
  return Object.fromEntries(
    ALL_GROUP_IDS.map((id) => [id, { type: 'FeatureCollection', features: groups[id] }])
  );
};

const utcStamp = (iso) => (iso ? `${iso.slice(0, 16).replace('T', ' ')} UTC` : 'unknown');
const formatArea = (m2) =>
  Number(m2) >= 100 ? `${Math.round(m2).toLocaleString()} m²` : `${Number(m2).toFixed(2)} m²`;

/** [west, south, east, north] for the current view, grown by `ratio` on every side. */
const paddedWindow = (bounds, ratio) => {
  const dx = (bounds.getEast() - bounds.getWest()) * ratio;
  const dy = (bounds.getNorth() - bounds.getSouth()) * ratio;
  return [
    bounds.getWest() - dx,
    bounds.getSouth() - dy,
    bounds.getEast() + dx,
    bounds.getNorth() + dy,
  ];
};
const windowCovers = (outer, bounds) =>
  outer &&
  outer[0] <= bounds.getWest() &&
  outer[1] <= bounds.getSouth() &&
  outer[2] >= bounds.getEast() &&
  outer[3] >= bounds.getNorth();

/**
 * Show the enabled classes and hide the rest. With `animate`, hidden classes fade out and are then removed
 * from rendering (so they cannot be clicked); shown classes fade in. Outlines are filtered straight away.
 */
function applyFilter(map, enabled, { animate = false, isEnabled = () => true } = {}) {
  DRAINAGE_GROUPS.forEach((g) => {
    const on = enabled.includes(g.id);
    const layers = fadingLayers(g.id).filter(([id]) => map.getLayer(id));
    if (on) layers.forEach(([id]) => map.setLayoutProperty(id, 'visibility', 'visible'));
    layers.forEach(([id, props]) => props.forEach((p) => map.setPaintProperty(id, p, on ? 1 : 0)));
    if (!on) {
      const hide = () =>
        !isEnabled(g.id) &&
        layers.forEach(
          ([id]) => map.getLayer(id) && map.setLayoutProperty(id, 'visibility', 'none')
        );
      if (animate) setTimeout(hide, FADE_MS);
      else hide();
    }
  });
  const filter = groupFilter(enabled);
  [OUTLINES_FILL_LAYER, OUTLINES_LINE_LAYER].forEach(
    (id) => map.getLayer(id) && map.setFilter(id, filter)
  );
}

/** Animated on/off switch shown at the end of a legend row (the row itself is the control). */
const ToggleSwitch = ({ on, color }) => (
  <span
    aria-hidden
    className="relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors duration-200 ease-out"
    style={{ background: on ? color : '#cbd5e1' }}
  >
    <span
      className={`absolute left-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out ${
        on ? 'translate-x-3' : 'translate-x-0'
      }`}
    />
  </span>
);

const DrainageMonitoringTab = () => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const groupsRef = useRef(splitByGroup(EMPTY)); // latest data and filter, re-applied after a base-map change
  const outlinesRef = useRef(EMPTY);
  const enabledRef = useRef(ALL_GROUP_IDS);
  const outlineWindowRef = useRef(null);
  const summaryRef = useRef(null); // survey manifest, needed to find outline tiles
  const abortRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [summary, setSummary] = useState(null);
  const [points, setPoints] = useState(null);
  const [enabled, setEnabled] = useState(ALL_GROUP_IDS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Outlines for the visible area, only when zoomed in far enough to see them.
  const refreshOutlines = useCallback(() => {
    const map = mapRef.current;
    if (!map || map.getZoom() < OUTLINE_MIN_ZOOM - 0.5) return;
    const bounds = map.getBounds();
    if (windowCovers(outlineWindowRef.current, bounds)) return;
    const window = paddedWindow(bounds, WINDOW_PADDING);
    if (window[2] - window[0] > MAX_WINDOW_DEG || window[3] - window[1] > MAX_WINDOW_DEG) return;
    if (!summaryRef.current) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    getDrainagePolygons(summaryRef.current, window, controller.signal)
      .then((fc) => {
        outlineWindowRef.current = window;
        outlinesRef.current = fc;
        mapRef.current?.getSource(OUTLINES_SOURCE)?.setData(fc);
      })
      .catch((e) => e.name !== 'AbortError' && setError(e.message));
  }, []);

  // Map init
  useEffect(() => {
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      bounds: DEFAULT_BOUNDS,
      fitBoundsOptions: { padding: 40 },
      maxZoom: MAP_MAX_ZOOM,
      // Pins are never hidden by collisions, so skip the symbol fade-in that made them lag behind on pans.
      fadeDuration: 0,
      // Same as the other tabs: scroll zooms the map only with Ctrl/Cmd held, so the page can still scroll.
      cooperativeGestures: true,
    });
    map.addControl(new MapboxStyleSwitcherControl(mapStyles, 'Satellite Streets'), 'top-right');
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Switching base map drops custom images, sources and layers, so (re)add them on every style load.
    const iconsReady = loadIcons();
    const addLayers = (icons) => {
      if (mapRef.current !== map || map.getSource(OUTLINES_SOURCE)) return;
      icons.forEach(
        ({ id, img }) =>
          !map.hasImage(id) && map.addImage(id, img, { pixelRatio: ICON_PIXEL_RATIO })
      );

      map.addSource(OUTLINES_SOURCE, { type: 'geojson', data: outlinesRef.current });
      map.addLayer({
        id: OUTLINES_FILL_LAYER,
        type: 'fill',
        source: OUTLINES_SOURCE,
        minzoom: OUTLINE_MIN_ZOOM,
        paint: { 'fill-color': classColorExpression, 'fill-opacity': 0.4 },
      });
      map.addLayer({
        id: OUTLINES_LINE_LAYER,
        type: 'line',
        source: OUTLINES_SOURCE,
        minzoom: OUTLINE_MIN_ZOOM,
        paint: { 'line-color': classColorExpression, 'line-width': 1.5 },
      });

      DRAINAGE_GROUPS.forEach((g) => {
        map.addSource(sourceId(g.id), {
          type: 'geojson',
          data: groupsRef.current[g.id],
          cluster: true,
          clusterRadius: CLUSTER_RADIUS_PX,
          clusterMaxZoom: CLUSTER_MAX_ZOOM,
          maxzoom: CLUSTER_MAX_ZOOM + 1, // cluster at every zoom up to the limit, not just up to 18
        });
        map.addLayer({
          id: pinLayer(g.id),
          type: 'symbol',
          source: sourceId(g.id),
          layout: {
            'icon-image': g.icon,
            'icon-anchor': 'bottom',
            'icon-size': ['case', ['has', 'point_count'], GROUP_PIN_SIZE, PIN_SIZE],
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            // Bigger groups on top so the count stays readable.
            'symbol-sort-key': ['coalesce', ['get', 'point_count'], 1],
          },
          paint: { 'icon-opacity-transition': FADE },
        });
      });
      // Count badges after every class's pins, so another class's pin never covers a count.
      // Badge and number are one symbol, so they always appear together with the pins.
      DRAINAGE_GROUPS.forEach((g) => {
        map.addLayer({
          id: countLayer(g.id),
          type: 'symbol',
          source: sourceId(g.id),
          filter: ['has', 'point_count'],
          layout: {
            'icon-image': BADGE_ICON,
            'icon-size': ['step', ['get', 'point_count'], 0.8, 10, 0.9, 100, 1.1],
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            'text-field': ['get', 'point_count_abbreviated'],
            'text-font': COUNT_FONT,
            'text-size': 10,
            'text-allow-overlap': true,
            'text-ignore-placement': true,
          },
          paint: {
            'text-color': '#ffffff',
            'text-translate': BADGE_OFFSET,
            'text-translate-anchor': 'viewport',
            'text-opacity-transition': FADE,
            'icon-translate': BADGE_OFFSET,
            'icon-translate-anchor': 'viewport',
            'icon-opacity-transition': FADE,
          },
        });
      });
      applyFilter(map, enabledRef.current);
    };
    map.on('style.load', () => iconsReady.then(addLayers));

    // Popup for one defect, or for a group whose defects sit at practically the same spot.
    const showPopup = (lngLat, html) =>
      new mapboxgl.Popup({ offset: [0, -40] }).setLngLat(lngLat).setHTML(html).addTo(map);

    map.on('load', () => {
      PIN_LAYERS.forEach((layer) => {
        map.on('click', layer, (e) => {
          const f = e.features?.[0];
          if (!f) return;
          const cls = getDrainageClass(f.properties.category);
          if (!f.properties.point_count) {
            showPopup(
              f.geometry.coordinates,
              `<div style="font-size:13px;line-height:1.5">
                 <strong>${cls.label}</strong><br/>Area: ${formatArea(f.properties.area)}
               </div>`
            );
            return;
          }
          const source = map.getSource(f.source);
          const { cluster_id: clusterId, point_count: n } = f.properties;
          source?.getClusterExpansionZoom(clusterId, (err, zoom) => {
            if (err) return;
            if (zoom <= MAP_MAX_ZOOM && zoom > map.getZoom() + 0.1) {
              map.easeTo({ center: f.geometry.coordinates, zoom });
              return;
            }
            // Cannot be split by zooming: summarise the group instead.
            source.getClusterLeaves(clusterId, n, 0, (leafErr, leaves) => {
              if (leafErr) return;
              const total = leaves.reduce((sum, l) => sum + (Number(l.properties.area) || 0), 0);
              const groupClass = getDrainageClass(leaves[0]?.properties.category);
              showPopup(
                f.geometry.coordinates,
                `<div style="font-size:13px;line-height:1.5">
                   <strong>${n} × ${groupClass.label}</strong><br/>
                   Combined area: ${formatArea(total)}<br/>
                   <span style="color:#64748b;font-size:11px">Detected at practically the same spot</span>
                 </div>`
              );
            });
          });
        });
        map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'));
        map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''));
      });
      map.on('moveend', refreshOutlines);
      setMapReady(true);
    });
    mapRef.current = map;
    return () => {
      abortRef.current?.abort();
      map.remove();
      mapRef.current = null;
    };
  }, [refreshOutlines]);

  // Survey summary (legend counts) and points
  useEffect(() => {
    const controller = new AbortController();
    getDrainageSummary(controller.signal)
      .then(async (s) => {
        summaryRef.current = s;
        const pts = await getDrainagePoints(s, controller.signal);
        setSummary(s);
        setPoints(pts);
        refreshOutlines(); // in case the map was already zoomed in
      })
      .catch((e) => e.name !== 'AbortError' && setError(e.message))
      .finally(() => !controller.signal.aborted && setLoading(false));
    return () => controller.abort();
  }, [refreshOutlines]);

  // Push points to the map and frame the survey area
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !points || !map) return;
    groupsRef.current = splitByGroup(points);
    DRAINAGE_GROUPS.forEach((g) => map.getSource(sourceId(g.id))?.setData(groupsRef.current[g.id]));
    if (summary?.bbox) {
      const [w, s, e, n] = summary.bbox;
      map.fitBounds(
        [
          [w, s],
          [e, n],
        ],
        { padding: 60, duration: 0 }
      );
    }
  }, [mapReady, points, summary]);

  // Legend filter (animated)
  useEffect(() => {
    enabledRef.current = enabled;
    if (mapReady && mapRef.current) {
      applyFilter(mapRef.current, enabled, {
        animate: true,
        isEnabled: (id) => enabledRef.current.includes(id),
      });
    }
  }, [mapReady, enabled]);

  // Counts per legend row; unknown classes are summed into "Other".
  const counts = useMemo(() => {
    const c = {};
    Object.entries(summary?.counts ?? {}).forEach(([id, n]) => {
      const g = groupIdFor(id);
      c[g] = (c[g] ?? 0) + n;
    });
    return c;
  }, [summary]);
  const legend = DRAINAGE_GROUPS.filter((g) => g.id !== OTHER_CLASS.id || counts[OTHER_CLASS.id]);
  const shown = legend
    .filter((g) => enabled.includes(g.id))
    .reduce((n, g) => n + (counts[g.id] ?? 0), 0);
  const toggle = (id) =>
    setEnabled((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'auto' }}>
      {/* Keep Mapbox's zoom/compass buttons below the tab bar that overlays the top of the map */}
      <style>{`
        .mapboxgl-ctrl-top-right { top: 64px !important; }
        @media (max-width: 640px) { .mapboxgl-ctrl-top-right { top: 56px !important; } }
      `}</style>
      <div ref={containerRef} className="w-full h-full" />

      <div className="absolute bottom-6 right-4 z-10 w-[22rem] max-w-[calc(100%-2rem)] rounded-lg bg-white/95 p-4 shadow-lg text-[#324755]">
        <h3 className="text-base font-bold mb-1">Drainage Monitoring</h3>
        <p className="text-xs text-[#324755]/70 mb-3">
          Defects detected by AI in drone surveys of bayous and drainage channels.
        </p>

        {summary && (
          <div className="mb-3 rounded bg-sky-50 px-2 py-1.5 text-xs">
            <div className="font-semibold">Survey run {summary.run_id}</div>
            <div className="text-[#324755]/70">Published {utcStamp(summary.published_at)}</div>
          </div>
        )}

        <div className="mb-1.5 flex items-center justify-between text-[11px]">
          <span className="font-semibold uppercase tracking-wide text-[#324755]/60">
            Defect classes
          </span>
          <span className="flex gap-2">
            <button
              type="button"
              className="text-sky-700 hover:underline"
              onClick={() => setEnabled(ALL_GROUP_IDS)}
            >
              All
            </button>
            <button
              type="button"
              className="text-sky-700 hover:underline"
              onClick={() => setEnabled([])}
            >
              None
            </button>
          </span>
        </div>

        <ul className="space-y-0.5 text-xs" aria-label="Defect classes">
          {legend.map((c) => {
            const on = enabled.includes(c.id);
            return (
              <li key={c.id} className="group flex items-center gap-1">
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={c.label}
                  onClick={() => toggle(c.id)}
                  className="flex flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors duration-200 hover:bg-slate-100"
                >
                  <img
                    src={drainageClassIconUrl(c)}
                    alt=""
                    className={`h-6 w-5 shrink-0 transition-all duration-200 ease-out ${
                      on ? 'scale-100 opacity-100' : 'scale-75 opacity-40 grayscale'
                    }`}
                  />
                  <span
                    className={`flex-1 transition-colors duration-200 ${
                      on ? 'font-medium text-[#324755]' : 'text-[#324755]/45'
                    }`}
                  >
                    {c.label}
                  </span>
                  <span
                    className="min-w-[2.5rem] rounded-full px-1.5 py-0.5 text-center text-[10px] font-semibold tabular-nums text-white transition-colors duration-200"
                    style={{ background: on ? c.color : '#cbd5e1' }}
                  >
                    {(counts[c.id] ?? 0).toLocaleString()}
                  </span>
                  <ToggleSwitch on={on} color={c.color} />
                </button>
                <button
                  type="button"
                  onClick={() => setEnabled([c.id])}
                  className="w-8 rounded px-1 py-0.5 text-[10px] text-sky-700 opacity-0 transition-opacity hover:bg-sky-50 focus:opacity-100 group-hover:opacity-100"
                  aria-label={`Show only ${c.label}`}
                >
                  Only
                </button>
              </li>
            );
          })}
        </ul>

        <p className="mt-3 text-[11px] text-[#324755]/60">
          {loading
            ? 'Loading…'
            : summary
              ? `Showing ${shown.toLocaleString()} of ${summary.n_defects.toLocaleString()} defects. ` +
                'A number on a pin groups same-class defects that would overlap; click it to zoom in. ' +
                'Zoom in further for outlines.'
              : ''}
        </p>
        {summary && summary.data_source !== 'drone-survey' && (
          <p className="mt-2 rounded bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">
            Test data ({summary.data_source}).
          </p>
        )}
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
};

export default DrainageMonitoringTab;
