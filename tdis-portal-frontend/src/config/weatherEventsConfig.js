/**
 * @fileoverview Active Weather Events map config: default selected events, layer IDs.
 * Used by Map/useWeatherEventsMap and mapService for consistency.
 */

/** Default selected event types (display names) for the map legend */
export const DEFAULT_SELECTED_EVENTS = ['Wildfire', 'Rainfall', 'High wind', 'Earthquake', 'Hail'];

/** Layer IDs used by mapService for event map (for reference / tests) */
export const WEATHER_EVENT_LAYER_IDS = {
  source: 'all-events',
  unclusteredPoints: 'all-unclustered-points',
  eventPetals: 'event-petals-layer',
  outlineLine: 'outline-layer-line',
};
