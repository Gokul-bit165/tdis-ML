/**
 * @fileoverview MainLayout component that serves as the root layout component for the application.
 * Orchestrates the application's UI structure, manages global state, and coordinates between
 * different sections of the application. Implements a responsive layout with map integration
 * and various content sections.
 * 
 * @module MainLayout
 * @requires react
 * @requires ./MapSection
 * @requires ./WhatWeDo
 * @requires ./WhoWorksWithUs
 * @requires ./ContactUs
 * @requires ./EmailSubscriptionForm
 * @requires ./AppDatasetIntake
 * @requires ./ScrollToTop
 * @requires ./ResponsiveNavigation
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import MapSection from "./MapSection.jsx";
import WhatWeDo from "./WhatWeDo.jsx";
import WhoWorksWithUs from "./WhoWorksWithUs.jsx";
import ContactUs from "./ContactUs.jsx";
import EmailSubscriptionForm from "./EmailSubscriptionForm.jsx";
import AppDatasetIntake from "./AppDatasetIntake.jsx";
import ScrollToTop from "./ScrollToTop.jsx";
import ResponsiveNavigation from "./ResponsiveNavigation.jsx";
import { refreshMapData } from "../services/mapRefreshService";
import ActiveWeatherEventsTab from "./ActiveWeatherEventsTab.jsx";
import ActiveWeatherEventsBetaTab from "./ActiveWeatherEventsBetaTab.jsx";
import HMEDTab from "./HMEDTab.jsx";
import LtsFlashFloodTab from "./LtsFlashFloodTab.jsx";
import OSATab from "./OSATab.jsx";
import AIAssistantTab from "./AIAssistantTab.jsx";
import WildfireIgnitionTab from "./WildfireIgnitionTab.jsx";
import {
    ACTIVE_WEATHER_EVENTS_BETA_TAB,
    AI_ASSISTANT_TAB,
    isActiveWeatherEventsBetaEnabled,
    isTdisAiEnabled,
    resolveActiveTab,
} from "@/config/featureFlags";
import { getHmedRefreshCadence } from "@/config/hmedLayerConfig";
// TIF and DIA tabs commented out - not needed for now
// import TIFTab from "./TIFTab.jsx";
// import DIATab from "./DIATab.jsx";

const DEFAULT_TAB = "active-weather-events";
const HMED_TAB = "hmed";
const LTS_FLASH_FLOOD_TAB = "lts-flash-flood";
const OSA_TAB_ID = "osa";
const WILDFIRE_IGNITION_TAB = "wildfire-ignition";
const LIVE_WEATHER_REFRESH_CADENCE = "Every 30 minutes";
const IMPACT_FORECAST_REFRESH_CADENCE = "Every 6 hours";
const INFRASTRUCTURE_STATUS_REFRESH_CADENCE = "Every 1 hour";
const DEFAULT_LAYER_VISIBILITY = {
    events: true,
    hurricaneEvents: true,
    counties: false,
};

function getMapProductTabs() {
    return [
        DEFAULT_TAB,
        ...(isActiveWeatherEventsBetaEnabled() ? [ACTIVE_WEATHER_EVENTS_BETA_TAB] : []),
        HMED_TAB,
        LTS_FLASH_FLOOD_TAB,
        OSA_TAB_ID,
        WILDFIRE_IGNITION_TAB,
    ];
}

function getValidTabs() {
    const mapTabs = getMapProductTabs();
    return isTdisAiEnabled() ? [...mapTabs, AI_ASSISTANT_TAB] : mapTabs;
}

function getValidTab(tab) {
    const resolved = resolveActiveTab(tab, DEFAULT_TAB);
    return getValidTabs().includes(resolved) ? resolved : DEFAULT_TAB;
}

/**
 * MainLayout Component
 * 
 * The root layout component that serves as the application's structural foundation.
 * Manages global state and coordinates the interaction between different sections
 * of the application.
 * 
 * Features:
 * - Responsive layout structure
 * - Global state management
 * - Map integration with controls
 * - Event type filtering
 * - Layer visibility management
 * - Event count tracking
 * - Scroll-to-top functionality
 * - Multiple content sections
 * 
 * Component Structure:
 * - MapSection: Interactive map with controls
 * - WhatWeDo: Information about services
 * - WhoWorksWithUs: Partner information
 * - AppDatasetIntake: Data submission form
 * - ContactUs: Contact information
 * - EmailSubscriptionForm: Newsletter signup
 * - ScrollToTop: Navigation helper
 * 
 * State Management:
 * - isExpanded: Controls sidebar expansion state (desktop only)
 * - selectedEvents: Tracks selected event types for filtering
 * - layerVisibility: Manages map layer visibility
 * - eventCounts: Stores event count data
 * - isEventCountsLoading: Tracks loading state for event counts
 * 
 * @component
 * @returns {JSX.Element} The main application layout structure
 * 
 * @example
 * ```jsx
 * // Basic usage
 * <MainLayout />
 * ```
 */
