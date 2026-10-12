/**
 * @fileoverview Google Flood Hub supplemental overlays: significant events, inundation probability (status MVT), urban flash flood, history demo.
 * Inserts fill layers below gauge markers (`hex-l10` or GeoJSON overview) when present.
 */

import { useEffect, useRef, useState } from 'react';
import { isMapAlive } from '../utils/mapUtils';
import { LAYER_CONFIG } from '../config/hmedLayerConfig';
import { TILE_SERVER_BASE_URL } from '../config/mapConfig';
import {
    getHexZoomRange,
    getFloodHubStatusFillColorExpression,
    getFloodHubInundationProbabilityOpacityExpression,
    getFloodHubRiverineGaugeFilter,
    getFloodHubUrbanFlashFillColorExpression,
    getFloodHubUrbanFlashLikelihoodFilter,
    buildFloodHubTileUrlTemplate,
    getFloodHubUrbanFlashSourceLayerName,
    getFloodHubUrbanFlashLevels,
} from '../utils/hmedMapUtils';
import { FLOOD_HUB_STATIC_INUNDATION_HISTORY } from '../data/floodHubPrdStaticData';
import { FLOOD_HUB_GAUGES_GEOJSON_LAYER } from '../utils/floodHubGaugeMapLayers';

const SRC_EVENTS = 'flood-hub-prd-events';
const SRC_INUN_H = 'flood-hub-prd-inun-hist';
const SRC_STATUS = 'flood-hub-prd-status';
const SRC_URBAN = 'flood-hub-prd-urban';

const LY_EVENTS_FILL = 'flood-hub-prd-events-fill';
const LY_EVENTS_LINE = 'flood-hub-prd-events-line';
const LY_INUN_P = 'flood-hub-prd-inun-prob-fill';
const LY_INUN_P_LINE = 'flood-hub-prd-inun-prob-line';
const LY_INUN_H = 'flood-hub-prd-inun-hist-fill';
const LY_URBAN_FILL = 'flood-hub-prd-urban-fill';
const LY_URBAN_LINE = 'flood-hub-prd-urban-line';

/** @param {number} level */
function urbanFlashSourceId(level) {
    return `${SRC_URBAN}-l${level}`;
}

/** @param {number} level */
function urbanFlashFillLayerId(level) {
    return `${LY_URBAN_FILL}-l${level}`;
}

const FLOOD_HUB_LAYER_ID = 'google_flood_hub';

/** Style may be torn down during `map.remove()` or style reload — `getLayer` throws (getOwnLayer undefined). */
function safeGetLayer(map, id) {
    if (!isMapAlive(map)) return null;
    try {
        return map.getLayer(id) ?? null;
    } catch {
        return null;
    }
}

/** @param {import('mapbox-gl').Map} map */
function resolveOverlayBeforeId(map) {
    if (safeGetLayer(map, 'hex-l10')) return 'hex-l10';
    if (safeGetLayer(map, FLOOD_HUB_GAUGES_GEOJSON_LAYER)) return FLOOD_HUB_GAUGES_GEOJSON_LAYER;
    return undefined;
}

/**
 * @param {import('mapbox-gl').Map} map
 * @param {any} layer
 * @param {string | undefined} beforeId
 * @returns {boolean}
 */
function addOverlayLayer(map, layer, beforeId) {
    try {
        if (beforeId && safeGetLayer(map, beforeId)) {
            map.addLayer(layer, beforeId);
        } else {
            map.addLayer(layer);
        }
        return Boolean(safeGetLayer(map, layer.id));
    } catch (err) {
        if (import.meta.env.DEV) {
            console.warn('[Flood Hub overlays] addLayer failed:', layer?.id, err);
        }
        return false;
    }
}

/**
 * @param {import('mapbox-gl').Map} map
 * @param {string} id
 * @param {any} spec
 * @returns {boolean}
 */
function safeAddSource(map, id, spec) {
    try {
        if (map.getSource(id)) map.removeSource(id);
    } catch {
        /* ignore */
    }
    try {
        map.addSource(id, spec);
        return true;
    } catch (err) {
        if (import.meta.env.DEV) {
            console.warn('[Flood Hub overlays] addSource failed:', id, err);
        }
        return false;
    }
}

