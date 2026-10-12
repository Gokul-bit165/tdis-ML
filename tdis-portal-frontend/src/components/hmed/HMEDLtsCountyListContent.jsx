/**
 * Shared LTS county list: search + scrollable rows (desktop panel + mobile tab).
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Search, RefreshCw, AlertCircle, MapPin } from 'lucide-react';
import { LAYER_CONFIG } from '../../config/ltsFlashFloodLayerConfig';
import { filterLtsCountiesBySearch, getLtsSeverityChipStyle } from '../../utils/hmedLtsCountyUtils';

const ltsConfig = LAYER_CONFIG.lts_flash_flood;

export function HMEDLtsCountyListContent({
  counties,
  total,
  runDate,
  loading,
  error,
  searchQuery,
  onSearchChange,
  onRefresh,
  compact,
  listScopeNote,
  emptyListMessage,
}) {
  const filtered = filterLtsCountiesBySearch(counties || [], searchQuery);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] text-gray-500">
          {runDate != null && runDate !== '' ? (
            <>
              Run: <span className="font-medium text-gray-700">{String(runDate)}</span>
              {total != null && (
                <span className="ml-2">
                  · {total} {total === 1 ? 'county' : 'counties'}
                </span>
              )}
            </>
          ) : (
            'Latest LTS county rollup'
          )}
        </p>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="p-1.5 rounded-md text-blue-700 hover:bg-blue-50 transition-colors disabled:opacity-50"
            title="Refresh list"
            aria-label="Refresh county list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {listScopeNote ? (
        <p className="text-[10px] text-teal-800/85 font-medium leading-snug">{listScopeNote}</p>
      ) : null}

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search county or FIPS…"
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-xs focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none"
          aria-label="Search counties"
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50/80 px-3 py-2 text-[11px] text-red-800">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {!error && loading && !counties?.length && (
        <div className="flex items-center justify-center py-8 text-xs text-gray-500">
          Loading counties…
        </div>
      )}

      {!error && !loading && !counties?.length && (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/80 px-3 py-6 text-center text-xs text-gray-600 leading-relaxed">
          {emptyListMessage ?? 'No county rows for the latest run.'}
        </div>
      )}

      {!error && counties?.length > 0 && (
        <>
          <p className="text-[10px] text-gray-500">
            Showing {filtered.length} of {counties.length}
            {searchQuery.trim() ? ' (filtered)' : ''}
          </p>
          <ul
            className={`space-y-1.5 overflow-y-auto pr-0.5 ${compact ? 'max-h-[38vh]' : 'max-h-[min(52vh,420px)]'}`}
          >
            {filtered.map((c, idx) => {
              const chip = getLtsSeverityChipStyle(ltsConfig, c.lts_level);
              const fips = c.countyfips ?? '—';
              const labelText = c.lts_label || chip.label;
              return (
                <li
                  key={`${fips}-${idx}`}
                  className="flex items-start gap-2 rounded-lg border border-gray-100 bg-white/90 px-2.5 py-2 shadow-sm hover:border-blue-200/80 transition-colors"
                >
                  <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[#324755] truncate">
                        {c.county || 'Unknown'}
                      </span>
                      <span
                        className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border"
                        style={{
                          backgroundColor: chip.bg,
                          borderColor: chip.border,
                          color: chip.text,
                        }}
                      >
                        {c.lts_level != null && c.lts_level !== '' ? c.lts_level : '—'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[10px] text-gray-500">
                      <span className="tabular-nums">FIPS {fips}</span>
                      <span className="text-gray-400">·</span>
                      <span className="truncate">{labelText}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

HMEDLtsCountyListContent.propTypes = {
  counties: PropTypes.array,
  total: PropTypes.number,
  runDate: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  loading: PropTypes.bool,
  error: PropTypes.string,
  searchQuery: PropTypes.string.isRequired,
  onSearchChange: PropTypes.func.isRequired,
  onRefresh: PropTypes.func,
  compact: PropTypes.bool,
  listScopeNote: PropTypes.string,
  emptyListMessage: PropTypes.string,
};

HMEDLtsCountyListContent.defaultProps = {
  counties: [],
  compact: false,
  listScopeNote: null,
  emptyListMessage: null,
};
