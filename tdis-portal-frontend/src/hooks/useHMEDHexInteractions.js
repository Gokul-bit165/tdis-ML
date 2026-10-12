/**
 * @fileoverview Hook for HMED hex layer click/hover and popup.
 */

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { getMapPopupOffset, getOptimalAnchor } from '../utils/osaUtils';
import { MAP_UI_TOP_PADDING } from '../config/mapConfig';
import { LAYER_CONFIG } from '../config/hmedLayerConfig';
import { getLayerPropertyName } from '../config/hmedLayerConfig';
import { HMED_CONFIG } from '../config/mapConfig';
import {
  findHighestImpactHours,
  getImpactTimingPropertyNames,
  formatIsoTimeForPopup,
  escapeHtmlForPopup,
  getFloodHubPopupFields,
  formatFloodHubUnitLabel,
  getFloodHubTierLabel,
  getFloodHubTierComparisonScalar,
} from '../utils/hmedMapUtils';
import { buildLtsHexPopupHtml } from '../utils/ltsHexPopupUtils';
import { FLOOD_HUB_GAUGES_GEOJSON_LAYER } from '../utils/floodHubGaugeMapLayers';
import { trackMapInteraction } from '../utils/googleAnalytics.js';

const ALL_LEVELS = [6, 7, 8, 9, 10];
const hourOptions = HMED_CONFIG.hourOptions;

function hmHexDbg() {
  // Intentionally silent — verbose hex traces stay out of the browser console.
}

/** Style layer id `hex-l10` or `hex-l10-outline` → H3 resolution level */
function levelFromHexStyleLayerId(styleLayerId) {
  const m = String(styleLayerId || '').match(/^hex-l(\d+)/);
  return m ? Number(m[1]) : 10;
}

