import { useEffect, useRef } from 'react';
import {
  DAMAGE_SOURCES,
  DAMAGE_LAYERS,
  DAMAGE_VIEWS,
  DEFAULT_DAMAGE_VIEW,
  DEFAULT_H3_METRIC,
  BUILDINGS_MIN_ZOOM,
  HEATMAP_RADIUS,
  HEATMAP_INTENSITY,
  HEATMAP_OPACITY,
  HEATMAP_RAMP,
  BUILDING_FILL_COLOR,
  BUILDING_FILL_OPACITY,
  BUILDING_LINE_COLOR,
  BUILDING_LINE_WIDTH,
  DENSITY_BUILDING_LINE_COLOR,
  DENSITY_BUILDING_LINE_WIDTH,
  H3_LINE_COLOR,
  H3_LINE_WIDTH,
  getH3FillColorExpression,
  getH3FillOpacityExpression,
} from '@/config/damageAssessmentConfig';
import { damageTileUrl } from '@/services/damageService';


// Helper to find basemap label layer to place damage layers underneath
function getFirstLabelLayerId(m) {
  if (!m || typeof m.getStyle !== 'function') return undefined;
  return m.getStyle()?.layers?.find(
    (l) => l.type === 'symbol' && (l.id.includes('label') || l.id.includes('place'))
  )?.id;
}

function addSources(map, assessmentId) {
  if (!map.getSource(DAMAGE_SOURCES.H3)) {
    map.addSource(DAMAGE_SOURCES.H3, {
      type: 'vector',
      tiles: [damageTileUrl(assessmentId, 'h3')],
      minzoom: 0,
      maxzoom: 14,
      promoteId: 'h3',
    });
  }
  if (!map.getSource(DAMAGE_SOURCES.BUILDINGS)) {
    map.addSource(DAMAGE_SOURCES.BUILDINGS, {
      type: 'vector',
      tiles: [damageTileUrl(assessmentId, 'buildings')],
      minzoom: BUILDINGS_MIN_ZOOM,
      maxzoom: 14,
      promoteId: 'building_id',
    });
  }
  if (!map.getSource(DAMAGE_SOURCES.DENSITY)) {
    map.addSource(DAMAGE_SOURCES.DENSITY, {
      type: 'vector',
      tiles: [damageTileUrl(assessmentId, 'density')],
      minzoom: 0,
      maxzoom: 14,
    });
  }
}

// Plain 256 px JPEG tiles at quality 70. The default for 'mapbox://mapbox.satellite' is 512 px @2x WebP,
// about 300 KB a tile; on a slow connection a screen of those took over 10 seconds. These are about 20 KB each.
const SATELLITE_TILE_URL =
  `https://api.mapbox.com/v4/mapbox.satellite/{z}/{x}/{y}.jpg70?access_token=${import.meta.env.VITE_MAPBOX_TOKEN}`;

// Satellite imagery as a raster layer under the damage layers. A layer is toggled instead of calling
// map.setStyle(), which would reload the map and remove every custom layer.
function addSatelliteLayer(map, beforeId, view) {
  if (!map.getSource(DAMAGE_SOURCES.SATELLITE)) {
    map.addSource(DAMAGE_SOURCES.SATELLITE, {
      type: 'raster',
      tiles: [SATELLITE_TILE_URL],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© Mapbox © Maxar',
    });
  }
  if (map.getLayer(DAMAGE_LAYERS.SATELLITE)) return;
  map.addLayer(
    {
      id: DAMAGE_LAYERS.SATELLITE,
      type: 'raster',
      source: DAMAGE_SOURCES.SATELLITE,
      layout: {
        visibility: view === DAMAGE_VIEWS.H3 ? 'none' : 'visible',
      },
      // no cross-fade: a tile is shown the moment it arrives
      paint: { 'raster-fade-duration': 0 },
    },
    beforeId
  );
}

function addDensityHeatmapLayer(map, beforeId, view) {
  if (map.getLayer(DAMAGE_LAYERS.DENSITY_HEAT)) return;
  map.addLayer(
    {
      id: DAMAGE_LAYERS.DENSITY_HEAT,
      type: 'heatmap',
      source: DAMAGE_SOURCES.DENSITY,
      'source-layer': 'density',
      layout: {
        visibility: view === DAMAGE_VIEWS.DENSITY ? 'visible' : 'none',
      },
      paint: {
        'heatmap-weight': ['get', 'w'],
        'heatmap-radius': HEATMAP_RADIUS,
        'heatmap-intensity': HEATMAP_INTENSITY,
        'heatmap-opacity': HEATMAP_OPACITY,
        'heatmap-color': [
          'interpolate',
          ['linear'],
          ['heatmap-density'],
          ...HEATMAP_RAMP,
        ],
      },
    },
    beforeId
  );
}

