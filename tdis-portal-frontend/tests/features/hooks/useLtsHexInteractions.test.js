import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLtsHexInteractions } from '@/hooks/useLtsHexInteractions';

const mocks = vi.hoisted(() => ({
  popupInstances: [],
  layer: {
    levels: [6, 7],
    hasTimeWindow: false,
    id: 'lts-flash-flood',
    name: 'Flood',
    color: '#123456',
  },
  buildHtml: vi.fn(() => '<p>LTS details</p>'),
  getLayerPropertyName: vi.fn((_config, hours) => `value_${hours}`),
  getOptimalAnchor: vi.fn(() => 'top'),
  getMapPopupOffset: vi.fn(() => [3, 4]),
  trackMapInteraction: vi.fn(),
}));

vi.mock('mapbox-gl', () => ({
  default: {
    Popup: vi.fn(function Popup(options) {
      const callbacks = {};
      const popup = {
        options,
        callbacks,
        element: undefined,
        setLngLat: vi.fn().mockReturnThis(),
        setHTML: vi.fn().mockReturnThis(),
        addTo: vi.fn().mockReturnThis(),
        getElement: vi.fn(() => popup.element),
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
vi.mock('@/config/mapConfig', () => ({
  MAP_UI_TOP_PADDING: 70,
  HMED_CONFIG: { hourOptions: [1, 3, 6, 12, 24, 48] },
}));
vi.mock('@/config/ltsFlashFloodLayerConfig', () => ({
  LTS_LAYER_ID: 'lts',
  LAYER_CONFIG: {
    get lts() {
      return mocks.layer;
    },
  },
  getLayerPropertyName: mocks.getLayerPropertyName,
}));
vi.mock('@/utils/ltsHexPopupUtils', () => ({
  buildLtsHexPopupHtml: mocks.buildHtml,
}));
vi.mock('@/utils/googleAnalytics.js', () => ({
  trackMapInteraction: mocks.trackMapInteraction,
}));

function createMap({ layers = ['hex-l6', 'hex-l7'], style = {} } = {}) {
  const canvas = { style: { cursor: '' } };
  return {
    canvas,
    getLayer: vi.fn((id) => layers.includes(id)),
    getCanvas: vi.fn(() => canvas),
    getStyle: vi.fn(() => style),
    on: vi.fn(),
    off: vi.fn(),
  };
}

function handler(map, event, layerId = 'hex-l6') {
  return map.on.mock.calls.find(([name, id]) => name === event && id === layerId)?.[2];
}

function clickEvent(properties = {}, originalEvent) {
  return {
    lngLat: { lng: -98, lat: 31 },
    features: [{ properties }],
    ...(originalEvent === undefined ? {} : { originalEvent }),
  };
}

describe('useLtsHexInteractions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.popupInstances.length = 0;
    Object.assign(mocks.layer, {
      levels: [6, 7],
      hasTimeWindow: false,
      id: 'lts-flash-flood',
      name: 'Flood',
      color: '#123456',
    });
    document.body.innerHTML = '';
  });

  it('does not attach handlers without a ready map', () => {
    expect(() => renderHook(() => useLtsHexInteractions({ current: null }, true, 6, false)))
      .not.toThrow();
    const map = createMap();
    renderHook(() => useLtsHexInteractions({ current: map }, false, 6, false));
    expect(map.getLayer).not.toHaveBeenCalled();
    expect(map.on).not.toHaveBeenCalled();
  });

  it('attaches existing layers only and drives hover handlers', () => {
    const map = createMap({ layers: ['hex-l6'] });
    renderHook(() => useLtsHexInteractions({ current: map }, true, 6, false));

    expect(map.on).toHaveBeenCalledTimes(3);
    handler(map, 'mouseenter')();
    expect(map.canvas.style.cursor).toBe('pointer');
    handler(map, 'mouseleave')();
    expect(map.canvas.style.cursor).toBe('');
  });

  it('uses every default level when configuration does not provide levels', () => {
    mocks.layer.levels = null;
    const map = createMap({ layers: ['hex-l6', 'hex-l7', 'hex-l8', 'hex-l9', 'hex-l10'] });

    renderHook(() => useLtsHexInteractions({ current: map }, true, 6, false));

    expect(map.on).toHaveBeenCalledTimes(15);
  });

  it('creates an LTS popup, stops propagation, and tracks the interaction', () => {
    const map = createMap();
    renderHook(() => useLtsHexInteractions({ current: map }, true, 6, false));
    const stopPropagation = vi.fn();
    const event = clickEvent(
      { lts_level: 3, lts_label: 'Major' },
      { cancelBubble: false, stopPropagation }
    );

    handler(map, 'click')(event);

    expect(event.originalEvent.cancelBubble).toBe(true);
    expect(stopPropagation).toHaveBeenCalledOnce();
    expect(mocks.trackMapInteraction).toHaveBeenCalledWith({
      action: 'hex_click',
      tab: 'lts-flash-flood',
      layer_name: 'lts-flash-flood',
    });
    expect(mocks.buildHtml).toHaveBeenCalledWith(event.features[0].properties, 6, {
      layerTitle: 'Impact Forecast',
    });
    expect(mocks.getOptimalAnchor).toHaveBeenCalledWith(event.lngLat, map, {
      isMobile: false,
      popupHeight: 520,
      popupWidth: 400,
      topReserve: 78,
    });
    expect(mocks.getMapPopupOffset).toHaveBeenCalledWith('top', { topReserve: 78 });
    const popup = mocks.popupInstances[0];
    expect(popup.options).toEqual({
      closeButton: true,
      closeOnClick: true,
      className: 'hmed-popup',
      anchor: 'top',
      offset: [3, 4],
      maxWidth: '420px',
    });
    expect(popup.setHTML).toHaveBeenCalledWith('<p>LTS details</p>');
    expect(popup.addTo).toHaveBeenCalledWith(map);
  });

  it('handles absent properties and original events without a stop function', () => {
    const map = createMap();
    renderHook(() => useLtsHexInteractions({ current: map }, true, 6, true));
    const originalEvent = { cancelBubble: false };

    expect(() =>
      handler(map, 'click')({
        lngLat: { lng: 0, lat: 0 },
        features: [{}],
        originalEvent,
      })
    ).not.toThrow();
    expect(originalEvent.cancelBubble).toBe(true);
    expect(mocks.buildHtml).toHaveBeenCalledWith({}, 6, expect.any(Object));
    expect(mocks.getOptimalAnchor).toHaveBeenCalledWith(
      { lng: 0, lat: 0 },
      map,
      expect.objectContaining({ isMobile: true })
    );
  });

  it('builds non-LTS hour markup for missing and every intensity range', () => {
    Object.assign(mocks.layer, {
      hasTimeWindow: true,
      id: 'precipitation',
      name: 'Precipitation',
    });
    const map = createMap();
    const mapRef = { current: map };
    const { rerender } = renderHook(
      ({ hours }) => useLtsHexInteractions(mapRef, true, hours, false),
      { initialProps: { hours: 3 } }
    );
    rerender({ hours: 12 });
    const props = {
      value_1: null,
      value_3: 2,
      value_6: 1.2,
      value_12: 0.7,
      value_24: 0.3,
      value_48: 0.1,
    };

    handler(map, 'click')(clickEvent(props));

    expect(mocks.trackMapInteraction).toHaveBeenCalledWith({
      action: 'hex_click',
      tab: 'hmed',
      layer_name: 'precipitation',
    });
    const html = mocks.popupInstances[0].setHTML.mock.calls[0][0];
    expect(html).toContain('Precipitation HSI Details');
    expect(html).toContain('N/A');
    expect(html).toContain('Extreme');
    expect(html).toContain('Major');
    expect(html).toContain('Significant');
    expect(html).toContain('Elevated');
    expect(html).toContain('Minimal');
    expect(html).toContain('12h:');
    expect(html).toContain('Current');
    expect(mocks.getLayerPropertyName).toHaveBeenCalledTimes(6);
  });

  it('styles popup, tip, and content when the popup opens', () => {
    const map = createMap();
    renderHook(() => useLtsHexInteractions({ current: map }, true, 6, false));
    handler(map, 'click')(clickEvent());
    const popup = mocks.popupInstances[0];
    const element = document.createElement('div');
    const tip = document.createElement('div');
    tip.className = 'mapboxgl-popup-tip';
    const content = document.createElement('div');
    content.className = 'mapboxgl-popup-content';
    element.append(tip, content);
    popup.element = element;

    popup.callbacks.open();

    expect(element.style.zIndex).toBe('9999');
    expect(tip.style.zIndex).toBe('9999');
    expect(content.style.zIndex).toBe('9999');
    expect(content.style.overflowY).toBe('auto');
  });

  it('uses the document popup fallback and tolerates missing children', () => {
    const map = createMap();
    renderHook(() => useLtsHexInteractions({ current: map }, true, 6, false));
    handler(map, 'click')(clickEvent());
    const element = document.createElement('div');
    element.className = 'mapboxgl-popup hmed-popup';
    document.body.appendChild(element);

    mocks.popupInstances[0].callbacks.open();

    expect(element.style.zIndex).toBe('9999');
  });

  it('removes the active popup and handles stale and active close callbacks', () => {
    const map = createMap();
    renderHook(() => useLtsHexInteractions({ current: map }, true, 6, false));
    const onClick = handler(map, 'click');

    onClick(clickEvent());
    const first = mocks.popupInstances[0];
    first.callbacks.open();
    onClick(clickEvent());
    const second = mocks.popupInstances[1];
    expect(first.remove).toHaveBeenCalledOnce();

    first.callbacks.close();
    second.callbacks.open();
    onClick(clickEvent());
    expect(second.remove).toHaveBeenCalledOnce();

    const third = mocks.popupInstances[2];
    third.callbacks.open();
    third.callbacks.close();
    onClick(clickEvent());
    expect(third.remove).not.toHaveBeenCalled();
  });

  it('unregisters handlers and removes an active popup during cleanup', () => {
    const map = createMap({ layers: ['hex-l6'] });
    const { unmount } = renderHook(() =>
      useLtsHexInteractions({ current: map }, true, 6, false)
    );
    handler(map, 'click')(clickEvent());
    const popup = mocks.popupInstances[0];
    popup.callbacks.open();

    unmount();

    expect(map.off).toHaveBeenCalledWith('mouseenter', 'hex-l6', expect.any(Function));
    expect(map.off).toHaveBeenCalledWith('mouseleave', 'hex-l6', expect.any(Function));
    expect(map.off).toHaveBeenCalledWith('click', 'hex-l6', expect.any(Function));
    expect(popup.remove).toHaveBeenCalledOnce();
  });

  it('returns early from cleanup when style is absent or getStyle throws', () => {
    const noStyleMap = createMap({ style: null });
    const first = renderHook(() =>
      useLtsHexInteractions({ current: noStyleMap }, true, 6, false)
    );
    first.unmount();
    expect(noStyleMap.off).not.toHaveBeenCalled();

    const throwingMap = createMap();
    throwingMap.getStyle.mockImplementation(() => {
      throw new Error('map removed');
    });
    const second = renderHook(() =>
      useLtsHexInteractions({ current: throwingMap }, true, 6, false)
    );
    expect(() => second.unmount()).not.toThrow();
    expect(throwingMap.off).not.toHaveBeenCalled();
  });

  it('tolerates getLayer, off, and popup removal failures during cleanup', () => {
    const map = createMap({ layers: ['hex-l6'] });
    const { unmount } = renderHook(() =>
      useLtsHexInteractions({ current: map }, true, 6, false)
    );
    handler(map, 'click')(clickEvent());
    const popup = mocks.popupInstances[0];
    popup.callbacks.open();
    map.getLayer.mockImplementation(() => {
      throw new Error('layer unavailable');
    });
    popup.remove.mockImplementation(() => {
      throw new Error('popup unavailable');
    });

    expect(() => unmount()).not.toThrow();
  });

  it('reattaches handlers when the layer generation changes', () => {
    const map = createMap({ layers: ['hex-l6'] });
    const mapRef = { current: map };
    const { rerender } = renderHook(
      ({ generation }) => useLtsHexInteractions(mapRef, true, 6, false, generation),
      { initialProps: { generation: 0 } }
    );

    rerender({ generation: 1 });

    expect(map.off).toHaveBeenCalledTimes(3);
    expect(map.on).toHaveBeenCalledTimes(6);
  });
});
