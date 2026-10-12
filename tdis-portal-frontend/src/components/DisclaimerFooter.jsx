/**
 * DisclaimerFooter component
 * A subtle sticky footer bar displaying a short disclaimer summary with expandable full legal text
 */

import React, { useState } from 'react';
import PropTypes from "prop-types";
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { disclaimerConfig } from '../config/disclaimerConfig';
import LastUpdated from './LastUpdated';

const MotionDiv = motion.div;

const DisclaimerFooter = ({ refreshCadence }) => {
    const [showFullDisclaimer, setShowFullDisclaimer] = useState(false);

    // Short summary text
    const shortSummary = "Data presented on this map is for situational awareness only and may include delays or incomplete reporting. By using this site, you agree to the TDIS terms.";

    const showLastUpdated = Boolean(refreshCadence);

    return (
        <>
            <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-300/50 px-4 md:px-6 py-2 z-[15] shadow-lg">
                <div className="w-full">
                    {/* Large screen layout - Disclaimer left, LastUpdated right */}
                    <div className="hidden md:flex md:items-center md:justify-between md:gap-6">
                        <div className="text-[10px] text-gray-600 leading-tight flex-1 min-w-0">
                            <span>
                                <span className="font-semibold text-gray-700">{disclaimerConfig.disclaimerTitle}:</span>{' '}
                                {shortSummary}
                            </span>
                            <button
                                onClick={() => setShowFullDisclaimer(true)}
                                className="text-blue-600 hover:text-blue-700 underline font-medium transition-colors inline-flex items-center gap-0.5 ml-1 whitespace-nowrap"
                            >
                                View full disclaimer
                                <span className="ml-0.5">→</span>
                            </button>
                        </div>
                        {showLastUpdated && (
                            <div className="flex-shrink-0 ml-4">
                                <LastUpdated cadence={refreshCadence} />
                            </div>
                        )}
                    </div>
                    
                    {/* Small screen layout - Disclaimer top, LastUpdated bottom */}
                    <div className="md:hidden space-y-2">
                        <div className="text-[10px] text-gray-600 leading-tight">
                            <span>
                                <span className="font-semibold text-gray-700">{disclaimerConfig.disclaimerTitle}:</span>{' '}
                                {shortSummary}
                            </span>
                            <button
                                onClick={() => setShowFullDisclaimer(true)}
                                className="text-blue-600 hover:text-blue-700 underline font-medium transition-colors inline-flex items-center gap-0.5 ml-1 whitespace-nowrap"
                            >
                                View full disclaimer
                                <span className="ml-0.5">→</span>
                            </button>
                        </div>
                        {showLastUpdated && (
                            <div>
                                <LastUpdated cadence={refreshCadence} />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Full Disclaimer Modal */}
            <AnimatePresence>
                {showFullDisclaimer && (
                    <>
                        {/* Backdrop */}
                        <MotionDiv
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            onClick={() => setShowFullDisclaimer(false)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowFullDisclaimer(false); } }}
                            role="button"
                            tabIndex={0}
                            aria-label="Close disclaimer"
                            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999]"
                            style={{ pointerEvents: 'auto' }}
                        />
                        
                        {/* Modal */}
                        <MotionDiv
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
                            style={{ pointerEvents: 'none' }}
                        >
                            <div 
                                className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
                                style={{ pointerEvents: 'auto' }}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => e.stopPropagation()}
                                role="dialog"
                                aria-modal="true"
                                tabIndex={0}
                            >
                                {/* Header */}
                                <div className="flex items-center justify-between p-5 pb-4 border-b border-gray-200 bg-gradient-to-r from-gray-700 to-gray-800">
                                    <div className="flex items-center gap-3">
                                        <div>
                                            <h2 className="text-lg font-bold text-white">{disclaimerConfig.disclaimerTitle}</h2>
                                            <p className="text-xs text-white/80">Texas Disaster Information System</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setShowFullDisclaimer(false)}
                                        className="p-2 rounded-lg hover:bg-white/20 transition-colors"
                                        aria-label="Close"
                                    >
                                        <X className="w-5 h-5 text-white" />
                                    </button>
                                </div>

                                {/* Scrollable Content */}
                                <div className="overflow-y-auto flex-1 p-6 space-y-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                                    {disclaimerConfig.disclaimerText.map((paragraph) => (
                                        <p key={paragraph} className="text-sm text-gray-700 leading-relaxed">
                                            {paragraph}
                                        </p>
                                    ))}
                                </div>

                                {/* Footer */}
                                <div className="p-5 pt-4 border-t border-gray-200 bg-gray-50">
                                    <button
                                        onClick={() => setShowFullDisclaimer(false)}
                                        className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-800 text-white text-sm font-semibold rounded-lg transition-colors"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </MotionDiv>
                    </>
                )}
            </AnimatePresence>
        </>
    );
};

DisclaimerFooter.propTypes = {
    refreshCadence: PropTypes.string,
};

export default DisclaimerFooter;
