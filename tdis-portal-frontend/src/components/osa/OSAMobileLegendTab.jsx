import React from 'react';
import PropTypes from 'prop-types';
import { BarChart2 } from 'lucide-react';
import { LayerSelector } from './LayerSelector';
import { OutageSeverityLegend } from './OutageSeverityLegend';
import { AlertTypesLegend } from './AlertTypesLegend';

/**
 * Mobile Controls panel — Legend tab content (layer picker + severity/alert legends).
 */
export function OSAMobileLegendTab({
    selectedLayer,
    setSelectedLayer,
    setViewMode,
    mapRef,
    isHazardLayerReady,
    totalAlertsCount,
    onTotalAlertsChange,
}) {
    const isRoadClosures = selectedLayer === 'road_closures';
    const showOutageLegend =
        selectedLayer === 'power_outage' || selectedLayer === 'power_outage_zip';
    const footerHint = isRoadClosures
        ? 'Click areas for alert details'
        : 'Click areas for outage details';

    return (
        <div className="space-y-4">
            {isRoadClosures ? (
                <output
                    className="flex cursor-default flex-col gap-1.5 rounded-lg border-l-4 border-l-amber-500 bg-amber-50 px-3 py-2 text-left"
                    aria-label={`Statewide active alerts: ${totalAlertsCount.toLocaleString()}. Crowdsourced Waze data.`}
                >
                    <div className="flex items-center gap-2">
                        <BarChart2 className="w-4 h-4 flex-shrink-0 text-amber-700" aria-hidden />
                        <span className="text-sm font-semibold text-amber-900">
                            <span className="tabular-nums">
                                {totalAlertsCount.toLocaleString()}
                            </span>
                            {' '}
                            Active Alerts (Statewide)
                            <span className="inline-block w-fit rounded-md bg-amber-200/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                                Crowdsourced
                            </span>
                        </span>
                    </div>
                </output>
            ) : null}
            <LayerSelector
                selectedLayer={selectedLayer}
                onSelectLayer={setSelectedLayer}
                setViewMode={setViewMode}
            />
            {showOutageLegend ? <OutageSeverityLegend /> : null}
            {isRoadClosures ? (
                <AlertTypesLegend
                    mapRef={mapRef}
                    isHazardLayerReady={isHazardLayerReady}
                    onTotalAlertsChange={onTotalAlertsChange}
                />
            ) : null}
            <div className="pt-3 border-t border-gray-200">
                <p className="text-[10px] text-gray-500 text-center">{footerHint}</p>
            </div>
        </div>
    );
}

OSAMobileLegendTab.propTypes = {
    selectedLayer: PropTypes.string,
    setSelectedLayer: PropTypes.func,
    setViewMode: PropTypes.func,
    mapRef: PropTypes.object,
    isHazardLayerReady: PropTypes.bool,
    totalAlertsCount: PropTypes.number,
    onTotalAlertsChange: PropTypes.func,
};