/** @param {import('mapbox-gl').Map} map */
function removeFloodHubPrdOverlays(map) {
    if (!isMapAlive(map)) return;
    [
        LY_INUN_P_LINE,
        LY_EVENTS_LINE,
        LY_EVENTS_FILL,
        LY_INUN_P,
        LY_INUN_H,
        LY_URBAN_LINE,
        LY_URBAN_FILL,
        ...getFloodHubUrbanFlashLevels(LAYER_CONFIG.google_flood_hub).map(urbanFlashFillLayerId),
    ].forEach((id) => {
        try {
            if (safeGetLayer(map, id)) map.removeLayer(id);
        } catch {
            /* ignore */
        }
    });
    [
        SRC_EVENTS,
        SRC_STATUS,
        SRC_INUN_H,
        SRC_URBAN,
        ...getFloodHubUrbanFlashLevels(LAYER_CONFIG.google_flood_hub).map(urbanFlashSourceId),
    ].forEach((id) => {
        try {
            if (map.getSource(id)) map.removeSource(id);
        } catch {
            /* ignore */
        }
    });
}

/**
 * Apply the selected confidence and severity controls to every gauge layer.
 * @param {import('mapbox-gl').Map} map
 * @param {boolean} showNormal
 * @param {boolean} lowerConfidenceOnly
 */
function syncFloodHubRiverineGaugeFilter(map, showNormal, lowerConfidenceOnly) {
    const ids = [FLOOD_HUB_GAUGES_GEOJSON_LAYER, 'hex-l10', 'hex-l10-outline'];
    const filter = getFloodHubRiverineGaugeFilter(showNormal, lowerConfidenceOnly);
    for (const id of ids) {
        if (!safeGetLayer(map, id)) continue;
        try {
            map.setFilter(id, filter);
        } catch {
            /* ignore */
        }
    }
}

/**
 * @param {import('mapbox-gl').Map} map
 * @param {boolean} gaugesOn
 * @param {boolean} [riverineShowNormal=true]
 * @param {boolean} [riverineLowerConfidenceOnly=false]
 */
function syncFloodHubGaugeHexVisibility(
    map,
    gaugesOn,
    riverineShowNormal = true,
    riverineLowerConfidenceOnly = false
) {
    const zr = getHexZoomRange(10, LAYER_CONFIG.google_flood_hub);
    const z = map.getZoom();
    const inBand = z >= zr.min && z <= zr.max;
    const vis = gaugesOn && inBand ? 'visible' : 'none';
    const geoLayer = safeGetLayer(map, FLOOD_HUB_GAUGES_GEOJSON_LAYER);
    if (geoLayer) {
        try {
            map.setLayoutProperty(FLOOD_HUB_GAUGES_GEOJSON_LAYER, 'visibility', vis);
        } catch {
            /* ignore */
        }
    }
    const mvtVis = geoLayer ? 'none' : vis;
    if (!safeGetLayer(map, 'hex-l10') && !geoLayer) return;
    try {
        if (safeGetLayer(map, 'hex-l10')) map.setLayoutProperty('hex-l10', 'visibility', mvtVis);
    } catch {
        /* ignore */
    }
    try {
        const oid = 'hex-l10-outline';
        if (safeGetLayer(map, oid)) map.setLayoutProperty(oid, 'visibility', mvtVis);
    } catch {
        /* ignore */
    }
    syncFloodHubRiverineGaugeFilter(map, riverineShowNormal, riverineLowerConfidenceOnly);
}

/**
 * MVT source layer names + tile bounds shared by every Flood Hub overlay source.
 * Urban flash zoom bands use default HSI ranges (not gauge hexZoomRangeByLevel).
 * @returns {{ tileBase: string, tileMaxZoom: number, eventsMvtLayer: string, statusMvtLayer: string, urbanLevels: number[], urbanLayerConfig: object }}
 */
function removeTrailingSlashes(value) {
    let end = value.length;
    while (end > 0 && value[end - 1] === '/') end -= 1;
    return value.slice(0, end);
}

function getFloodHubTileConfig() {
    const fh = LAYER_CONFIG.google_flood_hub;
    return {
        tileBase: removeTrailingSlashes(TILE_SERVER_BASE_URL),
        tileMaxZoom: fh.vectorTileMaxZoom ?? 22,
        eventsMvtLayer: fh.significantEventsVectorTileSourceLayer,
        statusMvtLayer: fh.floodHubStatusVectorTileSourceLayer,
        urbanLevels: getFloodHubUrbanFlashLevels(fh),
        urbanLayerConfig: fh,
    };
}

