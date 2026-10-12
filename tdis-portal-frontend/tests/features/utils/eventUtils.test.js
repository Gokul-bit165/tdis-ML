/**
 * @fileoverview Unit tests for utils/eventUtils
 * Feature: utils
 */
import { describe, it, expect } from 'vitest';
import { filterEventsByType, EVENT_TYPES } from '@/utils/eventUtils';

describe('utils/eventUtils', () => {
  const geojson = {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { eventType: 'fire' }, geometry: {} },
      { type: 'Feature', properties: { eventType: 'flood' }, geometry: {} },
      { type: 'Feature', properties: { eventType: 'fire' }, geometry: {} },
    ],
  };

  describe('filterEventsByType', () => {
    it('returns FeatureCollection with filtered features', () => {
      const result = filterEventsByType(geojson, 'fire');
      expect(result.type).toBe('FeatureCollection');
      expect(Array.isArray(result.features)).toBe(true);
      expect(result.features).toHaveLength(2);
      expect(result.features.every((f) => f.properties.eventType === 'fire')).toBe(true);
    });

    it('returns empty features array when no match', () => {
      const result = filterEventsByType(geojson, 'hurricane');
      expect(result.type).toBe('FeatureCollection');
      expect(result.features).toHaveLength(0);
    });

    it('handles empty features', () => {
      const empty = { type: 'FeatureCollection', features: [] };
      const result = filterEventsByType(empty, 'fire');
      expect(result.features).toHaveLength(0);
    });
  });

  describe('EVENT_TYPES', () => {
    it('exports expected event type constants', () => {
      expect(EVENT_TYPES.FIRE).toBe('fire');
      expect(EVENT_TYPES.FLOOD).toBe('flood');
      expect(EVENT_TYPES.HIGH_WIND).toBe('high wind');
      expect(EVENT_TYPES.THUNDERSTORM).toBe('thunderstorm');
      expect(EVENT_TYPES.HURRICANE).toBe('hurricane');
      expect(EVENT_TYPES.HAIL).toBe('hail');
    });
  });
});
