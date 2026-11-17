/**
 * Drainage defect map pins, taken from the drone defect viewer (full_stack/frontend/index.html).
 * Each pin is a 64x80 SVG; the tip of the pin (32, 78) marks the defect location.
 * Exposed as data URLs so the same artwork is used for Mapbox symbols and the legend.
 */

const PIN = (color) =>
  `<path d="M32 78C28 70 6 50 6 30a26 26 0 1 1 52 0C58 50 36 70 32 78Z" fill="${color}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>` +
  '<circle cx="32" cy="30" r="21" fill="#fff"/>';

const GLYPHS = {
  vegetation: (c) => `
    <path d="M-14 13H14" stroke="${c}" stroke-width="3" stroke-linecap="round" fill="none"/>
    <path d="M-2 11C-12 11 -14 3 -13 -4C-6 -4 -1 1 -2 11Z" fill="#97C459"/>
    <path d="M2 11C12 11 14 3 13 -4C6 -4 1 1 2 11Z" fill="#97C459"/>
    <path d="M0 -14C8 -8 8 2 0 11C-8 2 -8 -8 0 -14Z" fill="${c}"/>
    <path d="M0 9V-6" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>`,
  erosion: (c) => `
    <path d="M-14 -13H-5V-5L5 2H14V7H-14Z" fill="${c}"/>
    <circle cx="2" cy="-8" r="2.2" fill="${c}"/>
    <circle cx="8" cy="-3" r="2" fill="${c}"/>
    <circle cx="9" cy="-10" r="2" fill="${c}"/>
    <path d="M-14 10q3.5-3 7 0t7 0t7 0t7 0" stroke="#38BDF8" stroke-width="2" stroke-linecap="round" fill="none"/>
    <path d="M-12 13.5q3.5-3 7 0t7 0t7 0t7 0" stroke="#38BDF8" stroke-width="2" stroke-linecap="round" fill="none"/>`,
  sedimentation: (c) => `
    <circle cx="-8" cy="-11" r="2" fill="${c}"/>
    <circle cx="0" cy="-6" r="2" fill="${c}"/>
    <circle cx="8" cy="-12" r="2" fill="${c}"/>
    <circle cx="-2" cy="-14" r="1.6" fill="${c}"/>
    <path d="M-14 0q7-4 14 0t14 0V5H-14Z" fill="#FAC775"/>
    <path d="M-14 5q7-4 14 0t14 0V10H-14Z" fill="#EF9F27"/>
    <path d="M-14 10q7-4 14 0t14 0V14H-14Z" fill="${c}"/>`,
  structural: (c) => `
    <path d="M-14 14H14" stroke="${c}" stroke-width="3" stroke-linecap="round" fill="none"/>
    <path d="M-11 14V-4L0 -13L11 -4V14Z" fill="${c}"/>
    <path d="M1 -12L-3 -3L3 2L-2 8L1 14" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M-9 -2L-3 -8" stroke="#F09595" stroke-width="1.5" stroke-linecap="round"/>`,
  tires: (c) => `
    <circle r="14" fill="${c}"/>
    <circle r="10.5" fill="none" stroke="#B4B2A9" stroke-width="2" stroke-dasharray="2.4 3"/>
    <circle r="6.5" fill="#B4B2A9"/>
    <circle r="2.5" fill="${c}"/>`,
  treelog: (c) => `
    <path d="M-4 -9L-3 -14" stroke="${c}" stroke-width="3" stroke-linecap="round"/>
    <path d="M7 -9H-9A5 9 0 0 0 -9 9H7Z" fill="${c}"/>
    <path d="M-7 -3H1M-5 3H3" stroke="#F0997B" stroke-width="1.5" stroke-linecap="round"/>
    <ellipse cx="7" cy="0" rx="5" ry="9" fill="#F5C4B3" stroke="${c}" stroke-width="1.5"/>
    <ellipse cx="7" cy="0" rx="2" ry="4" fill="none" stroke="${c}" stroke-width="1"/>`,
  'other-debris': (c) => `
    <path d="M-14 -2L-7 -14L0 -2Z" fill="${c}"/>
    <circle cx="8" cy="-8" r="6" fill="#FAC775"/>
    <rect x="-6" y="2" width="12" height="12" rx="2" fill="${c}"/>
    <circle cx="-11" cy="9" r="3.5" fill="#FAC775"/>
    <path d="M7 14L11 6L15 14Z" fill="#FAC775"/>`,
};

export const ICON_WIDTH = 64;
export const ICON_HEIGHT = 80;
/** Pixels per icon unit when rasterised for the map, so icons stay sharp on high-DPI screens. */
export const ICON_PIXEL_RATIO = 2;

/** Full SVG markup for a glyph in a colour. */
export function drainageIconSvg(glyph, color) {
  const draw = GLYPHS[glyph] ?? GLYPHS['other-debris'];
  const w = ICON_WIDTH * ICON_PIXEL_RATIO;
  const h = ICON_HEIGHT * ICON_PIXEL_RATIO;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${ICON_WIDTH} ${ICON_HEIGHT}">` +
    `${PIN(color)}<g transform="translate(32,30)">${draw(color)}</g></svg>`
  );
}

/** Dark round badge drawn under a group's count (24x24 units). */
export const BADGE_ICON_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${24 * ICON_PIXEL_RATIO}" height="${24 * ICON_PIXEL_RATIO}" viewBox="0 0 24 24">` +
    '<circle cx="12" cy="12" r="10.5" fill="#1f2937" stroke="#fff" stroke-width="1.5"/></svg>'
)}`;

/** data: URL for an <img> or a Mapbox image. */
export const drainageIconUrl = (glyph, color) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(drainageIconSvg(glyph, color))}`;
