import mapboxgl from 'mapbox-gl';
import { fetchEventData } from './eventService';
import { formatEventDate } from '../utils/time';
import { isMapAlive } from '../utils/mapUtils';

const OUTLINE_LAYER_SOURCE_ID = 'outline-layer';
const OUTLINE_LAYER_LINE_ID = 'outline-layer-line';
const ALL_UNCLUSTERED_POINTS_LAYER_ID = 'all-unclustered-points';
const EVENT_PETALS_SOURCE_ID = 'event-petals';
const EVENT_PETALS_LAYER_ID = 'event-petals-layer';
const GEOJSON_FEATURE_COLLECTION_TYPE = 'FeatureCollection';

let originalEventData = null;

/**
 * Loads custom map icons for different event types
 * @param {mapboxgl.Map} map - The Mapbox map instance
 */
export async function loadMapIcons(map) {
  if (!isMapAlive(map)) return;
  const icons = {
    wildfire: '/wildfire.png',
    rainfall: '/rainfall.png',
    ['high wind']: '/high wind.png',
    earthquake: '/earthquake.png',
    hurricane: '/hurricane.png',
    hail: '/hail.png',
  };

  for (const [name, url] of Object.entries(icons)) {
    const hasImage = map.hasImage(name);
    if (!hasImage) {
      await new Promise((resolve, reject) => {
        map.loadImage(url, (err, img) => {
          if (err) {
            console.error('[mapService] Error loading icon:', name, err);
            return reject(err);
          }
          if (!map.hasImage(name)) {
            map.addImage(name, img);
          }
          resolve();
        });
      });
    }
  }
}

/**
 * Loads and displays county polygon outlines
 * @param {mapboxgl.Map} map - The Mapbox map instance
 */
export async function loadPolygonOutlines(map) {
  try {
    // Ensure map is loaded and ready
    if (!map?.loaded()) {
      await new Promise((resolve) => {
        if (map.loaded()) {
          resolve();
        } else {
          map.once('load', resolve);
        }
      });
    }

    // Wait a bit for map to be fully ready
    await new Promise((resolve) => setTimeout(resolve, 100));

    if (!isMapAlive(map)) return;

    const response = await fetch('/tx_counties.geojson');
    const polygonData = await response.json();

    // Check if source exists safely
    let sourceExists = false;
    try {
      sourceExists = !!map.getSource(OUTLINE_LAYER_SOURCE_ID);
    } catch {
      // If getSource throws an error, source doesn't exist
      sourceExists = false;
    }

    if (!sourceExists) {
      map.addSource(OUTLINE_LAYER_SOURCE_ID, {
        type: 'geojson',
        data: polygonData,
      });

      const beforeId = map.getLayer(ALL_UNCLUSTERED_POINTS_LAYER_ID)
        ? ALL_UNCLUSTERED_POINTS_LAYER_ID
        : undefined;
      map.addLayer(
        {
          id: OUTLINE_LAYER_LINE_ID,
          type: 'line',
          source: OUTLINE_LAYER_SOURCE_ID,
          layout: {},
          paint: {
            'line-color': '#334755',
            'line-width': 1,
            'line-opacity': 0.8,
          },
        },
        beforeId
      );
    }
  } catch (error) {
    console.error('Error loading polygon GeoJSON:', error);
  }
}

/**
 * Sets up event listeners for map interactions
 * @param {mapboxgl.Map} map - The Mapbox map instance
 * @param {string} layerId - The ID of the layer to attach listeners to
 *
 * Popup Format:
 * Each event type has a specific popup format:
 * - Wildfire: Shows incident details including name, size, cause, containment, type, and timestamps
 * - Earthquake: Shows magnitude, depth, location, timestamps, and USGS link
 * - Rainfall/High Wind/Hail: Shows date and value(s) with units
 *   - If min_value equals max_value, shows single value
 *   - If different, shows range (min - max)
 *
 * Data Format:
 * - Wildfire: JSON with incident details (incident_name, incident_size, fire_cause, etc.)
 * - Earthquake: JSON with USGS data (magnitude, depth_km, place, timestamps, etc.)
 * - Rainfall/High Wind/Hail: JSON with min_value, max_value, and units
 */
