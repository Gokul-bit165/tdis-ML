/**
 * @fileoverview Hook for HMED map initialization, H3 hex layers, zoom visibility, and style reload.
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
    scheduleMapLayersLoad,
    isMapAlive,
    isMapUsable
} from '../utils/mapUtils';
import { TILE_SERVER_BASE_URL, HMED_CONFIG } from '../config/mapConfig';
import {
    LAYER_CONFIG,
    getLayerPropertyName,
    getVectorTileMaxZoomForLevel,
    getVectorTileMinZoomForLevel,
} from '../config/hmedLayerConfig';
import { getHexZoomRange, getSourceLayerName, getMvtSourceLayerName, getColorExpression } from '../utils/hmedMapUtils';
import { hmedLogger as logger } from '../utils/logger';
import { fetchFloodHubGaugesGeoJson } from '../services/floodHubGaugeService';
import {
    addFloodHubGaugesGeoJsonLayer,
    getFloodHubGaugeCirclePaint,
    removeFloodHubGaugesGeoJsonLayer,
    setFloodHubMvtGaugeLayerFallbackVisibility,
    updateFloodHubGaugesGeoJsonPaint,
    FLOOD_HUB_GAUGES_GEOJSON_LAYER,
} from '../utils/floodHubGaugeMapLayers';

const HSI_VALUE_OFFSET = HMED_CONFIG.hsiValueOffset ?? 0;
const ALL_LEVELS = [6, 7, 8, 9, 10];

function hmMapDbg() {
    // Intentionally silent — verbose map traces stay out of the browser console.
}

/** Max wait per vector source so Promise.all cannot hang forever (tile server slow / no sourcedata). */
const SOURCE_READY_TIMEOUT_MS = 8000;
const getPerformanceTime = () => globalThis.performance?.now?.() ?? 0;

/**
 * Resolves when the source reports loaded, a tile errors, or timeout — always removes the listener.
 * @param {mapboxgl.Map} map
 * @param {string} sourceId
 * @returns {Promise<void>}
 */
function whenSourceReadyOrTimeout(map, sourceId) {
    return new Promise((resolve) => {
        const t0 = getPerformanceTime();
        let done = false;
        let how = "pending";
        let tid = null;
        const finish = () => {
            if (done) return;
            done = true;
            try {
                map.off("sourcedata", onData);
            } catch {
                /* ignore */
            }
            if (tid != null) clearTimeout(tid);
            hmMapDbg("vector source settled", {
                sourceId,
                how,
                ms: Math.round(getPerformanceTime() - t0)
            });
            resolve();
        };
        const onData = (e) => {
            if (e.sourceId !== sourceId) return;
            if (e.isSourceLoaded) {
                how = "sourcedata:isSourceLoaded";
                finish();
            } else if (e.tile?.state === "errored") {
                how = "sourcedata:tileErrored";
                hmMapDbg("tile errored for source", { sourceId, tileId: e.tile?.tileID });
                finish();
            }
        };
        map.on("sourcedata", onData);
        tid = setTimeout(() => {
            how = "timeout";
            finish();
        }, SOURCE_READY_TIMEOUT_MS);
        try {
            const src = map.getSource(sourceId);
            if (src && typeof src.loaded === "function" && src.loaded()) {
                how = "alreadyLoaded";
                finish();
            }
        } catch {
            /* ignore */
        }
    });
}

/** Mapbox GL v3+ can stack late-added layers oddly; precip loads on init, LTS on swap — move hex to top. */
function bringHexLayersToFront(map, levels) {
    if (!isMapAlive(map)) return;
    levels.forEach((level) => {
        const fillId = `hex-l${level}`;
        const outlineId = `${fillId}-outline`;
        try {
            if (map.getLayer(fillId)) map.moveLayer(fillId);
            if (map.getLayer(outlineId)) map.moveLayer(outlineId);
        } catch {
            // ignore
        }
    });
    try {
        if (map.getLayer(FLOOD_HUB_GAUGES_GEOJSON_LAYER)) map.moveLayer(FLOOD_HUB_GAUGES_GEOJSON_LAYER);
    } catch {
        /* ignore */
    }
}

