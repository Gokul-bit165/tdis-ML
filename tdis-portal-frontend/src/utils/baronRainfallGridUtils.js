/**
 * @fileoverview Helpers for Baron 1-hour rainfall H3 grid popups and display.
 */

import { formatIsoTimeForPopup, escapeHtmlForPopup } from './hmedMapUtils';

/**
 * @param {unknown} raw
 * @returns {number|null}
 */
export function parseBaronPrecipMm(raw) {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {number|null} mm
 * @returns {string}
 */
export function formatBaronPrecipMm(mm) {
  if (mm == null || !Number.isFinite(mm)) return '—';
  if (mm < 0.1) return '< 0.1 mm';
  if (mm < 10) return `${mm.toFixed(1)} mm`;
  return `${mm.toFixed(0)} mm`;
}

/**
 * @param {unknown} raw
 * @returns {string|null}
 */
function normalizeBaronText(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  return s ? s : null;
}

/**
 * @param {unknown} raw
 * @returns {string|null}
 */
function formatBaronCountyFips(raw) {
  const s = normalizeBaronText(raw);
  if (!s) return null;
  const countyFips = s.padStart(3, '0');
  return `48${countyFips}`;
}

/**
 * @param {unknown} county
 * @param {unknown} countyFips
 * @returns {{name: string|null, fips: string|null}}
 */
function formatBaronCounty(county, countyFips) {
  const countyName = normalizeBaronText(county);
  const fullFips = formatBaronCountyFips(countyFips);
  const name = countyName ? `${countyName}${/county$/i.test(countyName) ? '' : ' County'}` : null;
  return { name, fips: fullFips };
}

/**
 * @param {unknown} raw
 * @returns {string|null}
 */
function formatBaronSampleCount(raw) {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return escapeHtmlForPopup(String(raw));
  const count = Math.round(n);
  return `${new Intl.NumberFormat('en-US').format(count)} sample${count === 1 ? '' : 's'}`;
}

/**
 * @param {string} label
 * @param {string} value
 * @returns {string}
 */
function popupStat(label, value) {
  return `<div class="rounded-lg border border-slate-200 bg-white/90 px-3 py-2">
        <div class="text-[10px] font-semibold uppercase tracking-wide text-slate-500">${escapeHtmlForPopup(label)}</div>
        <div class="mt-0.5 text-sm font-bold text-slate-900">${value}</div>
    </div>`;
}

/**
 * @param {string} label
 * @param {string} value
 * @returns {string}
 */
function popupRow(label, value) {
  return `<div class="flex justify-between gap-3 py-1.5 border-b border-slate-100 last:border-0">
        <span class="text-slate-500 font-medium">${escapeHtmlForPopup(label)}</span>
        <span class="text-slate-900 font-semibold text-right break-all">${value}</span>
    </div>`;
}

/**
 * @param {Record<string, unknown>} props
 * @param {number} level - H3 resolution 6–8
 * @returns {string|null}
 */
export function getBaronH3HexFromProperties(props, level) {
  const keys = [`h3_l${level}_hex`, `h3_l${level}_id`, 'h3_hex', 'h3_id'];
  for (const k of keys) {
    const v = props?.[k];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return null;
}

/**
 * @param {Record<string, unknown>} props
 * @param {number} level
 * @returns {string}
 */
export function buildBaronRainfallGridPopupHtml(props, level) {
  const precip = parseBaronPrecipMm(props?.precip_1hr_avg_mm);
  const { name: countyName, fips: countyFips } = formatBaronCounty(
    props?.county,
    props?.countyfips
  );
  const zip = normalizeBaronText(props?.zipcode);
  const samples = formatBaronSampleCount(props?.sample_count);
  const h3 = getBaronH3HexFromProperties(props, level);
  const eventTime = props?.event_timestamp ?? props?.eventTimestamp;
  const runDate = props?.run_date ?? props?.runDate;
  const precipLabel = escapeHtmlForPopup(formatBaronPrecipMm(precip));
  const countyBadge = countyName
    ? `<div class="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2">
            <div class="text-[10px] font-bold uppercase tracking-wide text-sky-700">County</div>
            <div class="mt-0.5 flex flex-wrap items-center gap-1.5">
                <span class="text-sm font-bold text-slate-900">${escapeHtmlForPopup(countyName)}</span>
                ${countyFips ? `<span class="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-sky-100">FIPS ${escapeHtmlForPopup(countyFips)}</span>` : ''}
            </div>
        </div>`
    : '';

  const stats = [
    samples ? popupStat('Tile samples', escapeHtmlForPopup(samples)) : null,
    zip ? popupStat('ZIP', escapeHtmlForPopup(zip)) : null,
  ]
    .filter(Boolean)
    .join('');

  const detailRows = [
    h3 ? popupRow('H3 cell', escapeHtmlForPopup(h3)) : null,
    eventTime ? popupRow('Event time', escapeHtmlForPopup(formatIsoTimeForPopup(eventTime))) : null,
    runDate ? popupRow('Model run', escapeHtmlForPopup(formatIsoTimeForPopup(runDate))) : null,
  ]
    .filter(Boolean)
    .join('');

  return `
        <div class="p-3 min-w-[260px] max-w-[min(340px,calc(100vw-32px))] font-sans text-xs">
            <header class="rounded-xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-3">
                <p class="text-[10px] font-bold uppercase tracking-wide text-sky-700">Rainfall — Tile</p>
                <div class="mt-1 flex items-end justify-between gap-3">
                    <div>
                        <p class="text-2xl font-black leading-none text-slate-900">${precipLabel}</p>
                        <p class="mt-1 text-[10px] text-slate-500">Baron 1-hour accumulation · H3 L${level}</p>
                    </div>
                    <span class="rounded-full bg-sky-600 px-2 py-1 text-[10px] font-bold text-white">Avg</span>
                </div>
            </header>

            <section class="mt-3 space-y-2">
                ${countyBadge}
                ${stats ? `<div class="grid grid-cols-2 gap-2">${stats}</div>` : ''}
            </section>

            ${detailRows ? `<section class="mt-3 rounded-xl border border-slate-100 bg-white px-3 py-1">${detailRows}</section>` : ''}

            <footer class="mt-2 text-[10px] leading-snug text-slate-500">
                Values are model-derived 1-hour rainfall averages for the clicked H3 cell.
            </footer>
        </div>
    `;
}
