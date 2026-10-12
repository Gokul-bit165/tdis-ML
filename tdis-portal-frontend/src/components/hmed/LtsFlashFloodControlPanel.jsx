/**
 * @fileoverview LTS Flash Flood desktop draggable control panel (standalone tab).
 */

import React from 'react';
import PropTypes from 'prop-types';
import { GripVertical, Info, ChevronsDown, ChevronsUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MotionDiv = motion.div;
import { HMEDLtsExposureWidgets } from './HMEDLtsExposureWidgets';
import { LTS_ANTICIPATORY_DISCLAIMER } from '../../config/ltsFlashFloodLayerConfig';

/**
 * @param {Object} controlDrag - useDraggable return (panelRef, dragHandleRef, style)
 * @param {Object} currentLayer - LAYER_CONFIG.lts_flash_flood
 * @param {Function} onToggleInfo - () => void, toggles info modal
 * @param {boolean} isMinimized
 * @param {Function} setIsMinimized
 * @param {object} [ltsExposure] potential impact summary payload (`exposure-summary` API)
 * @param {boolean} [ltsExposureLoading]
 * @param {string} [ltsExposureError]
 * @param {number} [ltsMinLevel]
 * @param {Function} [setLtsMinLevel]
 * @param {Function} [onLtsExposureRefresh]
 */
export function LtsFlashFloodControlPanel({
  controlDrag,
  currentLayer,
  onToggleInfo,
  isMinimized,
  setIsMinimized,
  ltsExposure,
  ltsExposureLoading,
  ltsExposureError,
  ltsMinLevel,
  setLtsMinLevel,
  onLtsExposureRefresh,
}) {
  const ltsThreatLevelsUi =
    currentLayer?.severityLevelsUi?.length > 0
      ? currentLayer.severityLevelsUi
      : currentLayer?.severityLevels;
  const ltsThreatRangeLabel =
    ltsThreatLevelsUi?.length > 0
      ? `${Math.min(...ltsThreatLevelsUi.map((s) => s.value))} → ${Math.max(...ltsThreatLevelsUi.map((s) => s.value))}`
      : '4 → 5';

  /** LTS-only panel: never use HSI threshold keys (minimal/elevated/…/extreme) — Flood Hub also has hasTimeWindow false. */
  const ltsLegendLevels = ltsThreatLevelsUi?.length
    ? ltsThreatLevelsUi
    : currentLayer?.severityLevels || [];

  return (
    <div
      ref={controlDrag.panelRef}
      className="bg-white rounded-lg shadow-lg border border-gray-200 p-4 w-80 max-w-[calc(100vw-2rem)] max-h-[calc(100vh-120px)] overflow-y-auto"
      style={{ ...controlDrag.style, pointerEvents: 'auto' }}
    >
      <div className="flex items-center justify-between pb-3 border-b border-gray-200">
        <div
          ref={controlDrag.dragHandleRef}
          className="flex items-center gap-2 cursor-move flex-1"
          style={{ userSelect: 'none' }}
        >
          <GripVertical className="w-4 h-4 text-gray-400" />
          <div className="flex items-center gap-2.5">
            {React.createElement(currentLayer.icon, {
              className: 'w-5 h-5',
              style: { color: currentLayer.color },
            })}
            <div>
              <h3 className="text-sm font-bold text-[#324755]">{currentLayer.name}</h3>
              <p
                className="text-xs text-gray-500"
                title="24-hour forecast outlook for localized flash-flood threat (LTS). Open Info for anticipatory planning guidance and documentation links."
              >
                24-hour flash flood outlook
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleInfo}
            className={`relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-white shadow-md hover:shadow-lg transition-all duration-200 group ${
              currentLayer.hasTimeWindow === false
                ? 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800'
                : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700'
            }`}
            title="TIF / LTS information: 24-hour forecast window, anticipatory planning, forecast vs. observed impacts, and documentation links"
            aria-label="Open TIF and LTS information including 24-hour forecast window and documentation links"
          >
            <Info className="w-4 h-4 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-semibold">Info</span>
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-yellow-400 rounded-full animate-pulse border-2 border-white" />
          </button>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="flex items-center justify-center w-8 h-8 rounded-md bg-blue-100 hover:bg-blue-200 transition-all duration-200 group"
            title={isMinimized ? 'Expand panel' : 'Collapse panel'}
            aria-label={isMinimized ? 'Expand panel' : 'Collapse panel'}
          >
            {isMinimized ? (
              <ChevronsUp
                className="w-5 h-5 text-blue-600 group-hover:text-blue-700 transition-colors"
                strokeWidth={2.5}
              />
            ) : (
              <ChevronsDown
                className="w-5 h-5 text-blue-600 group-hover:text-blue-700 transition-colors"
                strokeWidth={2.5}
              />
            )}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {!isMinimized && (
          <MotionDiv
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="pt-4">
              {/* LTS disclaimer strip */}
              {currentLayer.hasTimeWindow === false && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2">
                  <p className="text-[10px] leading-snug text-amber-900/90">
                    {LTS_ANTICIPATORY_DISCLAIMER}
                  </p>
                </div>
              )}

              {/* Intensity / severity scale */}
              <div className="mb-4">
                <div className="mb-2.5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#324755]">
                    {currentLayer.hasTimeWindow === false ? 'Threat severity' : 'Intensity Scale'}
                  </span>
                  <span className="text-[10px] text-gray-500">
                    {currentLayer.hasTimeWindow === false ? ltsThreatRangeLabel : 'Low → High'}
                  </span>
                </div>
                <div className="relative mb-3">
                  <div
                    className="w-full h-8 rounded-md shadow-inner border border-gray-200 overflow-hidden"
                    style={{ background: currentLayer.gradientBar }}
                  />
                  {ltsLegendLevels.length > 0 ? (
                    <div className="absolute inset-0 flex items-center justify-between px-1 text-[9px] font-bold text-gray-800 pointer-events-none drop-shadow-sm">
                      {ltsLegendLevels.map((s) => (
                        <span key={s.value} className="bg-white/85 px-0.5 rounded">
                          {s.value}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                {ltsLegendLevels.length > 0 ? (
                  <div className="space-y-1.5">
                    {ltsLegendLevels.map((s) => (
                      <div
                        key={s.value}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs"
                        style={{
                          backgroundColor: `${s.color}18`,
                          borderColor: `${s.color}55`,
                        }}
                      >
                        <div
                          className="w-3 h-3 rounded-full shrink-0 border border-white shadow-sm"
                          style={{ backgroundColor: s.color }}
                        />
                        <span className="font-semibold text-gray-800 w-4">{s.value}</span>
                        <span className="text-gray-700">{s.label}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              {currentLayer.hasTimeWindow === false &&
                ltsMinLevel != null &&
                setLtsMinLevel &&
                onLtsExposureRefresh && (
                  <HMEDLtsExposureWidgets
                    data={ltsExposure}
                    loading={!!ltsExposureLoading}
                    error={ltsExposureError}
                    minLtsLevel={ltsMinLevel}
                    onMinLtsLevelChange={setLtsMinLevel}
                    onRefresh={onLtsExposureRefresh}
                    severityLevels={
                      currentLayer.severityLevelsUi?.length
                        ? currentLayer.severityLevelsUi
                        : currentLayer.severityLevels
                    }
                  />
                )}

              <div className="pt-3 border-t border-gray-200">
                <p
                  className="text-[10px] text-gray-500 text-center"
                  title="Hex popups show forecasted LTS fields for the 24-hour window—not observed damage."
                >
                  Click hex for forecast details (24-hour outlook)
                </p>
              </div>
            </div>
          </MotionDiv>
        )}
      </AnimatePresence>
    </div>
  );
}

LtsFlashFloodControlPanel.propTypes = {
  controlDrag: PropTypes.object,
  currentLayer: PropTypes.object,
  onToggleInfo: PropTypes.func,
  isMinimized: PropTypes.bool,
  setIsMinimized: PropTypes.func,
  ltsExposure: PropTypes.object,
  ltsExposureLoading: PropTypes.bool,
  ltsExposureError: PropTypes.string,
  ltsMinLevel: PropTypes.number,
  setLtsMinLevel: PropTypes.func,
  onLtsExposureRefresh: PropTypes.func,
};
