/**
 * @fileoverview Centralized map configuration constants.
 * Contains shared configuration values used across map components.
 */

// Tile server base URL from environment variables
export const TILE_SERVER_BASE_URL =
  import.meta.env.VITE_TILE_SERVER_BASE_URL || 'http://localhost:7800';

/**
 * Default map center (Texas)
 */
export const TEXAS_CENTER = [-99.1332, 31.9686];

/**
 * Default map zoom — used only until fitMapToTexas runs on load.
 * Kept intentionally pulled back for wide viewports before fit settles.
 */
export const DEFAULT_ZOOM = 4.25;

/**
 * Soft floor for zoom. Must stay low so widescreen + UI chrome can still frame Texas.
 */
export const TEXAS_MIN_ZOOM = 3;

/** Reserved pixels at top of map canvas for tab navigation (popup placement). */
export const MAP_UI_TOP_PADDING = 80;

/** Reserved pixels at bottom for disclaimer footer. */
export const MAP_UI_BOTTOM_PADDING = 52;

/**
 * Texas bounding box (tight geographic extent) — used by fitMapToTexas.
 */
export const TEXAS_BOUNDS = [
  [-106.645646, 25.837377], // Southwest corner [lng, lat]
  [-93.508292, 36.500704], // Northeast corner [lng, lat]
];

/**
 * Soft pan limit applied AFTER the initial Texas fit.
 * Must be wide east–west: on landscape screens, framing Texas’s height
 * requires a horizontal FOV larger than Texas itself. A tight maxBounds
 * clamps zoom and crops the Panhandle / Rio Grande Valley.
 */
export const TEXAS_MAX_BOUNDS = [
  [-130, 15],
  [-70, 48],
]; /** GeoJSON URL for the exterior gray-out mask (world polygon with Texas hole). */
export const TEXAS_OUTSIDE_MASK_URL = '/texas_outside_mask.geojson';

export const TEXAS_OUTSIDE_MASK_SOURCE_ID = 'texas-outside-mask';
export const TEXAS_OUTSIDE_MASK_LAYER_ID = 'texas-outside-mask-fill';

/** Fill styling for areas outside Texas */
export const TEXAS_OUTSIDE_MASK_STYLE = {
  'fill-color': '#8b949e',
  'fill-opacity': 0.55,
  'fill-outline-color': '#5c6570',
};

/**
 * HMED (Hazard Monitoring & Event Detection) Configuration
 */
export const HMED_CONFIG = {
  // HSI value offset for testing color ranges (set to 0 for production)
  hsiValueOffset: 0,

  // Return period for HSI values ('50' or '100')
  returnPeriod: '50',

  // Available hour options for time window selection
  hourOptions: [3, 6, 12, 24],

  // Default selected hours
  defaultHours: 3,

  // Hex / gauge overlay opacity (lower = more basemap visible underneath)
  hexFillOpacity: 0.5,
  floodHubFillOpacity: 0.45,
  floodHubGaugeCircleOpacity: 0.45,

  // H3 hexagon level configuration
  // Zoom ranges for each H3 level (with overlaps for smooth transitions)
  h3Levels: {
    6: { minZoom: 0, maxZoom: 7 },
    7: { minZoom: 6, maxZoom: 9 },
    8: { minZoom: 8, maxZoom: 11 },
    9: { minZoom: 10, maxZoom: 13 },
    10: { minZoom: 12, maxZoom: 22 },
  },

  /**
   * MVT / DB property name for precipitation HSI (per H3 resolution), e.g. precip_3h_hsi_l6_50yr.
   * @param {number} hours
   * @param {string} [returnPeriod='50'] 50 or 100 (year return period, matches column suffix 50yr / 100yr)
   * @param {number} [level=6] H3 level (6–10); must match the tile layer (l6…l10)
   */
  getHsiPropertyName: (hours, returnPeriod = '50', level = 6) =>
    `precip_${hours}h_hsi_l${level}_${returnPeriod}yr`,
};

/**
 * OSA (Operational Situational Awareness) Configuration
 */
export const OSA_CONFIG = {
  // Value offset for testing color ranges (set to 0 for production)
  valueOffset: 0,

  // Default view mode
  defaultViewMode: 'county',

  // Default layer
  defaultLayer: 'power_outage',

  // View modes
  viewModes: ['county', 'zip', 'utility'],
};

/**
 * Outage severity color buckets (shared between OSA views)
 */
export const OUTAGE_SEVERITY_COLORS = {
  none: { color: '#d9d9d9', opacity: 0.6, label: '1 outage', min: 0, max: 1 },
  minimal: { color: '#FFEB99', opacity: 1, label: '2-50 outages', min: 2, max: 50 },
  low: { color: '#FFA940', opacity: 1, label: '50-499 outages', min: 50, max: 500 },
  moderate: { color: '#FF6B35', opacity: 1, label: '500-999 outages', min: 500, max: 1000 },
  high: { color: '#D64545', opacity: 1, label: '≥ 1,000 outages', min: 1000, max: Infinity },
};

