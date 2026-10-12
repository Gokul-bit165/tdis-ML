/**
 * @fileoverview Legend for Active Weather Events (Beta) — Rainfall Tile (vector) + Rainfall Grid (raster).
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, SlidersHorizontal, X } from 'lucide-react';
import { useIsMobile } from '../hooks/use-mobile';
import {
  BARON_RAINFALL_TILE_EVENT_LABEL,
  BARON_RAINFALL_GRID_EVENT_LABEL,
  LAYER_CONFIG,
  BARON_RAINFALL_TILE_LAYER_ID,
} from '../config/baronRainfallGridLayerConfig';

const MotionButton = motion.button;
const MotionDiv = motion.div;

/**
 * @param {object} props
 * @param {boolean} props.tileVisible
 * @param {Function} props.setTileVisible
 * @param {boolean} props.gridVisible
 * @param {Function} props.setGridVisible
 * @param {boolean} [props.loading]
 */
export function BaronRainfallGridLegend({
  tileVisible,
  setTileVisible,
  gridVisible,
  setGridVisible,
  loading = false,
}) {
  const isMobile = useIsMobile();
  const [isExpanded, setIsExpanded] = useState(false);
  const tileLayer = LAYER_CONFIG[BARON_RAINFALL_TILE_LAYER_ID];

  const renderToggle = (label, visible, setVisible) => (
    <button
      type="button"
      onClick={() => setVisible((v) => !v)}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 w-full ${
        visible
          ? 'text-[#324755]'
          : 'text-gray-600 hover:text-[#324755] hover:bg-gray-100 border border-gray-200'
      }`}
    >
      <img
        src="/rainfall.png"
        alt=""
        className="w-4 h-4"
        style={{
          filter: visible ? 'none' : 'grayscale(100%)',
          opacity: visible ? 1 : 0.6,
        }}
        draggable={false}
      />
      <span className="flex-1 text-left leading-tight">{label}</span>
      <Check
        className={`w-4 h-4 shrink-0 ${visible ? 'text-[#324755]' : 'text-gray-400'}`}
        strokeWidth={2.5}
      />
    </button>
  );

  const tileLegend = tileVisible ? (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <p className="text-[10px] font-semibold text-gray-600 mb-2">1-hour rainfall (mm) — H3 tile</p>
      <div
        className="h-2 w-full rounded-full mb-2"
        style={{ background: tileLayer.gradientBar }}
        aria-hidden
      />
      <ul className="flex flex-wrap gap-x-3 gap-y-1">
        {tileLayer.legendStops.map(({ label, color }) => (
          <li key={label} className="flex items-center gap-1 text-[10px] text-gray-600">
            <span
              className="h-2.5 w-2.5 rounded-full border border-gray-200"
              style={{ backgroundColor: color }}
              aria-hidden
            />
            {label}
          </li>
        ))}
      </ul>
    </div>
  ) : null;

  const gridLegend = gridVisible ? (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <p className="text-[10px] font-semibold text-gray-600 mb-1">Rainfall — Raster</p>
      <p className="text-[10px] text-gray-500 leading-snug">
        Pre-rendered PNG tiles from Baron 1-hour raster data (256×256). Visible at zoom 7+.
      </p>
    </div>
  ) : null;

  const panelContent = (
    <>
      <div className="mb-2">
        <label className="block text-xs font-semibold text-gray-700 mb-2">Active Events</label>
        <div className="flex flex-col gap-1.5">
          {loading ? null : (
            <>
              {renderToggle(BARON_RAINFALL_TILE_EVENT_LABEL, tileVisible, setTileVisible)}
              {renderToggle(BARON_RAINFALL_GRID_EVENT_LABEL, gridVisible, setGridVisible)}
            </>
          )}
        </div>
      </div>
      {tileLegend}
      {gridLegend}
    </>
  );

  if (isMobile) {
    return (
      <>
        <AnimatePresence>
          {!isExpanded && (
            <MotionButton
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              type="button"
              onClick={() => setIsExpanded(true)}
              className="absolute bottom-28 right-3 z-20 flex items-center gap-2 px-4 py-3 bg-[#324755] text-white rounded-full shadow-lg"
            >
              <SlidersHorizontal className="w-5 h-5" />
              <span className="text-sm font-semibold">Layers</span>
            </MotionButton>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {isExpanded && (
            <>
              <MotionDiv
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/40 z-30"
                onClick={() => setIsExpanded(false)}
              />
              <MotionDiv
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                className="absolute bottom-0 left-0 right-0 z-40 bg-white rounded-t-2xl shadow-2xl p-5 max-h-[70vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-[#324755]">Rainfall layers</h3>
                  <button
                    type="button"
                    onClick={() => setIsExpanded(false)}
                    className="p-2 rounded-full hover:bg-gray-100"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
                {panelContent}
              </MotionDiv>
            </>
          )}
        </AnimatePresence>
      </>
    );
  }

  return (
    <div className="absolute bottom-14 right-2 z-20 bg-white rounded-lg shadow-lg border border-gray-200 p-4 min-w-[240px]">
      {panelContent}
    </div>
  );
}
