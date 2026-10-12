/**
 * @fileoverview Active Weather Events (Beta) — Baron rainfall Tile (vector) + Grid (raster PNG).
 */

import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import 'mapbox-gl-style-switcher/styles.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

import { useIsMobile } from '../hooks/use-mobile';
import { useMapResize } from '../hooks/useMapResize';
import { useBaronRainfallGridMapLayers } from '../hooks/useBaronRainfallGridMapLayers';
import { useBaronRainfallGridHexInteractions } from '../hooks/useBaronRainfallGridHexInteractions';
import { MAP_CONTROLS_CSS, MAP_POPUP_CSS } from '../config/mapConfig';
import { BARON_RAINFALL_RASTER } from '../config/baronRainfallGridLayerConfig';
import { MapLoadingIndicator, MapErrorMessage } from './ui/map-components';
import { BaronRainfallGridLegend } from './BaronRainfallGridLegend';

/**
 * Apply raster (Grid) layer visibility. The vector Tile layers are zoom-banded,
 * so their visibility is driven by the map hook's `syncTileVisibility` instead.
 * @param {import('mapbox-gl').Map} map
 * @param {boolean} gridVisible
 */
function syncBaronGridVisibility(map, gridVisible) {
    const gridVis = gridVisible ? 'visible' : 'none';
    try {
        if (map.getLayer(BARON_RAINFALL_RASTER.mapLayerId)) {
            map.setLayoutProperty(BARON_RAINFALL_RASTER.mapLayerId, 'visibility', gridVis);
        }
    } catch {
        /* ignore */
    }
}

const ActiveWeatherEventsBetaTab = () => {
    const mapContainerRef = useRef(null);
    const [tileVisible, setTileVisible] = useState(true);
    const [gridVisible, setGridVisible] = useState(true);
    const tileEnabledRef = useRef(tileVisible);
    const prevGridVisibleRef = useRef(false);
    const isMobile = useIsMobile();

    const { mapRef, mapReady, isLoading, error, hexLayersGeneration, syncTileVisibility } =
        useBaronRainfallGridMapLayers(mapContainerRef, tileEnabledRef);

    useBaronRainfallGridHexInteractions(mapRef, mapReady, isMobile, hexLayersGeneration);
    useMapResize(mapRef, mapContainerRef);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapReady) return;
        tileEnabledRef.current = tileVisible;
        syncTileVisibility();
        syncBaronGridVisibility(map, gridVisible);

        // Grid raster tiles only exist at zoom 7; Mapbox can't "underzoom" them,
        // so they render nothing below that. When the user turns the Grid on while
        // zoomed out, ease in so there is something to see.
        const justEnabledGrid = gridVisible && !prevGridVisibleRef.current;
        prevGridVisibleRef.current = gridVisible;
        if (justEnabledGrid && map.getZoom() < BARON_RAINFALL_RASTER.minzoom) {
            map.easeTo({ zoom: BARON_RAINFALL_RASTER.minzoom, duration: 800 });
        }
    }, [mapRef, mapReady, tileVisible, gridVisible, hexLayersGeneration, syncTileVisibility]);

    return (
        <div className="absolute inset-0 w-full h-full">
            <style>{MAP_CONTROLS_CSS}{MAP_POPUP_CSS}</style>

            <div ref={mapContainerRef} className="w-full h-full" />

            {!error && (
                <BaronRainfallGridLegend
                    tileVisible={tileVisible}
                    setTileVisible={setTileVisible}
                    gridVisible={gridVisible}
                    setGridVisible={setGridVisible}
                    loading={isLoading}
                />
            )}

            {isLoading && (
                <MapLoadingIndicator
                    variant="overlay"
                    title="Loading map data"
                    message="Fetching Baron rainfall layers…"
                />
            )}
            {error && <MapErrorMessage message={error} />}
        </div>
    );
};

export default ActiveWeatherEventsBetaTab;
