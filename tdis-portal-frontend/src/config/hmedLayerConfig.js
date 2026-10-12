/**
 * @fileoverview HMED (Hazard Monitoring & Event Detection) layer configuration.
 * Precipitation HSI and Google Flood Hub (H3 L10 gauges). LTS Flash Flood lives in `ltsFlashFloodLayerConfig.js` (separate tab).
 */

import { Droplets, Waves } from 'lucide-react';
import { HMED_CONFIG } from './mapConfig';

const HSI_RETURN_PERIOD = HMED_CONFIG.returnPeriod;
const getHsiPropertyName = HMED_CONFIG.getHsiPropertyName;

/** Google Flood Hub gauge data is © Google; use alongside official warnings. */
export const GOOGLE_FLOOD_HUB_ATTRIBUTION =
    'Gauge forecasts and thresholds from Google Flood Hub (CC BY). Does not replace National Weather Service flood warnings or local emergency directives.';

/**
 * Layer configuration — HMED tab.
 */
export const LAYER_CONFIG = {
    precipitation: {
        id: 'precipitation',
        name: 'Precipitation',
        icon: Droplets,
        color: '#3b82f6',
        hasTimeWindow: true,
        levels: [6, 7, 8, 9, 10],
        level10Suffix: '_view',
        propertyAccessor: (hours, returnPeriod = HSI_RETURN_PERIOD, level) =>
            getHsiPropertyName(hours, returnPeriod, level),
        description: 'Precipitation HSI provides short term, predictive metrics of expected precipitation hazard severity.',
        /** Footer “Refresh cadence” label for this layer. */
        refreshCadence: 'Every 6 hours',
        /** Data provenance shown in the Info modal ("Data sources" section). */
        dataSources: [
            {
                label: 'Precipitation forecast',
                source: 'Baron Weather',
                href: 'https://baronweather.com/'
            },
            {
                label: 'Extreme rainfall thresholds',
                source: 'NOAA Atlas 14',
                href: 'https://hdsc.nws.noaa.gov/pfds/'
            }
        ],
        gradient: [
            0.01, "#dbeafe",     // Very light blue
            0.1, "#93c5fd",      // Light blue
            0.25, "#3b82f6",    // Medium blue - end of Minimal
            0.35, "#2563eb",    // Medium-dark blue
            0.5, "#1e40af",     // Dark blue - end of Elevated
            0.75, "#6366f1",    // Indigo - transition to Significant
            1, "#7c3aed",       // Purple - end of Significant
            1.25, "#9333ea",    // Dark purple - transition to Major
            1.5, "#c026d3",     // Fuchsia - end of Major
            1.75, "#dc2626",    // Red - transition to Extreme
            2, "#991b1b"        // Dark red for extreme values
        ],
        gradientBar: 'linear-gradient(to right, #dbeafe 0%, #93c5fd 6%, #3b82f6 12.5%, #2563eb 19%, #1e40af 25%, #6366f1 37.5%, #7c3aed 50%, #9333ea 62.5%, #c026d3 75%, #dc2626 87.5%, #991b1b 100%)',
        sourceLayerPrefix: 'public.precipitation_hsi',
        thresholds: {
            minimal: { min: 0, max: 0.25, color: "#3b82f6" },
            elevated: { min: 0.25, max: 0.5, color: "#1e40af" },
            significant: { min: 0.5, max: 1, color: "#7c3aed" },
            major: { min: 1, max: 1.5, color: "#c026d3" },
            extreme: { min: 1.5, max: Infinity, color: "#dc2626" }
        }
    },
    google_flood_hub: {
        id: 'google_flood_hub',
        name: 'Flood Hub',
        icon: Waves,
        color: '#0ea5e9',
        hasTimeWindow: false,
        floodHubGauge: true,
        /** Footer “Refresh cadence” label for this layer. */
        refreshCadence: 'Every 1 hour',
        panelSubtitle: 'Powered by Google Flood Hub',
        /** Single H3 L10 hex table. */
        levels: [10],
        hexZoomRangeByLevel: {
            10: { min: 0, max: 22 }
        },
        /**
         * Match precipitation + pg_tileserv `maxzoom`; native tiles per zoom avoid broken/empty over-zoom from a low `maxzoom`.
         */
        vectorTileMaxZoom: 22,
        /** Must be ≤ default map zoom (5) so Texas-wide view still requests gauge tiles. */
        vectorTileMinZoom: 0,
        /**
         * MVT features for gauges: `polygon` = H3 cell (`geometry`); `point` = gauge site (`coordinates`).
         * Point mode draws Mapbox **circle** layers — pg_tileserv must publish **Point** geometry (e.g. `coordinates` column).
         */
        floodHubGaugeMvtGeometry: 'point',
        /**
         * Load all gauge points via GeoJSON on Flood Hub activate (shows full Texas set at default zoom).
         * Requires backend `GET {floodHubGaugesGeoJsonPath}?bbox=…` → FeatureCollection of Points.
         * MVT remains fallback if the request fails.
         */
        floodHubGaugesGeoJsonOnLoad: true,
        /** GeoJSON from `GET {VITE_API_URL}/flood-hub/gauges?bbox=…` on Flood Hub load. */
        floodHubGaugesGeoJsonPath: '/flood-hub/gauges',
        /**
         * pg_tileserv URL path `{base}/{this}/z/x/y.pbf` and default Mapbox `source-layer` name.
         * If tiles return 200 but hexes never draw, inspect the PBF layer name — try `mvtSourceLayer: 'google_flood_hub_gauges'` when the internal name omits `public.`.
         */
        vectorTileSourceLayer: 'public.google_flood_hub_gauges',
        /** pg_tileserv MVT layer for `public.google_flood_hub_significant_events` (H3 L10 cell polygons per row). */
        significantEventsVectorTileSourceLayer: 'public.google_flood_hub_significant_events',
        /** pg_tileserv MVT layer for `public.google_flood_hub_status` (severity / trend polygons). */
        floodHubStatusVectorTileSourceLayer: 'public.google_flood_hub_status',
        /**
         * Urban flash uses Postgres views `public.google_flood_hub_urban_flash_flood_l6` … `_l10`
         * (one row per hex at that resolution). Zoom bands match precipitation HSI via getHexZoomRange.
         * Gauges stay `levels: [10]` above — do not reuse this list for gauge MVT.
         */
        urbanFlashLevels: [6, 7, 8, 9, 10],
        /** Prefix for `{prefix}_l{6–10}` pg_tileserv layers. */
        urbanFlashVectorTileSourceLayer: 'public.google_flood_hub_urban_flash_flood',
        propertyAccessor: () => 'predicted_peak',
        description:
            'Gauge sites show river forecast peaks (tier coloring from warning, danger, and extreme thresholds) from Google Flood Hub data ingested for this portal. Values are model-derived forecasts, not observed stage or official warning polygons.',
        gradientBar: 'linear-gradient(to right, #22c55e 0%, #eab308 35%, #ea580c 65%, #dc2626 100%)',
        /** Legend rows (tier labels align with map fill expression in `hmedMapUtils`). */
        floodHubLegendTiers: [
            { label: 'Normal', color: '#22c55e' },
            { label: 'Warning', color: '#eab308' },
            { label: 'Danger', color: '#ea580c' },
            { label: 'Extreme', color: '#dc2626' }
        ],
        documentationLinks: [
            {
                label: 'NWS flood safety (official guidance)',
                href: 'https://www.weather.gov/safety/flood'
            },
            {
                label: 'Google Flood Hub (data context)',
                href: 'https://g.co/floodhub'
            }
        ],
        thresholds: {
            normal: { color: '#22c55e', label: 'Normal' },
            warning: { color: '#eab308', label: 'Warning' },
            danger: { color: '#ea580c', label: 'Danger' },
            extreme: { color: '#dc2626', label: 'Extreme' }
        }
    }
};

/** Max native tile zoom before Mapbox overzooms (sparse tiles). Default 22. */
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

/**
 * Get property name for a layer and hour/return period
 * @param {Object} layerConfig - Entry from LAYER_CONFIG
 * @param {number} hours - Hour window (e.g. 3, 6, 12, 24)
 * @param {string} [returnPeriod=HSI_RETURN_PERIOD] - Return period
 * @param {number} [level] H3 level (6–10); required for precipitation HSI property names
 * @returns {string}
 */
export function getLayerPropertyName(layerConfig, hours, returnPeriod = HSI_RETURN_PERIOD, level) {
    return typeof layerConfig?.propertyAccessor === 'function'
        ? layerConfig.propertyAccessor(hours, returnPeriod, level)
        : getHsiPropertyName(hours, returnPeriod, level);
}

/**
 * Refresh cadence copy for the map footer (Hazard Severity Outlook).
 * @param {string} [layerId='precipitation']
 * @returns {string}
 */
export function getHmedRefreshCadence(layerId = 'precipitation') {
    return LAYER_CONFIG[layerId]?.refreshCadence
        || LAYER_CONFIG.precipitation.refreshCadence;
}
