/**
 * @fileoverview Hook for Active Weather Events map: create map, load icons/event data, style-change handler, event/layer visibility.
 */

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { fetchEventCounts } from '../services/eventService';
import {
    loadMapIcons,
    loadEventData,
    updateEventLayerVisibility,
    updateLayerVisibility
} from '../services/mapService';
import {
    createMapInstance,
    addStandardControls,
    waitForStyleLoad,
    loadCountyBoundaries,
    createStyleChangeHandler,
    scheduleMapLayersLoad,
    isMapAlive
} from '../utils/mapUtils';
import {
    loadCriticalFacilityLayers,
    updateCriticalFacilityVisibility,
    bindCriticalFacilityInteractions,
} from '../utils/criticalFacilitiesMapLayers';
import { getDefaultCriticalFacilityVisibility } from '../config/criticalFacilitiesConfig';
import { mapLogger as logger } from '../utils/logger';

const MAP_STYLE_LOAD_EVENT = 'style.load';

/**
 * @param {React.RefObject} mapContainerRef
 * @param {Object} options
 * @param {string[]} options.selectedEvents
 * @param {Object} options.layerVisibility
 * @param {Function} options.setEventCounts
 * @param {Function} options.setIsEventCountsLoading
 * @param {Function} [options.onLatestEventDate]
 * @param {Function} [options.onMapReady]
 * @param {Record<string, boolean>} [options.facilityVisibility]
 * @returns {{ mapRef: React.RefObject, loadingStates: Object, error: string | null, setError: Function }}
 */
export function useWeatherEventsMap(mapContainerRef, options) {
    const {
        selectedEvents,
        layerVisibility,
        setEventCounts,
        setIsEventCountsLoading,
        onLatestEventDate,
        onMapReady,
        facilityVisibility,
    } = options;

    const mapRef = useRef(null);
    const initialLoadCompleteRef = useRef(false);
    const selectedEventsRef = useRef(selectedEvents);
    const layerVisibilityRef = useRef(layerVisibility);
    const facilityVisibilityRef = useRef(facilityVisibility || getDefaultCriticalFacilityVisibility());
    const facilityCleanupRef = useRef(null);

    const [loadingStates, setLoadingStates] = useState({
        events: false,
        geojson: false,
        eventCounts: false
    });
    const [error, setError] = useState(null);

    useEffect(() => {
        selectedEventsRef.current = selectedEvents;
        layerVisibilityRef.current = layerVisibility;
    }, [selectedEvents, layerVisibility]);

    useEffect(() => {
        if (facilityVisibility) {
            facilityVisibilityRef.current = facilityVisibility;
        }
    }, [facilityVisibility]);

    useEffect(() => {
        if (!mapContainerRef?.current || !mapboxgl.accessToken) {
            if (!mapboxgl.accessToken) setError('Mapbox access token is not configured');
            return;
        }

        mapRef.current = createMapInstance(mapContainerRef.current);
        const map = mapRef.current;
        addStandardControls(map);

        const loadIconsAndLayers = async () => {
            logger.debug('loadIconsAndLayers called');
            const styleReady = await waitForStyleLoad(map);
            if (!styleReady || !isMapAlive(map)) {
                logger.error('Style load timeout or map removed');
                return;
            }

            setLoadingStates((prev) => ({ ...prev, events: true }));
            setError(null);
            try {
                await loadMapIcons(map);
                if (!isMapAlive(map)) return;
                const { latestEventDate } = (await loadEventData(map)) || {};
                if (!isMapAlive(map)) return;
                if (onLatestEventDate) onLatestEventDate(latestEventDate ?? null);

                updateLayerVisibility(map, layerVisibilityRef.current);
                updateEventLayerVisibility(map, selectedEventsRef.current);
                if (onMapReady) onMapReady(map);
            } catch (e) {
                setError('Failed to load event data.');
                logger.error('Error loading events:', e);
            } finally {
                setLoadingStates((prev) => ({ ...prev, events: false }));
            }

            setLoadingStates((prev) => ({ ...prev, geojson: true }));
            try {
                await loadCountyBoundaries(map);
                if (!isMapAlive(map)) return;
            } catch (e) {
                setError('Failed to load map outlines.');
                logger.error('Error loading county boundaries:', e);
            } finally {
                setLoadingStates((prev) => ({ ...prev, geojson: false }));
            }

            try {
                if (!isMapAlive(map)) return;
                if (facilityCleanupRef.current) {
                    facilityCleanupRef.current();
                    facilityCleanupRef.current = null;
                }
                await loadCriticalFacilityLayers(map, facilityVisibilityRef.current);
                if (!isMapAlive(map)) return;
                facilityCleanupRef.current = bindCriticalFacilityInteractions(map);
            } catch (e) {
                // Facilities are optional overlays — do not block the base map.
                logger.error('Error loading critical facilities:', e);
            }
        };

        const handleStyleChange = createStyleChangeHandler(map, loadIconsAndLayers, {
            initialLoadCompleteRef,
            componentName: 'Map'
        });
        map.on(MAP_STYLE_LOAD_EVENT, handleStyleChange);

        scheduleMapLayersLoad(map, loadIconsAndLayers, initialLoadCompleteRef, {
            styleLoadEvent: MAP_STYLE_LOAD_EVENT,
        });

        fetchEventCounts(setEventCounts, setIsEventCountsLoading);

        return () => {
            if (facilityCleanupRef.current) {
                facilityCleanupRef.current();
                facilityCleanupRef.current = null;
            }
            map.off(MAP_STYLE_LOAD_EVENT, handleStyleChange);
            map.remove();
            mapRef.current = null;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: avoid remounting map/geometry layers
    }, []);

    useEffect(() => {
        if (!mapRef.current) return;
        updateEventLayerVisibility(mapRef.current, selectedEvents);
    }, [selectedEvents]);

    useEffect(() => {
        if (!mapRef.current) return;
        updateLayerVisibility(mapRef.current, layerVisibility);
    }, [layerVisibility]);

    useEffect(() => {
        if (!mapRef.current || !facilityVisibility) return;
        void updateCriticalFacilityVisibility(mapRef.current, facilityVisibility);
    }, [facilityVisibility]);

    return { mapRef, loadingStates, error, setError };
}
