/**
 * Client for the TDIS Ignition BIT model API (tdis-ignition-api).
 * Base URL comes from VITE_IGNITION_API_URL (defaults to the local dev server).
 */

const BASE_URL = (import.meta.env.VITE_IGNITION_API_URL || 'http://localhost:8001').replace(/\/$/, '');
const PREFIX = `${BASE_URL}/api/v1/ignition`;

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Ignition API ${res.status}: ${await res.text().catch(() => res.statusText)}`);
  }
  return res.json();
}

export const getIgnitionDates = () => getJson(`${PREFIX}/dates`);

export const getIgnitionHexes = (date) =>
  getJson(`${PREFIX}/hexes${date ? `?date=${encodeURIComponent(date)}` : ''}`);

/**
 * Hexagons at H3 resolution `res` (4-8). `window` = [west, south, east, north] limits the result to
 * that area; the API requires it from resolution 7 up.
 */
export const getIgnitionCoverage = (date, res = 5, window = null) =>
  getJson(
    `${PREFIX}/coverage?res=${res}` +
      (date ? `&date=${encodeURIComponent(date)}` : '') +
      (window ? `&bbox=${window.map((v) => v.toFixed(4)).join(',')}` : '')
  );

export const getIgnitionModelInfo = () => getJson(`${PREFIX}/model-info`);
