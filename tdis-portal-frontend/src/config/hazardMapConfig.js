/** Hazard codes accepted by the TDIS AI `/api/hazard-hexes/{code}` endpoint. */
export const HAZARD_METRICS = [
  { value: 'RFLD', label: 'Riverine Flood' },
  { value: 'CFLD', label: 'Coastal Flood' },
  { value: 'HRCN', label: 'Hurricane' },
  { value: 'WFIR', label: 'Wildfire' },
  { value: 'TRND', label: 'Tornado' },
  { value: 'HWAV', label: 'Heat Wave' },
];

export const HAZARD_METRIC_LABELS = Object.fromEntries(
  HAZARD_METRICS.map((m) => [m.value, m.label])
);

export const DEFAULT_HAZARD_METRIC = 'HRCN';

/** TDIS AI FastAPI host that serves `/api/hazard-hexes/{code}`. */
export const TDIS_AI_HAZARD_API_ORIGIN = 'https://api-tdis-ai.dev.cloud.tdis.io';

function stripTrailingSlashes(value) {
  while (value.endsWith('/')) value = value.slice(0, -1);
  return value;
}

function isHttpsApiBase(raw) {
  return /^https:\/\/.+/i.test(raw) && !raw.includes('$(');
}

/** Local FastAPI over plain http, e.g. http://127.0.0.1:8000 — dev only. */
function isLoopbackApiBase(raw) {
  return /^http:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/i.test(raw);
}

function isUsableApiBase(raw) {
  return isHttpsApiBase(raw) || isLoopbackApiBase(raw);
}

/**
 * Base URL for hazard-hex requests (no trailing slash).
 * Prefer VITE_HAZARD_MAP_API_BASE, then VITE_AI_API_URL, then the TDIS AI host.
 * Loopback http bases are accepted so the local hazard API can be tested.
 */
export function getHazardMapApiBase() {
  const candidates = [
    import.meta.env.VITE_HAZARD_MAP_API_BASE,
    import.meta.env.VITE_AI_API_URL,
  ];
  for (const candidate of candidates) {
    const base = stripTrailingSlashes(candidate?.trim() ?? '');
    if (base && isUsableApiBase(base)) return base;
  }
  return TDIS_AI_HAZARD_API_ORIGIN;
}