// Global popup instance to prevent multiple popups
let currentPopup = null;

export function setupEventListeners(map, layerId) {
  // Remove existing event listeners for this layer to prevent duplicates
  map.off('click', layerId);
  map.off('mouseenter', layerId);
  map.off('mouseleave', layerId);

  map.on('click', layerId, (e) => {
    // Remove any existing popup
    if (currentPopup) {
      currentPopup.remove();
    }

    const props = e.features[0].properties;
    const icon = props.icon;
    currentPopup = new mapboxgl.Popup()
      .setLngLat(e.lngLat)
      .setHTML(
        `
                <div class="flex gap-3">
                    <img src="/${icon}.png" alt="${icon}" class="w-12 h-12">
                    <div>
                        <p class="font-semibold text-base">${props.eventType.charAt(0).toUpperCase() + props.eventType.slice(1)}</p>
                        ${props.eventType === 'hurricane' ? '' : `<p class="text-[#4B5563] text-[12px]"> <span class="font-semibold">County:</span> ${props.county}</p>`}
                        ${
                          props.description && props.eventType === 'wildfire'
                            ? (() => {
                                try {
                                  const wildfireData = JSON.parse(props.description);
                                  return `
                                    <p class="text-[#4B5563] text-[12px]"> <span class="font-semibold">Discovered:</span> ${formatEventDate(wildfireData.start_time || props.eventDate)}</p>
                                    <p class="text-[#4B5563] text-[12px]"> <span class="font-semibold">Incident:</span> ${wildfireData.incident_name || 'N/A'}</p>
                                    <p class="text-[#4B5563] text-[12px]"> <span class="font-semibold">Size:</span> ${wildfireData.incident_size ? wildfireData.incident_size + ' acres' : 'N/A'}</p>
                                    <p class="text-[#4B5563] text-[12px]"> <span class="font-semibold">Cause:</span> ${wildfireData.fire_cause || 'N/A'}</p>
                                    <p class="text-[#4B5563] text-[12px]"> <span class="font-semibold">Contained:</span> ${wildfireData.percent_contained ? wildfireData.percent_contained + '%' : '0%'}</p>
                                    <p class="text-[#4B5563] text-[12px]"> <span class="font-semibold">Type:</span> ${wildfireData.incident_type || 'N/A'}</p>
                                    <p class="text-[#4B5563] text-[12px]"> <span class="font-semibold">Last Updated:</span> ${formatEventDate(wildfireData.modified_time || props.eventDate)}</p>
                                `;
                                } catch {
                                  return `<p class="text-[#4B5563] text-[12px]">Value: ${props.description}</p>`;
                                }
                              })()
                            : ''
                        }
                        
                        ${
                          props.description && props.eventType === 'rainfall'
                            ? (() => {
                                try {
                                  const rainfallData = JSON.parse(props.description);
                                  return `
                        <p class="text-[#4B5563] text-[12px]"> <span class="font-semibold">Date:</span> ${formatEventDate(props.eventDate)}</p>
                        ${
                          rainfallData.min_value &&
                          rainfallData.max_value &&
                          rainfallData.min_value === rainfallData.max_value
                            ? `<p class="text-[#4B5563] text-[12px]"> <span class="font-semibold">Rain Accumulation (Last 1 Hour):</span> ${rainfallData.min_value || 'N/A'} ${rainfallData.units || 'N/A'}</p>`
                            : `<p class="text-[#4B5563] text-[12px]"> <span class="font-semibold">Rain Accumulation (Last 1 Hour):</span> ${rainfallData.min_value || 'N/A'} - ${rainfallData.max_value || 'N/A'} ${rainfallData.units || 'N/A'}</p>`
                        }
                        `;
                                } catch {
                                  return `<p class="text-[#4B5563] text-[12px]">Value: ${props.description}</p>`;
                                }
                              })()
                            : ''
                        }
                                
                        ${
                          props.description && props.eventType === 'high wind'
                            ? (() => {
                                try {
                                  const windData = JSON.parse(props.description);
                                  return `
                        <p class="text-[#4B5563] text-[12px]"> <span class="font-semibold">Date:</span> ${formatEventDate(props.eventDate)}</p>
                        ${
                          windData.min_value &&
                          windData.max_value &&
                          windData.min_value === windData.max_value
                            ? `<p class="text-[#4B5563] text-[12px]"> <span class="font-semibold">Wind Speed Gradient:</span> ${windData.min_value || 'N/A'} ${windData.units || 'N/A'}</p>`
                            : `<p class="text-[#4B5563] text-[12px]"> <span class="font-semibold">Wind Speed Gradient:</span> ${windData.min_value || 'N/A'} - ${windData.max_value || 'N/A'} ${windData.units || 'N/A'}</p>`
                        }
                        `;
                                } catch {
                                  return `<p class="text-[#4B5563] text-[12px]">Value: ${props.description}</p>`;
                                }
                              })()
                            : ''
                        }
                        
                        ${
                          props.description && props.eventType === 'hail'
                            ? (() => {
                                try {
                                  const hailData = JSON.parse(props.description);
                                  return `
                        <p class="text-[#4B5563] text-[12px]"> <span class="font-semibold">Date:</span> ${formatEventDate(props.eventDate)}</p>
                        ${
                          hailData.min_value &&
                          hailData.max_value &&
                          hailData.min_value === hailData.max_value
                            ? `<p class="text-[#4B5563] text-[12px]"> <span class="font-semibold">Likelihood of Hail:</span> ${hailData.min_value || 'N/A'}${hailData.units || 'N/A'}</p>`
                            : `<p class="text-[#4B5563] text-[12px]"> <span class="font-semibold">Likelihood of Hail:</span> ${hailData.min_value || 'N/A'} - ${hailData.max_value || 'N/A'}${hailData.units || 'N/A'}</p>`
                        }
                        `;
                                } catch {
                                  return `<p class="text-[#4B5563] text-[12px]">Value: ${props.description}</p>`;
                                }
                              })()
                            : ''
                        }
                        
                        ${
                          props.description && props.eventType === 'earthquake'
                            ? (() => {
                                try {
                                  const eqData = JSON.parse(props.description);
                                  return `
                                    <p class="text-[#4B5563] text-[12px]"> <span class="font-semibold">Discovered:</span> ${formatEventDate(eqData.event_time_utc || props.eventDate)}</p>
                                    <p class="text-[#4B5563] text-[12px]"> <span class="font-semibold">Magnitude:</span> ${eqData.magnitude || 'N/A'}</p>
                                    <p class="text-[#4B5563] text-[12px]"> <span class="font-semibold">Depth:</span> ${eqData.depth_km ? eqData.depth_km.toFixed(1) + ' km' : 'N/A'}</p>
                                    <p class="text-[#4B5563] text-[12px]"> <span class="font-semibold">Location:</span> ${eqData.place || 'N/A'}</p>
                                    <p class="text-[#4B5563] text-[12px]"> <span class="font-semibold">Last Updated:</span> ${formatEventDate(eqData.updated_time_utc || props.eventDate)}</p>
                                    ${eqData.url ? `<a href="${eqData.url}" target="_blank" class="text-blue-600 text-[12px] hover:underline">View on USGS</a>` : ''}
                                `;
                                } catch {
                                  return `<p class="text-[#4B5563] text-[12px]">${props.description}</p>`;
                                }
                              })()
                            : ''
                        }
                        ${
                          props.description && props.eventType === 'hurricane'
                            ? (() => {
                                try {
                                  const hurricaneData = JSON.parse(props.description);
                                  return `
                                    <p class="text-[#4B5563] text-[12px]"><span class="font-semibold">Name:</span> ${hurricaneData.name || 'N/A'}</p>
                                    <p class="text-[#4B5563] text-[12px]"><span class="font-semibold">Classification:</span> ${hurricaneData.classification || 'N/A'}</p>
                                    <p class="text-[#4B5563] text-[12px]"><span class="font-semibold">Intensity:</span> ${hurricaneData.intensity ? hurricaneData.intensity + ' ' + (hurricaneData.units || 'knots') : 'N/A'}</p>
                                    <p class="text-[#4B5563] text-[12px]"><span class="font-semibold">Pressure:</span> ${hurricaneData.pressure ? hurricaneData.pressure + ' ' + 'mb' : 'N/A'}</p>
                                    <p class="text-[#4B5563] text-[12px]"><span class="font-semibold">Movement:</span> ${hurricaneData.movementDir ? hurricaneData.movementDir + '°' : 'N/A'} at ${hurricaneData.movementSpeed || 'N/A'} knots</p>
                                    <p class="text-[#4B5563] text-[12px]"><span class="font-semibold">Last Update:</span> ${formatEventDate(hurricaneData.lastUpdate || props.eventDate)}</p>
                                     ${hurricaneData.publicAdvisoryUrl ? `<a href="${hurricaneData.publicAdvisoryUrl}" target="_blank" class="text-blue-600 text-[12px] hover:underline">View on NHC</a>` : ''}
                                `;
                                } catch {
                                  return `<p class="text-[#4B5563] text-[12px]">Value: ${props.description}</p>`;
                                }
                              })()
                            : ''
                        }
                    </div>
                </div>
            `
      )
      .addTo(map);
  });
  map.on('mouseenter', layerId, () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', layerId, () => {
    map.getCanvas().style.cursor = '';
  });
}

