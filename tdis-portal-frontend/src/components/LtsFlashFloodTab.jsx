/**
 * @fileoverview LTS Flash Flood — standalone tab (Threat and Impact Forecasting; hex map, potential impact, counties).
 */

import React, { useRef, useState, useEffect, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import "mapbox-gl-style-switcher/styles.css";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;
import { useDraggable } from "../hooks/useDraggable";
import { useIsMobile } from "../hooks/use-mobile";
import { useMapResize } from "../hooks/useMapResize";
import { useLtsMapLayers } from "../hooks/useLtsMapLayers";
import { useLtsHexInteractions } from "../hooks/useLtsHexInteractions";
import { MAP_CONTROLS_CSS, MAP_POPUP_CSS } from "../config/mapConfig";
import { LAYER_CONFIG, LTS_LAYER_ID } from "../config/ltsFlashFloodLayerConfig";
import { MapLoadingIndicator, MapErrorMessage } from "./ui/map-components";
import { LtsFlashFloodControlPanel } from "./hmed/LtsFlashFloodControlPanel";
import { LtsFlashFloodMobilePanel } from "./hmed/LtsFlashFloodMobilePanel";
import { HMEDInfoModal } from "./hmed/HMEDInfoModal";
import { HMEDLtsCountySummaryPanel } from "./hmed/HMEDLtsCountySummaryPanel";
import {
    getLtsExposureSummary,
    getLtsCounties,
    LTS_COUNTY_LIST_MIN_LTS_LEVEL
} from "../services/ltsFlashFloodService";

const LTS_COUNTY_PANEL_TITLE = "TIF by county";
const LTS_COUNTY_PANEL_SUBTITLE = "Potentially High & Potentially Very High · latest run";
const LTS_COUNTY_LIST_SCOPE_NOTE =
    "List shows severity 4 (Potentially High) and 5 (Potentially Very High) only.";
const LTS_COUNTY_EMPTY_MESSAGE =
    "No high-threat regions in the latest run: no counties in Potentially High (4) or Potentially Very High (5). Lower severities are omitted here to reduce noise.";

/** Placeholder hours for shared color helpers (LTS uses fixed `lts_level` property). */
const LTS_SELECTED_HOURS_PLACEHOLDER = 3;

const LtsFlashFloodTab = () => {
    const mapContainerRef = useRef(null);
    const [showInfo, setShowInfo] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [isMobileExpanded, setIsMobileExpanded] = useState(false);
    const [ltsExposure, setLtsExposure] = useState(null);
    const [ltsExposureLoading, setLtsExposureLoading] = useState(false);
    const [ltsExposureError, setLtsExposureError] = useState(null);
    const [ltsMinLevel, setLtsMinLevel] = useState(4);
    const [ltsCountiesPayload, setLtsCountiesPayload] = useState(null);
    const [ltsCountiesLoading, setLtsCountiesLoading] = useState(false);
    const [ltsCountiesError, setLtsCountiesError] = useState(null);
    const [countySearchQuery, setCountySearchQuery] = useState("");
    const [isCountyPanelMinimized, setIsCountyPanelMinimized] = useState(false);
    const [mobileLtsSubTab, setMobileLtsSubTab] = useState("layers");

    const fetchLtsExposure = useCallback(async () => {
        setLtsExposureLoading(true);
        setLtsExposureError(null);
        try {
            const data = await getLtsExposureSummary(ltsMinLevel);
            setLtsExposure(data);
        } catch (e) {
            setLtsExposure(null);
            setLtsExposureError(e?.message || "Failed to load potential impact data");
        } finally {
            setLtsExposureLoading(false);
        }
    }, [ltsMinLevel]);

    const fetchLtsCounties = useCallback(async () => {
        setLtsCountiesLoading(true);
        setLtsCountiesError(null);
        try {
            const data = await getLtsCounties({ min_lts_level: LTS_COUNTY_LIST_MIN_LTS_LEVEL });
            setLtsCountiesPayload(data);
        } catch (e) {
            setLtsCountiesPayload(null);
            setLtsCountiesError(e?.message || "Failed to load county list");
        } finally {
            setLtsCountiesLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLtsExposure();
    }, [fetchLtsExposure]);

    useEffect(() => {
        fetchLtsCounties();
    }, [fetchLtsCounties]);

    const isMobile = useIsMobile();
    const controlDrag = useDraggable({ initialPosition: "bottom-right" });
    const countySummaryDrag = useDraggable({ initialPosition: "bottom-left" });

    const { mapRef, mapReady, isLoading, error, hexLayersGeneration } = useLtsMapLayers(
        mapContainerRef,
        LTS_SELECTED_HOURS_PLACEHOLDER
    );
    useLtsHexInteractions(
        mapRef,
        mapReady,
        LTS_SELECTED_HOURS_PLACEHOLDER,
        isMobile,
        hexLayersGeneration
    );
    useMapResize(mapRef, mapContainerRef);

    const currentLayer = LAYER_CONFIG[LTS_LAYER_ID];

    return (
        <div className="absolute inset-0 w-full h-full" style={{ pointerEvents: "auto" }}>
            <style>
                {MAP_CONTROLS_CSS}
                {MAP_POPUP_CSS}
            </style>
            <div
                ref={mapContainerRef}
                className="w-full h-full"
                style={{ position: "relative", zIndex: 0, pointerEvents: "auto" }}
            />

            {isMobile ? (
                <LtsFlashFloodMobilePanel
                    isExpanded={isMobileExpanded}
                    onOpen={() => setIsMobileExpanded(true)}
                    onClose={() => setIsMobileExpanded(false)}
                    onShowInfo={setShowInfo}
                    currentLayer={currentLayer}
                    ltsExposure={ltsExposure}
                    ltsExposureLoading={ltsExposureLoading}
                    ltsExposureError={ltsExposureError}
                    ltsMinLevel={ltsMinLevel}
                    setLtsMinLevel={setLtsMinLevel}
                    onLtsExposureRefresh={fetchLtsExposure}
                    mobileLtsSubTab={mobileLtsSubTab}
                    setMobileLtsSubTab={setMobileLtsSubTab}
                    ltsCounties={ltsCountiesPayload?.counties}
                    ltsCountiesTotal={ltsCountiesPayload?.total}
                    ltsCountiesRunDate={ltsCountiesPayload?.run_date}
                    ltsCountiesLoading={ltsCountiesLoading}
                    ltsCountiesError={ltsCountiesError}
                    countySearchQuery={countySearchQuery}
                    setCountySearchQuery={setCountySearchQuery}
                    onLtsCountiesRefresh={fetchLtsCounties}
                    countyListScopeNote={LTS_COUNTY_LIST_SCOPE_NOTE}
                    countyEmptyListMessage={LTS_COUNTY_EMPTY_MESSAGE}
                />
            ) : (
                <>
                    <HMEDLtsCountySummaryPanel
                        summaryDrag={countySummaryDrag}
                        isMinimized={isCountyPanelMinimized}
                        setIsMinimized={setIsCountyPanelMinimized}
                        panelTitle={LTS_COUNTY_PANEL_TITLE}
                        panelSubtitle={LTS_COUNTY_PANEL_SUBTITLE}
                        listScopeNote={LTS_COUNTY_LIST_SCOPE_NOTE}
                        emptyListMessage={LTS_COUNTY_EMPTY_MESSAGE}
                        counties={ltsCountiesPayload?.counties}
                        total={ltsCountiesPayload?.total}
                        runDate={ltsCountiesPayload?.run_date}
                        loading={ltsCountiesLoading}
                        error={ltsCountiesError}
                        searchQuery={countySearchQuery}
                        onSearchChange={setCountySearchQuery}
                        onRefresh={fetchLtsCounties}
                    />
                    <LtsFlashFloodControlPanel
                        controlDrag={controlDrag}
                        currentLayer={currentLayer}
                        onToggleInfo={() => setShowInfo((prev) => !prev)}
                        isMinimized={isMinimized}
                        setIsMinimized={setIsMinimized}
                        ltsExposure={ltsExposure}
                        ltsExposureLoading={ltsExposureLoading}
                        ltsExposureError={ltsExposureError}
                        ltsMinLevel={ltsMinLevel}
                        setLtsMinLevel={setLtsMinLevel}
                        onLtsExposureRefresh={fetchLtsExposure}
                    />
                </>
            )}

            <HMEDInfoModal show={showInfo} onClose={() => setShowInfo(false)} currentLayer={currentLayer} />

            {isLoading && (
                <MapLoadingIndicator
                    variant="overlay"
                    title="Loading map data"
                    message="Fetching Impact Forecast layers…"
                />
            )}
            {error && <MapErrorMessage message={error} />}
        </div>
    );
};

export default LtsFlashFloodTab;
