/**
 * LTS hex MVT properties → Mapbox popup HTML.
 * Columns match `public.precipitation_lts_l6` … `l10`.
 */

import { escapeHtmlForPopup, formatIsoTimeForPopup, getLtsHsiPeakValue } from './hmedMapUtils';
import { normalizeMvtLtsLabel } from './hmedLtsCountyUtils';

/** @type {[string, string][]} MVT key, full display label */
export const LTS_HEX_BUILDING_FIELDS = [
  ['total_residentialstructures', 'Residential'],
  ['total_commercial_structures', 'Commercial'],
  ['total_industrial_structures', 'Industrial'],
  ['total_agriculture_structures', 'Agriculture'],
  ['total_education_structures', 'Education'],
  ['total_government_structures', 'Government'],
  ['total_assembly_structures', 'Assembly'],
  ['total_utility_and_misc_structures', 'Utility & misc'],
  ['total_unclassified_structures', 'Unclassified'],
];

const COUNT_SENTINELS = /^(none|null|nan|undefined)$/i;

/**
 * @param {unknown} raw
 * @returns {number|null}
 */
export function parseLtsHexCount(raw) {
  if (raw == null) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? Math.round(raw) : null;
  const s = String(raw).trim();
  if (!s || COUNT_SENTINELS.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

/**
 * @param {number|null|undefined} n
 * @returns {string}
 */
export function formatLtsHexCount(n) {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US').format(n);
}

/**
 * @param {Record<string, unknown> | null | undefined} props
 * @param {string} key
 * @returns {unknown}
 */
export function getLtsHexProperty(props, key) {
  if (props == null || typeof props !== 'object') return undefined;
  if (Object.prototype.hasOwnProperty.call(props, key)) return props[key];
  const kLower = key.toLowerCase();
  for (const k of Object.keys(props)) {
    if (k.toLowerCase() === kLower) return props[k];
  }
  return undefined;
}

/**
 * @param {string|number|null|undefined} level
 * @returns {string}
 */
function severityAccentColor(level) {
  const n = Number(level);
  if (n >= 5) return '#dc2626';
  if (n >= 4) return '#ca8a04';
  return '#6366f1';
}

/**
 * @param {string|number|null|undefined} level
 * @returns {string}
 */
function severityBadgeStyles(level) {
  const n = Number(level);
  if (n >= 5) return 'background:#fef2f2;color:#991b1b;border-color:#fecaca';
  if (n >= 4) return 'background:#fffbeb;color:#92400e;border-color:#fde68a';
  return 'background:#eef2ff;color:#312e81;border-color:#c7d2fe';
}

/**
 * @param {unknown} raw
 * @returns {string}
 */
function formatCompactDateTime(raw) {
  const formatted = formatIsoTimeForPopup(raw);
  if (formatted === 'N/A') return '';
  const d = new Date(formatted);
  if (Number.isNaN(d.getTime())) return escapeHtmlForPopup(formatted);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * @param {unknown} start
 * @param {unknown} end
 * @returns {string}
 */
function formatPeakWindowRange(start, end) {
  const s = formatCompactDateTime(start);
  const e = formatCompactDateTime(end);
  if (s && e) return `${s} → ${e}`;
  if (s) return `${s} → —`;
  if (e) return `— → ${e}`;
  return 'Not available for this cell';
}

/**
 * @param {Record<string, unknown>} props
 * @param {number} h3Level
 */
export function extractLtsHexExposure(props, h3Level = 10) {
  const get = (key) => getLtsHexProperty(props, key);
  const h3IdRaw = get(`h3_l${h3Level}_id`) ?? get('h3_l10_id') ?? get('h3_id');
  const h3Id = h3IdRaw != null && String(h3IdRaw).trim() !== '' ? String(h3IdRaw).trim() : null;

  const buildings = LTS_HEX_BUILDING_FIELDS.map(([key, label]) => ({
    label,
    value: parseLtsHexCount(get(key)),
  }));

  const totalStructures = parseLtsHexCount(get('total_structures'));
  const hospitalCount = parseLtsHexCount(get('hospital_count'));
  const groceryCount = parseLtsHexCount(get('grocery_count'));
  const emergencyFacilityCount = parseLtsHexCount(get('emergency_facility_count'));
  const hsiPeak = getLtsHsiPeakValue(props, h3Level);
  const fetchedRaw = get('fetched_at');
  const fetchedAt =
    fetchedRaw != null && String(fetchedRaw).trim() !== '' ? String(fetchedRaw).trim() : null;

  const hasBuildingDetail = buildings.some((b) => b.value != null && b.value > 0);
  const hasCrit =
    (hospitalCount != null && hospitalCount > 0) ||
    (groceryCount != null && groceryCount > 0) ||
    (emergencyFacilityCount != null && emergencyFacilityCount > 0);
  const hasExposure =
    (totalStructures != null && totalStructures > 0) ||
    hasBuildingDetail ||
    hasCrit ||
    hsiPeak != null;

  return {
    h3Id,
    hsiPeak,
    fetchedAt,
    totalStructures,
    buildings,
    hospitalCount,
    groceryCount,
    emergencyFacilityCount,
    hasExposure,
  };
}

/**
 * @param {string} label
 * @param {string} value
 * @returns {string}
 */
function statCell(label, value) {
  return `<div class="lts-hex-popup__stat">
        <span class="lts-hex-popup__stat-label">${escapeHtmlForPopup(label)}</span>
        <span class="lts-hex-popup__stat-value">${value}</span>
    </div>`;
}

/** @deprecated Use {@link buildLtsHexPopupHtml} */
export function buildLtsHexExposureSectionHtml(props, h3Level) {
  return buildLtsHexPopupHtml(props, h3Level, { exposureOnly: true });
}

/**
 * LTS hex popup (threat + structures + facilities).
 * @param {Record<string, unknown>} props
 * @param {number} h3Level
 * @param {{ layerTitle?: string, exposureOnly?: boolean }} [options]
 * @returns {string}
 */
export function buildLtsHexPopupHtml(props, h3Level, options = {}) {
  const { layerTitle = 'Impact Forecast', exposureOnly = false } = options;

  const ltsLevel = props.lts_level ?? props.lts_level_l10 ?? null;
  const ltsLabel = normalizeMvtLtsLabel(props.lts_label ?? props.lts_label_l10 ?? null, ltsLevel);
  const riskZone =
    props.risk_zone != null && String(props.risk_zone).trim() !== ''
      ? escapeHtmlForPopup(String(props.risk_zone))
      : '—';
  const peakRange = formatPeakWindowRange(props.peak_start_time, props.peak_end_time);
  const accent = severityAccentColor(ltsLevel);
  const exp = extractLtsHexExposure(props, h3Level);

  const buildingRows = exp.buildings
    .map(
      ({ label, value }) =>
        `<div class="lts-hex-popup__row">
                    <span class="lts-hex-popup__row-label">${escapeHtmlForPopup(label)}</span>
                    <span class="lts-hex-popup__row-value">${formatLtsHexCount(value)}</span>
                </div>`
    )
    .join('');

  const facilitiesHtml = [
    ['Hospitals', exp.hospitalCount],
    ['Grocery', exp.groceryCount],
    ['Emergency facilities', exp.emergencyFacilityCount],
  ]
    .map(
      ([label, n]) =>
        `<div class="lts-hex-popup__fac-card">
                    <span class="lts-hex-popup__fac-label">${escapeHtmlForPopup(label)}</span>
                    <span class="lts-hex-popup__fac-value">${formatLtsHexCount(n)}</span>
                </div>`
    )
    .join('');

  const hsiVal = exp.hsiPeak != null ? escapeHtmlForPopup(exp.hsiPeak.toFixed(3)) : '—';
  const runLabel = exp.fetchedAt ? formatCompactDateTime(exp.fetchedAt) : null;

  const impactBlock = exp.hasExposure
    ? `
            <section class="lts-hex-popup__section">
                <div class="lts-hex-popup__section-head">
                    <h3 class="lts-hex-popup__section-title">Potential impact</h3>
                    <span class="lts-hex-popup__section-hint">Modeled 24h outlook</span>
                </div>
                <div class="lts-hex-popup__total-row">
                    <span class="lts-hex-popup__total-label">Total structures</span>
                    <span class="lts-hex-popup__total-value">${formatLtsHexCount(exp.totalStructures)}</span>
                </div>
                <div class="lts-hex-popup__rows">${buildingRows}</div>
                <div class="lts-hex-popup__fac-grid">${facilitiesHtml}</div>
            </section>`
    : `
            <section class="lts-hex-popup__section lts-hex-popup__section--muted">
                <p class="lts-hex-popup__muted">No structure or facility counts in this cell.</p>
            </section>`;

  if (exposureOnly) {
    return `<div class="lts-hex-popup lts-hex-popup--slice">${impactBlock}</div>`;
  }

  const levelBadge =
    ltsLevel != null && ltsLevel !== '' ? `Level ${escapeHtmlForPopup(ltsLevel)}` : 'Level —';

  return `
        <div class="lts-hex-popup">
            <header class="lts-hex-popup__head">
                <p class="lts-hex-popup__title">${escapeHtmlForPopup(layerTitle)}</p>
                <div class="lts-hex-popup__severity" style="border-left:4px solid ${accent};${severityBadgeStyles(ltsLevel)}">
                    <span class="lts-hex-popup__severity-level">${levelBadge}</span>
                    <span class="lts-hex-popup__severity-label">${escapeHtmlForPopup(ltsLabel)}</span>
                </div>
            </header>

            <section class="lts-hex-popup__section">
                <div class="lts-hex-popup__stats">
                    ${statCell('Risk zone', riskZone)}
                    ${statCell('HSI peak', hsiVal)}
                </div>
                <div class="lts-hex-popup__peak">
                    <span class="lts-hex-popup__peak-label">Peak window</span>
                    <span class="lts-hex-popup__peak-value">${peakRange}</span>
                </div>
            </section>

            ${impactBlock}

            <footer class="lts-hex-popup__foot">
                ${exp.h3Id ? `<p class="lts-hex-popup__h3"><span class="lts-hex-popup__foot-k">H3 cell</span> ${escapeHtmlForPopup(exp.h3Id)}</p>` : ''}
                ${runLabel ? `<p class="lts-hex-popup__run"><span class="lts-hex-popup__foot-k">Run</span> ${runLabel}</p>` : ''}
                <p class="lts-hex-popup__note">24-hour forecast · not observed damage or losses</p>
            </footer>
        </div>`;
}
