import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { X, Copy, Hexagon, ChevronDown } from 'lucide-react';
import './AIAssistantTab.css';

const LONG_STRING_THRESHOLD = 280;

function formatLabel(key) {
  if (key === 'pop') return 'Population';
  return String(key)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatScalar(value) {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value === 'number' && !Number.isNaN(value)) return value.toLocaleString();
  return String(value);
}

/**
 * @param {Record<string, unknown>} feature
 */
function partitionEntries(feature) {
  const metrics = [];
  const strings = [];
  const booleans = [];
  const complex = [];

  const sortByKey = (a, b) => a[0].localeCompare(b[0]);

  for (const [key, value] of Object.entries(feature)) {
    if (key === 'hex_id' || key === 'id') continue;
    if (value === null || value === undefined) {
      strings.push([key, value]);
      continue;
    }
    const t = typeof value;
    if (t === 'number' && !Number.isNaN(value)) metrics.push([key, value]);
    else if (t === 'boolean') booleans.push([key, value]);
    else if (t === 'object') complex.push([key, value]);
    else if (t === 'string') strings.push([key, value]);
    else strings.push([key, typeof value === 'bigint' ? value.toString() : String(value)]);
  }

  metrics.sort(sortByKey);
  strings.sort(sortByKey);
  booleans.sort(sortByKey);
  complex.sort(sortByKey);

  return { metrics, strings, booleans, complex };
}

