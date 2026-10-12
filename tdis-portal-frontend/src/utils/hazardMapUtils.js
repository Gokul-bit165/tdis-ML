/**
 * @fileoverview Hazard Map Utilities
 * Functions for creating and managing hazard map layers, sources, and styling.
 * Provides reusable utilities for color expressions, filters, and layer operations.
 */

import { isMapAlive } from './mapUtils';
import {
  HAZARD_TILE_LAYERS,
  HAZARD_ZOOM_THRESHOLDS,
  HAZARD_BOUNDS,
  SUBTYPE_MAP,
} from '../config/hazardConfig';

/**
 * Source IDs for hazard data layers
 */
export const HAZARD_SOURCE_IDS = {
  countyTotal: 'hazard-county-total',
  countySubtype: 'hazard-county-subtype',
  points: 'hazard-points',
};

/**
 * Layer IDs for hazard visualization
 */
export const HAZARD_LAYER_IDS = {
  countyFill: 'hazard-county-fill',
  countyOutline: 'hazard-county-outline',
  countyCountLabel: 'hazard-county-count-label',
  pointsCircle: 'hazard-points-circle',
  roadClosureLine: 'hazard-road-closure-line',
};

/**
 * Get all hazard layer IDs as an array
 * @returns {string[]} Array of layer IDs
 */
export const getAllHazardLayerIds = () => Object.values(HAZARD_LAYER_IDS);

/**
 * Generate stepped color expression for county fill (clean statewide choropleth)
 * 0 = transparent/neutral; steps for 1, 5, 10, 25, 50, 100+
 * @param {string} property - Property name to read count from
 * @returns {Array} Mapbox step expression for fill-color
 */
/** County fill base color: Caution Yellow #FBC02D (rgb 251, 192, 45) */
const COUNTY_FILL_COLOR = { r: 251, g: 192, b: 45 };

/** Opacity steps so counties and counts are visible on the base map (0 = hidden) */
export const getCountyFillColorExpression = (property) => [
  'step',
  ['coalesce', ['to-number', ['get', property]], 0],
  `rgba(${COUNTY_FILL_COLOR.r}, ${COUNTY_FILL_COLOR.g}, ${COUNTY_FILL_COLOR.b}, 0)`, // 0: transparent
  1,
  `rgba(${COUNTY_FILL_COLOR.r}, ${COUNTY_FILL_COLOR.g}, ${COUNTY_FILL_COLOR.b}, 0.35)`, // 1+
  5,
  `rgba(${COUNTY_FILL_COLOR.r}, ${COUNTY_FILL_COLOR.g}, ${COUNTY_FILL_COLOR.b}, 0.55)`, // 5+
  10,
  `rgba(${COUNTY_FILL_COLOR.r}, ${COUNTY_FILL_COLOR.g}, ${COUNTY_FILL_COLOR.b}, 0.65)`, // 10+
  25,
  `rgba(${COUNTY_FILL_COLOR.r}, ${COUNTY_FILL_COLOR.g}, ${COUNTY_FILL_COLOR.b}, 0.75)`, // 25+
  50,
  `rgba(${COUNTY_FILL_COLOR.r}, ${COUNTY_FILL_COLOR.g}, ${COUNTY_FILL_COLOR.b}, 0.85)`, // 50+
  100,
  `rgba(${COUNTY_FILL_COLOR.r}, ${COUNTY_FILL_COLOR.g}, ${COUNTY_FILL_COLOR.b}, 0.95)`, // 100+
];

/**
 * Generate color expression for points based on subtype
 * Each subtype has its own distinct color for easy identification
 * Matching is case-insensitive so tile properties like "Hazard_Weather_Fog" or "HAZARD_WEATHER_FOG" both work.
 * For empty/null or "Unavailable" subtypes, falls back to coloring by type field.
 * @returns {Array} Mapbox case expression for circle-color
 */
