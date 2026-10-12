/**
 * @file SidebarContent.jsx
 * @description Main content component for the application sidebar.
 * Contains event selection, event statistics, and last update information.
 */

import React from 'react';
import EventSelector from './EventSelector.jsx';
import EventCards from './EventCards.jsx';
import LastUpdated from '@/components/LastUpdated.jsx';

/**
 * SidebarContent Component
 *
 * Organizes and displays the main content of the application sidebar.
 * Contains three main sections:
 * 1. Event type selection
 * 2. Event statistics cards
 * 3. Last update timestamp
 *
 * @param {Object} props - Component props
 * @param {string[]} props.selectedEvents - Array of currently selected event types
 * @param {Function} props.setSelectedEvents - Function to update selected events
 * @param {Array<{type: string, count: number}>} props.eventCounts - Array of event types and their counts
 * @param {boolean} props.isEventCountsLoading - Loading state indicator for event counts
 * @returns {JSX.Element} Sidebar content with event controls and statistics
 */
const SidebarContent = ({
  selectedEvents,
  setSelectedEvents,
  eventCounts,
  isEventCountsLoading,
}) => {
  return (
    <div className="flex flex-col h-full">
      {/* Event Type Selection Section */}
      <div className="flex flex-col relative mt-6">
        <label className="text-sm font-bold text-[#334755] mb-2">Select Event Types</label>
        <EventSelector selectedEvents={selectedEvents} setSelectedEvents={setSelectedEvents} />
      </div>

      {/* Divider */}
      <div className="border-t border-[#CBD1D3] my-6 -ml-6 -mr-6"></div>

      {/* Event Statistics Section */}
      <div className="flex flex-col mb-6">
        <label className="text-sm font-bold text-[#334755] mb-2">Events</label>
        <EventCards eventCounts={eventCounts} isEventCountsLoading={isEventCountsLoading} />
      </div>

      {/* Last Updated Section */}
      <div className="mt-auto pt-6 border-t border-[#CBD1D3] -ml-6 -mr-6">
        <LastUpdated />
      </div>
    </div>
  );
};

export default SidebarContent;
