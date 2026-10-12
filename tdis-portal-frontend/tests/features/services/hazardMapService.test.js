import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearHazardMapCache,
  fetchHazardMap,
  normalizeHazardHexes,
} from '@/services/hazardMapService';
import { getHazardMapApiBase } from '@/config/hazardMapConfig';

const TEST_TOKEN = 'test-token';

describe('hazardMapService', () => {
  beforeEach(() => {
    clearHazardMapCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes the columnar API payload into map records', () => {
    expect(
      normalizeHazardHexes({
        hex: ['862a1072fffffff', '862a10737ffffff'],
        risk: [87.42, 41.5],
        pop: [1240, 320],
        county: ['Harris', 'Galveston'],
      })
    ).toEqual([
      { hex_id: '862a1072fffffff', value: 87.42, risk: 87.42, population: 1240, county: 'Harris' },
      { hex_id: '862a10737ffffff', value: 41.5, risk: 41.5, population: 320, county: 'Galveston' },
    ]);
  });

  it('treats blank or missing county entries as null', () => {
    expect(
      normalizeHazardHexes({
        hex: ['abc', 'def', 'ghi'],
        risk: [1, 2, 3],
        pop: [4, 5, 6],
        county: ['  Travis  ', '   ', undefined],
      })
    ).toEqual([
      { hex_id: 'abc', value: 1, risk: 1, population: 4, county: 'Travis' },
      { hex_id: 'def', value: 2, risk: 2, population: 5, county: null },
      { hex_id: 'ghi', value: 3, risk: 3, population: 6, county: null },
    ]);
  });

  it('requests the uppercase hazard endpoint with a bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        hazard: 'RFLD',
        count: 1,
        hex: ['862a1072fffffff'],
        risk: [87.42],
        pop: [1240],
        county: ['Harris'],
        min: 87.42,
        max: 87.42,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchHazardMap({ metric: 'rfld', token: TEST_TOKEN });

    expect(fetchMock).toHaveBeenCalledWith(
      `${getHazardMapApiBase()}/api/hazard-hexes/RFLD`,
      { headers: { Authorization: `Bearer ${TEST_TOKEN}` } }
    );
    expect(result.metric).toBe('RFLD');
    expect(result.count).toBe(1);
    expect(result.hexes[0].value).toBe(87.42);
    expect(result.hexes[0].county).toBe('Harris');
  });

  it('requires an access token', async () => {
    await expect(fetchHazardMap({ metric: 'HRCN' })).rejects.toThrow('Missing access token');
  });

  it('requires a hazard metric', async () => {
    await expect(fetchHazardMap({ token: TEST_TOKEN })).rejects.toThrow(
      'Hazard metric is required'
    );
  });

  it('skips rows without a hex id and tolerates a missing payload', () => {
    expect(normalizeHazardHexes(undefined)).toEqual([]);
    expect(normalizeHazardHexes({ hex: 'not-an-array' })).toEqual([]);
    expect(normalizeHazardHexes({ hex: ['abc', null], risk: [1] })).toEqual([
      { hex_id: 'abc', value: 1, risk: 1, population: null, county: null },
    ]);
  });

  it('serves a repeat request for the same hazard from cache', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ hazard: 'CFLD', hex: ['abc'], risk: [1], pop: [2] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await fetchHazardMap({ metric: 'CFLD', token: TEST_TOKEN });
    const cached = await fetchHazardMap({ metric: 'CFLD', token: TEST_TOKEN });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(cached.count).toBe(1);
  });

  it('surfaces the API error message on a failed request', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Authorization bearer token is required' }),
      })
    );

    await expect(fetchHazardMap({ metric: 'HWAV', token: TEST_TOKEN })).rejects.toThrow(
      'Authorization bearer token is required'
    );
  });

  it('falls back to the status code when the error body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('not json');
        },
      })
    );

    await expect(fetchHazardMap({ metric: 'TRND', token: TEST_TOKEN })).rejects.toThrow(
      'Hazard map request failed (500)'
    );
  });
});