export const getPointColorExpression = () => {
  // Regular subtypes (excluding "Other" entries which have isOther: true); use lowercased IDs for case-insensitive match
  const regularColorStops = Object.entries(SUBTYPE_MAP)
    .filter(([, sub]) => !sub.isOther)
    .flatMap(([id, sub]) => [id.toLowerCase(), sub.color]);

  // Type-based colors for empty/null/"Unavailable" subtypes (lowercase for case-insensitive match)
  const typeColors = {
    weatherhazard: '#d97706', // Amber for weather (other)
    hazard_on_road: '#2563eb', // Blue for road surface (other)
    road_closed: '#b91c1c', // Dark red for road closure (other)
  };
  const typeColorStops = Object.entries(typeColors).flatMap(([type, color]) => [type, color]);

  // Check if subtype is empty/null/Unavailable (case-insensitive)
  const subtypeValue = ['downcase', ['coalesce', ['get', 'subtype'], '']];
  const isSubtypeEmptyOrUnavailable = [
    'any',
    ['!', ['has', 'subtype']],
    ['==', subtypeValue, ''],
    ['==', subtypeValue, 'unavailable'],
  ];

  const typeValue = ['downcase', ['coalesce', ['get', 'type'], '']];
  return [
    'case',
    isSubtypeEmptyOrUnavailable,
    ['match', typeValue, ...typeColorStops, '#f59e0b'],
    ['match', subtypeValue, ...regularColorStops, '#f59e0b'],
  ];
};

/**
 * Create a filter expression for selected subtypes
 * Matching is case-insensitive so tile properties like "Hazard_Weather_Fog" or "HAZARD_WEATHER_FOG" both match.
 * 1. Regular subtypes: Filter by subtype field (downcased)
 * 2. "Other" subtypes: Filter by type field when subtype is "Unavailable" or empty/null
 *
 * @param {Set<string>} selectedSubtypes - Set of selected subtype IDs
 * @returns {Array} Mapbox filter expression
 */
export const createSubtypeFilter = (selectedSubtypes) => {
  if (!selectedSubtypes || selectedSubtypes.size === 0) {
    return ['literal', false]; // Hide all when nothing selected
  }

  const subtypeArray = [...selectedSubtypes];

  // Separate regular subtypes from "Other" subtypes
  const regularSubtypes = subtypeArray.filter((id) => !id.startsWith('OTHER_'));
  const otherSubtypes = subtypeArray.filter((id) => id.startsWith('OTHER_'));

  const conditions = [];

  // Regular subtypes: match by subtype field (case-insensitive via downcase)
  if (regularSubtypes.length > 0) {
    const regularSubtypesLower = regularSubtypes.map((id) => id.toLowerCase());
    conditions.push([
      'in',
      ['downcase', ['coalesce', ['get', 'subtype'], '']],
      ['literal', regularSubtypesLower],
    ]);
  }

  // "Other" subtypes: match by type (case-insensitive) when subtype is Unavailable/empty/null
  otherSubtypes.forEach((otherId) => {
    const typeMatch = otherId.replace('OTHER_', '').toLowerCase();
    const subtypeValue = ['downcase', ['coalesce', ['get', 'subtype'], '']];
    conditions.push([
      'all',
      ['==', ['downcase', ['coalesce', ['get', 'type'], '']], typeMatch],
      [
        'any',
        ['!', ['has', 'subtype']],
        ['==', subtypeValue, ''],
        ['==', subtypeValue, 'unavailable'],
      ],
    ]);
  });

  if (conditions.length === 0) {
    return ['literal', false];
  } else if (conditions.length === 1) {
    return conditions[0];
  } else {
    return ['any', ...conditions];
  }
};

/**
 * Wait for a map source to be loaded
 * @param {Object} map - Mapbox map instance
 * @param {string} sourceId - Source ID to wait for
 * @returns {Promise<void>}
 */
