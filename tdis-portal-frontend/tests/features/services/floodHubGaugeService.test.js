/**
 * @fileoverview Unit tests for floodHubGaugeService
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getFloodHubGaugesGeoJsonUrl,
  normalizeFloodHubGaugesGeoJson,
  fetchFloodHubGaugesGeoJson,
} from '@/services/floodHubGaugeService';

describe('floodHubGaugeService', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_FLOOD_HUB_GAUGES_GEOJSON_URL', '');
    vi.stubEnv('VITE_API_URL', 'https://api.example.com/api/v1');
    vi.stubEnv('VITE_EVENTS_API_URL', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('getFloodHubGaugesGeoJsonUrl', () => {
    it('uses explicit env URL when set', () => {
      vi.stubEnv('VITE_FLOOD_HUB_GAUGES_GEOJSON_URL', 'https://custom/gauges.geojson');
      expect(getFloodHubGaugesGeoJsonUrl()).toBe('https://custom/gauges.geojson');
    });

    it('builds URL from VITE_API_URL, path, and Texas bbox', () => {
      const url = getFloodHubGaugesGeoJsonUrl();
      expect(url).toBe(
        'https://api.example.com/api/v1/flood-hub/gauges?bbox=-106.645646%2C25.837377%2C-93.508292%2C36.500704'
      );
    });
  });

  describe('normalizeFloodHubGaugesGeoJson', () => {
    it('accepts FeatureCollection', () => {
      const fc = { type: 'FeatureCollection', features: [] };
      expect(normalizeFloodHubGaugesGeoJson(fc)).toEqual(fc);
    });

    it('accepts wrapped features array', () => {
      const features = [
        { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: {} },
      ];
      expect(normalizeFloodHubGaugesGeoJson({ features })).toEqual({
        type: 'FeatureCollection',
        features,
      });
    });
  });

  describe('fetchFloodHubGaugesGeoJson', () => {
    it('filters to Point features only', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [-95, 29] },
              properties: { gauge_id: 'a' },
            },
            {
              type: 'Feature',
              geometry: { type: 'Polygon', coordinates: [] },
              properties: {},
            },
          ],
        }),
      });

      const fc = await fetchFloodHubGaugesGeoJson();
      expect(fc.features).toHaveLength(1);
      expect(fc.features[0].properties.gauge_id).toBe('a');
    });
  });
});
