import { get24HourRollingWindow } from '../utils/dateUtils';
import { getCountsByType, getEvents } from './apiClient';

/**
 * Fetches event counts from the Cube.js backend (Events + HurricaneEvent)
 * @param {Function} setEventCounts - State setter for event counts
 * @param {Function} setIsEventCountsLoading - State setter for loading status
 */
export async function fetchEventCounts(setEventCounts, setIsEventCountsLoading) {
  setIsEventCountsLoading(true);
  try {
    const [fromIso, toIso] = get24HourRollingWindow();
    const data = await getCountsByType(fromIso, toIso);
    const normalized = (Array.isArray(data) ? data : []).map((row) => ({
      type: String(row.eventType || '').toLowerCase(),
      count: Number(row.count || 0),
    }));
    setEventCounts(normalized);
  } catch (error) {
    console.error('Failed to fetch event counts:', error);
    setEventCounts([]);
  } finally {
    setIsEventCountsLoading(false);
  }
}

/**
 * Fetches event data from Cube.js for map display (Events + HurricaneEvent)
 * @returns {Promise<Object>} GeoJSON data for map display
 */
export async function fetchEventData() {
  const [fromIso, toIso] = get24HourRollingWindow();
  const events = await getEvents(fromIso, toIso);
  let latestEventDateStr = null;
  let latestEventDate = null;

  const features = (events || [])
    .map((e) => ({
      type: 'Feature',
      geometry:
        e.geometry && e.geometry.type && Array.isArray(e.geometry.coordinates)
          ? e.geometry
          : {
              type: 'Point',
              coordinates: [e.longitude, e.latitude],
            },
      properties: {
        // Keep existing props used by the UI
        eventType: String(e.event_type || '').toLowerCase(),
        county: e.county,
        icon: String(e.event_type || '').toLowerCase(),
        eventDate: e.event_date,
        description:
          typeof e.description === 'string' ? e.description : JSON.stringify(e.description ?? ''),
        // Add additional props to preserve full context
        eventStoreId: e.event_store_id,
        createdAt: e.created_at,
        eventCount: e.event_count,
      },
    }))
    .map((feature) => {
      const eventDateStr = feature?.properties?.eventDate;
      if (eventDateStr) {
        const eventDate = new Date(eventDateStr);
        if (!latestEventDate || eventDate > latestEventDate) {
          latestEventDate = eventDate;
          latestEventDateStr = eventDateStr;
        }
      }
      return feature;
    });

  if (!features.length) {
    return { geojson: null, latestEventDate: latestEventDateStr };
  }

  return {
    geojson: { type: 'FeatureCollection', features },
    latestEventDate: latestEventDateStr,
  };
}
