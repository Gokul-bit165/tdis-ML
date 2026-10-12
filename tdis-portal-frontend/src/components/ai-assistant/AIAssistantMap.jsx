import React, { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import mapboxgl from 'mapbox-gl';
import { h3ToGeoJson } from '@/services/h3ToGeoJson';
import { DEFAULT_HAZARD_METRIC, HAZARD_METRIC_LABELS } from '@/config/hazardMapConfig';
import AIAssistantFeatureDetails from './AIAssistantFeatureDetails';
import HazardMetricPicker from './HazardMetricPicker';
import {
    DEFAULT_ZOOM,
    TEXAS_CENTER,
    TEXAS_MIN_ZOOM,
} from '@/config/mapConfig';
import { loadTexasOutsideMask, fitMapToTexas } from '@/utils/mapUtils';
import { mapLogger } from '@/utils/logger';
import { trackMapInteraction } from '@/utils/googleAnalytics.js';
import './AIAssistantTab.css';

const FILL_COLOR_PAINT_PROPERTY = 'fill-color';

/* ── Utility: format a snake_case key into Title Case ──────────────── */
function formatKey(key) {
    if (key === 'pop') return 'Population';
    return key.replaceAll('_', ' ').replaceAll(/\b\w/g, (c) => c.toUpperCase());
}

/* ── Utility: format a value for display ───────────────────────────── */
function formatValue(value) {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'number') return value.toLocaleString();
    return String(value);
}

