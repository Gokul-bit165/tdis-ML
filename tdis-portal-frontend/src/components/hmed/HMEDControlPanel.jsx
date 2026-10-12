/**
 * @fileoverview HMED desktop draggable control panel: layer + hour selection, intensity scale, Info, minimize.
 */

import React from "react";
import PropTypes from "prop-types";
import { GripVertical, Info, ChevronsDown, ChevronsUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const MotionDiv = motion.div;
import { HMEDPanelBody } from "./HMEDPanelShared";

function PanelTitle({ currentLayer, selectedHours }) {
    const hasTimeWindow = currentLayer.hasTimeWindow !== false;
    return (
        <div>
            <h3 className="text-sm font-bold text-[#324755]">
                {hasTimeWindow ? `${currentLayer.name} HSI` : currentLayer.name}
            </h3>
            <p className="text-xs text-gray-500">
                {hasTimeWindow
                    ? `${selectedHours}h window`
                    : currentLayer.panelSubtitle ?? "Localized threat severity"}
            </p>
        </div>
    );
}

PanelTitle.propTypes = {
    currentLayer: PropTypes.object,
    selectedHours: PropTypes.number,
};

function MinimizeToggleButton({ isMinimized, setIsMinimized }) {
    const label = isMinimized ? "Expand panel" : "Collapse panel";
    return (
        <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="flex items-center justify-center w-8 h-8 rounded-md bg-blue-100 hover:bg-blue-200 transition-all duration-200 group"
            title={label}
            aria-label={label}
        >
            {isMinimized ? (
                <ChevronsUp className="w-5 h-5 text-blue-600 group-hover:text-blue-700 transition-colors" strokeWidth={2.5} />
            ) : (
                <ChevronsDown className="w-5 h-5 text-blue-600 group-hover:text-blue-700 transition-colors" strokeWidth={2.5} />
            )}
        </button>
    );
}

MinimizeToggleButton.propTypes = {
    isMinimized: PropTypes.bool,
    setIsMinimized: PropTypes.func,
};

function PanelHeader({
    controlDrag,
    currentLayer,
    selectedHours,
    onToggleInfo,
    isMinimized,
    setIsMinimized,
}) {
    const infoButtonTheme =
        currentLayer.hasTimeWindow === false
            ? "bg-gradient-to-r from-teal-600 to-cyan-700 hover:from-teal-700 hover:to-cyan-800"
            : "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700";
    return (
        <div className="flex items-center justify-between pb-3 border-b border-gray-200">
            <div
                ref={controlDrag.dragHandleRef}
                className="flex items-center gap-2 cursor-move flex-1"
                style={{ userSelect: "none" }}
            >
                <GripVertical className="w-4 h-4 text-gray-400" />
                <div className="flex items-center gap-2.5">
                    {React.createElement(currentLayer.icon, {
                        className: "w-5 h-5",
                        style: { color: currentLayer.color }
                    })}
                    <PanelTitle currentLayer={currentLayer} selectedHours={selectedHours} />
                </div>
            </div>
            <div className="flex items-center gap-2">
                <button
                    onClick={onToggleInfo}
                    className={`relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-white shadow-md hover:shadow-lg transition-all duration-200 group ${infoButtonTheme}`}
                    title="Show information"
                    aria-label="Show information"
                >
                    <Info className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-semibold">Info</span>
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-yellow-400 rounded-full animate-pulse border-2 border-white" />
                </button>
                <MinimizeToggleButton isMinimized={isMinimized} setIsMinimized={setIsMinimized} />
            </div>
        </div>
    );
}

PanelHeader.propTypes = {
    controlDrag: PropTypes.object,
    currentLayer: PropTypes.object,
    selectedHours: PropTypes.number,
    onToggleInfo: PropTypes.func,
    isMinimized: PropTypes.bool,
    setIsMinimized: PropTypes.func,
};

/**
 * @param {Object} controlDrag - useDraggable return (panelRef, dragHandleRef, style)
 * @param {Object} currentLayer - LAYER_CONFIG[selectedLayer]
 * @param {string} selectedLayer
 * @param {Function} setSelectedLayer
 * @param {number} selectedHours
 * @param {Function} setSelectedHours
 * @param {Function} onToggleInfo - () => void, toggles info modal
 * @param {boolean} isMinimized
 * @param {Function} setIsMinimized
 * @param {object} [floodPrdToggles] - Flood Hub overlay toggles (when layer is Flood Hub)
 * @param {Function} [patchFloodPrdToggles] - (patch: object) => void
 */
export function HMEDControlPanel({
    controlDrag,
    currentLayer,
    selectedLayer,
    setSelectedLayer,
    selectedHours,
    setSelectedHours,
    onToggleInfo,
    isMinimized,
    setIsMinimized,
    floodPrdToggles,
    patchFloodPrdToggles,
    isLoading = false,
    loadingMessage = "Loading layer data…",
}) {
    return (
        <div
            ref={controlDrag.panelRef}
            className="bg-white rounded-lg shadow-lg border border-gray-200 p-4 w-80 max-w-[calc(100vw-2rem)] max-h-[calc(100vh-120px)] overflow-y-auto"
            style={{ ...controlDrag.style, pointerEvents: "auto" }}
        >
            <PanelHeader
                controlDrag={controlDrag}
                currentLayer={currentLayer}
                selectedHours={selectedHours}
                onToggleInfo={onToggleInfo}
                isMinimized={isMinimized}
                setIsMinimized={setIsMinimized}
            />

            <AnimatePresence>
                {!isMinimized && (
                    <MotionDiv
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        style={{ overflow: "hidden" }}
                    >
                        <div className="pt-4">
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
                                floodHubHint="Click hexes, pins, or event areas — details open in side panel."
                                defaultHint="Click hex for details"
                            />
                        </div>
                    </MotionDiv>
                )}
            </AnimatePresence>
        </div>
    );
}

HMEDControlPanel.propTypes = {
    controlDrag: PropTypes.object,
    currentLayer: PropTypes.object,
    selectedLayer: PropTypes.string,
    setSelectedLayer: PropTypes.func,
    selectedHours: PropTypes.number,
    setSelectedHours: PropTypes.func,
    onToggleInfo: PropTypes.func,
    isMinimized: PropTypes.bool,
    setIsMinimized: PropTypes.func,
    floodPrdToggles: PropTypes.object,
    patchFloodPrdToggles: PropTypes.func,
    isLoading: PropTypes.bool,
    loadingMessage: PropTypes.string,
};
