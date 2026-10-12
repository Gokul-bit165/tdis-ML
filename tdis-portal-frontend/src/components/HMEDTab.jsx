/**
 * @fileoverview HMED (Hazard Monitoring & Event Detection) Tab Component
 * Thin wrapper: map container, useHMEDMapLayers, useHMEDHexInteractions, useMapResize, control/mobile panels, info modal.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import "mapbox-gl-style-switcher/styles.css";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;
import { useDraggable } from "../hooks/useDraggable";
import { useIsMobile } from "../hooks/use-mobile";
import { useMapResize } from "../hooks/useMapResize";
import { useHMEDMapLayers } from "../hooks/useHMEDMapLayers";
import { useHMEDHexInteractions } from "../hooks/useHMEDHexInteractions";
import { useHMEDFloodHubOverlays } from "../hooks/useHMEDFloodHubOverlays";
import { MAP_CONTROLS_CSS, MAP_POPUP_CSS } from "../config/mapConfig";
import { LAYER_CONFIG } from "../config/hmedLayerConfig";
import { MapLoadingIndicator, MapErrorMessage } from "./ui/map-components";
import { HMEDControlPanel } from "./hmed/HMEDControlPanel";
import { HMEDMobilePanel } from "./hmed/HMEDMobilePanel";
import { HMEDInfoModal } from "./hmed/HMEDInfoModal";
import { HMEDFloodHubPrdBanner } from "./hmed/HMEDFloodHubPrdBanner";
import { FloodHubPrdSidePanel } from "./hmed/FloodHubPrdSidePanel";
import { FloodHubPrdExtensionsWidget } from "./hmed/FloodHubPrdExtensionsWidget";
import { FLOOD_HUB_PRD_DEFAULT_TOGGLES } from "../data/floodHubPrdStaticData";
import { buildFloodHubGaugePanelModel } from "../utils/floodHubPrdUtils";
import PropTypes from "prop-types";

const HMEDTab = ({ onSelectedLayerChange }) => {
    const mapContainerRef = useRef(null);
    const [selectedLayer, setSelectedLayer] = useState("precipitation");
    const [selectedHours, setSelectedHours] = useState(3);
    const [showInfo, setShowInfo] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [isMobileExpanded, setIsMobileExpanded] = useState(false);
    const [floodPrdToggles, setFloodPrdToggles] = useState(() => ({ ...FLOOD_HUB_PRD_DEFAULT_TOGGLES }));
    const [floodPrdPanel, setFloodPrdPanel] = useState(null);

    const isMobile = useIsMobile();
    const controlDrag = useDraggable({ initialPosition: "bottom-right" });
    const floodExtensionsDrag = useDraggable({ initialPosition: "bottom-left" });

    useEffect(() => {
        onSelectedLayerChange?.(selectedLayer);
    }, [selectedLayer, onSelectedLayerChange]);

    const patchFloodPrdToggles = useCallback((patch) => {
        setFloodPrdToggles((t) => ({ ...t, ...patch }));
    }, []);

    const onFloodHubGaugeOpen = useCallback((payload) => {
        const { fields, staticDetail } = buildFloodHubGaugePanelModel(payload.properties, payload.lngLat);
        setFloodPrdPanel({
            kind: "gauge",
            lngLat: payload.lngLat,
            level: payload.level,
            fields,
            staticDetail,
        });
    }, []);

    const floodOverlayHandlers = useMemo(
        () => ({
            onEventSelect: (p) => setFloodPrdPanel({ kind: "event", lngLat: p.lngLat, properties: p.properties }),
            onInundationSelect: (p) =>
                setFloodPrdPanel({
                    kind: "inundation",
                    variant: p.variant,
                    lngLat: p.lngLat,
                    properties: p.properties,
                }),
            onUrbanFlashSelect: (p) =>
                setFloodPrdPanel({
                    kind: "urbanFlash",
                    lngLat: p.lngLat,
                    properties: p.properties,
                }),
        }),
        []
    );

    const { mapRef, mapReady, isLoading, loadingMessage, error, hexLayersGeneration } = useHMEDMapLayers(
        mapContainerRef,
        selectedLayer,
        selectedHours
    );
    useHMEDHexInteractions(
        mapRef,
        mapReady,
        selectedHours,
        selectedLayer,
        isMobile,
        hexLayersGeneration,
        onFloodHubGaugeOpen
    );
    const { isLoadingOverlays } = useHMEDFloodHubOverlays(
        mapRef,
        mapReady,
        selectedLayer,
        floodPrdToggles,
        hexLayersGeneration,
        floodOverlayHandlers
    );
    useMapResize(mapRef, mapContainerRef);

    const currentLayer = LAYER_CONFIG[selectedLayer] || LAYER_CONFIG.precipitation;
    const showMapLoading = isLoading || isLoadingOverlays;
    const mapLoadingTitle = isLoading
        ? "Loading map data"
        : "Loading Flood Hub overlays";
    const mapLoadingMessage = isLoading
        ? (loadingMessage || "Please wait…")
        : "Updating overlay layers…";

    useEffect(() => {
        if (selectedLayer !== "google_flood_hub") setFloodPrdPanel(null);
    }, [selectedLayer]);

    return (
        <div
            className="absolute inset-0 z-0 w-full h-full flex flex-col relative"
            style={{ pointerEvents: "auto", isolation: "isolate" }}
        >
            <style>{MAP_CONTROLS_CSS}{MAP_POPUP_CSS}</style>
            {selectedLayer === "google_flood_hub" ? <HMEDFloodHubPrdBanner visible /> : null}
            <div
                ref={mapContainerRef}
                className="flex-1 min-h-0 w-full"
                style={{ position: "relative", zIndex: 0, pointerEvents: "auto" }}
            />

            {isMobile ? (
                <HMEDMobilePanel
                    isExpanded={isMobileExpanded}
                    onOpen={() => setIsMobileExpanded(true)}
                    onClose={() => setIsMobileExpanded(false)}
                    onShowInfo={setShowInfo}
                    currentLayer={currentLayer}
                    selectedLayer={selectedLayer}
                    setSelectedLayer={setSelectedLayer}
                    selectedHours={selectedHours}
                    setSelectedHours={setSelectedHours}
                    floodPrdToggles={floodPrdToggles}
                    patchFloodPrdToggles={patchFloodPrdToggles}
                    isLoading={showMapLoading}
                    loadingMessage={mapLoadingMessage}
                />
            ) : (
                <HMEDControlPanel
                    controlDrag={controlDrag}
                    currentLayer={currentLayer}
                    selectedLayer={selectedLayer}
                    setSelectedLayer={setSelectedLayer}
                    selectedHours={selectedHours}
                    setSelectedHours={setSelectedHours}
                    onToggleInfo={() => setShowInfo((prev) => !prev)}
                    isMinimized={isMinimized}
                    setIsMinimized={setIsMinimized}
                    floodPrdToggles={floodPrdToggles}
                    patchFloodPrdToggles={patchFloodPrdToggles}
                    isLoading={showMapLoading}
                    loadingMessage={mapLoadingMessage}
                />
            )}

            <FloodHubPrdExtensionsWidget
                visible={selectedLayer === "google_flood_hub"}
                isMobile={isMobile}
                controlDrag={floodExtensionsDrag}
                toggles={floodPrdToggles}
                patchFloodPrdToggles={patchFloodPrdToggles}
            />

            <HMEDInfoModal show={showInfo} onClose={() => setShowInfo(false)} currentLayer={currentLayer} />

            <FloodHubPrdSidePanel selection={floodPrdPanel} onClose={() => setFloodPrdPanel(null)} isMobile={isMobile} />

            {showMapLoading && (
                <MapLoadingIndicator
                    variant="overlay"
                    title={mapLoadingTitle}
                    message={mapLoadingMessage}
                />
            )}
            {error && <MapErrorMessage message={error} />}
        </div>
    );
};

HMEDTab.propTypes = {
    onSelectedLayerChange: PropTypes.func,
};

export default HMEDTab;
