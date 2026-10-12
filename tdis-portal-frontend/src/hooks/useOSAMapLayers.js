/**
 * @fileoverview Hook for OSA map initialization, layer management, and power-outage popups.
 * Encapsulates map creation, ensureLayerForConfig, updateLayerVisibility, and expression helpers.
 */

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { createMapInstance, addStandardControls, waitForStyleLoad, loadCountyBoundaries, removeLayersAndSources, createStyleChangeHandler, scheduleMapLayersLoad, isMapAlive } from '../utils/mapUtils';
import { LAYER_CONFIG, getLayerIdentifiers } from '../config/osaLayerConfig';
import { hasGeometryType, getOptimalAnchor } from '../utils/osaUtils';
import { setHazardLayersVisibility } from '../utils/hazardMapUtils';
import { TILE_SERVER_BASE_URL } from '../config/mapConfig';
import { trackMapInteraction } from '../utils/googleAnalytics.js';

const TRANSPARENT_RGBA = 'rgba(0, 0, 0, 0)';

const formatPopupValue = (val) =>
    val === null || Number.isNaN(Number(val)) ? 'N/A' : val.toLocaleString();

const formatPopupDate = (dateStr) => {
    if (!dateStr || dateStr === 'null' || dateStr === 'undefined') return 'N/A';
    try {
        const date = new Date(dateStr);
        return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleString();
    } catch {
        return 'N/A';
    }
};

const getIntensityLevel = (val) => {
    if (val === null || Number.isNaN(Number(val))) return 'N/A';
    if (val === 0) return 'None';
    if (val >= 10000) return 'Critical';
    if (val >= 1000) return 'High';
    if (val >= 100) return 'Medium';
    return 'Low';
};

const getIntensityColor = (val) => {
    if (val === null || Number.isNaN(Number(val))) return 'text-gray-500';
    if (val === 0) return 'text-gray-400';
    if (val >= 10000) return 'text-red-600';
    if (val >= 1000) return 'text-orange-600';
    if (val >= 100) return 'text-orange-400';
    return 'text-yellow-500';
};

const getOutageValue = (props, propertyName) =>
    props[propertyName] !== undefined && props[propertyName] !== null ? Number(props[propertyName]) : null;

const raisePopupZIndex = () => {
    const el = document.querySelector('.osa-popup');
    if (el) el.style.zIndex = '9999';
    const content = el?.querySelector('.mapboxgl-popup-content');
    if (content) content.style.zIndex = '9999';
};

const createZipcodeRow = (props) => (props.zipcode ? `
    <div class="flex items-center justify-between p-2 rounded-lg bg-blue-50 border border-blue-200">
        <span class="text-xs font-semibold text-gray-700">Zipcode:</span>
        <span class="text-sm font-bold text-gray-800">${props.zipcode}</span>
    </div>
` : '');

const createFetchedAtRow = (props) => (props.fetched_at ? `
    <div class="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-200">
        <span class="text-xs font-semibold text-gray-700">Fetched At:</span>
        <span class="text-xs text-gray-600">${formatPopupDate(props.fetched_at)}</span>
    </div>
` : '');

const createOutageDetailRows = (props) => `
    <div class="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-200">
        <span class="text-xs font-semibold text-gray-700">Cause:</span>
        <span class="text-xs text-gray-600">${props.OutageCause && props.OutageCause !== 'null' ? props.OutageCause : 'Unknown'}</span>
    </div>
    ${props.DateTimeRecorded ? `
        <div class="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-200">
            <span class="text-xs font-semibold text-gray-700">Recorded:</span>
            <span class="text-xs text-gray-600">${formatPopupDate(props.DateTimeRecorded)}</span>
        </div>
    ` : ''}
    <div class="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-200">
        <span class="text-xs font-semibold text-gray-700">Est. Restoration:</span>
        <span class="text-xs text-gray-600">${props.EstimatedRestoration && props.EstimatedRestoration !== 'null' ? formatPopupDate(props.EstimatedRestoration) : 'Not reported'}</span>
    </div>
`;

