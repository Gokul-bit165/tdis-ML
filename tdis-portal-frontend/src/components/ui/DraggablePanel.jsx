/**
 * @fileoverview Reusable draggable control panel component.
 * Used in HMED and OSA tabs for layer controls and settings.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const MotionDiv = motion.div;
import { GripVertical, Info, ChevronsDown, ChevronsUp, X } from 'lucide-react';
import { useDraggable } from '../../hooks/useDraggable';

/**
 * DraggablePanel Component
 *
 * A draggable panel with a header, collapse/expand functionality, and info button.
 *
 * @param {Object} props
 * @param {string} props.title - Panel title
 * @param {string} props.subtitle - Panel subtitle
 * @param {React.ElementType} props.icon - Icon component to display
 * @param {string} props.iconColor - Color for the icon
 * @param {boolean} props.isMinimized - Whether the panel is collapsed
 * @param {Function} props.onMinimizeToggle - Callback when minimize button is clicked
 * @param {boolean} props.showInfo - Whether info modal is open
 * @param {Function} props.onInfoToggle - Callback when info button is clicked
 * @param {string} props.initialPosition - Initial position ('top-left', 'top-right', 'bottom-left', 'bottom-right')
 * @param {string} props.infoButtonColor - Color scheme for info button (default: 'blue')
 * @param {React.ReactNode} props.children - Panel content
 * @param {string} props.className - Additional CSS classes
 * @param {Object} props.style - Additional inline styles
 */
const DraggablePanel = ({
  title,
  subtitle,
  icon: Icon,
  iconColor = '#324755',
  isMinimized = false,
  onMinimizeToggle,
  onInfoToggle,
  initialPosition = 'bottom-right',
  infoButtonColor = 'blue',
  children,
  className = '',
  style = {},
  maxHeight = '85vh',
}) => {
  const drag = useDraggable({ initialPosition });

  // Info button color schemes
  const infoButtonColors = {
    blue: 'from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700',
    orange: 'from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700',
    green: 'from-green-500 to-green-600 hover:from-green-600 hover:to-green-700',
  };

  // Minimize button color schemes
  const minimizeButtonColors = {
    blue: 'bg-blue-100 hover:bg-blue-200',
    orange: 'bg-orange-100 hover:bg-orange-200',
    green: 'bg-green-100 hover:bg-green-200',
  };

  const minimizeIconColors = {
    blue: 'text-blue-600 group-hover:text-blue-700',
    orange: 'text-orange-600 group-hover:text-orange-700',
    green: 'text-green-600 group-hover:text-green-700',
  };

  return (
    <div
      ref={drag.panelRef}
      className={`bg-white rounded-lg shadow-lg border border-gray-200 p-4 w-72 ${className}`}
      style={{ ...drag.style, pointerEvents: 'auto', ...style }}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-200">
        <div
          ref={drag.dragHandleRef}
          className="flex items-center gap-2 cursor-move flex-1"
          style={{ userSelect: 'none' }}
        >
          <GripVertical className="w-4 h-4 text-gray-400" />
          <div className="flex items-center gap-2.5">
            {Icon && <Icon className="w-5 h-5" style={{ color: iconColor }} />}
            <div>
              <h3 className="text-sm font-bold text-[#324755]">{title}</h3>
              {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onInfoToggle && (
            <button
              onClick={onInfoToggle}
              className={`relative flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r ${infoButtonColors[infoButtonColor]} text-white shadow-md hover:shadow-lg transition-all duration-200 group`}
              title="Show information"
              aria-label="Show information"
            >
              <Info className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-semibold">Info</span>
            </button>
          )}
          {onMinimizeToggle && (
            <button
              onClick={onMinimizeToggle}
              className={`flex items-center justify-center w-8 h-8 rounded-md ${minimizeButtonColors[infoButtonColor]} transition-all duration-200 group`}
              title={isMinimized ? 'Expand panel' : 'Collapse panel'}
              aria-label={isMinimized ? 'Expand panel' : 'Collapse panel'}
            >
              {isMinimized ? (
                <ChevronsUp
                  className={`w-5 h-5 ${minimizeIconColors[infoButtonColor]} transition-colors`}
                  strokeWidth={2.5}
                />
              ) : (
                <ChevronsDown
                  className={`w-5 h-5 ${minimizeIconColors[infoButtonColor]} transition-colors`}
                  strokeWidth={2.5}
                />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Panel Content - Animated collapse/expand */}
      <AnimatePresence>
        {!isMinimized && (
          <MotionDiv
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
            className={`max-h-[${maxHeight}] overflow-y-auto`}
          >
            <div className="pt-4">{children}</div>
          </MotionDiv>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DraggablePanel;
