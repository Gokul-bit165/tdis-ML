/**
 * @fileoverview Single portal REST API base for HMED, LTS, events, hazards, power outage, Flood Hub, etc.
 * AI (`VITE_AI_API_URL` / `VITE_TDIS_AI_API_URL`) and map tiles (`VITE_TILE_SERVER_BASE_URL`) stay separate.
 */

/**
 * @param {string} [raw]
 * @returns {string}
 */
export function normalizePortalApiBaseUrl(raw) {
  let s = (raw || '').trim();
  while (s.endsWith('/')) s = s.slice(0, -1);
  return s;
}

/**
 * Portal API root including `/api/v1` when applicable (e.g. `VITE_API_URL`).
 * @returns {string}
 */
export function getPortalApiBaseUrl() {
  const primary = normalizePortalApiBaseUrl(import.meta.env.VITE_API_URL);
  if (primary) return primary;

  /** @deprecated Use `VITE_API_URL` only; kept for older `.env` files. */
  const legacy = normalizePortalApiBaseUrl(import.meta.env.VITE_EVENTS_API_URL);
  if (legacy) return legacy;

  return '';
}

/** Resolved once at module load; use `getPortalApiBaseUrl()` if you need fresh env in tests. */
export const PORTAL_API_BASE_URL = getPortalApiBaseUrl();

/**
 * API key for portal REST (`X-API-Key`).
 * @returns {string}
 */
export function getPortalApiKey() {
  return (import.meta.env.VITE_PORTAL_API_KEY || import.meta.env.VITE_EVENTS_API_KEY || '').trim();
}

/**
 * @param {Record<string, string>} [extra]
 * @returns {Record<string, string>}
 */
export function buildPortalApiHeaders(extra = {}) {
  const headers = { 'Content-Type': 'application/json', ...extra };
  const key = getPortalApiKey();
  if (key) headers['X-API-Key'] = key;
  return headers;
}

/**
 * @param {string} path - Path under the portal API root (e.g. `/events/`).
 * @param {Record<string, string | number | boolean | undefined | null>} [searchParams]
 * @returns {string}
 */
export function getPortalApiUrl(path, searchParams) {
  const base = getPortalApiBaseUrl();
  if (!base) {
    throw new Error('Portal API not configured. Set VITE_API_URL in your .env');
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${base}${normalizedPath}`);
  if (searchParams) {
    Object.entries(searchParams).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
  }
  return url.toString();
}
