import { getHazardMapApiBase } from '@/config/hazardMapConfig';

/** @type {Map<string, { metric: string, count: number, hexes: Array<Record<string, unknown>> }>} */
const responseCache = new Map();

const normalizeHexId = (hexId) => {
  if (typeof hexId === 'string') return hexId;
  if (typeof hexId === 'number' || typeof hexId === 'bigint') return String(hexId);
  return null;
};

/** The API sends "" for hexes with no county attribution. */
const normalizeCounty = (county) => {
  if (typeof county !== 'string') return null;
  const trimmed = county.trim();
  return trimmed === '' ? null : trimmed;
};

/**
 * Normalize the columnar hazard API payload to the AI map record shape.
 * @param {{ hex?: unknown[], risk?: unknown[], pop?: unknown[], county?: unknown[] }|undefined} payload
 * @returns {Array<Record<string, unknown>>}
 */
export function normalizeHazardHexes(payload) {
  if (!Array.isArray(payload?.hex)) return [];
  return payload.hex
    .map((hexId, index) => {
      const normalizedHexId = normalizeHexId(hexId);
      if (!normalizedHexId) return null;
      const risk = payload.risk?.[index] ?? null;
      const population = payload.pop?.[index] ?? null;
      return {
        hex_id: normalizedHexId,
        value: risk,
        risk,
        population,
        county: normalizeCounty(payload.county?.[index]),
      };
    })
    .filter(Boolean);
}

/**
 * Fetch hazard hexes from the authenticated TDIS AI endpoint.
 * @param {{ metric: string, token: string }} opts
 */
export async function fetchHazardMap({ metric, token } = {}) {
  if (!metric) {
    throw new Error('Hazard metric is required');
  }
  const parsedToken = typeof token === 'string' ? token.trim() : '';
  if (!parsedToken) {
    throw new Error('Missing access token');
  }

  const hazardCode = metric.toUpperCase();
  const cacheKey = hazardCode;
  if (responseCache.has(cacheKey)) {
    return responseCache.get(cacheKey);
  }

  const url = `${getHazardMapApiBase()}/api/hazard-hexes/${encodeURIComponent(hazardCode)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${parsedToken}`,
    },
  });
  if (!res.ok) {
    let message = `Hazard map request failed (${res.status})`;
    try {
      const errorPayload = await res.json();
      if (typeof errorPayload?.message === 'string' && errorPayload.message.trim()) {
        message = errorPayload.message;
      }
    } catch {
      // Keep the status-based message when the response is not JSON.
    }
    throw new Error(message);
  }

  const data = await res.json();
  const normalized = {
    metric: data.hazard || hazardCode,
    count: data.count ?? (data.hex?.length ?? 0),
    hexes: normalizeHazardHexes(data),
  };
  responseCache.set(cacheKey, normalized);
  return normalized;
}

/** Clear in-memory cache (tests / metric refresh). */
export function clearHazardMapCache() {
  responseCache.clear();
}
