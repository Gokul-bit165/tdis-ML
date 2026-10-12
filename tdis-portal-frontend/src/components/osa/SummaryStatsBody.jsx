import React from 'react';
import PropTypes from 'prop-types';
import { Search, X } from 'lucide-react';
import { SummaryListItem } from './SummaryListItem';
import {
    getViewModeLabel,
    getViewModeTitle,
    isRoadClosuresLayer,
} from './osaSummaryUtils';

const DESKTOP_SEARCH_CLASS =
    'w-full pl-9 pr-2 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500';
const MOBILE_SEARCH_CLASS =
    'w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500';

function SummaryTotalCard({ label, total }) {
    return (
        <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-lg p-3 border border-orange-200">
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700">{label}</span>
                <span className="text-base font-bold text-[#dc2626]">{total.toLocaleString()}</span>
            </div>
        </div>
    );
}

SummaryTotalCard.propTypes = {
    label: PropTypes.string,
    total: PropTypes.number,
};

function SummarySearchField({ searchQuery, setSearchQuery, placeholder, inputClassName }) {
    return (
        <div className="relative">
            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={placeholder}
                className={inputClassName}
            />
            {searchQuery ? (
                <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                    <X className="w-4 h-4" />
                </button>
            ) : null}
        </div>
    );
}

SummarySearchField.propTypes = {
    searchQuery: PropTypes.string,
    setSearchQuery: PropTypes.func,
    placeholder: PropTypes.string,
    inputClassName: PropTypes.string,
};

function SummaryStatusMessage({ className, children }) {
    return <div className={className}>{children}</div>;
}

SummaryStatusMessage.propTypes = {
    className: PropTypes.string,
    children: PropTypes.node,
};

function SummaryDataList({
    data,
    searchQuery,
    viewModeLabel,
    viewModeTitle,
    isRoadClosures,
    onItemClick,
    isDesktop,
}) {
    const heading = searchQuery
        ? `Found ${data.length} ${viewModeLabel}`
        : `All ${viewModeTitle} (${data.length})`;

    const listItems = data.map((item, index) => (
        <SummaryListItem
            key={`${item.name}-${index}`}
            item={item}
            index={index}
            isRoadClosures={isRoadClosures}
            onItemClick={onItemClick}
            withTransition={isDesktop}
        />
    ));

    if (isDesktop) {
        return (
            <div className="mt-2">
                <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-700">{heading}</p>
                    {!searchQuery && data.length > 10 ? (
                        <span className="text-xs text-gray-500 italic">Scroll for more</span>
                    ) : null}
                </div>
                <div
                    className="space-y-1.5 overflow-y-auto pr-1"
                    style={{
                        maxHeight: '40vh',
                        scrollbarWidth: 'thin',
                        scrollbarColor: '#cbd5e1 #f1f5f9',
                    }}
                >
                    {listItems}
                </div>
            </div>
        );
    }

    return (
        <div>
            <p className="text-xs font-semibold text-gray-700 mb-2">{heading}</p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">{listItems}</div>
        </div>
    );
}

SummaryDataList.propTypes = {
    data: PropTypes.array,
    searchQuery: PropTypes.string,
    viewModeLabel: PropTypes.string,
    viewModeTitle: PropTypes.string,
    isRoadClosures: PropTypes.bool,
    onItemClick: PropTypes.func,
    isDesktop: PropTypes.bool,
};

function getListSection({
    isLoadingData,
    hasData,
    statusBoxClass,
    viewModeLabel,
    searchQuery,
    data,
    viewModeTitle,
    isRoadClosures,
    handleSummaryItemClick,
    isDesktop,
}) {
    if (isLoadingData) {
        return (
            <SummaryStatusMessage className={statusBoxClass}>
                Loading {viewModeLabel}...
            </SummaryStatusMessage>
        );
    }

    if (hasData) {
        return (
            <SummaryDataList
                data={data}
                searchQuery={searchQuery}
                viewModeLabel={viewModeLabel}
                viewModeTitle={viewModeTitle}
                isRoadClosures={isRoadClosures}
                onItemClick={handleSummaryItemClick}
                isDesktop={isDesktop}
            />
        );
    }

    const emptyMessage = searchQuery
        ? `No ${viewModeLabel} found matching "${searchQuery}"`
        : `No ${viewModeLabel} data available`;

    return <SummaryStatusMessage className={statusBoxClass}>{emptyMessage}</SummaryStatusMessage>;
}

/**
 * Shared total / search / list block used by desktop and mobile OSA summary UIs.
 * `variant` preserves each surface's original spacing/classes (no visual change).
 */
export function SummaryStatsBody({
    currentLayerId,
    viewMode,
    summaryStats,
    isLoadingData,
    searchQuery,
    setSearchQuery,
    handleSummaryItemClick,
    variant = 'desktop',
}) {
    const isDesktop = variant === 'desktop';
    const viewModeLabel = getViewModeLabel(viewMode);
    const viewModeTitle = getViewModeTitle(viewMode);
    const isRoadClosures = isRoadClosuresLayer(currentLayerId);
    const totalLabel = isRoadClosures ? 'Total Alerts:' : 'Total Customers Out:';
    const data = summaryStats.allData;
    const statusBoxClass = isDesktop
        ? 'mt-2 p-3 text-center text-sm text-gray-500 bg-gray-50 rounded-md border border-gray-200'
        : 'p-3 text-center text-sm text-gray-500 bg-gray-50 rounded-md border border-gray-200';

    return (
        <div className={isDesktop ? 'space-y-2' : 'space-y-3'}>
            <SummaryTotalCard label={totalLabel} total={summaryStats.totalCustomersOut} />
            <SummarySearchField
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                placeholder={`Search ${viewModeLabel}...`}
                inputClassName={isDesktop ? DESKTOP_SEARCH_CLASS : MOBILE_SEARCH_CLASS}
            />
            {getListSection({
                isLoadingData,
                hasData: data.length > 0,
                statusBoxClass,
                viewModeLabel,
                searchQuery,
                data,
                viewModeTitle,
                isRoadClosures,
                handleSummaryItemClick,
                isDesktop,
            })}
        </div>
    );
}

SummaryStatsBody.propTypes = {
    currentLayerId: PropTypes.string,
    viewMode: PropTypes.string,
    summaryStats: PropTypes.object,
    isLoadingData: PropTypes.bool,
    searchQuery: PropTypes.string,
    setSearchQuery: PropTypes.func,
    handleSummaryItemClick: PropTypes.func,
    variant: PropTypes.oneOf(['desktop', 'mobile']),
};
