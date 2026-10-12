/**
 * @fileoverview LayerControl component that provides a dropdown menu for controlling map layer visibility.
 * Implements an accessible and animated interface for toggling Texas county outlines and disaster events
 * on the map. Uses Radix UI components and Framer Motion for animations.
 *
 * @module LayerControl
 * @requires @/components/ui/dropdown-menu
 * @requires react
 * @requires framer-motion
 */

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useState } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import { trackLayerToggle } from '../utils/googleAnalytics.js';

const MotionDiv = motion.div;

/**
 * Animation variants for the trigger button
 * Controls the button's hover, tap, and active states
 * @constant {Object}
 * @property {Object} initial - Initial state with scale 1
 * @property {Object} hover - Hover state with scale increase and background color change
 * @property {Object} tap - Tap state with scale decrease
 * @property {Object} active - Active state with background color change
 * @property {Object} hover.transition - Hover animation timing
 * @property {Object} active.transition - Active state animation timing
 */
const buttonVariants = {
  initial: { scale: 1 },
  hover: {
    scale: 1.05,
    backgroundColor: '#87BCBF',
    transition: { duration: 0.2 },
  },
  tap: { scale: 0.95 },
  active: {
    backgroundColor: '#87BCBF',
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
 * LayerControl Component
 *
 * A dropdown menu component that allows users to control the visibility of map layers.
 * Provides an accessible and animated interface for toggling different map elements.
 *
 * Features:
 * - Accessible dropdown menu using Radix UI
 * - Animated transitions and interactions
 * - Layer visibility toggles
 * - Smooth hover and tap animations
 * - Keyboard navigation support
 * - Consistent styling with brand colors
 * - Positioned absolutely on the map
 *
 * @component
 * @param {Object} props - Component props
 * @param {Function} props.setShowLayerMenu - Function to toggle layer menu visibility in parent component
 * @param {Object} props.layerVisibility - Object containing visibility states for layers
 * @param {boolean} props.layerVisibility.outline - Visibility state for Texas county outlines
 * @param {boolean} props.layerVisibility.events - Visibility state for disaster events
 * @param {Function} props.setLayerVisibility - Function to update layer visibility states
 * @returns {JSX.Element} Dropdown menu with layer visibility controls
 *
 * @example
 * ```jsx
 * // Basic usage
 * const [layerVisibility, setLayerVisibility] = useState({
 *   outline: true,
 *   events: true
 * });
 * const [showLayerMenu, setShowLayerMenu] = useState(false);
 *
 * <LayerControl
 *   setShowLayerMenu={setShowLayerMenu}
 *   layerVisibility={layerVisibility}
 *   setLayerVisibility={setLayerVisibility}
 * />
 * ```
 */
const LayerControl = ({ setShowLayerMenu, layerVisibility, setLayerVisibility }) => {
  /**
   * State for controlling dropdown open/close
   * @type {[boolean, Function]} Dropdown open state and setter
   */
  const [open, setOpen] = useState(false);

  return (
    /**
     * Layer control container
     * Positioned absolutely on the map with z-index for proper layering
     * Contains the dropdown trigger and menu content
     *
     * @returns {JSX.Element} Layer control interface
     */
    <div className={'absolute top-4 left-5 z-10'}>
      <DropdownMenu onOpenChange={setOpen}>
        {/* Dropdown trigger button with layer icon */}
        <DropdownMenuTrigger asChild>
          <MotionDiv
            onClick={() => setShowLayerMenu((prev) => !prev)}
            className={`${open ? 'bg-[#87BCBF]' : 'bg-[#334755]'} p-3 rounded-lg flex items-center justify-center cursor-pointer gap-4`}
            variants={buttonVariants}
            initial="initial"
            animate={open ? 'active' : 'initial'}
            whileHover="hover"
            whileTap="tap"
            transition={{ type: 'spring', stiffness: 400, damping: 10 }}
            aria-label="Toggle map layers menu"
          >
            <img src="/layers.svg" alt="Map layers control icon" />
          </MotionDiv>
        </DropdownMenuTrigger>

        {/* Animated dropdown menu content */}
        <AnimatePresence>
          {open && (
            <MotionDiv variants={menuVariants} initial="hidden" animate="visible" exit="exit">
              <DropdownMenuContent className="w-56 ml-5">
                <DropdownMenuLabel>Map Layers</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-[#CBD1D3]" />

                {/* Texas Counties layer toggle */}
                <MotionDiv
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <DropdownMenuCheckboxItem
                    checked={layerVisibility.outline}
                    onCheckedChange={() => {
                      const next = !layerVisibility.outline;
                      trackLayerToggle({
                        tab: 'active-weather-events',
                        layer_name: 'texas_counties',
                        on: next,
                      });
                      setLayerVisibility((prev) => ({
                        ...prev,
                        outline: next,
                      }));
                    }}
                  >
                    Texas Counties
                  </DropdownMenuCheckboxItem>
                </MotionDiv>

                {/* Hazards layer toggle */}
                <MotionDiv
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <DropdownMenuCheckboxItem
                    checked={layerVisibility.events}
                    onCheckedChange={() => {
                      const next = !layerVisibility.events;
                      trackLayerToggle({
                        tab: 'active-weather-events',
                        layer_name: 'hazards',
                        on: next,
                      });
                      setLayerVisibility((prev) => ({
                        ...prev,
                        events: next,
                      }));
                    }}
                  >
                    Hazards
                  </DropdownMenuCheckboxItem>
                </MotionDiv>
              </DropdownMenuContent>
            </MotionDiv>
          )}
        </AnimatePresence>
      </DropdownMenu>
    </div>
  );
};

LayerControl.propTypes = {
  setShowLayerMenu: PropTypes.func.isRequired,
  layerVisibility: PropTypes.shape({
    outline: PropTypes.bool.isRequired,
    events: PropTypes.bool.isRequired,
  }).isRequired,
  setLayerVisibility: PropTypes.func.isRequired,
};

export default LayerControl;