/* ── Utility: compact numeric label for the legend end-stops ───────── */
function formatScaleValue(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
    const abs = Math.abs(value);
    if (abs >= 1000) {
        return value.toLocaleString(undefined, { notation: 'compact', maximumFractionDigits: 1 });
    }
    if (Number.isInteger(value)) return value.toLocaleString();
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/* ── Utility: generate tooltip HTML from a data object ─────────────── */
function generateTooltipHTML(data) {
    const rows = Object.entries(data)
        .filter(([key]) => key !== 'hex_id' && key !== 'id')
        .map(
            ([key, value]) =>
                `<div class="tooltip-row"><strong>${formatKey(key)}:</strong> ${formatValue(value)}</div>`
        )
        .join('');

    return `<div class="tooltip-container">${rows}</div>`;
}

/** Compact hover content for hazard browse mode. */
function generateBrowseTooltipHTML(data, metric) {
    const label = HAZARD_METRIC_LABELS[metric] || metric;
    const county = typeof data?.county === 'string' ? data.county.trim() : '';
    const countyRow = county
        ? `<div class="tooltip-row"><strong>County:</strong> ${formatValue(county)}</div>`
        : '';
    return (
        `<div class="tooltip-container">` +
        countyRow +
        `<div class="tooltip-row"><strong>${label} risk:</strong> ${formatValue(data?.value)}</div>` +
        `<div class="tooltip-row"><strong>Population:</strong> ${formatValue(data?.population)}</div>` +
        `</div>`
    );
}

/**
 * Find EVERY column usable as a choropleth and compute each one's range.
 *
 * A column qualifies when it has ≥1 finite numeric value AND its min !== max
 * (a flat/constant field can't form a color ramp). `hex_id`/`id` are excluded.
 *
 * Ordering:
 *   • If `orderHint` (the stream's map.meta column list) is given, the result
 *     follows that order; columns absent from the hint go last, sorted by coverage.
 *   • Otherwise results are ordered by coverage (`count`) descending — so the
 *     default selection stays the best-coverage field, matching prior behavior.
 *
 * @param {Array<Record<string, unknown>>} records
 * @param {string[] | null | undefined} orderHint  ordered column names (mapColumns)
 * @returns {Array<{ field: string, min: number, max: number, count: number }>}
 */
const EXCLUDED_NUMERIC_FIELDS = new Set(['hex_id', 'id']);

function updateNumericFieldCandidate(fieldCandidates, key, value) {
    if (EXCLUDED_NUMERIC_FIELDS.has(key)) return;
    if (typeof value !== 'number' || !Number.isFinite(value)) return;

    const info = fieldCandidates.get(key) ?? { count: 0, min: Infinity, max: -Infinity };
    info.count += 1;
    info.min = Math.min(info.min, value);
    info.max = Math.max(info.max, value);
    fieldCandidates.set(key, info);
}

function collectNumericFieldCandidates(records) {
    const fieldCandidates = new Map();
    for (const rec of records) {
        for (const [key, value] of Object.entries(rec)) {
            updateNumericFieldCandidate(fieldCandidates, key, value);
        }
    }
    return fieldCandidates;
}

function sortNumericFields(fields, orderHint) {
    const byCoverageDesc = (a, b) => b.count - a.count;
    if (!Array.isArray(orderHint) || orderHint.length === 0) {
        return fields.sort(byCoverageDesc);
    }

    const rank = new Map(orderHint.map((name, index) => [name, index]));
    return fields.sort((a, b) => {
        const rankDifference = (rank.get(a.field) ?? Infinity) - (rank.get(b.field) ?? Infinity);
        return rankDifference || byCoverageDesc(a, b);
    });
}

function detectNumericFields(records, orderHint) {
    if (!records?.length) return [];

    const candidates = collectNumericFieldCandidates(records);
    const fields = Array.from(candidates, ([field, info]) => ({ field, ...info }))
        .filter(({ count, min, max }) => count > 0 && min !== max);
    return sortNumericFields(fields, orderHint);
}

/** Pick the default (best-coverage) field from a detectNumericFields() list. */
function pickDefaultField(fields) {
    if (!fields || fields.length === 0) return null;
    let best = fields[0];
    for (const f of fields) {
        if (f.count > best.count) best = f;
    }
    return best.field;
}

const DEFAULT_HEX_FILL = '#6E8CA0';

/** Let streets / labels read through the choropleth (0 = invisible, 1 = solid). */
const HEX_FILL_OPACITY = 0.5;

/** Subtle cell borders so adjacent hexes read as separate polygons. */
const HEX_OUTLINE_COLOR = '#334155';
const HEX_OUTLINE_WIDTH = 0.85;
const HEX_OUTLINE_OPACITY = 0.55;

/**
 * @param {mapboxgl.Map} map
 * @param {GeoJSON.FeatureCollection} geoJson
 */
function tryFitMapToGeoJson(map, geoJson) {
    try {
        const bounds = new mapboxgl.LngLatBounds();
        let count = 0;
        const extendRing = (ring) => {
            if (!Array.isArray(ring)) return;
            for (const pt of ring) {
                const lng = pt[0];
                const lat = pt[1];
                if (
                    typeof lng === 'number' &&
                    typeof lat === 'number' &&
                    !Number.isNaN(lng) &&
                    !Number.isNaN(lat) &&
                    lat >= -90 &&
                    lat <= 90 &&
                    lng >= -180 &&
                    lng <= 180
                ) {
                    bounds.extend([lng, lat]);
                    count++;
                }
            }
        };
        geoJson.features.forEach((f) => {
            const g = f.geometry;
            if (!g) return;
            if (g.type === 'Polygon') {
                extendRing(g.coordinates[0]);
            } else if (g.type === 'MultiPolygon') {
                for (const poly of g.coordinates) {
                    if (Array.isArray(poly[0])) extendRing(poly[0]);
                }
            }
        });
        if (count > 0 && !bounds.isEmpty()) {
            // Flex layouts often report 0×0 until after paint; resize before fitting.
            map.resize();
            map.fitBounds(bounds, { padding: 50, duration: 900, maxZoom: 14 });
        }
    } catch (err) {
        mapLogger.error('Error fitting bounds:', err);
    }
}

/**
 * Mapbox often does not emit `idle` after a GeoJSON `setData` alone (no tile loads), so
 * `map.once('idle', …)` may never run. Fit immediately and re-try after layout/paint.
 * @param {mapboxgl.Map} map
 * @param {{ features: unknown[] }} geoJson
 * @param {() => boolean} isCancelled
 * @returns {() => void} disposer
 */
function scheduleFitAfterDataCommit(map, geoJson, isCancelled) {
    const attemptFit = () => {
        if (isCancelled()) return;
        map.resize();
        tryFitMapToGeoJson(map, geoJson);
    };

    attemptFit();

    let raf1 = 0;
    let raf2 = 0;
    const tid = window.setTimeout(() => {
        attemptFit();
    }, 400);

    raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => attemptFit());
    });

    const onIdle = () => attemptFit();
    map.once('idle', onIdle);

    return () => {
        window.clearTimeout(tid);
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
        map.off('idle', onIdle);
    };
}

