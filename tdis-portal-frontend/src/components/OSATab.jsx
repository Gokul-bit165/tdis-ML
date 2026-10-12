/**
 * @fileoverview OSA (Operational Situational Awareness) Tab Component
 * Displays a clean Mapbox map with county boundaries and power outage data
 * with data-driven color coding for outage severity
 */

import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import "mapbox-gl-style-switcher/styles.css";
import { useDraggable } from "../hooks/useDraggable";
import { useIsMobile } from "../hooks/use-mobile";
import { useHazardLayers } from "../hooks/useHazardLayers";
import { useOSAMapLayers } from "../hooks/useOSAMapLayers";
import { useOSASummaryData } from "../hooks/useOSASummaryData";
import { useHazardMapClick } from "../hooks/useHazardMapClick";
import { useMapResize } from "../hooks/useMapResize";
// Import shared utilities
import { TILE_SERVER_BASE_URL, MAP_CONTROLS_CSS, MAP_POPUP_CSS } from "../config/mapConfig";
// Import reusable UI components
import { MapLoadingIndicator, MapErrorMessage } from "./ui/map-components";
import { OSABackToViewButton } from "./osa/OSABackToViewButton";
import { OSAInfoModal } from "./osa/OSAInfoModal";
import { OSAMobilePanel } from "./osa/OSAMobilePanel";
import { OSADesktopSummaryPanel } from "./osa/OSADesktopSummaryPanel";
import { OSAControlPanel } from "./osa/OSAControlPanel";
import { LAYER_CONFIG } from "../config/osaLayerConfig";

// Set Mapbox token from environment variables
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

