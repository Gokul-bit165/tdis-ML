/** Map tab id for the TDIS AI Assistant view. */
export const AI_ASSISTANT_TAB = 'ai-assistant';

/** Map tab id for Active Weather Events — Beta (Baron rainfall layers). */
export const ACTIVE_WEATHER_EVENTS_BETA_TAB = 'active-weather-events-beta';

/**
 * Parse VITE_ENABLE_TDIS_AI (build-time). Production releases should set `false`.
 * When unset: enabled for `npm run dev` only; disabled for `vite build` (production bundle).
 */
export function isTdisAiEnabled() {
    const raw = import.meta.env.VITE_ENABLE_TDIS_AI;
    if (raw !== undefined && String(raw).trim() !== '') {
        const v = String(raw).trim().toLowerCase();
        return v === 'true' || v === '1' || v === 'yes';
    }
    return import.meta.env.DEV;
}

/**
 * Parse VITE_ENABLE_ACTIVE_WEATHER_EVENTS_BETA (build-time).
 * When unset: disabled (`false`). Set `true` to show the beta tab.
 */
export function isActiveWeatherEventsBetaEnabled() {
    const raw = import.meta.env.VITE_ENABLE_ACTIVE_WEATHER_EVENTS_BETA;
    if (raw !== undefined && String(raw).trim() !== '') {
        const v = String(raw).trim().toLowerCase();
        return v === 'true' || v === '1' || v === 'yes';
    }
    return false;
}

/** Map tab id for Damage Assessment view. */
export const DAMAGE_ASSESSMENT_TAB = 'damage-assessment';

/**
 * Parse VITE_ENABLE_DAMAGE_ASSESSMENT (build-time).
 * When unset: enabled for `npm run dev` only; disabled for `vite build` (production bundle).
 */
export function isDamageAssessmentEnabled() {
    const raw = import.meta.env.VITE_ENABLE_DAMAGE_ASSESSMENT;
    if (raw !== undefined && String(raw).trim() !== '') {
        const v = String(raw).trim().toLowerCase();
        return v === 'true' || v === '1' || v === 'yes';
    }
    return Boolean(import.meta.env.DEV);
}

/**
 * @param {string | null | undefined} tab
 * @param {string} [defaultTab='map']
 * @returns {string}
 */
export function resolveActiveTab(tab, defaultTab = 'map') {
    const fallback = defaultTab || 'map';
    const value = tab ?? fallback;
    if (value === AI_ASSISTANT_TAB && !isTdisAiEnabled()) {
        return fallback;
    }
    if (value === ACTIVE_WEATHER_EVENTS_BETA_TAB && !isActiveWeatherEventsBetaEnabled()) {
        return fallback;
    }
    if (value === DAMAGE_ASSESSMENT_TAB && !isDamageAssessmentEnabled()) {
        return fallback;
    }
    return value;
}