function dedupeFloodHexFeatures(features) {
  const seen = new Set();
  return features.filter((f) => {
    const p = f.properties || {};
    const key = `${p.gauge_id ?? p.gaugeId ?? ''}|${p.h3_id ?? p.h3 ?? ''}`;
    if (!key.trim().length || key === '|') {
      if (seen.has(f.layer?.id)) return false;
      seen.add(f.layer.id);
      return true;
    }
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Rough ring/polygon centroid in lng/lat for picking nearest hex to the click */
function approxFeatureLngLat(feature) {
  const g = feature?.geometry;
  if (!g) return null;
  if (g.type === 'Point') {
    const c = g.coordinates;
    return { lng: c[0], lat: c[1] };
  }
  const ring =
    g.type === 'Polygon'
      ? g.coordinates[0]
      : g.type === 'MultiPolygon'
        ? g.coordinates[0]?.[0]
        : null;
  if (!ring?.length) return null;
  let sl = 0;
  let sLat = 0;
  let n = 0;
  for (const pair of ring) {
    const lng = pair[0];
    const lat = pair[1];
    if (typeof lng !== 'number' || typeof lat !== 'number') continue;
    sl += lng;
    sLat += lat;
    n += 1;
  }
  if (!n) return null;
  return { lng: sl / n, lat: sLat / n };
}

function pickNearestFloodFeature(features, lngLat) {
  if (!features.length) return null;
  if (features.length === 1) return features[0];
  const tLng = lngLat.lng;
  const tLat = lngLat.lat;
  let best = features[0];
  let bestD = Infinity;
  for (const f of features) {
    const c = approxFeatureLngLat(f);
    if (!c) continue;
    const d = (c.lng - tLng) ** 2 + (c.lat - tLat) ** 2;
    if (d < bestD) {
      bestD = d;
      best = f;
    }
  }
  return best;
}

/** Screen-pixel padding for Flood Hub hit-testing: L10 fills are tiny at low zoom. */
function floodHubQueryPaddingPx(map) {
  const z = map.getZoom();
  if (z < 6) return 40;
  if (z < 8) return 34;
  if (z < 10) return 26;
  return 18;
}

function formatValue(val) {
  if (val === null || isNaN(val)) return 'N/A';
  return val.toFixed(3);
}

function getIntensityLevel(val) {
  if (val === null || isNaN(val)) return 'N/A';
  if (val > 1.5) return 'Extreme';
  if (val > 1.0) return 'Major';
  if (val > 0.5) return 'Significant';
  if (val > 0.25) return 'Elevated';
  return 'Minimal';
}

function getIntensityColor(val) {
  if (val === null || isNaN(val)) return 'text-gray-500';
  if (val > 1.5) return 'text-red-800';
  if (val > 1.0) return 'text-red-700';
  if (val > 0.5) return 'text-orange-700';
  if (val > 0.25) return 'text-yellow-700';
  return 'text-blue-700';
}

function getFloodHubTierColorClass(tier) {
  switch (tier) {
    case 'Extreme':
      return 'text-red-800';
    case 'Danger':
      return 'text-orange-800';
    case 'Warning':
      return 'text-amber-800';
    case 'Normal':
      return 'text-green-800';
    default:
      return 'text-gray-500';
  }
}

function floodQtyDispForPopup(n, unitRaw) {
  if (n == null || Number.isNaN(n)) return 'N/A';
  const num = escapeHtmlForPopup(Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }));
  const u = formatFloodHubUnitLabel(unitRaw);
  return u ? `${num} ${escapeHtmlForPopup(u)}` : num;
}

/**
 * @param {React.RefObject} mapRef
 * @param {boolean} mapReady
 * @param {number} selectedHours
 * @param {string} selectedLayer
 * @param {boolean} isMobile
 * @param {number} [hexLayersGeneration] - increment when map hex layers are rebuilt (async swap); re-attaches handlers
 * @param {((payload: { lngLat: import('mapbox-gl').LngLat; level: number; properties: Record<string, unknown> }) => void) | null} [onFloodHubGaugeOpen] - opens PRD side panel instead of popup when set
 */
export function useHMEDHexInteractions(
  mapRef,
  mapReady,
  selectedHours,
  selectedLayer,
  isMobile,
  hexLayersGeneration = 0,
  onFloodHubGaugeOpen = null
) {
  const selectedHoursRef = useRef(selectedHours);
  const selectedLayerRef = useRef(selectedLayer);
  const activePopupRef = useRef(null);

  useEffect(() => {
    selectedHoursRef.current = selectedHours;
    selectedLayerRef.current = selectedLayer;
  }, [selectedHours, selectedLayer]);

  useEffect(() => {
    const map = mapRef?.current;
    if (!map || !mapReady) {
      hmHexDbg('interactions skip', { hasMap: !!map, mapReady });
      return;
    }

    const layer = LAYER_CONFIG[selectedLayerRef.current] || LAYER_CONFIG.precipitation;
    const levels = layer.levels || ALL_LEVELS;

    hmHexDbg('interactions attach', {
      selectedLayer: selectedLayerRef.current,
      hexLayersGeneration,
      levels,
    });

    const clickHandlers = [];
    const mouseEnterHandlers = [];
    const mouseLeaveHandlers = [];

    let attached = 0;
    const missing = [];

    /**
     * @param {mapboxgl.MapMouseEvent} e
     * @param {number} level
     * @param {Record<string, unknown>} props
     * @param {string} [layerIdForLog]
     */
    const showHexPopup = (e, level, props, layerIdForLog = `hex-l${level}`) => {
      if (e?.originalEvent) {
        e.originalEvent.cancelBubble = true;
        if (typeof e.originalEvent.stopPropagation === 'function') {
          e.originalEvent.stopPropagation();
        }
      }
      const currentHours = selectedHoursRef.current;
      const layerConfig = LAYER_CONFIG[selectedLayerRef.current] || LAYER_CONFIG.precipitation;
      trackMapInteraction({
        action: 'hex_click',
        tab: 'hmed',
        layer_name: layerConfig.id,
      });
      const isFloodHubEarly = layerConfig.floodHubGauge === true;
      if (isFloodHubEarly && typeof onFloodHubGaugeOpen === 'function') {
        onFloodHubGaugeOpen({ lngLat: e.lngLat, level, properties: props });
        return;
      }
      const isFloodHub = layerConfig.floodHubGauge === true;
      const isLts = layerConfig.hasTimeWindow === false && !isFloodHub;
      hmHexDbg('hex click', {
        layerId: layerIdForLog,
        h3Level: level,
        isLts,
        isFloodHub,
        propsKeys: Object.keys(props),
        sample: isLts
          ? {
              lts_level: props.lts_level,
              lts_label: props.lts_label,
              peak_start_time: props.peak_start_time,
              peak_end_time: props.peak_end_time,
            }
          : isFloodHub
            ? { gauge_id: props.gauge_id, predicted_peak: props.predicted_peak }
            : {},
      });
      const optimalAnchor = getOptimalAnchor(e.lngLat, map, {
        isMobile,
        popupHeight: isLts ? 520 : 400,
        popupWidth: isLts ? 400 : 320,
        topReserve: MAP_UI_TOP_PADDING + 8,
      });
      const popupOffset = getMapPopupOffset(optimalAnchor, {
        topReserve: MAP_UI_TOP_PADDING + 8,
      });
      if (activePopupRef.current) {
        activePopupRef.current.remove();
        activePopupRef.current = null;
      }

      let popupHtml;
      if (isFloodHub) {
        const f = getFloodHubPopupFields(props);
        const tierVal = getFloodHubTierComparisonScalar(f.current, f.peak);
        const tier = getFloodHubTierLabel(tierVal, f.warning, f.danger, f.extreme);
        const tierClass = getFloodHubTierColorClass(tier);
        const virtualNote =
          /^hybas_/i.test(f.gaugeId) || /^hybas_/i.test(String(props.gauge_id ?? ''))
            ? '<p class="text-[10px] text-slate-600 mt-2">Virtual basin-linked gauge (downstream representation).</p>'
            : '';
        popupHtml = `
                        <div class="p-4 min-w-[280px]">
                            <div class="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200">
                                <div class="w-2 h-2 rounded-full" style="background-color: ${layerConfig.color}"></div>
                                <p class="font-bold text-sm text-[#324755]">${layerConfig.name} — Details</p>
                            </div>
                            <div class="space-y-2.5">
                                <div class="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-200">
                                    <span class="text-xs font-semibold text-gray-700">Tier</span>
                                    <span class="text-sm font-bold ${tierClass}">${escapeHtmlForPopup(tier)}</span>
                                </div>
                                <div class="flex items-center justify-between p-2.5 rounded-lg border border-gray-200">
                                    <span class="text-xs font-semibold text-gray-700">Gauge</span>
                                    <span class="text-xs font-mono font-medium text-gray-800 text-right max-w-[200px] break-all">${escapeHtmlForPopup(f.gaugeId || 'N/A')}</span>
                                </div>
                                <div class="flex items-center justify-between p-2.5 rounded-lg border border-gray-200">
                                    <span class="text-xs font-semibold text-gray-700">Forecast peak</span>
                                    <span class="text-sm font-bold text-gray-900">${floodQtyDispForPopup(f.peak, f.unit)}</span>
                                </div>
                                <div class="flex items-center justify-between p-2.5 rounded-lg border border-gray-200">
                                    <span class="text-xs font-semibold text-gray-700">Current</span>
                                    <span class="text-sm font-medium text-gray-800">${floodQtyDispForPopup(f.current, f.unit)}</span>
                                </div>
                                <div class="p-3 rounded-lg border border-slate-200 bg-slate-50/80 text-xs space-y-1.5">
                                    <p class="font-semibold text-slate-800">Thresholds</p>
                                    <div class="flex justify-between"><span class="text-gray-600">Warning</span><span class="font-medium">${floodQtyDispForPopup(f.warning, f.unit)}</span></div>
                                    <div class="flex justify-between"><span class="text-gray-600">Danger</span><span class="font-medium">${floodQtyDispForPopup(f.danger, f.unit)}</span></div>
                                    <div class="flex justify-between"><span class="text-gray-600">Extreme</span><span class="font-medium">${floodQtyDispForPopup(f.extreme, f.unit)}</span></div>
                                </div>
                                <div class="flex items-center justify-between p-2.5 rounded-lg border border-gray-200">
                                    <span class="text-xs font-semibold text-gray-700">H3 cell</span>
                                    <span class="text-[10px] font-mono text-gray-700 text-right max-w-[220px] break-all">${escapeHtmlForPopup(f.h3Id || 'N/A')}</span>
                                </div>
                                <div class="p-2.5 rounded-lg border border-gray-100 bg-gray-50/80">
                                    <span class="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Run time</span>
                                    <p class="text-xs font-medium text-gray-800 mt-0.5">${escapeHtmlForPopup(formatIsoTimeForPopup(f.fetchedAt))}</p>
                                </div>
                                ${virtualNote}
                            </div>
                        </div>
                    `;
      } else if (isLts) {
        popupHtml = buildLtsHexPopupHtml(props, level, {
          layerTitle: layerConfig.name,
        });
      } else {
        const hourValues = {};
        hourOptions.forEach((hours) => {
          const propertyName = getLayerPropertyName(layerConfig, hours, undefined, level);
          const valueRaw = props[propertyName] ?? null;
          hourValues[hours] = valueRaw !== null && valueRaw !== '' ? Number(valueRaw) : null;
          if (hourValues[hours] !== null && Number.isNaN(hourValues[hours])) {
            hourValues[hours] = null;
          }
        });
        const peakHours = findHighestImpactHours(hourValues, hourOptions);
        let peakTimingBlock = '';
        if (peakHours != null) {
          const { start: startKey, end: endKey } = getImpactTimingPropertyNames(peakHours, level);
          const startVal = escapeHtmlForPopup(formatIsoTimeForPopup(props[startKey]));
          const endVal = escapeHtmlForPopup(formatIsoTimeForPopup(props[endKey]));
          peakTimingBlock = `
                                <div class="mb-3 p-3 rounded-lg border border-indigo-200 bg-indigo-50/80">
                                    <p class="text-xs font-semibold text-indigo-900">Peak impact timing</p>
                                    <p class="text-[10px] text-indigo-800/90 mt-0.5 mb-2">${peakHours}h window · when the <span class="font-semibold">highest</span> HSI among 3h / 6h / 12h / 24h occurs in this hex</p>
                                    <div class="space-y-2.5 text-xs">
                                        <div>
                                            <div class="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-0.5">Start</div>
                                            <div class="font-medium text-gray-900 leading-snug">${startVal}</div>
                                        </div>
                                        <div>
                                            <div class="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-0.5">End</div>
                                            <div class="font-medium text-gray-900 leading-snug">${endVal}</div>
                                        </div>
                                    </div>
                                </div>`;
        }
        popupHtml = `
                        <div class="p-4 min-w-[280px]">
                            <div class="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200">
                                <div class="w-2 h-2 rounded-full" style="background-color: ${layerConfig.color}"></div>
                                <p class="font-bold text-sm text-[#324755]">${layerConfig.name} HSI Details</p>
                            </div>
                            <div class="space-y-2.5">
                                ${peakTimingBlock}
                                <div class="mb-3">
                                    <p class="text-xs font-semibold text-gray-700 mb-2">${layerConfig.name} values by time window</p>
                                    <div class="space-y-1.5">
                                        ${hourOptions
                                          .map((hours) => {
                                            const value = hourValues[hours];
                                            const isCurrent = hours === currentHours;
                                            const intensity = getIntensityLevel(value);
                                            const colorClass = getIntensityColor(value);
                                            return `
                                                <div class="flex items-center justify-between p-2 rounded-lg border ${isCurrent ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}">
                                                    <div class="flex items-center gap-2">
                                                        <span class="text-xs font-semibold text-gray-700">${hours}h:</span>
                                                        ${isCurrent ? '<span class="text-[10px] bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded font-semibold">Current</span>' : ''}
                                                    </div>
                                                    <div class="flex items-center gap-2">
                                                        <span class="text-sm font-bold ${colorClass}">${formatValue(value)}</span>
                                                        <span class="text-[10px] font-medium text-gray-600">${intensity}</span>
                                                    </div>
                                                </div>
                                            `;
                                          })
                                          .join('')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
      }

      const popup = new mapboxgl.Popup({
        closeButton: true,
        closeOnClick: true,
        className: 'hmed-popup',
        anchor: optimalAnchor,
        offset: popupOffset,
        maxWidth: '420px',
      })
        .setLngLat(e.lngLat)
        .setHTML(popupHtml)
        .addTo(map);

      popup.on('open', () => {
        const popupElement =
          popup.getElement?.() ?? document.querySelector('.mapboxgl-popup.hmed-popup');
        if (popupElement) {
          popupElement.style.zIndex = '9999';
          const tip = popupElement.querySelector('.mapboxgl-popup-tip');
          if (tip) tip.style.zIndex = '9999';
        }
        const popupContent = popupElement?.querySelector('.mapboxgl-popup-content');
        if (popupContent) {
          popupContent.style.zIndex = '9999';
          popupContent.style.maxHeight = 'min(70vh, 560px)';
          popupContent.style.overflowY = 'auto';
        }
        activePopupRef.current = popup;
      });
      popup.on('close', () => {
        if (activePopupRef.current === popup) activePopupRef.current = null;
      });
    };

    const useFloodHubWideHits = layer.floodHubGauge === true;

    /** Flood Hub: point queries miss L10 fills at low zoom — search a screen box and pick the nearest hex. */
    const onFloodHubMapClick = useFloodHubWideHits
      ? (e) => {
          const pad = floodHubQueryPaddingPx(map);
          const { x, y } = e.point;
          const box = [
            [x - pad, y - pad],
            [x + pad, y + pad],
          ];
          const layerIds = [];
          if (map.getLayer(FLOOD_HUB_GAUGES_GEOJSON_LAYER)) {
            layerIds.push(FLOOD_HUB_GAUGES_GEOJSON_LAYER);
          }
          levels.forEach((lv) => {
            const id = `hex-l${lv}`;
            const oid = `${id}-outline`;
            if (map.getLayer(id)) layerIds.push(id);
            if (map.getLayer(oid)) layerIds.push(oid);
          });
          if (!layerIds.length) return;
          const raw = map.queryRenderedFeatures(box, { layers: layerIds });
          const uniq = dedupeFloodHexFeatures(raw);
          const picked = pickNearestFloodFeature(uniq, e.lngLat);
          if (!picked) return;
          const props = picked.properties || {};
          const lv = levelFromHexStyleLayerId(picked.layer?.id);
          showHexPopup(e, lv, props, picked.layer?.id);
        }
      : null;

    if (onFloodHubMapClick) {
      map.on('click', onFloodHubMapClick);
    }

    if (useFloodHubWideHits && map.getLayer(FLOOD_HUB_GAUGES_GEOJSON_LAYER)) {
      const interactId = FLOOD_HUB_GAUGES_GEOJSON_LAYER;
      const onMouseEnter = () => {
        map.getCanvas().style.cursor = 'pointer';
      };
      const onMouseLeave = () => {
        map.getCanvas().style.cursor = '';
      };
      map.on('mouseenter', interactId, onMouseEnter);
      map.on('mouseleave', interactId, onMouseLeave);
      mouseEnterHandlers.push({ layerId: interactId, handler: onMouseEnter });
      mouseLeaveHandlers.push({ layerId: interactId, handler: onMouseLeave });
      attached += 1;
    }

    levels.forEach((level) => {
      const layerId = `hex-l${level}`;
      if (!map.getLayer(layerId)) {
        missing.push(layerId);
        return;
      }
      const outlineId = `${layerId}-outline`;
      const interactIds =
        useFloodHubWideHits && map.getLayer(outlineId) ? [layerId, outlineId] : [layerId];

      interactIds.forEach((interactId) => {
        attached += 1;

        const onMouseEnter = () => {
          map.getCanvas().style.cursor = 'pointer';
        };
        const onMouseLeave = () => {
          map.getCanvas().style.cursor = '';
        };
        const onLayerClick = (e) => {
          const props = e.features[0]?.properties || {};
          showHexPopup(e, level, props, interactId);
        };

        map.on('mouseenter', interactId, onMouseEnter);
        map.on('mouseleave', interactId, onMouseLeave);
        if (!useFloodHubWideHits) {
          map.on('click', interactId, onLayerClick);
        }
        mouseEnterHandlers.push({ layerId: interactId, handler: onMouseEnter });
        mouseLeaveHandlers.push({ layerId: interactId, handler: onMouseLeave });
        if (!useFloodHubWideHits) {
          clickHandlers.push({ layerId: interactId, handler: onLayerClick });
        }
      });
    });

    hmHexDbg('click/hover handlers attached', {
      selectedLayer: selectedLayerRef.current,
      hexLayersGeneration,
      attached,
      missingLayerIds: missing,
      levelsExpected: levels,
    });

    return () => {
      try {
        if (!map || !map.getStyle()) return;
      } catch {
        return;
      }
      if (onFloodHubMapClick) {
        try {
          map.off('click', onFloodHubMapClick);
        } catch {
          /* ignore */
        }
      }
      mouseEnterHandlers.forEach(({ layerId, handler }) => {
        try {
          if (map.getLayer(layerId)) map.off('mouseenter', layerId, handler);
        } catch {
          /* ignore */
        }
      });
      mouseLeaveHandlers.forEach(({ layerId, handler }) => {
        try {
          if (map.getLayer(layerId)) map.off('mouseleave', layerId, handler);
        } catch {
          /* ignore */
        }
      });
      clickHandlers.forEach(({ layerId, handler }) => {
        try {
          if (map.getLayer(layerId)) map.off('click', layerId, handler);
        } catch {
          /* ignore */
        }
      });
      try {
        if (activePopupRef.current) {
          activePopupRef.current.remove();
          activePopupRef.current = null;
        }
      } catch {
        /* ignore */
      }
    };
  }, [mapRef, mapReady, isMobile, selectedLayer, hexLayersGeneration, onFloodHubGaugeOpen]);
}
