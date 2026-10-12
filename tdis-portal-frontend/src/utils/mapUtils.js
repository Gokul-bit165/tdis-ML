/**
 * @fileoverview Shared map utilities for Mapbox GL operations.
 * Centralizes common map operations to reduce code duplication across components.
 */

import mapboxgl from 'mapbox-gl';
import { MapboxStyleSwitcherControl } from 'mapbox-gl-style-switcher';
import { mapStyles } from '../config/mapStyles';
import { createLogger } from './logger';
import { getOptimalAnchor } from './osaUtils';
import {
  DEFAULT_ZOOM,
  MAP_UI_BOTTOM_PADDING,
  MAP_UI_TOP_PADDING,
  TEXAS_BOUNDS,
  TEXAS_CENTER,
  TEXAS_MAX_BOUNDS,
  TEXAS_MIN_ZOOM,
  TEXAS_OUTSIDE_MASK_LAYER_ID,
  TEXAS_OUTSIDE_MASK_SOURCE_ID,
  TEXAS_OUTSIDE_MASK_STYLE,
  TEXAS_OUTSIDE_MASK_URL,
} from '../config/mapConfig';

const logger = createLogger('[mapUtils]');

/**
 * Default map options used across all map instances (Texas-focused guardrails).
 * Camera is finalized by fitMapToTexas on load (accounts for UI padding + viewport size).
 * maxBounds is applied after fit — including it at construct time clamps widescreen zoom.
 */
export const DEFAULT_MAP_OPTIONS = {
  style: 'mapbox://styles/mapbox/streets-v12',
  center: TEXAS_CENTER,
  zoom: DEFAULT_ZOOM,
  minZoom: TEXAS_MIN_ZOOM,
  cooperativeGestures: true,
  attributionControl: false,
  projection: 'mercator',
  scrollZoom: true,
  boxZoom: true,
  dragRotate: true,
  dragPan: true,
  keyboard: true,
  doubleClickZoom: true,
  touchZoomRotate: true,
  touchPitch: true,
};

/**
 * Slack left after fitting Texas so the Panhandle / Valley are not flush with map chrome.
 * Lower means tighter framing. Keep the fitted zoom under 6, where hex layers switch H3 level.
 */
const TEXAS_FIT_ZOOM_PULLBACK = 0.1;

/**
 * Frames the full Texas extent inside the usable map area (below tabs / above footer).
 * @param {mapboxgl.Map} map
 * @param {{ duration?: number }} [options]
 */
export const fitMapToTexas = (map, options = {}) => {
  if (!map) return;
  try {
    map.resize();

    // Clear any prior maxBounds so cameraForBounds / fitBounds are not clamped.
    if (typeof map.setMaxBounds === 'function') {
      map.setMaxBounds(null);
    }

    const padding = {
      top: MAP_UI_TOP_PADDING + 48,
      bottom: MAP_UI_BOTTOM_PADDING + 48,
      left: 48,
      right: 48,
    };

    const camera =
      typeof map.cameraForBounds === 'function'
        ? map.cameraForBounds(TEXAS_BOUNDS, { padding })
        : null;

    if (camera?.zoom == null) {
      map.fitBounds(TEXAS_BOUNDS, {
        padding,
        duration: options.duration ?? 0,
      });
      const zoom = map.getZoom();
      if (Number.isFinite(zoom)) {
        map.setZoom(Math.max(zoom - TEXAS_FIT_ZOOM_PULLBACK, TEXAS_MIN_ZOOM));
      }
    } else {
      const zoom = Math.max(camera.zoom - TEXAS_FIT_ZOOM_PULLBACK, TEXAS_MIN_ZOOM);
      map.jumpTo({
        center: camera.center,
        zoom,
        bearing: 0,
        pitch: 0,
      });
    }

    // Soft pan limit (wide enough for landscape framing).
    if (typeof map.setMaxBounds === 'function') {
      map.setMaxBounds(TEXAS_MAX_BOUNDS);
    }

    logger.debug('fitMapToTexas applied', { zoom: map.getZoom() });
  } catch (error) {
    logger.warn('fitMapToTexas failed:', error);
  }
};

