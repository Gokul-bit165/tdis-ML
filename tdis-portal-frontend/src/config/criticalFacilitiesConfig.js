/**
 * Critical facility overlays for Live Weather (Active Events).
 * Points from RAMP API GeoJSON (`VITE_RAMP_API_ROOT`), same fetch pattern as Flood Hub gauges.
 *
 * RAMP only accepts `?county=<fips>` or `?city=<id>`. Statewide = fetch all TX counties and merge.
 */

/**
 * @typedef {'fire_stations' | 'schools' | 'hospitals'} CriticalFacilityId
 */

/**
 * @type {Array<{
 *   id: CriticalFacilityId,
 *   label: string,
 *   iconId: string,
 *   color: string,
 *   sourceId: string,
 *   layerId: string,
 *   geoJsonPath: string,
 *   hasData: boolean,
 *   defaultVisible: boolean,
 *   minzoom: number,
 * }>}
 */
export const CRITICAL_FACILITY_LAYERS = [
  {
    id: 'fire_stations',
    label: 'Fire stations',
    iconId: 'facility-fire-station',
    color: '#dc2626',
    sourceId: 'critical-facilities-fire-stations',
    layerId: 'critical-facilities-fire-stations-symbol',
    geoJsonPath: '/downloads/points-of-interest/fire-stations/geojson',
    hasData: true,
    defaultVisible: false,
    minzoom: 5,
  },
  {
    id: 'schools',
    label: 'Schools',
    iconId: 'facility-school',
    color: '#2563eb',
    sourceId: 'critical-facilities-schools',
    layerId: 'critical-facilities-schools-symbol',
    geoJsonPath: '/downloads/points-of-interest/schools/geojson',
    hasData: true,
    defaultVisible: false,
    minzoom: 5,
  },
  {
    id: 'hospitals',
    label: 'Hospitals',
    iconId: 'facility-hospital',
    color: '#059669',
    sourceId: 'critical-facilities-hospitals',
    layerId: 'critical-facilities-hospitals-symbol',
    geoJsonPath: '/downloads/points-of-interest/hospitals/geojson',
    hasData: true,
    defaultVisible: false,
    minzoom: 5,
  },
];

/** Parallel county requests when loading statewide (254 counties). */
export const CRITICAL_FACILITY_COUNTY_FETCH_CONCURRENCY = 8;

export function getDefaultCriticalFacilityVisibility() {
  return Object.fromEntries(
    CRITICAL_FACILITY_LAYERS.map((layer) => [layer.id, layer.defaultVisible && layer.hasData])
  );
}

/**
 * Normalize county id for RAMP (`201` not `48201`).
 * @param {string} raw
 * @returns {string}
 */
export function normalizeRampCountyFips(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const three = /^\d{5}$/.test(s) ? s.slice(-3) : s.padStart(3, '0').slice(-3);
  return String(Number.parseInt(three, 10));
}

/**
 * Single-area override for local testing. When unset → statewide (all TX counties).
 * Env: `VITE_RAMP_POI_COUNTY` / `VITE_RAMP_POI_AREA_ID`, optional `VITE_RAMP_POI_AREA_TYPE=city`.
 * @returns {{ areaType: 'county' | 'city', areaId: string } | null}
 */
export function getCriticalFacilityAreaFilter() {
  const rawType = (import.meta.env.VITE_RAMP_POI_AREA_TYPE || 'county').trim().toLowerCase();
  const areaType = rawType === 'city' ? 'city' : 'county';
  let areaId = (
    import.meta.env.VITE_RAMP_POI_AREA_ID ||
    import.meta.env.VITE_RAMP_POI_COUNTY ||
    ''
  ).trim();
  if (!areaId) return null;
  if (areaType === 'county') areaId = normalizeRampCountyFips(areaId);
  return { areaType, areaId };
}