/**
 * Loads and displays event data on the map
 * @param {mapboxgl.Map} map - The Mapbox map instance
 *
 * Clustering Configuration:
 * - clusterMaxZoom: 14 (clusters break apart at zoom level 14)
 * - clusterRadius: 70 (distance in pixels to consider points part of the same cluster)
 * - Icon size: 0.6 (size of event icons on the map)
 *
 * Cluster Visualization:
 * - Points are clustered when zoomed out
 * - Clusters show as circles with point count
 * - On hover, clusters expand into "petals" showing individual events
 * - Petals are arranged in a circle around the cluster center
 */
export async function loadEventData(map) {
  const { geojson, latestEventDate } = await fetchEventData();
  if (!geojson) {
    return { latestEventDate: latestEventDate ?? null };
  }

  // Store the original data
  originalEventData = geojson;

  if (!isMapAlive(map)) return { latestEventDate: latestEventDate ?? null };

  // Create a single source for all events
  const allEventsId = 'all-events';
  const existingSource = map.getSource(allEventsId);

  if (existingSource) {
    existingSource.setData(geojson);
  } else {
    map.addSource(allEventsId, {
      type: 'geojson',
      data: geojson,
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 70,
      clusterMinPoints: 3,
    });

    /* Center circle for cluster
        map.addLayer({
            id: 'all-cluster-center',
            type: 'circle',
            source: allEventsId,
            filter: ['has', 'point_count'],
            paint: {
                'circle-radius': 4,
                'circle-color': '#fff',
                'circle-stroke-color': '#000',
                'circle-stroke-width': 1
            }
        });
        */

    // Show unclustered points
    map.addLayer({
      id: ALL_UNCLUSTERED_POINTS_LAYER_ID,
      type: 'symbol',
      source: allEventsId,
      filter: ['!', ['has', 'point_count']],
      layout: {
        'icon-image': ['get', 'icon'],
        'icon-size': 0.55,
        'icon-allow-overlap': true,
      },
    });

    // Enable tooltips for unclustered points
    setupEventListeners(map, ALL_UNCLUSTERED_POINTS_LAYER_ID);

    /* Remove cluster click zoom and only keep cursor changes
        map.on('mouseenter', 'all-cluster-center', () => {
            map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'all-cluster-center', () => {
            map.getCanvas().style.cursor = '';
        });
        */
  }

  // Add a single source for petals
  if (!isMapAlive(map)) return { latestEventDate: latestEventDate ?? null };
  if (map.getSource(EVENT_PETALS_SOURCE_ID)) {
    map
      .getSource(EVENT_PETALS_SOURCE_ID)
      .setData({ type: GEOJSON_FEATURE_COLLECTION_TYPE, features: [] });
  } else {
    map.addSource(EVENT_PETALS_SOURCE_ID, {
      type: 'geojson',
      data: { type: GEOJSON_FEATURE_COLLECTION_TYPE, features: [] },
    });
    if (!map.getLayer(EVENT_PETALS_LAYER_ID)) {
      map.addLayer({
        id: EVENT_PETALS_LAYER_ID,
        type: 'symbol',
        source: EVENT_PETALS_SOURCE_ID,
        layout: {
          'icon-image': ['get', 'icon'],
          'icon-size': 0.55,
          'icon-allow-overlap': true,
          'icon-offset': ['get', 'offset'],
        },
      });
    }
  }
  setupEventListeners(map, EVENT_PETALS_LAYER_ID);

  // --- Dynamic petals update logic for all clusters ---
  function updatePetals() {
    const source = map.getSource(allEventsId);
    if (!source) return;

    const features = map.querySourceFeatures(allEventsId, { sourceLayer: undefined });
    const clusterPromises = [];

    for (const feature of features) {
      if (!feature.properties.point_count) continue;
      const clusterId = feature.properties.cluster_id;
      const center = feature.geometry.coordinates;
      const p = new Promise((resolve) => {
        source.getClusterLeaves(clusterId, 100, 0, (err, leaves) => {
          if (err || !leaves) return resolve([]);
          const total = leaves.length;
          const clusterPetals = leaves.map((leaf, i) => {
            const angle = (2 * Math.PI * i) / total;
            const radius = 43; // px offset from center
            const offsetX = Math.round(Math.sin(angle) * radius);
            const offsetY = Math.round(-Math.cos(angle) * radius);
            return {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: center },
              properties: {
                icon: leaf.properties.eventType,
                offset: [offsetX, offsetY],
                eventType: leaf.properties.eventType,
                county: leaf.properties.county,
                eventDate: leaf.properties.eventDate,
                description: leaf.properties.description,
              },
            };
          });
          resolve(clusterPetals);
        });
      });
      clusterPromises.push(p);
    }

    Promise.all(clusterPromises).then((results) => {
      const allPetals = results.flat();
      if (map.getSource(EVENT_PETALS_SOURCE_ID)) {
        map
          .getSource(EVENT_PETALS_SOURCE_ID)
          .setData({ type: GEOJSON_FEATURE_COLLECTION_TYPE, features: allPetals });
      }
    });
  }

  map.on('moveend', updatePetals);
  map.on('sourcedata', (e) => {
    if (e.sourceId === allEventsId && e.isSourceLoaded) {
      updatePetals();
    }
  });
  // --- End dynamic petals update logic ---

  return { latestEventDate: latestEventDate ?? null };
}

