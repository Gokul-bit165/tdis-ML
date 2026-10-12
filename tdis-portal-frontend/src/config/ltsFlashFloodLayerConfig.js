/**
 * @fileoverview LTS Flash Flood layer — used only by the dedicated LTS tab (`LtsFlashFloodTab`).
 */

import { CloudRain } from 'lucide-react';
import { HMED_CONFIG } from './mapConfig';

const HSI_RETURN_PERIOD = HMED_CONFIG.returnPeriod;
const getHsiPropertyName = HMED_CONFIG.getHsiPropertyName;

/** Desktop + mobile amber strip; keep in sync with Info modal and docs/HMED_LTS_UI.md */
export const LTS_ANTICIPATORY_DISCLAIMER =
  'Anticipatory planning. LTS shows forecasted flash-flood threat over the next 24 hours—not observed flooding or damage. Use for early situational awareness and preparatory action. Does not replace official NWS flood warnings.';

/** Authoritative flood safety; same links rendered in the Info modal */
export const LTS_DOCUMENTATION_LINKS = [
  {
    label: 'NWS flood safety (official guidance)',
    href: 'https://www.weather.gov/safety/flood',
  },
];

const LTS_POTENTIALLY_HIGH = {
  value: 4,
  color: '#ca8a04',
  label: 'Potentially High',
  chipText: '#713f12',
};
const LTS_POTENTIALLY_VERY_HIGH = {
  value: 5,
  color: '#dc2626',
  label: 'Potentially Very High',
  chipText: '#7f1d1d',
};

/**
 * Full tier metadata (includes Moderate). Map colors use `ltsFillColorByLevel`; UI legend uses `severityLevelsUi`.
 * **Map** (`ltsMapMinVisibleLevel`): hexes with LTS ≥ this value (4–5 = the two flash-hotspot tiers; Moderate hidden).
 */
const LTS_SEVERITY_LEVELS = [
  { value: 3, color: '#6366f1', label: 'Moderate', chipText: '#312e81' },
  LTS_POTENTIALLY_HIGH,
  LTS_POTENTIALLY_VERY_HIGH,
];

/** Panels, Info modal, potential-impact chips — only the two map tiers (4–5); Moderate omitted from UI. */
export const LTS_UI_SEVERITY_LEVELS = [LTS_POTENTIALLY_HIGH, LTS_POTENTIALLY_VERY_HIGH];

/** MVT / DB numeric level → hex fill (1–2 backward-compatible → Moderate color). */
const LTS_FILL_COLOR_BY_LEVEL = {
  1: '#6366f1',
  2: '#6366f1',
  3: '#6366f1',
  4: '#ca8a04',
  5: '#dc2626',
};

/**
 * Single layer entry for LTS Flash Flood (standalone tab).
 */
export const LAYER_CONFIG = {
  lts_flash_flood: {
    id: 'lts_flash_flood',
    name: 'Impact Forecast',
    icon: CloudRain,
    color: '#2563eb',
    hasTimeWindow: false,
    /** Only draw LTS ≥ this ordinal on the map (4–5 = Potentially High / Potentially Very High; lower levels omitted). */
    ltsMapMinVisibleLevel: 4,
    /** H3 table names: `public.precipitation_lts_l6` … `public.precipitation_lts_l10` (pg_tileserv; same pattern as HSI `precipitation_hsi_l*`). */
    levels: [6, 7, 8, 9, 10],
    /**
     * Style-layer render bands (drive layer minzoom/maxzoom via getHexZoomRange). Contiguous so
     * exactly one H3 level renders per zoom; dense high-res tables only turn on once zoomed in.
     */
    hexZoomRangeByLevel: {
      6: { min: 0, max: 8 },
      7: { min: 8, max: 9 },
      8: { min: 9, max: 10 },
      9: { min: 10, max: 11 },
      10: { min: 11, max: 22 },
    },
    /**
     * Source-level minzoom stops the tile REQUEST below the band (layer minzoom only hides
     * rendering — Mapbox may still fetch). Prevents low-zoom fetches of the dense
     * `precipitation_lts_l8/_l9/_l10` tables (1–3M features/tile) that time out server-side.
     * `_l8`/`_l9`/`_l10` are never requested below z9/z10/z11.
     * (Source maxzoom intentionally left at the native default of 22 — matching HSI — so each
     * level is fetched at its own resolution instead of being over-zoomed from a capped z7 tile.)
     */
    vectorTileMinZoomByLevel: {
      6: 0,
      7: 8,
      8: 9,
      9: 10,
      10: 11,
    },
    /** L10 is `public.precipitation_lts_l10` (no `_view` suffix; use empty string, not undefined). */
    level10Suffix: '',
    propertyAccessor: () => 'lts_level',
    severityProperty: 'lts_level',
    severityLevels: LTS_SEVERITY_LEVELS,
    /** Threat severity legend & potential-impact chips (no Moderate row). */
    severityLevelsUi: LTS_UI_SEVERITY_LEVELS,
    ltsFillColorByLevel: LTS_FILL_COLOR_BY_LEVEL,
    documentationLinks: LTS_DOCUMENTATION_LINKS,
    description:
      'Impact Forecast — Localized Threat Severity (LTS) highlights flash-flood hotspots over the next 24 hours. Only the two elevated tiers—Potentially High and Potentially Very High—are drawn on the map. Values reflect modeled, forecasted impacts—not observed damage, losses, or ground-truth conditions. Use alongside—not in place of—official National Weather Service (NWS) flood warnings and local authority directives.',
    /** Legend strip: Potentially High → Potentially Very High (Moderate indigo not shown on map). */
    gradientBar: 'linear-gradient(to right, #eab308 0%, #ca8a04 42%, #dc2626 100%)',
    sourceLayerPrefix: 'public.precipitation_lts',
    thresholds: {
      moderate: { value: 3, color: '#6366f1', label: 'Moderate' },
      high: { value: 4, color: '#ca8a04', label: 'Potentially High' },
      very_high: { value: 5, color: '#dc2626', label: 'Potentially Very High' },
    },
  },
};

export const LTS_LAYER_ID = 'lts_flash_flood';

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
