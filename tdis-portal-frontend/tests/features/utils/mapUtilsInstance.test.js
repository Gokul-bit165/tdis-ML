/**
 * @fileoverview Unit tests for utils/mapUtils map-instance helpers
 * (createMapInstance, addStandardControls, applyMapUiPadding, isMapAlive).
 * Feature: utils
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  state: { loaded: true },
  constructed: [],
}));

vi.mock('mapbox-gl', () => {
  const noop = () => {};
  function Map(options) {
    const instance = {
      options,
      handlers: {},
      addControl: vi.fn(),
      resize: vi.fn(),
      setMaxBounds: vi.fn(),
      cameraForBounds: vi.fn(() => ({ center: [-99, 31], zoom: 5 })),
      jumpTo: vi.fn(),
      fitBounds: vi.fn(),
      getZoom: vi.fn(() => 4.5),
      setZoom: vi.fn(),
      loaded: () => mocks.state.loaded,
      isStyleLoaded: () => true,
      getStyle: () => ({ layers: [] }),
      once: vi.fn(function (event, cb) {
        this.handlers[event] = cb;
      }),
      on: noop,
      off: noop,
      remove: noop,
    };
    mocks.constructed.push(instance);
    return instance;
  }

  return {
    default: {
      Map,
      accessToken: 'test-token',
      NavigationControl: function NavigationControl() {},
      FullscreenControl: function FullscreenControl() {},
      ScaleControl: function ScaleControl() {},
    },
  };
});

vi.mock('mapbox-gl-style-switcher', () => ({
  MapboxStyleSwitcherControl: function MapboxStyleSwitcherControl() {},
}));

const { createMapInstance, addStandardControls, applyMapUiPadding, isMapAlive } = await import(
  '@/utils/mapUtils'
);

describe('utils/mapUtils map instance helpers', () => {
  beforeEach(() => {
    mocks.state.loaded = true;
    mocks.constructed.length = 0;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createMapInstance', () => {
    it('clears a non-empty container before mounting the map', () => {
      const container = document.createElement('div');
      container.appendChild(document.createElement('span'));

      createMapInstance(container);

      expect(container.innerHTML).toBe('');
    });

    it('merges overrides over the Texas defaults and keeps the container', () => {
      const container = document.createElement('div');

      const map = createMapInstance(container, { zoom: 9, skipTexasFit: true });

      expect(map.options.zoom).toBe(9);
      expect(map.options.container).toBe(container);
      expect(map.options.center).toEqual([-99.1332, 31.9686]);
      // skipTexasFit must not leak into Mapbox options.
      expect(map.options.skipTexasFit).toBeUndefined();
    });

    it('skips the Texas fit when asked', () => {
      const map = createMapInstance(document.createElement('div'), { skipTexasFit: true });

      expect(map.cameraForBounds).not.toHaveBeenCalled();
      expect(map.once).not.toHaveBeenCalled();
    });

    it('fits to Texas immediately when the map is already loaded', () => {
      const map = createMapInstance(document.createElement('div'));

      expect(map.cameraForBounds).toHaveBeenCalled();
      expect(map.jumpTo).toHaveBeenCalled();
    });

    it('defers the Texas fit to the load event when not yet loaded', () => {
      mocks.state.loaded = false;

      const map = createMapInstance(document.createElement('div'));

      expect(map.cameraForBounds).not.toHaveBeenCalled();
      expect(map.once).toHaveBeenCalledWith('load', expect.any(Function));

      map.handlers.load();
      expect(map.jumpTo).toHaveBeenCalled();
    });
  });

  describe('addStandardControls', () => {
    it('adds the style switcher, navigation, fullscreen, and scale controls', () => {
      const map = { addControl: vi.fn() };

      addStandardControls(map);

      expect(map.addControl).toHaveBeenCalledTimes(4);
      expect(map.addControl).toHaveBeenCalledWith(expect.anything(), 'top-right');
      expect(map.addControl).toHaveBeenLastCalledWith(expect.anything(), 'bottom-left');
    });
  });

  describe('applyMapUiPadding', () => {
    it('refits Texas for a live map', () => {
      const map = {
        getStyle: () => ({ layers: [] }),
        resize: vi.fn(),
        setMaxBounds: vi.fn(),
        cameraForBounds: vi.fn(() => ({ center: [-99, 31], zoom: 5 })),
        jumpTo: vi.fn(),
      };

      applyMapUiPadding(map);

      expect(map.jumpTo).toHaveBeenCalled();
    });

    it('does nothing when skipFit is set', () => {
      const map = {
        getStyle: () => ({ layers: [] }),
        resize: vi.fn(),
        setMaxBounds: vi.fn(),
        cameraForBounds: vi.fn(),
        jumpTo: vi.fn(),
      };

      applyMapUiPadding(map, { skipFit: true });

      expect(map.resize).not.toHaveBeenCalled();
    });

    it('does nothing for a removed map', () => {
      expect(() => applyMapUiPadding(null)).not.toThrow();
    });
  });

  describe('isMapAlive', () => {
    it('is false when getStyle throws (map already removed)', () => {
      const map = {
        getStyle: () => {
          throw new Error('map removed');
        },
      };

      expect(isMapAlive(map)).toBe(false);
    });

    it('is false when the style has no layers yet', () => {
      expect(isMapAlive({ getStyle: () => undefined })).toBe(false);
    });
  });
});
