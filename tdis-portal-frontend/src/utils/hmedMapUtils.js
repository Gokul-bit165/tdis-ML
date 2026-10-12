/**
 * @fileoverview HMED map utilities: H3 zoom ranges, source layer names, color expressions.
 */

import { HMED_CONFIG } from '../config/mapConfig';
import { getLayerPropertyName } from '../config/hmedLayerConfig';

/** Zoom-level ranges by H3 level (overlaps for smooth transitions) */
export const levelToZoomMin = {
  6: 0,
  7: 6,
  8: 8,
  9: 10,
  10: 12,
};

export const levelToZoomMax = {
  6: 7,
  7: 9,
  8: 11,
  9: 13,
  10: 22,
};

/**
 * Mapbox minzoom/maxzoom + visibility band for an H3 level.
 * LTS (see `ltsFlashFloodLayerConfig`) may override L7+ bands; L6 provides coarse hex at low zoom.
 * @param {number} level - H3 resolution 6–10
 * @param {Object} layerConfig - LAYER_CONFIG entry (optional hexZoomRangeByLevel)
 * @returns {{ min: number, max: number }}
 */
export function getHexZoomRange(level, layerConfig) {
  const o = layerConfig?.hexZoomRangeByLevel?.[level];
  if (o && typeof o.min === 'number' && typeof o.max === 'number') {
    return { min: o.min, max: o.max };
  }
  return { min: levelToZoomMin[level], max: levelToZoomMax[level] };
}

const HSI_VALUE_OFFSET = HMED_CONFIG.hsiValueOffset ?? 0;

/**
 * Get source-layer name for a given H3 level and layer config
 * @param {number} level - H3 level (6–10)
 * @param {Object} layerConfig - Entry from LAYER_CONFIG
 * @returns {string}
 */
export function getSourceLayerName(level, layerConfig) {
  if (typeof layerConfig?.getVectorTileSourceLayer === 'function') {
    return layerConfig.getVectorTileSourceLayer(level);
  }
  if (layerConfig?.vectorTileSourceLayer) {
    return layerConfig.vectorTileSourceLayer;
  }
  const baseName = `${layerConfig.sourceLayerPrefix}_l${level}`;
  const suffix = layerConfig.level10Suffix !== undefined ? layerConfig.level10Suffix : '_view';
  return level === 10 ? `${baseName}${suffix}` : baseName;
}

/**
 * MVT layer id inside the PBF (Mapbox `source-layer`). pg_tileserv usually matches the URL segment,
 * but some deployments publish a different internal name — set `layerConfig.mvtSourceLayer` when tiles load (200) but nothing draws.
 * @param {number} level
 * @param {Object} layerConfig
 * @returns {string}
 */
export function getMvtSourceLayerName(level, layerConfig) {
  if (layerConfig?.mvtSourceLayer) {
    return layerConfig.mvtSourceLayer;
  }
  return getSourceLayerName(level, layerConfig);
}

/**
 * Sentinel for missing discharge / peak in MVT (coalesce tail).
 * @type {number}
 */
export const FLOOD_HUB_GAUGE_VALUE_MISSING = -999998;

/** Fully transparent paint (HSI no-fill, Flood Hub no-data). */
const HMED_TRANSPARENT_RGBA = 'rgba(0, 0, 0, 0)';

/** Global maximum expected streamflow (m³/s) for threshold comparisons; avoids huge floats in GPU expressions. */
const FLOOD_HUB_THRESHOLD_SENTINEL_HIGH = 2_000_000_000;

/** Floor used only in “warning+” map filter when warning is absent so features are not dropped. */
const FLOOD_HUB_WARN_FILTER_FLOOR = -1e18;

/** @param {string} snake @param {string} pascal */
function floodHubThresholdToNumber(snake, pascal) {
  return [
    'to-number',
    ['coalesce', ['get', snake], ['get', pascal], FLOOD_HUB_THRESHOLD_SENTINEL_HIGH],
  ];
}

/**
 * Mapbox expression: numeric discharge used for tier (current observation, else forecast peak).
 * @returns {any[]}
 */
export function getFloodHubGaugeTierNumericExpression() {
  return [
    'to-number',
    [
      'coalesce',
      ['get', 'current_value'],
      ['get', 'Current_Value'],
      ['get', 'current'],
      ['get', 'Current'],
      ['get', 'predicted_peak'],
      ['get', 'Predicted_Peak'],
      FLOOD_HUB_GAUGE_VALUE_MISSING,
    ],
  ];
}

/**
 * Mapbox filter: keep only gauges at or above warning threshold (current/peak vs warning).
 * Used when “Normal” visibility is off.
 * @returns {any[]}
 */
