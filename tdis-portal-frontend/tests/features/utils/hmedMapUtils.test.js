/**
 * @fileoverview Unit tests for utils/hmedMapUtils
 * HMED map utilities: H3 zoom ranges, source layer names, color expressions.
 */
import { describe, it, expect } from 'vitest';
import {
  levelToZoomMin,
  levelToZoomMax,
  getHexZoomRange,
  getSourceLayerName,
  getMvtSourceLayerName,
  getColorExpression,
  getFloodHubPeakThresholdColorExpression,
  getFloodHubGaugeConfidenceFilter,
  getFloodHubRiverineGaugeFilter,
  getFloodHubRiverineWarningPlusOnlyFilter,
  getFloodHubTierComparisonScalar,
  getFloodHubStatusFillColorExpression,
  getFloodHubInundationProbabilityOpacityExpression,
  getFloodHubUrbanFlashOpacityExpression,
  getFloodHubUrbanFlashFillColorExpression,
  getFloodHubUrbanFlashLikelihoodFilter,
  getFloodHubUrbanFlashLikelihoodPresentation,
  FLOOD_HUB_URBAN_FLASH_LIKELIHOOD_ITEMS,
  getFloodHubPopupFields,
  getFloodHubTierLabel,
  getFloodHubInundationSeverityPresentation,
  FLOOD_HUB_INUNDATION_LEGEND_ITEMS,
  getImpactTimingPropertyNames,
  findHighestImpactHours,
  getLtsHsiPeakValue,
  getLtsHexMapFilter,
  buildFloodHubTileUrlTemplate,
  getFloodHubUrbanFlashSourceLayerName,
  getFloodHubUrbanFlashLevels,
  formatIsoTimeForPopup,
  escapeHtmlForPopup,
} from '@/utils/hmedMapUtils';
import { LAYER_CONFIG } from '@/config/hmedLayerConfig';
import { LAYER_CONFIG as LTS_LAYER_CONFIG } from '@/config/ltsFlashFloodLayerConfig';

const GOOGLE_FLOOD_HUB_GAUGES_LAYER = 'public.google_flood_hub_gauges';

