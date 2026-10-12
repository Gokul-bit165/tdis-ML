/**
 * @fileoverview LTS Flash Flood mobile FAB + slide-up panel: severity scale, potential impact, counties.
 */

import React from 'react';
import PropTypes from 'prop-types';
import { SlidersHorizontal, Info, X, Layers, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MotionButton = motion.button;
const MotionDiv = motion.div;
import { HMEDLtsExposureWidgets } from './HMEDLtsExposureWidgets';
import { LTS_ANTICIPATORY_DISCLAIMER } from '../../config/ltsFlashFloodLayerConfig';
import { HMEDLtsCountyListContent } from './HMEDLtsCountyListContent';

/**
 * @param {Object} currentLayer - LAYER_CONFIG.lts_flash_flood
 */
export function LtsFlashFloodMobilePanel({
  isExpanded,
  onOpen,
  onClose,
  onShowInfo,
  currentLayer,
  ltsExposure,
  ltsExposureLoading,
  ltsExposureError,
  ltsMinLevel,
  setLtsMinLevel,
  onLtsExposureRefresh,
  mobileLtsSubTab,
  setMobileLtsSubTab,
  ltsCounties,
  ltsCountiesTotal,
  ltsCountiesRunDate,
  ltsCountiesLoading,
  ltsCountiesError,
  countySearchQuery,
  setCountySearchQuery,
  onLtsCountiesRefresh,
  countyListScopeNote,
  countyEmptyListMessage,
}) {
  const showLtsCountyTab = true;
  const ltsThreatLevelsUi =
    currentLayer?.severityLevelsUi?.length > 0
      ? currentLayer.severityLevelsUi
      : currentLayer?.severityLevels;
  const ltsThreatRangeLabel =
    ltsThreatLevelsUi?.length > 0
      ? `${Math.min(...ltsThreatLevelsUi.map((s) => s.value))} → ${Math.max(...ltsThreatLevelsUi.map((s) => s.value))}`
      : '4 → 5';

  const ltsLegendLevels = ltsThreatLevelsUi?.length
    ? ltsThreatLevelsUi
    : currentLayer?.severityLevels || [];

  return (
    <>
      <AnimatePresence>
        {!isExpanded && (
          <MotionButton
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onOpen}
            className="absolute bottom-28 right-3 z-20 flex items-center gap-2 px-4 py-3 bg-[#324755] text-white rounded-full shadow-lg hover:bg-[#3d5566] transition-colors"
            style={{
              boxShadow: '0 4px 20px rgba(50, 71, 85, 0.35)',
              pointerEvents: 'auto',
            }}
          >
            <SlidersHorizontal className="w-5 h-5" />
            <span className="text-sm font-semibold">Controls</span>
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
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-black/40 z-30"
              style={{ pointerEvents: 'auto' }}
              onClick={onClose}
            />
            <MotionDiv
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{
                type: 'spring',
                damping: 30,
                stiffness: 300,
              }}
              className="absolute bottom-0 left-0 right-0 z-40 bg-white rounded-t-2xl shadow-2xl"
              style={{ maxHeight: '75vh', pointerEvents: 'auto' }}
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-gray-300 rounded-full" />
              </div>

              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  {React.createElement(currentLayer.icon, {
                    className: 'w-5 h-5',
                    style: { color: currentLayer.color },
                  })}
                  <div>
                    <h3 className="text-base font-bold text-[#324755]">{currentLayer.name}</h3>
                    <p
                      className="text-xs text-gray-500"
                      title="24-hour forecast outlook for localized flash-flood threat (LTS). Open Info for anticipatory planning guidance and documentation links."
                    >
                      24-hour flash flood outlook
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onShowInfo(true)}
                    title="TIF / LTS information: 24-hour forecast window, anticipatory planning, forecast vs. observed impacts, and documentation links"
                    aria-label="Open TIF and LTS information including 24-hour forecast window and documentation links"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold transition-colors"
                  >
                    <Info className="w-4 h-4" />
                    Info
                  </button>
                  <button
                    onClick={onClose}
                    className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>

              {showLtsCountyTab && setMobileLtsSubTab && (
                <div className="px-5 pb-3 flex gap-2 border-b border-gray-200">
                  <button
                    type="button"
                    onClick={() => setMobileLtsSubTab('layers')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                      mobileLtsSubTab === 'layers'
                        ? 'bg-[#324755] text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <Layers className="w-4 h-4" />
                    Layers
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileLtsSubTab('counties')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                      mobileLtsSubTab === 'counties'
                        ? 'bg-[#324755] text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <MapPin className="w-4 h-4" />
                    Counties
                  </button>
                </div>
              )}

              <div className="p-5 overflow-y-auto" style={{ maxHeight: 'calc(75vh - 100px)' }}>
                {showLtsCountyTab && mobileLtsSubTab === 'counties' ? (
                  <HMEDLtsCountyListContent
                    counties={ltsCounties}
                    total={ltsCountiesTotal}
                    runDate={ltsCountiesRunDate}
                    loading={!!ltsCountiesLoading}
                    error={ltsCountiesError}
                    searchQuery={countySearchQuery || ''}
                    onSearchChange={setCountySearchQuery || (() => {})}
                    onRefresh={onLtsCountiesRefresh}
                    compact
                    listScopeNote={countyListScopeNote}
                    emptyListMessage={countyEmptyListMessage}
                  />
                ) : (
                  <>
                    {currentLayer.hasTimeWindow === false && (
                      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2">
                        <p className="text-[10px] leading-snug text-amber-900/90">
                          {LTS_ANTICIPATORY_DISCLAIMER}
                        </p>
                      </div>
                    )}

                    <div className="mb-4">
                      <div className="mb-2.5 flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#324755]">
                          {currentLayer.hasTimeWindow === false
                            ? 'Threat severity'
                            : 'Intensity Scale'}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {currentLayer.hasTimeWindow === false
                            ? ltsThreatRangeLabel
                            : 'Low → High'}
                        </span>
                      </div>
                      <div className="relative mb-3">
                        <div
                          className="w-full h-8 rounded-md shadow-inner border border-gray-200 overflow-hidden"
                          style={{ background: currentLayer.gradientBar }}
                        />
                        {ltsLegendLevels.length > 0 ? (
                          <div className="absolute inset-0 flex items-center justify-between px-1 text-[9px] font-bold text-gray-800 pointer-events-none">
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
                  </>
                )}
              </div>
            </MotionDiv>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

LtsFlashFloodMobilePanel.propTypes = {
  isExpanded: PropTypes.bool,
  onOpen: PropTypes.func,
  onClose: PropTypes.func,
  onShowInfo: PropTypes.func,
  currentLayer: PropTypes.object,
  ltsExposure: PropTypes.object,
  ltsExposureLoading: PropTypes.bool,
  ltsExposureError: PropTypes.string,
  ltsMinLevel: PropTypes.number,
  setLtsMinLevel: PropTypes.func,
  onLtsExposureRefresh: PropTypes.func,
  mobileLtsSubTab: PropTypes.oneOf(['layers', 'counties']),
  setMobileLtsSubTab: PropTypes.func,
  ltsCounties: PropTypes.array,
  ltsCountiesTotal: PropTypes.number,
  ltsCountiesRunDate: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  ltsCountiesLoading: PropTypes.bool,
  ltsCountiesError: PropTypes.string,
  countySearchQuery: PropTypes.string,
  setCountySearchQuery: PropTypes.func,
  onLtsCountiesRefresh: PropTypes.func,
  countyListScopeNote: PropTypes.string,
  countyEmptyListMessage: PropTypes.string,
};
