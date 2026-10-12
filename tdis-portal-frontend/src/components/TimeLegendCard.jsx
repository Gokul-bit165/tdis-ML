/**
 * @fileoverview TimeLegendCard component that combines Time and Legend in a single right-bottom card.
 * Follows the layout structure from dmqt.cloud.tdis.io
 *
 * @module TimeLegendCard
 * @requires react
 * @requires ./LastUpdated
 */

import React from 'react';
import PropTypes from 'prop-types';
import { motion } from 'framer-motion';

const MotionButton = motion.button;
import { Skeleton } from '@/components/ui/skeleton';
import LastUpdated from './LastUpdated.jsx';
import { trackEvent, EVENT_SELECTION, MAP_INTERACTION } from '../utils/googleAnalytics.js';

// The same event types as EventSelector
const availableEvents = ['Wildfire', 'Rainfall', 'High wind', 'Earthquake', 'Hail'];

/**
 * TimeLegendCard Component
 *
 * A combined card component that displays both Time and Legend information
 * positioned at the bottom-right of the map area.
 *
 * @component
 * @param {Object} props - Component props
 * @param {string[]} props.selectedEvents - Array of selected event types
 * @param {Function} props.setSelectedEvents - Function to update selected event types
 * @param {boolean} props.loading - Loading state for legend
 * @param {Function} props.onMapRefresh - Callback function to refresh map data
 * @returns {JSX.Element} Combined Time & Legend card
 */
const TimeLegendCard = ({ selectedEvents, setSelectedEvents, loading, onMapRefresh }) => {
  // Toggle event selection
  const handleToggle = (event) => {
    const selected = !selectedEvents.includes(event);
    trackEvent(EVENT_SELECTION, MAP_INTERACTION, {
      tab: 'active-weather-events',
      event_name: event,
      event_label: event,
      selected,
      source: 'time_legend',
    });
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  return (
    <div className="absolute bottom-16 right-4 z-20 bg-white/95 rounded-lg shadow-lg border border-gray-200 p-4 min-w-[200px] max-w-[280px] backdrop-blur-sm">
      {/* Time Section */}
      <div className="mb-4 pb-4 border-b border-gray-200">
        <LastUpdated onRefresh={onMapRefresh} />
      </div>

      {/* Legend Section */}
      <div>
        <div className="font-bold text-[#334755] text-sm mb-2">Filter event types:</div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-2">
          {loading
            ? availableEvents.map((_, i) => (
                <div key={i} className="flex items-center gap-1 px-1 py-0.5">
                  <Skeleton className="w-4 h-4 md:w-6 md:h-6 rounded-full" />
                  <Skeleton className="h-4 w-20 rounded" />
                </div>
              ))
            : availableEvents.map((event) => {
                const selected = selectedEvents.includes(event);
                return (
                  <MotionButton
                    key={event}
                    type="button"
                    onClick={() => handleToggle(event)}
                    className="flex items-center gap-1 px-1 py-0.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#87BCBF] cursor-pointer"
                    style={{
                      opacity: selected ? 1 : 0.45,
                      transition: 'opacity 0.2s, background 0.2s, border 0.2s',
                    }}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    aria-pressed={selected}
                  >
                    <img
                      src={`/${event.toLowerCase()}.png`}
                      alt={event}
                      className="w-4 h-4 md:w-6 md:h-6"
                      style={{ filter: selected ? 'none' : 'grayscale(60%)' }}
                      draggable={false}
                    />
                    <span className="text-xs md:text-sm font-medium text-[#334755]">{event}</span>
                  </MotionButton>
                );
              })}
        </div>
      </div>
    </div>
  );
};

TimeLegendCard.propTypes = {
  selectedEvents: PropTypes.arrayOf(PropTypes.string).isRequired,
  setSelectedEvents: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  onMapRefresh: PropTypes.func,
};

export default TimeLegendCard;
