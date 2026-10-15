/**
 * Damage Assessment Configuration.
 * Contains class definitions, Mapbox layer/source IDs, zoom ladders,
 * metric calculation helpers, and style paint expressions.
 */

const COLOR_UNDAMAGED = '#22A65A';
const COLOR_PARTIAL_ROOF = '#F5D547';
const COLOR_TOTAL_ROOF = '#F28C28';
const COLOR_PARTIAL_COLLAPSE = '#E44747';
const COLOR_TOTAL_COLLAPSE = '#991F36';
const COLOR_NOT_ASSESSED = '#9CA3AF';
const STATE_SELECTED = 'selected';

export const DAMAGE_CLASSES = {
  0: { code: 0, label: 'Undamaged', color: COLOR_UNDAMAGED },
  1: { code: 1, label: 'Partial Roof Damage', color: COLOR_PARTIAL_ROOF },
  2: { code: 2, label: 'Total Roof Damage', color: COLOR_TOTAL_ROOF },
  3: { code: 3, label: 'Partial Structural Collapse', color: COLOR_PARTIAL_COLLAPSE },
  4: { code: 4, label: 'Total Structural Collapse', color: COLOR_TOTAL_COLLAPSE },
};

export const NOT_ASSESSED_CLASS = {
  code: -1,
  label: 'Not Assessed',
  color: COLOR_NOT_ASSESSED,
};

/**
 * Returns class info for a given code. Any unknown code or null returns the neutral grey not-assessed class.
 * @param {number|string|null|undefined} code
 * @returns {{ code: number, label: string, color: string }}
 */
export function getDamageClassInfo(code) {
  if (code === null || code === undefined || code === '') {
    return NOT_ASSESSED_CLASS;
  }
  const numeric = Number(code);
  if (Number.isInteger(numeric) && DAMAGE_CLASSES[numeric]) {
    return DAMAGE_CLASSES[numeric];
  }
  return NOT_ASSESSED_CLASS;
}

export const DAMAGE_VIEWS = {
  H3: 'h3',
  BUILDINGS: 'buildings',
  DENSITY: 'density',
};

export const DEFAULT_DAMAGE_VIEW = DAMAGE_VIEWS.H3;

export const H3_METRICS = {
  DAMAGED: 'damaged',
  SEVERE: 'severe',
  DOMINANT: 'dominant',
};

// Hexagons are coloured by their most common damage class: the same five classes as the buildings, plus not assessed.
export const DEFAULT_H3_METRIC = H3_METRICS.DOMINANT;

export const DAMAGE_SOURCES = {
  H3: 'damage-h3',
  BUILDINGS: 'damage-buildings',
  DENSITY: 'damage-density',
  SATELLITE: 'damage-satellite',
};

export const DAMAGE_LAYERS = {
  // Satellite imagery under the Building and Density views (hidden in the H3 view)
  SATELLITE: 'damage-satellite',
  H3_FILL: 'damage-h3-fill',
  H3_LINE: 'damage-h3-line',
  BUILDINGS_FILL: 'damage-buildings-fill',
  BUILDINGS_LINE: 'damage-buildings-line',
  DENSITY_HEAT: 'damage-density-heat',
};

export const BUILDINGS_MIN_ZOOM = 14;
export const BUILDINGS_MAX_ZOOM = 14;

// Heatmap constants
// Strength of the heatmap. With the 4^zoom intensity below, a place keeps its colour while zooming.
// 6e-9 puts the top of the ramp (red) at roughly 250 buildings per km2 on the synthetic test data,
// and leaves scattered rural buildings faint. Re-tune on real footprints: raise it if the map looks empty,
// lower it if cities turn solid red.
export const HEATMAP_K = 6e-9;
export const HEATMAP_RADIUS = 24;
// Clear where there are no buildings, then blue-green, yellow, red (drawn over satellite imagery)
export const HEATMAP_RAMP = [
  0, 'rgba(0, 0, 0, 0)',
  0.05, 'rgba(43, 131, 186, 0.55)',
  0.2, '#ABDDA4',
  0.4, '#FFFFBF',
  0.65, '#FDAE61',
  1.0, '#D7191C',
];

