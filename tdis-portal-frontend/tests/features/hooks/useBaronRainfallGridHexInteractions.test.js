import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBaronRainfallGridHexInteractions } from '@/hooks/useBaronRainfallGridHexInteractions';

const mocks = vi.hoisted(() => ({
  popupInstances: [],
  levels: [6, 7, 8],
  buildHtml: vi.fn(() => '<p>rainfall</p>'),
  getOptimalAnchor: vi.fn(() => 'bottom'),
  getMapPopupOffset: vi.fn(() => [1, 2]),
  trackMapInteraction: vi.fn(),
}));

vi.mock('mapbox-gl', () => ({
  default: {
    Popup: vi.fn(function Popup(options) {
      const callbacks = {};
      const popup = {
        options,
        callbacks,
        setLngLat: vi.fn().mockReturnThis(),
        setHTML: vi.fn().mockReturnThis(),
        addTo: vi.fn().mockReturnThis(),
        on: vi.fn((event, callback) => {
          callbacks[event] = callback;
          return popup;
        }),
        remove: vi.fn(),
      };
      mocks.popupInstances.push(popup);
      return popup;
    }),
  },
}));

vi.mock('@/utils/osaUtils', () => ({
  getOptimalAnchor: mocks.getOptimalAnchor,
  getMapPopupOffset: mocks.getMapPopupOffset,
}));

vi.mock('@/config/mapConfig', () => ({ MAP_UI_TOP_PADDING: 70 }));
vi.mock('@/config/baronRainfallGridLayerConfig', () => ({
  BARON_RAINFALL_TILE_LAYER_ID: 'baron-rainfall',
  LAYER_CONFIG: {
    'baron-rainfall': {
      get levels() {
        return mocks.levels;
      },
    },
  },
}));
vi.mock('@/utils/baronRainfallGridUtils', () => ({
  buildBaronRainfallGridPopupHtml: mocks.buildHtml,
}));
vi.mock('@/utils/googleAnalytics.js', () => ({
  trackMapInteraction: mocks.trackMapInteraction,
}));

function createMap({ layers = ['baron-tile-hex-l6', 'baron-tile-hex-l7', 'baron-tile-hex-l8'] } = {}) {
  const canvas = { style: { cursor: '' } };
  return {
    canvas,
    getLayer: vi.fn((id) => layers.includes(id)),
    getCanvas: vi.fn(() => canvas),
    on: vi.fn(),
    off: vi.fn(),
  };
}

function handler(map, event, layerId = 'baron-tile-hex-l6') {
  return map.on.mock.calls.find(([name, id]) => name === event && id === layerId)?.[2];
}

function clickEvent(properties = {}, originalEvent = { stopPropagation: vi.fn() }) {
  return {
    lngLat: { lng: -97, lat: 32 },
    features: [{ properties }],
    originalEvent,
  };
}

