/**
 * @fileoverview LTS Flash Flood map: H3 hex polygon vector layers and zoom bands (fill-only; no circle overlay).
 */

import { useEffect, useRef, useState } from 'react';
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
  LTS_LAYER_ID,
  getLayerPropertyName,
  getVectorTileMaxZoomForLevel,
  getVectorTileMinZoomForLevel,
} from '../config/ltsFlashFloodLayerConfig';
import {
  getHexZoomRange,
  getSourceLayerName,
  getColorExpression,
  getLtsHexMapFilter,
} from '../utils/hmedMapUtils';
import { HMED_CONFIG } from '../config/mapConfig';
import { hmedLogger as logger } from '../utils/logger';

const HSI_VALUE_OFFSET = HMED_CONFIG.hsiValueOffset ?? 0;
const ALL_LEVELS = [6, 7, 8, 9, 10];
const MAP_STYLE_LOAD_EVENT = 'style.load';
const MAP_LOAD_ERROR = 'Failed to load map data. Please refresh the page.';

function hmMapDbg() {
  // Intentionally silent — verbose map traces stay out of the browser console.
}

/** Max wait per vector source so Promise.all cannot hang forever (tile server slow / no sourcedata). */
const SOURCE_READY_TIMEOUT_MS = 8000;

/**
 * Resolves when the source reports loaded, a tile errors, or timeout — always removes the listener.
 * @param {mapboxgl.Map} map
 * @param {string} sourceId
 * @returns {Promise<void>}
 */
function whenSourceReadyOrTimeout(map, sourceId) {
  return new Promise((resolve) => {
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    let done = false;
    let how = 'pending';
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
      hmMapDbg('vector source settled', {
        sourceId,
        how,
        ms: typeof performance !== 'undefined' ? Math.round(performance.now() - t0) : 0,
      });
      resolve();
    };
    const onData = (e) => {
      if (e.sourceId !== sourceId) return;
      if (e.isSourceLoaded) {
        how = 'sourcedata:isSourceLoaded';
        finish();
      } else if (e.tile?.state === 'errored') {
        how = 'sourcedata:tileErrored';
        hmMapDbg('tile errored for source', {
          sourceId,
          tileId: e.tile?.tileID,
        });
        finish();
      }
    };
    map.on('sourcedata', onData);
    tid = setTimeout(() => {
      how = 'timeout';
      finish();
    }, SOURCE_READY_TIMEOUT_MS);
    try {
      const src = map.getSource(sourceId);
      if (src && typeof src.loaded === 'function' && src.loaded()) {
        how = 'alreadyLoaded';
        finish();
      }
    } catch {
      /* ignore */
    }
  });
}

/** Mapbox GL v3+ can stack late-added layers oddly — move hex to top. */
function bringHexLayersToFront(map, levels) {
  if (!isMapAlive(map)) return;
  levels.forEach((level) => {
    const id = `hex-l${level}`;
    try {
      if (map.getLayer(id)) map.moveLayer(id);
    } catch {
      // ignore
    }
  });
}

/**
 * LTS hex fill: same smooth heatmap style as HMED precipitation (invisible outlines, flat opacity).
 */
function hexFillPaint(config, selectedHours, level) {
  return {
    'fill-color': getColorExpression(config, selectedHours, HSI_VALUE_OFFSET, level),
    'fill-opacity': HMED_CONFIG.hexFillOpacity,
    'fill-outline-color': 'rgba(0, 0, 0, 0)',
  };
}

/** Remove legacy line-outline layer and deprecated LTS circle overlay (`*-lts-dot`) from older builds. */
function removeHexOverlayLayers(map, layerId) {
  const legacyOutline = `${layerId}-outline`;
  if (map.getLayer(legacyOutline)) map.removeLayer(legacyOutline);
  const legacyDot = `${layerId}-lts-dot`;
  if (map.getLayer(legacyDot)) map.removeLayer(legacyDot);
}

/**
 * @param {React.RefObject} mapContainerRef
 * @param {number} selectedHours — unused for LTS paint; kept for API parity with color helpers
 * @returns {{ mapRef: React.RefObject, mapReady: boolean, isLoading: boolean, error: string | null, setError: Function, hexLayersGeneration: number }}
 */
