/**
 * @fileoverview Unit tests for utils/osaDataUtils
 * Feature: OSA data transformers
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getCenterCoordinates,
  transformCountyData,
  transformZipData,
  transformUtilityData,
} from '@/utils/osaDataUtils';

const TEXAS_CENTER = [-99.1332, 31.9686];
const HARRIS_COUNTY = 'Harris County';

const NOT_ARRAY_TEST = 'returns empty array and warns when apiData is not an array';

describe('utils/osaDataUtils', () => {
  let consoleWarn;

  beforeEach(() => {
    consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarn.mockRestore();
  });

  describe('getCenterCoordinates', () => {
    it('returns Texas center for any name and type', () => {
      expect(getCenterCoordinates(HARRIS_COUNTY, 'county')).toEqual(TEXAS_CENTER);
      expect(getCenterCoordinates('75001', 'zip')).toEqual(TEXAS_CENTER);
      expect(getCenterCoordinates('Oncor', 'utility')).toEqual(TEXAS_CENTER);
    });
  });

  describe('transformCountyData', () => {
    it('transforms API array to component format', () => {
      const apiData = [
        { CountyName: HARRIS_COUNTY, CustomersOut: 100 },
        { CountyName: 'Dallas County', CustomersOut: 200 },
      ];
      const result = transformCountyData(apiData);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        name: HARRIS_COUNTY,
        customersOut: 100,
        outageCount: 0,
        center: TEXAS_CENTER,
      });
      expect(result[1].name).toBe('Dallas County');
      expect(result[1].customersOut).toBe(200);
    });

    it('uses "Unknown County" when CountyName is missing', () => {
      const result = transformCountyData([{ CustomersOut: 5 }]);
      expect(result[0].name).toBe('Unknown County');
      expect(result[0].customersOut).toBe(5);
    });

    it('uses 0 for missing CustomersOut', () => {
      const result = transformCountyData([{ CountyName: 'Harris' }]);
      expect(result[0].customersOut).toBe(0);
    });

    it(NOT_ARRAY_TEST, () => {
      expect(transformCountyData(null)).toEqual([]);
      expect(transformCountyData(undefined)).toEqual([]);
      expect(transformCountyData({})).toEqual([]);
      expect(consoleWarn).toHaveBeenCalledWith(
        'transformCountyData: apiData is not an array',
        null
      );
    });

    it('preserves extra fields from API item', () => {
      const apiData = [{ CountyName: 'Harris', CustomersOut: 10, FIPS: '48201' }];
      const result = transformCountyData(apiData);
      expect(result[0].FIPS).toBe('48201');
    });
  });

  describe('transformZipData', () => {
    it('transforms API array with centroid_lon/lat', () => {
      const apiData = [
        { ZCTA5CE20: '75001', total_customers_out: 50, centroid_lon: -96.5, centroid_lat: 32.8 },
      ];
      const result = transformZipData(apiData);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: '75001',
        customersOut: 50,
        outageCount: 0,
        center: [-96.5, 32.8],
        centroid_lon: -96.5,
        centroid_lat: 32.8,
      });
    });

    it('uses centroidLon/centroidLat when centroid_lon/lat missing', () => {
      const apiData = [
        { ZCTA5CE20: '75002', total_customers_out: 20, centroidLon: -97.1, centroidLat: 33.0 },
      ];
      const result = transformZipData(apiData);
      expect(result[0].center).toEqual([-97.1, 33.0]);
      expect(result[0].centroid_lon).toBe(-97.1);
      expect(result[0].centroid_lat).toBe(33.0);
    });

    it('falls back to Texas center when centroid is not finite', () => {
      const apiData = [
        { ZCTA5CE20: '75003', total_customers_out: 0, centroid_lon: null, centroid_lat: 32 },
      ];
      const result = transformZipData(apiData);
      expect(result[0].center).toEqual(TEXAS_CENTER);
    });

    it('uses "Unknown Zip" when ZCTA5CE20 missing', () => {
      const result = transformZipData([{ total_customers_out: 1 }]);
      expect(result[0].name).toBe('Unknown Zip');
    });

    it(NOT_ARRAY_TEST, () => {
      expect(transformZipData('not-array')).toEqual([]);
      expect(consoleWarn).toHaveBeenCalled();
    });

    it('preserves extra fields', () => {
      const apiData = [
        {
          ZCTA5CE20: '75001',
          total_customers_out: 10,
          centroid_lon: -96,
          centroid_lat: 32,
          extra: true,
        },
      ];
      const result = transformZipData(apiData);
      expect(result[0].extra).toBe(true);
    });
  });

  describe('transformUtilityData', () => {
    it('transforms API array to component format', () => {
      const apiData = [
        { UtilityName: 'Oncor', CustomersOut: 500 },
        { UtilityName: 'CenterPoint', CustomersOut: 300 },
      ];
      const result = transformUtilityData(apiData);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        name: 'Oncor',
        customersOut: 500,
        outageCount: 0,
        center: TEXAS_CENTER,
      });
    });

    it('uses "Unknown Utility" when UtilityName missing', () => {
      const result = transformUtilityData([{ CustomersOut: 5 }]);
      expect(result[0].name).toBe('Unknown Utility');
    });

    it(NOT_ARRAY_TEST, () => {
      expect(transformUtilityData(123)).toEqual([]);
      expect(consoleWarn).toHaveBeenCalledWith(
        'transformUtilityData: apiData is not an array',
        123
      );
    });
  });
});