/** Choropleth ramp stops (cyan → teal → blue → steel → burgundy → crimson). */
const HEX_RAMP_STOPS = ['#d1faf5', '#5ec4b6', '#3a8fb7', '#2c5f8a', '#6b2737', '#a11e3c'];

/** CSS gradient mirroring the Mapbox ramp, for the legend scale bar. */
const HEX_RAMP_CSS_GRADIENT = `linear-gradient(90deg, ${HEX_RAMP_STOPS.join(', ')})`;

/* ── Utility: build a Mapbox interpolate expression for a field ────── */
function buildColorExpression(fieldInfo) {
    if (!fieldInfo) {
        return ['literal', DEFAULT_HEX_FILL];
    }
    const { field, min, max } = fieldInfo;
    const range = max - min;
    const s0 = min;
    const s1 = min + range * 0.2;
    const s2 = min + range * 0.4;
    const s3 = min + range * 0.6;
    const s4 = min + range * 0.8;
    const s5 = max;

    // Cyan → Teal → Blue → Steel → Burgundy → Crimson (HEX_RAMP_STOPS)
    return [
        'interpolate',
        ['linear'],
        ['coalesce', ['get', field], min],
        s0, HEX_RAMP_STOPS[0],
        s1, HEX_RAMP_STOPS[1],
        s2, HEX_RAMP_STOPS[2],
        s3, HEX_RAMP_STOPS[3],
        s4, HEX_RAMP_STOPS[4],
        s5, HEX_RAMP_STOPS[5],
    ];
}

/** Above this row count the full record dump is noise, so only the count is logged. */
const MAX_LOGGED_RECORDS = 500;

/** Build the hex_id → record map used for O(1) hover / click lookups. */
function buildHexLookup(records) {
    const lookup = {};
    records.forEach((record) => {
        if (record.hex_id) lookup[String(record.hex_id)] = record;
    });
    return lookup;
}

function logRecordsForLayer(records) {
    if (records.length <= MAX_LOGGED_RECORDS) {
        mapLogger.debug('map_data (raw records):', structuredClone(records));
    } else {
        mapLogger.debug(`map_data: ${records.length} records (skipping full dump)`);
    }
}

/* ═══════════════════════════════════════════════════════════════════════
   AIAssistantMap component
   ═══════════════════════════════════════════════════════════════════════ */
