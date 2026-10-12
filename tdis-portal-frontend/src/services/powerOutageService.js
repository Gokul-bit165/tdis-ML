/**
 * Power Outage API service for TDIS Portal
 * Fetches power outage data from the backend API (`VITE_API_URL`).
 */

import { buildPortalApiHeaders, getPortalApiUrl } from '../config/portalApiConfig';

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
 * Fetch power outage data aggregated by county
 * @returns {Promise<Array>} Array of county power outage data
 */
export async function getPowerOutageCounties() {
  try {
    const response = await httpGet('/power-outage/counties');
    return Array.isArray(response?.counties)
      ? response.counties
      : Array.isArray(response)
        ? response
        : [];
  } catch (error) {
    console.error('Error fetching power outage counties:', error);
    throw error;
  }
}

/**
 * Fetch power outage data aggregated by zip code
 * @returns {Promise<Array>} Array of zip code power outage data
 */
export async function getPowerOutageZips() {
  try {
    const response = await httpGet('/power-outage/zips');
    return Array.isArray(response?.zips) ? response.zips : Array.isArray(response) ? response : [];
  } catch (error) {
    console.error('Error fetching power outage zip codes:', error);
    throw error;
  }
}

/**
 * Fetch power outage data aggregated by utility
 * @returns {Promise<Array>} Array of utility power outage data
 */
export async function getPowerOutageUtilities() {
  try {
    const response = await httpGet('/power-outage/utilities');
    return Array.isArray(response?.utilities)
      ? response.utilities
      : Array.isArray(response)
        ? response
        : [];
  } catch (error) {
    console.error('Error fetching power outage utilities:', error);
    throw error;
  }
}