/**
 * Creates a Mapbox map instance with default options merged with overrides.
 * Clears the container first so Mapbox never sees a non-empty element (avoids "map container should be empty" warning).
 * @param {HTMLElement} container - The DOM element to mount the map
 * @param {Object} [overrides={}] - Options to merge over DEFAULT_MAP_OPTIONS (e.g. center, zoom)
 * @param {boolean} [overrides.skipTexasFit=false] - Skip automatic fit-to-Texas on load
 * @returns {mapboxgl.Map} The map instance
 */
export const createMapInstance = (container, overrides = {}) => {
  while (container?.firstChild) {
    container.firstChild.remove();
  }
  const { skipTexasFit = false, ...mapOverrides } = overrides;
  const map = new mapboxgl.Map({
    ...DEFAULT_MAP_OPTIONS,
    ...mapOverrides,
    container,
  });
  if (!skipTexasFit) {
    const scheduleFit = () => {
      fitMapToTexas(map);
      // Layout (sidebar / flex) often settles after first paint.
      requestAnimationFrame(() => fitMapToTexas(map));
      globalThis.setTimeout(() => fitMapToTexas(map), 150);
      globalThis.setTimeout(() => fitMapToTexas(map), 500);
    };
    if (map.loaded()) {
      scheduleFit();
    } else {
      map.once('load', scheduleFit);
    }
  }
  return map;
};

/**
 * Returns true if the map instance is still valid and has a loaded style (not removed/destroyed).
 * Use before any map.getLayer() or style-dependent calls to avoid "getOwnLayer" errors after unmount.
 * @param {mapboxgl.Map | null | undefined} map - The Mapbox map instance
 * @returns {boolean}
 */
export const isMapAlive = (map) => {
  if (!map) return false;
  try {
    const style = map.getStyle?.();
    return Boolean(style?.layers);
  } catch {
    return false;
  }
};

/**
 * Returns true while the instance exists and has not been removed.
 * Unlike isMapAlive, a style that is not ready yet still counts as usable: getStyle() returns
 * undefined before the first style.load, during a style switch, and while a resize settles.
 * @param {mapboxgl.Map | null | undefined} map - The Mapbox map instance
 * @returns {boolean}
 */
export const isMapUsable = (map) => {
  if (!map) return false;
  // Mapbox sets _removed in Map#remove; there is no public equivalent.
  if (map._removed) return false;
  try {
    map.getStyle?.();
    return true;
  } catch {
    return false;
  }
};

/**
 * Adds standard controls to a Mapbox map instance
 * @param {mapboxgl.Map} map - The Mapbox map instance
 */
export const addStandardControls = (map) => {
  map.addControl(new MapboxStyleSwitcherControl(mapStyles, 'Streets'), 'top-right');
  map.addControl(new mapboxgl.NavigationControl(), 'top-right');
  map.addControl(new mapboxgl.FullscreenControl(), 'top-right');
  map.addControl(new mapboxgl.ScaleControl({ maxWidth: 80, unit: 'imperial' }), 'bottom-left');
  logger.debug('Standard controls added');
};

/**
 * Inset the map viewport so popups and controls avoid tab navigation and footer.
 * @param {mapboxgl.Map} map
 * @param {{ top?: number, bottom?: number, left?: number, right?: number }} [overrides]
 */
/**
 * Keep Texas framed after layout/style changes.
 * Avoids map.setPadding alone — that shifts the camera without zooming out and re-crops N/S Texas.
 * @param {mapboxgl.Map} map
 * @param {{ top?: number, bottom?: number, left?: number, right?: number, skipFit?: boolean }} [overrides]
 */
export const applyMapUiPadding = (map, overrides = {}) => {
  if (!isMapAlive(map)) return;
  if (overrides.skipFit) return;
  fitMapToTexas(map);
};

/**
 * Waits for map style to be fully loaded using polling
 * @param {mapboxgl.Map} map - The Mapbox map instance
 * @param {number} maxAttempts - Maximum number of polling attempts (default: 50)
 * @param {number} intervalMs - Interval between attempts in ms (default: 100)
 * @returns {Promise<boolean>} True if style loaded successfully, false if timeout
 */
