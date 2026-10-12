/**
 * @fileoverview Unit tests for hazardService (Weather hazard API)
 * Feature: Weather hazard by county
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getWeatherHazardByCounty } from '@/services/hazardService';

const HARRIS_COUNTY = 'Harris County';
const TEST_API_URL = 'http://api.test/api/v1';

describe('hazardService', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
    // CI has no .env — stub portal base so happy-path tests can call fetch.
    vi.stubEnv('VITE_API_URL', TEST_API_URL);
    vi.stubEnv('VITE_EVENTS_API_URL', '');
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  describe('getWeatherHazardByCounty', () => {
    it('returns empty result when base URL is not configured', async () => {
      vi.stubEnv('VITE_API_URL', '');
      vi.stubEnv('VITE_EVENTS_API_URL', '');
      vi.stubEnv('DEV', false);
      await vi.resetModules();
      const { getWeatherHazardByCounty: getByCounty } = await import('@/services/hazardService');
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = await getByCounty('Harris');
      expect(result).toEqual({ county_name: 'Harris', rows: [] });
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
      await vi.resetModules();
    });

    it('returns empty result when countyName is undefined', async () => {
      const result = await getWeatherHazardByCounty(undefined);
      expect(result).toEqual({ county_name: '', rows: [] });
      expect(fetch).not.toHaveBeenCalled();
    });

    it('returns empty result when countyName is null', async () => {
      const result = await getWeatherHazardByCounty(null);
      expect(result).toEqual({ county_name: '', rows: [] });
      expect(fetch).not.toHaveBeenCalled();
    });

    it('returns empty result when countyName is not a string', async () => {
      const result = await getWeatherHazardByCounty(123);
      expect(result.rows).toEqual([]);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('returns empty result when countyName is empty string', async () => {
      const result = await getWeatherHazardByCounty('');
      expect(result).toEqual({ county_name: '', rows: [] });
      expect(fetch).not.toHaveBeenCalled();
    });

    it('fetches and returns normalized data when API succeeds', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            county_name: HARRIS_COUNTY,
            rows: [
              { subtype: 'Flood', alert_count: 5 },
              { subtype: 'Tornado', alert_count: 2 },
            ],
          }),
      });

      const result = await getWeatherHazardByCounty(HARRIS_COUNTY);
      expect(result).toEqual({
        county_name: HARRIS_COUNTY,
        rows: [
          { subtype: 'Flood', alert_count: 5 },
          { subtype: 'Tornado', alert_count: 2 },
        ],
      });
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/weather-hazard/by-county?county_name='),
        expect.objectContaining({ headers: expect.any(Object) })
      );
      expect(fetch.mock.calls[0][0]).toContain(encodeURIComponent(HARRIS_COUNTY));
    });

    it('trims county name when building request', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ county_name: 'Travis', rows: [] }),
      });
      await getWeatherHazardByCounty('  Travis County  ');
      expect(fetch.mock.calls[0][0]).toContain(encodeURIComponent('Travis County'));
    });

    it('uses county_name from response when present', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            county_name: HARRIS_COUNTY,
            rows: [],
          }),
      });
      const result = await getWeatherHazardByCounty('Harris');
      expect(result.county_name).toBe(HARRIS_COUNTY);
    });

    it('falls back to request county name when response county_name is missing', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ rows: [] }),
      });
      const result = await getWeatherHazardByCounty('Harris');
      expect(result.county_name).toBe('Harris');
      expect(result.rows).toEqual([]);
    });

    it('normalizes non-array rows to empty array', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ county_name: 'Harris', rows: null }),
      });
      const result = await getWeatherHazardByCounty('Harris');
      expect(result.rows).toEqual([]);
    });

    it('returns empty rows when response has no rows key', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ county_name: 'Harris' }),
      });
      const result = await getWeatherHazardByCounty('Harris');
      expect(result.rows).toEqual([]);
    });

    it('on fetch error returns empty result and logs error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await getWeatherHazardByCounty('Harris');
      expect(result).toEqual({ county_name: 'Harris', rows: [] });
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error fetching weather hazard by county:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });

    it('on non-OK response returns empty result and logs error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server error'),
      });

      const result = await getWeatherHazardByCounty('Harris');
      expect(result).toEqual({ county_name: 'Harris', rows: [] });
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('when res.text() rejects uses empty string in error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.reject(new Error('body read failed')),
      });

      const result = await getWeatherHazardByCounty('Harris');
      expect(result).toEqual({ county_name: 'Harris', rows: [] });
      consoleSpy.mockRestore();
    });

    it('sends X-API-Key header when API key is configured', async () => {
      vi.stubEnv('VITE_API_URL', TEST_API_URL);
      vi.stubEnv('VITE_EVENTS_API_KEY', 'test-key-123');
      await vi.resetModules();
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ county_name: 'Harris', rows: [] }),
      });
      const { getWeatherHazardByCounty: getByCounty } = await import('@/services/hazardService');
      await getByCounty('Harris');
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-API-Key': 'test-key-123',
            'Content-Type': 'application/json',
          }),
        })
      );
      await vi.resetModules();
    });
  });
});
