/**
 * @fileoverview Compact loading strip for map control panels (skeleton + spinner).
 */

import React from "react";
import PropTypes from "prop-types";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * @param {Object} props
 * @param {boolean} props.loading
 * @param {string} [props.label]
 * @param {number} [props.rows]
 */
export function PanelLoadingState({ loading, label = "Loading layer data…", rows = 3 }) {
    if (!loading) return null;

    return (
        <div
            className="mb-4 rounded-lg border border-slate-200 bg-slate-50/90 px-3 py-2.5"
            role="status"
            aria-live="polite"
            aria-busy="true"
        >
            <div className="flex items-center gap-2 mb-2.5">
                <div className="relative shrink-0">
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-gray-200" />
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-t-2 border-[#324755] absolute top-0 left-0" />
                </div>
                <p className="text-[11px] font-semibold text-[#324755]">{label}</p>
            </div>
            <div className="flex flex-col gap-1.5">
                {Array.from({ length: rows }, (_, index) => index + 1).map((rowNumber) => (
                    <div key={rowNumber} className="flex items-center gap-2.5 px-1 py-0.5">
                        <Skeleton className="w-4 h-4 rounded-full" />
                        <Skeleton className="h-3.5 flex-1 rounded" />
                    </div>
                ))}
            </div>
        </div>
    );
}

PanelLoadingState.propTypes = {
    loading: PropTypes.bool,
    label: PropTypes.string,
    rows: PropTypes.number,
};

export default PanelLoadingState;
