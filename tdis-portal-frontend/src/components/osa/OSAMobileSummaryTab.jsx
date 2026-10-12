import React from 'react';
import PropTypes from 'prop-types';
import { ViewModeToggle } from './ViewModeToggle';
import { SummaryStatsBody } from './SummaryStatsBody';
import { isRoadClosuresLayer, isValidSummaryViewMode } from './osaSummaryUtils';

/**
 * Mobile Controls panel — Summary tab content (view mode + stats list).
 */
export function OSAMobileSummaryTab({
    currentLayer,
    viewMode,
    handleViewModeChange,
    summaryStats,
    isLoadingData,
    searchQuery,
    setSearchQuery,
    handleSummaryItemClick,
}) {
    const showRoadClosuresTip = isRoadClosuresLayer(currentLayer) && viewMode === 'county';
    const showStats = isValidSummaryViewMode(viewMode);

    return (
        <div className="space-y-4">
            <fieldset className="border-0 p-0 m-0 min-w-0">
                <legend className="block text-xs font-semibold text-gray-700 mb-2 px-0 float-none w-full">
                    View Mode
                </legend>
                <ViewModeToggle
                    currentLayerId={currentLayer.id}
                    viewMode={viewMode}
                    onViewModeChange={handleViewModeChange}
                />
            </fieldset>

            {showRoadClosuresTip ? (
                <output
                    className="block rounded-md border-l-4 border-orange-400 bg-orange-50 py-2 px-3"
                    aria-live="polite"
                >
                    <p className="text-xs font-medium text-[#324755] m-0">
                        Click a county to zoom to it on the map.
                    </p>
                </output>
            ) : null}

            {showStats ? (
                <SummaryStatsBody
                    currentLayerId={currentLayer.id}
                    viewMode={viewMode}
                    summaryStats={summaryStats}
                    isLoadingData={isLoadingData}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    handleSummaryItemClick={handleSummaryItemClick}
                    variant="mobile"
                />
            ) : null}
        </div>
    );
}

OSAMobileSummaryTab.propTypes = {
    currentLayer: PropTypes.object,
    viewMode: PropTypes.string,
    handleViewModeChange: PropTypes.func,
    summaryStats: PropTypes.object,
    isLoadingData: PropTypes.bool,
    searchQuery: PropTypes.string,
    setSearchQuery: PropTypes.func,
    handleSummaryItemClick: PropTypes.func,
};
