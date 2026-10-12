/**
 * @fileoverview Merge MVT gauge properties with PRD static demo enrichments (hydrograph, NWPS, flags).
 */

import { getFloodHubPopupFields } from './hmedMapUtils';
import { getStaticGaugeDetailRecord } from '../data/floodHubPrdStaticData';

/** Hours spanned on the x-axis for legacy tiles (current + peak only). */
export const FLOOD_HUB_GAUGE_HYDROGRAPH_HOURS = 72;

/**
 * Build hydrograph model: prefers per-day curr_minus_2…curr_plus_5 from MVT when present, else 0–72h two-point series.
 * @param {{
 *   peak: number|null,
 *   current: number|null,
 *   warning: number|null,
 *   danger: number|null,
 *   extreme: number|null,
 *   dischargeByDay: { dayOffsets: number[], values: (number|null)[] } | null | undefined
 * }} fields
 * @returns {object | null}
 */
export function buildGaugeHydrographFromFields(fields) {
  const daily = fields?.dischargeByDay;
  const dailyVals = daily?.values;
  const finiteDaily = Array.isArray(dailyVals)
    ? dailyVals.filter((v) => v != null && Number.isFinite(v))
    : [];
  if (
    daily &&
    Array.isArray(daily.dayOffsets) &&
    Array.isArray(dailyVals) &&
    finiteDaily.length >= 2
  ) {
    const nowDayIndex = daily.dayOffsets.indexOf(0);
    return {
      mode: 'daily',
      dayOffsets: [...daily.dayOffsets],
      values: dailyVals.map((v) => (v != null && Number.isFinite(Number(v)) ? Number(v) : null)),
      nowDayIndex: nowDayIndex >= 0 ? nowDayIndex : 2,
      warning: fields?.warning ?? null,
      danger: fields?.danger ?? null,
      extreme: fields?.extreme ?? null,
    };
  }

  const peak = fields?.peak ?? null;
  const current = fields?.current ?? null;
  if (peak == null && current == null) return null;
  const v0 = current != null ? current : peak;
  const v72 = peak != null ? peak : current;
  return {
    mode: 'legacy',
    hours: [0, FLOOD_HUB_GAUGE_HYDROGRAPH_HOURS],
    values: [v0, v72],
    warning: fields?.warning ?? null,
    danger: fields?.danger ?? null,
    extreme: fields?.extreme ?? null,
  };
}

/**
 * @param {Record<string, unknown>} rawProps - GeoJSON or MVT properties
 * @param {{ lng: number; lat: number } | null | undefined} [lngLat] - map click; fills lat/lon when missing from tile attributes / encoded point
 * @returns {{ fields: ReturnType<typeof getFloodHubPopupFields>, staticDetail: ReturnType<typeof getStaticGaugeDetailRecord> }}
 */
export function buildFloodHubGaugePanelModel(rawProps, lngLat) {
  const fields = getFloodHubPopupFields(rawProps);
  let { gaugeLatitude, gaugeLongitude } = fields;
  if (
    (gaugeLatitude == null || gaugeLongitude == null) &&
    lngLat != null &&
    typeof lngLat.lng === 'number' &&
    typeof lngLat.lat === 'number' &&
    Number.isFinite(lngLat.lng) &&
    Number.isFinite(lngLat.lat)
  ) {
    gaugeLatitude = gaugeLatitude ?? lngLat.lat;
    gaugeLongitude = gaugeLongitude ?? lngLat.lng;
  }
  const staticDetail = getStaticGaugeDetailRecord(fields.gaugeId);
  return {
    fields: { ...fields, gaugeLatitude, gaugeLongitude },
    staticDetail,
  };
}

/**
 * Prefer MVT NWPS URL when present; else static demo URL (may be null for virtual gauges).
 * @param {{ nwpsUrl: string }} fields
 * @param {{ nwpsUrl: string | null }} staticDetail
 * @returns {string}
 */
export function resolveNwpsUrl(fields, staticDetail) {
  const u = (fields.nwpsUrl || '').trim();
  if (u) return u;
  const s = staticDetail?.nwpsUrl;
  return s && String(s).trim() ? String(s) : '';
}

/**
 * @param {{ qualityVerified: boolean|null }} fields
 * @param {{ qualityVerified: boolean|null }} staticDetail
 * @returns {boolean|null}
 */
export function resolveQualityVerified(fields, staticDetail) {
  if (fields.qualityVerified === true || fields.qualityVerified === false)
    return fields.qualityVerified;
  if (staticDetail?.qualityVerified === true || staticDetail?.qualityVerified === false)
    return staticDetail.qualityVerified;
  return null;
}

/**
 * @param {{ isVirtual: boolean|null }} fields
 * @param {{ isVirtual: boolean|null }} staticDetail
 * @returns {boolean|null}
 */
export function resolveIsVirtual(fields, staticDetail) {
  if (fields.isVirtual === true || fields.isVirtual === false) return fields.isVirtual;
  if (staticDetail?.isVirtual === true || staticDetail?.isVirtual === false)
    return staticDetail.isVirtual;
  if (
    String(fields.gaugeId || '')
      .toLowerCase()
      .startsWith('hybas')
  )
    return true;
  return null;
}
