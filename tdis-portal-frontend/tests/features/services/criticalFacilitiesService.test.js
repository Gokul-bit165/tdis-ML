/**
 * @fileoverview Unit tests for RAMP critical-facilities GeoJSON service.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const areaFilterMock = vi.fn(() => ({ areaType: 'county', areaId: '201' }));
const getRampApiRootMock = vi.fn(() => 'https://ramp.example.com');

vi.mock('@/config/rampApiConfig', () => ({
  getRampApiRoot: () => getRampApiRootMock(),
  getRampApiUrl: (path, searchParams) => {
    const url = new URL(`https://ramp.example.com${path}`);
    if (searchParams) {
      Object.entries(searchParams).forEach(([k, v]) => {
        if (v !== undefined && v !== null && String(v).trim() !== '') {
          url.searchParams.set(k, String(v));
        }
      });
    }
    return url.toString();
  },
  buildRampApiHeaders: () => ({ Accept: 'application/json' }),
}));

vi.mock('@/config/criticalFacilitiesConfig', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getCriticalFacilityAreaFilter: (...args) => areaFilterMock(...args),
    CRITICAL_FACILITY_COUNTY_FETCH_CONCURRENCY: 2,
  };
});

vi.mock('@/data/texasCountyFips', () => ({
  TEXAS_COUNTY_FIPS: ['201', '157', '001'],
}));

import {
  buildCriticalFacilityGeoJsonUrl,
  emptyFacilityCollection,
  fetchCriticalFacilityGeoJson,
  filterCriticalFacilityPoints,
  getCriticalFacilityGeoJsonUrl,
  isEmptyCountyNotFound,
  isMissingRouteNotFound,
  mapWithConcurrency,
  mergeFeatureCollections,
  normalizeCriticalFacilityGeoJson,
} from '@/services/criticalFacilitiesService';
import { normalizeRampCountyFips } from '@/config/criticalFacilitiesConfig';

function jsonResponse(body, init = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

describe('criticalFacilitiesService', () => {
  beforeEach(() => {
    areaFilterMock.mockReturnValue({ areaType: 'county', areaId: '201' });
    getRampApiRootMock.mockReturnValue('https://ramp.example.com');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('emptyFacilityCollection returns no features', () => {
    expect(emptyFacilityCollection()).toEqual({ type: 'FeatureCollection', features: [] });
  });

  it('normalizes FeatureCollection wrappers and rejects invalid payloads', () => {
    expect(
      normalizeCriticalFacilityGeoJson({
        type: 'FeatureCollection',
        features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [1, 2] }, properties: {} }],
      }).features
    ).toHaveLength(1);

    expect(
      normalizeCriticalFacilityGeoJson({
        features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [1, 2] }, properties: {} }],
      }).type
    ).toBe('FeatureCollection');

    expect(
      normalizeCriticalFacilityGeoJson({
        data: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [1, 2] }, properties: {} }],
      }).features
    ).toHaveLength(1);

    expect(
      normalizeCriticalFacilityGeoJson([
        { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 2] }, properties: {} },
      ]).features
    ).toHaveLength(1);

    expect(() => normalizeCriticalFacilityGeoJson(null)).toThrow(/not JSON/);
    expect(() => normalizeCriticalFacilityGeoJson({ foo: 1 })).toThrow(/FeatureCollection/);
  });

  it('filters Point and MultiPoint geometries', () => {
    const points = filterCriticalFacilityPoints({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: { type: 'Point', coordinates: [-95, 29] }, properties: {} },
        {
          type: 'Feature',
          geometry: { type: 'MultiPoint', coordinates: [[-96, 30], [-97, 31]] },
          properties: { name: 'multi' },
        },
        { type: 'Feature', geometry: { type: 'Polygon', coordinates: [] }, properties: {} },
        { type: 'Feature', geometry: null, properties: {} },
      ],
    });
    expect(points.features).toHaveLength(2);
    expect(points.features[1].geometry).toEqual({ type: 'Point', coordinates: [-96, 30] });
  });

  it('builds the schools GeoJSON URL with county filter', () => {
    expect(getCriticalFacilityGeoJsonUrl('schools')).toBe(
      'https://ramp.example.com/downloads/points-of-interest/schools/geojson?county=201'
    );
  });

  it('throws when building URL without an area filter or unknown id', () => {
    areaFilterMock.mockReturnValue(null);
    expect(() => getCriticalFacilityGeoJsonUrl('schools')).toThrow(/No single-area filter/);
    areaFilterMock.mockReturnValue({ areaType: 'county', areaId: '201' });
    expect(() => getCriticalFacilityGeoJsonUrl(/** @type {any} */ ('nope'))).toThrow(/Unknown/);
  });

  it('merges county FeatureCollections', () => {
    const merged = mergeFeatureCollections([
      {
        type: 'FeatureCollection',
        features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [1, 2] }, properties: {} }],
      },
      {
        type: 'FeatureCollection',
        features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [3, 4] }, properties: {} }],
      },
      { type: 'FeatureCollection', features: [] },
    ]);
    expect(merged.features).toHaveLength(2);
  });

  it('mapWithConcurrency preserves order', async () => {
    const out = await mapWithConcurrency([1, 2, 3, 4], 2, async (n) => n * 10);
    expect(out).toEqual([10, 20, 30, 40]);
  });

  it('normalizes 5-digit FIPS to RAMP county id', () => {
    expect(normalizeRampCountyFips('48201')).toBe('201');
    expect(normalizeRampCountyFips('201')).toBe('201');
    expect(normalizeRampCountyFips('')).toBe('');
  });

  it('buildCriticalFacilityGeoJsonUrl encodes area type as query key', () => {
    expect(
      buildCriticalFacilityGeoJsonUrl('/downloads/points-of-interest/schools/geojson', 'county', '201')
    ).toContain('county=201');
  });

  it('classifies empty-county vs missing-route 404 bodies', () => {
    expect(isEmptyCountyNotFound(404, '{"msg":"No matching data for this county"}')).toBe(true);
    expect(isEmptyCountyNotFound(404, 'Cannot GET /api/...')).toBe(false);
    expect(isEmptyCountyNotFound(500, 'No matching data for this county')).toBe(false);
    expect(isMissingRouteNotFound(404, 'Cannot GET /api/downloads/...')).toBe(true);
    expect(isMissingRouteNotFound(404, '{"msg":"No matching data for this county"}')).toBe(false);
  });

  it('fetchCriticalFacilityGeoJson loads a single county FeatureCollection', async () => {
    fetch.mockResolvedValueOnce(
      jsonResponse({
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', geometry: { type: 'Point', coordinates: [-95, 29] }, properties: { name: 'A' } },
        ],
      })
    );

    const data = await fetchCriticalFacilityGeoJson('schools');
    expect(data.features).toHaveLength(1);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('schools/geojson?county=201'),
      expect.any(Object)
    );
  });

  it('fetchCriticalFacilityGeoJson treats empty-county 404 as empty collection', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => '{"msg":"No matching data for this county"}',
      json: async () => ({}),
    });

    const data = await fetchCriticalFacilityGeoJson('hospitals');
    expect(data.features).toEqual([]);
  });

  it('fetchCriticalFacilityGeoJson throws when RAMP root is missing', async () => {
    getRampApiRootMock.mockReturnValue('');
    await expect(fetchCriticalFacilityGeoJson('schools')).rejects.toThrow(/RAMP API not configured/);
  });

  it('fetchCriticalFacilityGeoJson throws on unexpected HTTP errors', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'boom',
      json: async () => ({}),
    });
    await expect(fetchCriticalFacilityGeoJson('schools')).rejects.toThrow(/GET failed: 500/);
  });

  it('fetchCriticalFacilityGeoJson merges statewide county responses', async () => {
    areaFilterMock.mockReturnValue(null);
    fetch.mockImplementation(async (url) => {
      if (String(url).includes('county=157')) {
        return {
          ok: false,
          status: 404,
          text: async () => '{"msg":"No matching data for this county"}',
        };
      }
      return jsonResponse({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-95, 29] },
            properties: { county: String(url) },
          },
        ],
      });
    });

    const data = await fetchCriticalFacilityGeoJson('fire_stations');
    expect(data.features.length).toBeGreaterThanOrEqual(2);
    expect(fetch.mock.calls.length).toBe(3);
  });

  it('fetchCriticalFacilityGeoJson aborts statewide when the route is missing', async () => {
    areaFilterMock.mockReturnValue(null);
    fetch.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => 'Cannot GET /api/downloads/points-of-interest/missing/geojson',
    });

    await expect(fetchCriticalFacilityGeoJson('schools')).rejects.toThrow(/RAMP route not found/);
  });

  it('fetchCriticalFacilityGeoJson throws for an unknown facility id', async () => {
    await expect(fetchCriticalFacilityGeoJson(/** @type {any} */ ('not_a_layer'))).rejects.toThrow(
      /Unknown critical facility id/
    );
  });

  it('fetchCriticalFacilityGeoJson swallows unexpected county errors during statewide merge', async () => {
    areaFilterMock.mockReturnValue(null);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetch.mockImplementation(async (url) => {
      if (String(url).includes('county=157')) {
        throw new Error('network down');
      }
      return jsonResponse({
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 2] }, properties: {} },
        ],
      });
    });

    const data = await fetchCriticalFacilityGeoJson('schools');
    expect(data.features.length).toBeGreaterThanOrEqual(1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
