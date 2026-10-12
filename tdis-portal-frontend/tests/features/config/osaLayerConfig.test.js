/**
 * @fileoverview Unit tests for config/osaLayerConfig
 * Feature: OSA layer configuration
 */
import { describe, it, expect } from 'vitest';
import { LAYER_CONFIG, getLayerIdentifiers } from '@/config/osaLayerConfig';

describe('config/osaLayerConfig', () => {
  describe('LAYER_CONFIG', () => {
    it('has power_outage layer with required fields', () => {
      const layer = LAYER_CONFIG.power_outage;
      expect(layer).toBeDefined();
      expect(layer.id).toBe('power_outage');
      expect(layer.name).toBe('Power Outages');
      expect(layer.color).toBe('#ea580c');
      expect(layer.description).toBeDefined();
      expect(layer.sourceLayerName).toBe('public.power_outage');
      expect(layer.propertyName).toBe('CustomersOut');
      expect(layer.thresholds).toBeDefined();
      expect(layer.gradient).toBeDefined();
      expect(layer.gradientBar).toBeDefined();
      expect(layer.icon).toBeDefined();
    });

    it('has power_outage_zip layer', () => {
      const layer = LAYER_CONFIG.power_outage_zip;
      expect(layer.id).toBe('power_outage_zip');
      expect(layer.name).toBe('Power Outages by Zip');
      expect(layer.sourceLayerName).toBe('public.mv_power_outage_by_zip_centroid');
      expect(layer.propertyName).toBe('total_customers_out');
    });

    it('has road_closures layer with hazard config', () => {
      const layer = LAYER_CONFIG.road_closures;
      expect(layer.id).toBe('road_closures');
      expect(layer.name).toBe('Road Weather Hazard Alerts');
      expect(layer.showSummaryStats).toBe(false);
      expect(layer.summaryStatsViewMode).toBe('county');
      expect(layer.sourceType).toBe('hazards');
    });

    it('power_outage thresholds include none through extreme', () => {
      const { thresholds } = LAYER_CONFIG.power_outage;
      expect(thresholds.none).toEqual({ min: 0, max: 0, color: '#ea580c' });
      expect(thresholds.extreme.min).toBe(10000);
      expect(thresholds.extreme.max).toBe(Infinity);
    });
  });

  describe('getLayerIdentifiers', () => {
    it('returns source and layer IDs from layer config', () => {
      const config = { id: 'power_outage' };
      const ids = getLayerIdentifiers(config);
      expect(ids).toEqual({
        sourceId: 'power_outage-source',
        fillLayerId: 'power_outage-fill',
        lineLayerId: 'power_outage-lines',
        circleLayerId: 'power_outage-circles',
      });
    });

    it('uses layer id for all identifier suffixes', () => {
      const ids = getLayerIdentifiers(LAYER_CONFIG.power_outage_zip);
      expect(ids.sourceId).toBe('power_outage_zip-source');
      expect(ids.fillLayerId).toBe('power_outage_zip-fill');
      expect(ids.lineLayerId).toBe('power_outage_zip-lines');
      expect(ids.circleLayerId).toBe('power_outage_zip-circles');
    });
  });
});