/**
 * HSI severity thresholds (shared for HMED precipitation/wildfire)
 */
export const HSI_SEVERITY_THRESHOLDS = {
  minimal: { min: 0, max: 0.25, label: 'Minimal' },
  elevated: { min: 0.25, max: 0.5, label: 'Elevated' },
  significant: { min: 0.5, max: 1, label: 'Significant' },
  major: { min: 1, max: 1.5, label: 'Major' },
  extreme: { min: 1.5, max: Infinity, label: 'Extreme' },
};

/**
 * CSS for map control positioning
 * Used to offset controls below tab navigation
 */
export const MAP_CONTROLS_CSS = `
    .mapboxgl-ctrl-top-right {
        top: 50px !important;
    }
`;

/**
 * CSS for map popups
 * Ensures popups stay within viewport bounds and are properly styled
 */
export const MAP_POPUP_CSS = `
    /* Base popup container - ensure it stays within map bounds */
    .mapboxgl-popup {
        z-index: 9999 !important;
        max-width: calc(100vw - 24px) !important;
    }
    
    /* Popup content wrapper */
    .mapboxgl-popup-content {
        padding: 0 !important;
        border-radius: 12px !important;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15) !important;
        overflow: hidden !important;
        max-height: calc(100vh - 200px) !important;
        max-width: 100% !important;
    }
    
    /* Mobile-specific popup styles - do NOT override left/right/transform or the map lib cannot position the popup */
    @media (max-width: 640px) {
        .mapboxgl-popup {
            max-width: calc(100vw - 16px) !important;
        }
        
        .mapboxgl-popup-content {
            max-height: calc(100vh - 180px) !important;
            overflow-y: auto !important;
            -webkit-overflow-scrolling: touch;
        }
        
        /* Ensure popup tip doesn't cause overflow */
        .mapboxgl-popup-tip {
            display: none !important;
        }
        
        /* Inner content scrolling */
        .mapboxgl-popup-content > div {
            max-height: calc(100vh - 200px);
            overflow-y: auto;
        }
    }
    
    /* Close button styling */
    .mapboxgl-popup-close-button {
        font-size: 20px !important;
        padding: 4px 8px !important;
        color: #666 !important;
        right: 4px !important;
        top: 4px !important;
        background: rgba(255, 255, 255, 0.9) !important;
        border-radius: 50% !important;
        width: 28px !important;
        height: 28px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        z-index: 10 !important;
    }
    
    .mapboxgl-popup-close-button:hover {
        background: rgba(255, 255, 255, 1) !important;
        color: #333 !important;
    }
    
    /* HMED-specific popup styles */
    .hmed-popup .mapboxgl-popup-content,
    .osa-popup .mapboxgl-popup-content,
    .weather-popup .mapboxgl-popup-content {
        padding: 0 !important;
    }

    @keyframes hmed-popup-enter {
        from {
            opacity: 0;
            transform: translateY(8px) scale(0.98);
        }
        to {
            opacity: 1;
            transform: translateY(0) scale(1);
        }
    }

    .hmed-popup .mapboxgl-popup-content {
        animation: hmed-popup-enter 0.22s cubic-bezier(0.22, 1, 0.36, 1) both;
        box-shadow:
            0 4px 6px -1px rgba(15, 23, 42, 0.08),
            0 12px 28px -6px rgba(15, 23, 42, 0.18) !important;
    }

    .hmed-popup .mapboxgl-popup-tip {
        animation: hmed-popup-enter 0.18s ease-out both;
    }

    /* LTS hex popup */
    .hmed-popup .mapboxgl-popup-content:has(.lts-hex-popup) {
        max-width: min(400px, calc(100vw - 24px)) !important;
        width: min(400px, calc(100vw - 24px)) !important;
        max-height: min(70vh, 560px) !important;
        overflow-y: auto !important;
        -webkit-overflow-scrolling: touch;
    }
    .lts-hex-popup {
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 12px;
        line-height: 1.45;
        color: #334155;
        width: 100%;
        min-width: 320px;
        box-sizing: border-box;
    }
    .lts-hex-popup__head {
        padding: 12px 14px 10px;
        border-bottom: 1px solid #e2e8f0;
        background: linear-gradient(180deg, #f8fafc 0%, #fff 100%);
    }
    .lts-hex-popup__title {
        margin: 0 0 8px;
        font-size: 13px;
        font-weight: 700;
        color: #324755;
        line-height: 1.3;
    }
    .lts-hex-popup__severity {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 8px 10px;
        border-radius: 6px;
        border: 1px solid #e2e8f0;
        border-left-width: 4px;
        background: #fff;
    }
    .lts-hex-popup__severity-level {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #64748b;
    }
    .lts-hex-popup__severity-label {
        font-size: 13px;
        font-weight: 700;
        color: #0f172a;
        line-height: 1.35;
        word-wrap: break-word;
        overflow-wrap: anywhere;
    }
    .lts-hex-popup__section {
        padding: 10px 14px;
        border-bottom: 1px solid #f1f5f9;
    }
    .lts-hex-popup__section--muted {
        padding: 12px 14px;
    }
    .lts-hex-popup__section-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 8px;
    }
    .lts-hex-popup__section-title {
        margin: 0;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #475569;
    }
    .lts-hex-popup__section-hint {
        font-size: 10px;
        color: #94a3b8;
        white-space: nowrap;
    }
    .lts-hex-popup__stats {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px 16px;
        margin-bottom: 10px;
    }
    .lts-hex-popup__stat {
        display: flex;
        flex-direction: column;
        gap: 3px;
        min-width: 0;
    }
    .lts-hex-popup__stat-label {
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #64748b;
    }
    .lts-hex-popup__stat-value {
        font-size: 14px;
        font-weight: 700;
        color: #0f172a;
        font-variant-numeric: tabular-nums;
        word-break: break-word;
    }
    .lts-hex-popup__peak {
        padding: 8px 10px;
        border-radius: 6px;
        background: #fffbeb;
        border: 1px solid #fde68a;
    }
    .lts-hex-popup__peak-label {
        display: block;
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #92400e;
        margin-bottom: 4px;
    }
    .lts-hex-popup__peak-value {
        display: block;
        font-size: 11px;
        font-weight: 500;
        color: #78350f;
        line-height: 1.45;
        word-wrap: break-word;
        overflow-wrap: anywhere;
    }
    .lts-hex-popup__total-row {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 8px;
        padding-bottom: 8px;
        border-bottom: 1px solid #e2e8f0;
    }
    .lts-hex-popup__total-label {
        font-size: 12px;
        font-weight: 600;
        color: #475569;
    }
    .lts-hex-popup__total-value {
        font-size: 18px;
        font-weight: 800;
        color: #0f172a;
        font-variant-numeric: tabular-nums;
    }
    .lts-hex-popup__rows {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-bottom: 10px;
    }
    .lts-hex-popup__row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 3px 0;
        font-size: 11px;
    }
    .lts-hex-popup__row-label {
        color: #475569;
        flex: 1;
        min-width: 0;
        word-wrap: break-word;
    }
    .lts-hex-popup__row-value {
        font-weight: 700;
        color: #0f172a;
        font-variant-numeric: tabular-nums;
        flex-shrink: 0;
    }
    .lts-hex-popup__fac-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        padding-top: 8px;
        border-top: 1px dashed #e2e8f0;
    }
    .lts-hex-popup__fac-card {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 8px 6px;
        border-radius: 6px;
        background: #fff7ed;
        border: 1px solid #ffedd5;
        text-align: center;
        min-width: 0;
    }
    .lts-hex-popup__fac-label {
        font-size: 9px;
        font-weight: 600;
        line-height: 1.25;
        color: #9a3412;
        word-wrap: break-word;
        overflow-wrap: anywhere;
    }
    .lts-hex-popup__fac-value {
        font-size: 15px;
        font-weight: 800;
        color: #c2410c;
        font-variant-numeric: tabular-nums;
    }
    .lts-hex-popup__muted {
        margin: 0;
        font-size: 11px;
        color: #64748b;
        line-height: 1.4;
    }
    .lts-hex-popup__foot {
        padding: 10px 14px 12px;
        background: #f8fafc;
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    .lts-hex-popup__foot-k {
        font-weight: 600;
        color: #64748b;
        margin-right: 4px;
    }
    .lts-hex-popup__h3,
    .lts-hex-popup__run {
        margin: 0;
        font-size: 10px;
        line-height: 1.45;
        color: #475569;
        word-break: break-all;
        overflow-wrap: anywhere;
    }
    .lts-hex-popup__h3 {
        font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    }
    .lts-hex-popup__note {
        margin: 4px 0 0;
        font-size: 10px;
        font-style: italic;
        color: #94a3b8;
        line-height: 1.4;
    }
    @media (max-width: 640px) {
        .lts-hex-popup {
            min-width: 0;
        }
        .lts-hex-popup__fac-grid {
            grid-template-columns: 1fr;
        }
        .lts-hex-popup__stats {
            grid-template-columns: 1fr;
        }
    }
`;

export default {
  TILE_SERVER_BASE_URL,
  TEXAS_CENTER,
  DEFAULT_ZOOM,
  TEXAS_MIN_ZOOM,
  TEXAS_BOUNDS,
  TEXAS_MAX_BOUNDS,
  TEXAS_OUTSIDE_MASK_URL,
  HMED_CONFIG,
  OSA_CONFIG,
  OUTAGE_SEVERITY_COLORS,
  HSI_SEVERITY_THRESHOLDS,
  MAP_CONTROLS_CSS,
  MAP_POPUP_CSS,
};
