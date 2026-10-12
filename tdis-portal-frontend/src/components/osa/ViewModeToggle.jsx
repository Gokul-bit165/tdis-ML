import React from 'react';
import PropTypes from 'prop-types';
import { MapPin, Users } from 'lucide-react';
import { isRoadClosuresLayer } from './osaSummaryUtils';

const VIEW_MODE_ACTIVE_CLASS = 'bg-[#324755] text-white shadow-sm';
const VIEW_MODE_INACTIVE_CLASS =
    'text-gray-600 hover:text-[#324755] hover:bg-gray-100 border border-gray-200';

const BUTTON_BASE_CLASS =
    'px-3 py-2 rounded-md text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5';

function modeButtonClass(isActive) {
    return `${BUTTON_BASE_CLASS} ${isActive ? VIEW_MODE_ACTIVE_CLASS : VIEW_MODE_INACTIVE_CLASS}`;
}

function countyTitle(showTitles, isRoadClosures) {
    if (showTitles) {
        return isRoadClosures ? 'View alerts by county' : 'View outages by county';
    }
    return undefined;
}

/**
 * County / Zip / Utility toggle. Road closures layers only show County.
 */
export function ViewModeToggle({ currentLayerId, viewMode, onViewModeChange, showTitles = false }) {
    const isRoadClosures = isRoadClosuresLayer(currentLayerId);
    const zipTitle = showTitles ? 'View outages by zip code' : undefined;
    const utilityTitle = showTitles ? 'View outages by utility' : undefined;
    const showZipUtility = isRoadClosures === false;

    return (
        <div className={`grid gap-2 ${isRoadClosures ? 'grid-cols-1' : 'grid-cols-3'}`}>
            <button
                type="button"
                onClick={() => onViewModeChange('county')}
                className={modeButtonClass(viewMode === 'county')}
                title={countyTitle(showTitles, isRoadClosures)}
            >
                <MapPin className="w-3.5 h-3.5" />
                County
            </button>
            {showZipUtility ? (
                <>
                    <button
                        type="button"
                        onClick={() => onViewModeChange('zip')}
                        className={modeButtonClass(viewMode === 'zip')}
                        title={zipTitle}
                    >
                        <MapPin className="w-3.5 h-3.5" />
                        Zip
                    </button>
                    <button
                        type="button"
                        onClick={() => onViewModeChange('utility')}
                        className={modeButtonClass(viewMode === 'utility')}
                        title={utilityTitle}
                    >
                        <Users className="w-3.5 h-3.5" />
                        Utility
                    </button>
                </>
            ) : null}
        </div>
    );
}

ViewModeToggle.propTypes = {
    currentLayerId: PropTypes.string,
    viewMode: PropTypes.string,
    onViewModeChange: PropTypes.func,
    showTitles: PropTypes.bool,
};
