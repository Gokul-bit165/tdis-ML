/**
 * @fileoverview Unit tests for utils/mapUtils (pure parts)
 * Feature: utils
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DEFAULT_MAP_OPTIONS,
  COUNTY_BOUNDARY_STYLE,
  waitForStyleLoad,
  removeLayersAndSources,
  createStyleChangeHandler,
  scheduleMapLayersLoad,
  fitMapToTexas,
  loadTexasOutsideMask,
  loadCountyBoundaries,
  isMapAlive,
  isMapUsable,
} from '@/utils/mapUtils';
import { TEXAS_MIN_ZOOM } from '@/config/mapConfig';

/** Map double with a loaded style and no pre-existing layers/sources. */
const createLiveMap = (overrides = {}) => ({
  getStyle: () => ({ layers: [] }),
  getLayer: vi.fn(() => null),
  getSource: vi.fn(() => null),
  removeLayer: vi.fn(),
  removeSource: vi.fn(),
  addSource: vi.fn(),
  addLayer: vi.fn(),
  ...overrides,
});

const stubFetchJson = (data) =>
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => data,
    })
  );

describe('utils/mapUtils', () => {
  describe('DEFAULT_MAP_OPTIONS', () => {
    it('has Texas center', () => {
      expect(DEFAULT_MAP_OPTIONS.center).toEqual([-99.1332, 31.9686]);
    });

    it('has zoom and style', () => {
      expect(DEFAULT_MAP_OPTIONS.zoom).toBe(4.25);
      expect(DEFAULT_MAP_OPTIONS.style).toBeDefined();
    });
  });

  describe('fitMapToTexas', () => {
    it('no-ops when map is missing', () => {
      expect(() => fitMapToTexas(null)).not.toThrow();
    });

    it('uses cameraForBounds when available and applies soft maxBounds', () => {
      const map = {
        resize: vi.fn(),
        setMaxBounds: vi.fn(),
        cameraForBounds: vi.fn(() => ({
          center: [-99.1, 31.9],
          zoom: 5,
        })),
        jumpTo: vi.fn(),
        fitBounds: vi.fn(),
        getZoom: vi.fn(() => 4.9),
      };
      fitMapToTexas(map);
      expect(map.setMaxBounds).toHaveBeenCalledWith(null);
      expect(map.cameraForBounds).toHaveBeenCalled();
      expect(map.jumpTo).toHaveBeenCalledWith(
        expect.objectContaining({
          center: [-99.1, 31.9],
          zoom: 4.9,
          bearing: 0,
          pitch: 0,
        })
      );
      expect(map.setMaxBounds).toHaveBeenLastCalledWith(expect.any(Array));
    });

    it('keeps the fitted zoom below the z6 hex level switch', () => {
      // Above z6 a different H3 level renders, which would change the default layer set.
      const map = {
        resize: vi.fn(),
        setMaxBounds: vi.fn(),
        cameraForBounds: vi.fn(() => ({ center: [-99.1, 31.9], zoom: 5.24 })),
        jumpTo: vi.fn(),
        fitBounds: vi.fn(),
        getZoom: vi.fn(() => 5.14),
      };
      fitMapToTexas(map);
      expect(map.jumpTo.mock.calls[0][0].zoom).toBeLessThan(6);
    });

    it('falls back to fitBounds and clamps zoom to TEXAS_MIN_ZOOM', () => {
      const map = {
        resize: vi.fn(),
        setMaxBounds: vi.fn(),
        fitBounds: vi.fn(),
        getZoom: vi.fn(() => 2),
        setZoom: vi.fn(),
      };
      fitMapToTexas(map);
      expect(map.fitBounds).toHaveBeenCalled();
      expect(map.setZoom).toHaveBeenCalledWith(TEXAS_MIN_ZOOM);
    });

    it('swallows fit errors', () => {
      const map = {
        resize: vi.fn(() => {
          throw new Error('boom');
        }),
      };
      expect(() => fitMapToTexas(map)).not.toThrow();
    });
  });

  describe('loadTexasOutsideMask', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('no-ops when map is not alive', async () => {
      await expect(loadTexasOutsideMask(null)).resolves.toBeUndefined();
    });

    it('adds mask source and fill layer from geojson', async () => {
      const map = {
        getStyle: () => ({ layers: [] }),
        getLayer: vi.fn(() => null),
        getSource: vi.fn(() => null),
        removeLayer: vi.fn(),
        removeSource: vi.fn(),
        addSource: vi.fn(),
        addLayer: vi.fn(),
      };
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ type: 'FeatureCollection', features: [] }),
        })
      );
      expect(isMapAlive(map)).toBe(true);
      await loadTexasOutsideMask(map);
      expect(map.addSource).toHaveBeenCalledWith(
        'texas-outside-mask',
        expect.objectContaining({ type: 'geojson' })
      );
      expect(map.addLayer).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'texas-outside-mask-fill', type: 'fill' }),
        undefined
      );
    });

    it('inserts the mask below the first label layer so place names stay readable', async () => {
      const map = createLiveMap({
        getStyle: () => ({
          layers: [
            { id: 'water', type: 'fill' },
            { id: 'settlement-label', type: 'symbol' },
          ],
        }),
      });
      stubFetchJson({ type: 'FeatureCollection', features: [] });

      await loadTexasOutsideMask(map);

      expect(map.addLayer).toHaveBeenCalledWith(expect.anything(), 'settlement-label');
    });

    it('replaces an existing mask layer and source before re-adding', async () => {
      const map = createLiveMap({
        getLayer: vi.fn(() => true),
        getSource: vi.fn(() => true),
      });
      stubFetchJson({ type: 'FeatureCollection', features: [] });

      await loadTexasOutsideMask(map);

      expect(map.removeLayer).toHaveBeenCalledWith('texas-outside-mask-fill');
      expect(map.removeSource).toHaveBeenCalledWith('texas-outside-mask');
      expect(map.addSource).toHaveBeenCalled();
    });

    it('swallows a failed mask request instead of breaking the map', async () => {
      const map = createLiveMap();
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));

      await expect(loadTexasOutsideMask(map)).resolves.toBeUndefined();
      expect(map.addLayer).not.toHaveBeenCalled();
    });
  });

  describe('loadCountyBoundaries', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('no-ops when the map is not alive', async () => {
      await expect(loadCountyBoundaries(null)).resolves.toBeUndefined();
    });

    it('adds the county line layer on top of the Texas mask', async () => {
      const map = createLiveMap();
      stubFetchJson({ type: 'FeatureCollection', features: [] });

      await loadCountyBoundaries(map);

      expect(map.addSource).toHaveBeenCalledWith(
        'outline-layer',
        expect.objectContaining({ type: 'geojson' })
      );
      expect(map.addLayer).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'outline-layer-line',
          type: 'line',
          source: 'outline-layer',
          paint: COUNTY_BOUNDARY_STYLE,
        })
      );
    });

    it('honors custom source and layer ids and removes prior ones', async () => {
      const sourceId = 'counties-src';
      const layerId = 'counties-line';
      const map = createLiveMap({
        getLayer: vi.fn(() => true),
        getSource: vi.fn(() => true),
      });
      stubFetchJson({ type: 'FeatureCollection', features: [] });

      await loadCountyBoundaries(map, sourceId, layerId);

      expect(map.removeLayer).toHaveBeenCalledWith(layerId);
      expect(map.removeSource).toHaveBeenCalledWith(sourceId);
      expect(map.addSource).toHaveBeenCalledWith(sourceId, expect.anything());
    });

    it('rethrows when the county geojson cannot be loaded', async () => {
      const map = createLiveMap();
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

      await expect(loadCountyBoundaries(map)).rejects.toThrow('network down');
    });
  });

  describe('COUNTY_BOUNDARY_STYLE', () => {
    it('has line-color, line-width, line-opacity', () => {
      expect(COUNTY_BOUNDARY_STYLE['line-color']).toBe('#334755');
      expect(COUNTY_BOUNDARY_STYLE['line-width']).toBe(0.5);
      expect(COUNTY_BOUNDARY_STYLE['line-opacity']).toBe(0.6);
    });
  });

  describe('waitForStyleLoad', () => {
    it('resolves true when map style is loaded', async () => {
      const map = {
        getStyle: () => ({ layers: [] }),
        isStyleLoaded: vi.fn().mockReturnValue(true),
      };
      const result = await waitForStyleLoad(map);
      expect(result).toBe(true);
    });

    it('polls until style is loaded', async () => {
      const map = {
        getStyle: () => ({ layers: [] }),
        isStyleLoaded: vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true),
      };
      const result = await waitForStyleLoad(map, 10, 10);
      expect(result).toBe(true);
    });

    it('returns false on timeout', async () => {
      const map = { isStyleLoaded: vi.fn().mockReturnValue(false) };
      const result = await waitForStyleLoad(map, 2, 5);
      expect(result).toBe(false);
    });

    it('keeps polling while getStyle() is still empty', async () => {
      // getStyle() stays undefined until the first style.load; that is not a removed map.
      const map = {
        getStyle: vi.fn(() => undefined),
        isStyleLoaded: vi.fn().mockReturnValueOnce(false).mockReturnValue(true),
      };
      const result = await waitForStyleLoad(map, 10, 5);
      expect(result).toBe(true);
      expect(map.isStyleLoaded).toHaveBeenCalledTimes(2);
    });

    it('stops immediately once the map has been removed', async () => {
      const map = {
        _removed: true,
        getStyle: () => ({ layers: [] }),
        isStyleLoaded: vi.fn().mockReturnValue(true),
      };
      const result = await waitForStyleLoad(map, 5, 5);
      expect(result).toBe(false);
      expect(map.isStyleLoaded).not.toHaveBeenCalled();
    });
  });

  describe('isMapUsable', () => {
    it('is true before the style is ready', () => {
      expect(isMapUsable({ getStyle: () => undefined })).toBe(true);
    });

    it('is false for a missing or removed map', () => {
      expect(isMapUsable(null)).toBe(false);
      expect(isMapUsable({ _removed: true, getStyle: () => ({ layers: [] }) })).toBe(false);
    });

    it('is true when getStyle is missing (style not installed yet)', () => {
      expect(isMapUsable({})).toBe(true);
    });

    it('is false when getStyle throws', () => {
      expect(
        isMapUsable({
          getStyle: () => {
            throw new Error('removed');
          },
        })
      ).toBe(false);
    });
  });

  describe('removeLayersAndSources', () => {
    it('removes layers and sources that exist', () => {
      const map = {
        getStyle: () => ({ layers: [] }),
        getLayer: vi.fn().mockReturnValue(true),
        removeLayer: vi.fn(),
        getSource: vi.fn().mockReturnValue(true),
        removeSource: vi.fn(),
      };
      removeLayersAndSources(map, ['layer-1'], ['source-1']);
      expect(map.removeLayer).toHaveBeenCalledWith('layer-1');
      expect(map.removeSource).toHaveBeenCalledWith('source-1');
    });

    it('does not call remove when layer/source does not exist', () => {
      const map = {
        getLayer: vi.fn().mockReturnValue(false),
        removeLayer: vi.fn(),
        getSource: vi.fn().mockReturnValue(false),
        removeSource: vi.fn(),
      };
      removeLayersAndSources(map, ['layer-1'], ['source-1']);
      expect(map.removeLayer).not.toHaveBeenCalled();
      expect(map.removeSource).not.toHaveBeenCalled();
    });
  });

  describe('createStyleChangeHandler', () => {
    it('returns a function', () => {
      const map = {
        getStyle: () => ({ layers: [] }),
        isStyleLoaded: vi.fn().mockReturnValue(true),
      };
      const loadLayersFn = vi.fn().mockResolvedValue(undefined);
      const handler = createStyleChangeHandler(map, loadLayersFn);
      expect(typeof handler).toBe('function');
    });

    it('skips when initialLoadCompleteRef is false', async () => {
      const map = {
        getStyle: () => ({ layers: [] }),
        isStyleLoaded: vi.fn().mockReturnValue(true),
      };
      const loadLayersFn = vi.fn();
      const initialLoadCompleteRef = { current: false };
      const handler = createStyleChangeHandler(map, loadLayersFn, {
        initialLoadCompleteRef,
      });
      await handler();
      expect(loadLayersFn).not.toHaveBeenCalled();
    });

    it('calls loadLayersFn when style loads', async () => {
      const map = {
        getStyle: () => ({ layers: [] }),
        isStyleLoaded: vi.fn().mockReturnValue(true),
      };
      const loadLayersFn = vi.fn().mockResolvedValue(undefined);
      const handler = createStyleChangeHandler(map, loadLayersFn);
      await handler();
      expect(loadLayersFn).toHaveBeenCalled();
    });

    it('skips when the map was removed before the handler ran', async () => {
      const loadLayersFn = vi.fn();
      const handler = createStyleChangeHandler(null, loadLayersFn);
      await handler();
      expect(loadLayersFn).not.toHaveBeenCalled();
    });

    it('skips the reload when the map is removed mid-flight', async () => {
      // Alive for the entry guard, gone by the time the style poll runs.
      const getStyle = vi.fn().mockReturnValueOnce({ layers: [] }).mockReturnValue(undefined);
      const map = { getStyle, isStyleLoaded: vi.fn().mockReturnValue(true) };
      const loadLayersFn = vi.fn();
      const handler = createStyleChangeHandler(map, loadLayersFn, {
        componentName: 'TestMap',
      });

      await handler();

      expect(loadLayersFn).not.toHaveBeenCalled();
    });

    it('swallows errors thrown while reloading layers', async () => {
      const map = {
        getStyle: () => ({ layers: [] }),
        isStyleLoaded: vi.fn().mockReturnValue(true),
      };
      const loadLayersFn = vi.fn().mockRejectedValue(new Error('layer boom'));
      const handler = createStyleChangeHandler(map, loadLayersFn);

      await expect(handler()).resolves.toBeUndefined();
      expect(loadLayersFn).toHaveBeenCalled();
    });
  });

  describe('scheduleMapLayersLoad', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('loads immediately when map and style are already ready', async () => {
      const loadLayersFn = vi.fn().mockResolvedValue(undefined);
      const initialLoadCompleteRef = { current: false };
      const onReady = vi.fn();
      const map = {
        loaded: vi.fn().mockReturnValue(true),
        isStyleLoaded: vi.fn().mockReturnValue(true),
        once: vi.fn(),
      };

      scheduleMapLayersLoad(map, loadLayersFn, initialLoadCompleteRef, { onReady });

      expect(loadLayersFn).toHaveBeenCalledTimes(1);
      expect(map.once).not.toHaveBeenCalled();
      await Promise.resolve();
      expect(initialLoadCompleteRef.current).toBe(true);
      expect(onReady).toHaveBeenCalledWith(map);
    });

    it('waits for load then runs when style is ready after delay', async () => {
      const loadLayersFn = vi.fn().mockResolvedValue(undefined);
      const initialLoadCompleteRef = { current: false };
      const handlers = {};
      const map = {
        loaded: vi.fn().mockReturnValue(false),
        isStyleLoaded: vi.fn().mockReturnValue(true),
        once: vi.fn((event, cb) => {
          handlers[event] = cb;
        }),
      };

      scheduleMapLayersLoad(map, loadLayersFn, initialLoadCompleteRef);

      expect(loadLayersFn).not.toHaveBeenCalled();
      expect(map.once).toHaveBeenCalledWith('load', expect.any(Function));

      handlers.load();
      expect(loadLayersFn).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(100);
      expect(loadLayersFn).toHaveBeenCalledTimes(1);
      await Promise.resolve();
      expect(initialLoadCompleteRef.current).toBe(true);
    });

    it('registers style.load when style is not ready after map load', async () => {
      const loadLayersFn = vi.fn().mockResolvedValue(undefined);
      const initialLoadCompleteRef = { current: false };
      const handlers = {};
      const map = {
        loaded: vi.fn().mockReturnValue(false),
        isStyleLoaded: vi.fn().mockReturnValue(false),
        once: vi.fn((event, cb) => {
          handlers[event] = cb;
        }),
      };

      scheduleMapLayersLoad(map, loadLayersFn, initialLoadCompleteRef, {
        styleLoadEvent: 'style.load',
        delayMs: 50,
      });

      handlers.load();
      await vi.advanceTimersByTimeAsync(50);

      expect(loadLayersFn).not.toHaveBeenCalled();
      expect(map.once).toHaveBeenCalledWith('style.load', expect.any(Function));

      handlers['style.load']();
      expect(loadLayersFn).toHaveBeenCalledTimes(1);
      await Promise.resolve();
      expect(initialLoadCompleteRef.current).toBe(true);
    });

    it('still loads when load and style.load already fired before scheduling', async () => {
      const loadLayersFn = vi.fn().mockResolvedValue(undefined);
      const initialLoadCompleteRef = { current: false };
      // A resize can clear isStyleLoaded() after style.load, and neither event fires again.
      const map = {
        loaded: vi.fn().mockReturnValue(true),
        isStyleLoaded: vi.fn().mockReturnValue(false),
        once: vi.fn(),
      };

      scheduleMapLayersLoad(map, loadLayersFn, initialLoadCompleteRef);

      expect(loadLayersFn).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1100);

      expect(loadLayersFn).toHaveBeenCalledTimes(1);
      await Promise.resolve();
      expect(initialLoadCompleteRef.current).toBe(true);
    });

    it('does not run the load twice when a style event arrives after the fallback', async () => {
      const loadLayersFn = vi.fn().mockResolvedValue(undefined);
      const initialLoadCompleteRef = { current: false };
      const handlers = {};
      const map = {
        loaded: vi.fn().mockReturnValue(false),
        isStyleLoaded: vi.fn().mockReturnValue(false),
        once: vi.fn((event, cb) => {
          handlers[event] = cb;
        }),
      };

      scheduleMapLayersLoad(map, loadLayersFn, initialLoadCompleteRef);

      await vi.advanceTimersByTimeAsync(1100);
      expect(loadLayersFn).toHaveBeenCalledTimes(1);

      handlers.load();
      await vi.advanceTimersByTimeAsync(100);
      handlers['style.load']?.();

      expect(loadLayersFn).toHaveBeenCalledTimes(1);
    });
  });
});
