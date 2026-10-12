/**
 * @file Map.jsx
 * @description Presentational map container for Active Weather Events. Uses useWeatherEventsMap for map init and layers.
 */

import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import "mapbox-gl-style-switcher/styles.css";
import { useWeatherEventsMap } from "../hooks/useWeatherEventsMap";
import MapLegend from "./MapLegend";
import { MAP_CONTROLS_CSS, MAP_POPUP_CSS } from "../config/mapConfig";
import { getDefaultCriticalFacilityVisibility } from "../config/criticalFacilitiesConfig";
import { MapLoadingIndicator, MapErrorMessage } from "./ui/map-components";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

/**
 * @param {Object} props - Component props (same interface as before for MainLayout/MapSection)
 */
const MapView = ({
    selectedEvents,
    setSelectedEvents,
    layerVisibility,
    setEventCounts,
    isExpanded,
    setIsEventCountsLoading,
    sidebarExpanded,
    onMapReady,
    eventCounts = [],
    onLatestEventDate,
}) => {
    const mapContainerRef = useRef(null);
    const [facilityVisibility, setFacilityVisibility] = useState(() =>
        getDefaultCriticalFacilityVisibility()
    );

    const { mapRef, loadingStates, error } = useWeatherEventsMap(mapContainerRef, {
        selectedEvents,
        layerVisibility,
        setEventCounts,
        setIsEventCountsLoading,
        onLatestEventDate,
        onMapReady,
        facilityVisibility,
    });

    // Resize map when expanded or sidebar state changes
    useEffect(() => {
        if (!mapRef.current) return;
        const id = setTimeout(() => {
            if (mapRef.current) mapRef.current.resize();
        }, 0);
        return () => clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: avoid remounting map/geometry layers
    }, [isExpanded]);

    useEffect(() => {
        if (!mapRef.current) return;
        const id = setTimeout(() => {
            if (mapRef.current) mapRef.current.resize();
        }, 200);
        return () => clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: avoid remounting map/geometry layers
    }, [sidebarExpanded]);

    const isLoading = loadingStates.events || loadingStates.geojson || loadingStates.eventCounts;

    return (
        <div className="relative w-full h-full">
            <style>{MAP_CONTROLS_CSS}{MAP_POPUP_CSS}</style>
            <div ref={mapContainerRef} className="w-full h-full" />
            <MapLegend
                selectedEvents={selectedEvents}
                setSelectedEvents={setSelectedEvents}
                loading={isLoading}
                eventCounts={eventCounts}
                facilityVisibility={facilityVisibility}
                setFacilityVisibility={setFacilityVisibility}
            />
            {isLoading && (
                <MapLoadingIndicator
                    variant="overlay"
                    title="Loading map data"
                    message="Fetching live weather events…"
                />
            )}
            {error && <MapErrorMessage message={error} />}
        </div>
    );
};

MapView.propTypes = {
    selectedEvents: PropTypes.arrayOf(PropTypes.string),
    setSelectedEvents: PropTypes.func,
    layerVisibility: PropTypes.object,
    setEventCounts: PropTypes.func,
    isExpanded: PropTypes.bool,
    setIsEventCountsLoading: PropTypes.func,
    sidebarExpanded: PropTypes.bool,
    onMapReady: PropTypes.func,
    eventCounts: PropTypes.array,
    onLatestEventDate: PropTypes.func,
};

export default MapView;
