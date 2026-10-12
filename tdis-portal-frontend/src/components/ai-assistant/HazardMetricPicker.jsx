import React, { useId } from 'react';
import PropTypes from 'prop-types';
import { HAZARD_METRICS, HAZARD_METRIC_LABELS } from '@/config/hazardMapConfig';

/**
 * Hazard layer picker for the AI assistant map, overlaid on the map's top-right corner.
 */
const HazardMetricPicker = ({
  metric,
  onChange,
  loading,
  error,
  count,
  isActiveLayer,
  hasAnswerMap = false,
  onShowAnswerMap = null,
}) => {
  const selectId = useId();
  const label = HAZARD_METRIC_LABELS[metric] || metric;

  let status;
  if (loading) {
    status = `Loading ${label}…`;
  } else if (error) {
    status = error;
  } else if (isActiveLayer) {
    status = `${count.toLocaleString()} hexes — ${label}`;
  } else {
    status = 'Showing chat answer — pick a hazard to browse';
  }

  // The select is display-only here: `metric` stays put so the hazard layer can
  // be won back with one pick, but showing its label while the map paints the
  // chat answer told the user the map was tornado when the answer was wildfire.
  const showingAnswerMap = !isActiveLayer;
  // The hazard layer masks a chat answer's map rather than discarding it, so
  // offer the way back. Only reachable while browsing hazards with an answer
  // map available — otherwise there is nothing to restore.
  const canRestoreAnswerMap = Boolean(isActiveLayer && hasAnswerMap && onShowAnswerMap);

  return (
    <div className="ai-hazard-picker">
      <label className="ai-hazard-picker__label" htmlFor={selectId}>
        Hazard layer
      </label>
      <select
        id={selectId}
        className="ai-hazard-picker__select"
        value={showingAnswerMap ? '' : metric}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading}
      >
        {showingAnswerMap && (
          <option value="" disabled>
            — chat answer —
          </option>
        )}
        {HAZARD_METRICS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
      <output
        className={`ai-hazard-picker__status${error ? ' ai-hazard-picker__status--error' : ''}`}
        aria-live="polite"
      >
        {status}
      </output>
      {canRestoreAnswerMap && (
        <button type="button" className="ai-hazard-picker__restore" onClick={onShowAnswerMap}>
          Show answer map
        </button>
      )}
    </div>
  );
};

HazardMetricPicker.propTypes = {
  metric: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  error: PropTypes.string,
  count: PropTypes.number,
  isActiveLayer: PropTypes.bool,
  hasAnswerMap: PropTypes.bool,
  onShowAnswerMap: PropTypes.func,
};

HazardMetricPicker.defaultProps = {
  loading: false,
  error: null,
  count: 0,
  isActiveLayer: true,
};

export default HazardMetricPicker;