export function useLtsMapLayers(mapContainerRef, selectedHours) {
  const mapRef = useRef(null);
  const initialLoadCompleteRef = useRef(false);
  const timeoutIdsRef = useRef([]);
  const lastHexLayerRef = useRef(null);
  const ltsLayerKey = LTS_LAYER_ID;
  const [mapReady, setMapReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  /**
   * Bumped after hex sources+layers are (re)built so paint + click handlers re-run.
   */
  const [hexLayersGeneration, setHexLayersGeneration] = useState(0);

  useEffect(() => {
    if (!mapContainerRef?.current || !mapboxgl.accessToken) {
      if (!mapboxgl.accessToken) setError('Mapbox access token is not configured');
      return;
    }

    mapRef.current = createMapInstance(mapContainerRef.current);
    const map = mapRef.current;
    addStandardControls(map);

    const onMapError = (e) => {
      const msg = e?.error?.message || e?.error || e;
      logger.warn('Mapbox map error (tiles/source/style):', msg);
      hmMapDbg('mapbox error event', msg, e);
    };
    map.on('error', onMapError);

    const onZoomEnd = () => {
      if (!isMapAlive(map)) return;
      const zoom = map.getZoom();
      const cfg = LAYER_CONFIG[ltsLayerKey];
      const activeLevels = cfg.levels || ALL_LEVELS;
      ALL_LEVELS.forEach((level) => {
        const layerId = `hex-l${level}`;
        if (!map.getLayer(layerId) || !activeLevels.includes(level)) return;
        const { min, max } = getHexZoomRange(level, cfg);
        const shouldBeVisible = zoom >= min && zoom <= max;
        const visibility = map.getLayoutProperty(layerId, 'visibility');
        if (shouldBeVisible && visibility !== 'visible') {
          map.setLayoutProperty(layerId, 'visibility', 'visible');
          map.triggerRepaint();
        } else if (!shouldBeVisible && visibility !== 'none') {
          map.setLayoutProperty(layerId, 'visibility', 'none');
        }
      });
      const center = map.getCenter();
      map.jumpTo({ center: [center.lng + 0.00001, center.lat] });
      map.jumpTo({ center });
    };
    map.on('zoomend', onZoomEnd);

    const loadLayers = async () => {
      hmMapDbg('loadLayers() start');
      const styleReady = await waitForStyleLoad(map);
      if (!styleReady || !isMapAlive(map)) {
        logger.error('Style load timeout or map removed');
        hmMapDbg('loadLayers() aborted', {
          styleReady,
          mapAlive: isMapAlive(map),
        });
        // Report only a real style failure. A removed map means unmount or a StrictMode
        // re-run, whose state now belongs to the map instance that replaced this one.
        if (isMapUsable(map)) {
          // Otherwise the initial isLoading=true keeps the overlay up forever, since no
          // hex source is ever added and no tile request is made.
          setIsLoading(false);
          setError(MAP_LOAD_ERROR);
        }
        return;
      }
      applyMapUiPadding(map);
      setIsLoading(true);
      setError(null);
      try {
        await loadCountyBoundaries(map);

        const layerKey = ltsLayerKey;
        const currentLayerConfig = LAYER_CONFIG[layerKey];
        const levels = currentLayerConfig.levels || ALL_LEVELS;
        hmMapDbg('loadLayers() config', {
          layerKey,
          levels,
          tileBase: TILE_SERVER_BASE_URL,
          sampleUrl: `${TILE_SERVER_BASE_URL}/${getSourceLayerName(levels[0], currentLayerConfig)}/{z}/{x}/{y}.pbf`,
        });

        ALL_LEVELS.forEach((level) => {
          const sourceId = `hexes-l${level}`;
          const layerId = `hex-l${level}`;
          removeHexOverlayLayers(map, layerId);
          if (map.getLayer(layerId)) map.removeLayer(layerId);
          if (map.getSource(sourceId)) map.removeSource(sourceId);
        });

        const sourcePromises = [];

        levels.forEach((level) => {
          const sourceId = `hexes-l${level}`;
          const layerId = `hex-l${level}`;
          const sourceLayerName = getSourceLayerName(level, currentLayerConfig);
          const tileUrl = `${TILE_SERVER_BASE_URL}/${sourceLayerName}/{z}/{x}/{y}.pbf`;
          hmMapDbg('addSource', {
            sourceId,
            sourceLayerName,
            minzoom: getVectorTileMinZoomForLevel(currentLayerConfig, level),
            maxzoom: getVectorTileMaxZoomForLevel(currentLayerConfig, level),
            tileUrlTemplate: tileUrl,
          });
          map.addSource(sourceId, {
            type: 'vector',
            tiles: [tileUrl],
            minzoom: getVectorTileMinZoomForLevel(currentLayerConfig, level),
            maxzoom: getVectorTileMaxZoomForLevel(currentLayerConfig, level),
          });
          const sourceReady = whenSourceReadyOrTimeout(map, sourceId);
          sourcePromises.push({ level, sourceId, layerId, sourceReady });
        });

        hmMapDbg('waiting for all vector sources…', {
          count: sourcePromises.length,
        });
        return Promise.all(sourcePromises.map((p) => p.sourceReady))
          .then(() => {
            hmMapDbg('all vector sources settled — addLayer pass', { layerKey });
            const config = LAYER_CONFIG[layerKey];
            sourcePromises.forEach(({ level, sourceId, layerId }) => {
              const sourceLayerName = getSourceLayerName(level, config);
              const zBand = getHexZoomRange(level, config);
              const ltsProp = getLayerPropertyName(config, selectedHours, undefined, level);
              const ltsMapFilter = getLtsHexMapFilter(ltsProp, config.ltsMapMinVisibleLevel);
              try {
                map.addLayer({
                  id: layerId,
                  source: sourceId,
                  'source-layer': sourceLayerName,
                  type: 'fill',
                  minzoom: zBand.min,
                  maxzoom: zBand.max,
                  ...(ltsMapFilter ? { filter: ltsMapFilter } : {}),
                  paint: hexFillPaint(config, selectedHours, level),
                });
                hmMapDbg('addLayer OK', {
                  layerId,
                  sourceLayer: sourceLayerName,
                  minzoom: zBand.min,
                  maxzoom: zBand.max,
                  propertyForColor: getLayerPropertyName(config, selectedHours, undefined, level),
                });
                map.setPaintProperty(layerId, 'fill-color-transition', {
                  duration: 800,
                  delay: 0,
                });
                map.setPaintProperty(layerId, 'fill-opacity-transition', {
                  duration: 600,
                  delay: 0,
                });
                map.setPaintProperty(layerId, 'fill-outline-color-transition', {
                  duration: 800,
                  delay: 0,
                });
              } catch (err) {
                console.error('Error adding layer:', layerId, err);
                hmMapDbg('addLayer FAILED', { layerId, err });
              }
            });

            bringHexLayersToFront(map, config.levels || ALL_LEVELS);

            const currentZoom = map.getZoom();
            (config.levels || ALL_LEVELS).forEach((level) => {
              const layerId = `hex-l${level}`;
              if (map.getLayer(layerId)) {
                const zr = getHexZoomRange(level, config);
                const shouldBeVisible = currentZoom >= zr.min && currentZoom <= zr.max;
                const currentVisibility = map.getLayoutProperty(layerId, 'visibility');
                if (shouldBeVisible && currentVisibility !== 'visible') {
                  map.setLayoutProperty(layerId, 'visibility', 'visible');
                } else if (!shouldBeVisible && currentVisibility !== 'none') {
                  map.setLayoutProperty(layerId, 'visibility', 'none');
                }
                hmMapDbg('layer visibility', {
                  layerId,
                  zoom: currentZoom,
                  band: zr,
                  shouldBeVisible,
                  layoutVisibility: map.getLayoutProperty(layerId, 'visibility'),
                });
              }
            });

            const forceTileRequests = () => {
              if (!isMapAlive(map)) return;
              const zoom = map.getZoom();
              (config.levels || ALL_LEVELS).forEach((level) => {
                const layerId = `hex-l${level}`;
                const sourceId = `hexes-l${level}`;
                if (map.getLayer(layerId)) {
                  const zr = getHexZoomRange(level, config);
                  const shouldBeVisible = zoom >= zr.min && zoom <= zr.max;
                  if (shouldBeVisible) {
                    const currentVisibility = map.getLayoutProperty(layerId, 'visibility');
                    if (currentVisibility !== 'visible') {
                      map.setLayoutProperty(layerId, 'visibility', 'visible');
                    }
                    const center = map.getCenter();
                    map.jumpTo({
                      center: [center.lng + 0.00001, center.lat],
                      zoom,
                    });
                    map.jumpTo({ center, zoom });
                    map.triggerRepaint();
                    try {
                      const layer = map.getLayer(layerId);
                      const configForProp = config;
                      const propertyName = getLayerPropertyName(
                        configForProp,
                        selectedHours,
                        undefined,
                        level
                      );
                      map.querySourceFeatures(sourceId, {
                        sourceLayer: layer['source-layer'],
                        filter: ['has', propertyName],
                      });
                    } catch {
                      // ignore
                    }
                    setTimeout(() => map.triggerRepaint(), 100);
                  }
                }
              });
            };
            const t1 = setTimeout(forceTileRequests, 500);
            const t2 = setTimeout(forceTileRequests, 1500);
            timeoutIdsRef.current.push(t1, t2);
            map.once('idle', forceTileRequests);

            lastHexLayerRef.current = layerKey;
            hmMapDbg('initial hex load complete', {
              layerKey,
              mapZoom: map.getZoom(),
              mapReady: true,
              uiSelectedLayer: ltsLayerKey,
            });
            if (ltsLayerKey !== layerKey) {
              hmMapDbg('NOTE: UI selection changed during tile load — swap effect should fix', {
                loaded: layerKey,
                uiWants: ltsLayerKey,
              });
            }
            setHexLayersGeneration((g) => g + 1);
            setMapReady(true);
            setIsLoading(false);
          })
          .catch((err) => {
            console.error('Error waiting for sources:', err);
            hmMapDbg('Promise.all(sourceReady) FAILED', err);
            setError(MAP_LOAD_ERROR);
            setIsLoading(false);
          });
      } catch (err) {
        logger.error('Error loading layers:', err);
        hmMapDbg('loadLayers() try/catch error', err);
        setError(MAP_LOAD_ERROR);
        setIsLoading(false);
      }
    };

    const handleStyleChange = createStyleChangeHandler(map, loadLayers, {
      initialLoadCompleteRef,
      componentName: 'LTS',
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
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: avoid remounting map/geometry layers
  }, []);

  // Update layer paint when selectedHours changes (same layer)
  useEffect(() => {
    if (!mapRef.current || !mapReady) {
      if (import.meta.env.DEV && mapRef.current && !mapReady) {
        hmMapDbg('paint effect skip: mapReady=false');
      }
      return;
    }
    const map = mapRef.current;
    if (!isMapAlive(map)) return;
    const layer = LAYER_CONFIG[ltsLayerKey];
    const levels = layer.levels || ALL_LEVELS;
    let updated = 0;
    levels.forEach((level) => {
      const layerId = `hex-l${level}`;
      if (map.getLayer(layerId)) {
        const paint = hexFillPaint(layer, selectedHours, level);
        map.setPaintProperty(layerId, 'fill-color', paint['fill-color']);
        map.setPaintProperty(layerId, 'fill-opacity', paint['fill-opacity']);
        map.setPaintProperty(layerId, 'fill-outline-color', paint['fill-outline-color']);
        updated += 1;
      }
    });
    hmMapDbg('paint update (hours/layer)', {
      layer: ltsLayerKey,
      selectedHours,
      layersUpdated: updated,
      hexLayersGeneration,
    });
  }, [mapReady, selectedHours, hexLayersGeneration, ltsLayerKey]);

  return { mapRef, mapReady, isLoading, error, setError, hexLayersGeneration };
}
