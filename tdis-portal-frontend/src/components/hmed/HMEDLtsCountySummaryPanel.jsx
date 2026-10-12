/**
 * Desktop: draggable left stack — LTS county list (OSA summary-style).
 */

import React from 'react';
import PropTypes from 'prop-types';
import { GripVertical, ChevronsDown, ChevronsUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { HMEDLtsCountyListContent } from './HMEDLtsCountyListContent';

const MotionDiv = motion.div;

export function HMEDLtsCountySummaryPanel({
  summaryDrag,
  isMinimized,
  setIsMinimized,
  panelTitle = 'LTS by county',
  panelSubtitle = 'Latest run · browse & search',
  listScopeNote,
  emptyListMessage,
  counties,
  total,
  runDate,
  loading,
  error,
  searchQuery,
  onSearchChange,
  onRefresh,
}) {
  return (
    <div
      ref={summaryDrag.panelRef}
      className="flex flex-col-reverse"
      style={{ ...summaryDrag.style, pointerEvents: 'auto' }}
    >
      <MotionDiv
        initial={{ opacity: 0, height: 0, marginBottom: 0 }}
        animate={{ opacity: 1, height: 'auto', marginBottom: 8 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-lg shadow-lg border border-gray-200 w-80 max-w-[calc(100vw-2rem)]"
      >
        <div
          ref={summaryDrag.dragHandleRef}
          className="px-3 pt-3 pb-2 border-b border-gray-200 cursor-move"
          style={{ userSelect: 'none' }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <GripVertical className="w-4 h-4 text-gray-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#324755] truncate">{panelTitle}</p>
                <p className="text-[10px] text-gray-500 truncate">{panelSubtitle}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsMinimized(!isMinimized);
              }}
              className="flex items-center justify-center w-8 h-8 rounded-md bg-blue-100 hover:bg-blue-200 transition-colors shrink-0"
              title={isMinimized ? 'Expand' : 'Collapse'}
              aria-label={isMinimized ? 'Expand county panel' : 'Collapse county panel'}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {isMinimized ? (
                <ChevronsUp className="w-5 h-5 text-blue-700" strokeWidth={2.5} />
              ) : (
                <ChevronsDown className="w-5 h-5 text-blue-700" strokeWidth={2.5} />
              )}
            </button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {!isMinimized && (
            <MotionDiv
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}
            >
              <div className="p-3">
                <HMEDLtsCountyListContent
                  counties={counties}
                  total={total}
                  runDate={runDate}
                  loading={loading}
                  error={error}
                  searchQuery={searchQuery}
                  onSearchChange={onSearchChange}
                  onRefresh={onRefresh}
                  compact={false}
                  listScopeNote={listScopeNote}
                  emptyListMessage={emptyListMessage}
                />
              </div>
            </MotionDiv>
          )}
        </AnimatePresence>
      </MotionDiv>
    </div>
  );
}

HMEDLtsCountySummaryPanel.propTypes = {
  summaryDrag: PropTypes.object.isRequired,
  isMinimized: PropTypes.bool.isRequired,
  setIsMinimized: PropTypes.func.isRequired,
  panelTitle: PropTypes.string,
  panelSubtitle: PropTypes.string,
  listScopeNote: PropTypes.string,
  emptyListMessage: PropTypes.string,
  counties: PropTypes.array,
  total: PropTypes.number,
  runDate: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  loading: PropTypes.bool,
  error: PropTypes.string,
  searchQuery: PropTypes.string.isRequired,
  onSearchChange: PropTypes.func.isRequired,
  onRefresh: PropTypes.func,
};
