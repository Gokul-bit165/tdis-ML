/**
 * @fileoverview Draggable / sheet widget for Google Flood Hub supplemental overlays (toggles).
 * Keeps the main HMED control panel simple; only shown when Flood Hub is the selected layer.
 */

import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { GripVertical, ChevronsDown, ChevronsUp, Layers, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { FloodHubPrdControls } from './FloodHubPrdControls';

const MotionDiv = motion.div;

/**
 * @param {object} props
 * @param {boolean} props.visible
 * @param {boolean} props.isMobile
 * @param {object} props.controlDrag - useDraggable() return (desktop only)
 * @param {object} props.toggles
 * @param {Function} props.patchFloodPrdToggles
 */
export function FloodHubPrdExtensionsWidget({
  visible,
  isMobile,
  controlDrag,
  toggles,
  patchFloodPrdToggles,
}) {
  const [minimized, setMinimized] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  if (!visible) return null;

  if (isMobile) {
    return (
      <>
        <AnimatePresence>
          {!sheetOpen && (
            <motion.button
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={() => setSheetOpen(true)}
              className="absolute bottom-28 left-3 z-20 flex items-center gap-2 px-4 py-3 bg-sky-800 text-white rounded-full shadow-lg hover:bg-sky-900 transition-colors"
              style={{
                boxShadow: '0 4px 20px rgba(12, 74, 110, 0.35)',
                pointerEvents: 'auto',
              }}
              aria-label="Open Flood Hub overlays"
            >
              <Layers className="w-5 h-5" />
              <span className="text-sm font-semibold">Overlays</span>
            </motion.button>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {sheetOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 bg-black/40 z-[35]"
                style={{ pointerEvents: 'auto' }}
                onClick={() => setSheetOpen(false)}
              />
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="absolute bottom-0 left-0 right-0 z-[45] bg-white rounded-t-2xl shadow-2xl"
                style={{ maxHeight: '70vh', pointerEvents: 'auto' }}
                role="dialog"
                aria-modal="true"
                aria-label="Flood Hub overlays"
              >
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-10 h-1 bg-gray-300 rounded-full" />
                </div>
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-sky-700" />
                    <div>
                      <h3 className="text-base font-bold text-[#324755]">Flood Hub overlays</h3>
                      <p className="text-xs text-gray-500">
                        Significant events, inundation, and urban flash flood — supplemental map
                        layers.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSheetOpen(false)}
                    className="p-2 rounded-full hover:bg-gray-100"
                    aria-label="Close overlays"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
                <div className="p-5 overflow-y-auto" style={{ maxHeight: 'calc(70vh - 100px)' }}>
                  <FloodHubPrdControls toggles={toggles} setToggles={patchFloodPrdToggles} />
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </>
    );
  }

  return (
    <div
      ref={controlDrag.panelRef}
      className="bg-white rounded-lg shadow-lg border border-sky-200 p-3 w-80 max-w-[calc(100vw-2rem)] max-h-[calc(100vh-160px)] overflow-y-auto"
      style={{ ...controlDrag.style, zIndex: 11, pointerEvents: 'auto' }}
    >
      <div className="flex items-center justify-between pb-2 border-b border-sky-100">
        <div
          ref={controlDrag.dragHandleRef}
          className="flex items-center gap-2 cursor-move flex-1 min-w-0"
          style={{ userSelect: 'none' }}
        >
          <GripVertical className="w-4 h-4 text-sky-400 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-[#324755] truncate">Flood Hub overlays</h3>
            <p className="text-[10px] text-gray-500">
              Significant events, inundation & urban flash · bottom-left · drag to move
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMinimized(!minimized)}
          className="flex items-center justify-center w-8 h-8 rounded-md bg-sky-100 hover:bg-sky-200 transition-colors shrink-0"
          title={minimized ? 'Expand overlays' : 'Collapse overlays'}
          aria-label={minimized ? 'Expand overlays panel' : 'Collapse overlays panel'}
        >
          {minimized ? (
            <ChevronsUp className="w-5 h-5 text-sky-800" strokeWidth={2.5} />
          ) : (
            <ChevronsDown className="w-5 h-5 text-sky-800" strokeWidth={2.5} />
          )}
        </button>
      </div>

      <AnimatePresence>
        {!minimized && (
          <MotionDiv
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="pt-3">
              <FloodHubPrdControls toggles={toggles} setToggles={patchFloodPrdToggles} />
            </div>
          </MotionDiv>
        )}
      </AnimatePresence>
    </div>
  );
}

FloodHubPrdExtensionsWidget.propTypes = {
  visible: PropTypes.bool.isRequired,
  isMobile: PropTypes.bool.isRequired,
  controlDrag: PropTypes.object,
  toggles: PropTypes.object.isRequired,
  patchFloodPrdToggles: PropTypes.func.isRequired,
};