/**
 * Flood Hub: H3 L10 fills are tiny at state-level zoom — companion `line` layer draws polygon rings so cells stay visible.
 * (Precipitation avoids this by using coarser H3 levels at low zoom.)
 */
function addFloodHubOutlineLayerIfNeeded({
    map,
    config,
    selectedHours,
    level,
    sourceId,
    layerId,
    mvtLayerName,
    zBand,
}) {
    if (!config.floodHubGauge) return;
    /** Hex outline only applies to polygon MVT — point gauges use circle markers. */
    if (config.floodHubGaugeMvtGeometry === 'point') return;
    const outlineId = `${layerId}-outline`;
    try {
        if (map.getLayer(outlineId)) map.removeLayer(outlineId);
        map.addLayer({
            id: outlineId,
            source: sourceId,
            'source-layer': mvtLayerName,
            type: 'line',
            minzoom: zBand.min,
            maxzoom: zBand.max,
            paint: {
                'line-color': getColorExpression(config, selectedHours, HSI_VALUE_OFFSET, level),
                'line-opacity': 1,
                /** Wider than Precip needs: L10 cells are tiny at state zoom; blur softens edges so they read larger. */
                'line-width': ['interpolate', ['linear'], ['zoom'], 4, 7, 6, 5.5, 8, 4, 10, 2.75, 12, 1.85, 14, 1.15],
                'line-blur': ['interpolate', ['linear'], ['zoom'], 4, 2, 7, 1.15, 10, 0.55, 14, 0],
                'line-join': 'round'
            }
        });
        map.setPaintProperty(outlineId, 'line-opacity-transition', { duration: 500, delay: 0 });
        hmMapDbg("addLayer flood outline OK", { outlineId });
    } catch (err) {
        console.warn("[HMED Map] flood outline layer failed (fills still render)", err);
        hmMapDbg("addLayer flood outline FAILED", { outlineId, err });
    }
}

/**
 * Fill paint for H3 hex polygons. Flood Hub uses slightly higher opacity than precip/LTS (see HMED_CONFIG).
 */
function hexFillPaint(config, selectedHours, level) {
    const flood = Boolean(config.floodHubGauge);
    return {
        "fill-color": getColorExpression(config, selectedHours, HSI_VALUE_OFFSET, level),
        "fill-opacity": flood ? HMED_CONFIG.floodHubFillOpacity : HMED_CONFIG.hexFillOpacity,
        "fill-outline-color": "rgba(0, 0, 0, 0)"
    };
}

/** Flood Hub point mode: circle markers at gauge coordinates (MVT must be Point features). */
function hexGaugeCirclePaint(config, selectedHours, level) {
    return getFloodHubGaugeCirclePaint(config, selectedHours, level);
}

/**
 * GeoJSON overview: every gauge visible at Texas zoom on load. MVT is fallback only.
 * @param {import('mapbox-gl').Map} map
 * @param {object} config
 * @param {number} selectedHours
 */
async function loadFloodHubGaugesGeoJsonOverview(map, config, selectedHours) {
    if (!config.floodHubGaugesGeoJsonOnLoad) return false;
    try {
        const geojson = await fetchFloodHubGaugesGeoJson();
        if (!isMapAlive(map)) return false;
        const beforeId = map.getLayer('hex-l10') ? 'hex-l10' : undefined;
        addFloodHubGaugesGeoJsonLayer(map, geojson, config, selectedHours, beforeId);
        setFloodHubMvtGaugeLayerFallbackVisibility(map, true);
        hmMapDbg('Flood Hub GeoJSON overview loaded', { features: geojson.features.length });
        map.triggerRepaint();
        return true;
    } catch (err) {
        logger.warn('Flood Hub GeoJSON overview unavailable; using vector tiles', err);
        hmMapDbg('Flood Hub GeoJSON overview FAILED', err);
        setFloodHubMvtGaugeLayerFallbackVisibility(map, false);
        return false;
    }
}

