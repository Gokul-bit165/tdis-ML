/**
 * @fileoverview Unit tests for config/mapConfig (HMED_CONFIG and map constants).
 */
import { describe, it, expect } from 'vitest';
import {
  TILE_SERVER_BASE_URL,
  TEXAS_CENTER,
  DEFAULT_ZOOM,
  TEXAS_BOUNDS,
  TEXAS_MAX_BOUNDS,
  TEXAS_MIN_ZOOM,
  HMED_CONFIG,
  MAP_CONTROLS_CSS,
  MAP_POPUP_CSS,
} from '@/config/mapConfig';

describe('config/mapConfig', () => {
  describe('tile and map constants', () => {
    it('TILE_SERVER_BASE_URL is defined', () => {
      expect(TILE_SERVER_BASE_URL).toBeDefined();
      expect(typeof TILE_SERVER_BASE_URL).toBe('string');
    });

    it('TEXAS_CENTER is [lng, lat]', () => {
      expect(TEXAS_CENTER).toHaveLength(2);
      expect(TEXAS_CENTER[0]).toBe(-99.1332);
      expect(TEXAS_CENTER[1]).toBe(31.9686);
    });

    it('DEFAULT_ZOOM is number framed on Texas', () => {
      expect(DEFAULT_ZOOM).toBe(4.25);
    });

    it('TEXAS_MIN_ZOOM allows fitBounds under UI padding', () => {
      expect(TEXAS_MIN_ZOOM).toBe(3);
      expect(TEXAS_MIN_ZOOM).toBeLessThanOrEqual(DEFAULT_ZOOM);
    });

    it('TEXAS_BOUNDS has SW and NE corners', () => {
      expect(TEXAS_BOUNDS).toHaveLength(2);
      expect(TEXAS_BOUNDS[0]).toHaveLength(2);
      expect(TEXAS_BOUNDS[1]).toHaveLength(2);
    });

    it('TEXAS_MAX_BOUNDS is wide enough for landscape Texas framing', () => {
      expect(TEXAS_MAX_BOUNDS).toHaveLength(2);
      const width = TEXAS_MAX_BOUNDS[1][0] - TEXAS_MAX_BOUNDS[0][0];
      const texasWidth = TEXAS_BOUNDS[1][0] - TEXAS_BOUNDS[0][0];
      expect(width).toBeGreaterThan(texasWidth * 2);
      expect(TEXAS_MAX_BOUNDS[0][0]).toBeLessThan(TEXAS_BOUNDS[0][0]);
      expect(TEXAS_MAX_BOUNDS[1][0]).toBeGreaterThan(TEXAS_BOUNDS[1][0]);
    });
  });

  describe('HMED_CONFIG', () => {
    it('has hsiValueOffset', () => {
      expect(HMED_CONFIG).toHaveProperty('hsiValueOffset');
      expect(HMED_CONFIG.hsiValueOffset).toBe(0);
    });

    it('has returnPeriod', () => {
      expect(HMED_CONFIG.returnPeriod).toBe('50');
    });

    it('has hourOptions', () => {
      expect(HMED_CONFIG.hourOptions).toEqual([3, 6, 12, 24]);
    });

    it('has defaultHours', () => {
      expect(HMED_CONFIG.defaultHours).toBe(3);
    });

    it('has h3Levels with zoom ranges', () => {
      expect(HMED_CONFIG.h3Levels).toBeDefined();
      expect(HMED_CONFIG.h3Levels[6]).toEqual({ minZoom: 0, maxZoom: 7 });
      expect(HMED_CONFIG.h3Levels[10]).toEqual({ minZoom: 12, maxZoom: 22 });
    });

    it('getHsiPropertyName returns MVT property name for precipitation HSI columns', () => {
      expect(HMED_CONFIG.getHsiPropertyName(3, '50')).toBe('precip_3h_hsi_l6_50yr');
      expect(HMED_CONFIG.getHsiPropertyName(24, '100')).toBe('precip_24h_hsi_l6_100yr');
      expect(HMED_CONFIG.getHsiPropertyName(6)).toBe('precip_6h_hsi_l6_50yr');
      expect(HMED_CONFIG.getHsiPropertyName(3, '50', 9)).toBe('precip_3h_hsi_l9_50yr');
    });
  });

  describe('MAP_CONTROLS_CSS / MAP_POPUP_CSS', () => {
    it('MAP_CONTROLS_CSS is non-empty string', () => {
      expect(typeof MAP_CONTROLS_CSS).toBe('string');
      expect(MAP_CONTROLS_CSS.length).toBeGreaterThan(0);
    });

    it('MAP_POPUP_CSS is non-empty string', () => {
      expect(typeof MAP_POPUP_CSS).toBe('string');
      expect(MAP_POPUP_CSS.length).toBeGreaterThan(0);
    });
  });
});
