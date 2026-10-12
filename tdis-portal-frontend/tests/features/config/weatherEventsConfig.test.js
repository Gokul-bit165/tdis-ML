/**
 * @fileoverview Unit tests for config/weatherEventsConfig
 * Feature: config
 */
import { describe, it, expect } from 'vitest';
import { DEFAULT_SELECTED_EVENTS, WEATHER_EVENT_LAYER_IDS } from '@/config/weatherEventsConfig';

describe('config/weatherEventsConfig', () => {
  describe('DEFAULT_SELECTED_EVENTS', () => {
    it('is an array of event names', () => {
      expect(Array.isArray(DEFAULT_SELECTED_EVENTS)).toBe(true);
      expect(DEFAULT_SELECTED_EVENTS).toContain('Wildfire');
      expect(DEFAULT_SELECTED_EVENTS).toContain('Rainfall');
      expect(DEFAULT_SELECTED_EVENTS).toContain('Hail');
    });

    it('has five default events', () => {
      expect(DEFAULT_SELECTED_EVENTS).toHaveLength(5);
    });

    it('does not include forecast Hurricane events', () => {
      expect(DEFAULT_SELECTED_EVENTS).not.toContain('Hurricane');
    });
  });

  describe('WEATHER_EVENT_LAYER_IDS', () => {
    it('has source, unclusteredPoints, eventPetals, outlineLine', () => {
      expect(WEATHER_EVENT_LAYER_IDS.source).toBe('all-events');
      expect(WEATHER_EVENT_LAYER_IDS.unclusteredPoints).toBe('all-unclustered-points');
      expect(WEATHER_EVENT_LAYER_IDS.eventPetals).toBe('event-petals-layer');
      expect(WEATHER_EVENT_LAYER_IDS.outlineLine).toBe('outline-layer-line');
    });
  });
});