/**
 * H3 fill (precip / LTS / polygon Flood Hub) or circle markers (Flood Hub + `floodHubGaugeMvtGeometry: 'point'`).
 * @param {import('mapbox-gl').Map} map
 * @param {object} config
 * @param {number} selectedHours
 * @param {number} level
 * @param {string} sourceId
 * @param {string} layerId
 * @param {string} mvtLayerName
 * @param {{ min: number, max: number }} zBand
 * @param {string} sourceLayerName
 */
function addHmedHexOrGaugeLayer({
    map,
    config,
    selectedHours,
    level,
    sourceId,
    layerId,
    mvtLayerName,
    zBand,
    sourceLayerName,
}) {
    const pointGauge = config.floodHubGauge === true && config.floodHubGaugeMvtGeometry === 'point';
    if (pointGauge) {
        map.addLayer({
            id: layerId,
            source: sourceId,
            "source-layer": mvtLayerName,
            type: "circle",
            minzoom: zBand.min,
            maxzoom: zBand.max,
            paint: hexGaugeCirclePaint(config, selectedHours, level)
        });
        hmMapDbg("addLayer OK", {
            layerId,
            type: "circle",
            tileUrlPath: sourceLayerName,
            mvtSourceLayer: mvtLayerName,
            minzoom: zBand.min,
            maxzoom: zBand.max,
            propertyForColor: getLayerPropertyName(config, selectedHours, undefined, level)
        });
        try {
            map.setPaintProperty(layerId, "circle-color-transition", { duration: 800, delay: 0 });
            map.setPaintProperty(layerId, "circle-opacity-transition", { duration: 600, delay: 0 });
        } catch {
            /* ignore */
        }
        return;
    }
    map.addLayer({
        id: layerId,
        source: sourceId,
        "source-layer": mvtLayerName,
        type: "fill",
        minzoom: zBand.min,
        maxzoom: zBand.max,
        paint: hexFillPaint(config, selectedHours, level)
    });
    hmMapDbg("addLayer OK", {
        layerId,
        type: "fill",
        tileUrlPath: sourceLayerName,
        mvtSourceLayer: mvtLayerName,
        minzoom: zBand.min,
        maxzoom: zBand.max,
        propertyForColor: getLayerPropertyName(config, selectedHours, undefined, level)
    });
    map.setPaintProperty(layerId, "fill-color-transition", { duration: 800, delay: 0 });
    map.setPaintProperty(layerId, "fill-opacity-transition", { duration: 600, delay: 0 });
    map.setPaintProperty(layerId, "fill-outline-color-transition", { duration: 800, delay: 0 });
    addFloodHubOutlineLayerIfNeeded({
        map,
        config,
        selectedHours,
        level,
        sourceId,
        layerId,
        mvtLayerName,
        zBand,
    });
}

/** Remove legacy line-outline layer and deprecated LTS circle overlay (`*-lts-dot`) from older builds. */
function removeHexOverlayLayers(map, layerId) {
    const legacyOutline = `${layerId}-outline`;
    if (map.getLayer(legacyOutline)) map.removeLayer(legacyOutline);
    const legacyDot = `${layerId}-lts-dot`;
    if (map.getLayer(legacyDot)) map.removeLayer(legacyDot);
}

/** Named updater so `setHexLayersGeneration` callers stay flat inside deeply nested async callbacks. */
const bumpGeneration = (g) => g + 1;

/**
 * Initial-load addLayer pass: one hex/gauge layer per settled vector source.
 * A single failing level must not abort the rest, so each add is guarded individually.
 * @param {import('mapbox-gl').Map} map
 * @param {object} config
 * @param {number} selectedHours
 * @param {Array<{ level: number, sourceId: string, layerId: string }>} sourceEntries
 */
function addHexLayersForSources(map, config, selectedHours, sourceEntries) {
    sourceEntries.forEach(({ level, sourceId, layerId }) => {
        const sourceLayerName = getSourceLayerName(level, config);
        const mvtLayerName = getMvtSourceLayerName(level, config);
        const zBand = getHexZoomRange(level, config);
        try {
            addHmedHexOrGaugeLayer({
                map,
                config,
                selectedHours,
                level,
                sourceId,
                layerId,
                mvtLayerName,
                zBand,
                sourceLayerName,
            });
        } catch (err) {
            console.error(`Error adding layer ${layerId}:`, err);
            hmMapDbg("addLayer FAILED", { layerId, err });
        }
    });
}

