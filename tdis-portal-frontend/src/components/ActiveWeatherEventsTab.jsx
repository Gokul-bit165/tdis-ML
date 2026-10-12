/**
 * @fileoverview ActiveWeatherEventsTab component
 * Default tab showing the active weather events map
 */

import React from 'react';
import PropTypes from 'prop-types';
import MapView from './Map.jsx';

const ActiveWeatherEventsTab = ({
  selectedEvents,
  setSelectedEvents,
  layerVisibility,
  setEventCounts,
  isExpanded,
  isEventCountsLoading,
  setIsEventCountsLoading,
  sidebarExpanded,
  onMapReady,
  onMapRefresh,
  eventCounts,
  onLatestEventDate,
}) => {
  return (
    <div className="absolute inset-0 w-full h-full">
      <MapView
        selectedEvents={selectedEvents}
        setSelectedEvents={setSelectedEvents}
        layerVisibility={layerVisibility}
        setEventCounts={setEventCounts}
        isExpanded={isExpanded}
        isEventCountsLoading={isEventCountsLoading}
        setIsEventCountsLoading={setIsEventCountsLoading}
        sidebarExpanded={sidebarExpanded}
        onMapReady={onMapReady}
        onMapRefresh={onMapRefresh}
        eventCounts={eventCounts}
        onLatestEventDate={onLatestEventDate}
      />
    </div>
  );
};

ActiveWeatherEventsTab.propTypes = {
  selectedEvents: PropTypes.arrayOf(PropTypes.string),
  setSelectedEvents: PropTypes.func,
  layerVisibility: PropTypes.object,
  setEventCounts: PropTypes.func,
  isExpanded: PropTypes.bool,
  isEventCountsLoading: PropTypes.bool,
  setIsEventCountsLoading: PropTypes.func,
  sidebarExpanded: PropTypes.bool,
  onMapReady: PropTypes.func,
  onMapRefresh: PropTypes.func,
  eventCounts: PropTypes.array,
  onLatestEventDate: PropTypes.func,
};

export default ActiveWeatherEventsTab;
