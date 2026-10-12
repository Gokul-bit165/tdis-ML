/**
 * Shared HMED desktop/mobile panel body: layer picker, time window, Flood Hub notices, intensity scale.
 */

import React from 'react';
import PropTypes from 'prop-types';
import { LAYER_CONFIG, GOOGLE_FLOOD_HUB_ATTRIBUTION } from '../../config/hmedLayerConfig';
import { HMED_CONFIG } from '../../config/mapConfig';
import { FloodHubRiverineSection } from './FloodHubOverlayWidgets';
import { PanelLoadingState } from '../ui/PanelLoadingState';
import { trackFilterChange, trackLayerToggle } from '../../utils/googleAnalytics.js';

const hourOptions = HMED_CONFIG.hourOptions;
const THRESHOLD_KEYS = ['minimal', 'elevated', 'significant', 'major'];

function HazardLayerSelector({ selectedLayer, setSelectedLayer, isLoading }) {
  return (
    <div className="mb-4">
      <h3 className="block text-xs font-semibold text-gray-700 mb-2">Hazard Layer</h3>
      <div className="flex flex-col gap-1.5">
        {Object.values(LAYER_CONFIG).map((layer) => {
          const LayerIcon = layer.icon;
          const isSelected = selectedLayer === layer.id;
          return (
            <button
              key={layer.id}
              onClick={() => {
                if (layer.id !== selectedLayer) {
                  trackLayerToggle({
                    layer_name: layer.id,
                    tab: 'hmed',
                  });
                }
                setSelectedLayer(layer.id);
              }}
              disabled={isLoading}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-semibold transition-all duration-200 ${
                isSelected
                  ? 'bg-[#324755] text-white shadow-sm'
                  : 'text-gray-600 hover:text-[#324755] hover:bg-gray-100 border border-gray-200'
              } ${isLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <LayerIcon className="w-4 h-4" style={{ color: isSelected ? 'white' : layer.color }} />
              <span className="flex-1 text-left">{layer.name}</span>
              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

HazardLayerSelector.propTypes = {
  selectedLayer: PropTypes.string,
  setSelectedLayer: PropTypes.func,
  isLoading: PropTypes.bool,
};

function TimeWindowSelector({ selectedHours, setSelectedHours }) {
  return (
    <div className="mb-4">
      <h3 className="block text-xs font-semibold text-gray-700 mb-2">Time Window</h3>
      <div className="flex gap-1.5 p-1 bg-gray-50 rounded-lg border border-gray-200">
        {hourOptions.map((hours) => (
          <button
            key={hours}
            onClick={() => {
              if (hours !== selectedHours) {
                trackFilterChange(`${hours}h`, `${selectedHours}h`, {
                  tab: 'hmed',
                  layer_name: 'precipitation',
                });
              }
              setSelectedHours(hours);
            }}
            className={`flex-1 px-3 py-2 rounded-md text-xs font-semibold transition-all duration-200 ${
              selectedHours === hours
                ? 'bg-[#324755] text-white shadow-sm'
                : 'text-gray-600 hover:text-[#324755] hover:bg-gray-100'
            }`}
          >
            {hours}h
          </button>
        ))}
      </div>
    </div>
  );
}

TimeWindowSelector.propTypes = {
  selectedHours: PropTypes.number,
  setSelectedHours: PropTypes.func,
};

/** Severity layers label their configured range; hourly layers use the qualitative precipitation scale. */
function getScaleRangeLabel(currentLayer) {
  if (currentLayer.hasTimeWindow !== false) return 'Low → High';
  const values = currentLayer.severityLevels?.map((s) => s.value) ?? [];
  if (values.length === 0) return '3 → 5';
  return `${Math.min(...values)} → ${Math.max(...values)}`;
}

function ScaleGradientBar({ currentLayer, severityLevels }) {
  return (
    <div className="relative mb-3">
      <div
        className="w-full h-8 rounded-md shadow-inner border border-gray-200 overflow-hidden"
        style={{ background: currentLayer.gradientBar }}
      />
      {severityLevels ? (
        <div className="absolute inset-0 flex items-center justify-between px-1 text-[9px] font-bold text-gray-800 pointer-events-none drop-shadow-sm">
          {severityLevels.map((s) => (
            <span key={s.value} className="bg-white/85 px-0.5 rounded">
              {s.value}
            </span>
          ))}
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-between px-2 text-[10px] font-semibold text-gray-700 pointer-events-none">
          <span className="bg-white/90 px-1 rounded">&gt;0</span>
          <span className="bg-white/90 px-1 rounded">0.25</span>
          <span className="bg-white/90 px-1 rounded">0.50</span>
          <span className="bg-white/90 px-1 rounded">1.00</span>
          <span className="bg-white/90 px-1 rounded">1.50</span>
          <span className="bg-white/90 px-1 rounded">2.0+</span>
        </div>
      )}
    </div>
  );
}

ScaleGradientBar.propTypes = {
  currentLayer: PropTypes.object,
  severityLevels: PropTypes.array,
};

function SeverityLegendList({ severityLevels }) {
  return (
    <div className="space-y-1.5">
      {severityLevels.map((s) => (
        <div
          key={s.value}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs"
          style={{
            backgroundColor: `${s.color}18`,
            borderColor: `${s.color}55`,
          }}
        >
          <div
            className="w-3 h-3 rounded-full shrink-0 border border-white shadow-sm"
            style={{ backgroundColor: s.color }}
          />
          <span className="font-semibold text-gray-800 w-4">{s.value}</span>
          <span className="text-gray-700">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

SeverityLegendList.propTypes = {
  severityLevels: PropTypes.array,
};

function ThresholdLegendGrid({ thresholds }) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {THRESHOLD_KEYS.map((key) => (
        <div
          key={key}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border text-xs"
          style={{
            backgroundColor: `${thresholds[key].color}15`,
            borderColor: `${thresholds[key].color}40`,
          }}
        >
          <div
            className="w-2.5 h-2.5 rounded-full border border-white"
            style={{ backgroundColor: thresholds[key].color }}
          />
          <span className="text-gray-700 font-medium capitalize">{key}</span>
        </div>
      ))}
      <div
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border text-xs col-span-2"
        style={{
          backgroundColor: `${thresholds.extreme.color}15`,
          borderColor: `${thresholds.extreme.color}40`,
        }}
      >
        <div
          className="w-2.5 h-2.5 rounded-full border border-white"
          style={{ backgroundColor: thresholds.extreme.color }}
        />
        <span className="text-gray-700 font-semibold">Extreme</span>
      </div>
    </div>
  );
}

ThresholdLegendGrid.propTypes = {
  thresholds: PropTypes.object,
};

function IntensityScaleSection({ currentLayer }) {
  const isSeverityLayer = currentLayer.hasTimeWindow === false;
  const severityLevels = isSeverityLayer ? currentLayer.severityLevels : undefined;
  return (
    <div className="mb-4">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-xs font-semibold text-[#324755]">
          {isSeverityLayer ? 'Threat severity' : 'Intensity Scale'}
        </span>
        <span className="text-[10px] text-gray-500">{getScaleRangeLabel(currentLayer)}</span>
      </div>
      <ScaleGradientBar currentLayer={currentLayer} severityLevels={severityLevels} />
      {severityLevels ? (
        <SeverityLegendList severityLevels={severityLevels} />
      ) : (
        <ThresholdLegendGrid thresholds={currentLayer.thresholds} />
      )}
    </div>
  );
}

IntensityScaleSection.propTypes = {
  currentLayer: PropTypes.object,
};

function FloodHubAttributionNotice({ extra }) {
  return (
    <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50/90 px-3 py-2">
      <p className="text-[10px] leading-snug text-sky-950/90">
        <span className="font-bold">Third-party forecast.</span> {GOOGLE_FLOOD_HUB_ATTRIBUTION}
      </p>
      {extra}
    </div>
  );
}

FloodHubAttributionNotice.propTypes = {
  extra: PropTypes.node,
};

function PlanningToolNotice() {
  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2">
      <p className="text-[10px] leading-snug text-amber-900/90">
        <span className="font-bold">Planning tool.</span> Does not replace official NWS flood
        warnings.
      </p>
    </div>
  );
}

/**
 * Shared controls body for the desktop sheet and the mobile drawer.
 */
export function HMEDPanelBody({
  currentLayer,
  selectedLayer,
  setSelectedLayer,
  selectedHours,
  setSelectedHours,
  floodPrdToggles,
  patchFloodPrdToggles,
  isLoading = false,
  loadingMessage = 'Loading layer data…',
  floodHubExtra = null,
  floodHubHint,
  defaultHint,
}) {
  const isFloodHub = currentLayer.floodHubGauge === true;
  return (
    <>
      <PanelLoadingState loading={isLoading} label={loadingMessage} rows={3} />
      <HazardLayerSelector
        selectedLayer={selectedLayer}
        setSelectedLayer={setSelectedLayer}
        isLoading={isLoading}
      />
      {currentLayer.hasTimeWindow !== false && (
        <TimeWindowSelector selectedHours={selectedHours} setSelectedHours={setSelectedHours} />
      )}
      {isFloodHub && <FloodHubAttributionNotice extra={floodHubExtra} />}
      {isFloodHub && floodPrdToggles && patchFloodPrdToggles && (
        <FloodHubRiverineSection toggles={floodPrdToggles} setToggles={patchFloodPrdToggles} />
      )}
      {currentLayer.hasTimeWindow === false && !isFloodHub && <PlanningToolNotice />}
      {!isFloodHub && <IntensityScaleSection currentLayer={currentLayer} />}
      <div className="pt-3 border-t border-gray-200">
        <p className="text-[10px] text-gray-500 text-center">
          {isFloodHub ? floodHubHint : defaultHint}
        </p>
      </div>
    </>
  );
}

HMEDPanelBody.propTypes = {
  currentLayer: PropTypes.object,
  selectedLayer: PropTypes.string,
  setSelectedLayer: PropTypes.func,
  selectedHours: PropTypes.number,
  setSelectedHours: PropTypes.func,
  floodPrdToggles: PropTypes.object,
  patchFloodPrdToggles: PropTypes.func,
  isLoading: PropTypes.bool,
  loadingMessage: PropTypes.string,
  floodHubExtra: PropTypes.node,
  floodHubHint: PropTypes.string,
  defaultHint: PropTypes.string,
};