/**
 * Swap addLayer pass: like the initial load but also sets zoom-band visibility immediately,
 * since no post-swap visibility pass runs.
 * @param {import('mapbox-gl').Map} map
 * @param {object} config
 * @param {number} selectedHours
 * @param {Array<{ level: number, sourceId: string, layerId: string }>} sourceEntries
 */
function addSwapHexLayersForSources(map, config, selectedHours, sourceEntries) {
    sourceEntries.forEach(({ level, sourceId, layerId }) => {
        try {
            const sourceLayerName = getSourceLayerName(level, config);
            const mvtLayerName = getMvtSourceLayerName(level, config);
            const z = getHexZoomRange(level, config);
            addHmedHexOrGaugeLayer({
                map,
                config,
                selectedHours,
                level,
                sourceId,
                layerId,
                mvtLayerName,
                zBand: z,
                sourceLayerName,
            });
            const zoom = map.getZoom();
            const zr = getHexZoomRange(level, config);
            const shouldBeVisible = zoom >= zr.min && zoom <= zr.max;
            const vis = shouldBeVisible ? 'visible' : 'none';
            map.setLayoutProperty(layerId, 'visibility', vis);
            const outlineId = `${layerId}-outline`;
            if (map.getLayer(outlineId)) {
                map.setLayoutProperty(outlineId, 'visibility', vis);
            }
            hmMapDbg("swap addLayer OK", {
                layerId,
                tileUrlPath: sourceLayerName,
                mvtSourceLayer: mvtLayerName,
                visibility: shouldBeVisible ? "visible" : "none",
                zoom: map.getZoom(),
                band: z
            });
        } catch (err) {
            console.error(`Error adding layer ${layerId}:`, err);
            hmMapDbg("swap addLayer FAILED", { layerId, err });
        }
    });
}

/** Sync one hex fill layer and its outline to the zoom band for `currentZoom`. */
function applyHexLayerVisibilityForLevel(map, config, currentZoom, level) {
    const layerId = `hex-l${level}`;
    const outlineId = `${layerId}-outline`;
    if (!map.getLayer(layerId)) return;
    const zr = getHexZoomRange(level, config);
    const shouldBeVisible = currentZoom >= zr.min && currentZoom <= zr.max;
    const vis = shouldBeVisible ? 'visible' : 'none';
    const currentVisibility = map.getLayoutProperty(layerId, 'visibility');
    if (shouldBeVisible && currentVisibility !== 'visible') {
        map.setLayoutProperty(layerId, 'visibility', 'visible');
    } else if (!shouldBeVisible && currentVisibility !== 'none') {
        map.setLayoutProperty(layerId, 'visibility', 'none');
    }
    if (map.getLayer(outlineId)) {
        map.setLayoutProperty(outlineId, 'visibility', vis);
    }
    hmMapDbg("layer visibility", {
        layerId,
        zoom: currentZoom,
        band: zr,
        shouldBeVisible,
        layoutVisibility: map.getLayoutProperty(layerId, "visibility")
    });
}

/** Apply zoom-band visibility across every level of the active hazard layer. */
function applyHexLayerVisibility(map, config, currentZoom) {
    (config.levels || ALL_LEVELS).forEach((level) =>
        applyHexLayerVisibilityForLevel(map, config, currentZoom, level)
    );
}

/**
 * Nudge Mapbox into fetching tiles for one in-band level: tiny jumpTo jiggle forces a
 * viewport recompute, and `querySourceFeatures` warms the source for the active property.
 */
