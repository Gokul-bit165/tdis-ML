/**
 * Shared labels/helpers for OSA summary panels (desktop + mobile).
 * Keep view-mode mapping in one place so UI copies stay consistent.
 */

export function getViewModeLabel(viewMode) {
    if (viewMode === 'county') return 'counties';
    if (viewMode === 'zip') return 'zip codes';
    return 'utilities';
}

export function getViewModeTitle(viewMode) {
    if (viewMode === 'county') return 'Counties';
    if (viewMode === 'zip') return 'Zip Codes';
    return 'Utilities';
}

export function isRoadClosuresLayer(layerOrId) {
    const id = typeof layerOrId === 'string' ? layerOrId : layerOrId?.id;
    return id === 'road_closures';
}

export function isValidSummaryViewMode(viewMode) {
    return viewMode === 'county' || viewMode === 'zip' || viewMode === 'utility';
}