export const HEATMAP_INTENSITY = [
  'interpolate',
  ['exponential', 4],
  ['zoom'],
  4, HEATMAP_K * (4 ** 4),
  16, HEATMAP_K * (4 ** 16),
];

export const HEATMAP_OPACITY = [
  'interpolate',
  ['linear'],
  ['zoom'],
  15, 0.75,
  16, 0,
];

// Mapbox GL Expressions
export const DAMAGED_SHARE_EXPRESSION = [
  'case',
  ['>', ['get', 'na'], 0],
  ['/', ['-', ['get', 'na'], ['get', 'c0']], ['get', 'na']],
  -1,
];

export const SEVERE_SHARE_EXPRESSION = [
  'case',
  ['>', ['get', 'na'], 0],
  ['/', ['+', ['get', 'c3'], ['get', 'c4']], ['get', 'na']],
  -1,
];

/**
 * Pure evaluation helper for share metric calculation:
 * Damaged share = (na - c0) / na
 * Returns -1 when na is 0 or invalid.
 */
export function computeDamagedShare(na, c0 = 0) {
  if (!na || Number(na) <= 0) return -1;
  const assessed = Number(na);
  const undamaged = Number(c0 || 0);
  return (assessed - undamaged) / assessed;
}

/**
 * Severe share = (c3 + c4) / na
 * Returns -1 when na is 0 or invalid.
 */
export function computeSevereShare(na, c3 = 0, c4 = 0) {
  if (!na || Number(na) <= 0) return -1;
  const assessed = Number(na);
  const severe = Number(c3 || 0) + Number(c4 || 0);
  return severe / assessed;
}

// Building footprint paint
export const BUILDING_FILL_COLOR = [
  'match',
  ['get', 'dc'],
  0, COLOR_UNDAMAGED,
  1, COLOR_PARTIAL_ROOF,
  2, COLOR_TOTAL_ROOF,
  3, COLOR_PARTIAL_COLLAPSE,
  4, COLOR_TOTAL_COLLAPSE,
  COLOR_NOT_ASSESSED,
];

const FS_SELECTED = ['boolean', ['feature-state', STATE_SELECTED], false];

const IS_NOT_ASSESSED = ['==', ['get', 'dc'], -1];
const COLOR_NOT_ASSESSED_OUTLINE = '#BFDBFE';

// Footprints sit on satellite imagery: a light fill keeps the roof visible, the bright outline carries the class.
// A building that was not assessed is a pale outline with no fill.
export const BUILDING_FILL_OPACITY = [
  'case',
  FS_SELECTED,
  0.6,
  IS_NOT_ASSESSED,
  0,
  0.35,
];

export const BUILDING_LINE_COLOR = [
  'case',
  FS_SELECTED,
  '#FFFFFF',
  IS_NOT_ASSESSED,
  COLOR_NOT_ASSESSED_OUTLINE,
  BUILDING_FILL_COLOR,
];

export const BUILDING_LINE_WIDTH = [
  'case',
  FS_SELECTED,
  3,
  IS_NOT_ASSESSED,
  1,
  2,
];

// Density building outline (from zoom 15)
export const DENSITY_BUILDING_LINE_COLOR = 'rgba(255, 255, 255, 0.6)';
export const DENSITY_BUILDING_LINE_WIDTH = 0.5;

// Zoom the Building view flies to when it is opened from further out
export const BUILDINGS_FLY_ZOOM = 15;

// H3 paint expressions
export function getH3FillColorExpression(metric = DEFAULT_H3_METRIC) {
  if (metric === H3_METRICS.DOMINANT) {
    return [
      'match',
      ['get', 'dom'],
      0, COLOR_UNDAMAGED,
      1, COLOR_PARTIAL_ROOF,
      2, COLOR_TOTAL_ROOF,
      3, COLOR_PARTIAL_COLLAPSE,
      4, COLOR_TOTAL_COLLAPSE,
      COLOR_NOT_ASSESSED,
    ];
  }
  const share = metric === H3_METRICS.SEVERE ? SEVERE_SHARE_EXPRESSION : DAMAGED_SHARE_EXPRESSION;
  return [
    'step',
    share,
    COLOR_NOT_ASSESSED,
    0, COLOR_UNDAMAGED,
    0.000001, '#FFE9A8',
    0.05, '#FECC5C',
    0.15, '#FD8D3C',
    0.30, '#F03B20',
    0.50, '#BD0026',
  ];
}

