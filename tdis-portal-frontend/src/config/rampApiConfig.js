/**
 * RAMP API base URL for points-of-interest (schools / hospitals / fire stations).
 * CI: Key Vault `tdis-dev-ramp-api-root` → `VITE_RAMP_API_ROOT`.
 */

/**
 * @param {string} [raw]
 * @returns {string}
 */
export function normalizeRampApiRoot(raw) {
  let s = (raw || '').trim();
  while (s.endsWith('/')) s = s.slice(0, -1);
  return s;
}

/**
 * @returns {string}
 */
export function getRampApiRoot() {
  return normalizeRampApiRoot(import.meta.env.VITE_RAMP_API_ROOT);
}

/**
 * Optional API key for RAMP (`X-API-Key` or Bearer — sent as X-API-Key when set).
 * @returns {string}
 */
export function getRampApiKey() {
  return (import.meta.env.VITE_RAMP_API_KEY || '').trim();
}

/**
 * @param {Record<string, string>} [extra]
 * @returns {Record<string, string>}
 */
export function buildRampApiHeaders(extra = {}) {
  const headers = { Accept: 'application/geo+json, application/json', ...extra };
  const key = getRampApiKey();
  if (key) headers['X-API-Key'] = key;
  return headers;
}

/**
 * @param {string} path - Path under RAMP API root
 * @param {Record<string, string | number | boolean | undefined | null>} [searchParams]
 * @returns {string}
 */
export function getRampApiUrl(path, searchParams) {
  const base = getRampApiRoot();
  if (!base) {
    throw new Error('RAMP API not configured. Set VITE_RAMP_API_ROOT in your .env');
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${base}${normalizedPath}`);
  if (searchParams) {
    Object.entries(searchParams).forEach(([k, v]) => {
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        url.searchParams.set(k, String(v));
      }
    });
  }
  return url.toString();
}
