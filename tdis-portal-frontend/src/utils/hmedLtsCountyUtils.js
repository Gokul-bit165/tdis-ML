/**
 * Client-side helpers for LTS county list (search + severity display).
 */

/**
 * @param {Array<{ county?: string, countyfips?: string }>} counties
 * @param {string} query
 * @returns {typeof counties}
 */
export function filterLtsCountiesBySearch(counties, query) {
  if (!counties?.length) return [];
  const q = (query || '').trim().toLowerCase();
  if (!q) return counties;
  return counties.filter((c) => {
    const name = (c.county || '').toLowerCase();
    const fips = (c.countyfips || '').toLowerCase();
    return name.includes(q) || fips.includes(q);
  });
}

/**
 * @param {string|number|null|undefined} raw
 * @returns {number|null} 1–5 or null
 */
export function parseLtsLevel(raw) {
  if (raw == null || raw === '') return null;
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n) || n < 1 || n > 5) return null;
  return n;
}

/** Canonical display names; numeric 1–2 (legacy storage) map to Moderate. */
const LTS_LEVEL_LABELS = {
  1: 'Moderate',
  2: 'Moderate',
  3: 'Moderate',
  4: 'Potentially High',
  5: 'Potentially Very High',
};

const LEGACY_LTS_LABEL_WORDS = new Set(['very low', 'low', 'medium']);

/**
 * Ordinal LTS level (1–5) → display label for hex popups and fallbacks.
 * @param {string|number|null|undefined} level
 * @returns {string}
 */
export function ltsLevelToDisplayLabel(level) {
  if (level == null || level === '' || isNaN(Number(level))) return 'N/A';
  return LTS_LEVEL_LABELS[Number(level)] ?? 'N/A';
}

/**
 * Vector tiles sometimes encode missing labels as the string "None". Prefer level-based label.
 * @param {string|null|undefined} rawLabel
 * @param {string|number|null|undefined} level
 * @returns {string}
 */
export function normalizeMvtLtsLabel(rawLabel, level) {
  const fromLevel = ltsLevelToDisplayLabel(level);
  if (rawLabel == null) return fromLevel;
  const s = String(rawLabel).trim();
  if (!s || s.toLowerCase() === 'none' || s.toLowerCase() === 'null') {
    return fromLevel;
  }
  if (LEGACY_LTS_LABEL_WORDS.has(s.toLowerCase())) {
    return fromLevel;
  }
  const n = Number(level);
  if (Number.isFinite(n) && n === 4 && /^high$/i.test(s)) return fromLevel;
  if (Number.isFinite(n) && n === 5 && /^very high$/i.test(s)) return fromLevel;
  return s;
}

/**
 * @param {{ severityLevels?: { value: number, label: string, color: string }[] }} ltsConfig - e.g. LAYER_CONFIG.lts_flash_flood
 * @param {string|number|null|undefined} rawLevel
 * @returns {{ label: string, bg: string, border: string, text: string }} — `text` uses `chipText` when set (WCAG-friendly on pale chip fills).
 */
export function getLtsSeverityChipStyle(ltsConfig, rawLevel) {
  const n = parseLtsLevel(rawLevel);
  const levels = ltsConfig?.severityLevels || [];
  const tierValue = n != null && n <= 2 ? 3 : n;
  const match = levels.find((s) => s.value === tierValue);
  const color = match?.color || '#94a3b8';
  const moderate = levels.find((s) => s.value === 3);
  const label =
    n != null && n <= 2
      ? (moderate?.label ?? 'Moderate')
      : match?.label || (n != null ? `L${n}` : '—');
  const text = match?.chipText || color;
  return {
    label,
    bg: `${color}22`,
    border: `${color}66`,
    text,
  };
}