function requestTilesForLevel(map, config, selectedHours, level, zoom) {
    const layerId = `hex-l${level}`;
    const sourceId = `hexes-l${level}`;
    if (!map.getLayer(layerId)) return;
    const zr = getHexZoomRange(level, config);
    const shouldBeVisible = zoom >= zr.min && zoom <= zr.max;
    if (!shouldBeVisible) return;
    const currentVisibility = map.getLayoutProperty(layerId, 'visibility');
    if (currentVisibility !== 'visible') {
        map.setLayoutProperty(layerId, 'visibility', 'visible');
    }
    const outlineId = `${layerId}-outline`;
    if (map.getLayer(outlineId)) {
        map.setLayoutProperty(outlineId, 'visibility', 'visible');
    }
    const center = map.getCenter();
    map.jumpTo({ center: [center.lng + 0.00001, center.lat], zoom });
    map.jumpTo({ center, zoom });
    map.triggerRepaint();
    try {
        const layer = map.getLayer(layerId);
        const propertyName = getLayerPropertyName(config, selectedHours, undefined, level);
        map.querySourceFeatures(sourceId, {
            sourceLayer: layer['source-layer'],
            filter: ['has', propertyName]
        });
    } catch {
        // ignore
    }
    setTimeout(() => map.triggerRepaint(), 100);
}

/**
 * Factory (not a plain helper) so the retry timers and the `idle` handler can share one
 * closure bound to this load's map/config without re-nesting inside the effect.
 * @returns {() => void}
 */
function createForceTileRequests(map, config, selectedHours) {
    return () => {
        if (!isMapAlive(map)) return;
        const zoom = map.getZoom();
        (config.levels || ALL_LEVELS).forEach((level) =>
            requestTilesForLevel(map, config, selectedHours, level, zoom)
        );
    };
}

/**
 * @param {React.RefObject} mapContainerRef
 * @param {string} selectedLayer
 * @param {number} selectedHours
 * @returns {{ mapRef: React.RefObject, mapReady: boolean, isLoading: boolean, error: string | null, setError: Function }}
 */