/** @returns {{ type: 'vector', tiles: string[], minzoom: number, maxzoom: number }} */
function buildVectorSourceSpec(tileBase, sourceLayer, tileMaxZoom, tileQuery) {
    return {
        type: 'vector',
        tiles: [buildFloodHubTileUrlTemplate(tileBase, sourceLayer, tileQuery)],
        minzoom: 0,
        maxzoom: tileMaxZoom,
    };
}

/**
 * @param {import('mapbox-gl').Map} map
 * @param {object} toggles
 * @param {ReturnType<typeof getFloodHubTileConfig>} cfg
 * @param {string | undefined} beforeId
 */
function addFloodHubPrdSources(map, toggles, cfg, beforeId) {
    const { tileBase, tileMaxZoom } = cfg;
    if (toggles.inundationHistory) {
        safeAddSource(map, SRC_INUN_H, { type: 'geojson', data: FLOOD_HUB_STATIC_INUNDATION_HISTORY });
    }
    if (toggles.events) {
        safeAddSource(map, SRC_EVENTS, buildVectorSourceSpec(tileBase, cfg.eventsMvtLayer, tileMaxZoom));
    }
    if (toggles.inundationProbability) {
        safeAddSource(map, SRC_STATUS, buildVectorSourceSpec(tileBase, cfg.statusMvtLayer, tileMaxZoom));
    }
    if (!toggles.urbanFlashFlood) return;
    for (const level of cfg.urbanLevels) {
        const sourceLayer = getFloodHubUrbanFlashSourceLayerName(level, cfg.urbanLayerConfig);
        const zBand = getHexZoomRange(level);
        const urbanSpec = {
            type: 'vector',
            tiles: [buildFloodHubTileUrlTemplate(tileBase, sourceLayer)],
            minzoom: zBand.min,
            maxzoom: tileMaxZoom,
        };
        const added = safeAddSource(map, urbanFlashSourceId(level), urbanSpec);
        if (import.meta.env.DEV) {
            console.info('[Flood Hub overlays] Urban Flash Flood source', {
                added,
                level,
                urbanTileUrl: urbanSpec.tiles[0],
                zoomBand: zBand,
                beforeId: beforeId ?? '(top)',
            });
        }
    }
}

function addInundationHistoryLayer(map, beforeId) {
    addOverlayLayer(
        map,
        {
            id: LY_INUN_H,
            type: 'fill',
            source: SRC_INUN_H,
            paint: {
                'fill-color': '#0369a1',
                'fill-opacity': ['interpolate', ['linear'], ['get', 'historical_frequency'], 0, 0.08, 0.5, 0.45],
            },
        },
        beforeId
    );
}

function addInundationProbabilityLayers(map, statusMvtLayer, beforeId) {
    /** Fill + stroke share hue and opacity so adjacent cells read like a continuous heat surface (cf. events). */
    const inunFillColor = getFloodHubStatusFillColorExpression();
    const inunOpacity = getFloodHubInundationProbabilityOpacityExpression();
    addOverlayLayer(
        map,
        {
            id: LY_INUN_P,
            type: 'fill',
            source: SRC_STATUS,
            'source-layer': statusMvtLayer,
            paint: {
                'fill-color': inunFillColor,
                'fill-opacity': inunOpacity,
            },
        },
        beforeId
    );
    addOverlayLayer(
        map,
        {
            id: LY_INUN_P_LINE,
            type: 'line',
            source: SRC_STATUS,
            'source-layer': statusMvtLayer,
            paint: {
                'line-color': inunFillColor,
                'line-width': 1,
                'line-opacity': inunOpacity,
            },
        },
        beforeId
    );
}

function addSignificantEventLayers(map, eventsMvtLayer, beforeId) {
    /** One orange for fill + stroke so adjacent cells read like a continuous heat surface */
    const eventsOrange = '#f97316';
    const eventsOpacity = 0.28;
    addOverlayLayer(
        map,
        {
            id: LY_EVENTS_FILL,
            type: 'fill',
            source: SRC_EVENTS,
            'source-layer': eventsMvtLayer,
            paint: {
                'fill-color': eventsOrange,
                'fill-opacity': eventsOpacity,
            },
        },
        beforeId
    );
    addOverlayLayer(
        map,
        {
            id: LY_EVENTS_LINE,
            type: 'line',
            source: SRC_EVENTS,
            'source-layer': eventsMvtLayer,
            paint: {
                'line-color': eventsOrange,
                'line-opacity': eventsOpacity,
                'line-width': 1,
            },
        },
        beforeId
    );
}

