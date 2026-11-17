/**
 * Reads the Drainage Monitoring files (drone-survey defects) straight from Blob Storage — no API or database.
 * The files are made by tdis-drainage/prepare_drainage.py and uploaded in the Azure portal.
 * Base URL: VITE_DRAINAGE_DATA_URL, the folder holding manifest.json (local default: tdis-drainage/serve_local.mjs).
 */

const BASE_URL = (import.meta.env.VITE_DRAINAGE_DATA_URL || 'http://localhost:8003').replace(
  /\/+$/,
  ''
);

async function getJson(url, signal, init = {}) {
  let res;
  try {
    res = await fetch(url, { ...init, signal });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    // Network down, or the storage account's CORS rule does not list this site.
    throw new Error('Drainage data could not be loaded (network or CORS). Please try again later.');
  }
  if (!res.ok) {
    throw new Error(`Drainage data ${res.status}: ${await res.text().catch(() => res.statusText)}`);
  }
  return res.json();
}

/** File URL tagged with the survey version, so a browser never mixes files from two uploads. */
const fileUrl = (manifest, name) => `${BASE_URL}/${name}?v=${encodeURIComponent(manifest.version)}`;

/**
 * Current survey: name, publish time, data source, bbox, defect count per class and the outline tiles.
 * Never cached, so a new upload shows up on the next page load.
 */
export const getDrainageSummary = (signal) =>
  getJson(`${BASE_URL}/manifest.json`, signal, { cache: 'no-store' });

/** Every defect as a GeoJSON point (properties: category, area). */
export const getDrainagePoints = (manifest, signal) =>
  getJson(fileUrl(manifest, 'points.geojson'), signal);

/** Outline tiles ([x, y] indexes) of the survey that overlap bbox = [west, south, east, north]. */
export function tilesInView(manifest, bbox) {
  const size = manifest.cell_deg;
  const [w, s, e, n] = bbox;
  return (manifest.cells ?? []).filter(
    ([x, y]) =>
      x >= Math.floor(w / size) &&
      x <= Math.floor(e / size) &&
      y >= Math.floor(s / size) &&
      y <= Math.floor(n / size)
  );
}

// Tiles already downloaded (or downloading), by URL; a survey has at most a few dozen small tiles.
const tileCache = new Map();

function getTile(manifest, [x, y]) {
  const url = fileUrl(manifest, `polygons_${x}_${y}.geojson`);
  if (!tileCache.has(url)) {
    // Not tied to one view's AbortSignal: a tile is reused by later views, so let it finish.
    const pending = getJson(url).catch((e) => {
      tileCache.delete(url);
      throw e;
    });
    tileCache.set(url, pending);
  }
  return tileCache.get(url);
}

/** Defect outlines in bbox = [west, south, east, north], from the overlapping tiles. */
export async function getDrainagePolygons(manifest, bbox, signal) {
  const tiles = await Promise.all(tilesInView(manifest, bbox).map((t) => getTile(manifest, t)));
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  return { type: 'FeatureCollection', features: tiles.flatMap((fc) => fc.features ?? []) };
}

/** For tests: forget downloaded tiles. */
export const clearDrainageTileCache = () => tileCache.clear();