export const waitForStyleLoad = async (map, maxAttempts = 50, intervalMs = 100) => {
  for (let i = 0; i < maxAttempts; i++) {
    // Only a removed map ends the wait: an unready style is what we are here to poll for.
    if (!isMapUsable(map)) return false;
    if (map.isStyleLoaded()) {
      logger.debug(`Style ready after ${i * intervalMs}ms`);
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  logger.warn(`Style load timeout after ${maxAttempts * intervalMs}ms`);
  return false;
};

/**
 * County boundary layer styling
 */
export const COUNTY_BOUNDARY_STYLE = {
  'line-color': '#334755',
  'line-width': 0.5,
  'line-opacity': 0.6,
};

/**
 * Grays out everything outside Texas (world polygon with Texas hole).
 * Safe to call on initial load and after style changes.
 * @param {mapboxgl.Map} map
 * @returns {Promise<void>}
 */
export const loadTexasOutsideMask = async (map) => {
  if (!isMapAlive(map)) return;
  const sourceId = TEXAS_OUTSIDE_MASK_SOURCE_ID;
  const layerId = TEXAS_OUTSIDE_MASK_LAYER_ID;
  try {
    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);

    const response = await fetch(TEXAS_OUTSIDE_MASK_URL);
    if (!response.ok) {
      throw new Error(`Failed to load Texas mask (${response.status})`);
    }
    const maskData = await response.json();

    map.addSource(sourceId, {
      type: 'geojson',
      data: maskData,
    });

    // Insert below labels when possible so place names remain readable outside TX.
    const beforeId = map
      .getStyle()
      ?.layers?.find(
        (l) => l.type === 'symbol' && (l.id.includes('label') || l.id.includes('place'))
      )?.id;

    map.addLayer(
      {
        id: layerId,
        type: 'fill',
        source: sourceId,
        layout: {},
        paint: TEXAS_OUTSIDE_MASK_STYLE,
      },
      beforeId
    );

    logger.debug('Texas outside mask loaded');
  } catch (error) {
    logger.error('Error loading Texas outside mask:', error);
  }
};

/**
 * Loads county boundaries from GeoJSON file and adds to map
 * @param {mapboxgl.Map} map - The Mapbox map instance
 * @param {string} sourceId - The source ID to use (default: 'outline-layer')
 * @param {string} layerId - The layer ID to use (default: 'outline-layer-line')
 * @returns {Promise<void>}
 */
export const loadCountyBoundaries = async (
  map,
  sourceId = 'outline-layer',
  layerId = 'outline-layer-line'
) => {
  if (!isMapAlive(map)) return;
  try {
    logger.debug('Loading county boundaries...');

    // Texas focus mask first so county lines draw on top of the gray-out edge.
    await loadTexasOutsideMask(map);

    // Remove existing layer and source if they exist (for style change reload)
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
      logger.debug(`Removed existing layer: ${layerId}`);
    }
    if (map.getSource(sourceId)) {
      map.removeSource(sourceId);
      logger.debug(`Removed existing source: ${sourceId}`);
    }

    // Load county boundaries GeoJSON
    const response = await fetch('/tx_counties.geojson');
    const polygonData = await response.json();

    // Add source and layer
    map.addSource(sourceId, {
      type: 'geojson',
      data: polygonData,
    });

    map.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      layout: {},
      paint: COUNTY_BOUNDARY_STYLE,
    });

    logger.debug('County boundaries loaded successfully');
  } catch (error) {
    logger.error('Error loading county boundaries:', error);
    throw error;
  }
};

/**
 * Creates a style change handler for reloading layers after map style changes
 * @param {mapboxgl.Map} map - The Mapbox map instance
 * @param {Function} loadLayersFn - Function to call to reload layers
 * @param {Object} options - Configuration options
 * @param {Object} options.initialLoadCompleteRef - Ref object tracking initial load state
 * @param {string} options.componentName - Name of component for logging
 * @returns {Function} The style change handler function
 */
