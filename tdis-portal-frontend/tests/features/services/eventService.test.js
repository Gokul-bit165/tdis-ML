/**
 * @fileoverview Unit tests for eventService (Active Weather Events)
 * Feature: Active Weather Events
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchEventCounts, fetchEventData } from '@/services/eventService';
import { get24HourRollingWindow } from '@/utils/dateUtils';
import * as apiClient from '@/services/apiClient';

const WINDOW_START = '2024-01-01T00:00:00.000Z';
const WINDOW_END = '2024-01-02T00:00:00.000Z';
const SAMPLE_EVENT_DATE = '2024-01-01T12:00:00Z';

vi.mock('@/utils/dateUtils', () => ({
  get24HourRollingWindow: vi.fn(() => [WINDOW_START, WINDOW_END]),
}));

vi.mock('@/services/apiClient', () => ({
  getCountsByType: vi.fn(),
  getEvents: vi.fn(),
}));

describe('eventService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchEventCounts', () => {
    it('calls get24HourRollingWindow and getCountsByType', async () => {
      vi.mocked(apiClient.getCountsByType).mockResolvedValue([]);
      const setEventCounts = vi.fn();
      const setIsEventCountsLoading = vi.fn();

      await fetchEventCounts(setEventCounts, setIsEventCountsLoading);

      expect(get24HourRollingWindow).toHaveBeenCalled();
      expect(apiClient.getCountsByType).toHaveBeenCalledWith(
        WINDOW_START,
        WINDOW_END
      );
    });

    it('sets loading true then false', async () => {
      vi.mocked(apiClient.getCountsByType).mockResolvedValue([]);
      const setEventCounts = vi.fn();
      const setIsEventCountsLoading = vi.fn();

      await fetchEventCounts(setEventCounts, setIsEventCountsLoading);

      expect(setIsEventCountsLoading).toHaveBeenCalledWith(true);
      expect(setIsEventCountsLoading).toHaveBeenCalledWith(false);
    });

    it('normalizes and sets event counts from API response', async () => {
      vi.mocked(apiClient.getCountsByType).mockResolvedValue([
        { eventType: 'Wildfire', count: 10 },
        { eventType: 'Rainfall', count: 5 },
      ]);
      const setEventCounts = vi.fn();
      const setIsEventCountsLoading = vi.fn();

      await fetchEventCounts(setEventCounts, setIsEventCountsLoading);

      expect(setEventCounts).toHaveBeenCalledWith([
        { type: 'wildfire', count: 10 },
        { type: 'rainfall', count: 5 },
      ]);
    });

    it('handles non-array response as empty', async () => {
      vi.mocked(apiClient.getCountsByType).mockResolvedValue(null);
      const setEventCounts = vi.fn();
      const setIsEventCountsLoading = vi.fn();

      await fetchEventCounts(setEventCounts, setIsEventCountsLoading);

      expect(setEventCounts).toHaveBeenCalledWith([]);
    });

    it('on error sets event counts to empty and loading false', async () => {
      vi.mocked(apiClient.getCountsByType).mockRejectedValue(new Error('Network error'));
      const setEventCounts = vi.fn();
      const setIsEventCountsLoading = vi.fn();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await fetchEventCounts(setEventCounts, setIsEventCountsLoading);

      expect(setEventCounts).toHaveBeenCalledWith([]);
      expect(setIsEventCountsLoading).toHaveBeenCalledWith(false);
      consoleSpy.mockRestore();
    });
  });

  describe('fetchEventData', () => {
    it('calls get24HourRollingWindow and getEvents', async () => {
      vi.mocked(apiClient.getEvents).mockResolvedValue([]);
      const result = await fetchEventData();
      expect(get24HourRollingWindow).toHaveBeenCalled();
      expect(apiClient.getEvents).toHaveBeenCalledWith(
        WINDOW_START,
        WINDOW_END
      );
      expect(result).toEqual({ geojson: null, latestEventDate: null });
    });

    it('returns geojson and latestEventDate when events exist', async () => {
      vi.mocked(apiClient.getEvents).mockResolvedValue([
        {
          event_type: 'wildfire',
          longitude: -99,
          latitude: 31,
          county: 'Travis',
          event_date: SAMPLE_EVENT_DATE,
          description: 'Fire',
          event_store_id: '1',
          created_at: SAMPLE_EVENT_DATE,
          event_count: 1,
        },
      ]);
      const result = await fetchEventData();
      expect(result.geojson).not.toBeNull();
      expect(result.geojson.type).toBe('FeatureCollection');
      expect(result.geojson.features).toHaveLength(1);
      expect(result.geojson.features[0].geometry.type).toBe('Point');
      expect(result.geojson.features[0].geometry.coordinates).toEqual([-99, 31]);
      expect(result.geojson.features[0].properties.eventType).toBe('wildfire');
      expect(result.latestEventDate).toBe(SAMPLE_EVENT_DATE);
    });

    it('uses geometry when present', async () => {
      vi.mocked(apiClient.getEvents).mockResolvedValue([
        {
          event_type: 'wildfire',
          geometry: { type: 'Point', coordinates: [-98, 30] },
          county: 'Harris',
          event_date: '2024-01-01T10:00:00Z',
        },
      ]);
      const result = await fetchEventData();
      expect(result.geojson.features[0].geometry).toEqual({
        type: 'Point',
        coordinates: [-98, 30],
      });
    });

    it('falls back to longitude/latitude when geometry invalid', async () => {
      vi.mocked(apiClient.getEvents).mockResolvedValue([
        {
          event_type: 'hail',
          longitude: -100,
          latitude: 32,
          geometry: { type: 'Point' },
        },
      ]);
      const result = await fetchEventData();
      expect(result.geojson.features[0].geometry.type).toBe('Point');
      expect(result.geojson.features[0].geometry.coordinates).toEqual([-100, 32]);
    });

    it('returns latestEventDate as latest among events', async () => {
      vi.mocked(apiClient.getEvents).mockResolvedValue([
        { event_type: 'a', longitude: 0, latitude: 0, event_date: '2024-01-01T10:00:00Z' },
        { event_type: 'b', longitude: 0, latitude: 0, event_date: '2024-01-01T14:00:00Z' },
      ]);
      const result = await fetchEventData();
      expect(result.latestEventDate).toBe('2024-01-01T14:00:00Z');
    });
  });
});