export function getFloodHubRiverineWarningPlusOnlyFilter() {
  const val = getFloodHubGaugeTierNumericExpression();
  const warnFloor = [
    'to-number',
    [
      'coalesce',
      ['get', 'warning_threshold'],
      ['get', 'Warning_Threshold'],
      FLOOD_HUB_WARN_FILTER_FLOOR,
    ],
  ];
  return ['>=', val, warnFloor];
}

/**
 * Mapbox filter for the pipeline `confidence` column (`high` / `low`).
 * @param {boolean} [lowerConfidenceOnly=false] - true keeps only `confidence = low`
 * @returns {any[]}
 */
export function getFloodHubGaugeConfidenceFilter(lowerConfidenceOnly = false) {
  const confidence = [
    'downcase',
    ['to-string', ['coalesce', ['get', 'confidence'], ['get', 'Confidence'], '']],
  ];
  return ['==', confidence, lowerConfidenceOnly ? 'low' : 'high'];
}

/**
 * Compose confidence and severity filtering so neither control clears the
 * other's layer filter.
 * @param {boolean} [showNormal=true]
 * @param {boolean} [lowerConfidenceOnly=false]
 * @returns {any[]}
 */
export function getFloodHubRiverineGaugeFilter(
  showNormal = true,
  lowerConfidenceOnly = false
) {
  const confidenceFilter = getFloodHubGaugeConfidenceFilter(lowerConfidenceOnly);
  return showNormal
    ? confidenceFilter
    : ['all', confidenceFilter, getFloodHubRiverineWarningPlusOnlyFilter()];
}

/**
 * Mapbox circle/fill-color expression: Flood Hub gauges by **current** discharge (else forecast peak) vs tier thresholds.
 * Expects MVT: `current_value`, `predicted_peak`, `warning_threshold`, `danger_threshold`, `extreme_threshold` (numeric or strings).
 * @returns {any[]} Mapbox expression
 */
export function getFloodHubPeakThresholdColorExpression() {
  const val = getFloodHubGaugeTierNumericExpression();
  const warn = floodHubThresholdToNumber('warning_threshold', 'Warning_Threshold');
  const danger = floodHubThresholdToNumber('danger_threshold', 'Danger_Threshold');
  const extreme = floodHubThresholdToNumber('extreme_threshold', 'Extreme_Threshold');
  return [
    'case',
    ['<=', val, FLOOD_HUB_GAUGE_VALUE_MISSING + 1],
    HMED_TRANSPARENT_RGBA,
    ['>=', val, extreme],
    '#dc2626',
    ['>=', val, danger],
    '#ea580c',
    ['>=', val, warn],
    '#eab308',
    '#22c55e',
  ];
}

/**
 * Scalar used for tier labels and popups: prefer `current`, else `peak` (matches map coalesce).
 * @param {number|null|undefined} current
 * @param {number|null|undefined} peak
 * @returns {number|null}
 */
export function getFloodHubTierComparisonScalar(current, peak) {
  if (current != null && !Number.isNaN(current)) return current;
  if (peak != null && !Number.isNaN(peak)) return peak;
  return null;
}

/** Fill colors aligned with Flood Hub inundation legend (`FLOOD_HUB_INUNDATION_LEGEND_ITEMS`). */
const INUNDATION_FILL_EXTREME = '#1e3a8a';
const INUNDATION_FILL_SEVERE = '#2563eb';
const INUNDATION_FILL_ABOVE_NORMAL = '#93c5fd';
const INUNDATION_FILL_NO_FLOODING = '#cbd5e1';
const INUNDATION_FILL_UNKNOWN = '#94a3b8';

/**
 * Legend + panel copy for inundation probability (`severity` on `public.google_flood_hub_status`).
 * API tokens are typically `EXTREME` | `SEVERE` | `ABOVE_NORMAL` | `NO_FLOODING` | `UNKNOWN` (case-insensitive).
 */
export const FLOOD_HUB_INUNDATION_LEGEND_ITEMS = [
  { label: 'Extreme', apiToken: 'EXTREME', color: INUNDATION_FILL_EXTREME },
  { label: 'Severe', apiToken: 'SEVERE', color: INUNDATION_FILL_SEVERE },
  { label: 'Above Normal', apiToken: 'ABOVE_NORMAL', color: INUNDATION_FILL_ABOVE_NORMAL },
  { label: 'No Flooding', apiToken: 'NO_FLOODING', color: INUNDATION_FILL_NO_FLOODING },
  { label: 'Unknown', apiToken: 'UNKNOWN', color: INUNDATION_FILL_UNKNOWN },
];

/**
 * @param {unknown} raw - MVT `severity`
 * @returns {string} downcased token; spaces kept (for Mapbox match branches)
 */
export function floodHubInundationSeverityMatchKey(raw) {
  return String(raw ?? '')
    .trim()
    .toLowerCase();
}

/**
 * Collapse string severity to canonical bucket for UI (`extreme` | `severe` | `above_normal` | `no_flooding` | `unknown`).
 * @param {unknown} raw
 * @returns {string}
 */
