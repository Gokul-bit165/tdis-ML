import React from 'react';
import PropTypes from 'prop-types';
import {
  DAMAGE_VIEWS,
  H3_METRICS,
  LEGENDS,
} from '@/config/damageAssessmentConfig';

function getH3MetricLegend(metric) {
  if (metric === H3_METRICS.SEVERE) return LEGENDS.SEVERE_SHARE;
  if (metric === H3_METRICS.DAMAGED) return LEGENDS.DAMAGED_SHARE;
  return LEGENDS.DOMINANT;
}

function resolveActiveLegend(view, metric) {
  if (view === DAMAGE_VIEWS.BUILDINGS) {
    return LEGENDS.BUILDINGS;
  }
  if (view === DAMAGE_VIEWS.DENSITY) {
    return LEGENDS.DENSITY;
  }
  return getH3MetricLegend(metric);
}

/**
 * DamageLegend
 * Renders the color legend for the active layer.
 * The H3 and Building views both show the five damage classes plus "Not Assessed";
 * no percentage metric is offered.
 */
export default function DamageLegend({
  view = DAMAGE_VIEWS.H3,
  metric = H3_METRICS.DOMINANT,
}) {
  const activeLegend = resolveActiveLegend(view, metric);

  return (
    <div className="mt-3 border-t border-slate-200/80 pt-3">
      <div className="flex items-center justify-between gap-1 mb-2">
        <h4 className="text-xs font-semibold text-slate-800 leading-snug">
          {activeLegend.title}
        </h4>
      </div>

      {/* Swatches and text labels */}
      <div className="grid grid-cols-1 gap-1.5 text-xs text-slate-700">
        {activeLegend.items.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span
              className="inline-block w-4 h-3 rounded-xs border border-slate-300/60 shrink-0"
              style={{ backgroundColor: item.color }}
              aria-hidden="true"
            />
            <span className="truncate">{item.label}</span>
          </div>
        ))}
      </div>
      {activeLegend.note && (
        <p className="mt-2 text-[11px] text-slate-500 leading-snug">{activeLegend.note}</p>
      )}
    </div>
  );
}

DamageLegend.propTypes = {
  view: PropTypes.string,
  metric: PropTypes.string,
};
