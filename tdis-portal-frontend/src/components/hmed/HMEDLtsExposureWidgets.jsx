/**
 * LTS potential-impact summary widgets: buildings, critical facilities (aggregates from exposure-summary API).
 */

import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Building2,
  Siren,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  AlertCircle,
  CircleCheck,
} from 'lucide-react';
import { LAYER_CONFIG } from '../../config/ltsFlashFloodLayerConfig';
import { trackFilterChange } from '../../utils/googleAnalytics.js';

const DEFAULT_LTS_SEVERITY_LEVELS =
  LAYER_CONFIG.lts_flash_flood.severityLevelsUi ?? LAYER_CONFIG.lts_flash_flood.severityLevels;

function fmt(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return new Intl.NumberFormat('en-US').format(Number(n));
}

/** True when the latest run has no counties at/above the selected LTS threshold (or no modeled exposure). */
function isNoElevatedLtsExposure(data) {
  if (!data || typeof data !== 'object') return false;
  const counties = data.counties_in_scope;
  if (counties !== undefined && counties !== null && Number(counties) === 0) return true;
  if (Number(counties) > 0) return false;

  const structures = Number(data.total_structures) || 0;
  const crit =
    (Number(data.hospital_count) || 0) +
    (Number(data.grocery_count) || 0) +
    (Number(data.emergency_facility_count) || 0);
  return structures === 0 && crit === 0;
}

/**
 * @param {{ data: object | null, loading: boolean, error: string | null, minLtsLevel: number, onMinLtsLevelChange: (n: number) => void, onRefresh: () => void, severityLevels?: { value: number, color: string, label: string, chipText?: string }[] }} props
 */
export function HMEDLtsExposureWidgets({
  data,
  loading,
  error,
  minLtsLevel,
  onMinLtsLevelChange,
  onRefresh,
  severityLevels = DEFAULT_LTS_SEVERITY_LEVELS,
}) {
  const [buildingsOpen, setBuildingsOpen] = useState(false);

  const selectedTierLabel = severityLevels.find((s) => s.value === minLtsLevel)?.label;
  const noElevated = !error && data && isNoElevatedLtsExposure(data);

  return (
    <div className="mt-4 space-y-3 border-t border-blue-200/60 pt-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-[#324755] uppercase tracking-wide">
          Potential impact (estimates)
        </p>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="p-1.5 rounded-md text-blue-700 hover:bg-blue-50 transition-colors disabled:opacity-50"
          title="Refresh potential impact"
          aria-label="Refresh potential impact data"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <p className="text-[10px] text-gray-600 leading-snug">
        Counties at or above the selected LTS level on the latest run (24-hour forecast outlook).
        Figures are modeled potential impact—anticipatory planning only; not observed damage or
        ground truth.
      </p>

      <div className="flex flex-wrap gap-1.5">
        {[4, 5].map((v) => {
          const tier = severityLevels.find((s) => s.value === v);
          const label = tier ? `≥ ${tier.label}` : `≥ L${v}`;
          const color = tier?.color ?? '#6366f1';
          const selected = minLtsLevel === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => {
                if (v !== minLtsLevel) {
                  const previousLabel =
                    severityLevels.find((s) => s.value === minLtsLevel)?.label ?? `L${minLtsLevel}`;
                  trackFilterChange(tier?.label ?? `L${v}`, previousLabel, {
                    tab: 'lts-flash-flood',
                    layer_name: 'lts_flash_flood',
                    lts_min_level: v,
                  });
                }
                onMinLtsLevelChange(v);
              }}
              className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
                selected ? 'text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              style={selected ? { backgroundColor: color } : undefined}
              title={label}
            >
              {label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50/80 px-3 py-2 text-[11px] text-red-800">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {!error && data && (
        <>
          <p className="text-[10px] text-gray-500">
            Run: {data.run_date ?? '—'}
            {data.counties_in_scope != null && (
              <span className="ml-2">· {data.counties_in_scope} counties in scope</span>
            )}
          </p>

          {noElevated && (
            <div
              className="flex gap-2 rounded-lg border border-slate-200 bg-slate-50/95 px-3 py-2.5 text-[11px] text-slate-800 leading-snug"
              role="status"
            >
              <CircleCheck className="w-4 h-4 shrink-0 text-emerald-700 mt-0.5" aria-hidden />
              <p className="m-0">
                <span className="font-semibold text-slate-900">No high-threat regions</span> in this
                outlook for LTS {minLtsLevel}
                {selectedTierLabel ? ` (${selectedTierLabel})` : ''}. The latest 24-hour run has no
                counties in that band on the map; modeled exposure totals below are zero.
              </p>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <button
              type="button"
              onClick={() => setBuildingsOpen((o) => !o)}
              className="w-full flex items-center justify-between gap-2 text-left"
            >
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-600" />
                <span className="text-[11px] font-semibold text-[#324755]">
                  Buildings (structures)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-slate-800 tabular-nums">
                  {fmt(data.total_structures)}
                </span>
                {buildingsOpen ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </div>
            </button>
            {buildingsOpen && (
              <ul className="mt-3 space-y-1.5 text-[10px] border-t border-gray-100 pt-2">
                {[
                  ['Residential', data.total_residential],
                  ['Commercial', data.total_commercial],
                  ['Industrial', data.total_industrial],
                  ['Agriculture', data.total_agriculture],
                  ['Education', data.total_education],
                  ['Government', data.total_government],
                  ['Assembly', data.total_assembly],
                  ['Utility / misc', data.total_utility_misc],
                  ['Unclassified', data.total_unclassified],
                ].map(([label, val]) => (
                  <li key={label} className="flex justify-between text-gray-700">
                    <span>{label}</span>
                    <span className="font-semibold tabular-nums">{fmt(val)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-orange-100 bg-gradient-to-br from-orange-50/90 to-amber-50/40 p-3 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Siren className="w-4 h-4 text-orange-700" />
              <span className="text-[11px] font-semibold text-[#324755]">Critical facilities</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-white/80 py-2 px-1 border border-orange-100">
                <p className="text-[9px] text-gray-600 uppercase">Hospitals</p>
                <p className="text-lg font-bold text-orange-900 tabular-nums">
                  {fmt(data.hospital_count)}
                </p>
              </div>
              <div className="rounded-lg bg-white/80 py-2 px-1 border border-orange-100">
                <p className="text-[9px] text-gray-600 uppercase">Grocery</p>
                <p className="text-lg font-bold text-orange-900 tabular-nums">
                  {fmt(data.grocery_count)}
                </p>
              </div>
              <div className="rounded-lg bg-white/80 py-2 px-1 border border-orange-100">
                <p className="text-[9px] text-gray-600 leading-tight">Emergency</p>
                <p className="text-lg font-bold text-orange-900 tabular-nums">
                  {fmt(data.emergency_facility_count)}
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {loading && !data && !error && (
        <div className="flex items-center justify-center py-6 text-xs text-gray-500">
          Loading potential impact…
        </div>
      )}
    </div>
  );
}

HMEDLtsExposureWidgets.propTypes = {
  data: PropTypes.object,
  loading: PropTypes.bool,
  error: PropTypes.string,
  minLtsLevel: PropTypes.number.isRequired,
  onMinLtsLevelChange: PropTypes.func.isRequired,
  onRefresh: PropTypes.func.isRequired,
  severityLevels: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.number.isRequired,
      color: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      chipText: PropTypes.string,
    })
  ),
};