const _waitForSourceLoad = (map, sourceId) => {
  return new Promise((resolve) => {
    if (!map.getSource(sourceId)) {
      setTimeout(() => _waitForSourceLoad(map, sourceId).then(resolve), 100);
      return;
    }

    try {
      if (map.isSourceLoaded?.(sourceId)) {
        resolve();
        return;
      }
    } catch {
      // Source might not be ready yet
    }

    const onSourceData = (e) => {
      if (e.sourceId === sourceId && e.isSourceLoaded) {
        map.off('sourcedata', onSourceData);
        resolve();
      }
    };

    map.on('sourcedata', onSourceData);

    // Timeout fallback
    setTimeout(() => {
      map.off('sourcedata', onSourceData);
      resolve();
    }, 5000);
  });
};

/**
 * Add hazard vector tile sources to the map
 * @param {Object} map - Mapbox map instance
 * @param {string} tileServerUrl - Base URL for pg_tileserv
 */
export const addHazardSources = (map, tileServerUrl) => {
  const sources = [
    { id: HAZARD_SOURCE_IDS.countyTotal, layer: HAZARD_TILE_LAYERS.countyTotal },
    { id: HAZARD_SOURCE_IDS.points, layer: HAZARD_TILE_LAYERS.points },
  ];
  sources.forEach(({ id, layer }) => {
    if (!map.getSource(id)) {
      map.addSource(id, {
        type: 'vector',
        tiles: [`${tileServerUrl}/${layer}/{z}/{x}/{y}.pbf`],
        bounds: HAZARD_BOUNDS,
        minzoom: 0,
        maxzoom: 22,
      });
    }
  });
};

/** pg_tileserv source-layer name for county total (polygon layer) */
const COUNTY_TOTAL_SOURCE_LAYER = HAZARD_TILE_LAYERS.countyTotal;

/**
 * Add hazard layers: county choropleth (0-7) + count labels; circles 9.5+; barrier icon 12+
 * @param {Object} map - Mapbox map instance
 */
