/**
 * @fileoverview Static / demo GeoJSON and gauge metadata for Google Flood Hub PRD UI.
 * Replace with API + tile-backed sources when Gold layers and fields are available.
 */

/** @type {{ gauges: boolean, riverineShowNormal: boolean, riverineLowerConfidenceOnly: boolean, events: boolean, inundationProbability: boolean, inundationHistory: boolean, urbanFlashFlood: boolean }} */
export const FLOOD_HUB_PRD_DEFAULT_TOGGLES = {
  gauges: true,
  /** When true, show below-warning (normal/green) riverine points; when false, only warning+ tiers. */
  riverineShowNormal: true,
  /** Extended coverage: when false, only `confidence = high` gauges; when true, only `confidence = low`. */
  riverineLowerConfidenceOnly: false,
  events: false,
  inundationProbability: false,
  inundationHistory: false,
  urbanFlashFlood: false,
};

function ring(lon0, lat0, dLon, dLat) {
  return [
    [lon0 - dLon, lat0 - dLat],
    [lon0 + dLon, lat0 - dLat],
    [lon0 + dLon, lat0 + dLat],
    [lon0 - dLon, lat0 + dLat],
    [lon0 - dLon, lat0 - dLat],
  ];
}

const DEMO_SAMPLE_DATA_SOURCE_NOTE = 'Demo sample';

/** @deprecated The map uses pg_tileserv for significant events; kept for docs/tests only. */
export const FLOOD_HUB_STATIC_SIGNIFICANT_EVENTS = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'sfe-demo-001',
      properties: {
        event_id: 'SFE-DEMO-TX-001',
        title: 'Demo: Coastal Plains river response cluster',
        forecast_window_hours: 72,
        impacted_population_estimate: 128400,
        area_sq_km: 4150,
        contributing_gauge_ids: '08150800, 08155240, demo_gauge_verified_a',
        peak_timing_note: 'Forecasts peak in 36–54h (static storyline)',
        dataSourceNote: 'Demo — replace with `event_polygons` from TDIS Gold / API',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [ring(-95.25, 29.72, 0.42, 0.28)],
      },
    },
    {
      type: 'Feature',
      id: 'sfe-demo-002',
      properties: {
        event_id: 'SFE-DEMO-TX-002',
        title: 'Demo: Hill Country tributary grouping',
        forecast_window_hours: 48,
        impacted_population_estimate: 45200,
        area_sq_km: 980,
        contributing_gauge_ids: '08165500, hybas_demo_virtual_1',
        peak_timing_note: 'Forecasts peak in 18–30h (static storyline)',
        dataSourceNote: DEMO_SAMPLE_DATA_SOURCE_NOTE,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [ring(-98.35, 30.05, 0.28, 0.2)],
      },
    },
  ],
};

/**
 * @deprecated Demo GeoJSON only — inundation probability on the map uses `public.google_flood_hub_status` vector tiles.
 * Kept for fixtures / docs.
 */
export const FLOOD_HUB_STATIC_INUNDATION_PROBABILITY = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        cell_id: 'demo-inun-prob-A',
        probability: 0.78,
        native_resolution_note: 'Aggregated to H3 L10 for overlay (static)',
        dataSourceNote: 'Demo — Gold `inundation` rasters → H3 tiles',
      },
      geometry: { type: 'Polygon', coordinates: [ring(-95.6, 29.45, 0.06, 0.05)] },
    },
    {
      type: 'Feature',
      properties: {
        cell_id: 'demo-inun-prob-B',
        probability: 0.42,
        native_resolution_note: 'Aggregated to H3 L10 for overlay (static)',
        dataSourceNote: DEMO_SAMPLE_DATA_SOURCE_NOTE,
      },
      geometry: { type: 'Polygon', coordinates: [ring(-95.45, 29.58, 0.055, 0.045)] },
    },
  ],
};

/**
 * @deprecated Demo GeoJSON only — replace with `public.google_flood_hub_urban_flash_l10` vector tiles when published.
 */
export const FLOOD_HUB_STATIC_URBAN_FLASH = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        cell_id: 'urban-flash-demo-HOU',
        likelihood_24h: 0.63,
        beta_label: 'Beta — Groundsource API deferred (PRD Phase 3)',
        nws_flash_flood_url: 'https://www.weather.gov/safety/flood-flash',
        dataSourceNote: 'Sample overlay only — not live operational data.',
      },
      geometry: { type: 'Polygon', coordinates: [ring(-95.37, 29.76, 0.11, 0.09)] },
    },
    {
      type: 'Feature',
      properties: {
        cell_id: 'urban-flash-demo-DFW',
        likelihood_24h: 0.41,
        beta_label: 'Beta — Groundsource API deferred (PRD Phase 3)',
        nws_flash_flood_url: 'https://www.weather.gov/safety/flood-flash',
        dataSourceNote: 'Sample overlay only — not live operational data.',
      },
      geometry: { type: 'Polygon', coordinates: [ring(-96.85, 32.78, 0.09, 0.07)] },
    },
  ],
};