const AIAssistantMap = ({
    mapRecords,
    /** Ordered column-name list from the stream's map.meta (null for history / non-streamed turns). */
    mapColumns = null,
    /** When true, map data is still streaming — avoid fitBounds (prevents zoom-out / racing cameras). */
    isMapStreaming = false,
    selectedFeature,
    onSelectFeature,
    /** Hazard browse layer (owned by useHazardBrowseLayer); picker overlays the map's top-right corner. */
    hazardMetric = DEFAULT_HAZARD_METRIC,
    hazardRecords = [],
    hazardLoading = false,
    hazardError = null,
    preferHazardLayer = true,
    onSelectHazardMetric,
    onAnswerMapAvailable,
    /** Restores the chat answer's map after the hazard picker masked it. */
    onShowAnswerMap,
    /** A chat reply is streaming: map is read-only and shows the working animation. */
    isAnswering = false,
}) => {
    /* ── Refs ───────────────────────────────────────────────────────── */
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);

    // Singleton popup – created once, reused on every hover
    const popupRef = useRef(null);

    // O(1) data lookup: hex_id → full record
    const dataLookupRef = useRef({});

    // Track currently hovered feature id (numeric) for setFeatureState
    const hoveredIdRef = useRef(null);

    // Keep latest onSelectFeature accessible to the click handler closure
    const onSelectFeatureRef = useRef(onSelectFeature);
    /** Latest props for deferred map load + fitBounds (avoids stale closures in timers). */
    const mapRecordsRef = useRef(mapRecords);
    const isMapStreamingRef = useRef(isMapStreaming);
    const useBrowseLayerRef = useRef(true);
    const hazardMetricRef = useRef(DEFAULT_HAZARD_METRIC);

    useEffect(() => { onSelectFeatureRef.current = onSelectFeature; }, [onSelectFeature]);

    /* ── React state ────────────────────────────────────────────────── */
    const [mapError, setMapError] = useState(null);
    const [mapLoading, setMapLoading] = useState(true);

    /* ── Which dataset paints the hexes: hazard browse vs chat answer ── */
    const hasAnswerMap = Array.isArray(mapRecords) && mapRecords.length > 0;
    const useBrowseLayer = preferHazardLayer || !hasAnswerMap;
    const effectiveMapRecords = useBrowseLayer ? hazardRecords : mapRecords;
    const effectiveMapColumns = useBrowseLayer ? null : mapColumns;
    const effectiveIsMapStreaming = useBrowseLayer ? false : isMapStreaming;

    useEffect(() => {
        if (hasAnswerMap) onAnswerMapAvailable?.();
    }, [hasAnswerMap, mapRecords, onAnswerMapAvailable]);

    /* ── Layer selection (which numeric column colors the hexes) ──────── */
    const [selectedField, setSelectedField] = useState(null);
    /** True once the user explicitly clicks a radio — protects their pick mid-stream. */
    const userPickedFieldRef = useRef(false);
    /** Signature of the previous field set; a change = new query/turn → re-default. */
    const fieldSignatureRef = useRef('');
    /** Mirror of selectedField for reading inside effects without adding it to deps. */
    const selectedFieldRef = useRef(selectedField);
    // Keep the ref current on every render so the default-selection effect can read
    // the latest value without declaring selectedField as a dependency.
    selectedFieldRef.current = selectedField;

    // Numeric choropleth fields for the current dataset, ordered by map.meta (then coverage).
    const numericFields = useMemo(() => {
        const records = Array.isArray(effectiveMapRecords) ? effectiveMapRecords : [];
        if (useBrowseLayer) {
            // Browse hazard cache always colors by normalized `value` (selected metric).
            const withValue = records.filter(
                (r) => typeof r.value === 'number' && Number.isFinite(r.value)
            );
            if (!withValue.length) return [];
            let min = Infinity;
            let max = -Infinity;
            for (const r of withValue) {
                if (r.value < min) min = r.value;
                if (r.value > max) max = r.value;
            }
            if (min === max) max = min + 1;
            return [{ field: 'value', min, max, count: withValue.length }];
        }
        return detectNumericFields(records, effectiveMapColumns);
    }, [effectiveMapRecords, effectiveMapColumns, useBrowseLayer]);
    const defaultField = useMemo(() => pickDefaultField(numericFields), [numericFields]);

    // {field,min,max} for the currently selected column — the SINGLE source of
    // truth for fill-color. Both the data-update and recolor effects read this ref
    // so they never fight over 'fill-color'. null → DEFAULT_HEX_FILL.
    const selectedFieldInfoRef = useRef(null);
    selectedFieldInfoRef.current =
        numericFields.find((f) => f.field === selectedField)
        || numericFields.find((f) => f.field === defaultField)
        || null;

    /* ── Mapbox token ───────────────────────────────────────────────── */
    const getMapboxToken = () =>
        import.meta.env.VITE_MAPBOX_TOKEN || import.meta.env.REACT_APP_MAPBOX_TOKEN || null;

    /* ── 1. Initialize map (runs once) ──────────────────────────────── */
    useEffect(() => {
        const token = getMapboxToken();
        if (!token) {
            setMapError('Mapbox token not found. Please set VITE_MAPBOX_TOKEN.');
            return;
        }
        if (!mapContainerRef.current || mapRef.current) return;

        try {
            mapboxgl.accessToken = token;

            const map = new mapboxgl.Map({
                container: mapContainerRef.current,
                style: 'mapbox://styles/mapbox/streets-v12',
                center: TEXAS_CENTER,
                zoom: DEFAULT_ZOOM,
                minZoom: TEXAS_MIN_ZOOM,
            });

            // Resize-observer keeps the canvas full-width
            const resizeObserver = new ResizeObserver(() => map.resize());
            resizeObserver.observe(mapContainerRef.current);

            // ── Create singleton popup ──
            popupRef.current = new mapboxgl.Popup({
                closeButton: false,
                closeOnClick: false,
                className: 'ai-custom-popup',
                maxWidth: '320px',
            });

            map.on('load', () => {
                setMapLoading(false);
                setMapError(null);

                fitMapToTexas(map);
                loadTexasOutsideMask(map).catch((err) => {
                    mapLogger.error('Error loading Texas outside mask:', err);
                });

                // ── Empty GeoJSON source ──
                map.addSource('h3-hexes', {
                    type: 'geojson',
                    data: { type: 'FeatureCollection', features: [] },
                    generateId: true, // auto-generates numeric IDs for setFeatureState
                });

                // ── Fill layer (default flat color, updated dynamically) ──
                map.addLayer({
                    id: 'h3-fill',
                    type: 'fill',
                    source: 'h3-hexes',
                    paint: {
                        'fill-antialias': false,
                        [FILL_COLOR_PAINT_PROPERTY]: DEFAULT_HEX_FILL,
                        // Translucent fill so basemap remains visible; keep antialias off to reduce pale edge halos.
                        'fill-opacity': HEX_FILL_OPACITY,
                    },
                });

                map.addLayer({
                    id: 'h3-outline',
                    type: 'line',
                    source: 'h3-hexes',
                    paint: {
                        'line-color': HEX_OUTLINE_COLOR,
                        'line-width': HEX_OUTLINE_WIDTH,
                        'line-opacity': HEX_OUTLINE_OPACITY,
                    },
                    layout: {
                        'line-join': 'round',
                        'line-cap': 'round',
                    },
                });

                /* ── Attach hover & click handlers ONCE inside map.on('load') ── */
                // ── Mousemove ──
                map.on('mousemove', 'h3-fill', (e) => {
                    if (!e.features || e.features.length === 0) return;
                    map.getCanvas().style.cursor = 'pointer';

                    const feature = e.features[0];
                    const featureId = feature.id;
                    const hexId = feature.properties?.hex_id;

                    // Clear previous hover state
                    if (hoveredIdRef.current !== null && hoveredIdRef.current !== featureId) {
                        map.setFeatureState({ source: 'h3-hexes', id: hoveredIdRef.current }, { hover: false });
                    }

                    // Set new hover state
                    if (featureId !== undefined && featureId !== null) {
                        hoveredIdRef.current = featureId;
                        map.setFeatureState({ source: 'h3-hexes', id: featureId }, { hover: true });
                    }

                    // Look up full data record
                    const data = hexId ? dataLookupRef.current[hexId] : null;
                    if (data) {
                        const html = useBrowseLayerRef.current
                            ? generateBrowseTooltipHTML(data, hazardMetricRef.current)
                            : generateTooltipHTML(data);
                        popupRef.current.setLngLat(e.lngLat).setHTML(html).addTo(map);
                    } else {
                        // Fallback: use whatever properties Mapbox has
                        const props = feature.properties || {};
                        const html = useBrowseLayerRef.current
                            ? generateBrowseTooltipHTML(props, hazardMetricRef.current)
                            : generateTooltipHTML(props);
                        if (html) {
                            popupRef.current.setLngLat(e.lngLat).setHTML(html).addTo(map);
                        }
                    }
                });

                // ── Mouseleave ──
                map.on('mouseleave', 'h3-fill', () => {
                    map.getCanvas().style.cursor = '';
                    popupRef.current.remove();

                    if (hoveredIdRef.current !== null) {
                        map.setFeatureState({ source: 'h3-hexes', id: hoveredIdRef.current }, { hover: false });
                        hoveredIdRef.current = null;
                    }
                });

                // ── Click ──
                map.on('click', 'h3-fill', (e) => {
                    if (!e.features || e.features.length === 0) return;
                    const feature = e.features[0];
                    trackMapInteraction({
                        action: 'hex_click',
                        tab: 'ai-assistant',
                        layer_name: 'ai_hex',
                    });
                    const hexId = feature.properties?.hex_id;
                    const data = hexId ? dataLookupRef.current[hexId] : feature.properties;
                    onSelectFeatureRef.current(data || feature.properties);

                    if (feature.id !== undefined) {
                        map.setFeatureState({ source: 'h3-hexes', id: feature.id }, { selected: true });
                    }
                });

                map.on('click', (e) => {
                    const features = map.queryRenderedFeatures(e.point, {
                        layers: ['h3-fill', 'h3-outline'],
                    });
                    if (features.length === 0) onSelectFeatureRef.current(null);
                });

                mapLogger.debug('Map handlers attached');
            });

            mapRef.current = map;

            map.on('error', (e) => {
                mapLogger.error('Mapbox error:', e);
                setMapError(`Map error: ${e.error?.message || 'Unknown error'}`);
            });

            return () => {
                resizeObserver.disconnect();
                if (popupRef.current) popupRef.current.remove();
                if (mapRef.current) {
                    mapRef.current.remove();
                    mapRef.current = null;
                }
            };
        } catch (error) {
            setMapError(`Failed to initialize map: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }, []);

    /* ── 2. Update source data + lookup when mapRecords change ──────── */
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        let cancelled = false;
        /** @type {(() => void) | null} */
        let cameraScheduleCleanup = null;

        const clearCameraSchedule = () => {
            if (cameraScheduleCleanup) {
                cameraScheduleCleanup();
                cameraScheduleCleanup = null;
            }
        };

        let sourceWaitAttempts = 0;
        const MAX_SOURCE_WAIT = 80;

        /**
         * The GeoJSON source only exists after map.on('load') runs. Retry on `idle`
         * (bounded by MAX_SOURCE_WAIT) until it appears.
         * @returns {mapboxgl.GeoJSONSource | null}
         */
        const takeSource = () => {
            const source = map.getSource('h3-hexes');
            if (source) {
                sourceWaitAttempts = 0;
                return source;
            }
            sourceWaitAttempts += 1;
            if (sourceWaitAttempts < MAX_SOURCE_WAIT) map.once('idle', updateData);
            return null;
        };

        const scheduleFitToRecords = (records) => {
            const geoForFit = h3ToGeoJson(records);
            if (geoForFit.features.length === 0) return;
            cameraScheduleCleanup = scheduleFitAfterDataCommit(map, geoForFit, () =>
                cancelled ||
                mapRef.current !== map ||
                isMapStreamingRef.current === true
            );
        };

        /** Camera stays put while streaming; browse mode always frames Texas. */
        const updateCamera = (streaming, records) => {
            if (streaming) return;
            if (useBrowseLayerRef.current) {
                fitMapToTexas(map);
                return;
            }
            if (records.length > 0) scheduleFitToRecords(records);
        };

        const paintRecords = (source, records, streaming) => {
            dataLookupRef.current = buildHexLookup(records);
            logRecordsForLayer(records);
            mapLogger.debug(`Data lookup built: ${Object.keys(dataLookupRef.current).length} entries`);

            const geoJson = h3ToGeoJson(records);
            if (geoJson.features.length === 0) return;

            source.setData(geoJson);

            // Single source of truth for color: the user-/default-selected field
            // (resolved in selectedFieldInfoRef). Falls back to DEFAULT_HEX_FILL.
            const fieldInfo = selectedFieldInfoRef.current;
            map.setPaintProperty('h3-fill', FILL_COLOR_PAINT_PROPERTY, buildColorExpression(fieldInfo));

            updateCamera(streaming, records);
        };

        const clearLayer = (source) => {
            clearCameraSchedule();
            source.setData({ type: 'FeatureCollection', features: [] });
            dataLookupRef.current = {};
            map.setPaintProperty('h3-fill', FILL_COLOR_PAINT_PROPERTY, DEFAULT_HEX_FILL);
        };

        const updateData = () => {
            if (cancelled) return;
            if (!map.isStyleLoaded()) {
                map.once('load', updateData);
                return;
            }

            const source = takeSource();
            if (!source) return;

            clearCameraSchedule();

            // Always paint the full accumulated dataset — chunked "reveal" lagged behind SSE chunks.
            const records = Array.isArray(mapRecordsRef.current) ? mapRecordsRef.current : [];
            const streaming = isMapStreamingRef.current === true;

            if (records.length > 0) {
                paintRecords(source, records, streaming);
            } else {
                clearLayer(source);
            }
        };

        updateData();

        return () => {
            cancelled = true;
            clearCameraSchedule();
        };
    }, [effectiveMapRecords, effectiveIsMapStreaming, mapError]);

    mapRecordsRef.current = effectiveMapRecords;
    isMapStreamingRef.current = effectiveIsMapStreaming;
    useBrowseLayerRef.current = useBrowseLayer;
    hazardMetricRef.current = hazardMetric;

    /* ── 3. Sync selected field with the available numeric-field set ──── */
    useEffect(() => {
        // Signature of the field set. A change in the set of available columns
        // means a new query / different turn — reset the user's explicit pick so
        // the fresh dataset re-defaults to its best-coverage field.
        const signature = numericFields
            .map((f) => f.field)
            .sort()
            .join('|');

        if (signature !== fieldSignatureRef.current) {
            fieldSignatureRef.current = signature;
            userPickedFieldRef.current = false;
        }

        // Read via ref so that selectedField doesn't need to be in the dep array —
        // the ref is kept current on every render. The effect still runs whenever
        // numericFields or defaultField changes (new query / streaming update), which
        // is the only time we actually need to re-evaluate the selection.
        const currentField = selectedFieldRef.current;
        const available = numericFields.some((f) => f.field === currentField);

        // Keep a still-valid user pick (don't clobber it as more rows stream in).
        if (userPickedFieldRef.current && available) return;

        // Otherwise (no pick, or the picked field vanished) fall back to default.
        if (!available || currentField === null) {
            setSelectedField(defaultField);
        }
    }, [numericFields, defaultField]);

    /* ── 4. Recolor when the selected field changes (no data change) ──── */
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return undefined;

        let cancelled = false;
        const fieldInfo =
            numericFields.find((f) => f.field === selectedField)
            || numericFields.find((f) => f.field === defaultField)
            || null;

        // Mirror the data-update effect's style/source readiness guarding so we
        // never paint before 'h3-fill' exists.
        const applyColor = () => {
            if (cancelled) return;
            if (!map.isStyleLoaded()) {
                map.once('load', applyColor);
                return;
            }
            if (!map.getLayer('h3-fill')) {
                map.once('idle', applyColor);
                return;
            }
            map.setPaintProperty('h3-fill', FILL_COLOR_PAINT_PROPERTY, buildColorExpression(fieldInfo));
        };

        applyColor();

        return () => {
            cancelled = true;
            map.off('load', applyColor);
            map.off('idle', applyColor);
        };
    }, [selectedField, numericFields, defaultField, mapError]);

    /* ── Handle an explicit user pick from the layer toggle ───────────── */
    const handleSelectField = (field) => {
        userPickedFieldRef.current = true;
        setSelectedField(field);
    };

    // Field info backing the legend gradient (selected column's color scale).
    // Use the same resolved object as the paint — handles the defaultField fallback.
    const selectedInfo = selectedFieldInfoRef.current;
    const hazardLabel = HAZARD_METRIC_LABELS[hazardMetric] || hazardMetric;
    const showLayerSwitch = !useBrowseLayer && numericFields.length >= 2;
    const showBrowseLegend = useBrowseLayer && selectedInfo;

    /* ── Render ─────────────────────────────────────────────────────── */
    return (
        <div className="ai-map-panel" inert={isAnswering || undefined}>
            <div className="ai-map-container-wrapper">
                {mapError ? (
                    <div className="ai-map-error">⚠️ {mapError}</div>
                ) : (
                    <>
                        {(mapLoading || hazardLoading) && (
                            <div className="ai-map-loading-overlay">
                                <div className="ai-loading-spinner"></div>
                                <span>{hazardLoading ? `Loading ${hazardLabel}…` : 'Loading map...'}</span>
                            </div>
                        )}
                        <div ref={mapContainerRef} className="ai-map-container" />
                        {isAnswering && (
                            <div className="ai-map-working" data-testid="ai-map-working">
                                <span className="ai-map-working__veil" aria-hidden="true" />
                                <span className="ai-map-working__sweep" aria-hidden="true" />
                                <span className="ai-map-working__hexes" aria-hidden="true">
                                    <svg viewBox="0 0 120 104" aria-hidden="true" focusable="false">
                                        <polygon
                                            className="ai-map-working__hex ai-map-working__hex--1"
                                            points="60,4 111,30 111,74 60,100 9,74 9,30"
                                        />
                                        <polygon
                                            className="ai-map-working__hex ai-map-working__hex--2"
                                            points="60,20 97,39 97,65 60,84 23,65 23,39"
                                        />
                                        <polygon
                                            className="ai-map-working__hex ai-map-working__hex--3"
                                            points="60,36 83,48 83,56 60,68 37,56 37,48"
                                        />
                                    </svg>
                                </span>
                                <output className="ai-map-working__pill">
                                    <span className="ai-map-working__text">Analyzing map data</span>
                                    <span className="ai-map-working__dots" aria-hidden="true">
                                        <i />
                                        <i />
                                        <i />
                                    </span>
                                </output>
                            </div>
                        )}
                        {onSelectHazardMetric && (
                            <HazardMetricPicker
                                metric={hazardMetric}
                                onChange={onSelectHazardMetric}
                                loading={hazardLoading}
                                error={hazardError}
                                count={hazardRecords.length}
                                isActiveLayer={useBrowseLayer}
                                hasAnswerMap={hasAnswerMap}
                                onShowAnswerMap={onShowAnswerMap}
                            />
                        )}
                        {showLayerSwitch && (
                            <div
                                className="ai-map-layer-switch"
                                role="radiogroup"
                                aria-label="Map layer"
                            >
                                <div className="ai-map-layer-switch__heading">Layer</div>
                                <div className="ai-map-layer-switch__list">
                                    {numericFields.map((f) => {
                                        const isActive = f.field === selectedField;
                                        return (
                                            <label
                                                key={f.field}
                                                className={
                                                    'ai-map-layer-option' +
                                                    (isActive ? ' ai-map-layer-option--active' : '')
                                                }
                                            >
                                                <input
                                                    type="radio"
                                                    name="ai-map-layer"
                                                    className="ai-map-layer-option__input"
                                                    value={f.field}
                                                    checked={isActive}
                                                    onChange={() => handleSelectField(f.field)}
                                                />
                                                <span className="ai-map-layer-option__dot" aria-hidden="true" />
                                                <span className="ai-map-layer-option__label">
                                                    {formatKey(f.field)}
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                                {selectedInfo && (
                                    <>
                                        <div className="ai-map-layer-scale" aria-hidden="true">
                                            <div
                                                className="ai-map-layer-scale__bar"
                                                style={{ backgroundImage: HEX_RAMP_CSS_GRADIENT }}
                                            />
                                            <div className="ai-map-layer-scale__labels">
                                                <span>{formatScaleValue(selectedInfo.min)}</span>
                                                <span>{formatScaleValue(selectedInfo.max)}</span>
                                            </div>
                                        </div>
                                        <span className="ai-map-layer-sr">
                                            {formatScaleValue(selectedInfo.min)} to {formatScaleValue(selectedInfo.max)}
                                        </span>
                                    </>
                                )}
                            </div>
                        )}
                        {showBrowseLegend && (
                            <div className="ai-map-layer-switch ai-map-layer-switch--browse" aria-label="Hazard legend">
                                <div className="ai-map-layer-switch__heading">
                                    Avg {hazardLabel} Risk
                                </div>
                                <div className="ai-map-layer-scale" aria-hidden="true">
                                    <div
                                        className="ai-map-layer-scale__bar"
                                        style={{ backgroundImage: HEX_RAMP_CSS_GRADIENT }}
                                    />
                                    <div className="ai-map-layer-scale__labels">
                                        <span>{formatScaleValue(selectedInfo.min)}</span>
                                        <span>{formatScaleValue(selectedInfo.max)}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
            {selectedFeature && (
                <AIAssistantFeatureDetails feature={selectedFeature} onClose={() => onSelectFeature(null)} />
            )}
        </div>
    );
};

AIAssistantMap.propTypes = {
    mapRecords: PropTypes.arrayOf(PropTypes.object),
    mapColumns: PropTypes.arrayOf(PropTypes.string),
    isMapStreaming: PropTypes.bool,
    selectedFeature: PropTypes.object,
    onSelectFeature: PropTypes.func.isRequired,
    hazardMetric: PropTypes.string,
    hazardRecords: PropTypes.arrayOf(PropTypes.object),
    hazardLoading: PropTypes.bool,
    hazardError: PropTypes.string,
    preferHazardLayer: PropTypes.bool,
    onSelectHazardMetric: PropTypes.func,
    onAnswerMapAvailable: PropTypes.func,
    onShowAnswerMap: PropTypes.func,
    isAnswering: PropTypes.bool,
};

export default AIAssistantMap;
