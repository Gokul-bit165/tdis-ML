import React from 'react';
import PropTypes from 'prop-types';
import { GripVertical, ChevronsDown, ChevronsUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ViewModeToggle } from './ViewModeToggle';
import { SummaryStatsBody } from './SummaryStatsBody';
import { isRoadClosuresLayer, isValidSummaryViewMode } from './osaSummaryUtils';

const MotionDiv = motion.div;

/**
 * Draggable desktop summary statistics panel (view mode, search, list, minimize).
 */
export function OSADesktopSummaryPanel({
  summaryDrag,
  currentLayer,
  viewMode,
  handleViewModeChange,
  summaryStats,
  isLoadingData,
  searchQuery,
  setSearchQuery,
  handleSummaryItemClick,
  isSummaryMinimized,
  setIsSummaryMinimized,
}) {
  const showSummaryCard =
    isValidSummaryViewMode(viewMode) && currentLayer.showSummaryStats !== false;
  const showRoadClosuresTip =
    !isSummaryMinimized && isRoadClosuresLayer(currentLayer) && viewMode === 'county';

  return (
    <div
      ref={summaryDrag.panelRef}
      className="flex flex-col-reverse"
      style={{ ...summaryDrag.style, pointerEvents: 'auto' }}
    >
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3">
        <fieldset className="border-0 p-0 m-0 min-w-0">
          <legend className="block text-xs font-semibold text-gray-700 mb-2 px-0 float-none w-full">
            View Mode
          </legend>
          <ViewModeToggle
            currentLayerId={currentLayer.id}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            showTitles
          />
        </fieldset>
      </div>

      <AnimatePresence mode="wait">
        {showSummaryCard ? (
          <MotionDiv
            key={viewMode}
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: 'auto', marginBottom: 8 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{
              duration: 0.25,
              ease: [0.4, 0, 0.2, 1],
              opacity: { duration: 0.2 },
              height: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
            }}
            style={{ overflow: 'hidden' }}
            className="bg-white rounded-lg shadow-lg border border-gray-200 p-3 w-80"
          >
            <div
              ref={summaryDrag.dragHandleRef}
              className="mb-3 pb-2 border-b border-gray-200 cursor-move"
              style={{ userSelect: 'none' }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GripVertical className="w-4 h-4 text-gray-400" />
                  <p className="block text-sm font-semibold text-[#324755] m-0">
                    Summary Statistics
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsSummaryMinimized(!isSummaryMinimized);
                  }}
                  className="flex items-center justify-center w-8 h-8 rounded-md bg-orange-100 hover:bg-orange-200 transition-all duration-200 group"
                  title={isSummaryMinimized ? 'Expand summary' : 'Collapse summary'}
                  aria-label={isSummaryMinimized ? 'Expand summary' : 'Collapse summary'}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {isSummaryMinimized ? (
                    <ChevronsUp
                      className="w-5 h-5 text-orange-600 group-hover:text-orange-700 transition-colors font-bold"
                      strokeWidth={2.5}
                    />
                  ) : (
                    <ChevronsDown
                      className="w-5 h-5 text-orange-600 group-hover:text-orange-700 transition-colors font-bold"
                      strokeWidth={2.5}
                    />
                  )}
                </button>
              </div>
              {showRoadClosuresTip ? (
                <p className="text-xs font-medium text-[#324755] mt-1.5" aria-live="polite">
                  Click a county to zoom to it on the map.
                </p>
              ) : null}
            </div>

            <AnimatePresence>
              {isSummaryMinimized ? null : (
                <MotionDiv
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  style={{ overflow: 'hidden' }}
                >
                  <SummaryStatsBody
                    currentLayerId={currentLayer.id}
                    viewMode={viewMode}
                    summaryStats={summaryStats}
                    isLoadingData={isLoadingData}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    handleSummaryItemClick={handleSummaryItemClick}
                    variant="desktop"
                  />
                </MotionDiv>
              )}
            </AnimatePresence>
          </MotionDiv>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

OSADesktopSummaryPanel.propTypes = {
  summaryDrag: PropTypes.object,
  currentLayer: PropTypes.object,
  viewMode: PropTypes.string,
  handleViewModeChange: PropTypes.func,
  summaryStats: PropTypes.object,
  isLoadingData: PropTypes.bool,
  searchQuery: PropTypes.string,
  setSearchQuery: PropTypes.func,
  handleSummaryItemClick: PropTypes.func,
  isSummaryMinimized: PropTypes.bool,
  setIsSummaryMinimized: PropTypes.func,
};
