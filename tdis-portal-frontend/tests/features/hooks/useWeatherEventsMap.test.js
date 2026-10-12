/**
 * @fileoverview Unit tests for useWeatherEventsMap hook
 * Feature: Active Weather Events
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useWeatherEventsMap } from '@/hooks/useWeatherEventsMap';

const mockMapInstance = {
  on: vi.fn(),
  once: vi.fn(),
  off: vi.fn(),
  remove: vi.fn(),
  loaded: vi.fn(() => true),
  isStyleLoaded: vi.fn(() => true),
  getStyle: () => ({ layers: [] }),
  resize: vi.fn(),
};

vi.mock('mapbox-gl', () => ({
  default: {
    get accessToken() {
      return typeof globalThis.__mapboxToken !== 'undefined'
        ? globalThis.__mapboxToken
        : 'test-token';
    },
    set accessToken(_) {},
    Map: vi.fn(),
  },
}));

vi.mock('@/services/eventService', () => ({
  fetchEventCounts: vi.fn((setEventCounts, setIsEventCountsLoading) => {
    setIsEventCountsLoading(true);
    setEventCounts([]);
    setIsEventCountsLoading(false);
  }),
}));

vi.mock('@/services/mapService', () => ({
  loadMapIcons: vi.fn(() => Promise.resolve()),
  loadEventData: vi.fn(() => Promise.resolve({ latestEventDate: '2024-01-01T00:00:00Z' })),
  updateEventLayerVisibility: vi.fn(),
  updateLayerVisibility: vi.fn(),
}));

vi.mock('@/utils/mapUtils', () => ({
  createMapInstance: vi.fn(() => mockMapInstance),
  addStandardControls: vi.fn(),
  waitForStyleLoad: vi.fn(() => Promise.resolve(true)),
  loadCountyBoundaries: vi.fn(() => Promise.resolve()),
  createStyleChangeHandler: vi.fn(() => vi.fn()),
  isMapAlive: vi.fn(() => true),
  scheduleMapLayersLoad: vi.fn((map, loadLayersFn, initialLoadCompleteRef, options = {}) => {
    Promise.resolve(loadLayersFn()).then(() => {
      initialLoadCompleteRef.current = true;
      if (options.onReady) options.onReady(map);
    });
  }),
}));

vi.mock('@/utils/criticalFacilitiesMapLayers', () => ({
  loadCriticalFacilityLayers: vi.fn(() => Promise.resolve()),
  updateCriticalFacilityVisibility: vi.fn(() => Promise.resolve()),
  bindCriticalFacilityInteractions: vi.fn(() => vi.fn()),
}));

vi.mock('@/config/criticalFacilitiesConfig', () => ({
  getDefaultCriticalFacilityVisibility: () => ({}),
  CRITICAL_FACILITY_LAYERS: [],
}));

describe('useWeatherEventsMap', () => {
  let mapContainerRef;
  let setEventCounts;
  let setIsEventCountsLoading;
  let onLatestEventDate;
  let onMapReady;

  beforeEach(() => {
    vi.clearAllMocks();
    mapContainerRef = { current: document.createElement('div') };
    setEventCounts = vi.fn();
    setIsEventCountsLoading = vi.fn();
    onLatestEventDate = vi.fn();
    onMapReady = vi.fn();
    mockMapInstance.loaded.mockReturnValue(true);
    mockMapInstance.isStyleLoaded.mockReturnValue(true);
  });

  it('returns mapRef, loadingStates, error, setError', () => {
    const { result } = renderHook(() =>
      useWeatherEventsMap(mapContainerRef, {
        selectedEvents: [],
        layerVisibility: {},
        setEventCounts,
        setIsEventCountsLoading,
        onLatestEventDate,
        onMapReady,
      })
    );
    expect(result.current).toHaveProperty('mapRef');
    expect(result.current).toHaveProperty('loadingStates');
    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('setError');
    expect(result.current.loadingStates).toEqual({
      events: expect.any(Boolean),
      geojson: expect.any(Boolean),
      eventCounts: expect.any(Boolean),
    });
  });

  it('sets error when mapbox access token is missing', async () => {
    globalThis.__mapboxToken = '';
    const { result } = renderHook(() =>
      useWeatherEventsMap(mapContainerRef, {
        selectedEvents: [],
        layerVisibility: {},
        setEventCounts,
        setIsEventCountsLoading,
      })
    );
    await waitFor(() => {
      expect(result.current.error).toBe('Mapbox access token is not configured');
    });
    delete globalThis.__mapboxToken;
  });

  it('calls createMapInstance and addStandardControls when container and token exist', async () => {
    const mapUtils = await import('@/utils/mapUtils');
    renderHook(() =>
      useWeatherEventsMap(mapContainerRef, {
        selectedEvents: [],
        layerVisibility: {},
        setEventCounts,
        setIsEventCountsLoading,
      })
    );
    expect(mapUtils.createMapInstance).toHaveBeenCalledWith(mapContainerRef.current);
    expect(mapUtils.addStandardControls).toHaveBeenCalledWith(mockMapInstance);
  });

  it('calls fetchEventCounts with setEventCounts and setIsEventCountsLoading', async () => {
    const eventService = await import('@/services/eventService');
    renderHook(() =>
      useWeatherEventsMap(mapContainerRef, {
        selectedEvents: [],
        layerVisibility: {},
        setEventCounts,
        setIsEventCountsLoading,
      })
    );
    expect(eventService.fetchEventCounts).toHaveBeenCalledWith(
      setEventCounts,
      setIsEventCountsLoading
    );
  });

  it('calls updateEventLayerVisibility when selectedEvents change', async () => {
    const mapService = await import('@/services/mapService');
    const { rerender } = renderHook(
      ({ selectedEvents }) =>
        useWeatherEventsMap(mapContainerRef, {
          selectedEvents,
          layerVisibility: {},
          setEventCounts,
          setIsEventCountsLoading,
        }),
      { initialProps: { selectedEvents: ['Wildfire'] } }
    );
    rerender({ selectedEvents: ['Wildfire', 'Rainfall'] });
    expect(mapService.updateEventLayerVisibility).toHaveBeenCalledWith(mockMapInstance, [
      'Wildfire',
      'Rainfall',
    ]);
  });

  it('calls updateLayerVisibility when layerVisibility change', async () => {
    const mapService = await import('@/services/mapService');
    const { rerender } = renderHook(
      ({ layerVisibility }) =>
        useWeatherEventsMap(mapContainerRef, {
          selectedEvents: [],
          layerVisibility,
          setEventCounts,
          setIsEventCountsLoading,
        }),
      { initialProps: { layerVisibility: { events: true } } }
    );
    rerender({ layerVisibility: { events: false } });
    expect(mapService.updateLayerVisibility).toHaveBeenCalledWith(mockMapInstance, {
      events: false,
    });
  });

  it('cleans up map on unmount', () => {
    const { unmount } = renderHook(() =>
      useWeatherEventsMap(mapContainerRef, {
        selectedEvents: [],
        layerVisibility: {},
        setEventCounts,
        setIsEventCountsLoading,
      })
    );
    unmount();
    expect(mockMapInstance.off).toHaveBeenCalled();
    expect(mockMapInstance.remove).toHaveBeenCalled();
  });

  it('does not set error when container ref is null (no token check)', () => {
    const emptyRef = { current: null };
    const { result } = renderHook(() =>
      useWeatherEventsMap(emptyRef, {
        selectedEvents: [],
        layerVisibility: {},
        setEventCounts,
        setIsEventCountsLoading,
      })
    );
    expect(result.current.error).toBeNull();
  });

  it('sets error when loadEventData throws', async () => {
    const mapService = await import('@/services/mapService');
    vi.mocked(mapService.loadEventData).mockRejectedValueOnce(new Error('API error'));
    const { result } = renderHook(() =>
      useWeatherEventsMap(mapContainerRef, {
        selectedEvents: [],
        layerVisibility: {},
        setEventCounts,
        setIsEventCountsLoading,
      })
    );
    await waitFor(() => {
      expect(result.current.error).toBe('Failed to load event data.');
    });
  });

  it('sets error when loadCountyBoundaries throws', async () => {
    const mapUtils = await import('@/utils/mapUtils');
    vi.mocked(mapUtils.loadCountyBoundaries).mockRejectedValueOnce(new Error('Fetch failed'));
    const { result } = renderHook(() =>
      useWeatherEventsMap(mapContainerRef, {
        selectedEvents: [],
        layerVisibility: {},
        setEventCounts,
        setIsEventCountsLoading,
      })
    );
    await waitFor(() => {
      expect(result.current.error).toBe('Failed to load map outlines.');
    });
  });

  it('does not fail the map when critical facilities load throws', async () => {
    const facilities = await import('@/utils/criticalFacilitiesMapLayers');
    vi.mocked(facilities.loadCriticalFacilityLayers).mockRejectedValueOnce(new Error('RAMP down'));
    const { result } = renderHook(() =>
      useWeatherEventsMap(mapContainerRef, {
        selectedEvents: [],
        layerVisibility: {},
        setEventCounts,
        setIsEventCountsLoading,
      })
    );
    await waitFor(() => {
      expect(result.current.loadingStates.events).toBe(false);
    });
    expect(result.current.error).not.toBe('Failed to load map outlines.');
  });

  it('updates critical facility visibility when facilityVisibility changes', async () => {
    const facilities = await import('@/utils/criticalFacilitiesMapLayers');
    const { rerender } = renderHook(
      ({ facilityVisibility }) =>
        useWeatherEventsMap(mapContainerRef, {
          selectedEvents: [],
          layerVisibility: {},
          setEventCounts,
          setIsEventCountsLoading,
          facilityVisibility,
        }),
      { initialProps: { facilityVisibility: { schools: false } } }
    );

    await waitFor(() => {
      expect(facilities.loadCriticalFacilityLayers).toHaveBeenCalled();
    });

    rerender({ facilityVisibility: { schools: true } });
    await waitFor(() => {
      expect(facilities.updateCriticalFacilityVisibility).toHaveBeenCalledWith(
        mockMapInstance,
        { schools: true }
      );
    });
  });

  it('calls onLatestEventDate and onMapReady when load succeeds', async () => {
    const { result } = renderHook(() =>
      useWeatherEventsMap(mapContainerRef, {
        selectedEvents: [],
        layerVisibility: {},
        setEventCounts,
        setIsEventCountsLoading,
        onLatestEventDate,
        onMapReady,
      })
    );
    await waitFor(() => {
      expect(result.current.error).toBeNull();
    });
    await waitFor(() => {
      expect(onLatestEventDate).toHaveBeenCalledWith('2024-01-01T00:00:00Z');
      expect(onMapReady).toHaveBeenCalledWith(mockMapInstance);
    });
  });

  it('schedules map layers load when map not yet loaded', async () => {
    mockMapInstance.loaded.mockReturnValue(false);
    mockMapInstance.isStyleLoaded.mockReturnValue(true);
    const mapUtils = await import('@/utils/mapUtils');
    renderHook(() =>
      useWeatherEventsMap(mapContainerRef, {
        selectedEvents: [],
        layerVisibility: {},
        setEventCounts,
        setIsEventCountsLoading,
      })
    );
    expect(mapUtils.scheduleMapLayersLoad).toHaveBeenCalledWith(
      mockMapInstance,
      expect.any(Function),
      expect.any(Object),
      expect.objectContaining({ styleLoadEvent: 'style.load' })
    );
    mockMapInstance.loaded.mockReturnValue(true);
  });
});
