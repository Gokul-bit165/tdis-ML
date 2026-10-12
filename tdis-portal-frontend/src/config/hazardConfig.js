/**
 * @fileoverview Traffic & Hazard Alerts Configuration
 * Centralized configuration for hazard categories, subtypes, colors, and tile URLs.
 * Easily extensible for future hazard types.
 */

import { CloudRain, AlertTriangle, Construction, Ban } from 'lucide-react';

/**
 * pg_tileserv layer names for hazard data
 */
export const HAZARD_TILE_LAYERS = {
  countyTotal: 'public.mv_crowdsource_waze_road_status_total',
  countySubtype: 'public.mv_crowdsource_waze_road_status_subtype',
  points: 'public.crowdsource_waze_road_status',
};

/**
 * Zoom level thresholds (county default; points appear as you zoom in, like power outage)
 * 0-7:   County choropleth (fill + outline + count labels); crossfade out 6-8
 * 6+:    Circles appear as you zoom in (ramp opacity/radius 6–10), like power outage points
 * 12+:   Barrier icons (line) on top of circles
 */
export const HAZARD_ZOOM_THRESHOLDS = {
  countyTotal: { min: 0, max: 7 }, // Choropleth county fill + outline + count on map
  circles: { min: 6, max: 22 }, // Circle markers from zoom 6 (visible as soon as you zoom in)
  points: { min: 12, max: 22 }, // Barrier line icon at high zoom
};

/**
 * Texas bounding box for limiting tile requests
 */
export const HAZARD_BOUNDS = [-106.65, 27.56, -93.84, 33.96];

/**
 * Feature flag to control which categories are enabled in the UI
 * Set to true to show category, false to hide it
 * This allows easy toggling of categories without removing configuration
 */
export const HAZARD_CATEGORY_FLAGS = {
  weather_hazards: true, // Show weather subtypes on map and in legend
  road_surface: false, // Hidden for now
  infrastructure: false, // Hidden for now
  road_closures: false, // Road Closure alert types removed; layer is Road Weather Hazard Alerts only
};

/**
 * Hazard categories with their subtypes.
 * Source table: Alert Type | Alert Subtype | Hex
 * - WEATHERHAZARD/HAZARD: HAZARD_WEATHER … HAZARD_ON_ROAD_TRAFFIC_LIGHT_FAULT, unavailable (no Hex)
 * - ROAD_CLOSED: ROAD_CLOSED_HAZARD, ROAD_CLOSED_EVENT, unavailable (no Hex)
 * Display names come from the table's "Alert Subtype" column (human-readable labels).
 * Subtype "unavailable" has no Hex; display name from Alert Type: WEATHERHAZARD -> "Weather Hazard Other", ROAD_CLOSED -> "Road Closure Other".
 * Use HAZARD_CATEGORY_FLAGS to control visibility in the UI.
 */
export const HAZARD_CATEGORIES = {
  weather_hazards: {
    id: 'weather_hazards',
    name: 'Weather Hazards',
    icon: CloudRain,
    color: '#f59e0b', // Amber
    typeField: 'WEATHERHAZARD', // For filtering "Unavailable" subtypes
    description:
      'Weather-related road hazards including fog, precipitation, and severe weather events.',
    subtypes: [
      { id: 'HAZARD_WEATHER', name: 'Weather Hazard', color: '#FBC02D' },
      { id: 'HAZARD_WEATHER_FOG', name: 'Weather Hazard Fog', color: '#757575' },
      { id: 'HAZARD_WEATHER_HAIL', name: 'Weather Hazard Hail', color: '#8E24AA' },
      { id: 'HAZARD_WEATHER_HEAVY_RAIN', name: 'Weather Hazard Heavy Rain', color: '#1976D2' },
      { id: 'HAZARD_WEATHER_HEAVY_SNOW', name: 'Weather Hazard Heavy Snow', color: '#B3E5FC' },
      { id: 'HAZARD_WEATHER_FLOOD', name: 'Weather Hazard Flood', color: '#0D47A1' },
      { id: 'HAZARD_WEATHER_MONSOON', name: 'Weather Hazard Monsoon', color: '#00897B' },
      { id: 'HAZARD_WEATHER_TORNADO', name: 'Weather Hazard Tornado', color: '#C62828' },
      { id: 'HAZARD_WEATHER_HEAT_WAVE', name: 'Weather Hazard Heat Wave', color: '#F57C00' },
      { id: 'HAZARD_WEATHER_HURRICANE', name: 'Weather Hazard Hurricane', color: '#4A148C' },
      {
        id: 'HAZARD_WEATHER_FREEZING_RAIN',
        name: 'Weather Hazard Freezing Rain',
        color: '#00ACC1',
      },
      { id: 'HAZARD_ON_ROAD_ICE', name: 'Hazard Road Ice', color: '#4FC3F7' },
      {
        id: 'HAZARD_ON_ROAD_TRAFFIC_LIGHT_FAULT',
        name: 'Hazard RoadTraffic Light Fault',
        color: '#FFB300',
      },
      {
        id: 'OTHER_WEATHERHAZARD',
        name: 'Weather Hazard Other',
        color: '#d97706',
        isOther: true,
        typeMatch: 'WEATHERHAZARD',
      },
    ],
  },
  road_closures: {
    id: 'road_closures',
    name: 'Weather Hazard & Road Closures',
    icon: Ban,
    color: '#ef4444', // Red
    typeField: 'ROAD_CLOSED',
    description: 'Road closures due to hazards or events.',
    subtypes: [
      { id: 'ROAD_CLOSED_HAZARD', name: 'Road Closure Hazard', color: '#212121' },
      { id: 'ROAD_CLOSED_EVENT', name: 'Road Closure Event', color: '#424242' },
      {
        id: 'OTHER_ROAD_CLOSED',
        name: 'Road Closure Other',
        color: '#b91c1c',
        isOther: true,
        typeMatch: 'ROAD_CLOSED',
      },
    ],
  },
};

