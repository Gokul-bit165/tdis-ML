/**
 * @fileoverview Custom hook for initializing and managing Mapbox GL maps.
 * Centralizes map creation, control setup, and style change handling.
 */

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { addStandardControls, waitForStyleLoad } from "../utils/mapUtils";
import { createLogger } from "../utils/logger";
import {
    DEFAULT_ZOOM,
    TEXAS_CENTER,
    TEXAS_MIN_ZOOM,
} from "../config/mapConfig";

// Set Mapbox token from environment variables
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

const MAP_STYLE_LOAD_EVENT = "style.load";

/**
 * Default map configuration options (Texas-focused guardrails)
 */
const DEFAULT_OPTIONS = {
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
    touchPitch: true
};

/**
 * Custom hook for creating and managing a Mapbox GL map instance
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.componentName - Name for logging (e.g., 'Map', 'HMED', 'OSA')
 * @param {Function} options.onMapLoad - Callback when map is ready (receives map instance)
 * @param {Function} options.loadLayers - Function to load custom layers (called on initial load and style changes)
 * @param {Object} options.mapOptions - Override default map options
 * @returns {Object} { mapContainerRef, mapRef, isLoading, error, setError }
 */
export const useMapboxMap = ({
    componentName = 'Map',
    onMapLoad,
    loadLayers,
    mapOptions = {}
} = {}) => {
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const initialLoadCompleteRef = useRef(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    
    const logger = createLogger(`[${componentName}]`);

    // Memoize loadLayers callback
    const loadLayersRef = useRef(loadLayers);
    loadLayersRef.current = loadLayers;

    useEffect(() => {
        // Ensure Mapbox access token is available
        if (!mapboxgl.accessToken) {
            logger.error('Mapbox access token is not set');
            setError('Mapbox access token is not configured');
            return;
        }

        // Ensure container is available
        if (!mapContainerRef.current) {
            logger.error('Map container ref is not available');
            return;
        }

        // Create new map instance with merged options
        const mergedOptions = {
            ...DEFAULT_OPTIONS,
            ...mapOptions,
            container: mapContainerRef.current
        };

        logger.debug('Initializing map with options:', mergedOptions);
        
        mapRef.current = new mapboxgl.Map(mergedOptions);
        const map = mapRef.current;

        // Add standard controls
        addStandardControls(map);

        // Internal layer loading wrapper
        const executeLoadLayers = async () => {
            logger.debug('Loading layers...');
            setIsLoading(true);
            setError(null);

            try {
                // Wait for style to be loaded
                const styleReady = await waitForStyleLoad(map);
                if (!styleReady) {
                    logger.error('Style load timeout');
                    setError('Map style failed to load');
                    return;
                }

                // Call the provided loadLayers function
                if (loadLayersRef.current) {
                    await loadLayersRef.current(map);
                }

                logger.debug('Layers loaded successfully');
            } catch (err) {
                logger.error('Error loading layers:', err);
                setError('Failed to load map data. Please refresh the page.');
            } finally {
                setIsLoading(false);
            }
        };

        // Handle style changes (when user switches map styles)
        const handleStyleChange = async () => {
            logger.debug('Style change detected, initialLoadComplete:', initialLoadCompleteRef.current);
            
            // Skip if initial load not complete
            if (!initialLoadCompleteRef.current) {
                logger.debug('Skipping style change handler - initial load not complete');
                return;
            }

            logger.debug('Reloading layers after style change...');
            
            // Wait for style to be loaded
            const styleLoaded = await waitForStyleLoad(map);
            if (!styleLoaded) {
                logger.error('Style failed to load within timeout');
                return;
            }

            // Reload layers
            try {
                if (loadLayersRef.current) {
                    await loadLayersRef.current(map);
                }
                logger.debug('Successfully reloaded layers after style change');
            } catch (err) {
                logger.error('Error reloading layers after style change:', err);
            }
        };

        // Add persistent listener for style changes
        map.on(MAP_STYLE_LOAD_EVENT, handleStyleChange);

        const finishInitialLoad = () => {
            initialLoadCompleteRef.current = true;
            if (onMapLoad) onMapLoad(map);
        };

        const runInitialLoad = () => {
            executeLoadLayers().then(finishInitialLoad);
        };

        const runInitialLoadWhenStyleReady = () => {
            if (map.isStyleLoaded()) {
                runInitialLoad();
            } else {
                map.once(MAP_STYLE_LOAD_EVENT, runInitialLoad);
            }
        };

        const scheduleInitialLoadAfterMapLoad = () => {
            setTimeout(runInitialLoadWhenStyleReady, 100);
        };

        // Initial load
        if (map.loaded() && map.isStyleLoaded()) {
            runInitialLoad();
        } else {
            map.once("load", scheduleInitialLoadAfterMapLoad);
        }

        // Cleanup function
        return () => {
            logger.debug('Cleaning up map instance');
            if (map) {
                map.off(MAP_STYLE_LOAD_EVENT, handleStyleChange);
                map.remove();
            }
            mapRef.current = null;
            initialLoadCompleteRef.current = false;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: avoid remounting map/geometry layers
    }, []); // Empty deps - only run once on mount

    return {
        mapContainerRef,
        mapRef,
        isLoading,
        error,
        setError,
        setIsLoading
    };
};

export default useMapboxMap;

