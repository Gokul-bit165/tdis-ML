import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Info, Zap, X, SlidersHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { OSAMobileSummaryTab } from './OSAMobileSummaryTab';
import { OSAMobileLegendTab } from './OSAMobileLegendTab';

const MotionButton = motion.button;
const MotionDiv = motion.div;

/**
 * Mobile FAB + slide-up panel with Summary and Legend tabs.
 */
export function OSAMobilePanel({
  isExpanded,
  onOpen,
  onClose,
  onShowInfo,
  mobileActiveTab,
  setMobileActiveTab,
  currentLayer,
  selectedLayer,
  setSelectedLayer,
  viewMode,
  handleViewModeChange,
  setViewMode,
  summaryStats,
  isLoadingData,
  searchQuery,
  setSearchQuery,
  handleSummaryItemClick,
  mapRef,
  isHazardLayerReady,
}) {
  const [totalAlertsCount, setTotalAlertsCount] = useState(0);
  const onTotalAlertsChange = useCallback((count) => setTotalAlertsCount(count), []);

  const showSummaryTab = currentLayer.showSummaryStats !== false;
  const showSummaryContent = mobileActiveTab === 'summary' && showSummaryTab;
  const legendTabActive = mobileActiveTab === 'legend' || !showSummaryTab;

  return (
    <>
      <AnimatePresence>
        {isExpanded ? null : (
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
        {isExpanded ? (
          <>
            <MotionDiv
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-black/40 z-30"
              style={{ pointerEvents: 'auto' }}
              onClick={() => onClose()}
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
              style={{ maxHeight: '80vh', pointerEvents: 'auto' }}
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-gray-300 rounded-full" />
              </div>

              <div className="px-5 py-3 border-b border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-orange-500" />
                    <h3 className="text-base font-bold text-[#324755]">Power Outages</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onShowInfo(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition-colors"
                    >
                      <Info className="w-4 h-4" />
                      Info
                    </button>
                    <button
                      onClick={() => onClose()}
                      className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>
                </div>

                <div className="flex gap-2">
                  {showSummaryTab ? (
                    <button
                      onClick={() => setMobileActiveTab('summary')}
                      className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                        mobileActiveTab === 'summary'
                          ? 'bg-[#324755] text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      Summary
                    </button>
                  ) : null}
                  <button
                    onClick={() => setMobileActiveTab('legend')}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      legendTabActive
                        ? 'bg-[#324755] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Legend
                  </button>
                </div>
              </div>

              <div className="p-5 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 140px)' }}>
                {showSummaryContent ? (
                  <OSAMobileSummaryTab
                    currentLayer={currentLayer}
                    viewMode={viewMode}
                    handleViewModeChange={handleViewModeChange}
                    summaryStats={summaryStats}
                    isLoadingData={isLoadingData}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    handleSummaryItemClick={handleSummaryItemClick}
                  />
                ) : (
                  <OSAMobileLegendTab
                    selectedLayer={selectedLayer}
                    setSelectedLayer={setSelectedLayer}
                    setViewMode={setViewMode}
                    mapRef={mapRef}
                    isHazardLayerReady={isHazardLayerReady}
                    totalAlertsCount={totalAlertsCount}
                    onTotalAlertsChange={onTotalAlertsChange}
                  />
                )}
              </div>
            </MotionDiv>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}

OSAMobilePanel.propTypes = {
  isExpanded: PropTypes.bool,
  onOpen: PropTypes.func,
  onClose: PropTypes.func,
  onShowInfo: PropTypes.func,
  mobileActiveTab: PropTypes.string,
  setMobileActiveTab: PropTypes.func,
  currentLayer: PropTypes.object,
  selectedLayer: PropTypes.string,
  setSelectedLayer: PropTypes.func,
  viewMode: PropTypes.string,
  handleViewModeChange: PropTypes.func,
  setViewMode: PropTypes.func,
  summaryStats: PropTypes.object,
  isLoadingData: PropTypes.bool,
  searchQuery: PropTypes.string,
  setSearchQuery: PropTypes.func,
  handleSummaryItemClick: PropTypes.func,
  mapRef: PropTypes.object,
  isHazardLayerReady: PropTypes.bool,
};