const createOutagePopupHTML = ({ props, outageValue, layerConfig, isZipLayer }) => `
    <div class="p-4 min-w-[280px]">
        <div class="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200">
            <div class="w-2 h-2 rounded-full" style="background-color: ${layerConfig.color}"></div>
            <p class="font-bold text-sm text-[#324755]">${layerConfig.name} Details</p>
        </div>
        <div class="space-y-2.5">
            ${isZipLayer ? createZipcodeRow(props) : ''}
            <div class="flex items-center justify-between p-2 rounded-lg bg-orange-50 border border-orange-200">
                <span class="text-xs font-semibold text-gray-700">Customers Out:</span>
                <span class="text-sm font-bold ${getIntensityColor(outageValue)}">${formatPopupValue(outageValue)}</span>
            </div>
            <div class="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-200">
                <span class="text-xs font-semibold text-gray-700">Severity:</span>
                <span class="text-xs font-medium ${getIntensityColor(outageValue)}">${getIntensityLevel(outageValue)}</span>
            </div>
            ${isZipLayer ? createFetchedAtRow(props) : createOutageDetailRows(props)}
        </div>
    </div>
`;

/**
 * @param {React.RefObject<HTMLDivElement>} mapContainerRef
 * @param {string} selectedLayer
 * @param {boolean} isMobile
 * @returns {{ mapRef: React.RefObject, mapReady: boolean, isLoading: boolean, error: string | null, setError: Function, updateLayerVisibility: (map: mapboxgl.Map, activeLayerId: string) => void }}
 */
