/**
 * @fileoverview EventSelector component that provides a dropdown menu for selecting event types
 * to display on the map. Implements an accessible and animated dropdown with checkboxes
 * for event type selection.
 *
 * @module EventSelector
 * @requires react
 * @requires lucide-react
 * @requires @/components/ui/dropdown-menu
 * @requires framer-motion
 */

import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { ChevronDown, ChevronUp } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.jsx';
import { motion, AnimatePresence } from 'framer-motion';
import { trackEvent, EVENT_SELECTION, MAP_INTERACTION } from '../utils/googleAnalytics.js';

const MotionDiv = motion.div;

/**
 * Animation variants for the trigger button
 * Controls the button's hover, tap, and active states
 * @constant {Object}
 * @property {Object} initial - Initial state with scale 1
 * @property {Object} hover - Hover state with scale increase and border color change
 * @property {Object} tap - Tap state with scale decrease
 * @property {Object} active - Active state with border color change
 * @property {Object} hover.transition - Hover animation timing
 * @property {Object} active.transition - Active state animation timing
 */
const buttonVariants = {
  initial: { scale: 1 },
  hover: {
    scale: 1.02,
    borderColor: '#87BCBF',
    transition: { duration: 0.2 },
  },
  tap: { scale: 0.98 },
  active: {
    borderColor: '#87BCBF',
    transition: { duration: 0.2 },
  },
};

/**
 * Animation variants for the dropdown menu
 * Controls the menu's entrance, exit, and visible states
 * @constant {Object}
 * @property {Object} hidden - Initial state with opacity 0 and offset
 * @property {Object} visible - Visible state with spring animation
 * @property {Object} exit - Exit state with fade and scale
 * @property {Object} visible.transition - Spring animation configuration
 * @property {Object} exit.transition - Exit animation timing
 */
const menuVariants = {
  hidden: {
    opacity: 0,
    y: -10,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 25,
    },
  },
  exit: {
    opacity: 0,
    y: -10,
    scale: 0.95,
    transition: {
      duration: 0.2,
    },
  },
};

/**
 * EventSelector Component
 *
 * A dropdown menu component that allows users to select which event types
 * to display on the map. Implements an accessible and animated interface
 * using Radix UI's DropdownMenu components and Framer Motion animations.
 *
 * Features:
 * - Accessible dropdown menu using Radix UI
 * - Animated transitions and interactions
 * - Checkbox-based event selection
 * - Dynamic event count display
 * - Smooth hover and tap animations
 * - Keyboard navigation support
 * - Consistent styling with brand colors
 *
 * @component
 * @param {Object} props - Component props
 * @param {string[]} props.selectedEvents - Array of currently selected event types
 * @param {Function} props.setSelectedEvents - Function to update selected events
 * @returns {JSX.Element} Dropdown menu with event selection options
 *
 * @example
 * ```jsx
 * // Basic usage
 * const [selectedEvents, setSelectedEvents] = useState([]);
 *
 * <EventSelector
 *   selectedEvents={selectedEvents}
 *   setSelectedEvents={setSelectedEvents}
 * />
 * ```
 *
 * @example
 * ```jsx
 * // With pre-selected events
 * const [selectedEvents, setSelectedEvents] = useState(['Fire', 'Flood']);
 *
 * <EventSelector
 *   selectedEvents={selectedEvents}
 *   setSelectedEvents={setSelectedEvents}
 * />
 * ```
 */
const EventSelector = ({ selectedEvents, setSelectedEvents }) => {
  /**
   * State for controlling dropdown open/close
   * @type {[boolean, Function]} Dropdown open state and setter
   */
  const [open, setOpen] = useState(false);

  /**
   * Available event types for selection
   * @constant {string[]}
   * @todo Expand to include more event types as needed
   */
  const availableEvents = ['Wildfire', 'Rainfall', 'High wind', 'Earthquake', 'Hail'];

  /**
   * Handles checkbox state changes for event selection
   * Toggles the selected state of an event type
   *
   * @function
   * @param {string} eventName - Name of the event to toggle
   * @returns {void}
   *
   * @example
   * // Toggle 'Fire' event
   * handleCheckboxChange('Fire');
   */
  const handleCheckboxChange = (eventName) => {
    const selected = !selectedEvents.includes(eventName);
    trackEvent(EVENT_SELECTION, MAP_INTERACTION, {
      tab: 'active-weather-events',
      event_name: eventName,
      event_label: eventName,
      selected,
    });
    setSelectedEvents((prev) =>
      prev.includes(eventName) ? prev.filter((e) => e !== eventName) : [...prev, eventName]
    );
  };

  return (
    <DropdownMenu onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <MotionDiv
          className={`h-10 px-3 py-2 text-sm border ${open ? 'border-[#87BCBF]' : 'border-[#CBD1D3]'} rounded-lg text-[#334755] bg-white cursor-pointer flex items-center justify-between min-w-[180px]`}
          variants={buttonVariants}
          initial="initial"
          animate={open ? 'active' : 'initial'}
          whileHover="hover"
          whileTap="tap"
          transition={{ type: 'spring', stiffness: 400, damping: 10 }}
        >
          {/* Display selected events count or placeholder */}
          {selectedEvents.length > 0
            ? `${selectedEvents.length} event${selectedEvents.length > 1 ? 's' : ''} selected`
            : 'Select events'}

          <MotionDiv animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
            {open ? (
              <ChevronUp size={16} className="ml-auto" />
            ) : (
              <ChevronDown size={16} className="ml-auto" />
            )}
          </MotionDiv>
        </MotionDiv>
      </DropdownMenuTrigger>

      <AnimatePresence>
        {open && (
          <MotionDiv variants={menuVariants} initial="hidden" animate="visible" exit="exit">
            <DropdownMenuContent className="w-68 mt-2">
              <DropdownMenuLabel>Select Events</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-[#CBD1D3]" />

              {/* Event checkboxes */}
              {availableEvents.map((event, index) => (
                <MotionDiv
                  key={event}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <DropdownMenuCheckboxItem
                    className="pl-6"
                    checked={selectedEvents.includes(event)}
                    onCheckedChange={() => handleCheckboxChange(event)}
                  >
                    <span className="pl-2">{event}</span>
                  </DropdownMenuCheckboxItem>
                </MotionDiv>
              ))}
            </DropdownMenuContent>
          </MotionDiv>
        )}
      </AnimatePresence>
    </DropdownMenu>
  );
};

EventSelector.propTypes = {
  selectedEvents: PropTypes.arrayOf(PropTypes.string).isRequired,
  setSelectedEvents: PropTypes.func.isRequired,
};

export default EventSelector;