function addH3Layers(map, beforeId, view, metric) {
  if (!map.getLayer(DAMAGE_LAYERS.H3_FILL)) {
    map.addLayer(
      {
        id: DAMAGE_LAYERS.H3_FILL,
        type: 'fill',
        source: DAMAGE_SOURCES.H3,
        'source-layer': 'h3',
        layout: {
          visibility: view === DAMAGE_VIEWS.H3 ? 'visible' : 'none',
        },
        paint: {
          'fill-color': getH3FillColorExpression(metric),
          'fill-opacity': getH3FillOpacityExpression(metric),
        },
      },
      beforeId
    );
  }
  if (!map.getLayer(DAMAGE_LAYERS.H3_LINE)) {
    map.addLayer(
      {
        id: DAMAGE_LAYERS.H3_LINE,
        type: 'line',
        source: DAMAGE_SOURCES.H3,
        'source-layer': 'h3',
        layout: {
          visibility: view === DAMAGE_VIEWS.H3 ? 'visible' : 'none',
        },
        paint: {
          'line-color': H3_LINE_COLOR,
          'line-width': H3_LINE_WIDTH,
        },
      },
      beforeId
    );
  }
}

function addBuildingLayers(map, beforeId, view) {
  if (!map.getLayer(DAMAGE_LAYERS.BUILDINGS_FILL)) {
    map.addLayer(
      {
        id: DAMAGE_LAYERS.BUILDINGS_FILL,
        type: 'fill',
        source: DAMAGE_SOURCES.BUILDINGS,
        'source-layer': 'buildings',
        minzoom: BUILDINGS_MIN_ZOOM,
        layout: {
          visibility: view === DAMAGE_VIEWS.BUILDINGS ? 'visible' : 'none',
        },
        paint: {
          'fill-color': BUILDING_FILL_COLOR,
          'fill-opacity': BUILDING_FILL_OPACITY,
        },
      },
      beforeId
    );
  }
  if (!map.getLayer(DAMAGE_LAYERS.BUILDINGS_LINE)) {
    map.addLayer(
      {
        id: DAMAGE_LAYERS.BUILDINGS_LINE,
        type: 'line',
        source: DAMAGE_SOURCES.BUILDINGS,
        'source-layer': 'buildings',
        minzoom: view === DAMAGE_VIEWS.DENSITY ? 15 : BUILDINGS_MIN_ZOOM,
        layout: {
          visibility:
            view === DAMAGE_VIEWS.BUILDINGS || view === DAMAGE_VIEWS.DENSITY
              ? 'visible'
              : 'none',
        },
        paint: {
          'line-color':
            view === DAMAGE_VIEWS.DENSITY
              ? DENSITY_BUILDING_LINE_COLOR
              : BUILDING_LINE_COLOR,
          'line-width':
            view === DAMAGE_VIEWS.DENSITY
              ? DENSITY_BUILDING_LINE_WIDTH
              : BUILDING_LINE_WIDTH,
        },
      },
      beforeId
    );
  }
}

function setLayerVisibility(map, layerId, isVisible) {
  if (map.getLayer(layerId)) {
    map.setLayoutProperty(layerId, 'visibility', isVisible ? 'visible' : 'none');
  }
}

function applyH3View(map) {
  setLayerVisibility(map, DAMAGE_LAYERS.SATELLITE, false);
  setLayerVisibility(map, DAMAGE_LAYERS.H3_FILL, true);
  setLayerVisibility(map, DAMAGE_LAYERS.H3_LINE, true);
  setLayerVisibility(map, DAMAGE_LAYERS.BUILDINGS_FILL, false);
  setLayerVisibility(map, DAMAGE_LAYERS.BUILDINGS_LINE, false);
  setLayerVisibility(map, DAMAGE_LAYERS.DENSITY_HEAT, false);
}

// Satellite imagery and footprints only. Hexagons are never drawn here: below the footprint zoom the
// tab flies in instead (see DamageAssessmentTab), so this view never looks like the H3 view.
function applyBuildingsView(map) {
  setLayerVisibility(map, DAMAGE_LAYERS.SATELLITE, true);
  setLayerVisibility(map, DAMAGE_LAYERS.H3_FILL, false);
  setLayerVisibility(map, DAMAGE_LAYERS.H3_LINE, false);
  setLayerVisibility(map, DAMAGE_LAYERS.BUILDINGS_FILL, true);
  setLayerVisibility(map, DAMAGE_LAYERS.BUILDINGS_LINE, true);
  setLayerVisibility(map, DAMAGE_LAYERS.DENSITY_HEAT, false);

  if (map.getLayer(DAMAGE_LAYERS.BUILDINGS_LINE)) {
    if (map.setLayerZoomRange) {
      map.setLayerZoomRange(DAMAGE_LAYERS.BUILDINGS_LINE, BUILDINGS_MIN_ZOOM, 24);
    }
    map.setPaintProperty(DAMAGE_LAYERS.BUILDINGS_LINE, 'line-color', BUILDING_LINE_COLOR);
    map.setPaintProperty(DAMAGE_LAYERS.BUILDINGS_LINE, 'line-width', BUILDING_LINE_WIDTH);
  }
}

