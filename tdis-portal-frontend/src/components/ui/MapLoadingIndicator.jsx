/**
 * @fileoverview Loading indicator component for map components.
 * Supports a corner chip (default) and a full-map overlay for long dataset loads.
 */

import React from "react";
import PropTypes from "prop-types";

/**
 * @param {Object} props
 * @param {string} [props.title]
 * @param {string} [props.message]
 * @param {'chip'|'overlay'} [props.variant]
 * @param {string} [props.position] - chip positioning classes
 */
const MapLoadingIndicator = ({
    title = "Loading map data",
    message = "Please wait…",
    variant = "chip",
    position = "absolute bottom-16 right-4",
}) => {
    const spinner = (
        <div className="relative shrink-0">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-200" />
            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-[#324755] absolute top-0 left-0" />
        </div>
    );

    if (variant === "overlay") {
        return (
            <div
                className="absolute inset-0 z-30 flex items-center justify-center bg-slate-900/25 backdrop-blur-[1px] pointer-events-none"
                role="status"
                aria-live="polite"
                aria-busy="true"
            >
                <div className="pointer-events-none bg-white/95 backdrop-blur-sm rounded-xl shadow-xl border border-gray-200/60 px-5 py-4 max-w-[min(90vw,320px)]">
                    <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                            <div className="animate-spin rounded-full h-7 w-7 border-2 border-gray-200" />
                            <div className="animate-spin rounded-full h-7 w-7 border-t-2 border-[#324755] absolute top-0 left-0" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-[#324755]">{title}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{message}</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            className={`${position} bg-white/95 backdrop-blur-sm rounded-xl shadow-xl border border-gray-200/50 p-4 z-20`}
            role="status"
            aria-live="polite"
            aria-busy="true"
        >
            <div className="flex items-center gap-3">
                {spinner}
                <div>
                    <p className="text-sm font-medium text-gray-700">{title}</p>
                    <p className="text-xs text-gray-500">{message}</p>
                </div>
            </div>
        </div>
    );
};

MapLoadingIndicator.propTypes = {
    title: PropTypes.string,
    message: PropTypes.string,
    variant: PropTypes.oneOf(["chip", "overlay"]),
    position: PropTypes.string,
};

export default MapLoadingIndicator;
