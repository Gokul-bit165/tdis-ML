/**
 * @fileoverview Mapbox source/layer helpers for Flood Hub gauge overview (GeoJSON on load).
 */

import { getColorExpression } from './hmedMapUtils';
import { HMED_CONFIG } from '../config/mapConfig';

const HSI_VALUE_OFFSET = HMED_CONFIG.hsiValueOffset ?? 0;

export const FLOOD_HUB_GAUGES_GEOJSON_SOURCE = 'flood-hub-gauges-geojson';
export const FLOOD_HUB_GAUGES_GEOJSON_LAYER = 'flood-hub-gauges-circles';

/**
 * @param {object} config - LAYER_CONFIG.google_flood_hub
 * @param {number} selectedHours
 * @param {number} [level=10]
 */
export function getFloodHubGaugeCirclePaint(config, selectedHours, level = 10) {
  return {
    'circle-color': getColorExpression(config, selectedHours, HSI_VALUE_OFFSET, level),
    'circle-opacity': HMED_CONFIG.floodHubGaugeCircleOpacity,
    'circle-radius': [
      'interpolate',
      ['linear'],
      ['zoom'],
      4,
      6,
      5,
      7,
      6,
      8,
      8,
      6.5,
      10,
      6.5,
      12,
      5,
      14,
      4,
    ],
    'circle-stroke-width': 1.25,
    'circle-stroke-color': 'rgba(255,255,255,0.92)',
  };
}

/**
 * @param {import('mapbox-gl').Map} map
 */
export function removeFloodHubGaugesGeoJsonLayer(map) {
  try {
    if (map.getLayer(FLOOD_HUB_GAUGES_GEOJSON_LAYER))
      map.removeLayer(FLOOD_HUB_GAUGES_GEOJSON_LAYER);
  } catch {
    /* ignore */
  }
  try {
    if (map.getSource(FLOOD_HUB_GAUGES_GEOJSON_SOURCE))
      map.removeSource(FLOOD_HUB_GAUGES_GEOJSON_SOURCE);
  } catch {
    /* ignore */
  }
}

/**
 * @param {import('mapbox-gl').Map} map
 * @param {import('geojson').FeatureCollection} geojson
 * @param {object} config
 * @param {number} selectedHours
 * @param {string} [beforeId]
 */
export function addFloodHubGaugesGeoJsonLayer(map, geojson, config, selectedHours, beforeId) {
  removeFloodHubGaugesGeoJsonLayer(map);
  map.addSource(FLOOD_HUB_GAUGES_GEOJSON_SOURCE, {
    type: 'geojson',
    data: geojson,
  });
  const layer = {
    id: FLOOD_HUB_GAUGES_GEOJSON_LAYER,
    type: 'circle',
    source: FLOOD_HUB_GAUGES_GEOJSON_SOURCE,
    minzoom: 0,
    maxzoom: 22,
    paint: getFloodHubGaugeCirclePaint(config, selectedHours),
  };
  if (beforeId && map.getLayer(beforeId)) {
    map.addLayer(layer, beforeId);
  } else {
    map.addLayer(layer);
  }
}

/**
 * @param {import('mapbox-gl').Map} map
 * @param {object} config
 * @param {number} selectedHours
 */
export function updateFloodHubGaugesGeoJsonPaint(map, config, selectedHours) {
  if (!map.getLayer(FLOOD_HUB_GAUGES_GEOJSON_LAYER)) return;
  const p = getFloodHubGaugeCirclePaint(config, selectedHours);
  map.setPaintProperty(FLOOD_HUB_GAUGES_GEOJSON_LAYER, 'circle-color', p['circle-color']);
  map.setPaintProperty(FLOOD_HUB_GAUGES_GEOJSON_LAYER, 'circle-opacity', p['circle-opacity']);
  map.setPaintProperty(FLOOD_HUB_GAUGES_GEOJSON_LAYER, 'circle-radius', p['circle-radius']);
  map.setPaintProperty(
    FLOOD_HUB_GAUGES_GEOJSON_LAYER,
    'circle-stroke-width',
    p['circle-stroke-width']
  );
  map.setPaintProperty(
    FLOOD_HUB_GAUGES_GEOJSON_LAYER,
    'circle-stroke-color',
    p['circle-stroke-color']
  );
}

/**
 * Prefer GeoJSON overview when present; hide sparse MVT gauge layer.
 * @param {import('mapbox-gl').Map} map
 * @param {boolean} geoJsonActive
 */
export function setFloodHubMvtGaugeLayerFallbackVisibility(map, geoJsonActive) {
  const mvtVis = geoJsonActive ? 'none' : 'visible';
  try {
    if (map.getLayer('hex-l10')) map.setLayoutProperty('hex-l10', 'visibility', mvtVis);
  } catch {
    /* ignore */
  }
  try {
    if (map.getLayer('hex-l10-outline'))
      map.setLayoutProperty('hex-l10-outline', 'visibility', mvtVis);
  } catch {
    /* ignore */
  }
}