describe('hmedMapUtils', () => {
  describe('levelToZoomMin / levelToZoomMax', () => {
    it('levelToZoomMin has expected H3 level keys', () => {
      expect(levelToZoomMin).toMatchObject({
        6: 0,
        7: 6,
        8: 8,
        9: 10,
        10: 12,
      });
    });

    it('levelToZoomMax has expected H3 level keys', () => {
      expect(levelToZoomMax).toMatchObject({
        6: 7,
        7: 9,
        8: 11,
        9: 13,
        10: 22,
      });
    });
  });

  describe('getSourceLayerName', () => {
    const layerConfig = { sourceLayerPrefix: 'public.precipitation_hsi' };

    it('returns base name for level 6', () => {
      expect(getSourceLayerName(6, layerConfig)).toBe('public.precipitation_hsi_l6');
    });

    it('returns base name for level 9', () => {
      expect(getSourceLayerName(9, layerConfig)).toBe('public.precipitation_hsi_l9');
    });

    it('appends _view for level 10', () => {
      expect(getSourceLayerName(10, layerConfig)).toBe('public.precipitation_hsi_l10_view');
    });

    it('LTS uses public.precipitation_lts_l* table names; l10 has no _view suffix', () => {
      const cfg = LTS_LAYER_CONFIG.lts_flash_flood;
      expect(getSourceLayerName(6, cfg)).toBe('public.precipitation_lts_l6');
      expect(getSourceLayerName(9, cfg)).toBe('public.precipitation_lts_l9');
      expect(getSourceLayerName(10, cfg)).toBe('public.precipitation_lts_l10');
    });

    it('Google Flood Hub uses flat vectorTileSourceLayer for all H3 levels', () => {
      const cfg = LAYER_CONFIG.google_flood_hub;
      expect(getSourceLayerName(10, cfg)).toBe(GOOGLE_FLOOD_HUB_GAUGES_LAYER);
    });

    it('getMvtSourceLayerName overrides Mapbox source-layer when mvtSourceLayer is set', () => {
      const cfg = {
        vectorTileSourceLayer: GOOGLE_FLOOD_HUB_GAUGES_LAYER,
        mvtSourceLayer: 'google_flood_hub_gauges',
      };
      expect(getSourceLayerName(10, cfg)).toBe(GOOGLE_FLOOD_HUB_GAUGES_LAYER);
      expect(getMvtSourceLayerName(10, cfg)).toBe('google_flood_hub_gauges');
    });
  });

  describe('getColorExpression', () => {
    it('returns Mapbox expression array with case/interpolate', () => {
      const layerConfig = LAYER_CONFIG.precipitation;
      const expr = getColorExpression(layerConfig, 3, 0, 6);
      expect(Array.isArray(expr)).toBe(true);
      expect(expr[0]).toBe('case');
      expect(expr[1]).toEqual(['has', 'precip_3h_hsi_l6_50yr']);
      const innerCase = expr[2];
      expect(innerCase[0]).toBe('case');
      expect(innerCase[1]).toEqual(['<=', ['to-number', ['get', 'precip_3h_hsi_l6_50yr']], 0]);
      expect(innerCase[2]).toBe('rgba(0, 0, 0, 0)');
      expect(innerCase[3][0]).toBe('interpolate');
      expect(innerCase[3][1]).toEqual(['linear']);
      expect(expr[3]).toBe('rgba(0, 0, 0, 0)');
    });

    it('uses custom hsiValueOffset when provided', () => {
      const layerConfig = LAYER_CONFIG.precipitation;
      const expr = getColorExpression(layerConfig, 6, 0.5, 6);
      const innerCase = expr[2];
      const interpolate = innerCase[3];
      expect(interpolate[2]).toEqual(['+', ['to-number', ['get', 'precip_6h_hsi_l6_50yr']], 0.5]);
    });

    it('LTS uses ltsFillColorByLevel match (1–2 → Moderate color) and HSI-aligned unknown tint', () => {
      const cfg = LTS_LAYER_CONFIG.lts_flash_flood;
      const expr = getColorExpression(cfg, 3, 0, undefined);
      expect(expr[0]).toBe('match');
      expect(expr[expr.length - 1]).toBe('rgba(59, 130, 246, 0.38)');
      const oneIdx = expr.indexOf('1');
      expect(oneIdx).toBeGreaterThan(0);
      expect(expr[oneIdx + 1]).toBe('#6366f1');
      expect(expr[expr.indexOf('4') + 1]).toBe('#ca8a04');
      expect(expr[expr.indexOf('5') + 1]).toBe('#dc2626');
    });

    it('Google Flood Hub uses current-or-peak-vs-threshold case expression', () => {
      const cfg = LAYER_CONFIG.google_flood_hub;
      const expr = getColorExpression(cfg, 3, 0, 10);
      expect(expr).toEqual(getFloodHubPeakThresholdColorExpression());
      expect(expr[0]).toBe('case');
      expect(expr).toContain('#dc2626');
      expect(expr).toContain('#22c55e');
      const json = JSON.stringify(expr);
      expect(json).toContain('current_value');
      expect(json).toContain('predicted_peak');
    });
  });

  describe('getFloodHubRiverineWarningPlusOnlyFilter', () => {
    it('is a >= filter on tier value vs warning floor', () => {
      const f = getFloodHubRiverineWarningPlusOnlyFilter();
      expect(f[0]).toBe('>=');
      expect(JSON.stringify(f)).toContain('warning_threshold');
    });
  });

  describe('getFloodHubGaugeConfidenceFilter', () => {
    it('defaults to the pipeline high-confidence value', () => {
      const filter = getFloodHubGaugeConfidenceFilter();
      expect(filter[0]).toBe('==');
      expect(filter[2]).toBe('high');
      expect(JSON.stringify(filter)).toContain('confidence');
    });

    it('selects the pipeline low-confidence value', () => {
      const filter = getFloodHubGaugeConfidenceFilter(true);
      expect(filter[2]).toBe('low');
      const json = JSON.stringify(filter);
      expect(json).toContain('confidence');
      expect(json).not.toContain('quality_verified');
    });
  });

  describe('getFloodHubRiverineGaugeFilter', () => {
    it('restricts to high confidence when extended coverage is off', () => {
      expect(getFloodHubRiverineGaugeFilter(true, false)).toEqual(
        getFloodHubGaugeConfidenceFilter(false)
      );
    });

    it('restricts to low confidence when extended coverage is on', () => {
      expect(getFloodHubRiverineGaugeFilter(true, true)).toEqual(
        getFloodHubGaugeConfidenceFilter(true)
      );
    });

    it('combines low confidence with the warning-plus severity filter', () => {
      expect(getFloodHubRiverineGaugeFilter(false, true)).toEqual([
        'all',
        getFloodHubGaugeConfidenceFilter(true),
        getFloodHubRiverineWarningPlusOnlyFilter(),
      ]);
    });

    it('combines high confidence with the warning-plus severity filter', () => {
      expect(getFloodHubRiverineGaugeFilter(false, false)).toEqual([
        'all',
        getFloodHubGaugeConfidenceFilter(false),
        getFloodHubRiverineWarningPlusOnlyFilter(),
      ]);
    });
  });

  describe('getFloodHubTierComparisonScalar', () => {
    it('prefers current over peak', () => {
      expect(getFloodHubTierComparisonScalar(5, 99)).toBe(5);
      expect(getFloodHubTierComparisonScalar(null, 99)).toBe(99);
      expect(getFloodHubTierComparisonScalar(undefined, 12.5)).toBeCloseTo(12.5, 5);
      expect(getFloodHubTierComparisonScalar(null, null)).toBe(null);
    });
  });

  describe('getFloodHubStatusFillColorExpression', () => {
    it('maps canonical severities to legend blues', () => {
      const expr = getFloodHubStatusFillColorExpression();
      expect(expr[0]).toBe('match');
      expect(expr).toContain('severe');
      expect(expr).toContain('#2563eb');
      expect(expr).toContain('above_normal');
      expect(expr).toContain('#93c5fd');
      expect(expr).toContain('#8b5cf6');
    });
  });

  describe('getFloodHubInundationProbabilityOpacityExpression', () => {
    it('wraps index interpolate in severity match for low-emphasis tiers', () => {
      const expr = getFloodHubInundationProbabilityOpacityExpression();
      expect(expr[0]).toBe('match');
      const json = JSON.stringify(expr);
      expect(json).toContain('no_flooding');
      expect(json).toContain('interpolate');
      expect(json).toContain('coalesce');
    });
  });

  describe('getFloodHubInundationSeverityPresentation', () => {
    it('maps API enum tokens to legend labels', () => {
      expect(getFloodHubInundationSeverityPresentation('SEVERE').label).toBe('Severe');
      expect(getFloodHubInundationSeverityPresentation('SEVERE').color).toBe('#2563eb');
      expect(getFloodHubInundationSeverityPresentation('EXTREME').label).toBe('Extreme');
      expect(getFloodHubInundationSeverityPresentation('ABOVE_NORMAL').label).toBe('Above Normal');
      expect(getFloodHubInundationSeverityPresentation('NO_FLOODING').label).toBe('No Flooding');
      expect(getFloodHubInundationSeverityPresentation('UNKNOWN').label).toBe('Unknown');
    });

    it('legend items stay in sync with presentation palette', () => {
      const sev = getFloodHubInundationSeverityPresentation('SEVERE');
      const legend = FLOOD_HUB_INUNDATION_LEGEND_ITEMS.find((i) => i.apiToken === 'SEVERE');
      expect(legend?.color).toBe(sev.color);
    });
  });

  describe('getFloodHubUrbanFlashOpacityExpression', () => {
    it('returns constant 1 (alpha lives in fill-color rgba)', () => {
      expect(getFloodHubUrbanFlashOpacityExpression()).toBe(1);
    });
  });

  describe('getFloodHubUrbanFlashFillColorExpression', () => {
    it('returns match expression with rgba per-tier colors', () => {
      const expr = getFloodHubUrbanFlashFillColorExpression();
      expect(expr[0]).toBe('match');
      expect(JSON.stringify(expr)).toContain('rgba');
      expect(expr).not.toContain('#7c3aed');
    });
  });

  describe('getFloodHubUrbanFlashLikelihoodFilter', () => {
    it('includes only likely and highly_likely tiers', () => {
      const filter = getFloodHubUrbanFlashLikelihoodFilter();
      expect(filter[0]).toBe('match');
      expect(filter).toContain('highly_likely');
      expect(filter).toContain('likely');
      expect(filter).not.toContain('possible');
    });
  });

  describe('getFloodHubUrbanFlashLikelihoodPresentation', () => {
    it('maps API enum tokens to legend labels', () => {
      expect(getFloodHubUrbanFlashLikelihoodPresentation('HIGHLY_LIKELY').label).toBe(
        'Highly likely'
      );
      expect(getFloodHubUrbanFlashLikelihoodPresentation('LIKELY').label).toBe('Likely');
      expect(getFloodHubUrbanFlashLikelihoodPresentation('POSSIBLE').label).toBe('Unknown');
      expect(getFloodHubUrbanFlashLikelihoodPresentation('unknown').label).toBe('Unknown');
    });

    it('legend lists only likely tiers', () => {
      expect(FLOOD_HUB_URBAN_FLASH_LIKELIHOOD_ITEMS).toHaveLength(2);
      expect(FLOOD_HUB_URBAN_FLASH_LIKELIHOOD_ITEMS.map((i) => i.apiToken)).toEqual([
        'HIGHLY_LIKELY',
        'LIKELY',
      ]);
    });

    it('aligns with legend items', () => {
      const highly = getFloodHubUrbanFlashLikelihoodPresentation('HIGHLY_LIKELY');
      const legend = FLOOD_HUB_URBAN_FLASH_LIKELIHOOD_ITEMS.find(
        (i) => i.apiToken === 'HIGHLY_LIKELY'
      );
      expect(highly.opacity).toBe(legend?.opacity);
      expect(highly.color).toBe(legend?.color);
    });
  });

  describe('getFloodHubTierLabel', () => {
    it('returns tier from peak vs thresholds', () => {
      expect(getFloodHubTierLabel(125, 50, 80, 120)).toBe('Extreme');
      expect(getFloodHubTierLabel(90, 50, 80, 120)).toBe('Danger');
      expect(getFloodHubTierLabel(60, 50, 80, 120)).toBe('Warning');
      expect(getFloodHubTierLabel(40, 50, 80, 120)).toBe('Normal');
    });

    it('returns No data when peak or warning missing', () => {
      expect(getFloodHubTierLabel(null, 50, 80, 120)).toBe('No data');
      expect(getFloodHubTierLabel(60, null, 80, 120)).toBe('No data');
    });
  });

  describe('getFloodHubPopupFields', () => {
    it('reads snake_case and alternate case keys', () => {
      const f = getFloodHubPopupFields({
        Predicted_Peak: '12.5',
        gauge_id: 'hybas_123',
        data_source: 'Hybas',
        latitude: '31.85625',
        longitude: '-88.152083',
        station_name: 'Coffeeville',
        inundation_map_status: 'Sometimes',
        unit: 'CUBIC_METERS_PER_SECOND',
        warning_threshold: '10',
        danger_threshold: '20',
        extreme_threshold: '30',
        h3_l10_hex: '8f283080dcb019d',
      });
      expect(f.peak).toBeCloseTo(12.5, 5);
      expect(f.gaugeId).toBe('hybas_123');
      expect(f.gaugeDataSource).toBe('Hybas');
      expect(f.gaugeLatitude).toBeCloseTo(31.85625, 5);
      expect(f.gaugeLongitude).toBeCloseTo(-88.152083, 5);
      expect(f.gaugeStationName).toBe('Coffeeville');
      expect(f.inundationMapStatus).toBe('Sometimes');
      expect(f.warning).toBe(10);
      expect(f.h3Id).toBe('8f283080dcb019d');
      expect(f.unit).toBe('CUBIC_METERS_PER_SECOND');
    });

    it('reads coordinates from WKT POINT in tile properties when lat/lon columns are absent', () => {
      const f = getFloodHubPopupFields({
        gauge_id: 'hybas_7120793160',
        geom: 'POINT (-97.56458 26.497917)',
        warning_threshold: '10',
      });
      expect(f.gaugeLongitude).toBeCloseTo(-97.56458, 5);
      expect(f.gaugeLatitude).toBeCloseTo(26.497917, 5);
    });

    it('reads coordinates from GeoJSON Point string', () => {
      const f = getFloodHubPopupFields({
        gauge_point: '{"type":"Point","coordinates":[-97.56458,26.497917]}',
      });
      expect(f.gaugeLongitude).toBeCloseTo(-97.56458, 5);
      expect(f.gaugeLatitude).toBeCloseTo(26.497917, 5);
    });

    it('reads WKT with SRID prefix (EWKT)', () => {
      const f = getFloodHubPopupFields({
        geom: 'SRID=4326;POINT (-97.56458 26.497917)',
      });
      expect(f.gaugeLongitude).toBeCloseTo(-97.56458, 5);
      expect(f.gaugeLatitude).toBeCloseTo(26.497917, 5);
    });

    it('builds dischargeByDay from curr_minus_* / curr_plus_* and current_value for today', () => {
      const f = getFloodHubPopupFields({
        gauge_id: 'hybas_7120793160',
        curr_minus_2: '0.217',
        curr_minus_1: '0.212',
        current_value: '39.26',
        curr_plus_1: '2.08',
        curr_plus_2: '4.49',
        warning_threshold: '29',
      });
      expect(f.dischargeByDay).not.toBeNull();
      expect(f.dischargeByDay.values[0]).toBeCloseTo(0.217, 2);
      expect(f.dischargeByDay.values[2]).toBeCloseTo(39.26, 2);
      expect(f.dischargeByDay.values[4]).toBeCloseTo(4.49, 2);
      expect(f.dischargeByDay.dayOffsets).toEqual([-2, -1, 0, 1, 2, 3, 4, 5]);
    });
  });

  describe('getImpactTimingPropertyNames', () => {
    it('returns start/end keys for hours and H3 level', () => {
      expect(getImpactTimingPropertyNames(12, 8)).toEqual({
        start: 'start_12h_l8',
        end: 'end_12h_l8',
      });
    });
  });

  describe('findHighestImpactHours', () => {
    const opts = [3, 6, 12, 24];

    it('returns first hours with max HSI when tied at top', () => {
      expect(findHighestImpactHours({ 3: 0.4, 6: 0.4, 12: 0.2, 24: 0.1 }, opts)).toBe(3);
    });

    it('returns hours with unique max', () => {
      expect(findHighestImpactHours({ 3: 0.1, 6: 0.9, 12: 0.3, 24: 0.2 }, opts)).toBe(6);
    });

    it('returns null when no valid numbers', () => {
      expect(findHighestImpactHours({ 3: null, 6: NaN, 12: null, 24: null }, opts)).toBe(null);
    });
  });

  describe('getLtsHexMapFilter', () => {
    it('returns >= filter for min level 4', () => {
      expect(getLtsHexMapFilter('lts_level', 4)).toEqual([
        '>=',
        ['to-number', ['coalesce', ['get', 'lts_level'], '0']],
        4,
      ]);
    });

    it('returns undefined when min level disabled', () => {
      expect(getLtsHexMapFilter('lts_level', 1)).toBeUndefined();
      expect(getLtsHexMapFilter('lts_level', null)).toBeUndefined();
    });
  });

  describe('formatIsoTimeForPopup', () => {
    it('returns N/A for null, undefined, or empty', () => {
      expect(formatIsoTimeForPopup(null)).toBe('N/A');
      expect(formatIsoTimeForPopup(undefined)).toBe('N/A');
      expect(formatIsoTimeForPopup('  ')).toBe('N/A');
    });

    it('returns original string for unparseable input', () => {
      expect(formatIsoTimeForPopup('not a date')).toBe('not a date');
    });

    it('formats a valid ISO string with locale (contains month/day/year)', () => {
      const s = formatIsoTimeForPopup('2024-01-15T12:00:00.000Z');
      expect(s).not.toBe('N/A');
      expect(s).toMatch(/2024/);
    });
  });

  describe('escapeHtmlForPopup', () => {
    it('escapes special HTML characters', () => {
      expect(escapeHtmlForPopup('<x>')).toBe('&lt;x&gt;');
      expect(escapeHtmlForPopup('a&b')).toBe('a&amp;b');
      expect(escapeHtmlForPopup('"q"')).toBe('&quot;q&quot;');
    });
  });

  describe('getLtsHsiPeakValue', () => {
    it('reads hsi_peak when present', () => {
      expect(getLtsHsiPeakValue({ hsi_peak: 1.25 }, 8)).toBe(1.25);
    });

    it('reads text-typed hsi_peak from DB (numeric strings)', () => {
      expect(getLtsHsiPeakValue({ hsi_peak: '0.02' }, 10)).toBeCloseTo(0.02, 5);
    });

    it('resolves HSI peak with alternate MVT key casing (Hsi_Peak)', () => {
      expect(getLtsHsiPeakValue({ Hsi_Peak: '1.25' }, 8)).toBe(1.25);
    });

    it('resolves peak_hsi alias when hsi_peak missing', () => {
      expect(getLtsHsiPeakValue({ risk_zone: '4', peak_hsi: '0.88' }, 8)).toBe(0.88);
    });

    it('treats literal None / null as missing', () => {
      expect(getLtsHsiPeakValue({ hsi_peak: 'None' }, 10)).toBe(null);
      expect(getLtsHsiPeakValue({ hsi_peak: 'null' }, 10)).toBe(null);
    });

    it('falls back to hsi_peak_l{level} when hsi_peak missing', () => {
      expect(getLtsHsiPeakValue({ hsi_peak_l9: '0.88' }, 9)).toBe(0.88);
    });

    it('returns null when neither property is numeric', () => {
      expect(getLtsHsiPeakValue({}, 6)).toBe(null);
    });
  });

  describe('buildFloodHubTileUrlTemplate', () => {
    const base = 'https://tiles.example.org';
    const layer = 'public.google_flood_hub_urban_flash_flood';

    it('keeps the plain pg_tileserv template when no query is given', () => {
      expect(buildFloodHubTileUrlTemplate(base, layer)).toBe(`${base}/${layer}/{z}/{x}/{y}.pbf`);
    });

    it('appends encoded query params after the z/x/y placeholders', () => {
      const url = buildFloodHubTileUrlTemplate(base, layer, {
        filter: "h3_l10_hex LIKE '%07fff'",
        properties: 'likelihood,h3_l10_hex',
      });
      expect(url).toBe(
        `${base}/${layer}/{z}/{x}/{y}.pbf` +
          "?filter=h3_l10_hex%20LIKE%20'%2507fff'&properties=likelihood%2Ch3_l10_hex"
      );
      expect(url).toContain('{z}/{x}/{y}.pbf?');
    });

    it('drops blank and non-string params', () => {
      expect(
        buildFloodHubTileUrlTemplate(base, layer, { filter: '  ', properties: undefined, limit: 10 })
      ).toBe(`${base}/${layer}/{z}/{x}/{y}.pbf`);
    });
  });

  describe('getFloodHubUrbanFlashSourceLayerName', () => {
    it('appends _l{level} to the configured prefix', () => {
      const cfg = LAYER_CONFIG.google_flood_hub;
      expect(getFloodHubUrbanFlashLevels(cfg)).toEqual([6, 7, 8, 9, 10]);
      expect(getFloodHubUrbanFlashSourceLayerName(6, cfg)).toBe(
        'public.google_flood_hub_urban_flash_flood_l6'
      );
      expect(getFloodHubUrbanFlashSourceLayerName(10, cfg)).toBe(
        'public.google_flood_hub_urban_flash_flood_l10'
      );
    });

    it('uses precipitation HSI zoom bands, not Flood Hub gauge hexZoomRangeByLevel', () => {
      expect(getHexZoomRange(6)).toEqual({ min: 0, max: 7 });
      expect(getHexZoomRange(10)).toEqual({ min: 12, max: 22 });
      expect(getHexZoomRange(10, LAYER_CONFIG.google_flood_hub)).toEqual({ min: 0, max: 22 });
    });
  });
});