/**
 * Flat map for quick subtype lookup by ID (source of truth: HAZARD_CATEGORIES)
 * @type {Object.<string, {id: string, name: string, color: string, categoryId: string}>}
 */
export const SUBTYPE_MAP = Object.entries(HAZARD_CATEGORIES).reduce(
  (acc, [categoryId, category]) => {
    category.subtypes.forEach((subtype) => {
      acc[subtype.id] = {
        ...subtype,
        categoryId,
        categoryName: category.name,
        categoryColor: category.color,
      };
    });
    return acc;
  },
  {}
);

/**
 * Alert Subtype -> display name. Derived from HAZARD_CATEGORIES (single source of truth).
 * Subtype "unavailable" has no row; display from Alert Type in getSubtypeDisplayName().
 */
export const SUBTYPE_DISPLAY_NAMES = Object.fromEntries(
  Object.entries(SUBTYPE_MAP).map(([id, { name }]) => [id, name])
);

/**
 * Get display name from HAZARD_CATEGORIES (via SUBTYPE_MAP).
 * For subtype "unavailable", uses type: WEATHERHAZARD -> "Weather Hazard Other", ROAD_CLOSED -> "Road Closure Other".
 */
export const getSubtypeDisplayName = (subtypeCode, typeCode) => {
  if (subtypeCode == null || subtypeCode === '') return '—';
  const s = String(subtypeCode).trim();
  const isUnavailable = s.toLowerCase() === 'unavailable' || s.endsWith('_unavailable');
  if (isUnavailable && typeCode) {
    const t = String(typeCode).toUpperCase();
    if (t === 'HAZARD_WEATHER') return 'Weather Hazard Other';
    if (t === 'ROAD_CLOSED') return 'Road Closure Other';
  }
  const fromMap = SUBTYPE_MAP[s]?.name;
  if (fromMap) return fromMap;
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

/**
 * Get only enabled categories based on HAZARD_CATEGORY_FLAGS
 * @returns {Object} Object with enabled categories only
 */
export const getEnabledCategories = () => {
  return Object.entries(HAZARD_CATEGORIES)
    .filter(([id]) => HAZARD_CATEGORY_FLAGS[id] === true)
    .reduce((acc, [id, category]) => {
      acc[id] = category;
      return acc;
    }, {});
};

/**
 * Get all subtype IDs from all categories (for map filtering so all alert types plot)
 * @returns {Set<string>} Set of all subtype IDs
 */
export const getAllSubtypeIds = () => {
  return new Set(Object.values(HAZARD_CATEGORIES).flatMap((cat) => cat.subtypes.map((s) => s.id)));
};

/**
 * Get subtype IDs from enabled categories only (for Road Weather Hazard Alerts layer).
 * @returns {Set<string>} Set of enabled subtype IDs
 */
export const getEnabledSubtypeIds = () => {
  return new Set(
    Object.values(getEnabledCategories()).flatMap((cat) => cat.subtypes.map((s) => s.id))
  );
};

/**
 * Default layer configuration for LAYER_CONFIG in OSATab
 */
export const TRAFFIC_HAZARDS_LAYER_CONFIG = {
  id: 'traffic_hazards',
  name: 'Traffic & Hazard Alerts',
  icon: AlertTriangle,
  color: '#f59e0b',
  description: 'Real-time traffic and hazard alerts from crowdsourced Waze data.',
  showSummaryStats: false,
  sourceType: 'hazards',
};

export default {
  HAZARD_TILE_LAYERS,
  HAZARD_ZOOM_THRESHOLDS,
  HAZARD_BOUNDS,
  HAZARD_CATEGORIES,
  HAZARD_CATEGORY_FLAGS,
  SUBTYPE_DISPLAY_NAMES,
  getSubtypeDisplayName,
  SUBTYPE_MAP,
  getEnabledCategories,
  getAllSubtypeIds,
  getEnabledSubtypeIds,
  TRAFFIC_HAZARDS_LAYER_CONFIG,
};
