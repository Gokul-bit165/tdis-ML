/**
 * @fileoverview Persistent PRD disclaimer when Google Flood Hub is active (non-dismissible while layer selected).
 */

import React from 'react';
import PropTypes from 'prop-types';
import { AlertTriangle } from 'lucide-react';

export function HMEDFloodHubPrdBanner({ visible }) {
  if (!visible) return null;
  return (
    <div
      className="absolute top-14 left-0 right-0 z-[5] flex items-start gap-2 px-3 py-2 bg-amber-100/95 backdrop-blur-sm border-b border-amber-300 text-amber-950 text-[11px] leading-snug shadow-sm"
      style={{ pointerEvents: 'auto' }}
      role="status"
    >
      <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden />
      <p>
        <span className="font-bold">Anticipatory AI-based forecasts.</span> Does not replace
        official warnings from the National Weather Service or Texas authorities. Flood forecast
        data © Google Flood Hub, licensed under CC BY 4.0 — used as supplemental situational
        awareness only.
      </p>
    </div>
  );
}

HMEDFloodHubPrdBanner.propTypes = {
  visible: PropTypes.bool.isRequired,
};
