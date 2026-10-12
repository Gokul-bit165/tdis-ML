/**
 * Mapbox helpers for Live Weather critical-facility overlays (icons, layers, popups).
 * Sources are RAMP API GeoJSON (same pattern as Flood Hub gauges).
 */

import mapboxgl from 'mapbox-gl';
import { CRITICAL_FACILITY_LAYERS } from '../config/criticalFacilitiesConfig';
import {
  emptyFacilityCollection,
  fetchCriticalFacilityGeoJson,
} from '../services/criticalFacilitiesService';
import { isMapAlive } from './mapUtils';

/** @type {Set<string>} */
const loadedFacilityIds = new Set();
/** @type {Set<string>} */
const loadingFacilityIds = new Set();

/**
 * Draw a simple circular facility icon onto a canvas and register it with the map.
 * @param {mapboxgl.Map} map
 * @param {string} iconId
 * @param {string} fillColor
 * @param {'flame'|'book'|'cross'} glyph
 */
function ensureFacilityIcon(map, iconId, fillColor, glyph) {
  if (!isMapAlive(map) || map.hasImage(iconId)) return;

  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.beginPath();
  ctx.arc(size / 2, size / 2 + 1, 26, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(size / 2, size / 2, 24, 0, Math.PI * 2);
  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (glyph === 'flame') {
    ctx.beginPath();
    ctx.moveTo(32, 44);
    ctx.quadraticCurveTo(18, 34, 26, 22);
    ctx.quadraticCurveTo(30, 28, 32, 18);
    ctx.quadraticCurveTo(34, 28, 38, 22);
    ctx.quadraticCurveTo(46, 34, 32, 44);
    ctx.fill();
  } else if (glyph === 'book') {
    ctx.fillRect(22, 20, 20, 24);
    ctx.fillStyle = fillColor;
    ctx.fillRect(31, 20, 2, 24);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(24, 24, 6, 2);
    ctx.fillRect(24, 28, 6, 2);
    ctx.fillRect(34, 24, 6, 2);
    ctx.fillRect(34, 28, 6, 2);
  } else if (glyph === 'cross') {
    ctx.fillRect(29, 18, 6, 28);
    ctx.fillRect(18, 29, 28, 6);
  }

  const imgData = ctx.getImageData(0, 0, size, size);
  map.addImage(
    iconId,
    {
      width: size,
      height: size,
      data: new Uint8Array(imgData.data.buffer),
    },
    { pixelRatio: 2 }
  );
}

const GLYPH_BY_ID = {
  fire_stations: 'flame',
  schools: 'book',
  hospitals: 'cross',
};

/**
 * @param {mapboxgl.Map} map
 */
export function ensureCriticalFacilityIcons(map) {
  CRITICAL_FACILITY_LAYERS.forEach((layer) => {
    ensureFacilityIcon(map, layer.iconId, layer.color, GLYPH_BY_ID[layer.id]);
  });
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function popupValueToString(value) {
  switch (typeof value) {
    case 'string':
      return value;
    case 'number':
    case 'bigint':
    case 'boolean':
      return String(value);
    default:
      return '';
  }
}

/**
 * @param {Record<string, unknown>} props
 * @param {string[]} keys
 * @returns {string}
 */
export function pickFacilityProp(props, keys) {
  if (!props || typeof props !== 'object') return '';
  for (const key of keys) {
    const text = popupValueToString(props[key]).trim();
    if (text) return text;
  }
  return '';
}

/**
 * @param {string} cssText
 * @param {string} [tagName='div']
 * @returns {HTMLElement}
 */
function createStyledElement(cssText, tagName = 'div') {
  const el = document.createElement(tagName);
  el.style.cssText = cssText;
  return el;
}

/**
 * @param {HTMLElement} parent
 * @param {string} key
 * @param {unknown} value
 */
function appendPopupRow(parent, key, value) {
  const text = popupValueToString(value).trim();
  if (!text) return;

  const row = createStyledElement('display:flex;gap:8px;margin:2px 0;font-size:12px;line-height:1.35');
  const keyEl = createStyledElement('color:#64748b;min-width:58px;font-weight:600', 'span');
  keyEl.textContent = key;
  const valEl = createStyledElement('color:#334155', 'span');
  valEl.textContent = text;
  row.append(keyEl, valEl);
  parent.append(row);
}

/**
 * @param {Record<string, unknown>} props
 * @param {string} label
 * @returns {HTMLElement}
 */
export function buildCriticalFacilityPopupNode(props, label) {
  const root = createStyledElement('min-width:200px;max-width:280px;padding:2px 0');
  const title = createStyledElement('margin:0 0 6px;font-size:13px;font-weight:700;color:#324755', 'p');
  const name = pickFacilityProp(props, ['name', 'NAME', 'facility_name', 'FACILITY', 'school_name']);
  title.textContent = name || label;
  root.append(title);

  const facilityType =
    pickFacilityProp(props, ['facility_type', 'FACILITY_TYPE', 'FTYPE', 'type', 'TYPE']) || label;

  [
    ['Type', facilityType],
    ['Address', pickFacilityProp(props, ['address', 'ADDRESS', 'street', 'STREET', 'addr'])],
    ['City', pickFacilityProp(props, ['city', 'CITY', 'municipality'])],
    ['County', pickFacilityProp(props, ['county', 'COUNTY', 'county_name'])],
    ['ZIP', pickFacilityProp(props, ['zip', 'ZIP', 'zipcode', 'ZIPCODE', 'postal_code'])],
    ['Phone', pickFacilityProp(props, ['phone', 'PHONE', 'telephone'])],
    ['Agency', pickFacilityProp(props, ['agency', 'AGENCY', 'owner', 'OWNER'])],
  ].forEach(([key, value]) => appendPopupRow(root, key, value));

  return root;
}

/**
 * Register empty GeoJSON sources/layers (no RAMP calls yet — fetch on first legend toggle).
 * @param {mapboxgl.Map} map
 * @param {Record<string, boolean>} visibility
 */
export async function loadCriticalFacilityLayers(map, visibility = {}) {
  if (!isMapAlive(map)) return;
  ensureCriticalFacilityIcons(map);
  loadedFacilityIds.clear();
  loadingFacilityIds.clear();

  CRITICAL_FACILITY_LAYERS.forEach((cfg) => {
    if (map.getLayer(cfg.layerId)) map.removeLayer(cfg.layerId);
    if (map.getSource(cfg.sourceId)) map.removeSource(cfg.sourceId);

    map.addSource(cfg.sourceId, {
      type: 'geojson',
      data: emptyFacilityCollection(),
    });

    map.addLayer({
      id: cfg.layerId,
      type: 'symbol',
      source: cfg.sourceId,
      minzoom: cfg.minzoom,
      layout: {
        'icon-image': cfg.iconId,
        'icon-size': 0.55,
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        visibility: 'none',
      },
    });
  });

  await ensureVisibleFacilitiesLoaded(map, visibility);
}

/**
 * Fetch RAMP GeoJSON for a facility type once, then set the map source data.
 * @param {mapboxgl.Map} map
 * @param {string} facilityId
 */
async function loadFacilityDataIntoMap(map, facilityId) {
  if (!isMapAlive(map) || loadedFacilityIds.has(facilityId) || loadingFacilityIds.has(facilityId)) {
    return;
  }
  const cfg = CRITICAL_FACILITY_LAYERS.find((l) => l.id === facilityId);
  if (!cfg) return;

  loadingFacilityIds.add(facilityId);
  try {
    const data = await fetchCriticalFacilityGeoJson(/** @type {any} */ (facilityId));
    if (!isMapAlive(map)) return;
    const source = map.getSource(cfg.sourceId);
    if (source?.type === 'geojson') {
      /** @type {mapboxgl.GeoJSONSource} */ (source).setData(data);
    }
    loadedFacilityIds.add(facilityId);
  } catch (err) {
    console.warn(`[Critical facilities] ${facilityId} unavailable:`, err);
    loadedFacilityIds.add(facilityId);
  } finally {
    loadingFacilityIds.delete(facilityId);
  }
}

/**
 * @param {mapboxgl.Map} map
 * @param {Record<string, boolean>} visibility
 */
async function ensureVisibleFacilitiesLoaded(map, visibility) {
  const toLoad = CRITICAL_FACILITY_LAYERS.filter(
    (cfg) => Boolean(visibility[cfg.id]) && cfg.hasData
  ).map((cfg) => cfg.id);
  await Promise.all(toLoad.map((id) => loadFacilityDataIntoMap(map, id)));
}

/**
 * @param {mapboxgl.Map} map
 * @param {Record<string, boolean>} visibility
 */
export async function updateCriticalFacilityVisibility(map, visibility) {
  if (!isMapAlive(map)) return;

  await ensureVisibleFacilitiesLoaded(map, visibility);
  if (!isMapAlive(map)) return;

  CRITICAL_FACILITY_LAYERS.forEach((cfg) => {
    if (!map.getLayer(cfg.layerId)) return;
    const visible = Boolean(visibility[cfg.id]) && cfg.hasData;
    map.setLayoutProperty(cfg.layerId, 'visibility', visible ? 'visible' : 'none');
  });
}

/**
 * @param {mapboxgl.Map} map
 */
export function bindCriticalFacilityInteractions(map) {
  if (!isMapAlive(map)) return () => {};

  const popup = new mapboxgl.Popup({
    closeButton: true,
    closeOnClick: true,
    maxWidth: '300px',
    offset: 16,
  });

  const layerIds = CRITICAL_FACILITY_LAYERS.map((l) => l.layerId);
  const onEnter = () => {
    map.getCanvas().style.cursor = 'pointer';
  };
  const onLeave = () => {
    map.getCanvas().style.cursor = '';
  };
  const onClick = (e) => {
    const feature = e.features?.[0];
    if (!feature) return;
    const layerCfg = CRITICAL_FACILITY_LAYERS.find((l) => l.layerId === feature.layer?.id);
    const coords = feature.geometry?.type === 'Point' ? feature.geometry.coordinates.slice() : null;
    if (!coords) return;
    popup
      .setLngLat(coords)
      .setDOMContent(
        buildCriticalFacilityPopupNode(feature.properties || {}, layerCfg?.label || 'Facility')
      )
      .addTo(map);
  };

  layerIds.forEach((id) => {
    map.on('mouseenter', id, onEnter);
    map.on('mouseleave', id, onLeave);
    map.on('click', id, onClick);
  });

  return () => {
    popup.remove();
    layerIds.forEach((id) => {
      try {
        map.off('mouseenter', id, onEnter);
        map.off('mouseleave', id, onLeave);
        map.off('click', id, onClick);
      } catch {
        /* ignore */
      }
    });
  };
}