function applyDensityView(map) {
  setLayerVisibility(map, DAMAGE_LAYERS.SATELLITE, true);
  setLayerVisibility(map, DAMAGE_LAYERS.H3_FILL, false);
  setLayerVisibility(map, DAMAGE_LAYERS.H3_LINE, false);
  setLayerVisibility(map, DAMAGE_LAYERS.BUILDINGS_FILL, false);
  setLayerVisibility(map, DAMAGE_LAYERS.BUILDINGS_LINE, true);
  setLayerVisibility(map, DAMAGE_LAYERS.DENSITY_HEAT, true);

  if (map.getLayer(DAMAGE_LAYERS.BUILDINGS_LINE)) {
    if (map.setLayerZoomRange) {
      map.setLayerZoomRange(DAMAGE_LAYERS.BUILDINGS_LINE, 15, 24);
    }
    map.setPaintProperty(
      DAMAGE_LAYERS.BUILDINGS_LINE,
      'line-color',
      DENSITY_BUILDING_LINE_COLOR
    );
    map.setPaintProperty(
      DAMAGE_LAYERS.BUILDINGS_LINE,
      'line-width',
      DENSITY_BUILDING_LINE_WIDTH
    );
  }
}

/**
 * Hook to add and manage damage assessment vector tile sources and layers on a Mapbox map.
 */
export function useDamageMapLayers({
  map,
  assessmentId,
  view = DEFAULT_DAMAGE_VIEW,
  metric = DEFAULT_H3_METRIC,
}) {
  const sourcesAddedRef = useRef(false);
  const currentAidRef = useRef(null);
  const viewRef = useRef(view);
  const metricRef = useRef(metric);
  viewRef.current = view;
  metricRef.current = metric;

  // Add sources and layers once style is loaded and assessmentId is available
  useEffect(() => {
    if (!map || !assessmentId) return;

    const setupLayers = () => {
      const view = viewRef.current;
      const metric = metricRef.current;
      const beforeId = getFirstLabelLayerId(map);
      addSources(map, assessmentId);
      addSatelliteLayer(map, beforeId, view);
      addDensityHeatmapLayer(map, beforeId, view);
      addH3Layers(map, beforeId, view, metric);
      addBuildingLayers(map, beforeId, view);

      sourcesAddedRef.current = true;
      currentAidRef.current = assessmentId;
    };

    // Sources and layers can be added from the 'style.load' event on, although isStyleLoaded() may still be
    // false at that moment. The listener stays on because switching the basemap style removes every custom
    // source and layer; setupLayers only adds what is missing, so running it again is safe.
    const onStyleLoad = () => {
      try {
        setupLayers();
      } catch {
        // style not ready for layers yet; the next 'style.load' or 'idle' adds them
      }
    };
    onStyleLoad();
    map.on?.('style.load', onStyleLoad);
    map.once?.('idle', onStyleLoad);

    return () => {
      map.off?.('style.load', onStyleLoad);
      map.off?.('idle', onStyleLoad);
    };
  }, [map, assessmentId]);

  // Update source tile URLs when assessmentId changes
  useEffect(() => {
    if (!map || !assessmentId || !sourcesAddedRef.current) return;
    if (currentAidRef.current === assessmentId) return;

    currentAidRef.current = assessmentId;
    const h3Source = map.getSource(DAMAGE_SOURCES.H3);
    if (h3Source?.setTiles) {
      h3Source.setTiles([damageTileUrl(assessmentId, 'h3')]);
    }
    const bldgSource = map.getSource(DAMAGE_SOURCES.BUILDINGS);
    if (bldgSource?.setTiles) {
      bldgSource.setTiles([damageTileUrl(assessmentId, 'buildings')]);
    }
    const densitySource = map.getSource(DAMAGE_SOURCES.DENSITY);
    if (densitySource?.setTiles) {
      densitySource.setTiles([damageTileUrl(assessmentId, 'density')]);
    }
  }, [map, assessmentId]);

  // Handle View changes (visibility & layer zoom ranges)
  useEffect(() => {
    if (!map || !sourcesAddedRef.current) return;

    if (view === DAMAGE_VIEWS.H3) {
      applyH3View(map);
    } else if (view === DAMAGE_VIEWS.BUILDINGS) {
      applyBuildingsView(map);
    } else if (view === DAMAGE_VIEWS.DENSITY) {
      applyDensityView(map);
    }
  }, [map, view]);

  // Handle Metric changes
  useEffect(() => {
    if (!map || !sourcesAddedRef.current) return;
    if (map.getLayer(DAMAGE_LAYERS.H3_FILL)) {
      map.setPaintProperty(
        DAMAGE_LAYERS.H3_FILL,
        'fill-color',
        getH3FillColorExpression(metric)
      );
      map.setPaintProperty(
        DAMAGE_LAYERS.H3_FILL,
        'fill-opacity',
        getH3FillOpacityExpression(metric)
      );
    }
  }, [map, metric]);
}
