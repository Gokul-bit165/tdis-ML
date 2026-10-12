/**
 * @fileoverview OSA-specific utilities: geometry helpers and popup placement.
 */

/**
 * Check if geometry types array includes a given type (e.g. 'polygon', 'point').
 * @param {string[]} geometryTypes - Array of geometry type strings
 * @param {string} type - Type to check (e.g. 'polygon', 'line', 'point')
 * @returns {boolean}
 */
export const hasGeometryType = (geometryTypes = [], type) => {
  if (!geometryTypes.length) return true; // Default to true when we cannot detect
  return geometryTypes.some((geom) => geom?.toLowerCase().includes(type));
};

/**
 * Choose popup anchor so the popup stays in view and clears tab navigation.
 * @param {Object} point - lngLat
 * @param {Object} map - Mapbox map instance
 * @param {{
 *   isMobile?: boolean,
 *   popupWidth?: number,
 *   popupHeight?: number,
 *   topReserve?: number,
 *   bottomReserve?: number,
 * }} [options]
 * @returns {string} Mapbox popup anchor value
 */
export const getOptimalAnchor = (point, map, options = {}) => {
  const {
    isMobile = false,
    popupWidth: popupWidthOpt,
    popupHeight: popupHeightOpt,
    topReserve: topReserveOpt,
    bottomReserve: bottomReserveOpt,
  } = options;

  const container = map.getContainer();
  const containerRect = container.getBoundingClientRect();
  const pointPixels = map.project(point);
  const margin = 16;

  const popupWidth = popupWidthOpt ?? (isMobile ? Math.min(360, containerRect.width - 40) : 400);
  const popupHeight = popupHeightOpt ?? (isMobile ? 360 : 520);
  const topReserve = topReserveOpt ?? (isMobile ? 160 : 88);
  const bottomReserve = bottomReserveOpt ?? (isMobile ? 100 : 52);

  const spaceTop = pointPixels.y;
  const spaceBottom = containerRect.height - pointPixels.y;
  const spaceLeft = pointPixels.x;
  const spaceRight = containerRect.width - pointPixels.x;
  const effectiveSpaceTop = Math.max(0, spaceTop - topReserve);
  const effectiveSpaceBottom = Math.max(0, spaceBottom - bottomReserve);

  const pickHorizontal = (verticalAnchor) => {
    if (spaceRight >= popupWidth / 2 + margin && spaceLeft >= popupWidth / 2 + margin) {
      return verticalAnchor;
    }
    if (spaceRight >= popupWidth + margin) {
      return verticalAnchor === 'top' ? 'top-left' : 'bottom-left';
    }
    if (spaceLeft >= popupWidth + margin) {
      return verticalAnchor === 'top' ? 'top-right' : 'bottom-right';
    }
    return spaceRight > spaceLeft ? 'left' : 'right';
  };

  // Prefer popup below the point (anchor `top`) so content does not slide under tab bar.
  if (effectiveSpaceBottom >= popupHeight + margin) {
    return pickHorizontal('top');
  }

  // Only place popup above the point when enough cleared space below the tab strip.
  if (effectiveSpaceTop >= popupHeight + margin) {
    return pickHorizontal('bottom');
  }

  if (isMobile) {
    return effectiveSpaceBottom >= effectiveSpaceTop ? 'top' : 'bottom';
  }

  return effectiveSpaceBottom >= effectiveSpaceTop
    ? pickHorizontal('top')
    : pickHorizontal('bottom');
};

/**
 * Mapbox popup offset for anchor (keeps tall popups below tab navigation).
 * @param {string} anchor
 * @param {{ topReserve?: number }} [options]
 * @returns {[number, number]}
 */
export const getMapPopupOffset = (anchor, options = {}) => {
  const topReserve = options.topReserve ?? 88;
  if (!anchor) return [0, 12];
  if (anchor.startsWith('bottom')) {
    return [0, Math.min(48, Math.round(topReserve * 0.4))];
  }
  if (anchor.startsWith('top')) {
    return [0, 14];
  }
  return [0, 0];
};
