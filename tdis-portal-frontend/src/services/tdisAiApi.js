const DEFAULT_TDIS_AI_API_BASE_PROD = 'https://api-tdis-ai.dev.cloud.tdis.io';

function stripTrailingSlashes(value) {
  while (value.endsWith('/')) value = value.slice(0, -1);
  return value;
}

function isValidAiApiBaseUrl(raw) {
  return /^https:\/\/.+/i.test(raw) && !raw.includes('$(');
}

function resolveTdisAiApiBase() {
  if (import.meta.env.DEV) return '';
  const fromCi =
    typeof import.meta.env.VITE_AI_API_URL === 'string'
      ? import.meta.env.VITE_AI_API_URL.trim()
      : '';
  if (fromCi && isValidAiApiBaseUrl(fromCi)) return stripTrailingSlashes(fromCi);
  const legacy =
    typeof import.meta.env.VITE_TDIS_AI_API_URL === 'string'
      ? import.meta.env.VITE_TDIS_AI_API_URL.trim()
      : '';
  if (legacy && isValidAiApiBaseUrl(legacy)) return stripTrailingSlashes(legacy);
  return DEFAULT_TDIS_AI_API_BASE_PROD;
}

const API_BASE_URL = resolveTdisAiApiBase();

function buildUrl(path, params) {
  const url = API_BASE_URL
    ? new URL(`${API_BASE_URL}${path}`)
    : new URL(path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url;
}

async function parseResponse(response) {
  if (response.status === 204) return null;

  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function buildErrorMessage(status, payload) {
  if (payload && typeof payload === 'object') {
    if (typeof payload.message === 'string' && payload.message.trim()) return payload.message;
    if (typeof payload.detail === 'string' && payload.detail.trim()) return payload.detail;
    if (typeof payload.error === 'string' && payload.error.trim()) return payload.error;
  }
  if (typeof payload === 'string' && payload.trim()) return payload;
  return `Request failed (${status})`;
}

export async function tdisAiRequest(token, path, options = {}) {
  const parsedToken = typeof token === 'string' ? token.trim() : '';
  if (!parsedToken) {
    throw new Error('Missing access token');
  }

  const response = await fetch(buildUrl(path, options.params).toString(), {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${parsedToken}`,
      'Content-Type': 'application/json',
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const payload = await parseResponse(response);
  if (!response.ok) {
    throw new Error(buildErrorMessage(response.status, payload));
  }
  return payload;
}

export function getListItems(payload, keys = []) {
  if (Array.isArray(payload)) return payload;
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

export function getTotalCount(payload, fallbackLength = 0) {
  return Number(payload?.total ?? payload?.count ?? payload?.total_count ?? fallbackLength);
}
