/**
 * @file mapRefreshService.js
 * @description Service for refreshing map data without full page reload.
 * Provides functions to update event data, event counts, and map layers.
 */

import { fetchEventCounts } from './eventService';
import { loadEventData } from './mapService';

/**
 * Refreshes all map-related data without full page reload
 * @param {mapboxgl.Map} map - The Mapbox map instance
 * @param {Function} setEventCounts - State setter for event counts
 * @param {Function} setIsEventCountsLoading - State setter for loading status
 * @param {string[]} selectedEvents - Currently selected event types
 */
export async function refreshMapData(map, setEventCounts, setIsEventCountsLoading, selectedEvents) {
  let latestEventDate = null;
  try {
    // Refresh event counts
    await fetchEventCounts(setEventCounts, setIsEventCountsLoading);

    // Refresh map event data
    if (map) {
      const result = await loadEventData(map);
      latestEventDate = result?.latestEventDate ?? null;

      // Re-apply event type filtering after refresh
      if (selectedEvents && selectedEvents.length > 0) {
        // Import the function dynamically to avoid circular dependencies
        const { updateEventLayerVisibility } = await import('./mapService');
        updateEventLayerVisibility(map, selectedEvents);
      }
    }
  } catch (error) {
    console.error('Error refreshing map data:', error);
  }
  return { latestEventDate };
}