export const addHazardLayers = (map) => {
  if (!isMapAlive(map)) return;
  const { countyTotal, points } = HAZARD_ZOOM_THRESHOLDS;

  // --- Zoom 0-7 (fade out 6-8): County fill + outline + count labels ---
  if (!map.getLayer(HAZARD_LAYER_IDS.countyFill)) {
    map.addLayer({
      id: HAZARD_LAYER_IDS.countyFill,
      source: HAZARD_SOURCE_IDS.countyTotal,
      'source-layer': COUNTY_TOTAL_SOURCE_LAYER,
      type: 'fill',
      minzoom: countyTotal.min,
      paint: {
        'fill-color': getCountyFillColorExpression('total_alert_count'),
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 6, 1, 8, 0],
      },
    });
  }
  if (!map.getLayer(HAZARD_LAYER_IDS.countyOutline)) {
    map.addLayer({
      id: HAZARD_LAYER_IDS.countyOutline,
      source: HAZARD_SOURCE_IDS.countyTotal,
      'source-layer': COUNTY_TOTAL_SOURCE_LAYER,
      type: 'line',
      minzoom: countyTotal.min,
      paint: {
        'line-color': '#374151',
        'line-width': 1.25,
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0.8, 8, 0],
      },
    });
  }
  if (!map.getLayer(HAZARD_LAYER_IDS.countyCountLabel)) {
    map.addLayer({
      id: HAZARD_LAYER_IDS.countyCountLabel,
      source: HAZARD_SOURCE_IDS.countyTotal,
      'source-layer': COUNTY_TOTAL_SOURCE_LAYER,
      type: 'symbol',
      minzoom: countyTotal.min,
      filter: ['>', ['coalesce', ['to-number', ['get', 'total_alert_count']], 0], 0],
      layout: {
        'text-field': ['to-string', ['get', 'total_alert_count']],
        'text-size': ['interpolate', ['linear'], ['zoom'], 4, 10, 7, 12],
        'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
        'text-anchor': 'center',
        'text-allow-overlap': false,
        'symbol-placement': 'point',
      },
      paint: {
        'text-color': '#111827',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.5,
        'text-opacity': ['interpolate', ['linear'], ['zoom'], 6, 1, 8, 0],
      },
    });
  }

  // --- Zoom 6+: Circles colored by subtype (appear as you zoom in, like power outage points) ---
  if (!map.getLayer(HAZARD_LAYER_IDS.pointsCircle)) {
    map.addLayer({
      id: HAZARD_LAYER_IDS.pointsCircle,
      source: HAZARD_SOURCE_IDS.points,
      'source-layer': HAZARD_TILE_LAYERS.points,
      type: 'circle',
      minzoom: 6,
      paint: {
        'circle-color': getPointColorExpression(),
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 2, 8, 3, 10, 5, 12, 6, 16, 8],
        'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 6, 0, 8, 0.5, 10.5, 1],
        'circle-stroke-color': '#ffffff',
        'circle-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0.5, 8, 0.85, 10, 0.95],
      },
      layout: { visibility: 'visible' },
    });
  }

  // --- Zoom 12+: Line across road (rotated by magvar), colored by subtype ---
  if (!map.getLayer(HAZARD_LAYER_IDS.roadClosureLine)) {
    const lineRotation = ['+', ['coalesce', ['to-number', ['get', 'magvar']], 0], 90];
    map.addLayer({
      id: HAZARD_LAYER_IDS.roadClosureLine,
      source: HAZARD_SOURCE_IDS.points,
      'source-layer': HAZARD_TILE_LAYERS.points,
      type: 'symbol',
      minzoom: points.min,
      layout: {
        'symbol-placement': 'point',
        'text-field': '|',
        'text-rotate': lineRotation,
        'text-rotation-alignment': 'map',
        'text-size': ['interpolate', ['linear'], ['zoom'], 12, 14, 14, 18, 18, 24],
        'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
        'text-allow-overlap': true,
        'text-ignore-placement': false,
        visibility: 'visible',
      },
      paint: {
        'text-color': getPointColorExpression(),
        'text-halo-color': '#ffffff',
        'text-halo-width': 1,
      },
    });
  }
};

/**
 * Set visibility for all hazard layers
 * @param {Object} map - Mapbox map instance
 * @param {boolean} visible - Whether layers should be visible
 */
export const setHazardLayersVisibility = (map, visible) => {
  if (!isMapAlive(map)) return;
  const visibility = visible ? 'visible' : 'none';
  Object.values(HAZARD_LAYER_IDS).forEach((id) => {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', visibility);
    }
  });
};

/**
 * Update filters: county layers show totals (no filter); points filtered by selected subtypes
 * @param {Object} map - Mapbox map instance
 * @param {Set<string>} selectedSubtypes - Set of selected subtype IDs
 */
export const updateHazardFilters = (map, selectedSubtypes) => {
  if (!isMapAlive(map)) return;
  const pointsFilter = createSubtypeFilter(selectedSubtypes);
  [HAZARD_LAYER_IDS.pointsCircle, HAZARD_LAYER_IDS.roadClosureLine].forEach((id) => {
    if (map.getLayer(id)) map.setFilter(id, pointsFilter);
  });
};

/**
 * Get display name and color for a type
 * Used as fallback when subtype is empty/null
 */
const getTypeDisplayInfo = (type) => {
  const typeMap = {
    ROAD_CLOSED: { name: 'Road Closure', color: '#b91c1c' },
    WEATHERHAZARD: { name: 'Weather Hazard', color: '#d97706' },
    HAZARD_ON_ROAD: { name: 'Road Hazard', color: '#2563eb' },
  };
  return typeMap[type] || { name: type || 'Unknown', color: '#f59e0b' };
};

/**
 * Format hazard popup content
 * @param {Object} properties - Feature properties
 * @param {string} layerType - 'county' | 'subtype' | 'point'
 * @returns {string} HTML content for popup
 */