export function useHMEDMapLayers(mapContainerRef, selectedLayer, selectedHours) {
    const mapRef = useRef(null);
    const initialLoadCompleteRef = useRef(false);
    const timeoutIdsRef = useRef([]);
    /** Layer currently shown on the map for hex tiles (avoids stale useRef(selectedLayer) vs UI) */
    const lastHexLayerRef = useRef(null);
    const selectedLayerRef = useRef(selectedLayer);
    selectedLayerRef.current = selectedLayer;
    const [mapReady, setMapReady] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [loadingMessage, setLoadingMessage] = useState('Loading hazard layers…');
    const [error, setError] = useState(null);
    /**
     * Bumped after hex sources+layers are (re)built so paint + click handlers re-run.
     * Async swap completes without changing mapReady/selectedLayer → effects would otherwise skip.
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
            logger.warn("Mapbox map error (tiles/source/style):", msg);
            hmMapDbg("mapbox error event", msg, e);
        };
        map.on("error", onMapError);

        const onZoomEnd = () => {
            if (!isMapAlive(map)) return;
            const zoom = map.getZoom();
            const cfg = LAYER_CONFIG[selectedLayerRef.current] || LAYER_CONFIG.precipitation;
            const activeLevels = cfg.levels || ALL_LEVELS;
            ALL_LEVELS.forEach((level) => {
                const layerId = `hex-l${level}`;
                const outlineId = `${layerId}-outline`;
                if (!map.getLayer(layerId) || !activeLevels.includes(level)) return;
                const { min, max } = getHexZoomRange(level, cfg);
                const shouldBeVisible = zoom >= min && zoom <= max;
                const visibility = map.getLayoutProperty(layerId, 'visibility');
                const visNext = shouldBeVisible ? 'visible' : 'none';
                if (shouldBeVisible && visibility !== 'visible') {
                    map.setLayoutProperty(layerId, 'visibility', 'visible');
                    map.triggerRepaint();
                } else if (!shouldBeVisible && visibility !== 'none') {
                    map.setLayoutProperty(layerId, 'visibility', 'none');
                }
                if (map.getLayer(outlineId)) {
                    map.setLayoutProperty(outlineId, 'visibility', visNext);
                }
            });
            const center = map.getCenter();
            map.jumpTo({ center: [center.lng + 0.00001, center.lat] });
            map.jumpTo({ center });
        };
        map.on('zoomend', onZoomEnd);

        const loadLayers = async () => {
            hmMapDbg("loadLayers() start");
            const styleReady = await waitForStyleLoad(map);
            if (!styleReady || !isMapAlive(map)) {
                logger.error('Style load timeout or map removed');
                hmMapDbg("loadLayers() aborted", { styleReady, mapAlive: isMapAlive(map) });
                // Report only a real style failure. A removed map means unmount or a StrictMode
                // re-run, whose state now belongs to the map instance that replaced this one.
                if (isMapUsable(map)) {
                    // Otherwise the initial isLoading=true keeps the overlay up forever, since no
                    // hex source is ever added and no tile request is made.
                    setIsLoading(false);
                    setError('Map failed to initialize. Please refresh the page.');
                }
                return;
            }
            applyMapUiPadding(map);
            setIsLoading(true);
            setLoadingMessage('Loading hazard layers…');
            setError(null);
            try {
                await loadCountyBoundaries(map);

                const layerKey = selectedLayerRef.current;
                const currentLayerConfig = LAYER_CONFIG[layerKey] || LAYER_CONFIG.precipitation;
                const levels = currentLayerConfig.levels || ALL_LEVELS;
                hmMapDbg("loadLayers() config", {
                    layerKey,
                    levels,
                    tileBase: TILE_SERVER_BASE_URL,
                    sampleUrl: `${TILE_SERVER_BASE_URL}/${getSourceLayerName(levels[0], currentLayerConfig)}/{z}/{x}/{y}.pbf`
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
                    hmMapDbg("addSource", {
                        sourceId,
                        sourceLayerName,
                        minzoom: getVectorTileMinZoomForLevel(currentLayerConfig, level),
                        maxzoom: getVectorTileMaxZoomForLevel(currentLayerConfig, level),
                        tileUrlTemplate: tileUrl
                    });
                    map.addSource(sourceId, {
                        type: 'vector',
                        tiles: [tileUrl],
                        minzoom: getVectorTileMinZoomForLevel(currentLayerConfig, level),
                        maxzoom: getVectorTileMaxZoomForLevel(currentLayerConfig, level)
                    });
                    const sourceReady = whenSourceReadyOrTimeout(map, sourceId);
                    sourcePromises.push({ level, sourceId, layerId, sourceReady });
                });

                hmMapDbg("waiting for all vector sources…", { count: sourcePromises.length });
                return Promise.all(sourcePromises.map((p) => p.sourceReady)).then(async () => {
                    hmMapDbg("all vector sources settled — addLayer pass", { layerKey });
                    const config = LAYER_CONFIG[layerKey] || LAYER_CONFIG.precipitation;
                    addHexLayersForSources(map, config, selectedHours, sourcePromises);

                    bringHexLayersToFront(map, config.levels || ALL_LEVELS);

                    if (layerKey === 'google_flood_hub') {
                        setLoadingMessage('Loading Flood Hub gauges…');
                        try {
                            const geoLoaded = await loadFloodHubGaugesGeoJsonOverview(map, config, selectedHours);
                            if (geoLoaded && isMapAlive(map)) {
                                setHexLayersGeneration(bumpGeneration);
                            }
                        } catch (gaugeErr) {
                            hmMapDbg('Flood Hub gauges load failed', gaugeErr);
                        }
                    } else {
                        removeFloodHubGaugesGeoJsonLayer(map);
                    }

                    const currentZoom = map.getZoom();
                    applyHexLayerVisibility(map, config, currentZoom);

                    const forceTileRequests = createForceTileRequests(map, config, selectedHours);
                    const t1 = setTimeout(forceTileRequests, 500);
                    const t2 = setTimeout(forceTileRequests, 1500);
                    timeoutIdsRef.current.push(t1, t2);
                    map.once('idle', forceTileRequests);

                    lastHexLayerRef.current = layerKey;
                    hmMapDbg("initial hex load complete", {
                        layerKey,
                        mapZoom: map.getZoom(),
                        mapReady: true,
                        uiSelectedLayer: selectedLayerRef.current
                    });
                    if (selectedLayerRef.current !== layerKey) {
                        hmMapDbg("NOTE: UI selection changed during tile load — swap effect should fix", {
                            loaded: layerKey,
                            uiWants: selectedLayerRef.current
                        });
                    }
                    setHexLayersGeneration(bumpGeneration);
                    setMapReady(true);
                    setIsLoading(false);
                }).catch((err) => {
                    console.error('Error waiting for sources:', err);
                    hmMapDbg("Promise.all(sourceReady) FAILED", err);
                    setError('Failed to load map data. Please refresh the page.');
                    setIsLoading(false);
                });
            } catch (err) {
                logger.error('Error loading layers:', err);
                hmMapDbg("loadLayers() try/catch error", err);
                setError('Failed to load map data. Please refresh the page.');
                setIsLoading(false);
            }
        };

        const handleStyleChange = createStyleChangeHandler(map, loadLayers, {
            initialLoadCompleteRef,
            componentName: 'HMED'
        });
        map.on('style.load', handleStyleChange);

        scheduleMapLayersLoad(map, loadLayers, initialLoadCompleteRef);

        return () => {
            timeoutIdsRef.current.forEach((id) => clearTimeout(id));
            timeoutIdsRef.current = [];
            map.off('zoomend', onZoomEnd);
            map.off('error', onMapError);
            map.off('style.load', handleStyleChange);
            map.remove();
            mapRef.current = null;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: avoid remounting map/geometry layers
    }, []);

    // When UI layer ≠ tiles on map: swap hex sources/layers (handles precip↔LTS and style.reload vs ref)
    useEffect(() => {
        const map = mapRef.current;
        if (!map) {
            hmMapDbg("swap effect skip: no map ref yet");
            return;
        }
        if (!mapReady) {
            hmMapDbg("swap effect skip: mapReady=false (waiting initial load)", { selectedLayer });
            return;
        }
        if (!isMapAlive(map)) {
            hmMapDbg("swap effect skip: map not alive");
            return;
        }
        if (lastHexLayerRef.current === selectedLayer) {
            hmMapDbg("swap effect skip: already on layer", { selectedLayer });
            return;
        }

        const config = LAYER_CONFIG[selectedLayer] || LAYER_CONFIG.precipitation;
        const levels = config.levels || ALL_LEVELS;

        const removeHexLayers = () => {
            removeFloodHubGaugesGeoJsonLayer(map);
            ALL_LEVELS.forEach((level) => {
                const layerId = `hex-l${level}`;
                const sourceId = `hexes-l${level}`;
                removeHexOverlayLayers(map, layerId);
                if (map.getLayer(layerId)) map.removeLayer(layerId);
                if (map.getSource(sourceId)) map.removeSource(sourceId);
            });
        };

        const addHexLayers = () => {
            const sourcePromises = [];
            levels.forEach((level) => {
                const sourceId = `hexes-l${level}`;
                const layerId = `hex-l${level}`;
                const sourceLayerName = getSourceLayerName(level, config);
                const tileUrl = `${TILE_SERVER_BASE_URL}/${sourceLayerName}/{z}/{x}/{y}.pbf`;
                map.addSource(sourceId, {
                    type: 'vector',
                    tiles: [tileUrl],
                    minzoom: getVectorTileMinZoomForLevel(config, level),
                    maxzoom: getVectorTileMaxZoomForLevel(config, level)
                });
                const sourceReady = whenSourceReadyOrTimeout(map, sourceId);
                sourcePromises.push({ level, sourceId, layerId, sourceReady });
            });

            hmMapDbg("swap: waiting for vector sources…", { count: sourcePromises.length, selectedLayer });
            Promise.all(sourcePromises.map((p) => p.sourceReady)).then(async () => {
                if (!isMapAlive(map)) {
                    hmMapDbg("swap: aborted — map no longer alive after sources");
                    return;
                }
                hmMapDbg("swap: sources settled — addLayer pass", { selectedLayer });
                addSwapHexLayersForSources(map, config, selectedHours, sourcePromises);
                bringHexLayersToFront(map, levels);
                if (selectedLayer === 'google_flood_hub') {
                    setLoadingMessage('Loading Flood Hub gauges…');
                    try {
                        const geoLoaded = await loadFloodHubGaugesGeoJsonOverview(map, config, selectedHours);
                        if (geoLoaded && isMapAlive(map)) {
                            setHexLayersGeneration(bumpGeneration);
                        }
                    } catch (gaugeErr) {
                        hmMapDbg('Flood Hub gauges load failed (swap)', gaugeErr);
                    }
                }
                lastHexLayerRef.current = selectedLayer;
                hmMapDbg("swap complete", {
                    selectedLayer,
                    mapZoom: map.getZoom(),
                    tileBase: TILE_SERVER_BASE_URL
                });
                logger.info("HMED hex layers added", { selectedLayer, levels, tileBase: TILE_SERVER_BASE_URL });
                try {
                    map.triggerRepaint();
                } catch {
                    /* ignore */
                }
                setHexLayersGeneration(bumpGeneration);
                setMapReady(true);
                setIsLoading(false);
            }).catch((err) => {
                hmMapDbg("swap Promise.all(sources) FAILED", err);
                setIsLoading(false);
            });
        };

        hmMapDbg("swap effect RUN", { from: lastHexLayerRef.current, to: selectedLayer, levels, tileBase: TILE_SERVER_BASE_URL });
        logger.info("HMED hex layer swap", { from: lastHexLayerRef.current, to: selectedLayer });
        setIsLoading(true);
        setLoadingMessage(
            selectedLayer === 'google_flood_hub'
                ? 'Switching to Flood Hub…'
                : 'Switching hazard layer…'
        );
        removeHexLayers();
        addHexLayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: avoid remounting map/geometry layers
    }, [mapReady, selectedLayer]);

    // Update layer paint when selectedHours changes (same layer)
    useEffect(() => {
        if (!mapRef.current || !mapReady) {
            if (import.meta.env.DEV && mapRef.current && !mapReady) {
                hmMapDbg("paint effect skip: mapReady=false");
            }
            return;
        }
        const map = mapRef.current;
        if (!isMapAlive(map)) return;
        const layer = LAYER_CONFIG[selectedLayer] || LAYER_CONFIG.precipitation;
        const levels = layer.levels || ALL_LEVELS;
        let updated = 0;
        if (layer.floodHubGaugesGeoJsonOnLoad) {
            updateFloodHubGaugesGeoJsonPaint(map, layer, selectedHours);
        }
        levels.forEach((level) => {
            const layerId = `hex-l${level}`;
            if (!map.getLayer(layerId)) return;
            const pointGauges = layer.floodHubGauge === true && layer.floodHubGaugeMvtGeometry === "point";
            if (pointGauges) {
                const p = hexGaugeCirclePaint(layer, selectedHours, level);
                map.setPaintProperty(layerId, "circle-color", p["circle-color"]);
                map.setPaintProperty(layerId, "circle-opacity", p["circle-opacity"]);
                map.setPaintProperty(layerId, "circle-radius", p["circle-radius"]);
                map.setPaintProperty(layerId, "circle-stroke-width", p["circle-stroke-width"]);
                map.setPaintProperty(layerId, "circle-stroke-color", p["circle-stroke-color"]);
                updated += 1;
                return;
            }
            const paint = hexFillPaint(layer, selectedHours, level);
            map.setPaintProperty(layerId, "fill-color", paint["fill-color"]);
            map.setPaintProperty(layerId, "fill-opacity", paint["fill-opacity"]);
            map.setPaintProperty(layerId, "fill-outline-color", paint["fill-outline-color"]);
            updated += 1;
            const outlineId = `${layerId}-outline`;
            if (layer.floodHubGauge && map.getLayer(outlineId)) {
                map.setPaintProperty(
                    outlineId,
                    "line-color",
                    getColorExpression(layer, selectedHours, HSI_VALUE_OFFSET, level)
                );
                updated += 1;
            }
        });
        hmMapDbg("paint update (hours/layer)", { selectedLayer, selectedHours, layersUpdated: updated, hexLayersGeneration });
    }, [mapReady, selectedHours, selectedLayer, hexLayersGeneration]);

    return { mapRef, mapReady, isLoading, loadingMessage, error, setError, hexLayersGeneration };
}