const MainLayout = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    // Global state management
    const [isExpanded, setIsExpanded] = useState(true);
    const [selectedEvents, setSelectedEvents] = useState(["Wildfire", "Rainfall", "High wind", "Earthquake", "Hail"]);
    const layerVisibility = DEFAULT_LAYER_VISIBILITY;
    const [eventCounts, setEventCounts] = useState([]);
    const [isEventCountsLoading, setIsEventCountsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState(() => getValidTab(searchParams.get("tab")));
    const [hmedSelectedLayer, setHmedSelectedLayer] = useState("precipitation");
    const mapRef = useRef(null);

    const handleHmedSelectedLayerChange = useCallback((layerId) => {
        setHmedSelectedLayer(layerId || "precipitation");
    }, []);

    const refreshCadence = useMemo(() => {
        if (activeTab === DEFAULT_TAB) return LIVE_WEATHER_REFRESH_CADENCE;
        if (activeTab === HMED_TAB) {
            return getHmedRefreshCadence(hmedSelectedLayer);
        }
        if (activeTab === LTS_FLASH_FLOOD_TAB) return IMPACT_FORECAST_REFRESH_CADENCE;
        if (activeTab === OSA_TAB_ID) return INFRASTRUCTURE_STATUS_REFRESH_CADENCE;
        return null;
    }, [activeTab, hmedSelectedLayer]);

    useEffect(() => {
        const tabFromUrl = getValidTab(searchParams.get("tab"));
        setActiveTab((currentTab) => (currentTab === tabFromUrl ? currentTab : tabFromUrl));
    }, [searchParams]);

    const handleActiveTabChange = useCallback((nextTab) => {
        const tab = getValidTab(nextTab);
        setActiveTab(tab);
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set("tab", tab);
        setSearchParams(nextParams);
    }, [searchParams, setSearchParams]);

    // Handle map ready callback
    const handleMapReady = (map) => {
        mapRef.current = map;
    };

    // Function to refresh map data
    const handleMapRefresh = async () => {
        if (mapRef.current) {
            await refreshMapData(
                mapRef.current,
                setEventCounts,
                setIsEventCountsLoading,
                selectedEvents
            );
        }
    };

    return (
        /**
         * Main layout container
         * Implements a responsive layout with full viewport height
         * Contains all major application sections
         * 
         * @returns {JSX.Element} Application layout structure
         */
        <div className="min-h-screen w-full relative">
            {/* Responsive Navigation - Handles both desktop and mobile */}
            <ResponsiveNavigation
                isExpanded={isExpanded}
                setIsExpanded={setIsExpanded}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
            />

            {/* Main Content Area - Responsive width */}
            <div className={`transition-all duration-200 ${
                // Desktop: Adjust width based on sidebar state (always 280px when expanded)
                // Mobile: Always full width
                isExpanded
                    ? 'lg:w-[calc(100%-280px)] lg:ml-[280px]'
                    : 'w-full lg:ml-0'
                } flex flex-col min-h-screen relative`}>
                {/* Map Section with Tab Navigation */}
                <MapSection
                    activeTab={activeTab}
                    setActiveTab={handleActiveTabChange}
                    refreshCadence={refreshCadence}
                    tabContent={
                        <>
                            {activeTab === DEFAULT_TAB && (
                                <ActiveWeatherEventsTab
                                    selectedEvents={selectedEvents}
                                    setSelectedEvents={setSelectedEvents}
                                    layerVisibility={layerVisibility}
                                    setEventCounts={setEventCounts}
                                    isExpanded={isExpanded}
                                    isEventCountsLoading={isEventCountsLoading}
                                    setIsEventCountsLoading={setIsEventCountsLoading}
                                    sidebarExpanded={isExpanded}
                                    onMapReady={handleMapReady}
                                    onMapRefresh={handleMapRefresh}
                                    eventCounts={eventCounts}
                                />
                            )}
                            {isActiveWeatherEventsBetaEnabled() && activeTab === ACTIVE_WEATHER_EVENTS_BETA_TAB && (
                                <ActiveWeatherEventsBetaTab />
                            )}
                            {activeTab === HMED_TAB && (
                                <HMEDTab
                                    onMapRefresh={handleMapRefresh}
                                    onSelectedLayerChange={handleHmedSelectedLayerChange}
                                />
                            )}
                            {activeTab === LTS_FLASH_FLOOD_TAB && <LtsFlashFloodTab />}
                            {activeTab === OSA_TAB_ID && <OSATab />}
                            {activeTab === WILDFIRE_IGNITION_TAB && <WildfireIgnitionTab />}
                            {isTdisAiEnabled() && activeTab === AI_ASSISTANT_TAB && <AIAssistantTab />}
                            {/* TIF and DIA tabs commented out - not needed for now */}
                            {/* {activeTab === 'tif' && <TIFTab />} */}
                            {/* {activeTab === 'dia' && <DIATab />} */}
                        </>
                    }
                />

                <WhatWeDo />
                <WhoWorksWithUs />
                <AppDatasetIntake />
                <ContactUs />
                <EmailSubscriptionForm />
                <ScrollToTop />
            </div>
        </div>
    );
};

export default MainLayout;