describe('useBaronRainfallGridHexInteractions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.popupInstances.length = 0;
    mocks.levels = [6, 7, 8];
  });

  it('does not attach handlers without a ready map', () => {
    expect(() =>
      renderHook(() => useBaronRainfallGridHexInteractions({ current: null }, true, false))
    ).not.toThrow();

    const map = createMap();
    renderHook(() => useBaronRainfallGridHexInteractions({ current: map }, false, false));
    expect(map.getLayer).not.toHaveBeenCalled();
    expect(map.on).not.toHaveBeenCalled();
  });

  it('attaches only existing layers and drives hover cursor handlers', () => {
    const map = createMap({ layers: ['baron-tile-hex-l6'] });
    renderHook(() => useBaronRainfallGridHexInteractions({ current: map }, true, false));

    expect(map.on).toHaveBeenCalledTimes(3);
    handler(map, 'mouseenter')();
    expect(map.canvas.style.cursor).toBe('pointer');
    handler(map, 'mouseleave')();
    expect(map.canvas.style.cursor).toBe('');
  });

  it('uses the default levels when configuration does not provide them', () => {
    mocks.levels = null;
    const map = createMap();

    renderHook(() => useBaronRainfallGridHexInteractions({ current: map }, true, false));

    expect(map.on).toHaveBeenCalledTimes(9);
  });

  it('stops propagation but ignores clicks without a feature', () => {
    const map = createMap();
    renderHook(() => useBaronRainfallGridHexInteractions({ current: map }, true, false));
    const stopPropagation = vi.fn();

    handler(map, 'click')({ features: [], originalEvent: { stopPropagation } });

    expect(stopPropagation).toHaveBeenCalledOnce();
    expect(mocks.trackMapInteraction).not.toHaveBeenCalled();
    expect(mocks.popupInstances).toHaveLength(0);
  });

  it('creates a desktop popup with analytics, content, anchor, and offset', () => {
    const map = createMap();
    renderHook(() => useBaronRainfallGridHexInteractions({ current: map }, true, false));
    const event = clickEvent({ total_rain: 4 });

    handler(map, 'click')(event);

    expect(mocks.trackMapInteraction).toHaveBeenCalledWith({
      action: 'hex_click',
      tab: 'active-weather-events-beta',
      layer_name: 'baron_rainfall',
    });
    expect(mocks.buildHtml).toHaveBeenCalledWith({ total_rain: 4 }, 6);
    expect(mocks.getOptimalAnchor).toHaveBeenCalledWith(event.lngLat, map, {
      isMobile: false,
      popupWidth: 340,
      popupHeight: 420,
      topReserve: 78,
    });
    expect(mocks.getMapPopupOffset).toHaveBeenCalledWith('bottom', { topReserve: 78 });
    const popup = mocks.popupInstances[0];
    expect(popup.options).toEqual({
      closeButton: true,
      closeOnClick: true,
      maxWidth: '340px',
      anchor: 'bottom',
      offset: [1, 2],
      className: 'hmed-popup',
    });
    expect(popup.setLngLat).toHaveBeenCalledWith(event.lngLat);
    expect(popup.setHTML).toHaveBeenCalledWith('<p>rainfall</p>');
    expect(popup.addTo).toHaveBeenCalledWith(map);
  });

  it('uses mobile sizing and handles missing feature properties', () => {
    const map = createMap();
    renderHook(() => useBaronRainfallGridHexInteractions({ current: map }, true, true));

    handler(map, 'click')({
      lngLat: { lng: 1, lat: 2 },
      features: [{}],
    });

    expect(mocks.buildHtml).toHaveBeenCalledWith({}, 6);
    expect(mocks.getOptimalAnchor).toHaveBeenCalledWith(
      { lng: 1, lat: 2 },
      map,
      expect.objectContaining({ isMobile: true, popupWidth: undefined })
    );
    expect(mocks.popupInstances[0].options.maxWidth).toBe('min(340px, calc(100vw - 32px))');
  });

  it('falls back to level 6 for a malformed configured level', () => {
    mocks.levels = [undefined];
    const map = createMap({ layers: ['baron-tile-hex-lundefined'] });
    renderHook(() => useBaronRainfallGridHexInteractions({ current: map }, true, false));

    handler(map, 'click', 'baron-tile-hex-lundefined')(clickEvent());

    expect(mocks.buildHtml).toHaveBeenCalledWith({}, 6);
  });

  it('removes the active popup and respects stale and active close callbacks', () => {
    const map = createMap();
    renderHook(() => useBaronRainfallGridHexInteractions({ current: map }, true, false));
    const onClick = handler(map, 'click');

    onClick(clickEvent());
    const first = mocks.popupInstances[0];
    onClick(clickEvent());
    const second = mocks.popupInstances[1];
    expect(first.remove).toHaveBeenCalledOnce();

    first.callbacks.close();
    onClick(clickEvent());
    expect(second.remove).toHaveBeenCalledOnce();

    const third = mocks.popupInstances[2];
    third.callbacks.close();
    onClick(clickEvent());
    expect(third.remove).not.toHaveBeenCalled();
  });

  it('unregisters handlers, tolerates off errors, and removes an active popup', () => {
    const map = createMap({ layers: ['baron-tile-hex-l6'] });
    map.off.mockImplementationOnce(() => {
      throw new Error('style removed');
    });
    const { unmount } = renderHook(() =>
      useBaronRainfallGridHexInteractions({ current: map }, true, false)
    );
    handler(map, 'click')(clickEvent());
    const popup = mocks.popupInstances[0];

    expect(() => unmount()).not.toThrow();
    expect(map.off).toHaveBeenCalledWith('click', 'baron-tile-hex-l6', expect.any(Function));
    expect(popup.remove).toHaveBeenCalledOnce();
  });

  it('cleans up and reattaches when the layer generation changes', () => {
    const map = createMap({ layers: ['baron-tile-hex-l6'] });
    const mapRef = { current: map };
    const { rerender } = renderHook(
      ({ generation }) =>
        useBaronRainfallGridHexInteractions(mapRef, true, false, generation),
      { initialProps: { generation: 0 } }
    );

    rerender({ generation: 1 });

    expect(map.off).toHaveBeenCalledTimes(3);
    expect(map.on).toHaveBeenCalledTimes(6);
  });
});
