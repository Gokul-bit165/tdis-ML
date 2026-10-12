/**
 * @fileoverview Baron 1-hour rainfall layers — Active Weather Events (Beta) tab.
 * - Rainfall — Tile: H3 vector MVT (`public.baron_precip_1hr_h3_l6` … `l8`)
 * - Rainfall — Raster: pre-rendered PNG raster from portal API `/baron/rain1hr/{z}/{x}/{y}.png`
 */

import { CloudRain } from 'lucide-react';
import { HMED_CONFIG } from './mapConfig';
import { getPortalApiBaseUrl, getPortalApiKey } from './portalApiConfig';

const HSI_RETURN_PERIOD = HMED_CONFIG.returnPeriod;
const getHsiPropertyName = HMED_CONFIG.getHsiPropertyName;

/** H3 vector hex layer (pg_tileserv). */
export const BARON_RAINFALL_TILE_LAYER_ID = 'baron_rainfall_tile';
export const BARON_RAINFALL_TILE_EVENT_LABEL = 'Rainfall — Tile';

/** Pre-rendered XYZ PNG raster from portal API. */
export const BARON_RAINFALL_GRID_LAYER_ID = 'baron_rainfall_grid';
export const BARON_RAINFALL_GRID_EVENT_LABEL = 'Rainfall — Raster';

/** @deprecated Use {@link BARON_RAINFALL_TILE_LAYER_ID}. */
export const BARON_RAINFALL_GRID_VECTOR_LAYER_ID = BARON_RAINFALL_TILE_LAYER_ID;

/** Shared mm color ramp for tile vector legend. */
export const BARON_RAINFALL_MM_LEGEND = {
  gradientBar:
    'linear-gradient(to right, #e0f2fe 0%, #7dd3fc 18%, #38bdf8 32%, #0284c7 48%, #1d4ed8 62%, #4338ca 78%, #be123c 100%)',
  legendStops: [
    { label: '0 mm', color: '#e0f2fe' },
    { label: '1 mm', color: '#7dd3fc' },
    { label: '5 mm', color: '#0284c7' },
    { label: '10 mm', color: '#1d4ed8' },
    { label: '20+ mm', color: '#be123c' },
  ],
};

export const LAYER_CONFIG = {
  [BARON_RAINFALL_TILE_LAYER_ID]: {
    id: BARON_RAINFALL_TILE_LAYER_ID,
    name: BARON_RAINFALL_TILE_EVENT_LABEL,
    icon: CloudRain,
    color: '#0284c7',
    hasTimeWindow: false,
    levels: [6, 7, 8],
    level10Suffix: '',
    hexZoomRangeByLevel: {
      6: { min: 0, max: 7 },
      7: { min: 6, max: 9 },
      8: { min: 8, max: 22 },
    },
    propertyAccessor: () => 'precip_1hr_avg_mm',
    description:
      'Hourly rainfall accumulation from Baron Weather, aggregated to H3 hex cells. Values are model tile averages in millimeters for the past hour—not point rain-gauge observations.',
    dataSources: [
      {
        label: 'Rainfall tile',
        source: 'Baron Weather',
        href: 'https://baronweather.com/',
      },
    ],
    gradient: [
      0,
      '#e0f2fe',
      0.5,
      '#bae6fd',
      1,
      '#7dd3fc',
      2.5,
      '#38bdf8',
      5,
      '#0284c7',
      10,
      '#1d4ed8',
      20,
      '#4338ca',
      40,
      '#7e22ce',
      75,
      '#be123c',
    ],
    gradientBar: BARON_RAINFALL_MM_LEGEND.gradientBar,
    legendStops: BARON_RAINFALL_MM_LEGEND.legendStops,
    sourceLayerPrefix: 'public.baron_precip_1hr_h3',
  },
};

export const BARON_RAINFALL_RASTER = {
  id: BARON_RAINFALL_GRID_LAYER_ID,
  name: BARON_RAINFALL_GRID_EVENT_LABEL,
  description:
    'Pre-rendered 1-hour rainfall image tiles from Baron Weather grid data (`baron_nationwide_rainfall_accumulation_1hr_tile`).',
  minzoom: 7,
  maxzoom: 22,
  sourceMaxzoom: 7,
  tileSize: 256,
  rasterOpacity: 0.82,
  // API serves standard XYZ tiles (it flips XYZ y to the stored TMS tile_y internally).
  mapSourceId: 'baron-rainfall-grid-raster',
  mapLayerId: 'baron-rainfall-grid-raster',
};

/**
 * Mapbox raster tile URL template for `/api/v1/baron/rain1hr/{z}/{x}/{y}.png`.
 * Uses `api_key` query param because Mapbox tile requests cannot set headers.
 * @returns {string}
 */
export function getBaronRain1hrRasterTileUrlTemplate() {
  const base = getPortalApiBaseUrl();
  if (!base) return '';
  const key = getPortalApiKey();
  const qs = key ? `?api_key=${encodeURIComponent(key)}` : '';
  return `${base}/baron/rain1hr/{z}/{x}/{y}.png${qs}`;
}

export function getLayerPropertyName(layerConfig, hours, returnPeriod = HSI_RETURN_PERIOD, level) {
  return typeof layerConfig?.propertyAccessor === 'function'
    ? layerConfig.propertyAccessor(hours, returnPeriod, level)
    : getHsiPropertyName(hours, returnPeriod, level);
}

export function getVectorTileMaxZoomForLevel(layerConfig, level) {
  const by = layerConfig?.vectorTileMaxZoomByLevel;
  if (by && typeof by[level] === 'number') return by[level];
  if (typeof layerConfig?.vectorTileMaxZoom === 'number') return layerConfig.vectorTileMaxZoom;
  return 22;
}

export function getVectorTileMinZoomForLevel(layerConfig, level) {
  const by = layerConfig?.vectorTileMinZoomByLevel;
  if (by && typeof by[level] === 'number') return by[level];
  if (typeof layerConfig?.vectorTileMinZoom === 'number') return layerConfig.vectorTileMinZoom;
  return 0;
}