function stringifyNested(value, depth = 0) {
  if (depth > 6) return JSON.stringify(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function FeatureHero({ hexId, recordId, hexCopied, onCopyHex }) {
  const showCopyHex = Boolean(hexId);
  return (
    <div className="ai-feature-hero">
      <div className="ai-feature-hero__label">H3 index</div>
      {hexId ? (
        <div className="ai-feature-hero__id-row">
          <code className="ai-feature-hero__id" title={hexId}>
            {hexId}
          </code>
          {showCopyHex ? (
            <button
              type="button"
              className="ai-feature-hero__copy"
              onClick={onCopyHex}
              aria-label="Copy H3 index"
            >
              <Copy size={14} />
            </button>
          ) : null}
        </div>
      ) : (
        <p className="ai-feature-hero__missing">No hex id on this record.</p>
      )}
      {recordId ? (
        <div className="ai-feature-hero__secondary">
          <span className="ai-feature-hero__secondary-label">Record id</span>
          <code className="ai-feature-hero__secondary-id">{recordId}</code>
        </div>
      ) : null}
      {hexCopied ? (
        <p className="ai-feature-copy-hint" role="status">
          H3 index copied
        </p>
      ) : null}
    </div>
  );
}

function FeatureMetricsSection({ metrics }) {
  if (metrics.length === 0) return null;
  return (
    <section className="ai-feature-section" aria-labelledby="ai-feature-metrics-heading">
      <h4 id="ai-feature-metrics-heading" className="ai-feature-section__title">
        Metrics
      </h4>
      <ul className="ai-feature-metric-grid">
        {metrics.map(([key, value]) => (
          <li key={key} className="ai-feature-metric-card">
            <span className="ai-feature-metric-card__label">{formatLabel(key)}</span>
            <span className="ai-feature-metric-card__value">{formatScalar(value)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FeatureFlagsSection({ booleans }) {
  if (booleans.length === 0) return null;
  return (
    <section className="ai-feature-section" aria-labelledby="ai-feature-bool-heading">
      <h4 id="ai-feature-bool-heading" className="ai-feature-section__title">
        Flags
      </h4>
      <dl className="ai-feature-dl">
        {booleans.map(([key, value]) => (
          <div key={key} className="ai-feature-dl__row">
            <dt>{formatLabel(key)}</dt>
            <dd>
              <span className={value ? 'ai-feature-pill ai-feature-pill--on' : 'ai-feature-pill'}>
                {value ? 'Yes' : 'No'}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function FeatureTextFieldsSection({ strings, expandedKeys, onToggleExpanded }) {
  if (strings.length === 0) return null;
  return (
    <section className="ai-feature-section" aria-labelledby="ai-feature-text-heading">
      <h4 id="ai-feature-text-heading" className="ai-feature-section__title">
        {'Text & other fields'}
      </h4>
      <div className="ai-feature-field-list">
        {strings.map(([key, value]) => {
          const raw = formatScalar(value);
          const long = typeof value === 'string' && value.length > LONG_STRING_THRESHOLD;
          const expanded = expandedKeys.has(key);
          const display = long && !expanded ? `${value.slice(0, LONG_STRING_THRESHOLD)}…` : raw;

          return (
            <div key={key} className="ai-feature-field">
              <div className="ai-feature-field__label">{formatLabel(key)}</div>
              <div className="ai-feature-field__value ai-feature-value-multiline">{display}</div>
              {long ? (
                <button
                  type="button"
                  className="ai-feature-expand-btn"
                  onClick={() => onToggleExpanded(key)}
                  aria-expanded={expanded}
                >
                  {expanded ? 'Show less' : 'Show full text'}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function FeatureNestedSection({ complex }) {
  if (complex.length === 0) return null;
  return (
    <section className="ai-feature-section" aria-labelledby="ai-feature-nested-heading">
      <h4 id="ai-feature-nested-heading" className="ai-feature-section__title">
        Nested data
      </h4>
      <p className="ai-feature-section__lead">
        Objects and arrays from the assistant payload (full structure).
      </p>
      <div className="ai-feature-nested-list">
        {complex.map(([key, value]) => (
          <details key={key} className="ai-feature-json-details">
            <summary className="ai-feature-json-details__summary">
              <ChevronDown className="ai-feature-json-details__chevron" size={16} aria-hidden />
              <span className="ai-feature-json-details__title">{formatLabel(key)}</span>
              <span className="ai-feature-json-details__badge">
                {Array.isArray(value) ? `Array (${value.length})` : 'Object'}
              </span>
            </summary>
            <pre className="ai-feature-json-pre">{stringifyNested(value)}</pre>
          </details>
        ))}
      </div>
    </section>
  );
}

function FeatureRawTableSection({ feature }) {
  return (
    <section className="ai-feature-section" aria-labelledby="ai-feature-all-heading">
      <h4 id="ai-feature-all-heading" className="ai-feature-section__title">
        All properties (raw)
      </h4>
      <p className="ai-feature-section__lead">Exact keys and values as received for this hex.</p>
      <div className="ai-feature-raw-table-wrap">
        <table className="ai-feature-raw-table">
          <tbody>
            {Object.entries(feature).map(([key, value]) => (
              <tr key={key}>
                <th scope="row" className="ai-feature-raw-table__key">
                  {key}
                </th>
                <td className="ai-feature-raw-table__val">
                  {value !== null &&
                  value !== undefined &&
                  (typeof value === 'object' || Array.isArray(value)) ? (
                    <pre className="ai-feature-raw-table__pre">{stringifyNested(value)}</pre>
                  ) : (
                    formatScalar(value)
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const AIAssistantFeatureDetails = ({ feature, onClose }) => {
  const [hexCopied, setHexCopied] = useState(false);
  const copyTimerRef = useRef(null);
  const [expandedKeys, setExpandedKeys] = useState(() => new Set());

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const hexId = feature?.hex_id != null ? String(feature.hex_id) : '';
  const recordId = feature?.id != null && String(feature.id) !== hexId ? String(feature.id) : '';

  const { metrics, strings, booleans, complex } = useMemo(
    () =>
      feature && typeof feature === 'object' ? partitionEntries(feature) : partitionEntries({}),
    [feature]
  );

  const totalFieldCount = useMemo(() => {
    if (!feature || typeof feature !== 'object') return 0;
    return Object.keys(feature).length;
  }, [feature]);

  const handleCopyHex = useCallback(() => {
    if (!hexId) return;
    void navigator.clipboard.writeText(hexId).then(() => {
      setHexCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setHexCopied(false), 2000);
    });
  }, [hexId]);

  const toggleExpanded = useCallback((key) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  if (!feature || typeof feature !== 'object') return null;

  return (
    <div className="ai-feature-details" role="region" aria-label="Hex cell details">
      <div className="ai-feature-header">
        <div className="ai-feature-header__title">
          <span className="ai-feature-header__icon" aria-hidden>
            <Hexagon size={18} strokeWidth={2} />
          </span>
          <div className="ai-feature-header__text">
            <h3>Hex cell details</h3>
            <p className="ai-feature-header__meta">
              {totalFieldCount} propert{totalFieldCount === 1 ? 'y' : 'ies'}
              {metrics.length > 0 ? ` · ${metrics.length} numeric` : ''}
              {complex.length > 0 ? ` · ${complex.length} nested` : ''}
            </p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="ai-close-btn" aria-label="Close details">
          <X size={16} />
        </button>
      </div>

      <div className="ai-feature-content">
        <FeatureHero
          hexId={hexId}
          recordId={recordId}
          hexCopied={hexCopied}
          onCopyHex={handleCopyHex}
        />
        <FeatureMetricsSection metrics={metrics} />
        <FeatureFlagsSection booleans={booleans} />
        <FeatureTextFieldsSection
          strings={strings}
          expandedKeys={expandedKeys}
          onToggleExpanded={toggleExpanded}
        />
        <FeatureNestedSection complex={complex} />
        <FeatureRawTableSection feature={feature} />
      </div>
    </div>
  );
};

export default AIAssistantFeatureDetails;
