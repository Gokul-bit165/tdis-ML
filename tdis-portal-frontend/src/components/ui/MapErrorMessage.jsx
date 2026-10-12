/**
 * @fileoverview Error message component for map components.
 */

import React from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * MapErrorMessage Component
 *
 * Displays an error message with refresh button for map errors.
 *
 * @param {Object} props
 * @param {string} props.title - Error title (default: 'Error Loading Map')
 * @param {string} props.message - Error message
 * @param {Function} props.onRefresh - Callback when refresh button is clicked
 * @param {string} props.position - Position classes (default: centered)
 */
const MapErrorMessage = ({
  title = 'Error Loading Map',
  message = 'An error occurred while loading the map.',
  onRefresh = () => window.location.reload(),
  position = 'absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2',
}) => {
  return (
    <div
      className={`${position} bg-white/95 backdrop-blur-sm border-2 border-red-300 text-red-700 px-6 py-5 rounded-xl shadow-2xl z-20 max-w-md pointer-events-auto`}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold mb-1">{title}</p>
          <p className="text-sm text-red-600">{message}</p>
          <button
            onClick={onRefresh}
            className="mt-3 px-4 py-2 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition-colors"
          >
            Refresh Page
          </button>
        </div>
      </div>
    </div>
  );
};

export default MapErrorMessage;
