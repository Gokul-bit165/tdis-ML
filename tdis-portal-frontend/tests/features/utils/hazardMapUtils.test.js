/**
 * @fileoverview Unit tests for utils/hazardMapUtils
 * Hazard map layers, sources, filters, and popup formatting.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
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
  default as hazardMapUtilsDefault,
} from '@/utils/hazardMapUtils';

const {
  HAZARD_WEATHER_FOG,
  HAZARD_COUNTY_TOTAL,
  HAZARD_COUNTY_FILL,
  HAZARD_POINTS_CIRCLE,
  HAZARD_ROAD_CLOSURE_LINE,
  WEATHER_HAZARD_FOG_NAME,
  MAP_NOT_ALIVE_TEST,
} = vi.hoisted(() => ({
  HAZARD_WEATHER_FOG: 'HAZARD_WEATHER_FOG',
  HAZARD_COUNTY_TOTAL: 'hazard-county-total',
  HAZARD_COUNTY_FILL: 'hazard-county-fill',
  HAZARD_POINTS_CIRCLE: 'hazard-points-circle',
  HAZARD_ROAD_CLOSURE_LINE: 'hazard-road-closure-line',
  WEATHER_HAZARD_FOG_NAME: 'Weather Hazard Fog',
  MAP_NOT_ALIVE_TEST: 'returns early when map is not alive',
}));

vi.mock('@/utils/mapUtils', () => ({
  isMapAlive: vi.fn(() => true),
}));

vi.mock('@/config/hazardConfig', () => ({
  HAZARD_TILE_LAYERS: {
    countyTotal: 'public.county_total',
    countySubtype: 'public.county_subtype',
    points: 'public.points',
  },
  HAZARD_ZOOM_THRESHOLDS: {
    countyTotal: { min: 0, max: 7 },
    points: { min: 12, max: 22 },
  },
  HAZARD_BOUNDS: [-106, 27, -93, 33],
  SUBTYPE_MAP: {
    HAZARD_WEATHER_FOG: {
      id: HAZARD_WEATHER_FOG,
      name: WEATHER_HAZARD_FOG_NAME,
      color: '#757575',
      isOther: false,
    },
    HAZARD_WEATHER_HAIL: {
      id: 'HAZARD_WEATHER_HAIL',
      name: 'Weather Hazard Hail',
      color: '#8E24AA',
      isOther: false,
    },
    OTHER_WEATHERHAZARD: {
      id: 'OTHER_WEATHERHAZARD',
      name: 'Weather Hazard Other',
      color: '#d97706',
      isOther: true,
    },
    OTHER_ROAD_CLOSED: {
      id: 'OTHER_ROAD_CLOSED',
      name: 'Road Closure Other',
      color: '#b91c1c',
      isOther: true,
    },
  },
}));

describe('hazardMapUtils', () => {
  let mapUtils;

  beforeEach(async () => {
    vi.clearAllMocks();
    mapUtils = await import('@/utils/mapUtils');
    mapUtils.isMapAlive.mockReturnValue(true);
  });

  describe('HAZARD_SOURCE_IDS / HAZARD_LAYER_IDS', () => {
    it('exports expected source IDs', () => {
      expect(HAZARD_SOURCE_IDS).toEqual({
        countyTotal: HAZARD_COUNTY_TOTAL,
        countySubtype: 'hazard-county-subtype',
        points: 'hazard-points',
      });
    });

    it('exports expected layer IDs', () => {
      expect(HAZARD_LAYER_IDS).toMatchObject({
        countyFill: HAZARD_COUNTY_FILL,
        countyOutline: 'hazard-county-outline',
        countyCountLabel: 'hazard-county-count-label',
        pointsCircle: HAZARD_POINTS_CIRCLE,
        roadClosureLine: HAZARD_ROAD_CLOSURE_LINE,
      });
    });
  });

  describe('getAllHazardLayerIds', () => {
    it('returns array of all layer ID values', () => {
      const ids = getAllHazardLayerIds();
      expect(Array.isArray(ids)).toBe(true);
      expect(ids).toContain(HAZARD_COUNTY_FILL);
      expect(ids.length).toBeGreaterThan(0);
    });
  });

  describe('getCountyFillColorExpression', () => {
    it('returns step expression with given property', () => {
      const expr = getCountyFillColorExpression('total_alert_count');
      expect(expr[0]).toBe('step');
      expect(expr[1]).toEqual(['coalesce', ['to-number', ['get', 'total_alert_count']], 0]);
      expect(expr[2]).toContain('rgba(251, 192, 45');
      expect(expr.length).toBeGreaterThan(5);
    });
  });

  describe('getPointColorExpression', () => {
    it('returns case expression array', () => {
      const expr = getPointColorExpression();
      expect(expr[0]).toBe('case');
      expect(Array.isArray(expr)).toBe(true);
    });
  });

  describe('createSubtypeFilter', () => {
    it('returns literal false when selectedSubtypes is null', () => {
      expect(createSubtypeFilter(null)).toEqual(['literal', false]);
    });

    it('returns literal false when selectedSubtypes is empty set', () => {
      expect(createSubtypeFilter(new Set())).toEqual(['literal', false]);
    });

    it('returns in expression for regular subtypes only', () => {
      const result = createSubtypeFilter(new Set([HAZARD_WEATHER_FOG]));
      expect(result[0]).toBe('in');
      expect(result[2][0]).toBe('literal');
      expect(result[2][1]).toContain('hazard_weather_fog');
    });

    it('returns all + any for OTHER_ subtype', () => {
      const result = createSubtypeFilter(new Set(['OTHER_WEATHERHAZARD']));
      expect(result[0]).toBe('all');
      expect(result[1][0]).toBe('==');
      expect(result[2][0]).toBe('any');
    });

    it('returns any when both regular and other subtypes', () => {
      const result = createSubtypeFilter(new Set([HAZARD_WEATHER_FOG, 'OTHER_ROAD_CLOSED']));
      expect(result[0]).toBe('any');
      expect(result.length).toBe(3);
    });

    it('returns single condition when one regular subtype', () => {
      const result = createSubtypeFilter(new Set(['HAZARD_WEATHER_HAIL']));
      expect(result[0]).toBe('in');
    });
  });

  describe('addHazardSources', () => {
    it('adds vector sources when not present', () => {
      const addSource = vi.fn();
      const map = {
        getSource: vi.fn((_id) => null),
        addSource,
      };
      addHazardSources(map, 'https://tiles.example.com');
      expect(addSource).toHaveBeenCalledWith(
        HAZARD_COUNTY_TOTAL,
        expect.objectContaining({
          type: 'vector',
          tiles: ['https://tiles.example.com/public.county_total/{z}/{x}/{y}.pbf'],
          bounds: [-106, 27, -93, 33],
        })
      );
      expect(addSource).toHaveBeenCalledWith(
        'hazard-points',
        expect.objectContaining({ type: 'vector' })
      );
    });

    it('does not add source when already present', () => {
      const addSource = vi.fn();
      const map = {
        getSource: vi.fn(() => ({})),
        addSource,
      };
      addHazardSources(map, 'https://tiles.example.com');
      expect(addSource).not.toHaveBeenCalled();
    });
  });

  describe('addHazardLayers', () => {
    it(MAP_NOT_ALIVE_TEST, () => {
      mapUtils.isMapAlive.mockReturnValue(false);
      const map = { addLayer: vi.fn(), getLayer: vi.fn(() => null) };
      addHazardLayers(map);
      expect(map.addLayer).not.toHaveBeenCalled();
    });

    it('adds layers when map is alive and layers missing', () => {
      const addLayer = vi.fn();
      const map = {
        getLayer: vi.fn(() => null),
        addLayer,
      };
      addHazardLayers(map);
      expect(addLayer).toHaveBeenCalledWith(
        expect.objectContaining({
          id: HAZARD_COUNTY_FILL,
          type: 'fill',
          source: HAZARD_COUNTY_TOTAL,
        })
      );
      expect(addLayer).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'hazard-county-outline', type: 'line' })
      );
      expect(addLayer).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'hazard-county-count-label', type: 'symbol' })
      );
      expect(addLayer).toHaveBeenCalledWith(
        expect.objectContaining({ id: HAZARD_POINTS_CIRCLE, type: 'circle' })
      );
      expect(addLayer).toHaveBeenCalledWith(
        expect.objectContaining({ id: HAZARD_ROAD_CLOSURE_LINE, type: 'symbol' })
      );
    });

    it('does not add layer when already present', () => {
      const addLayer = vi.fn();
      const map = {
        getLayer: vi.fn(() => ({})),
        addLayer,
      };
      addHazardLayers(map);
      expect(addLayer).not.toHaveBeenCalled();
    });
  });

  describe('setHazardLayersVisibility', () => {
    it(MAP_NOT_ALIVE_TEST, () => {
      mapUtils.isMapAlive.mockReturnValue(false);
      const map = { setLayoutProperty: vi.fn(), getLayer: vi.fn(() => true) };
      setHazardLayersVisibility(map, true);
      expect(map.setLayoutProperty).not.toHaveBeenCalled();
    });

    it('sets visibility visible for each existing layer', () => {
      const setLayoutProperty = vi.fn();
      const map = {
        getLayer: vi.fn(() => true),
        setLayoutProperty,
      };
      setHazardLayersVisibility(map, true);
      expect(setLayoutProperty).toHaveBeenCalledWith(expect.any(String), 'visibility', 'visible');
    });

    it('sets visibility none when visible is false', () => {
      const setLayoutProperty = vi.fn();
      const map = {
        getLayer: vi.fn(() => true),
        setLayoutProperty,
      };
      setHazardLayersVisibility(map, false);
      expect(setLayoutProperty).toHaveBeenCalledWith(expect.any(String), 'visibility', 'none');
    });

    it('skips layers that do not exist', () => {
      const setLayoutProperty = vi.fn();
      const map = {
        getLayer: vi.fn(() => null),
        setLayoutProperty,
      };
      setHazardLayersVisibility(map, true);
      expect(setLayoutProperty).not.toHaveBeenCalled();
    });
  });

  describe('updateHazardFilters', () => {
    it(MAP_NOT_ALIVE_TEST, () => {
      mapUtils.isMapAlive.mockReturnValue(false);
      const map = { setFilter: vi.fn(), getLayer: vi.fn(() => true) };
      updateHazardFilters(map, new Set([HAZARD_WEATHER_FOG]));
      expect(map.setFilter).not.toHaveBeenCalled();
    });

    it('sets filter on points layers when map is alive', () => {
      const setFilter = vi.fn();
      const map = {
        getLayer: vi.fn(() => true),
        setFilter,
      };
      updateHazardFilters(map, new Set([HAZARD_WEATHER_FOG]));
      expect(setFilter).toHaveBeenCalledWith(HAZARD_POINTS_CIRCLE, expect.any(Array));
      expect(setFilter).toHaveBeenCalledWith(HAZARD_ROAD_CLOSURE_LINE, expect.any(Array));
    });
  });

  describe('formatHazardPopupContent', () => {
    it('formats county layer popup with county_name and total_alert_count', () => {
      const html = formatHazardPopupContent(
        { county_name: 'Harris', total_alert_count: 42, type: 'WEATHERHAZARD' },
        'county'
      );
      expect(html).toContain('Harris');
      expect(html).toContain('42');
      expect(html).toContain('Total Alerts');
    });

    it('county popup uses alert_count when total_alert_count missing', () => {
      const html = formatHazardPopupContent({ county_name: 'Dallas', alert_count: 10 }, 'county');
      expect(html).toContain('10');
    });

    it('county popup shows Type when subtype present', () => {
      const html = formatHazardPopupContent(
        { county_name: 'Harris', total_alert_count: 1, subtype: HAZARD_WEATHER_FOG },
        'county'
      );
      expect(html).toContain(WEATHER_HAZARD_FOG_NAME);
      expect(html).toContain('Type');
    });

    it('formats point popup with subtype and type', () => {
      const html = formatHazardPopupContent(
        { subtype: HAZARD_WEATHER_FOG, type: 'WEATHERHAZARD' },
        'point'
      );
      expect(html).toContain(WEATHER_HAZARD_FOG_NAME);
      expect(html).toContain('Subtype');
      expect(html).toContain('Category');
    });

    it('point popup uses type display when subtype empty', () => {
      const html = formatHazardPopupContent({ subtype: '', type: 'ROAD_CLOSED' }, 'point');
      expect(html).toContain('Road Closure');
    });

    it('point popup uses type display when subtype Unavailable', () => {
      const html = formatHazardPopupContent(
        { subtype: 'Unavailable', type: 'WEATHERHAZARD' },
        'point'
      );
      expect(html).toContain('Weather Hazard');
    });

    it('point popup includes street, city, reliability, pubmillis when present', () => {
      const html = formatHazardPopupContent(
        {
          subtype: HAZARD_WEATHER_FOG,
          type: 'WEATHERHAZARD',
          street: 'Main St',
          city: 'Houston',
          reliability: 0.9,
          pubmillis: 1609459200000,
        },
        'point'
      );
      expect(html).toContain('Main St');
      expect(html).toContain('Houston');
      expect(html).toContain('0.9');
      expect(html).toContain('Reported');
    });

    it('point popup handles unknown type with fallback color', () => {
      const html = formatHazardPopupContent({ subtype: '', type: 'UNKNOWN_TYPE' }, 'point');
      expect(html).toContain('UNKNOWN_TYPE');
    });

    it('county popup defaults county name when missing', () => {
      const html = formatHazardPopupContent({ total_alert_count: 0 }, 'county');
      expect(html).toContain('County');
    });
  });

  describe('default export', () => {
    it('exports all public API', () => {
      expect(hazardMapUtilsDefault.HAZARD_SOURCE_IDS).toBe(HAZARD_SOURCE_IDS);
      expect(hazardMapUtilsDefault.HAZARD_LAYER_IDS).toBe(HAZARD_LAYER_IDS);
      expect(hazardMapUtilsDefault.getAllHazardLayerIds).toBe(getAllHazardLayerIds);
      expect(hazardMapUtilsDefault.getCountyFillColorExpression).toBe(getCountyFillColorExpression);
      expect(hazardMapUtilsDefault.getPointColorExpression).toBe(getPointColorExpression);
      expect(hazardMapUtilsDefault.createSubtypeFilter).toBe(createSubtypeFilter);
      expect(hazardMapUtilsDefault.addHazardSources).toBe(addHazardSources);
      expect(hazardMapUtilsDefault.addHazardLayers).toBe(addHazardLayers);
      expect(hazardMapUtilsDefault.setHazardLayersVisibility).toBe(setHazardLayersVisibility);
      expect(hazardMapUtilsDefault.updateHazardFilters).toBe(updateHazardFilters);
      expect(hazardMapUtilsDefault.formatHazardPopupContent).toBe(formatHazardPopupContent);
    });
  });
});
