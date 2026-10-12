import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock mapbox-gl so any code that constructs new mapboxgl.Map() doesn't require WebGL in jsdom
vi.mock('mapbox-gl', () => {
  const noop = () => {};
  const noopReturnThis = function () {
    return this;
  };
  return {
    default: {
      Map: function Map() {
        return {
          addControl: noop,
          on: noop,
          once: noop,
          off: noop,
          remove: noop,
          resize: noop,
          loaded: () => true,
          isStyleLoaded: () => true,
          getStyle: () => ({ addLayer: noop, addSource: noop, getSource: noop }),
          getSource: () => null,
          hasImage: () => false,
          loadImage: (_name, callback) =>
            callback(null, { width: 1, height: 1, data: new Uint8Array(4) }),
          addImage: noop,
          getLayer: () => null,
          setLayoutProperty: noop,
        };
      },
      accessToken: 'test-token',
      NavigationControl: function () {},
      FullscreenControl: function () {},
      ScaleControl: function () {},
      Popup: function () {
        return {
          setLngLat: noopReturnThis,
          setHTML: noopReturnThis,
          setDOMContent: noopReturnThis,
          addTo: noopReturnThis,
          remove: noop,
        };
      },
    },
  };
});

// Mock window.matchMedia for useIsMobile and similar hooks
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock scrollTo
window.scrollTo = vi.fn();

// Mock ResizeObserver - must be a constructor
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
global.ResizeObserver = MockResizeObserver;

// Mock IntersectionObserver (required by framer-motion / motion) - must be a constructor
class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  root = null;
  rootMargin = '';
  thresholds = [];
}
global.IntersectionObserver = MockIntersectionObserver;
