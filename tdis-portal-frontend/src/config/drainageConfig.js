/**
 * Drainage Monitoring: defect classes, their colours and map icons.
 * Classes follow the drone defect-detection models; icons and colours follow the drone defect viewer
 * (full_stack/frontend/index.html).
 */

import { drainageIconUrl } from './drainageIcons';

export const DRAINAGE_CLASSES = [
  {
    id: 'vegetation_overgrowth',
    label: 'Vegetation Overgrowth',
    color: '#3B6D11',
    glyph: 'vegetation',
  },
  { id: 'bank_erosion', label: 'Bank Erosion', color: '#A0522D', glyph: 'erosion' },
  { id: 'structural_damage', label: 'Structural Damage', color: '#A32D2D', glyph: 'structural' },
  {
    id: 'sediment_accumulation',
    label: 'Sediment Accumulation',
    color: '#D2A55C',
    glyph: 'sedimentation',
  },
  { id: 'tree_log_jam', label: 'Tree & Log Jam', color: '#712B13', glyph: 'treelog' },
  { id: 'tire', label: 'Tires', color: '#444441', glyph: 'tires' },
].map((c) => ({ ...c, icon: `drainage-${c.glyph}` }));

/** Classes the models may add later: drawn with the "other debris" pin. */
export const OTHER_CLASS = {
  id: 'other',
  label: 'Other',
  color: '#6D28D9',
  glyph: 'other-debris',
  icon: 'drainage-other-debris',
};

/** Label, colour and icon for a class id; unknown ids get a readable label and the "other" pin. */
export const getDrainageClass = (id) =>
  DRAINAGE_CLASSES.find((c) => c.id === id) ?? {
    ...OTHER_CLASS,
    id,
    label: String(id || 'Other')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (ch) => ch.toUpperCase()),
  };

/** Every map image the tab needs: [{ id, url }]. */
export const DRAINAGE_ICONS = [...DRAINAGE_CLASSES, OTHER_CLASS].map((c) => ({
  id: c.icon,
  url: drainageIconUrl(c.glyph, c.color),
}));

/** Legend image for a class. */
export const drainageClassIconUrl = (cls) => drainageIconUrl(cls.glyph, cls.color);

const matchByCategory = (key, fallback) => [
  'match',
  ['get', 'category'],
  ...DRAINAGE_CLASSES.flatMap((c) => [c.id, c[key]]),
  fallback,
];

/** Mapbox expression colouring features by their `category` property. */
export const classColorExpression = matchByCategory('color', OTHER_CLASS.color);

/** Mapbox expression picking the pin image for a feature's `category`. */
export const classIconExpression = matchByCategory('icon', OTHER_CLASS.icon);

/** Legend/filter groups: the known classes, then "other" for anything the models add later. */
export const DRAINAGE_GROUPS = [...DRAINAGE_CLASSES, OTHER_CLASS];

/** Group id for a feature category (unknown categories fall into "other"). */
export const groupIdFor = (category) =>
  DRAINAGE_CLASSES.some((c) => c.id === category) ? category : OTHER_CLASS.id;

/** Mapbox filter keeping features whose category belongs to one of the enabled groups. */
export function groupFilter(enabledIds) {
  const known = DRAINAGE_CLASSES.map((c) => c.id);
  const inKnown = [
    'in',
    ['get', 'category'],
    ['literal', enabledIds.filter((id) => known.includes(id))],
  ];
  if (!enabledIds.includes(OTHER_CLASS.id)) return inKnown;
  return ['any', inKnown, ['!', ['in', ['get', 'category'], ['literal', known]]]];
}

/** Same-class defects closer than this many screen pixels are drawn as one pin with a count. */
export const CLUSTER_RADIUS_PX = 48;
/** Grouping stays on up to this zoom, which is also the map's maximum zoom. */
export const CLUSTER_MAX_ZOOM = 20;

/** Outlines are small (most under 5 m²), so they are fetched and drawn only from this zoom. */
export const OUTLINE_MIN_ZOOM = 16;