const OSATab = () => {
    const mapContainerRef = useRef(null);
    const [showInfo, setShowInfo] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false); // Control panel minimize state
    const [isSummaryMinimized, setIsSummaryMinimized] = useState(false); // Summary panel minimize state
    const [selectedLayer, setSelectedLayer] = useState('power_outage'); // Default layer
    const [isMobileExpanded, setIsMobileExpanded] = useState(false); // Mobile FAB expanded state
    const [mobileActiveTab, setMobileActiveTab] = useState('summary'); // 'summary' | 'legend'
    
    // Mobile detection
    const isMobile = useIsMobile();
    
    // Drag functionality for panels
    const summaryDrag = useDraggable({ initialPosition: 'bottom-left' });
    const controlDrag = useDraggable({ initialPosition: 'bottom-right' });
    // Store map view before "Zoom to county" so user can return (Back to previous view)
    const [previousMapView, setPreviousMapView] = useState(null); // { center, zoom, bearing, pitch } | null

    // Get current layer configuration
    const currentLayer = LAYER_CONFIG[selectedLayer] || LAYER_CONFIG.power_outage;

    // Map and layer management (map init, ensure layers, visibility, power-outage popups)
    const { mapRef, mapReady, isLoading, error, updateLayerVisibility } = useOSAMapLayers(mapContainerRef, selectedLayer, isMobile);

    // Summary statistics data (county/zip/utility fetch, search, view mode)
    const {
        viewMode,
        setViewMode,
        handleViewModeChange,
        summaryStats,
        isLoadingData,
        searchQuery,
        setSearchQuery,
        handleSummaryItemClick
    } = useOSASummaryData(currentLayer, mapRef);

    // Hazard layers hook - only init when map is ready so style is loaded (avoids missed style.load)
    const hazardLayersActive = selectedLayer === 'road_closures' && mapReady;
    const hazardLayers = useHazardLayers(
        mapRef,
        hazardLayersActive,
        TILE_SERVER_BASE_URL
    );

    // Hazard layer map click: point popup and county popup with subtype breakdown
    useHazardMapClick(mapRef, hazardLayers.isInitialized, isMobile, setPreviousMapView);

    // Resize map when container size changes
    useMapResize(mapRef, mapContainerRef);

    // Clear "Back to previous view" when switching away from Road Weather Hazard Alerts layer
    useEffect(() => {
        if (selectedLayer !== 'road_closures') setPreviousMapView(null);
    }, [selectedLayer]);

    // Note: Mapbox vector tiles automatically fetch tiles when zooming/panning.
    // This is expected behavior - tiles are fetched based on the current viewport and zoom level.
    // The tile server is called automatically by Mapbox GL JS to load the appropriate tiles.
    // This cannot be disabled without breaking map functionality.

    // Update map layers when view mode changes
    useEffect(() => {
        if (!mapRef.current || !mapRef.current.loaded()) return;

        const map = mapRef.current;
        const aggregatedLayerId = 'aggregated-outages';
        
        // Remove existing aggregated layer and labels if they exist
        if (map.getLayer(`${aggregatedLayerId}-labels`)) {
            map.removeLayer(`${aggregatedLayerId}-labels`);
        }
        if (map.getLayer(aggregatedLayerId)) {
            map.removeLayer(aggregatedLayerId);
        }
        if (map.getSource(aggregatedLayerId)) {
            map.removeSource(aggregatedLayerId);
        }

        updateLayerVisibility(map, selectedLayer);

        // For aggregated views (county/zip/utility), we don't plot anything on the map
        // They are just for informational statistics
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: avoid remounting map/geometry layers
    }, [viewMode, selectedLayer]);

    // Listen for switch to all view event
    useEffect(() => {
        const handleSwitchToAll = () => {
            setViewMode('all');
            // Could add filtering logic here based on e.detail.filter
        };

        window.addEventListener('switchToAllView', handleSwitchToAll);
        return () => window.removeEventListener('switchToAllView', handleSwitchToAll);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: avoid remounting map/geometry layers
    }, []);

    return (
        <div className="absolute inset-0 w-full h-full relative" style={{ pointerEvents: 'auto' }}>
            <style>{MAP_CONTROLS_CSS}{MAP_POPUP_CSS}</style>
            <div
                ref={mapContainerRef}
                className="w-full h-full"
                style={{ position: 'relative', zIndex: 0, pointerEvents: 'auto' }}
            />

            {selectedLayer === 'road_closures' && previousMapView && mapRef.current && (
                <OSABackToViewButton
                    onBack={() => {
                        if (mapRef.current && previousMapView) {
                            mapRef.current.flyTo({
                                center: previousMapView.center,
                                zoom: previousMapView.zoom,
                                bearing: previousMapView.bearing ?? 0,
                                pitch: previousMapView.pitch ?? 0,
                                duration: 600
                            });
                            setPreviousMapView(null);
                        }
                    }}
                />
            )}

            {/* Panels - Responsive: FAB on mobile, dual panels on desktop */}
            {isMobile ? (
                <OSAMobilePanel
                    isExpanded={isMobileExpanded}
                    onOpen={() => setIsMobileExpanded(true)}
                    onClose={() => setIsMobileExpanded(false)}
                    onShowInfo={setShowInfo}
                    mobileActiveTab={mobileActiveTab}
                    setMobileActiveTab={setMobileActiveTab}
                    currentLayer={currentLayer}
                    selectedLayer={selectedLayer}
                    setSelectedLayer={setSelectedLayer}
                    viewMode={viewMode}
                    handleViewModeChange={handleViewModeChange}
                    setViewMode={setViewMode}
                    summaryStats={summaryStats}
                    isLoadingData={isLoadingData}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    handleSummaryItemClick={handleSummaryItemClick}
                    mapRef={mapRef}
                    isHazardLayerReady={hazardLayers.isInitialized}
                />
            ) : (
                <>
                    {currentLayer.showSummaryStats !== false && (
                        <OSADesktopSummaryPanel
                            summaryDrag={summaryDrag}
                            currentLayer={currentLayer}
                            viewMode={viewMode}
                            handleViewModeChange={handleViewModeChange}
                            summaryStats={summaryStats}
                            isLoadingData={isLoadingData}
                            searchQuery={searchQuery}
                            setSearchQuery={setSearchQuery}
                            handleSummaryItemClick={handleSummaryItemClick}
                            isSummaryMinimized={isSummaryMinimized}
                            setIsSummaryMinimized={setIsSummaryMinimized}
                        />
                    )}
                    <OSAControlPanel
                        controlDrag={controlDrag}
                        currentLayer={currentLayer}
                        selectedLayer={selectedLayer}
                        setSelectedLayer={setSelectedLayer}
                        setViewMode={setViewMode}
                        onShowInfo={setShowInfo}
                        isMinimized={isMinimized}
                        setIsMinimized={setIsMinimized}
                        mapRef={mapRef}
                        isHazardLayerReady={hazardLayers.isInitialized}
                        isLoading={isLoading}
                    />
                    </>
                )}

            <OSAInfoModal open={showInfo} onClose={() => setShowInfo(false)} selectedLayer={selectedLayer} />

            {/* Loading Indicator - using reusable component */}
            {isLoading && (
                <MapLoadingIndicator
                    variant="overlay"
                    title="Loading map data"
                    message="Fetching infrastructure layers…"
                />
            )}

            {/* Error Message - using reusable component */}
            {error && <MapErrorMessage message={error} />}
        </div>
    );
};

export default OSATab;
