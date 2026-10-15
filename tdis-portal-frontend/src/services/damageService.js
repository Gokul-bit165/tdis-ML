/**
 * Client for the TDIS Damage Assessment API (tdis-damage-api).
 * Base URL comes from VITE_DAMAGE_API_URL (defaults to http://localhost:8002).
 */

const BASE_URL = (import.meta.env.VITE_DAMAGE_API_URL || 'http://localhost:8002').replace(/\/$/, '');
const PREFIX = `${BASE_URL}/api/v1/damage`;

async function getJson(url, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    const errorText = await res.text().catch(() => res.statusText);
    const error = new Error(`Damage API ${res.status}: ${errorText}`);
    error.status = res.status;
    throw error;
  }
  return res.json();
}

/**
 * Fetch list of published damage assessments.
 * @param {AbortSignal} [signal]
 * @returns {Promise<Array>}
 */
export const getDamageAssessments = (signal) => getJson(`${PREFIX}/assessments`, signal);

/**
 * Fetch detailed record for a specific building footprint within an assessment.
 * @param {number|string} aid Assessment ID
 * @param {string} buildingId Building ID
 * @param {AbortSignal} [signal]
 * @returns {Promise<Object>}
 */
export const getDamageBuilding = (aid, buildingId, signal) =>
  getJson(`${PREFIX}/assessments/${aid}/buildings/${encodeURIComponent(buildingId)}`, signal);

/**
 * Get the MVT tile template URL for Mapbox vector tile sources.
 * @param {number|string} aid Assessment ID
 * @param {'h3'|'buildings'|'density'} layer Layer name
 * @returns {string} Tile URL template with {z}/{x}/{y}.mvt
 */
export const damageTileUrl = (aid, layer) =>
  `${PREFIX}/tiles/${aid}/${layer}/{z}/{x}/{y}.mvt`;