/**
 * Updates the visibility of event layers based on selected events
 * @param {mapboxgl.Map} map - The Mapbox map instance
 * @param {string[]} selectedEvents - Array of selected event types
 */
export function updateEventLayerVisibility(map, selectedEvents) {
  if (!map || !originalEventData || !isMapAlive(map)) return;

  const source = map.getSource('all-events');
  if (source) {
    // If no events are selected, show no events
    if (selectedEvents.length === 0) {
      source.setData({
        type: GEOJSON_FEATURE_COLLECTION_TYPE,
        features: [],
      });
      return;
    }

    // Filter the original data based on selected events
    const filteredFeatures = originalEventData.features.filter((feature) => {
      const eventType = feature.properties.eventType;
      return selectedEvents.some(
        (event) => event.toLowerCase().trim() === eventType.toLowerCase().trim()
      );
    });

    source.setData({
      type: GEOJSON_FEATURE_COLLECTION_TYPE,
      features: filteredFeatures,
    });
  }
}

/**
 * Updates the visibility of map layers based on visibility settings
 * @param {mapboxgl.Map} map - The Mapbox map instance
 * @param {Object} layerVisibility - Object containing visibility states for map layers
 */
export function updateLayerVisibility(map, layerVisibility) {
  if (!map || !isMapAlive(map)) return;

  const layerGroups = {
    outline: {
      layers: [OUTLINE_LAYER_LINE_ID],
      visible: layerVisibility.outline,
    },
    events: {
      layers: [
        /* "all-cluster-center", */
        ALL_UNCLUSTERED_POINTS_LAYER_ID,
        EVENT_PETALS_LAYER_ID,
      ],
      visible: layerVisibility.events,
    },
  };

  Object.entries(layerGroups).forEach(([, { layers, visible }]) => {
    layers.forEach((layerId) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
      }
    });
  });
}