export const formatHazardPopupContent = (properties, layerType) => {
  const hasSubtype =
    properties.subtype && properties.subtype !== '' && properties.subtype !== 'Unavailable';
  const subtype = hasSubtype ? SUBTYPE_MAP[properties.subtype] : null;

  // If no valid subtype, fall back to type display info
  const typeInfo = getTypeDisplayInfo(properties.type);
  const subtypeName = subtype?.name || (hasSubtype ? properties.subtype : typeInfo.name);
  const subtypeColor = subtype?.color || typeInfo.color;

  if (layerType === 'county') {
    return `
            <div class="p-4 min-w-[240px]">
                <div class="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200">
                    <div class="w-2 h-2 rounded-full" style="background-color: ${subtypeColor}"></div>
                    <p class="font-bold text-sm text-[#324755]">${properties.county_name || 'County'}</p>
                </div>
                <div class="space-y-2">
                    <div class="flex items-center justify-between p-2 rounded-lg bg-amber-50 border border-amber-200">
                        <span class="text-xs font-semibold text-gray-700">Total Alerts:</span>
                        <span class="text-sm font-bold text-amber-600">${(properties.total_alert_count || properties.alert_count || 0).toLocaleString()}</span>
                    </div>
                    ${
                      properties.subtype
                        ? `
                        <div class="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-200">
                            <span class="text-xs font-semibold text-gray-700">Type:</span>
                            <span class="text-xs font-medium" style="color: ${subtypeColor}">${subtypeName}</span>
                        </div>
                    `
                        : ''
                    }
                </div>
            </div>
        `;
  }

  // Point popup
  return `
        <div class="p-4 min-w-[280px]">
            <div class="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200">
                <div class="w-3 h-3 rounded-full" style="background-color: ${subtypeColor}"></div>
                <p class="font-bold text-sm text-[#324755]">${subtypeName}</p>
            </div>
            <div class="space-y-2">
                <div class="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-200">
                    <span class="text-xs font-semibold text-gray-700">Subtype:</span>
                    <span class="text-xs font-medium" style="color: ${subtypeColor}">${subtypeName}</span>
                </div>
                ${
                  properties.type
                    ? `
                    <div class="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-200">
                        <span class="text-xs font-semibold text-gray-700">Category:</span>
                        <span class="text-xs text-gray-600">${properties.type}</span>
                    </div>
                `
                    : ''
                }
                ${
                  properties.street
                    ? `
                    <div class="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-200">
                        <span class="text-xs font-semibold text-gray-700">Street:</span>
                        <span class="text-xs text-gray-600">${properties.street}</span>
                    </div>
                `
                    : ''
                }
                ${
                  properties.city
                    ? `
                    <div class="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-200">
                        <span class="text-xs font-semibold text-gray-700">City:</span>
                        <span class="text-xs text-gray-600">${properties.city}</span>
                    </div>
                `
                    : ''
                }
                ${
                  properties.reliability !== undefined
                    ? `
                    <div class="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-200">
                        <span class="text-xs font-semibold text-gray-700">Reliability:</span>
                        <span class="text-xs text-gray-600">${properties.reliability}</span>
                    </div>
                `
                    : ''
                }
                ${
                  properties.pubmillis
                    ? `
                    <div class="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-200">
                        <span class="text-xs font-semibold text-gray-700">Reported:</span>
                        <span class="text-xs text-gray-600">${new Date(properties.pubmillis).toLocaleString()}</span>
                    </div>
                `
                    : ''
                }
            </div>
        </div>
    `;
};

export default {
  HAZARD_SOURCE_IDS,
  HAZARD_LAYER_IDS,
  getAllHazardLayerIds,
  getCountyFillColorExpression,
  getPointColorExpression,
  createSubtypeFilter,
  addHazardSources,
  addHazardLayers,
  setHazardLayersVisibility,
  updateHazardFilters,
  formatHazardPopupContent,
};
