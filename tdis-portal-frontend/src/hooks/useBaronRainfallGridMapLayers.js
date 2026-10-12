/**
 * @fileoverview Baron rainfall Beta map: H3 vector tiles (Tile) + API raster PNG (Grid).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import {
  createMapInstance,
  addStandardControls,
  applyMapUiPadding,
  waitForStyleLoad,
  loadCountyBoundaries,
  createStyleChangeHandler,
  isMapAlive,
  isMapUsable,
  scheduleMapLayersLoad,
} from '../utils/mapUtils';
import { TILE_SERVER_BASE_URL } from '../config/mapConfig';
import {
  LAYER_CONFIG,
  BARON_RAINFALL_TILE_LAYER_ID,
  BARON_RAINFALL_RASTER,
  getBaronRain1hrRasterTileUrlTemplate,
  getVectorTileMaxZoomForLevel,
  getVectorTileMinZoomForLevel,
} from '../config/baronRainfallGridLayerConfig';
import { getPortalApiBaseUrl } from '../config/portalApiConfig';
import { getHexZoomRange, getSourceLayerName, getColorExpression } from '../utils/hmedMapUtils';
import { HMED_CONFIG } from '../config/mapConfig';
import { hmedLogger as logger } from '../utils/logger';

const HSI_VALUE_OFFSET = HMED_CONFIG.hsiValueOffset ?? 0;

const MAP_STYLE_LOAD_EVENT = 'style.load';
const BARON_TILE_LEVELS = [6, 7, 8];
const SOURCE_READY_TIMEOUT_MS = 8000;

function baronMapDbg() {
  // Intentionally silent — verbose map traces stay out of the browser console.
}

function whenSourceReadyOrTimeout(map, sourceId) {
  return new Promise((resolve) => {
    let done = false;
    let tid = null;
    const finish = () => {
      if (done) return;
      done = true;
      try {
        map.off('sourcedata', onData);
      } catch {
        /* ignore */
      }
      if (tid != null) clearTimeout(tid);
      resolve();
    };
    const onData = (e) => {
      if (e.sourceId !== sourceId) return;
      if (e.isSourceLoaded) finish();
      else if (e.tile?.state === 'errored') finish();
    };
    map.on('sourcedata', onData);
    tid = setTimeout(finish, SOURCE_READY_TIMEOUT_MS);
    try {
      const src = map.getSource(sourceId);
      if (src?.loaded?.()) finish();
    } catch {
      /* ignore */
    }
  });
}

function bringLayersToFront(map, tileLevels) {
  if (!isMapAlive(map)) return;
  try {
    if (map.getLayer(BARON_RAINFALL_RASTER.mapLayerId)) {
      map.moveLayer(BARON_RAINFALL_RASTER.mapLayerId);
    }
  } catch {
    /* ignore */
  }
  tileLevels.forEach((level) => {
    const id = `baron-tile-hex-l${level}`;
    try {
      if (map.getLayer(id)) map.moveLayer(id);
    } catch {
      /* ignore */
    }
  });
}

function hexFillPaint(config, level) {
  return {
    'fill-color': getColorExpression(config, 1, HSI_VALUE_OFFSET, level),
    'fill-opacity': HMED_CONFIG.hexFillOpacity,
    'fill-outline-color': 'rgba(0, 0, 0, 0)',
  };
}

function removeBaronSources(map) {
  BARON_TILE_LEVELS.forEach((level) => {
    const sourceId = `baron-tile-hexes-l${level}`;
    const layerId = `baron-tile-hex-l${level}`;
    try {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
    } catch {
      /* ignore */
    }
    try {
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    } catch {
      /* ignore */
    }
  });
  try {
    if (map.getLayer(BARON_RAINFALL_RASTER.mapLayerId))
      map.removeLayer(BARON_RAINFALL_RASTER.mapLayerId);
  } catch {
    /* ignore */
  }
  try {
    if (map.getSource(BARON_RAINFALL_RASTER.mapSourceId))
      map.removeSource(BARON_RAINFALL_RASTER.mapSourceId);
  } catch {
    /* ignore */
  }
}

function addBaronRasterLayer(map) {
  const rasterUrl = getBaronRain1hrRasterTileUrlTemplate();
  if (!rasterUrl || !getPortalApiBaseUrl()) {
    baronMapDbg('skip raster: portal API not configured');
    return;
  }
  const { mapSourceId, mapLayerId, minzoom, maxzoom, sourceMaxzoom, tileSize, rasterOpacity } =
    BARON_RAINFALL_RASTER;
  map.addSource(mapSourceId, {
    type: 'raster',
    tiles: [rasterUrl],
    tileSize,
    minzoom,
    maxzoom: sourceMaxzoom ?? maxzoom,
  });
  map.addLayer({
    id: mapLayerId,
    type: 'raster',
    source: mapSourceId,
    minzoom,
    maxzoom,
    paint: {
      'raster-opacity': rasterOpacity,
      'raster-fade-duration': 0,
    },
  });
  baronMapDbg('raster layer added', { mapLayerId, rasterUrl });
}

/**
 * @param {React.RefObject<HTMLElement|null>} mapContainerRef
 * @param {React.RefObject<boolean>} [tileEnabledRef] When `current === false`, the
 *   vector Tile layers stay hidden (and stop fetching tiles) regardless of zoom.
 */
