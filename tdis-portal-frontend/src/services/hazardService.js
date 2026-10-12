/**
 * Weather hazard API service for TDIS Portal.
 * Fetches hazard subtype breakdown by county (GET /weather-hazard/by-county) for county click popup.
 */

import {
  buildPortalApiHeaders,
  getPortalApiBaseUrl,
  getPortalApiUrl,
} from '../config/portalApiConfig';

async function httpGet(path) {
  const url = getPortalApiUrl(path);
  const res = await fetch(url, { headers: buildPortalApiHeaders() });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GET ${new URL(url).pathname} failed: ${res.status} ${text}`);
  }
  return res.json();
}

/**
 * Fetch weather hazard subtype breakdown for a county.
 * Used for county click popup: Subtype and alert_count per row.
 * @param {string} countyName - County name (e.g. "Harris County")
 * @returns {Promise<{ county_name: string, rows: Array<{ subtype: string, alert_count: number }> }>}
 */
export async function getWeatherHazardByCounty(countyName) {
  if (!countyName || typeof countyName !== 'string') {
    return { county_name: countyName || '', rows: [] };
  }
  if (!getPortalApiBaseUrl()) {
    console.error(
      'Error fetching weather hazard by county:',
      new Error('Portal API not configured')
    );
    return { county_name: countyName, rows: [] };
  }
  try {
    const path = `/weather-hazard/by-county?county_name=${encodeURIComponent(countyName.trim())}`;
    const response = await httpGet(path);
    return {
      county_name: response?.county_name ?? countyName,
      rows: Array.isArray(response?.rows) ? response.rows : [],
    };
  } catch (error) {
    console.error('Error fetching weather hazard by county:', error);
    return { county_name: countyName, rows: [] };
  }
}
