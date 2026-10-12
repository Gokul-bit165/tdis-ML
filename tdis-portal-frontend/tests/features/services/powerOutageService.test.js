/**
 * @fileoverview Unit tests for powerOutageService (Power outage API)
 * Feature: Power outage data by county, zip, utility
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getPowerOutageCounties,
  getPowerOutageZips,
  getPowerOutageUtilities,
} from '@/services/powerOutageService';

const NETWORK_ERROR_MESSAGE = 'Network error';
const THROWS_WHEN_FETCH_FAILS = 'throws when fetch fails';
const HARRIS_COUNTY = 'Harris';
const TEST_API_URL = 'http://api.test/api/v1';

describe('powerOutageService', () => {
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

  describe('getPowerOutageCounties', () => {
    it('returns counties from response.counties', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            counties: [
              { county: HARRIS_COUNTY, outage_count: 100 },
              { county: 'Travis', outage_count: 50 },
            ],
          }),
      });

      const result = await getPowerOutageCounties();
      expect(result).toEqual([
        { county: HARRIS_COUNTY, outage_count: 100 },
        { county: 'Travis', outage_count: 50 },
      ]);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/power-outage/counties'),
        expect.any(Object)
      );
    });

    it('returns response as array when response is array (no counties key)', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ county: HARRIS_COUNTY, outage_count: 100 }]),
      });

      const result = await getPowerOutageCounties();
      expect(result).toHaveLength(1);
      expect(result[0].county).toBe(HARRIS_COUNTY);
    });

    it('returns empty array when response has no counties and is not array', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const result = await getPowerOutageCounties();
      expect(result).toEqual([]);
    });

    it('returns empty array when response.counties is null', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ counties: null }),
      });

      const result = await getPowerOutageCounties();
      expect(result).toEqual([]);
    });

    it(THROWS_WHEN_FETCH_FAILS, async () => {
      global.fetch.mockRejectedValueOnce(new Error(NETWORK_ERROR_MESSAGE));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(getPowerOutageCounties()).rejects.toThrow(NETWORK_ERROR_MESSAGE);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error fetching power outage counties:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });

    it('throws when response is not ok', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server error'),
      });
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(getPowerOutageCounties()).rejects.toThrow();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('uses empty string when res.text() rejects', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.reject(new Error('body read failed')),
      });
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(getPowerOutageCounties()).rejects.toThrow();
      consoleSpy.mockRestore();
    });
  });

  describe('getPowerOutageZips', () => {
    it('returns zips from response.zips', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            zips: [
              { zip: '77001', outage_count: 10 },
              { zip: '78701', outage_count: 5 },
            ],
          }),
      });

      const result = await getPowerOutageZips();
      expect(result).toEqual([
        { zip: '77001', outage_count: 10 },
        { zip: '78701', outage_count: 5 },
      ]);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/power-outage/zips'),
        expect.any(Object)
      );
    });

    it('returns response as array when response is array', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ zip: '77001', outage_count: 10 }]),
      });

      const result = await getPowerOutageZips();
      expect(result).toHaveLength(1);
      expect(result[0].zip).toBe('77001');
    });

    it('returns empty array when response has no zips and is not array', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const result = await getPowerOutageZips();
      expect(result).toEqual([]);
    });

    it(THROWS_WHEN_FETCH_FAILS, async () => {
      global.fetch.mockRejectedValueOnce(new Error(NETWORK_ERROR_MESSAGE));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(getPowerOutageZips()).rejects.toThrow(NETWORK_ERROR_MESSAGE);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error fetching power outage zip codes:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe('getPowerOutageUtilities', () => {
    it('returns utilities from response.utilities', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            utilities: [
              { utility: 'Oncor', outage_count: 200 },
              { utility: 'CenterPoint', outage_count: 150 },
            ],
          }),
      });

      const result = await getPowerOutageUtilities();
      expect(result).toEqual([
        { utility: 'Oncor', outage_count: 200 },
        { utility: 'CenterPoint', outage_count: 150 },
      ]);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/power-outage/utilities'),
        expect.any(Object)
      );
    });

    it('returns response as array when response is array', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{ utility: 'Oncor', outage_count: 200 }]),
      });

      const result = await getPowerOutageUtilities();
      expect(result).toHaveLength(1);
      expect(result[0].utility).toBe('Oncor');
    });

    it('returns empty array when response has no utilities and is not array', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const result = await getPowerOutageUtilities();
      expect(result).toEqual([]);
    });

    it(THROWS_WHEN_FETCH_FAILS, async () => {
      global.fetch.mockRejectedValueOnce(new Error(NETWORK_ERROR_MESSAGE));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(getPowerOutageUtilities()).rejects.toThrow(NETWORK_ERROR_MESSAGE);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error fetching power outage utilities:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe('base URL not configured', () => {
    it('getPowerOutageCounties throws when base URL is not set', async () => {
      vi.stubEnv('VITE_API_URL', '');
      vi.stubEnv('VITE_EVENTS_API_URL', '');
      vi.stubEnv('DEV', false);
      await vi.resetModules();
      const { getPowerOutageCounties: getCounties } = await import('@/services/powerOutageService');
      await expect(getCounties()).rejects.toThrow('Portal API not configured');
      await vi.resetModules();
    });
  });

  describe('API key header', () => {
    it('sends X-API-Key header when API key is configured', async () => {
      vi.stubEnv('VITE_API_URL', TEST_API_URL);
      vi.stubEnv('VITE_EVENTS_API_KEY', 'test-key-456');
      await vi.resetModules();
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ counties: [] }),
      });
      const { getPowerOutageCounties: getCounties } = await import('@/services/powerOutageService');
      await getCounties();
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-API-Key': 'test-key-456',
            'Content-Type': 'application/json',
          }),
        })
      );
      await vi.resetModules();
    });
  });
});
