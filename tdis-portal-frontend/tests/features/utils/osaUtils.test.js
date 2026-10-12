/**
 * @fileoverview Unit tests for utils/osaUtils
 * Feature: utils
 */
import { describe, it, expect } from 'vitest';
import { hasGeometryType, getOptimalAnchor } from '@/utils/osaUtils';

describe('utils/osaUtils', () => {
  describe('hasGeometryType', () => {
    it('returns true when geometry types include the type', () => {
      expect(hasGeometryType(['polygon', 'point'], 'point')).toBe(true);
      expect(hasGeometryType(['Polygon', 'Line'], 'polygon')).toBe(true);
    });

    it('returns false when geometry types do not include the type', () => {
      expect(hasGeometryType(['polygon'], 'point')).toBe(false);
    });

    it('returns true for empty array (default when cannot detect)', () => {
      expect(hasGeometryType([], 'point')).toBe(true);
    });

    it('handles undefined geometryTypes', () => {
      expect(hasGeometryType(undefined, 'point')).toBe(true);
    });
  });

  describe('getOptimalAnchor', () => {
    it('returns anchor string based on map and point', () => {
      const map = {
        getContainer: () => ({
          getBoundingClientRect: () => ({ width: 800, height: 600 }),
        }),
        project: () => ({ x: 400, y: 100 }),
      };
      const anchor = getOptimalAnchor({ lng: -99, lat: 31 }, map, { isMobile: false });
      expect(['top', 'bottom', 'top-left', 'top-right', 'left', 'right']).toContain(anchor);
    });

    it('uses isMobile option', () => {
      const map = {
        getContainer: () => ({
          getBoundingClientRect: () => ({ width: 400, height: 600 }),
        }),
        project: () => ({ x: 200, y: 500 }),
      };
      const anchor = getOptimalAnchor({ lng: -99, lat: 31 }, map, { isMobile: true });
      expect(['top', 'bottom']).toContain(anchor);
    });
  });
});
