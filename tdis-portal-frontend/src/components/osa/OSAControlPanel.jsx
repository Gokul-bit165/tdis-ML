import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Info, GripVertical, ChevronsDown, ChevronsUp, BarChart2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MotionDiv = motion.div;
import { LayerSelector } from './LayerSelector';
import { OutageSeverityLegend } from './OutageSeverityLegend';
import { AlertTypesLegend } from './AlertTypesLegend';
import { PanelLoadingState } from '../ui/PanelLoadingState';

/**
 * Draggable control panel: layer selector, outage severity legend, alert types legend, help text, minimize.
 */
export function OSAControlPanel({
    controlDrag,
    currentLayer,
    selectedLayer,
    setSelectedLayer,
    setViewMode,
    onShowInfo,
    isMinimized,
    setIsMinimized,
    mapRef,
    isHazardLayerReady,
    isLoading = false,
}) {
    const [totalAlertsCount, setTotalAlertsCount] = useState(0);
    const onTotalAlertsChange = useCallback((count) => setTotalAlertsCount(count), []);

    return (
        <div
            ref={controlDrag.panelRef}
            className="bg-white rounded-lg shadow-lg border border-gray-200 p-4 w-80"
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
                        {React.createElement(currentLayer.icon, { className: 'w-5 h-5', style: { color: currentLayer.color } })}
                        <div>
                            <h3 className="text-sm font-bold text-[#324755]">{currentLayer.name}</h3>
                            <p className="text-xs text-gray-500">Infrastructure Status</p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => onShowInfo(true)}
                        className="relative flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-md hover:shadow-lg transition-all duration-200 group"
                        title="Show information"
                        aria-label="Show information"
                    >
                        <Info className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-semibold">Info</span>
                    </button>
                    <button
                        onClick={() => setIsMinimized(!isMinimized)}
                        className="flex items-center justify-center w-8 h-8 rounded-md bg-orange-100 hover:bg-orange-200 transition-all duration-200 group"
                        title={isMinimized ? 'Expand panel' : 'Collapse panel'}
                        aria-label={isMinimized ? 'Expand panel' : 'Collapse panel'}
                    >
                        {isMinimized ? (
                            <ChevronsUp className="w-5 h-5 text-orange-600 group-hover:text-orange-700 transition-colors" strokeWidth={2.5} />
                        ) : (
                            <ChevronsDown className="w-5 h-5 text-orange-600 group-hover:text-orange-700 transition-colors" strokeWidth={2.5} />
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
                        className="max-h-[85vh] overflow-y-auto"
                    >
                        <div className="pt-4">
                            {selectedLayer === 'road_closures' && (
                                <div
                                    className="mb-4 flex cursor-default flex-col gap-1.5 rounded-lg border-l-4 border-l-amber-500 bg-amber-50 px-3 py-2 text-left"
                                    role="status"
                                    aria-label={`Statewide active alerts: ${totalAlertsCount.toLocaleString()}. Crowdsourced Waze data.`}
                                >
                                    <div className="flex items-center gap-2">
                                        <BarChart2 className="w-4 h-4 flex-shrink-0 text-amber-700" aria-hidden />
                                        <span className="text-sm font-semibold text-amber-900">
                                            <span className="tabular-nums">{totalAlertsCount.toLocaleString()}</span>
                                            {' '}
                                            Active Alerts (Statewide)<span className="inline-block w-fit rounded-md bg-amber-200/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                                        Crowdsourced
                                    </span>
                                        </span>
                                    </div>
                                    
                                </div>
                            )}
                            <div className="mb-4">
                                <PanelLoadingState
                                    loading={isLoading}
                                    label="Loading infrastructure layer…"
                                    rows={2}
                                />
                                <LayerSelector
                                    selectedLayer={selectedLayer}
                                    onSelectLayer={setSelectedLayer}
                                    setViewMode={setViewMode}
                                />
                            </div>

                            {(selectedLayer === 'power_outage' || selectedLayer === 'power_outage_zip') && (
                                <div className="mb-4">
                                    <OutageSeverityLegend />
                                </div>
                            )}

                            {selectedLayer === 'road_closures' && (
                                <div className="mb-4">
                                    <AlertTypesLegend mapRef={mapRef} isHazardLayerReady={isHazardLayerReady} onTotalAlertsChange={onTotalAlertsChange} />
                                </div>
                            )}

                            <div className="pt-3 border-t border-gray-200">
                                <p className="text-[10px] text-gray-500 text-center">
                                    {selectedLayer === 'road_closures' ? 'Click areas for alert details' : 'Click areas for outage details'}
                                </p>
                            </div>
                        </div>
                    </MotionDiv>
                )}
            </AnimatePresence>
        </div>
    );
}

OSAControlPanel.propTypes = {
    controlDrag: PropTypes.object,
    currentLayer: PropTypes.object,
    selectedLayer: PropTypes.string,
    setSelectedLayer: PropTypes.func,
    setViewMode: PropTypes.func,
    onShowInfo: PropTypes.func,
    isMinimized: PropTypes.bool,
    setIsMinimized: PropTypes.func,
    mapRef: PropTypes.object,
    isHazardLayerReady: PropTypes.bool,
    isLoading: PropTypes.bool,
};