export function useOSAMapLayers(mapContainerRef, selectedLayer, isMobile) {
    const mapRef = useRef(null);
    const sourceLayerMetaRef = useRef({});
    const interactionLayerRef = useRef(new Set());
    const initialLoadCompleteRef = useRef(false);
    const [mapReady, setMapReady] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    /** After first mapReady sync, layer swaps may show the loading overlay. */
    const layerSwapReadyRef = useRef(false);

    const getCircleRadiusExpression = (layerConfig) => {
        const propertyName = layerConfig.propertyName;
        return [
            'case',
            ['has', propertyName],
            [
                'case',
                ['<=', ['to-number', ['get', propertyName]], 50], 3,
                ['<=', ['to-number', ['get', propertyName]], 100], 4,
                ['<=', ['to-number', ['get', propertyName]], 250], 5,
                ['<=', ['to-number', ['get', propertyName]], 500], 6,
                ['<=', ['to-number', ['get', propertyName]], 1000], 7,
                ['<=', ['to-number', ['get', propertyName]], 1500], 8,
                ['<=', ['to-number', ['get', propertyName]], 2000], 9,
                ['<=', ['to-number', ['get', propertyName]], 3000], 10,
                ['>=', ['to-number', ['get', propertyName]], 3001], 12,
                2
            ],
            2
        ];
    };

    const getZipRadiusExpression = (propertyName = 'total_customers_out') => [
        'case',
        ['has', propertyName],
        [
            'case',
            ['<=', ['to-number', ['get', propertyName]], 50], 3,
            ['<=', ['to-number', ['get', propertyName]], 100], 4,
            ['<=', ['to-number', ['get', propertyName]], 250], 5,
            ['<=', ['to-number', ['get', propertyName]], 500], 6,
            ['<=', ['to-number', ['get', propertyName]], 1000], 7,
            ['<=', ['to-number', ['get', propertyName]], 1500], 8,
            ['<=', ['to-number', ['get', propertyName]], 2000], 9,
            ['<=', ['to-number', ['get', propertyName]], 3000], 10,
            ['>=', ['to-number', ['get', propertyName]], 3001], 12,
            2
        ],
        2
    ];

    const getColorExpression = (layerConfig) => {
        const propertyName = layerConfig.propertyName;
        return [
            'case',
            ['has', propertyName],
            [
                'case',
                ['all', ['>=', ['to-number', ['get', propertyName]], 1], ['<=', ['to-number', ['get', propertyName]], 50]], '#4A90D9',
                ['all', ['>=', ['to-number', ['get', propertyName]], 51], ['<=', ['to-number', ['get', propertyName]], 100]], '#5BC0DE',
                ['all', ['>=', ['to-number', ['get', propertyName]], 101], ['<=', ['to-number', ['get', propertyName]], 250]], '#7FD4A6',
                ['all', ['>=', ['to-number', ['get', propertyName]], 251], ['<=', ['to-number', ['get', propertyName]], 500]], '#5CB85C',
                ['all', ['>=', ['to-number', ['get', propertyName]], 501], ['<=', ['to-number', ['get', propertyName]], 1000]], '#B8D935',
                ['all', ['>=', ['to-number', ['get', propertyName]], 1001], ['<=', ['to-number', ['get', propertyName]], 1500]], '#F0D735',
                ['all', ['>=', ['to-number', ['get', propertyName]], 1501], ['<=', ['to-number', ['get', propertyName]], 2000]], '#F5A623',
                ['all', ['>=', ['to-number', ['get', propertyName]], 2001], ['<=', ['to-number', ['get', propertyName]], 3000]], '#A67C52',
                ['>=', ['to-number', ['get', propertyName]], 3001], '#8B2E2E',
                TRANSPARENT_RGBA
            ],
            TRANSPARENT_RGBA
        ];
    };

    const waitForSourceLoad = (map, sourceId) => {
        return new Promise((resolve) => {
            if (!map.getSource(sourceId)) {
                setTimeout(() => waitForSourceLoad(map, sourceId).then(resolve), 100);
                return;
            }
            try {
                if (map.isSourceLoaded?.(sourceId)) {
                    resolve();
                    return;
                }
            } catch { /* ignore */ }
            const onSourceData = (e) => {
                if (e.sourceId === sourceId && e.isSourceLoaded) {
                    map.off('sourcedata', onSourceData);
                    resolve();
                }
            };
            map.on('sourcedata', onSourceData);
            setTimeout(() => {
                map.off('sourcedata', onSourceData);
                resolve();
            }, 5000);
        });
    };

    const detectSourceLayerMeta = async (map, layerConfig, sourceId) => {
        if (sourceLayerMetaRef.current[layerConfig.id]) {
            return sourceLayerMetaRef.current[layerConfig.id];
        }
        await waitForSourceLoad(map, sourceId);
        const candidates = [];
        if (layerConfig.sourceLayerName) {
            candidates.push(layerConfig.sourceLayerName);
            const parts = layerConfig.sourceLayerName.split('.');
            if (parts.length > 1) candidates.push(parts[parts.length - 1]);
        }
        const geometryTypes = new Set();
        let detectedLayerName = candidates[0];
        for (const candidate of candidates) {
            try {
                const features = map.querySourceFeatures(sourceId, { sourceLayer: candidate });
                if (features.length > 0) {
                    detectedLayerName = candidate;
                    features.forEach((f) => {
                        if (f.geometry?.type) geometryTypes.add(f.geometry.type);
                    });
                    break;
                }
            } catch { /* ignore */ }
        }
        const meta = { sourceLayerName: detectedLayerName, geometryTypes: Array.from(geometryTypes) };
        sourceLayerMetaRef.current[layerConfig.id] = meta;
        return meta;
    };

    const createZipPopupHTML = (props, outageValue, layerConfig) => {
        return `
            <div class="p-4 min-w-[280px]">
                <div class="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200">
                    <div class="w-2 h-2 rounded-full" style="background-color: ${layerConfig.color}"></div>
                    <p class="font-bold text-sm text-[#324755]">${layerConfig.name} Details</p>
                </div>
                <div class="space-y-2.5">
                    ${props.zipcode ? `
                        <div class="flex items-center justify-between p-2 rounded-lg bg-blue-50 border border-blue-200">
                            <span class="text-xs font-semibold text-gray-700">ZIP Code:</span>
                            <span class="text-sm font-bold text-gray-800">${props.zipcode}</span>
                        </div>
                    ` : ''}
                    <div class="flex items-center justify-between p-2 rounded-lg bg-orange-50 border border-orange-200">
                        <span class="text-xs font-semibold text-gray-700">Customers Out:</span>
                        <span class="text-sm font-bold text-[#dc2626]">${formatPopupValue(outageValue)}</span>
                    </div>
                    ${props.fetched_at ? `
                        <div class="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-200">
                            <span class="text-xs font-semibold text-gray-700">Timestamp:</span>
                            <span class="text-xs text-gray-600">${formatPopupDate(props.fetched_at)}</span>
                        </div>
                    ` : ''}
                </div>
            </div>`;
    };

    const addInteractions = (map, layerId, layerConfig) => {
        if (interactionLayerRef.current.has(layerId)) return;
        interactionLayerRef.current.add(layerId);
        map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
        map.on('click', layerId, (e) => {
            trackMapInteraction({
                action: 'outage_click',
                tab: 'osa',
                layer_name: layerConfig.id,
            });
            const props = e.features[0]?.properties || {};
            const outageValue = getOutageValue(props, layerConfig.propertyName);
            const popup = new mapboxgl.Popup({
                closeButton: true,
                closeOnClick: true,
                className: 'osa-popup',
                anchor: getOptimalAnchor(e.lngLat, map, { isMobile }),
                offset: 10,
                maxWidth: isMobile ? '90vw' : '400px'
            }).setLngLat(e.lngLat).setHTML(createOutagePopupHTML({
                props,
                outageValue,
                layerConfig,
                isZipLayer: layerConfig.id === 'power_outage_zip'
            })).addTo(map);
            popup.on('open', raisePopupZIndex);
        });
    };

    const ensureMapboxStreetsLayer = async (map, layerConfig, sourceId) => {
        try {
            if (!map.getSource(sourceId)) {
                map.addSource(sourceId, {
                    type: 'vector',
                    url: layerConfig.sourceUrl,
                    bounds: [-106.65, 25.84, -93.51, 36.5]
                });
            }
            await waitForSourceLoad(map, sourceId);
            if (layerConfig.mapboxLayers && Array.isArray(layerConfig.mapboxLayers)) {
                for (const layerDef of layerConfig.mapboxLayers) {
                    if (!map.getLayer(layerDef.id)) {
                        try {
                            map.addLayer({
                                id: layerDef.id,
                                source: sourceId,
                                'source-layer': layerDef.sourceLayer,
                                type: layerDef.type,
                                paint: layerDef.paint,
                                layout: { visibility: 'visible' },
                                minzoom: 0,
                                maxzoom: 22
                            });
                            interactionLayerRef.current.add(layerDef.id);
                        } catch (err) {
                            console.error('Error adding layer', layerDef.id, err);
                        }
                    }
                }
            }
        } catch (err) {
            console.error('ensureMapboxStreetsLayer error:', err);
        }
    };

    const addZipInteractions = (map, layerId, layerConfig, propertyName) => {
        map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
        map.on('click', layerId, (e) => {
            trackMapInteraction({
                action: 'outage_click',
                tab: 'osa',
                layer_name: layerConfig.id,
            });
            const props = e.features[0]?.properties || {};
            const outageValue = getOutageValue(props, propertyName);
            const popup = new mapboxgl.Popup({
                closeButton: true,
                closeOnClick: true,
                className: 'osa-popup',
                anchor: getOptimalAnchor(e.lngLat, map, { isMobile }),
                offset: 10,
                maxWidth: isMobile ? '90vw' : '400px'
            }).setLngLat(e.lngLat).setHTML(createZipPopupHTML(props, outageValue, layerConfig)).addTo(map);
            popup.on('open', () => {
                const el = document.querySelector('.osa-popup');
                if (el) el.style.zIndex = '9999';
            });
        });
    };

    const ensureZipLayer = async (map, layerConfig, sourceId, tileUrl) => {
        if (!map.getSource(sourceId)) {
            map.addSource(sourceId, { type: 'vector', tiles: [tileUrl], minzoom: 0, maxzoom: 22 });
        }
        await waitForSourceLoad(map, sourceId);
        const { sourceLayerName } = await detectSourceLayerMeta(map, layerConfig, sourceId);
        const propertyName = layerConfig.propertyName || 'total_customers_out';
        const zipColorExpression = getColorExpression(layerConfig);
        const zipRadiusExpression = getZipRadiusExpression(propertyName);
        const centroidLayerId = `${layerConfig.id}-centroid`;
        if (!map.getLayer(centroidLayerId)) {
            map.addLayer({
                id: centroidLayerId,
                type: 'circle',
                source: sourceId,
                'source-layer': sourceLayerName,
                paint: {
                    'circle-color': zipColorExpression,
                    'circle-radius': [
                        'interpolate', ['linear'], ['zoom'],
                        5, ['case', ['<=', ['to-number', ['get', propertyName]], 50], 2, ['<=', ['to-number', ['get', propertyName]], 250], 3, ['<=', ['to-number', ['get', propertyName]], 1000], 4, ['<=', ['to-number', ['get', propertyName]], 3000], 6, 8],
                        10, zipRadiusExpression,
                        15, zipRadiusExpression
                    ],
                    'circle-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.7, 10, 0.8],
                    'circle-stroke-width': ['case', ['has', propertyName], ['case', ['<=', ['to-number', ['get', propertyName]], 50], 1.5, 1], 1],
                    'circle-stroke-color': ['case', ['has', propertyName], ['case', ['<=', ['to-number', ['get', propertyName]], 50], '#3A7ABD', '#ffffff'], '#ffffff'],
                    'circle-stroke-opacity': 0.8
                },
                layout: { visibility: 'visible' },
                minzoom: 0,
                maxzoom: 22
            });
            addZipInteractions(map, centroidLayerId, layerConfig, propertyName);
        }
    };

    const ensureLayerForConfig = async (map, layerConfig) => {
        const isZipLayer = layerConfig.id === 'power_outage_zip';
        const isMapboxSource = layerConfig.sourceType === 'mapbox';
        const { sourceId, fillLayerId, lineLayerId, circleLayerId } = getLayerIdentifiers(layerConfig);
        const tilePath = layerConfig.sourceLayerName;
        const tileUrl = `${TILE_SERVER_BASE_URL}/${tilePath}/{z}/{x}/{y}.pbf`;

        if (isMapboxSource) {
            await ensureMapboxStreetsLayer(map, layerConfig, sourceId);
            return;
        }
        if (layerConfig.sourceType === 'hazards') return;
        if (isZipLayer) {
            await ensureZipLayer(map, layerConfig, sourceId, tileUrl);
            return;
        }

        if (!map.getSource(sourceId)) {
            map.addSource(sourceId, { type: 'vector', tiles: [tileUrl], minzoom: 0, maxzoom: 22 });
        }
        const { sourceLayerName, geometryTypes } = await detectSourceLayerMeta(map, layerConfig, sourceId);
        const colorExpression = getColorExpression(layerConfig);

        if (!map.getLayer(fillLayerId) && hasGeometryType(geometryTypes, 'polygon')) {
            map.addLayer({
                id: fillLayerId,
                source: sourceId,
                'source-layer': sourceLayerName,
                type: 'fill',
                paint: { 'fill-color': colorExpression, 'fill-opacity': 0.75, 'fill-outline-color': TRANSPARENT_RGBA }
            });
            addInteractions(map, fillLayerId, layerConfig);
        }
        if (!map.getLayer(lineLayerId) && hasGeometryType(geometryTypes, 'line')) {
            map.addLayer({
                id: lineLayerId,
                source: sourceId,
                'source-layer': sourceLayerName,
                type: 'line',
                paint: {
                    'line-color': colorExpression,
                    'line-opacity': 0.9,
                    'line-width': ['interpolate', ['linear'], ['zoom'], 5, 2, 10, 4, 15, 6, 18, 8]
                }
            });
            addInteractions(map, lineLayerId, layerConfig);
        }
        if (!map.getLayer(circleLayerId) && hasGeometryType(geometryTypes, 'point')) {
            map.addLayer({
                id: circleLayerId,
                source: sourceId,
                'source-layer': sourceLayerName,
                type: 'circle',
                paint: {
                    'circle-color': colorExpression,
                    'circle-opacity': 0.8,
                    'circle-radius': getCircleRadiusExpression(layerConfig),
                    'circle-stroke-width': 1,
                    'circle-stroke-color': '#ffffff',
                    'circle-stroke-opacity': 0.8
                }
            });
            addInteractions(map, circleLayerId, layerConfig);
        }
    };

    const updateLayerVisibility = (map, activeLayerId) => {
        Object.values(LAYER_CONFIG).forEach((layerConfig) => {
            const visibility = layerConfig.id === activeLayerId ? 'visible' : 'none';
            const { fillLayerId, lineLayerId, circleLayerId } = getLayerIdentifiers(layerConfig);
            [fillLayerId, lineLayerId, circleLayerId].forEach((layerId) => {
                if (map.getLayer(layerId)) map.setLayoutProperty(layerId, 'visibility', visibility);
            });
            if (layerConfig.id === 'power_outage_zip') {
                const centroidLayerId = `${layerConfig.id}-centroid`;
                if (map.getLayer(centroidLayerId)) map.setLayoutProperty(centroidLayerId, 'visibility', visibility);
            }
            if (layerConfig.sourceType === 'mapbox' && layerConfig.mapboxLayers) {
                layerConfig.mapboxLayers.forEach((layerDef) => {
                    if (map.getLayer(layerDef.id)) map.setLayoutProperty(layerDef.id, 'visibility', visibility);
                });
            }
            if (layerConfig.sourceType === 'hazards') {
                setHazardLayersVisibility(map, layerConfig.id === activeLayerId);
            }
        });
    };

    // Map init effect
    useEffect(() => {
        if (!mapContainerRef?.current) return;
        if (!mapboxgl.accessToken) {
            setError('Mapbox access token is not configured');
            return;
        }
        mapRef.current = createMapInstance(mapContainerRef.current);
        const map = mapRef.current;
        addStandardControls(map);

        const loadLayers = async () => {
            const styleReady = await waitForStyleLoad(map);
            if (!styleReady || !isMapAlive(map)) {
                setIsLoading(false);
                return;
            }
            setIsLoading(true);
            setError(null);
            try {
                removeLayersAndSources(map, ['outline-layer-line', 'county-layer', 'zip-layer', 'utility-centroids-layer'], ['outline-layer', 'county-layer', 'zip-layer', 'utility-centroids']);
                await loadCountyBoundaries(map);
                if (!isMapAlive(map)) return;
                await ensureLayerForConfig(map, LAYER_CONFIG.power_outage);
                if (!isMapAlive(map)) return;
                updateLayerVisibility(map, selectedLayer);
                setMapReady(true);
            } catch (err) {
                console.error('[OSA] Error loading layers:', err);
                setError('Failed to load map data. Please refresh the page.');
            } finally {
                setIsLoading(false);
            }
        };

        const handleStyleChange = createStyleChangeHandler(map, loadLayers, {
            initialLoadCompleteRef,
            componentName: 'OSA'
        });

        map.on('style.load', handleStyleChange);
        scheduleMapLayersLoad(map, loadLayers, initialLoadCompleteRef);

        return () => {
            map.off('style.load', handleStyleChange);
            map.remove();
            mapRef.current = null;
            layerSwapReadyRef.current = false;
            initialLoadCompleteRef.current = false;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: avoid remounting map/geometry layers
    }, []);

    // When mapReady and selectedLayer change: ensure layer and update visibility
    useEffect(() => {
        if (!mapReady || !mapRef.current) return;
        const map = mapRef.current;
        const layerConfig = LAYER_CONFIG[selectedLayer] || LAYER_CONFIG.power_outage;
        let cancelled = false;
        // First sync after initial loadLayers already ensured power_outage — don't re-arm overlay.
        const showOverlay = layerSwapReadyRef.current;
        (async () => {
            if (showOverlay) setIsLoading(true);
            try {
                await ensureLayerForConfig(map, layerConfig);
                if (cancelled || !isMapAlive(map) || mapRef.current !== map) return;
                updateLayerVisibility(map, selectedLayer);
            } catch (err) {
                console.error('[OSA] Error ensuring layer:', err);
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                    layerSwapReadyRef.current = true;
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: avoid remounting map/geometry layers
    }, [mapReady, selectedLayer]);

    // Update paint when selectedLayer changes
    useEffect(() => {
        if (!mapRef.current || !isMapAlive(mapRef.current)) return;
        const map = mapRef.current;
        const layerConfig = LAYER_CONFIG[selectedLayer] || LAYER_CONFIG.power_outage;
        const colorExpression = getColorExpression(layerConfig);
        const { fillLayerId, lineLayerId, circleLayerId } = getLayerIdentifiers(layerConfig);
        if (map.getLayer(fillLayerId)) map.setPaintProperty(fillLayerId, 'fill-color', colorExpression);
        if (map.getLayer(lineLayerId)) map.setPaintProperty(lineLayerId, 'line-color', colorExpression);
        if (map.getLayer(circleLayerId)) {
            map.setPaintProperty(circleLayerId, 'circle-color', colorExpression);
            if (layerConfig.id === 'power_outage') {
                map.setPaintProperty(circleLayerId, 'circle-radius', getCircleRadiusExpression(layerConfig));
            }
        }
    }, [selectedLayer]);

    // Sync visibility when selectedLayer changes (e.g. from another effect in parent)
    useEffect(() => {
        if (!mapRef.current || !isMapAlive(mapRef.current)) return;
        updateLayerVisibility(mapRef.current, selectedLayer);
    }, [selectedLayer]);

    return { mapRef, mapReady, isLoading, error, setError, updateLayerVisibility };
}
