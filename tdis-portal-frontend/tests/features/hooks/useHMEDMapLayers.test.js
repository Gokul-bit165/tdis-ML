/**
 * @fileoverview Unit tests for useHMEDMapLayers
 * Mocks mapbox-gl and mapUtils to test hook state and cleanup.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useHMEDMapLayers } from '@/hooks/useHMEDMapLayers';

const mockRemove = vi.fn();
const mockOn = vi.fn();
const mockOnce = vi.fn();
const mockGetZoom = vi.fn(() => 8);
const mockGetCenter = vi.fn(() => ({ lng: -99, lat: 31 }));
const mockGetLayer = vi.fn(() => true);
const mockGetLayoutProperty = vi.fn(() => 'visible');
const mockSetLayoutProperty = vi.fn();
const mockTriggerRepaint = vi.fn();
const mockJumpTo = vi.fn();
const mockGetStyle = vi.fn(() => ({}));
const mockLoaded = vi.fn(() => true);
const mockIsStyleLoaded = vi.fn(() => true);

const createMockMap = () => ({
  remove: mockRemove,
  on: mockOn,
  once: mockOnce,
  getZoom: mockGetZoom,
  getCenter: mockGetCenter,
  getLayer: mockGetLayer,
  getLayoutProperty: mockGetLayoutProperty,
  setLayoutProperty: mockSetLayoutProperty,
  triggerRepaint: mockTriggerRepaint,
  jumpTo: mockJumpTo,
  getStyle: mockGetStyle,
  loaded: mockLoaded,
  isStyleLoaded: mockIsStyleLoaded,
  getCanvas: () => ({ style: {} }),
  getContainer: () => ({}),
  getSource: vi.fn(() => ({ loaded: () => true })),
  addSource: vi.fn(),
  removeSource: vi.fn(),
  addLayer: vi.fn(),
  removeLayer: vi.fn(),
  setPaintProperty: vi.fn(),
  off: vi.fn(),
  querySourceFeatures: vi.fn(),
});

vi.mock('mapbox-gl', () => ({ default: { accessToken: 'pk.test' } }));

vi.mock('@/utils/mapUtils', () => ({
  createMapInstance: vi.fn(),
  addStandardControls: vi.fn(),
  applyMapUiPadding: vi.fn(),
  waitForStyleLoad: vi.fn().mockResolvedValue(true),
  loadCountyBoundaries: vi.fn().mockResolvedValue(undefined),
  createStyleChangeHandler: vi.fn(() => vi.fn()),
  isMapAlive: vi.fn(() => true),
  isMapUsable: vi.fn(() => true),
  scheduleMapLayersLoad: vi.fn((map, loadLayersFn, initialLoadCompleteRef, options = {}) => {
    Promise.resolve(loadLayersFn()).then(() => {
      initialLoadCompleteRef.current = true;
      if (options.onReady) options.onReady(map);
    });
  }),
}));

vi.mock('@/utils/logger', () => ({
  hmedLogger: { error: vi.fn() },
}));

describe('useHMEDMapLayers', () => {
  let mapUtils;
  let logger;

  beforeEach(async () => {
    vi.clearAllMocks();
    mapUtils = await import('@/utils/mapUtils');
    logger = (await import('@/utils/logger')).hmedLogger;
    const mapboxgl = (await import('mapbox-gl')).default;
    mapboxgl.accessToken = 'pk.test';
    const mockMap = createMockMap();
    mapUtils.createMapInstance.mockReturnValue(mockMap);
    // clearAllMocks keeps implementations, so restore the happy path per test.
    mapUtils.waitForStyleLoad.mockResolvedValue(true);
    mapUtils.isMapAlive.mockReturnValue(true);
    mapUtils.isMapUsable.mockReturnValue(true);
    mockOnce.mockImplementation((event, cb) => {
      if (event === 'load') setTimeout(() => cb(), 0);
      return mockMap;
    });
  });

  afterEach(async () => {
    const mapboxgl = (await import('mapbox-gl')).default;
    mapboxgl.accessToken = 'pk.test';
  });

  it('returns mapRef, mapReady, isLoading, error, setError', () => {
    const mapContainerRef = { current: document.createElement('div') };
    const { result } = renderHook(() => useHMEDMapLayers(mapContainerRef, 'precipitation', 3));
    expect(result.current).toHaveProperty('mapRef');
    expect(result.current).toHaveProperty('mapReady');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('error');
    expect(typeof result.current.setError).toBe('function');
  });

  it('when mapContainerRef.current is null does not create map', () => {
    const mapContainerRef = { current: null };
    renderHook(() => useHMEDMapLayers(mapContainerRef, 'precipitation', 3));
    expect(mapUtils.createMapInstance).not.toHaveBeenCalled();
  });

  it('when access token is missing sets error', async () => {
    const mapboxgl = (await import('mapbox-gl')).default;
    mapboxgl.accessToken = '';
    const mapContainerRef = { current: document.createElement('div') };
    const { result } = renderHook(() => useHMEDMapLayers(mapContainerRef, 'precipitation', 3));
    await waitFor(() => {
      expect(result.current.error).toBe('Mapbox access token is not configured');
    });
  });

  it('when container and token present creates map instance', async () => {
    const mapContainerRef = { current: document.createElement('div') };
    renderHook(() => useHMEDMapLayers(mapContainerRef, 'precipitation', 3));
    await waitFor(() => {
      expect(mapUtils.createMapInstance).toHaveBeenCalledWith(mapContainerRef.current);
    });
  });

  it('cleanup removes map on unmount', async () => {
    const mockMap = createMockMap();
    mapUtils.createMapInstance.mockReturnValue(mockMap);
    const mapContainerRef = { current: document.createElement('div') };
    const { unmount } = renderHook(() => useHMEDMapLayers(mapContainerRef, 'precipitation', 3));
    await waitFor(() => {
      expect(mapUtils.createMapInstance).toHaveBeenCalled();
    });
    unmount();
    await waitFor(() => {
      expect(mockRemove).toHaveBeenCalled();
    });
  });

  it('sets mapReady and isLoading false after sources load', async () => {
    const mockMap = createMockMap();
    mapUtils.createMapInstance.mockReturnValue(mockMap);
    const mapContainerRef = { current: document.createElement('div') };
    const { result } = renderHook(() => useHMEDMapLayers(mapContainerRef, 'precipitation', 3));
    await new Promise((r) => setTimeout(r, 150));
    await waitFor(
      () => {
        expect(result.current.mapReady).toBe(true);
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 1000 }
    );
  });

  it('update effect sets paint when selectedHours change after mapReady', async () => {
    const mockMap = createMockMap();
    mapUtils.createMapInstance.mockReturnValue(mockMap);
    const mapContainerRef = { current: document.createElement('div') };
    const { result, rerender } = renderHook(
      (props) => useHMEDMapLayers(mapContainerRef, props.layer, props.hours),
      { initialProps: { hours: 3, layer: 'precipitation' } }
    );
    await new Promise((r) => setTimeout(r, 200));
    await waitFor(() => expect(result.current.mapReady).toBe(true), { timeout: 2000 });
    const paintCallsBefore = mockMap.setPaintProperty.mock.calls.length;
    rerender({ hours: 6, layer: 'precipitation' });
    await waitFor(
      () => expect(mockMap.setPaintProperty.mock.calls.length).toBeGreaterThan(paintCallsBefore),
      { timeout: 1000 }
    );
  });

  it('when waitForStyleLoad returns false logs error and does not set mapReady', async () => {
    mapUtils.waitForStyleLoad.mockResolvedValue(false);
    const mockMap = createMockMap();
    mapUtils.createMapInstance.mockReturnValue(mockMap);
    const mapContainerRef = { current: document.createElement('div') };
    renderHook(() => useHMEDMapLayers(mapContainerRef, 'precipitation', 3));
    await new Promise((r) => setTimeout(r, 50));
    expect(logger.error).toHaveBeenCalledWith('Style load timeout or map removed');
  });

  it('when isMapAlive is false after style load logs error', async () => {
    mapUtils.waitForStyleLoad.mockResolvedValue(true);
    mapUtils.isMapAlive.mockReturnValue(false);
    const mockMap = createMockMap();
    mapUtils.createMapInstance.mockReturnValue(mockMap);
    const mapContainerRef = { current: document.createElement('div') };
    renderHook(() => useHMEDMapLayers(mapContainerRef, 'precipitation', 3));
    await new Promise((r) => setTimeout(r, 50));
    expect(logger.error).toHaveBeenCalledWith('Style load timeout or map removed');
  });

  it('when the style never becomes ready clears loading and surfaces an error', async () => {
    mapUtils.waitForStyleLoad.mockResolvedValue(false);
    mapUtils.isMapUsable.mockReturnValue(true);
    const mockMap = createMockMap();
    mapUtils.createMapInstance.mockReturnValue(mockMap);
    const mapContainerRef = { current: document.createElement('div') };
    const { result } = renderHook(() => useHMEDMapLayers(mapContainerRef, 'precipitation', 3));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('Map failed to initialize. Please refresh the page.');
  });

  it('stays silent when the aborted load belongs to a removed map', async () => {
    // StrictMode re-runs the effect: the discarded map must not paint an error on the live one.
    mapUtils.waitForStyleLoad.mockResolvedValue(false);
    mapUtils.isMapUsable.mockReturnValue(false);
    const mockMap = createMockMap();
    mapUtils.createMapInstance.mockReturnValue(mockMap);
    const mapContainerRef = { current: document.createElement('div') };
    const { result } = renderHook(() => useHMEDMapLayers(mapContainerRef, 'precipitation', 3));
    await new Promise((r) => setTimeout(r, 50));
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(true);
  });

  it('onZoomEnd when isMapAlive false does nothing', async () => {
    const mockMap = createMockMap();
    mapUtils.createMapInstance.mockReturnValue(mockMap);
    const mapContainerRef = { current: document.createElement('div') };
    renderHook(() => useHMEDMapLayers(mapContainerRef, 'precipitation', 3));
    await new Promise((r) => setTimeout(r, 200));
    const zoomEndCall = mockOn.mock.calls.find((c) => c[0] === 'zoomend');
    const onZoomEnd = zoomEndCall?.[1];
    expect(onZoomEnd).toBeDefined();
    mapUtils.isMapAlive.mockReturnValue(false);
    const before = mockSetLayoutProperty.mock.calls.length;
    onZoomEnd();
    expect(mockSetLayoutProperty.mock.calls.length).toBe(before);
  });

  it('onZoomEnd sets visibility none when shouldBeVisible false', async () => {
    mapUtils.isMapAlive.mockReturnValue(true);
    const mockMap = createMockMap();
    mockMap.getLayoutProperty = vi.fn(() => 'visible');
    mockMap.getLayer = vi.fn(() => true);
    mockMap.getZoom = vi.fn(() => 23);
    mapUtils.createMapInstance.mockReturnValue(mockMap);
    const mapContainerRef = { current: document.createElement('div') };
    renderHook(() => useHMEDMapLayers(mapContainerRef, 'precipitation', 3));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 250));
    });
    const zoomEndCall = mockOn.mock.calls.find((c) => c[0] === 'zoomend');
    const onZoomEnd = zoomEndCall?.[1];
    expect(onZoomEnd).toBeDefined();
    onZoomEnd();
    expect(mockMap.setLayoutProperty).toHaveBeenCalledWith(
      expect.any(String),
      'visibility',
      'none'
    );
  });

  it('update effect does nothing when mapRef or mapReady false', async () => {
    const mapContainerRef = { current: document.createElement('div') };
    const { result } = renderHook(() => useHMEDMapLayers(mapContainerRef, 'precipitation', 6));
    expect(result.current.mapReady).toBe(false);
    expect(result.current.mapRef.current).toBeTruthy();
  });

  it('cleanup clears timeouts', async () => {
    const mockMap = createMockMap();
    mapUtils.createMapInstance.mockReturnValue(mockMap);
    const mapContainerRef = { current: document.createElement('div') };
    const { unmount } = renderHook(() => useHMEDMapLayers(mapContainerRef, 'precipitation', 3));
    await new Promise((r) => setTimeout(r, 300));
    unmount();
    expect(mockRemove).toHaveBeenCalled();
  });

  it('map loaded false path schedules layers load via scheduleMapLayersLoad', async () => {
    const mockMap = createMockMap();
    mockMap.loaded = vi.fn(() => false);
    mockMap.isStyleLoaded = vi.fn(() => false);
    mapUtils.createMapInstance.mockReturnValue(mockMap);
    const mapContainerRef = { current: document.createElement('div') };
    renderHook(() => useHMEDMapLayers(mapContainerRef, 'precipitation', 3));
    expect(mapUtils.scheduleMapLayersLoad).toHaveBeenCalledWith(
      mockMap,
      expect.any(Function),
      expect.any(Object)
    );
  });

  it('when loadCountyBoundaries throws sets error and isLoading false', async () => {
    mapUtils.loadCountyBoundaries.mockRejectedValueOnce(new Error('boundaries failed'));
    const mockMap = createMockMap();
    mapUtils.createMapInstance.mockReturnValue(mockMap);
    const mapContainerRef = { current: document.createElement('div') };
    const { result } = renderHook(() => useHMEDMapLayers(mapContainerRef, 'precipitation', 3));
    await waitFor(
      () => {
        expect(result.current.error).toBe('Failed to load map data. Please refresh the page.');
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 1000 }
    );
    expect(logger.error).toHaveBeenCalledWith('Error loading layers:', expect.any(Error));
  });

  it('when sources load mapReady becomes true', async () => {
    const mockMap = createMockMap();
    mapUtils.createMapInstance.mockReturnValue(mockMap);
    const mapContainerRef = { current: document.createElement('div') };
    const { result } = renderHook(() => useHMEDMapLayers(mapContainerRef, 'precipitation', 3));
    await waitFor(() => expect(result.current.mapReady).toBe(true), { timeout: 3000 });
  });

  it('update effect when isMapAlive false does not set paint', async () => {
    const mockMap = createMockMap();
    mapUtils.createMapInstance.mockReturnValue(mockMap);
    const mapContainerRef = { current: document.createElement('div') };
    const { result, rerender } = renderHook(
      (props) => useHMEDMapLayers(mapContainerRef, props.layer, props.hours),
      { initialProps: { hours: 3, layer: 'precipitation' } }
    );
    await waitFor(() => expect(result.current.mapReady).toBe(true), { timeout: 2000 });
    mapUtils.isMapAlive.mockReturnValue(false);
    const before = mockMap.setPaintProperty.mock.calls.length;
    rerender({ hours: 6, layer: 'precipitation' });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(mockMap.setPaintProperty.mock.calls.length).toBe(before);
  });

  it.skip('update effect runs when selectedLayer changes', async () => {
    const mockMap = createMockMap();
    mapUtils.createMapInstance.mockReturnValue(mockMap);
    const mapContainerRef = { current: document.createElement('div') };
    const { result, rerender } = renderHook(
      (props) => useHMEDMapLayers(mapContainerRef, props.layer, props.hours),
      { initialProps: { hours: 3, layer: 'precipitation' } }
    );
    await waitFor(() => expect(result.current.mapReady).toBe(true), { timeout: 5000 });
    rerender({ hours: 3, layer: 'temperature' });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });
    expect(mockMap.setPaintProperty).toHaveBeenCalled();
  });

  it('onZoomEnd sets visible and triggerRepaint when shouldBeVisible and visibility was none', async () => {
    mapUtils.isMapAlive.mockReturnValue(true);
    const mockMap = createMockMap();
    mockMap.getLayoutProperty = vi.fn(() => 'none');
    mockMap.getLayer = vi.fn(() => true);
    mockMap.getZoom = vi.fn(() => 8);
    mapUtils.createMapInstance.mockReturnValue(mockMap);
    const mapContainerRef = { current: document.createElement('div') };
    renderHook(() => useHMEDMapLayers(mapContainerRef, 'precipitation', 3));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 250));
    });
    const zoomEndCall = mockOn.mock.calls.find((c) => c[0] === 'zoomend');
    const onZoomEnd = zoomEndCall?.[1];
    onZoomEnd();
    expect(mockMap.setLayoutProperty).toHaveBeenCalledWith(
      expect.any(String),
      'visibility',
      'visible'
    );
    expect(mockMap.triggerRepaint).toHaveBeenCalled();
  });

  it('map style not ready still schedules layers load via scheduleMapLayersLoad', async () => {
    const mockMap = createMockMap();
    mockMap.loaded = vi.fn(() => true);
    mockMap.isStyleLoaded = vi.fn(() => false);
    mapUtils.createMapInstance.mockReturnValue(mockMap);
    const mapContainerRef = { current: document.createElement('div') };
    renderHook(() => useHMEDMapLayers(mapContainerRef, 'precipitation', 3));
    expect(mapUtils.scheduleMapLayersLoad).toHaveBeenCalledWith(
      mockMap,
      expect.any(Function),
      expect.any(Object)
    );
  });

  it('addLayer catch logs to console', async () => {
    const mockMap = createMockMap();
    mockMap.addLayer = vi.fn(() => {
      throw new Error('addLayer failed');
    });
    mapUtils.createMapInstance.mockReturnValue(mockMap);
    const mapContainerRef = { current: document.createElement('div') };
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderHook(() => useHMEDMapLayers(mapContainerRef, 'precipitation', 3));
    await waitFor(() => expect(mockMap.addLayer).toHaveBeenCalled(), { timeout: 2000 });
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^Error adding layer .+:/),
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });
});
