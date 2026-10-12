/**
 * @fileoverview RAMP points-of-interest GeoJSON for critical facilities (schools, hospitals, fire stations).
 * Statewide: RAMP requires ?county= or ?city=, so we fetch all TX counties and merge.
 * Counties with no POIs return 404 "No matching data" — treated as empty, not a hard failure.
 */

import {
  CRITICAL_FACILITY_COUNTY_FETCH_CONCURRENCY,
  CRITICAL_FACILITY_LAYERS,
  getCriticalFacilityAreaFilter,
  normalizeRampCountyFips,
} from '../config/criticalFacilitiesConfig';
import { buildRampApiHeaders, getRampApiRoot, getRampApiUrl } from '../config/rampApiConfig';
import { TEXAS_COUNTY_FIPS } from '../data/texasCountyFips';

/** @returns {import('geojson').FeatureCollection} */
export function emptyFacilityCollection() {
  return { type: 'FeatureCollection', features: [] };
}

/**
 * @param {unknown} data
 * @returns {import('geojson').FeatureCollection}
 */
export function normalizeCriticalFacilityGeoJson(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Critical facility response was not JSON');
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
  throw new Error('Critical facility response was not a GeoJSON FeatureCollection');
}

/**
 * @param {import('geojson').FeatureCollection} collection
 * @returns {import('geojson').FeatureCollection}
 */
export function filterCriticalFacilityPoints(collection) {
  const features = [];
  for (const f of collection.features || []) {
    if (!f?.geometry) continue;
    if (f.geometry.type === 'Point' && Array.isArray(f.geometry.coordinates)) {
      features.push(f);
      continue;
    }
    if (
      f.geometry.type === 'MultiPoint' &&
      Array.isArray(f.geometry.coordinates) &&
      f.geometry.coordinates[0]
    ) {
      features.push({
        ...f,
        geometry: { type: 'Point', coordinates: f.geometry.coordinates[0] },
      });
    }
  }
  return { type: 'FeatureCollection', features };
}

/**
 * @param {import('geojson').FeatureCollection[]} parts
 * @returns {import('geojson').FeatureCollection}
 */
export function mergeFeatureCollections(parts) {
  const features = [];
  for (const part of parts) {
    if (part?.features?.length) features.push(...part.features);
  }
  return { type: 'FeatureCollection', features };
}

/**
 * @template T
 * @param {T[]} items
 * @param {number} concurrency
 * @param {(item: T, index: number) => Promise<unknown>} fn
 * @returns {Promise<unknown[]>}
 */
export async function mapWithConcurrency(items, concurrency, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * @param {string} geoJsonPath
 * @param {'county' | 'city'} areaType
 * @param {string} areaId
 * @returns {string}
 */
export function buildCriticalFacilityGeoJsonUrl(geoJsonPath, areaType, areaId) {
  return getRampApiUrl(geoJsonPath, { [areaType]: areaId });
}

/**
 * @param {import('../config/criticalFacilitiesConfig').CriticalFacilityId} facilityId
 * @returns {string}
 */
export function getCriticalFacilityGeoJsonUrl(facilityId) {
  const layer = CRITICAL_FACILITY_LAYERS.find((l) => l.id === facilityId);
  if (!layer?.geoJsonPath) {
    throw new Error(`Unknown critical facility id: ${facilityId}`);
  }
  const area = getCriticalFacilityAreaFilter();
  if (!area) {
    throw new Error(
      'No single-area filter set; use fetchCriticalFacilityGeoJson for statewide merge'
    );
  }
  return buildCriticalFacilityGeoJsonUrl(layer.geoJsonPath, area.areaType, area.areaId);
}

/**
 * True when RAMP has no POIs for that county (normal), not a missing route.
 * @param {number} status
 * @param {string} body
 */
export function isEmptyCountyNotFound(status, body) {
  if (status !== 404) return false;
  return /No matching data for this county/i.test(body || '');
}

/**
 * True when the POI route itself does not exist on RAMP.
 * @param {number} status
 * @param {string} body
 */
export function isMissingRouteNotFound(status, body) {
  if (status !== 404) return false;
  return /Cannot GET/i.test(body || '');
}

/**
 * @param {string} url
 * @returns {Promise<import('geojson').FeatureCollection>}
 */
async function fetchGeoJsonUrl(url) {
  const headers = buildRampApiHeaders();
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (isEmptyCountyNotFound(res.status, text)) {
      return emptyFacilityCollection();
    }
    throw new Error(`GET failed: ${res.status} ${text}`.trim());
  }
  const data = await res.json();
  return filterCriticalFacilityPoints(normalizeCriticalFacilityGeoJson(data));
}

/**
 * @param {import('../config/criticalFacilitiesConfig').CriticalFacilityId} facilityId
 * @returns {Promise<import('geojson').FeatureCollection>}
 */
export async function fetchCriticalFacilityGeoJson(facilityId) {
  if (!getRampApiRoot()) {
    throw new Error('RAMP API not configured. Set VITE_RAMP_API_ROOT in your .env');
  }
  const layer = CRITICAL_FACILITY_LAYERS.find((l) => l.id === facilityId);
  if (!layer?.geoJsonPath) {
    throw new Error(`Unknown critical facility id: ${facilityId}`);
  }

  const single = getCriticalFacilityAreaFilter();
  if (single) {
    const url = buildCriticalFacilityGeoJsonUrl(layer.geoJsonPath, single.areaType, single.areaId);
    if (import.meta.env.DEV) {
      console.info(`[Critical facilities] Loading ${facilityId}:`, url);
    }
    return fetchGeoJsonUrl(url);
  }

  const countyIds = TEXAS_COUNTY_FIPS.map((fips) => normalizeRampCountyFips(fips));
  if (import.meta.env.DEV) {
    console.info(
      `[Critical facilities] Loading ${facilityId} from ${layer.geoJsonPath} (${countyIds.length} counties)…`
    );
  }

  let routeMissing = false;
  let unexpectedFailCount = 0;

  const parts = await mapWithConcurrency(
    countyIds,
    CRITICAL_FACILITY_COUNTY_FETCH_CONCURRENCY,
    async (countyId) => {
      if (routeMissing) return emptyFacilityCollection();
      try {
        const url = buildCriticalFacilityGeoJsonUrl(layer.geoJsonPath, 'county', countyId);
        return await fetchGeoJsonUrl(url);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (isMissingRouteNotFound(404, msg) || (/Cannot GET/i.test(msg) && /\b404\b/.test(msg))) {
          routeMissing = true;
          return emptyFacilityCollection();
        }
        unexpectedFailCount += 1;
        return emptyFacilityCollection();
      }
    }
  );

  if (routeMissing) {
    throw new Error(
      `Critical facilities ${facilityId}: RAMP route not found (${layer.geoJsonPath})`
    );
  }
  if (import.meta.env.DEV && unexpectedFailCount > 0) {
    console.warn(
      `[Critical facilities] ${facilityId}: ${unexpectedFailCount} unexpected county errors (empty counties are OK)`
    );
  }

  return mergeFeatureCollections(/** @type {import('geojson').FeatureCollection[]} */ (parts));
}
