/**
 * @fileoverview Bulk GeoJSON fetch for Flood Hub gauges (Texas-wide overview on map load).
 * Vector tiles alone drop most features at low zoom; this endpoint returns every gauge point.
 */

import { TEXAS_BOUNDS } from '../config/mapConfig';
import { LAYER_CONFIG } from '../config/hmedLayerConfig';
import {
  buildPortalApiHeaders,
  getPortalApiBaseUrl,
  getPortalApiUrl,
} from '../config/portalApiConfig';

/**
 * Resolved URL for the gauges overview GeoJSON (FeatureCollection of Points).
 * Override with `VITE_FLOOD_HUB_GAUGES_GEOJSON_URL` (full URL) when needed.
 * @returns {string}
 */
export function getFloodHubGaugesGeoJsonUrl() {
  const explicit = (import.meta.env.VITE_FLOOD_HUB_GAUGES_GEOJSON_URL || '').trim();
  if (explicit) return explicit;

  const path = LAYER_CONFIG.google_flood_hub?.floodHubGaugesGeoJsonPath || '/flood-hub/gauges';
  const [sw, ne] = TEXAS_BOUNDS;
  return getPortalApiUrl(path, {
    bbox: `${sw[0]},${sw[1]},${ne[0]},${ne[1]}`,
  });
}

/**
 * @param {unknown} data
 * @returns {import('geojson').FeatureCollection}
 */
export function normalizeFloodHubGaugesGeoJson(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Flood Hub gauges response was not JSON');
  }
  const root = /** @type {Record<string, unknown>} */ (data);
  if (root.type === 'FeatureCollection' && Array.isArray(root.features)) {
    return /** @type {import('geojson').FeatureCollection} */ (root);
  }
  if (Array.isArray(root.features)) {
    return {
      type: 'FeatureCollection',
      features: /** @type {import('geojson').Feature[]} */ (root.features),
    };
  }
  if (Array.isArray(root.data)) {
    return {
      type: 'FeatureCollection',
      features: /** @type {import('geojson').Feature[]} */ (root.data),
    };
  }
  if (Array.isArray(data)) {
    return {
      type: 'FeatureCollection',
      features: /** @type {import('geojson').Feature[]} */ (data),
    };
  }
  throw new Error('Flood Hub gauges response was not a GeoJSON FeatureCollection');
}

/**
 * Fetch all Texas gauge points for the map overview layer.
 * @returns {Promise<import('geojson').FeatureCollection>}
 */
export async function fetchFloodHubGaugesGeoJson() {
  if (!getPortalApiBaseUrl()) {
    throw new Error('Portal API not configured. Set VITE_API_URL in your .env');
  }
  const url = getFloodHubGaugesGeoJsonUrl();
  const headers = buildPortalApiHeaders({ Accept: 'application/geo+json, application/json' });

  if (import.meta.env.DEV) {
    console.info('[Flood Hub] Loading gauge overview:', url);
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Flood Hub gauges GET failed: ${res.status} ${text}`.trim());
  }
  const data = await res.json();
  const collection = normalizeFloodHubGaugesGeoJson(data);
  const withPoints = collection.features.filter(
    (f) => f.geometry?.type === 'Point' && Array.isArray(f.geometry.coordinates)
  );
  return { type: 'FeatureCollection', features: withPoints };
}
