/**
 * LTS Flash Flood HMED widgets (`/lts-flash-flood/*`).
 * Uses the same portal API as events, hazards, and Flood Hub (`VITE_API_URL`).
 * Optional `VITE_LTS_API_URL` overrides only LTS calls (local debugging).
 */

import {
  buildPortalApiHeaders,
  getPortalApiBaseUrl,
  normalizePortalApiBaseUrl,
} from '../config/portalApiConfig';

const BASE_URL = (() => {
  const ltsOverride = normalizePortalApiBaseUrl(import.meta.env.VITE_LTS_API_URL);
  if (ltsOverride) return ltsOverride;
  return getPortalApiBaseUrl();
})();

/** Counties list widget: include only LTS 4–5 (Potentially High / Potentially Very High) when passed to `getLtsCounties`. */
export const LTS_COUNTY_LIST_MIN_LTS_LEVEL = 4;

async function httpGet(path, params) {
  if (!BASE_URL) {
    throw new Error(
      'LTS API base URL missing: set VITE_API_URL for production builds, or VITE_LTS_API_URL to override.'
    );
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${BASE_URL}${normalizedPath}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
  }
  const res = await fetch(url.toString(), { headers: buildPortalApiHeaders() });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`LTS API ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

/**
 * Aggregated potential impact for counties at or above min_lts_level (latest run).
 * @param {number} [minLtsLevel=4]
 * @returns {Promise<object>}
 */
export async function getLtsExposureSummary(minLtsLevel = 4) {
  return httpGet('/lts-flash-flood/exposure-summary', {
    min_lts_level: minLtsLevel,
  });
}

/**
 * County rows for latest LTS run.
 * @param {object} [options]
 * @param {string} [options.countyfips] Comma-separated 5-digit FIPS (API `countyfips` query).
 * @param {number} [options.min_lts_level] Only counties with lts_level >= this (e.g. 4 = two hotspot tiers).
 * @returns {Promise<{ counties: object[], total: number, job_id?: string, run_date?: string }>}
 */
export async function getLtsCounties(options = {}) {
  const { countyfips, min_lts_level } = options;
  const params = {};
  if (countyfips) params.countyfips = countyfips;
  if (min_lts_level != null) params.min_lts_level = min_lts_level;
  return httpGet('/lts-flash-flood/counties', Object.keys(params).length ? params : undefined);
}