export const createStyleChangeHandler = (map, loadLayersFn, options = {}) => {
  const { initialLoadCompleteRef, componentName = 'Map' } = options;
  const handlerLogger = createLogger(`[${componentName}]`);

  return async () => {
    if (!isMapAlive(map)) return;
    handlerLogger.debug('Style change detected');

    // Skip if initial load not complete
    if (initialLoadCompleteRef && !initialLoadCompleteRef.current) {
      handlerLogger.debug('Skipping - initial load not complete');
      return;
    }

    handlerLogger.debug('Reloading layers after style change...');

    const styleLoaded = await waitForStyleLoad(map);
    if (!styleLoaded || !isMapAlive(map)) {
      handlerLogger.error('Style failed to load within timeout or map was removed');
      return;
    }

    try {
      await loadLayersFn();
      if (isMapAlive(map)) handlerLogger.debug('Successfully reloaded layers after style change');
    } catch (error) {
      handlerLogger.error('Error reloading layers after style change:', error);
    }
  };
};

/**
 * Grace period before the load is started without a style event.
 * Neither 'load' nor style.load fires a second time, so a camera/resize change that clears
 * isStyleLoaded() after the initial style.load would otherwise leave the layers unloaded.
 */
const LAYER_LOAD_FALLBACK_MS = 1000;

/**
 * Schedule initial custom-layer load once the map (and style) are ready.
 * Shared by product map hooks to avoid duplicated bootstrap timing logic.
 * @param {mapboxgl.Map} map
 * @param {() => Promise<unknown>} loadLayersFn
 * @param {{ current: boolean }} initialLoadCompleteRef
 * @param {{ styleLoadEvent?: string, delayMs?: number, onReady?: (map: mapboxgl.Map) => void }} [options]
 */
export const scheduleMapLayersLoad = (map, loadLayersFn, initialLoadCompleteRef, options = {}) => {
  const styleLoadEvent = options.styleLoadEvent || 'style.load';
  const delayMs = options.delayMs ?? 100;
  const onReady = options.onReady;

  let started = false;

  const markComplete = () => {
    initialLoadCompleteRef.current = true;
    if (onReady) onReady(map);
  };

  const runLoad = () => {
    if (started) return;
    started = true;
    loadLayersFn().then(markComplete);
  };

  const runWhenStyleReady = () => {
    if (map.isStyleLoaded()) {
      runLoad();
    } else {
      map.once(styleLoadEvent, runLoad);
    }
  };

  if (map.loaded() && map.isStyleLoaded()) {
    runLoad();
    return;
  }

  map.once('load', () => {
    setTimeout(runWhenStyleReady, delayMs);
  });

  // Last resort when the events we depend on already fired: loadLayersFn waits for the style itself.
  setTimeout(runLoad, delayMs + LAYER_LOAD_FALLBACK_MS);
};

/**
 * Removes layers and sources from map safely
 * @param {mapboxgl.Map} map - The Mapbox map instance
 * @param {string[]} layerIds - Array of layer IDs to remove
 * @param {string[]} sourceIds - Array of source IDs to remove
 */
export const removeLayersAndSources = (map, layerIds = [], sourceIds = []) => {
  if (!isMapAlive(map)) return;
  layerIds.forEach((layerId) => {
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
      logger.debug(`Removed layer: ${layerId}`);
    }
  });

  sourceIds.forEach((sourceId) => {
    if (map.getSource(sourceId)) {
      map.removeSource(sourceId);
      logger.debug(`Removed source: ${sourceId}`);
    }
  });
};

/**
 * Re-export getOptimalAnchor from osaUtils for map-related popup placement.
 * Use getOptimalAnchor(point, map, { isMobile }) for consistent behavior across tabs.
 */
export { getOptimalAnchor };

export default {
  DEFAULT_MAP_OPTIONS,
  createMapInstance,
  fitMapToTexas,
  isMapAlive,
  isMapUsable,
  addStandardControls,
  waitForStyleLoad,
  COUNTY_BOUNDARY_STYLE,
  loadTexasOutsideMask,
  loadCountyBoundaries,
  createStyleChangeHandler,
  scheduleMapLayersLoad,
  removeLayersAndSources,
  getOptimalAnchor,
  applyMapUiPadding,
};