export function getFloodHubInundationSeverityCanonical(raw) {
  const k = floodHubInundationSeverityMatchKey(raw).replace(/\s+/g, '_');
  if (['extreme', 'severe', 'above_normal', 'no_flooding', 'unknown'].includes(k)) return k;

  /** @type {Record<string, string>} */
  const legacy = {
    very_high: 'extreme',
    danger: 'severe',
    high: 'severe',
    warning: 'above_normal',
    moderate: 'above_normal',
    normal: 'no_flooding',
    low: 'no_flooding',
    no_flood: 'no_flooding',
    none: 'no_flooding',
  };
  return legacy[k] ?? 'unknown';
}

/**
 * @param {unknown} rawSeverity
 * @returns {{ label: string, color: string, canonical: string, apiToken: string }}
 */
export function getFloodHubInundationSeverityPresentation(rawSeverity) {
  const canonical = getFloodHubInundationSeverityCanonical(rawSeverity);
  const byCanon = {
    extreme: { label: 'Extreme', color: INUNDATION_FILL_EXTREME, apiToken: 'EXTREME' },
    severe: { label: 'Severe', color: INUNDATION_FILL_SEVERE, apiToken: 'SEVERE' },
    above_normal: {
      label: 'Above Normal',
      color: INUNDATION_FILL_ABOVE_NORMAL,
      apiToken: 'ABOVE_NORMAL',
    },
    no_flooding: {
      label: 'No Flooding',
      color: INUNDATION_FILL_NO_FLOODING,
      apiToken: 'NO_FLOODING',
    },
    unknown: { label: 'Unknown', color: INUNDATION_FILL_UNKNOWN, apiToken: 'UNKNOWN' },
  };
  const row = byCanon[canonical] ?? byCanon.unknown;
  return { ...row, canonical };
}

/**
 * Mapbox fill-color for Flood Hub status polygons — `severity` from MVT (downcased; supports enum + legacy phrases).
 * @returns {any[]}
 */
export function getFloodHubStatusFillColorExpression() {
  const key = ['downcase', ['to-string', ['coalesce', ['get', 'severity'], '']]];
  return [
    'match',
    key,
    // Canonical (Google-style enum)
    'extreme',
    INUNDATION_FILL_EXTREME,
    'severe',
    INUNDATION_FILL_SEVERE,
    'above_normal',
    INUNDATION_FILL_ABOVE_NORMAL,
    'no_flooding',
    INUNDATION_FILL_NO_FLOODING,
    'unknown',
    INUNDATION_FILL_UNKNOWN,
    // Legacy / alternate phrases (downcase only; spaces preserved)
    'very high',
    INUNDATION_FILL_EXTREME,
    'danger',
    INUNDATION_FILL_SEVERE,
    'high',
    INUNDATION_FILL_SEVERE,
    'warning',
    INUNDATION_FILL_ABOVE_NORMAL,
    'moderate',
    INUNDATION_FILL_ABOVE_NORMAL,
    'normal',
    INUNDATION_FILL_NO_FLOODING,
    'low',
    INUNDATION_FILL_NO_FLOODING,
    'no flood',
    INUNDATION_FILL_NO_FLOODING,
    'none',
    INUNDATION_FILL_NO_FLOODING,
    '',
    INUNDATION_FILL_UNKNOWN,
    '#8b5cf6',
  ];
}

/**
 * Fill opacity for the **inundation probability** overlay, backed by `public.google_flood_hub_status` MVT.
 * Uses the first available numeric among common probability / index fields; defaults to 0.5 when none are set.
 * @returns {any[]}
 */
export function getFloodHubInundationProbabilityOpacityExpression() {
  const severityKey = ['downcase', ['to-string', ['coalesce', ['get', 'severity'], '']]];
  const p = [
    'min',
    1,
    [
      'max',
      0,
      [
        'to-number',
        [
          'coalesce',
          ['get', 'inundation_probability'],
          ['get', 'inundationProbability'],
          ['get', 'probability'],
          ['get', 'Probability'],
          ['get', 'map_index'],
          ['get', 'Map_Index'],
          0.5,
        ],
      ],
    ],
  ];
  const byIndex = ['interpolate', ['linear'], p, 0, 0.12, 1, 0.55];
  /** Low-emphasis cells: not a modeled flood-risk tier for the three-band legend. */
  return [
    'match',
    severityKey,
    'no_flooding',
    0.08,
    'normal',
    0.08,
    'low',
    0.08,
    'no flood',
    0.08,
    'none',
    0.08,
    'unknown',
    0.1,
    '',
    0.1,
    byIndex,
  ];
}

