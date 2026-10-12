/**
 * @fileoverview MapSection component that serves as the main map interface of the application.
 * Integrates an interactive map with layer controls and a sidebar sheet for event management.
 * Implements responsive design and animated interactions using Framer Motion.
 * 
 * @module MapSection
 * @requires react
 * @requires ./Map
 * @requires ./LayerControl
 * @requires @/components/ui/sheet
 * @requires ./SidebarContent
 * @requires framer-motion
 * @requires react-router-dom
 */

import React, { useRef } from "react";
import PropTypes from "prop-types";
import TabNavigation from "./TabNavigation.jsx";
import DisclaimerFooter from "./DisclaimerFooter.jsx";


/**
 * Animation variants for interactive buttons
 * Controls button hover, tap, and active states
 * @constant {Object}
 * @property {Object} initial - Initial state with scale 1
 * @property {Object} hover - Hover state with scale increase and background color change
 * @property {Object} tap - Tap state with scale decrease
 * @property {Object} active - Active state with background color change
 * @property {Object} hover.transition - Hover animation timing
 * @property {Object} active.transition - Active state animation timing
 */
/**
 * MapSection Component
 * 
 * A comprehensive map interface component that combines an interactive map,
 * layer controls, and a sidebar sheet for event management. Provides a
 * responsive and accessible user interface for map interaction.
 * 
 * Features:
 * - Interactive map display
 * - Layer visibility controls
 * - Animated sidebar sheet
 * - Event type filtering
 * - Event count tracking
 * - Responsive design
 * - Keyboard navigation support
 * - Smooth animations
 * 
 * Component Structure:
 * - LayerControl: Map layer visibility controls
 * - Map: Interactive map display
 * - Sheet: Sidebar with event controls
 * - SidebarContent: Event management interface
 * 
 * @component
 * @param {Object} props - Component props
 * @param {string[]} props.selectedEvents - Array of selected event types for filtering
 * @param {Function} props.setSelectedEvents - Function to update selected event types
 * @param {Object} props.layerVisibility - Object containing visibility states for map layers
 * @param {boolean} props.layerVisibility.outline - Visibility state for county outlines
 * @param {boolean} props.layerVisibility.events - Visibility state for event markers
 * @param {Function} props.setLayerVisibility - Function to update layer visibility states
 * @param {Function} props.setEventCounts - Function to update event count data
 * @param {boolean} props.isExpanded - Flag indicating if the map is in expanded view
 * @param {boolean} props.isEventCountsLoading - Loading state for event count data
 * @param {Function} props.setIsEventCountsLoading - Function to update event count loading state
 * @param {Array} props.eventCounts - Array containing event count data
 * @param {boolean} props.sidebarExpanded - Flag indicating if the sidebar is expanded
 * @param {React.ReactNode} props.tabContent - Content to render for the active tab
 * @returns {JSX.Element} Map section with controls and sidebar
 * 
 * @example
 * ```jsx
 * // Basic usage
 * <MapSection
 *   selectedEvents={['Fire', 'Flood']}
 *   setSelectedEvents={setSelectedEvents}
 *   layerVisibility={{ outline: true, events: true }}
 *   setLayerVisibility={setLayerVisibility}
 *   setEventCounts={setEventCounts}
 *   isExpanded={true}
 *   isEventCountsLoading={false}
 *   setIsEventCountsLoading={setIsEventCountsLoading}
 *   eventCounts={[]}
 *   sidebarExpanded={false}
 * />
 * ```
 */
const MapSection = ({
    activeTab,
    setActiveTab,
    tabContent,
    refreshCadence,
}) => {
    const appContainerRef = useRef(null);

    return (
        /**
         * Main map section container
         * Implements a relative flex container for proper layout
         * Contains map, controls, and sidebar components
         * 
         * @returns {JSX.Element} Map section layout structure
         */
        <div className="relative flex-1" ref={appContainerRef}>
            {/* Layer Control Component */}
            {/* <LayerControl
                showLayerMenu={showLayerMenu}
                setShowLayerMenu={setShowLayerMenu}
                layerVisibility={layerVisibility}
                setLayerVisibility={setLayerVisibility}
            /> */}

            {/* Map Component Container */}
            <div className="relative h-[calc(100vh-2.5rem)] w-full [--ai-assistant-footer-reserve:3.5rem] md:[--ai-assistant-footer-reserve:2.28rem]">
                {/* Tab Navigation */}
                <TabNavigation activeTab={activeTab} setActiveTab={setActiveTab} />
                
                {/* Tab Content */}
                {tabContent}
                
                {/* Disclaimer Footer - Appears on all tabs */}
                <DisclaimerFooter refreshCadence={refreshCadence} />
            </div>
        </div>
    );
};

MapSection.propTypes = {
    activeTab: PropTypes.string,
    setActiveTab: PropTypes.func,
    tabContent: PropTypes.node,
    refreshCadence: PropTypes.string,
};

export default MapSection; 
