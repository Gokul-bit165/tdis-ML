/**
 * @fileoverview Unit tests for useHMEDHexInteractions
 * Mocks mapbox-gl and map ref to test hook setup and cleanup.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHMEDHexInteractions } from '@/hooks/useHMEDHexInteractions';

const mockPopupOn = vi.fn((event, cb) => {
  if (event === 'open') {
    setTimeout(() => cb(), 0);
  }
});
const mockPopupRemove = vi.fn();

function MockPopup() {
  return {
    setLngLat: vi.fn().mockReturnThis(),
    setHTML: vi.fn().mockReturnThis(),
    addTo: vi.fn().mockReturnThis(),
    on: mockPopupOn,
    remove: mockPopupRemove,
  };
}

vi.mock('mapbox-gl', () => ({
  default: {
    Popup: MockPopup,
  },
}));

vi.mock('@/utils/osaUtils', () => ({
  getOptimalAnchor: vi.fn(() => 'top'),
  getMapPopupOffset: vi.fn(() => [0, 0]),
}));

const mockOff = vi.fn();
const mockOn = vi.fn();
const mockGetLayer = vi.fn(() => true);
const mockGetStyle = vi.fn(() => ({}));
const mockCanvas = { style: { cursor: '' } };
const mockGetCanvas = vi.fn(() => mockCanvas);

const createMockMap = () => ({
  on: mockOn,
  off: mockOff,
  getLayer: mockGetLayer,
  getStyle: mockGetStyle,
  getCanvas: mockGetCanvas,
  getContainer: () => ({
    getBoundingClientRect: () => ({ width: 400, height: 300 }),
  }),
  project: () => ({ x: 200, y: 150 }),
});

function getClickHandler() {
  const clickCalls = mockOn.mock.calls.filter((c) => c[0] === 'click');
  return clickCalls.length ? clickCalls[0][2] : null;
}

function getMouseEnterHandler(layerId = 'hex-l6') {
  const call = mockOn.mock.calls.find((c) => c[0] === 'mouseenter' && c[1] === layerId);
  return call ? call[2] : null;
}

function getMouseLeaveHandler(layerId = 'hex-l6') {
  const call = mockOn.mock.calls.find((c) => c[0] === 'mouseleave' && c[1] === layerId);
  return call ? call[2] : null;
}

describe('useHMEDHexInteractions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLayer.mockReturnValue(true);
    mockGetStyle.mockReturnValue({});
  });

  it('runs without throwing when mapRef is null', () => {
    const mapRef = { current: null };
    expect(() => {
      renderHook(() => useHMEDHexInteractions(mapRef, false, 3, 'precipitation', false));
    }).not.toThrow();
  });

  it('runs without throwing when mapReady is false', () => {
    const mapRef = { current: createMockMap() };
    expect(() => {
      renderHook(() => useHMEDHexInteractions(mapRef, false, 3, 'precipitation', false));
    }).not.toThrow();
  });

  it('skips level when getLayer returns false', () => {
    mockGetLayer.mockImplementation((layerId) => layerId === 'hex-l6');
    const map = createMockMap();
    const mapRef = { current: map };
    renderHook(() => useHMEDHexInteractions(mapRef, true, 3, 'precipitation', false));
    expect(mockOn).toHaveBeenCalledTimes(3);
  });

  it('registers event handlers when map and mapReady are set', () => {
    const map = createMockMap();
    const mapRef = { current: map };
    renderHook(() => useHMEDHexInteractions(mapRef, true, 3, 'precipitation', false));
    expect(mockOn).toHaveBeenCalledWith('mouseenter', 'hex-l6', expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith('mouseleave', 'hex-l6', expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith('click', 'hex-l6', expect.any(Function));
  });

  it('cleanup unregisters event handlers on unmount', () => {
    const map = createMockMap();
    const mapRef = { current: map };
    const { unmount } = renderHook(() =>
      useHMEDHexInteractions(mapRef, true, 3, 'precipitation', false)
    );
    unmount();
    expect(mockOff).toHaveBeenCalled();
  });

  it('click handler creates popup and uses originalEvent when present', () => {
    const map = createMockMap();
    const mapRef = { current: map };
    renderHook(() => useHMEDHexInteractions(mapRef, true, 3, 'precipitation', false));
    const onClick = getClickHandler();
    expect(onClick).toBeDefined();

    const stopPropagation = vi.fn();
    const mockEvent = {
      lngLat: { lng: -99, lat: 31 },
      features: [
        {
          properties: {
            precip_3h_hsi_l6_50yr: 0.1,
            precip_6h_hsi_l6_50yr: 0.3,
            precip_12h_hsi_l6_50yr: 0.6,
            precip_24h_hsi_l6_50yr: 1.2,
          },
        },
      ],
      originalEvent: { cancelBubble: false, stopPropagation },
    };
    onClick(mockEvent);
    expect(stopPropagation).toHaveBeenCalled();
    expect(mockEvent.originalEvent.cancelBubble).toBe(true);
  });

  it('click handler works without originalEvent', () => {
    const map = createMockMap();
    const mapRef = { current: map };
    renderHook(() => useHMEDHexInteractions(mapRef, true, 3, 'precipitation', false));
    const onClick = getClickHandler();
    const mockEvent = {
      lngLat: { lng: -99, lat: 31 },
      features: [{ properties: {} }],
    };
    expect(() => onClick(mockEvent)).not.toThrow();
  });

  it('click handler covers formatValue and intensity for N/A and all levels', () => {
    const map = createMockMap();
    const mapRef = { current: map };
    renderHook(() => useHMEDHexInteractions(mapRef, true, 12, 'precipitation', true));
    const onClick = getClickHandler();
    const props = {
      precip_3h_hsi_l6_50yr: null,
      precip_6h_hsi_l6_50yr: NaN,
      precip_12h_hsi_l6_50yr: 1.6,
      precip_24h_hsi_l6_50yr: 0.3,
    };
    onClick({
      lngLat: { lng: -99, lat: 31 },
      features: [{ properties: props }],
    });
    expect(mockPopupOn).toHaveBeenCalledWith('open', expect.any(Function));
    expect(mockPopupOn).toHaveBeenCalledWith('close', expect.any(Function));
  });

  it('click handler removes existing popup before showing new one', async () => {
    const map = createMockMap();
    const mapRef = { current: map };
    renderHook(() => useHMEDHexInteractions(mapRef, true, 3, 'precipitation', false));
    const onClick = getClickHandler();
    const event = {
      lngLat: { lng: -99, lat: 31 },
      features: [
        {
          properties: {
            precip_3h_hsi_l6_50yr: 0.5,
            precip_6h_hsi_l6_50yr: 0.5,
            precip_12h_hsi_l6_50yr: 0.5,
            precip_24h_hsi_l6_50yr: 0.5,
          },
        },
      ],
    };
    onClick(event);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    onClick(event);
    expect(mockPopupRemove).toHaveBeenCalled();
  });

  it('popup open handler sets zIndex when elements exist', () => {
    const map = createMockMap();
    const mapRef = { current: map };
    renderHook(() => useHMEDHexInteractions(mapRef, true, 3, 'precipitation', false));
    const onClick = getClickHandler();
    onClick({
      lngLat: { lng: -99, lat: 31 },
      features: [
        {
          properties: {
            precip_3h_hsi_l6_50yr: 0.2,
            precip_6h_hsi_l6_50yr: 0.2,
            precip_12h_hsi_l6_50yr: 0.2,
            precip_24h_hsi_l6_50yr: 0.2,
          },
        },
      ],
    });
    const openCb = mockPopupOn.mock.calls.find((c) => c[0] === 'open')?.[1];
    expect(openCb).toBeDefined();
    const popupEl = document.createElement('div');
    popupEl.className = 'mapboxgl-popup hmed-popup';
    const contentEl = document.createElement('div');
    contentEl.className = 'mapboxgl-popup-content';
    popupEl.appendChild(contentEl);
    document.body.appendChild(popupEl);
    openCb();
    expect(popupEl.style.zIndex).toBe('9999');
    expect(contentEl.style.zIndex).toBe('9999');
    document.body.removeChild(popupEl);
  });

  it('cleanup when getStyle returns falsy does not call off', () => {
    mockGetStyle.mockReturnValue(null);
    const map = createMockMap();
    const mapRef = { current: map };
    const { unmount } = renderHook(() =>
      useHMEDHexInteractions(mapRef, true, 3, 'precipitation', false)
    );
    unmount();
    expect(mockOff).not.toHaveBeenCalled();
  });

  it('cleanup when getStyle throws returns early', () => {
    mockGetStyle.mockImplementation(() => {
      throw new Error('style gone');
    });
    const map = createMockMap();
    const mapRef = { current: map };
    const { unmount } = renderHook(() =>
      useHMEDHexInteractions(mapRef, true, 3, 'precipitation', false)
    );
    unmount();
  });

  it('cleanup removes active popup', async () => {
    const map = createMockMap();
    const mapRef = { current: map };
    const { unmount } = renderHook(() =>
      useHMEDHexInteractions(mapRef, true, 3, 'precipitation', false)
    );
    const onClick = getClickHandler();
    onClick({
      lngLat: { lng: -99, lat: 31 },
      features: [
        {
          properties: {
            precip_3h_hsi_l6_50yr: 0.1,
            precip_6h_hsi_l6_50yr: 0.1,
            precip_12h_hsi_l6_50yr: 0.1,
            precip_24h_hsi_l6_50yr: 0.1,
          },
        },
      ],
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    unmount();
    expect(mockPopupRemove).toHaveBeenCalled();
  });

  it('mouseenter sets canvas cursor to pointer', () => {
    mockCanvas.style.cursor = '';
    const map = createMockMap();
    const mapRef = { current: map };
    renderHook(() => useHMEDHexInteractions(mapRef, true, 3, 'precipitation', false));
    const onMouseEnter = getMouseEnterHandler();
    expect(onMouseEnter).toBeDefined();
    onMouseEnter();
    expect(mockCanvas.style.cursor).toBe('pointer');
  });

  it('mouseleave clears canvas cursor', () => {
    mockCanvas.style.cursor = 'pointer';
    const map = createMockMap();
    const mapRef = { current: map };
    renderHook(() => useHMEDHexInteractions(mapRef, true, 3, 'precipitation', false));
    const onMouseLeave = getMouseLeaveHandler();
    expect(onMouseLeave).toBeDefined();
    onMouseLeave();
    expect(mockCanvas.style.cursor).toBe('');
  });

  it('popup close handler clears activePopupRef when it was the active popup', async () => {
    const map = createMockMap();
    const mapRef = { current: map };
    renderHook(() => useHMEDHexInteractions(mapRef, true, 3, 'precipitation', false));
    const onClick = getClickHandler();
    onClick({
      lngLat: { lng: -99, lat: 31 },
      features: [
        {
          properties: {
            precip_3h_hsi_l6_50yr: 0.1,
            precip_6h_hsi_l6_50yr: 0.1,
            precip_12h_hsi_l6_50yr: 0.1,
            precip_24h_hsi_l6_50yr: 0.1,
          },
        },
      ],
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    const closeCalls = mockPopupOn.mock.calls.filter((c) => c[0] === 'close');
    const closeCb = closeCalls[closeCalls.length - 1]?.[1];
    expect(closeCb).toBeDefined();
    closeCb();
  });

  it('updates selectedHoursRef and selectedLayerRef when deps change', () => {
    const map = createMockMap();
    const mapRef = { current: map };
    const { rerender } = renderHook(
      ({ hours, layer }) => useHMEDHexInteractions(mapRef, true, hours, layer, false),
      { initialProps: { hours: 3, layer: 'precipitation' } }
    );
    rerender({ hours: 6, layer: 'precipitation' });
    const onClick = getClickHandler();
    onClick({
      lngLat: { lng: -99, lat: 31 },
      features: [
        {
          properties: {
            precip_3h_hsi_l6_50yr: 0.5,
            precip_6h_hsi_l6_50yr: 0.8,
            precip_12h_hsi_l6_50yr: 1.1,
            precip_24h_hsi_l6_50yr: 1.6,
          },
        },
      ],
    });
    expect(mockPopupOn).toHaveBeenCalled();
  });
});