export function useBaronRainfallGridMapLayers(mapContainerRef, tileEnabledRef) {
  const mapRef = useRef(null);
  const initialLoadCompleteRef = useRef(false);
  const timeoutIdsRef = useRef([]);
  const syncTileVisibilityRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hexLayersGeneration, setHexLayersGeneration] = useState(0);

  const syncTileVisibility = useCallback(() => {
    syncTileVisibilityRef.current?.();
  }, []);

  useEffect(() => {
    if (!mapContainerRef?.current || !mapboxgl.accessToken) {
      if (!mapboxgl.accessToken) setError('Mapbox access token is not configured');
      return;
    }

    mapRef.current = createMapInstance(mapContainerRef.current);
    const map = mapRef.current;
    addStandardControls(map);

    const onMapError = (e) => {
      logger.warn('Mapbox map error:', e?.error?.message || e?.error || e);
    };
    map.on('error', onMapError);

    const tileConfig = LAYER_CONFIG[BARON_RAINFALL_TILE_LAYER_ID];
    const activeLevels = tileConfig.levels || BARON_TILE_LEVELS;

    const onZoomEnd = () => {
      if (!isMapAlive(map)) return;
      const tileEnabled = tileEnabledRef?.current !== false;
      const zoom = map.getZoom();
      BARON_TILE_LEVELS.forEach((level) => {
        const layerId = `baron-tile-hex-l${level}`;
        if (!map.getLayer(layerId) || !activeLevels.includes(level)) return;
        const { min, max } = getHexZoomRange(level, tileConfig);
        const vis = tileEnabled && zoom >= min && zoom <= max ? 'visible' : 'none';
        if (map.getLayoutProperty(layerId, 'visibility') !== vis) {
          map.setLayoutProperty(layerId, 'visibility', vis);
        }
      });
    };
    syncTileVisibilityRef.current = onZoomEnd;
    map.on('zoomend', onZoomEnd);

    const loadLayers = async () => {
      const styleReady = await waitForStyleLoad(map);
      if (!styleReady || !isMapAlive(map)) {
        // Report only a real style failure. A removed map means unmount or a StrictMode
        // re-run, whose state now belongs to the map instance that replaced this one.
        if (isMapUsable(map)) {
          // Otherwise the initial isLoading=true keeps the overlay up forever, since no
          // vector source is ever added and no tile request is made.
          setIsLoading(false);
          setError('Failed to load map data. Please refresh the page.');
        }
        return;
      }

      applyMapUiPadding(map);
      setIsLoading(true);
      setError(null);

      try {
        await loadCountyBoundaries(map);
        removeBaronSources(map);

        const sourcePromises = activeLevels.map((level) => {
          const sourceId = `baron-tile-hexes-l${level}`;
          const sourceLayerName = getSourceLayerName(level, tileConfig);
          const tileUrl = `${TILE_SERVER_BASE_URL.replace(/\/+$/, '')}/${sourceLayerName}/{z}/{x}/{y}.pbf`;
          baronMapDbg('addSource vector', { sourceId, sourceLayerName, tileUrl });
          map.addSource(sourceId, {
            type: 'vector',
            tiles: [tileUrl],
            minzoom: getVectorTileMinZoomForLevel(tileConfig, level),
            maxzoom: getVectorTileMaxZoomForLevel(tileConfig, level),
          });
          return whenSourceReadyOrTimeout(map, sourceId).then(() => ({
            level,
            sourceId,
            layerId: `baron-tile-hex-l${level}`,
            sourceLayerName,
          }));
        });

        const settled = await Promise.all(sourcePromises);

        settled.forEach(({ level, sourceId, layerId, sourceLayerName }) => {
          const zBand = getHexZoomRange(level, tileConfig);
          try {
            map.addLayer({
              id: layerId,
              source: sourceId,
              'source-layer': sourceLayerName,
              type: 'fill',
              minzoom: zBand.min,
              maxzoom: zBand.max,
              paint: hexFillPaint(tileConfig, level),
            });
            map.setPaintProperty(layerId, 'fill-color-transition', { duration: 800, delay: 0 });
            map.setPaintProperty(layerId, 'fill-opacity-transition', { duration: 600, delay: 0 });
            baronMapDbg('addLayer vector OK', { layerId, sourceLayerName, zBand });
          } catch (err) {
            console.error('Error adding Baron tile layer:', layerId, err);
          }
        });

        try {
          addBaronRasterLayer(map);
        } catch (err) {
          console.warn('Baron rainfall grid raster layer failed:', err);
        }

        bringLayersToFront(map, activeLevels);
        onZoomEnd();
        setHexLayersGeneration((g) => g + 1);
        setMapReady(true);
        setIsLoading(false);
      } catch (err) {
        logger.error('Error loading Baron rainfall layers:', err);
        setError('Failed to load rainfall layers. Please refresh the page.');
        setIsLoading(false);
      }
    };

    const handleStyleChange = createStyleChangeHandler(map, loadLayers, {
      initialLoadCompleteRef,
      componentName: 'BaronRainfallBeta',
    });
    map.on(MAP_STYLE_LOAD_EVENT, handleStyleChange);

    scheduleMapLayersLoad(map, loadLayers, initialLoadCompleteRef, {
      styleLoadEvent: MAP_STYLE_LOAD_EVENT,
    });

    return () => {
      timeoutIdsRef.current.forEach((id) => clearTimeout(id));
      timeoutIdsRef.current = [];
      map.off('zoomend', onZoomEnd);
      map.off('error', onMapError);
      map.off(MAP_STYLE_LOAD_EVENT, handleStyleChange);
      syncTileVisibilityRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [mapContainerRef, tileEnabledRef]);

  return { mapRef, mapReady, isLoading, error, hexLayersGeneration, syncTileVisibility };
}