export const FLOOD_HUB_STATIC_INUNDATION_HISTORY = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        cell_id: 'demo-inun-hist-1',
        historical_frequency: 0.12,
        window_years: '1985–2024 (static label)',
        dataSourceNote: DEMO_SAMPLE_DATA_SOURCE_NOTE,
      },
      geometry: { type: 'Polygon', coordinates: [ring(-97.85, 30.22, 0.07, 0.055)] },
    },
  ],
};

/**
 * Low-zoom aggregated regions (PRD clustering). Not exposed in the Flood Hub overlays UI; kept for fixtures / docs.
 */
export const FLOOD_HUB_STATIC_COARSE_CLUSTERS = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        cluster_id: 'TX-GULF-L6-demo',
        max_tier: 'Danger',
        gauge_count: 12,
        dataSourceNote: 'Demo — server H3 L6–L8 aggregates',
      },
      geometry: { type: 'Polygon', coordinates: [ring(-96.2, 29.5, 1.2, 0.85)] },
    },
    {
      type: 'Feature',
      properties: {
        cluster_id: 'TX-WEST-L6-demo',
        max_tier: 'Warning',
        gauge_count: 6,
        dataSourceNote: DEMO_SAMPLE_DATA_SOURCE_NOTE,
      },
      geometry: { type: 'Polygon', coordinates: [ring(-102.5, 31.5, 1.0, 0.9)] },
    },
  ],
};

/**
 * Side panel enrichments: NWPS link, flags (merge with live MVT when present).
 * `hydrograph` entries are legacy — the gauge panel chart is built from MVT `current_value` / `predicted_peak`.
 * Keys match `gauge_id` from MVT.
 */
export const FLOOD_HUB_STATIC_GAUGE_DETAILS = {
  __default: {
    nwpsUrl: 'https://water.noaa.gov/',
    qualityVerified: null,
    isVirtual: null,
    inundationMapAvailable: false,
    hydrograph: {
      hours: [0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72],
      /** Stage-like series for SVG (meters, fictional demo). */
      values: [2.0, 2.15, 2.45, 2.95, 3.55, 4.1, 4.55, 4.7, 4.4, 4.0, 3.65, 3.35, 3.1],
      warning: 3.5,
      danger: 4.5,
      extreme: 5.3,
    },
  },
  demo_gauge_verified_a: {
    nwpsUrl: 'https://water.noaa.gov/gauges/NWS_DEMO_VERIFIED',
    qualityVerified: true,
    isVirtual: false,
    inundationMapAvailable: true,
    hydrograph: {
      hours: [0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72],
      values: [2.2, 2.35, 2.7, 3.3, 3.95, 4.45, 4.85, 5.0, 4.75, 4.35, 4.0, 3.7, 3.45],
      warning: 3.5,
      danger: 4.5,
      extreme: 5.3,
    },
  },
  hybas_demo_virtual_1: {
    nwpsUrl: null,
    qualityVerified: false,
    isVirtual: true,
    inundationMapAvailable: false,
    hydrograph: {
      hours: [0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72],
      values: [1.1, 1.2, 1.45, 1.75, 2.05, 2.35, 2.5, 2.45, 2.2, 1.95, 1.75, 1.6, 1.45],
      warning: 2.0,
      danger: 2.35,
      extreme: 2.75,
    },
  },
  '08150800': {
    nwpsUrl: 'https://water.noaa.gov/gauges/08150800',
    qualityVerified: true,
    isVirtual: false,
    inundationMapAvailable: true,
    hydrograph: {
      hours: [0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72],
      values: [3.5, 3.65, 4.1, 4.75, 5.5, 6.1, 6.45, 6.35, 5.9, 5.4, 4.95, 4.55, 4.25],
      warning: 4.0,
      danger: 5.0,
      extreme: 6.0,
    },
  },
};

/**
 * @param {string} gaugeId
 * @returns {object}
 */
export function getStaticGaugeDetailRecord(gaugeId) {
  const id = String(gaugeId || '').trim();
  if (id && FLOOD_HUB_STATIC_GAUGE_DETAILS[id]) {
    return { ...FLOOD_HUB_STATIC_GAUGE_DETAILS.__default, ...FLOOD_HUB_STATIC_GAUGE_DETAILS[id] };
  }
  return { ...FLOOD_HUB_STATIC_GAUGE_DETAILS.__default };
}