/**
 * pg_tileserv tile template for a Flood Hub MVT layer, with optional per-layer query params
 * (`filter` = SQL predicate, `properties` = comma-separated column allowlist). Mapbox substitutes
 * `{z}/{x}/{y}` anywhere in the string, so the query string may follow them safely.
 * @param {string} tileBase - tile server origin, no trailing slash
 * @param {string} sourceLayer - pg_tileserv layer id, e.g. `public.google_flood_hub_status`
 * @param {Record<string, string|undefined|null>} [query={}] - dropped when empty/blank
 * @returns {string}
 */
export function buildFloodHubTileUrlTemplate(tileBase, sourceLayer, query = {}) {
  const base = `${tileBase}/${sourceLayer}/{z}/{x}/{y}.pbf`;
  const params = Object.entries(query ?? {})
    .filter(([, value]) => typeof value === 'string' && value.trim() !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  return params.length ? `${base}?${params.join('&')}` : base;
}

const URBAN_FLASH_H3_LEVELS = [6, 7, 8, 9, 10];

/**
 * pg_tileserv layer id for urban flash at one H3 resolution.
 * @param {number} level - 6–10
 * @param {object} [layerConfig]
 * @returns {string}
 */
export function getFloodHubUrbanFlashSourceLayerName(level, layerConfig) {
  const prefix =
    layerConfig?.urbanFlashVectorTileSourceLayer || 'public.google_flood_hub_urban_flash_flood';
  return `${prefix}_l${level}`;
}

/** @returns {number[]} */
export function getFloodHubUrbanFlashLevels(layerConfig) {
  const levels = layerConfig?.urbanFlashLevels;
  if (Array.isArray(levels) && levels.length) return levels;
  return URBAN_FLASH_H3_LEVELS;
}

/** Urban flash flood likelihood tiers shown on the map (matches Google Flood Hub beta legend). */
export const FLOOD_HUB_URBAN_FLASH_LIKELIHOOD_ITEMS = [
  { apiToken: 'HIGHLY_LIKELY', label: 'Highly likely', color: '#e07a5f', opacity: 0.5 },
  { apiToken: 'LIKELY', label: 'Likely', color: '#c4a265', opacity: 0.5 },
];

/**
 * @param {string} hex - `#rrggbb`
 * @returns {{ r: number, g: number, b: number }}
 */
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** @deprecated Use per-tier `color` on `FLOOD_HUB_URBAN_FLASH_LIKELIHOOD_ITEMS`. */
export const FLOOD_HUB_URBAN_FLASH_FILL_COLOR = FLOOD_HUB_URBAN_FLASH_LIKELIHOOD_ITEMS[0].color;

/**
 * Mapbox expression for normalized `likelihood` property on urban flash flood MVT.
 * @returns {any[]}
 */
export function getFloodHubUrbanFlashLikelihoodKeyExpression() {
  return ['downcase', ['to-string', ['coalesce', ['get', 'likelihood'], '']]];
}

/**
 * Only render cells at or above the Likely tier (excludes Possible / Unlikely / Not likely).
 * @returns {any[]}
 */
export function getFloodHubUrbanFlashLikelihoodFilter() {
  const key = getFloodHubUrbanFlashLikelihoodKeyExpression();
  return ['match', key, 'highly_likely', true, 'likely', true, false];
}

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function floodHubUrbanFlashLikelihoodMatchKey(raw) {
  return String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
}

/**
 * @param {unknown} rawLikelihood
 * @returns {{ apiToken: string, label: string, opacity: number, color: string }}
 */
export function getFloodHubUrbanFlashLikelihoodPresentation(rawLikelihood) {
  const key = floodHubUrbanFlashLikelihoodMatchKey(rawLikelihood);
  const item = FLOOD_HUB_URBAN_FLASH_LIKELIHOOD_ITEMS.find((i) => i.apiToken === key);
  if (!item) {
    return {
      apiToken: key || 'UNKNOWN',
      label: 'Unknown',
      opacity: 0.4,
      color: '#94a3b8',
    };
  }
  return {
    apiToken: key,
    label: item.label,
    opacity: item.opacity,
    color: item.color,
  };
}

/**
 * Fill color with alpha baked in (`rgba`) so translucency is reliable on Mapbox fill layers.
 * Separate `fill-opacity` is omitted — stacked MVT features would otherwise compound opacity.
 * @returns {any[]}
 */
export function getFloodHubUrbanFlashFillColorExpression() {
  const likelihoodKey = getFloodHubUrbanFlashLikelihoodKeyExpression();
  const pairs = FLOOD_HUB_URBAN_FLASH_LIKELIHOOD_ITEMS.flatMap(({ apiToken, color, opacity }) => {
    const { r, g, b } = hexToRgb(color);
    return [apiToken.toLowerCase(), ['rgba', r, g, b, opacity]];
  });
  return ['match', likelihoodKey, ...pairs, ['rgba', 148, 163, 184, 0]];
}

/**
 * @deprecated Urban flash uses alpha in {@link getFloodHubUrbanFlashFillColorExpression} instead.
 * @returns {any[]}
 */
export function getFloodHubUrbanFlashOpacityExpression() {
  return 1;
}

/**
 * MVT property names for the forecast time window when peak HSI occurs for a given duration (matches DB: start_3h_l6, end_3h_l6).
 * @param {number} hours - 3, 6, 12, or 24
 * @param {number} level - H3 resolution 6–10
 * @returns {{ start: string, end: string }}
 */
export function getImpactTimingPropertyNames(hours, level) {
  return {
    start: `start_${hours}h_l${level}`,
    end: `end_${hours}h_l${level}`,
  };
}

/**
 * Pick the first time window (in hourOptions order) whose HSI equals the max — "highest impact" window.
 * @param {Record<number, number|null|undefined>} hourValues - map hours → HSI
 * @param {number[]} hourOptions - e.g. [3, 6, 12, 24]
 * @returns {number|null} winning hours (3|6|12|24), or null if no valid values
 */
export function findHighestImpactHours(hourValues, hourOptions) {
  let maxVal = -Infinity;
  for (const h of hourOptions) {
    const v = hourValues[h];
    if (v != null && typeof v === 'number' && !Number.isNaN(v)) {
      maxVal = Math.max(maxVal, v);
    }
  }
  if (maxVal === -Infinity) return null;
  for (const h of hourOptions) {
    const v = hourValues[h];
    if (v != null && typeof v === 'number' && !Number.isNaN(v) && v === maxVal) {
      return h;
    }
  }
  return null;
}

/**
 * Format ISO timestamps for hex popups (LTS `peak_start_time` / `peak_end_time`, HMED impact timing).
 * Uses the viewer's local timezone.
 * @param {unknown} raw
 * @returns {string}
 */
export function formatIsoTimeForPopup(raw) {
  if (raw == null) return 'N/A';
  const s = String(raw).trim();
  if (!s) return 'N/A';
  const ms = Date.parse(s);
  if (Number.isNaN(ms)) return s;
  const d = new Date(ms);
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

/** Escape text for safe insertion into `Popup#setHTML` strings. */
export function escapeHtmlForPopup(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Parse `precipitation_lts_* .hsi_peak` (DB type often `text`): MVT may deliver strings, numbers, or
 * ETL sentinels like the literal "None".
 * @param {unknown} raw
 * @returns {number|null}
 */
function parseHsiPeakScalar(raw) {
  if (raw == null) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const s = String(raw).trim();
  if (!s) return null;
  const low = s.toLowerCase();
  if (low === 'none' || low === 'null' || low === 'nan' || low === 'undefined') return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Read MVT property; keys are case-insensitive (e.g. `Hsi_Peak` vs `hsi_peak`).
 * @param {Record<string, unknown> | null | undefined} props
 * @param {string} key
 * @returns {unknown}
 */
function getMvtPropertyCaseInsensitive(props, key) {
  if (props == null || typeof props !== 'object') return undefined;
  if (Object.prototype.hasOwnProperty.call(props, key)) return props[key];
  const kLower = key.toLowerCase();
  for (const k of Object.keys(props)) {
    if (k.toLowerCase() === kLower) return props[k];
  }
  return undefined;
}

/**
 * Mapbox layer filter: draw only hexes at or above this ordinal.
 * @param {string} ltsPropertyName - MVT field, e.g. `lts_level`
 * @param {number} minLevel
 * @returns {any[]|undefined} Mapbox filter, or `undefined` when no filter (show all)
 */
export function getLtsHexMapFilter(ltsPropertyName, minLevel) {
  if (minLevel == null || minLevel <= 1) return undefined;
  return ['>=', ['to-number', ['coalesce', ['get', ltsPropertyName], '0']], minLevel];
}

/** MVT attribute names for LTS HSI max in the 24h window. */
const HSI_PEAK_KEY_RE = /^(hsi_peak|peak_hsi|max_hsi|hsi_max)(_l(6|7|8|9|10))?$/i;

/**
 * LTS hex popup “HSI peak” — `feature.properties` from pg_tileserv/Mapbox; keys may not match table casing.
 * Tries: `hsi_peak`, `hsi_peak_l{h3Level}`, then any key matching `hsi_peak` / `hsi_peak_l6`…`l10` (any case).
 * @param {Record<string, unknown>} props - MVT feature.properties
 * @param {number} h3Level - H3 resolution 6–10 (active hex layer)
 * @returns {number|null}
 */
export function getLtsHsiPeakValue(props, h3Level) {
  if (!props || typeof props !== 'object') return null;
  const primary = [
    'hsi_peak',
    `hsi_peak_l${h3Level}`,
    'peak_hsi',
    `peak_hsi_l${h3Level}`,
    'max_hsi',
    'hsi_max',
  ];
  for (const k of primary) {
    const n = parseHsiPeakScalar(getMvtPropertyCaseInsensitive(props, k));
    if (n != null) return n;
  }
  const rank = (k) => {
    const t = k.toLowerCase();
    if (t === 'hsi_peak' || t === 'peak_hsi' || t === 'max_hsi' || t === 'hsi_max') return 0;
    if (/^hsi_peak_l\d+$/i.test(t) || /^peak_hsi_l\d+$/i.test(t)) return 1;
    return 2;
  };
  const extras = Object.keys(props)
    .filter((k) => HSI_PEAK_KEY_RE.test(k))
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  for (const k of extras) {
    const n = parseHsiPeakScalar(props[k]);
    if (n != null) return n;
  }
  return null;
}

/**
 * Build Mapbox fill-color expression for HSI (continuous) or LTS (ordinal 1–5) values
 * @param {Object} layerConfig - Entry from LAYER_CONFIG
 * @param {number} selectedHours - Selected hour window (e.g. 3, 6, 12, 24)
 * @param {number} [hsiValueOffset=0] - Offset for testing color ranges
 * @param {number} [level] H3 level (6–10) for precipitation HSI property names; ignored for LTS
 * @returns {Array} Mapbox expression array
 */
export function getColorExpression(
  layerConfig,
  selectedHours,
  hsiValueOffset = HSI_VALUE_OFFSET,
  level
) {
  const propertyName = getLayerPropertyName(layerConfig, selectedHours, undefined, level);

  if (layerConfig.floodHubGauge) {
    return getFloodHubPeakThresholdColorExpression();
  }

  if (layerConfig.ltsFillColorByLevel && typeof layerConfig.ltsFillColorByLevel === 'object') {
    const m = layerConfig.ltsFillColorByLevel;
    const unknownOrEmpty = 'rgba(59, 130, 246, 0.38)';
    const strPairs = ['1', '2', '3', '4', '5'].flatMap((k) => [k, m[k]]);
    return [
      'match',
      ['to-string', ['coalesce', ['get', propertyName], '']],
      ...strPairs,
      unknownOrEmpty,
    ];
  }

  if (layerConfig.severityLevels && Array.isArray(layerConfig.severityLevels)) {
    // Ordinal match (non-LTS or legacy config without ltsFillColorByLevel).
    const levels = [...layerConfig.severityLevels].sort((a, b) => a.value - b.value);
    const unknownOrEmpty = 'rgba(59, 130, 246, 0.38)';
    const strPairs = levels.flatMap((s) => [String(s.value), s.color]);
    return [
      'match',
      ['to-string', ['coalesce', ['get', propertyName], '']],
      ...strPairs,
      unknownOrEmpty,
    ];
  }

  return [
    'case',
    ['has', propertyName],
    [
      'case',
      ['<=', ['to-number', ['get', propertyName]], 0],
      HMED_TRANSPARENT_RGBA,
      [
        'interpolate',
        ['linear'],
        ['+', ['to-number', ['get', propertyName]], hsiValueOffset],
        ...layerConfig.gradient,
      ],
    ],
    HMED_TRANSPARENT_RGBA,
  ];
}

/**
 * Short display label for Flood Hub `unit` from MVT (e.g. discharge).
 * @param {unknown} unitRaw
 * @returns {string}
 */
export function formatFloodHubUnitLabel(unitRaw) {
  if (unitRaw == null || String(unitRaw).trim() === '') return '';
  const u = String(unitRaw).trim();
  if (u === 'CUBIC_METERS_PER_SECOND') return 'm³/s';
  return u;
}

/**
 * @param {unknown} v
 * @returns {number|null}
 */
function parseOptionalCoordinate(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse WKT POINT(lon lat) / POINT (lon lat) to decimal degrees.
 * @param {unknown} s
 * @returns {{ lat: number; lon: number } | null}
 */
function tryParseWktPoint(s) {
  if (typeof s !== 'string') return null;
  let t = s.trim();
  const semi = t.indexOf(';');
  if (/^SRID=\d+;/i.test(t) && semi !== -1) {
    t = t.slice(semi + 1).trim();
  }
  const m = t.match(/^POINT\s*\(\s*([+-]?\d+(?:\.\d+)?)\s+([+-]?\d+(?:\.\d+)?)\s*\)\s*$/i);
  if (!m) return null;
  const lon = Number(m[1]);
  const lat = Number(m[2]);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  return { lat, lon };
}

/**
 * @param {unknown} s
 * @returns {{ lat: number; lon: number } | null}
 */
function tryParseGeoJsonPointString(s) {
  if (typeof s !== 'string' || !s.trim().startsWith('{')) return null;
  try {
    const g = JSON.parse(s);
    if (g?.type === 'Point' && Array.isArray(g.coordinates) && g.coordinates.length >= 2) {
      const lon = Number(g.coordinates[0]);
      const lat = Number(g.coordinates[1]);
      if (Number.isFinite(lon) && Number.isFinite(lat)) return { lat, lon };
    }
  } catch {
    /* ignore invalid JSON */
  }
  return null;
}

/**
 * Prefer encoded point columns sometimes included in gauge tiles (not separate lat/lon attributes).
 * @param {Record<string, unknown>} props
 * @returns {{ lat: number; lon: number } | null}
 */
function coordsFromGaugeGeometryProps(props) {
  const keys = [
    'gauge_point',
    'point_wkt',
    'geom_wkt',
    'geometry_wkt',
    'location_wkt',
    'wkt',
    'geometry',
    'geom',
    'location',
    'representative_point',
  ];
  for (const key of keys) {
    const raw = getMvtPropertyCaseInsensitive(props, key);
    if (typeof raw !== 'string') continue;
    const t = raw.trim();
    if (!t) continue;
    const fromWkt = tryParseWktPoint(t);
    if (fromWkt) return fromWkt;
    const fromGj = tryParseGeoJsonPointString(t);
    if (fromGj) return fromGj;
  }
  return null;
}

/** Day offsets relative to model / run "today" for daily discharge series in gauge tiles. */
export const FLOOD_HUB_DISCHARGE_DAY_OFFSETS = Object.freeze([-2, -1, 0, 1, 2, 3, 4, 5]);

/**
 * Read per-day model discharge from MVT when the pipeline adds curr_minus_* / curr_plus_* columns.
 * "Today" (offset 0) falls back to `current_value` if no curr_0 / curr alias.
 * @param {Record<string, unknown> | null | undefined} props
 * @returns {{ dayOffsets: readonly number[], values: (number|null)[] } | null}
 */
export function getFloodHubDailyDischarge(props) {
  if (!props || typeof props !== 'object') return null;
  const hasDailyColumn = [
    'curr_minus_2',
    'curr_minus_1',
    'curr_plus_1',
    'curr_plus_2',
    'curr_plus_3',
    'curr_plus_4',
    'curr_plus_5',
    'curr_0',
    'curr',
  ].some((k) => {
    const v = getMvtPropertyCaseInsensitive(props, k);
    return v != null && String(v).trim() !== '';
  });
  if (!hasDailyColumn) return null;

  /** @type {string[][]} */
  const keyLists = [
    ['curr_minus_2', 'current_minus_2'],
    ['curr_minus_1', 'current_minus_1'],
    ['curr_0', 'curr', 'current_day', 'curr_today', 'today_discharge', 'current_value'],
    ['curr_plus_1', 'current_plus_1'],
    ['curr_plus_2', 'current_plus_2'],
    ['curr_plus_3', 'current_plus_3'],
    ['curr_plus_4', 'current_plus_4'],
    ['curr_plus_5', 'current_plus_5'],
  ];

  const values = keyLists.map((keys) => {
    for (const k of keys) {
      const v = parseHsiPeakScalar(getMvtPropertyCaseInsensitive(props, k));
      if (v != null && Number.isFinite(v)) return v;
    }
    return null;
  });

  const finiteCount = values.filter((v) => v != null && Number.isFinite(v)).length;
  if (finiteCount < 2) return null;

  return { dayOffsets: FLOOD_HUB_DISCHARGE_DAY_OFFSETS, values };
}

/**
 * Read Flood Hub gauge fields for hex popups (keys may vary in case).
 * @param {Record<string, unknown> | null | undefined} props - feature.properties
 * @returns {{ peak: number|null, current: number|null, warning: number|null, danger: number|null, extreme: number|null, gaugeId: string, unit: string, fetchedAt: string, h3Id: string, qualityVerified: boolean|null, nwpsUrl: string, isVirtual: boolean|null, gaugeDataSource: string, gaugeLatitude: number|null, gaugeLongitude: number|null, gaugeStationName: string, inundationMapStatus: string }}
 */
export function getFloodHubPopupFields(props) {
  const empty = {
    peak: null,
    current: null,
    warning: null,
    danger: null,
    extreme: null,
    gaugeId: '',
    unit: '',
    fetchedAt: '',
    h3Id: '',
    qualityVerified: null,
    nwpsUrl: '',
    isVirtual: null,
    gaugeDataSource: '',
    gaugeLatitude: null,
    gaugeLongitude: null,
    gaugeStationName: '',
    inundationMapStatus: '',
    dischargeByDay: null,
  };
  if (!props || typeof props !== 'object') return empty;
  const idHex =
    getMvtPropertyCaseInsensitive(props, 'h3_l10_id') ??
    getMvtPropertyCaseInsensitive(props, 'h3_l10_hex');
  const qvRaw =
    getMvtPropertyCaseInsensitive(props, 'quality_verified') ??
    getMvtPropertyCaseInsensitive(props, 'qualityVerified');
  let qualityVerified = null;
  if (qvRaw === true || qvRaw === false) qualityVerified = qvRaw;
  else if (qvRaw === 1 || qvRaw === '1' || String(qvRaw).toLowerCase() === 'true')
    qualityVerified = true;
  else if (qvRaw === 0 || qvRaw === '0' || String(qvRaw).toLowerCase() === 'false')
    qualityVerified = false;
  const virtRaw =
    getMvtPropertyCaseInsensitive(props, 'is_virtual') ??
    getMvtPropertyCaseInsensitive(props, 'isVirtual');
  let isVirtual = null;
  if (virtRaw === true || virtRaw === false) isVirtual = virtRaw;
  else if (virtRaw === 1 || virtRaw === '1' || String(virtRaw).toLowerCase() === 'true')
    isVirtual = true;
  else if (virtRaw === 0 || virtRaw === '0' || String(virtRaw).toLowerCase() === 'false')
    isVirtual = false;
  const nwps =
    getMvtPropertyCaseInsensitive(props, 'nwps_gauge_url') ??
    getMvtPropertyCaseInsensitive(props, 'nwps_url') ??
    getMvtPropertyCaseInsensitive(props, 'authoritative_gauge_url');

  let gaugeLatitude = parseOptionalCoordinate(
    getMvtPropertyCaseInsensitive(props, 'latitude') ??
      getMvtPropertyCaseInsensitive(props, 'lat') ??
      getMvtPropertyCaseInsensitive(props, 'gauge_lat')
  );
  let gaugeLongitude = parseOptionalCoordinate(
    getMvtPropertyCaseInsensitive(props, 'longitude') ??
      getMvtPropertyCaseInsensitive(props, 'lon') ??
      getMvtPropertyCaseInsensitive(props, 'lng') ??
      getMvtPropertyCaseInsensitive(props, 'gauge_lon')
  );
  if (gaugeLatitude == null || gaugeLongitude == null) {
    const fromGeom = coordsFromGaugeGeometryProps(props);
    if (fromGeom) {
      gaugeLatitude = fromGeom.lat;
      gaugeLongitude = fromGeom.lon;
    }
  }

  return {
    peak: parseHsiPeakScalar(getMvtPropertyCaseInsensitive(props, 'predicted_peak')),
    current: parseHsiPeakScalar(getMvtPropertyCaseInsensitive(props, 'current_value')),
    warning: parseHsiPeakScalar(getMvtPropertyCaseInsensitive(props, 'warning_threshold')),
    danger: parseHsiPeakScalar(getMvtPropertyCaseInsensitive(props, 'danger_threshold')),
    extreme: parseHsiPeakScalar(getMvtPropertyCaseInsensitive(props, 'extreme_threshold')),
    gaugeId: String(getMvtPropertyCaseInsensitive(props, 'gauge_id') ?? ''),
    unit: String(getMvtPropertyCaseInsensitive(props, 'unit') ?? ''),
    fetchedAt: String(getMvtPropertyCaseInsensitive(props, 'fetched_at') ?? ''),
    h3Id: idHex != null ? String(idHex) : '',
    qualityVerified,
    nwpsUrl: nwps != null ? String(nwps) : '',
    isVirtual,
    gaugeDataSource: String(
      getMvtPropertyCaseInsensitive(props, 'gauge_data_source') ??
        getMvtPropertyCaseInsensitive(props, 'data_source') ??
        getMvtPropertyCaseInsensitive(props, 'source') ??
        ''
    ).trim(),
    gaugeLatitude,
    gaugeLongitude,
    gaugeStationName: String(
      getMvtPropertyCaseInsensitive(props, 'gauge_station_name') ??
        getMvtPropertyCaseInsensitive(props, 'station_name') ??
        getMvtPropertyCaseInsensitive(props, 'site_name') ??
        getMvtPropertyCaseInsensitive(props, 'gauge_name') ??
        ''
    ).trim(),
    inundationMapStatus: String(
      getMvtPropertyCaseInsensitive(props, 'inundation_map_status') ??
        getMvtPropertyCaseInsensitive(props, 'inundation_map') ??
        getMvtPropertyCaseInsensitive(props, 'inundation_availability') ??
        ''
    ).trim(),
    dischargeByDay: getFloodHubDailyDischarge(props),
  };
}

/**
 * Tier label from discharge vs thresholds (same ordering as map: extreme ≥ danger ≥ warning ≥ normal).
 * @param {number|null} discharge - observed current and/or forecast peak scalar (see `getFloodHubTierComparisonScalar`)
 * @param {number|null} w
 * @param {number|null} d
 * @param {number|null} e
 * @returns {string}
 */
export function getFloodHubTierLabel(discharge, w, d, e) {
  if (discharge == null || w == null) return 'No data';
  if (e != null && !Number.isNaN(e) && discharge >= e) return 'Extreme';
  if (d != null && !Number.isNaN(d) && discharge >= d) return 'Danger';
  if (!Number.isNaN(w) && discharge >= w) return 'Warning';
  return 'Normal';
}
