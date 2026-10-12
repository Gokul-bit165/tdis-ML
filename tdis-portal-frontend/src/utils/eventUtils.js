/**
 * Filters GeoJSON features by event type
 * @param {Object} geojson - The GeoJSON data containing event features
 * @param {string} eventType - The type of event to filter for
 * @returns {Object} A new GeoJSON FeatureCollection with filtered features
 */
export function filterEventsByType(geojson, eventType) {
  return {
    type: 'FeatureCollection',
    features: geojson.features.filter((f) => f.properties.eventType === eventType),
  };
}

/**
 * Available event types in the application
 */
export const EVENT_TYPES = {
  FIRE: 'fire',
  FLOOD: 'flood',
  HIGH_WIND: 'high wind',
  THUNDERSTORM: 'thunderstorm',
  HURRICANE: 'hurricane',
  HAIL: 'hail',
};