export function getH3FillOpacityExpression(metric = DEFAULT_H3_METRIC) {
  if (metric === H3_METRICS.DOMINANT) {
    return ['case', ['<', ['get', 'na'], 5], 0.35, 0.75];
  }
  if (metric === H3_METRICS.SEVERE) {
    return [
      'case',
      ['any', ['<', ['get', 'na'], 5], ['==', ['+', ['get', 'c3'], ['get', 'c4']], 0]],
      0.35,
      0.75,
    ];
  }
  return [
    'case',
    ['any', ['<', ['get', 'na'], 5], ['==', ['-', ['get', 'na'], ['get', 'c0']], 0]],
    0.35,
    0.75,
  ];
}

export const H3_LINE_COLOR = [
  'case',
  FS_SELECTED,
  '#111827',
  'rgba(55, 65, 81, 0.4)',
];

export const H3_LINE_WIDTH = [
  'case',
  FS_SELECTED,
  2.0,
  0.75,
];

const DAMAGE_CLASS_LEGEND_ITEMS = [
  { label: DAMAGE_CLASSES[0].label, color: COLOR_UNDAMAGED },
  { label: DAMAGE_CLASSES[1].label, color: COLOR_PARTIAL_ROOF },
  { label: DAMAGE_CLASSES[2].label, color: COLOR_TOTAL_ROOF },
  { label: DAMAGE_CLASSES[3].label, color: COLOR_PARTIAL_COLLAPSE },
  { label: DAMAGE_CLASSES[4].label, color: COLOR_TOTAL_COLLAPSE },
  { label: NOT_ASSESSED_CLASS.label, color: COLOR_NOT_ASSESSED },
];

// Legends config
export const LEGENDS = {
  DAMAGED_SHARE: {
    title: 'Share of assessed buildings with any damage',
    items: [
      { label: 'Not assessed', color: '#9CA3AF' },
      { label: '0%', color: '#22A65A' },
      { label: '>0 – 5%', color: '#FFE9A8' },
      { label: '5 – 15%', color: '#FECC5C' },
      { label: '15 – 30%', color: '#FD8D3C' },
      { label: '30 – 50%', color: '#F03B20' },
      { label: '>50%', color: '#BD0026' },
    ],
  },
  SEVERE_SHARE: {
    title: 'Share with structural collapse',
    items: [
      { label: 'Not assessed', color: '#9CA3AF' },
      { label: '0%', color: '#22A65A' },
      { label: '>0 – 5%', color: '#FFE9A8' },
      { label: '5 – 15%', color: '#FECC5C' },
      { label: '15 – 30%', color: '#FD8D3C' },
      { label: '30 – 50%', color: '#F03B20' },
      { label: '>50%', color: '#BD0026' },
    ],
  },
  DOMINANT: {
    title: 'Most common damage class in each hexagon',
    items: DAMAGE_CLASS_LEGEND_ITEMS,
  },
  BUILDINGS: {
    title: 'Damage class',
    items: DAMAGE_CLASS_LEGEND_ITEMS,
  },
  DENSITY: {
    title: 'Building density (smoothed)',
    note: 'Shows where buildings are, not how damaged they are.',
    items: [
      { label: 'No buildings', color: 'rgba(0, 0, 0, 0)' },
      { label: 'Few', color: 'rgba(43, 131, 186, 0.55)' },
      { label: 'Some', color: '#ABDDA4' },
      { label: 'Medium', color: '#FFFFBF' },
      { label: 'Dense', color: '#FDAE61' },
      { label: 'Very dense', color: '#D7191C' },
    ],
  },
};
