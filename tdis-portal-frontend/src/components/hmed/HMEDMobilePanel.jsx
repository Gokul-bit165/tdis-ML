/**
 * @fileoverview HMED mobile FAB + slide-up panel: layer + hour selection, intensity scale, Info.
 */

import React from "react";
import { SlidersHorizontal, Info, X } from "lucide-react";
import PropTypes from "prop-types";
import { motion, AnimatePresence } from "framer-motion";
import { HMEDPanelBody } from "./HMEDPanelShared";

/**
 * @param {boolean} isExpanded
 * @param {Function} onOpen - () => void
 * @param {Function} onClose - () => void
 * @param {Function} onShowInfo - (show: boolean) => void, open info modal
 * @param {Object} currentLayer - LAYER_CONFIG[selectedLayer]
 * @param {string} selectedLayer
 * @param {Function} setSelectedLayer
 * @param {number} selectedHours
 * @param {Function} setSelectedHours
 * @param {object} [floodPrdToggles]
 * @param {Function} [patchFloodPrdToggles]
 */
export function HMEDMobilePanel({
    isExpanded,
    onOpen,
    onClose,
    onShowInfo,
    currentLayer,
    selectedLayer,
    setSelectedLayer,
    selectedHours,
    setSelectedHours,
    floodPrdToggles,
    patchFloodPrdToggles,
    isLoading = false,
    loadingMessage = "Loading layer data…",
}) {
    return (
        <>
            <AnimatePresence>
                {!isExpanded && (
                    <motion.button
                        type="button"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={onOpen}
                        className="absolute bottom-28 right-3 z-20 flex items-center gap-2 px-4 py-3 bg-[#324755] text-white rounded-full shadow-lg hover:bg-[#3d5566] transition-colors"
                        style={{
                            boxShadow: "0 4px 20px rgba(50, 71, 85, 0.35)",
                            pointerEvents: "auto"
                        }}
                    >
                        <SlidersHorizontal className="w-5 h-5" />
                        <span className="text-sm font-semibold">Controls</span>
                    </motion.button>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isExpanded && (
                    <>
                        <motion.button
                            type="button"
                            aria-label="Close hazard controls"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="absolute inset-0 bg-black/40 z-30"
                            style={{ pointerEvents: "auto" }}
                            onClick={onClose}
                        />
                        <motion.div
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{
                                type: "spring",
                                damping: 30,
                                stiffness: 300
                            }}
                            className="absolute bottom-0 left-0 right-0 z-40 bg-white rounded-t-2xl shadow-2xl"
                            style={{ maxHeight: "75vh", pointerEvents: "auto" }}
                        >
                            <div className="flex justify-center pt-3 pb-1">
                                <div className="w-10 h-1 bg-gray-300 rounded-full" />
                            </div>

                            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
                                <div className="flex items-center gap-2">
                                    {React.createElement(currentLayer.icon, {
                                        className: "w-5 h-5",
                                        style: { color: currentLayer.color }
                                    })}
                                    <div>
                                        <h3 className="text-base font-bold text-[#324755]">
                                            {currentLayer.hasTimeWindow === false
                                                ? currentLayer.name
                                                : `${currentLayer.name} HSI`}
                                        </h3>
                                        <p className="text-xs text-gray-500">
                                            {currentLayer.hasTimeWindow === false
                                                ? currentLayer.panelSubtitle ?? "Localized threat severity"
                                                : `${selectedHours}h window`}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => onShowInfo(true)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold transition-colors"
                                    >
                                        <Info className="w-4 h-4" />
                                        Info
                                    </button>
                                    <button
                                        type="button"
                                        aria-label="Close hazard controls"
                                        onClick={onClose}
                                        className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                                    >
                                        <X className="w-5 h-5 text-gray-500" />
                                    </button>
                                </div>
                            </div>

                            <div className="p-5 overflow-y-auto" style={{ maxHeight: "calc(75vh - 100px)" }}>
                                <HMEDPanelBody
                                    currentLayer={currentLayer}
                                    selectedLayer={selectedLayer}
                                    setSelectedLayer={setSelectedLayer}
                                    selectedHours={selectedHours}
                                    setSelectedHours={setSelectedHours}
                                    floodPrdToggles={floodPrdToggles}
                                    patchFloodPrdToggles={patchFloodPrdToggles}
                                    isLoading={isLoading}
                                    loadingMessage={loadingMessage}
                                    floodHubExtra={
                                        <p className="text-[10px] leading-snug text-sky-900/90 mt-2 pt-2 border-t border-sky-100">
                                            <span className="font-semibold">Significant events</span> and{" "}
                                            <span className="font-semibold">inundation</span>: tap{" "}
                                            <span className="font-semibold">Overlays</span> (bottom-left).
                                        </p>
                                    }
                                    floodHubHint="Tap hexes, pins, or events — side panel opens."
                                    defaultHint="Click areas for details"
                                />
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}

HMEDMobilePanel.propTypes = {
    isExpanded: PropTypes.bool,
    onOpen: PropTypes.func,
    onClose: PropTypes.func,
    onShowInfo: PropTypes.func,
    currentLayer: PropTypes.object,
    selectedLayer: PropTypes.string,
    setSelectedLayer: PropTypes.func,
    selectedHours: PropTypes.number,
    setSelectedHours: PropTypes.func,
    floodPrdToggles: PropTypes.object,
    patchFloodPrdToggles: PropTypes.func,
    isLoading: PropTypes.bool,
    loadingMessage: PropTypes.string,
};