/** One fill layer per H3 level; minzoom/maxzoom match precipitation HSI bands. */
function addUrbanFlashLayers(map, cfg, beforeId) {
    const { tileBase, tileMaxZoom, urbanLevels, urbanLayerConfig } = cfg;
    for (const level of urbanLevels) {
        const sourceId = urbanFlashSourceId(level);
        if (!map.getSource(sourceId)) continue;
        const sourceLayer = getFloodHubUrbanFlashSourceLayerName(level, urbanLayerConfig);
        const zBand = getHexZoomRange(level);
        const fillOk = addOverlayLayer(
            map,
            {
                id: urbanFlashFillLayerId(level),
                type: 'fill',
                source: sourceId,
                'source-layer': sourceLayer,
                filter: getFloodHubUrbanFlashLikelihoodFilter(),
                minzoom: zBand.min,
                maxzoom: zBand.max,
                layout: { visibility: 'visible' },
                paint: {
                    'fill-color': getFloodHubUrbanFlashFillColorExpression(),
                    'fill-antialias': false,
                },
            },
            beforeId
        );
        if (import.meta.env.DEV) {
            console.info('[Flood Hub overlays] Urban Flash Flood layers', {
                fillOk,
                level,
                sourceLayer,
                zoomBand: zBand,
                beforeId: beforeId ?? '(top)',
                zoom: map.getZoom(),
                tileBase,
                tileMaxZoom,
            });
        }
    }
    try {
        map.triggerRepaint();
    } catch {
        /* ignore */
    }
}

/**
 * @param {import('mapbox-gl').Map} map
 * @param {object} toggles
 * @param {ReturnType<typeof getFloodHubTileConfig>} cfg
 * @param {string | undefined} beforeId
 */
function addFloodHubPrdOverlayLayers(map, toggles, cfg, beforeId) {
    if (toggles.inundationHistory) addInundationHistoryLayer(map, beforeId);
    if (toggles.inundationProbability) addInundationProbabilityLayers(map, cfg.statusMvtLayer, beforeId);
    if (toggles.events) addSignificantEventLayers(map, cfg.eventsMvtLayer, beforeId);
    if (toggles.urbanFlashFlood) addUrbanFlashLayers(map, cfg, beforeId);
}

/**
 * Click + hover handlers for every overlay layer, paired with the layer they belong to
 * so binding and teardown stay in lockstep.
 * @param {import('mapbox-gl').Map} map
 * @param {{ current: object }} handlersRef
 */
function createFloodHubOverlayInteractions(map, handlersRef) {
    const setCursor = (value) => () => {
        try {
            map.getCanvas().style.cursor = value;
        } catch {
            /* ignore */
        }
    };
    const cursorPointer = setCursor('pointer');
    const cursorReset = setCursor('');

    const selectHandler =
        (handlerKey, payload) =>
        (/** @type {import('mapbox-gl').MapLayerMouseEvent} */ e) => {
            e.originalEvent?.stopPropagation?.();
            const f = e.features?.[0];
            if (!f) return;
            handlersRef.current[handlerKey]?.({
                lngLat: e.lngLat,
                ...payload,
                properties: { ...f.properties },
            });
        };
    const onEventClick = selectHandler('onEventSelect', { kind: 'event' });
    const onInunPClick = selectHandler('onInundationSelect', { kind: 'inundation', variant: 'probability' });
    const onInunHClick = selectHandler('onInundationSelect', { kind: 'inundation', variant: 'history' });
    const onUrbanClick = selectHandler('onUrbanFlashSelect', { kind: 'urbanFlash' });

    return {
        cursorPointer,
        cursorReset,
        bindings: [
            { layerId: LY_EVENTS_FILL, onClick: onEventClick },
            { layerId: LY_INUN_P, onClick: onInunPClick },
            { layerId: LY_INUN_H, onClick: onInunHClick },
            { layerId: LY_INUN_P_LINE, onClick: onInunPClick },
            { layerId: LY_URBAN_FILL, onClick: onUrbanClick },
            { layerId: LY_URBAN_LINE, onClick: onUrbanClick },
            ...getFloodHubUrbanFlashLevels(LAYER_CONFIG.google_flood_hub).map((level) => ({
                layerId: urbanFlashFillLayerId(level),
                onClick: onUrbanClick,
            })),
        ],
    };
}

/** @param {ReturnType<typeof createFloodHubOverlayInteractions>} interactions */
function bindFloodHubOverlayInteractions(map, interactions) {
    const { cursorPointer, cursorReset, bindings } = interactions;
    for (const { layerId, onClick } of bindings) {
        if (!safeGetLayer(map, layerId)) continue;
        map.on('click', layerId, onClick);
        map.on('mouseenter', layerId, cursorPointer);
        map.on('mouseleave', layerId, cursorReset);
    }
}

