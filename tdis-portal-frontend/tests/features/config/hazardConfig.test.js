/**
 * @fileoverview Unit tests for config/hazardConfig
 * Feature: config
 */
import { describe, it, expect } from 'vitest';
import {
  HAZARD_TILE_LAYERS,
  HAZARD_ZOOM_THRESHOLDS,
  HAZARD_BOUNDS,
  HAZARD_CATEGORY_FLAGS,
  HAZARD_CATEGORIES,
} from '@/config/hazardConfig';

describe('config/hazardConfig', () => {
  describe('HAZARD_TILE_LAYERS', () => {
    it('has countyTotal, countySubtype, points', () => {
      expect(HAZARD_TILE_LAYERS.countyTotal).toContain('crowdsource_waze');
      expect(HAZARD_TILE_LAYERS.countySubtype).toBeDefined();
      expect(HAZARD_TILE_LAYERS.points).toBeDefined();
    });
  });

  describe('HAZARD_ZOOM_THRESHOLDS', () => {
    it('has countyTotal, circles, points with min/max', () => {
      expect(HAZARD_ZOOM_THRESHOLDS.countyTotal).toEqual({ min: 0, max: 7 });
      expect(HAZARD_ZOOM_THRESHOLDS.circles.min).toBe(6);
      expect(HAZARD_ZOOM_THRESHOLDS.points.min).toBe(12);
    });
  });

  describe('HAZARD_BOUNDS', () => {
    it('is Texas bounding box [west, south, east, north]', () => {
      expect(HAZARD_BOUNDS).toHaveLength(4);
      expect(HAZARD_BOUNDS[0]).toBeLessThan(HAZARD_BOUNDS[2]);
      expect(HAZARD_BOUNDS[1]).toBeLessThan(HAZARD_BOUNDS[3]);
    });
  });

  describe('HAZARD_CATEGORY_FLAGS', () => {
    it('has weather_hazards and other category flags', () => {
      expect(typeof HAZARD_CATEGORY_FLAGS.weather_hazards).toBe('boolean');
    });
  });

  describe('HAZARD_CATEGORIES', () => {
    it('has weather_hazards category with subtypes', () => {
      const weather = HAZARD_CATEGORIES.weather_hazards;
      expect(weather).toBeDefined();
      expect(weather.name).toBe('Weather Hazards');
      expect(Array.isArray(weather.subtypes)).toBe(true);
      expect(weather.subtypes.length).toBeGreaterThan(0);
    });
  });
});
