/**
 * @fileoverview OSA data transformers: API response to component format.
 */

/** Default center for Texas */
const TEXAS_CENTER = [-99.1332, 31.9686];

/**
 * Get center coordinates for a location (placeholder; can be extended with geocode/lookup).
 * @param {string} [_name] - Location name (reserved for future geocode/lookup)
 * @param {string} [_type] - 'county' | 'zip' | 'utility' (reserved for future use)
 * @returns {[number, number]} [lng, lat]
 */
export const getCenterCoordinates = (_name, _type) => {
  return TEXAS_CENTER;
};

/**
 * Transform power outage counties API response to component format.
 * @param {Array} apiData - Raw API response
 * @returns {Array}
 */
export const transformCountyData = (apiData) => {
  if (!Array.isArray(apiData)) {
    console.warn('transformCountyData: apiData is not an array', apiData);
    return [];
  }
  return apiData.map((item) => ({
    name: item.CountyName || 'Unknown County',
    customersOut: item.CustomersOut || 0,
    outageCount: 0,
    center: getCenterCoordinates(item.CountyName, 'county'),
    ...item,
  }));
};

/**
 * Transform power outage zips API response to component format.
 * @param {Array} apiData - Raw API response
 * @returns {Array}
 */
export const transformZipData = (apiData) => {
  if (!Array.isArray(apiData)) {
    console.warn('transformZipData: apiData is not an array', apiData);
    return [];
  }
  return apiData.map((item) => ({
    name: item.ZCTA5CE20 || 'Unknown Zip',
    customersOut: item.total_customers_out || 0,
    outageCount: 0,
    center: (() => {
      const lon = Number(item.centroid_lon ?? item.centroidLon);
      const lat = Number(item.centroid_lat ?? item.centroidLat);
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
        return getCenterCoordinates(item.ZCTA5CE20, 'zip');
      }
      return [lon, lat];
    })(),
    centroid_lon: item.centroid_lon ?? item.centroidLon ?? null,
    centroid_lat: item.centroid_lat ?? item.centroidLat ?? null,
    ...item,
  }));
};

/**
 * Transform power outage utilities API response to component format.
 * @param {Array} apiData - Raw API response
 * @returns {Array}
 */
export const transformUtilityData = (apiData) => {
  if (!Array.isArray(apiData)) {
    console.warn('transformUtilityData: apiData is not an array', apiData);
    return [];
  }
  return apiData.map((item) => ({
    name: item.UtilityName || 'Unknown Utility',
    customersOut: item.CustomersOut || 0,
    outageCount: 0,
    center: getCenterCoordinates(item.UtilityName, 'utility'),
    ...item,
  }));
};