/** @param {ReturnType<typeof createFloodHubOverlayInteractions>} interactions */
function unbindFloodHubOverlayInteractions(map, interactions) {
    const { cursorPointer, cursorReset, bindings } = interactions;
    for (const { layerId, onClick } of bindings) {
        try {
            map.off('click', layerId, onClick);
            map.off('mouseenter', layerId, cursorPointer);
            map.off('mouseleave', layerId, cursorReset);
        } catch {
            /* map or style destroyed */
        }
    }
}

/**
 * Gauge hexes only exist inside their zoom band, so visibility is re-synced on every zoom.
 * @param {import('mapbox-gl').Map} map
 * @param {{ current: string }} selectedLayerRef
 * @param {{ current: object }} togglesRef
 */
function createGaugeVisibilityZoomHandler(map, selectedLayerRef, togglesRef) {
    return () => {
        if (selectedLayerRef.current !== FLOOD_HUB_LAYER_ID) return;
        if (!isMapAlive(map)) return;
        const t = togglesRef.current;
        syncFloodHubGaugeHexVisibility(
            map,
            t.gauges,
            t.riverineShowNormal !== false,
            t.riverineLowerConfidenceOnly === true
        );
    };
}

/**
 * @param {React.RefObject<import('mapbox-gl').Map|null>} mapRef
 * @param {boolean} mapReady
 * @param {string} selectedLayer
 * @param {typeof import('../data/floodHubPrdStaticData.js').FLOOD_HUB_PRD_DEFAULT_TOGGLES} toggles
 * @param {number} hexLayersGeneration
 * @param {object} [handlers={}]
 * @param {(p: { lngLat: import('mapbox-gl').LngLat; kind: 'event'; properties: Record<string, unknown> }) => void} [handlers.onEventSelect]
 * @param {(p: { lngLat: import('mapbox-gl').LngLat; kind: 'inundation'; variant: 'probability'|'history'; properties: Record<string, unknown> }) => void} [handlers.onInundationSelect]
 * @param {(p: { lngLat: import('mapbox-gl').LngLat; kind: 'urbanFlash'; properties: Record<string, unknown> }) => void} [handlers.onUrbanFlashSelect]
 */
export function useHMEDFloodHubOverlays(
    mapRef,
    mapReady,
    selectedLayer,
    toggles,
    hexLayersGeneration,
    handlers = {}
) {
    const togglesRef = useRef(toggles);
    const selectedLayerRef = useRef(selectedLayer);
    const handlersRef = useRef(handlers);
    togglesRef.current = toggles;
    selectedLayerRef.current = selectedLayer;
    handlersRef.current = handlers;
    const [isLoadingOverlays, setIsLoadingOverlays] = useState(false);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapReady || !isMapAlive(map)) {
            setIsLoadingOverlays(false);
            return;
        }

        if (selectedLayer !== FLOOD_HUB_LAYER_ID) {
            removeFloodHubPrdOverlays(map);
            setIsLoadingOverlays(false);
            return;
        }

        setIsLoadingOverlays(true);

        const beforeId = resolveOverlayBeforeId(map);
        removeFloodHubPrdOverlays(map);

        const cfg = getFloodHubTileConfig();
        addFloodHubPrdSources(map, toggles, cfg, beforeId);
        addFloodHubPrdOverlayLayers(map, toggles, cfg, beforeId);

        syncFloodHubGaugeHexVisibility(
            map,
            toggles.gauges,
            toggles.riverineShowNormal !== false,
            toggles.riverineLowerConfidenceOnly === true
        );

        const onZoomEnd = createGaugeVisibilityZoomHandler(map, selectedLayerRef, togglesRef);
        map.on('zoomend', onZoomEnd);

        const interactions = createFloodHubOverlayInteractions(map, handlersRef);
        bindFloodHubOverlayInteractions(map, interactions);

        setIsLoadingOverlays(false);

        return () => {
            try {
                map.off('zoomend', onZoomEnd);
            } catch {
                /* map or style destroyed */
            }
            unbindFloodHubOverlayInteractions(map, interactions);
            removeFloodHubPrdOverlays(map);
            setIsLoadingOverlays(false);
        };
    }, [mapRef, mapReady, selectedLayer, toggles, hexLayersGeneration]);

    return { isLoadingOverlays };
}
