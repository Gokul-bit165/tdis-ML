/**
 * @fileoverview Unit tests for config/hmedLayerConfig
 * HMED layer configuration and getLayerPropertyName.
 */
import { describe, it, expect } from 'vitest';
import { LAYER_CONFIG, getLayerPropertyName } from '@/config/hmedLayerConfig';

describe('config/hmedLayerConfig', () => {
  describe('LAYER_CONFIG', () => {
    it('has precipitation layer with required fields', () => {
      const layer = LAYER_CONFIG.precipitation;
      expect(layer).toBeDefined();
      expect(layer.id).toBe('precipitation');
      expect(layer.name).toBe('Precipitation');
      expect(layer.color).toBe('#3b82f6');
      expect(layer.description).toBeDefined();
      expect(layer.sourceLayerPrefix).toBe('public.precipitation_hsi');
      expect(layer.thresholds).toBeDefined();
      expect(layer.gradient).toBeDefined();
      expect(layer.gradientBar).toBeDefined();
      expect(layer.icon).toBeDefined();
    });

    it('precipitation thresholds include minimal through extreme', () => {
      const { thresholds } = LAYER_CONFIG.precipitation;
      expect(thresholds.minimal).toEqual({ min: 0.0, max: 0.25, color: '#3b82f6' });
      expect(thresholds.elevated).toEqual({ min: 0.25, max: 0.5, color: '#1e40af' });
      expect(thresholds.significant).toEqual({ min: 0.5, max: 1.0, color: '#7c3aed' });
      expect(thresholds.major).toEqual({ min: 1.0, max: 1.5, color: '#c026d3' });
      expect(thresholds.extreme.min).toBe(1.5);
      expect(thresholds.extreme.max).toBe(Infinity);
    });

    it('precipitation has propertyAccessor function', () => {
      expect(typeof LAYER_CONFIG.precipitation.propertyAccessor).toBe('function');
    });

    it('google_flood_hub layer uses flat vector tiles and floodHubGauge symbology', () => {
      const layer = LAYER_CONFIG.google_flood_hub;
      expect(layer.id).toBe('google_flood_hub');
      expect(layer.name).toBe('Flood Hub');
      expect(layer.panelSubtitle).toBe('Powered by Google Flood Hub');
      expect(layer.floodHubGauge).toBe(true);
      expect(layer.floodHubGaugeMvtGeometry).toBe('point');
      expect(layer.vectorTileSourceLayer).toBe('public.google_flood_hub_gauges');
      expect(layer.significantEventsVectorTileSourceLayer).toBe(
        'public.google_flood_hub_significant_events'
      );
      expect(layer.floodHubStatusVectorTileSourceLayer).toBe('public.google_flood_hub_status');
      expect(layer.urbanFlashVectorTileSourceLayer).toBe(
        'public.google_flood_hub_urban_flash_flood'
      );
      expect(layer.urbanFlashLevels).toEqual([6, 7, 8, 9, 10]);
      expect(layer.urbanFlashTileQuery).toBeUndefined();
      expect(layer.levels).toEqual([10]);
      expect(layer.vectorTileMinZoom).toBe(0);
      expect(layer.floodHubGaugesGeoJsonOnLoad).toBe(true);
      expect(layer.floodHubGaugesGeoJsonPath).toBe('/flood-hub/gauges');
      expect(getLayerPropertyName(layer, 3)).toBe('predicted_peak');
    });
  });

  describe('getLayerPropertyName', () => {
    it('uses layer propertyAccessor when present (default H3 level 6)', () => {
      const layer = LAYER_CONFIG.precipitation;
      expect(getLayerPropertyName(layer, 3)).toBe('precip_3h_hsi_l6_50yr');
      expect(getLayerPropertyName(layer, 6)).toBe('precip_6h_hsi_l6_50yr');
      expect(getLayerPropertyName(layer, 12, '100')).toBe('precip_12h_hsi_l6_100yr');
    });

    it('includes H3 level in property name when provided', () => {
      const layer = LAYER_CONFIG.precipitation;
      expect(getLayerPropertyName(layer, 3, '50', 8)).toBe('precip_3h_hsi_l8_50yr');
    });

    it('falls back to getHsiPropertyName when no propertyAccessor', () => {
      const layerWithoutAccessor = { id: 'other' };
      expect(getLayerPropertyName(layerWithoutAccessor, 24)).toBe('precip_24h_hsi_l6_50yr');
    });

    it('uses custom returnPeriod when provided', () => {
      const layer = LAYER_CONFIG.precipitation;
      expect(getLayerPropertyName(layer, 3, '100')).toBe('precip_3h_hsi_l6_100yr');
    });
  });
});
