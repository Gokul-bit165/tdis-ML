import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import {
  DAMAGE_SOURCES,
  DAMAGE_LAYERS,
  DAMAGE_VIEWS,
  BUILDINGS_MIN_ZOOM,
} from '@/config/damageAssessmentConfig';
import { getDamageBuilding } from '@/services/damageService';

/**
 * Hook to manage user interactions with damage assessment map layers:
 * - Hover cursor changes and hexagon tooltip popup
 * - Hexagon cell selection on click
 * - Building footprint selection and abortable detail fetching on click
 */
export function useDamageInteractions({
  map,
  assessmentId,
  view,
  onSelectCell,
  onSelectBuilding,
  setIsLoadingBuilding,
  setBuildingError,
}) {
  const activeAbortRef = useRef(null);
  const selectedBuildingIdRef = useRef(null);
  const selectedCellIdRef = useRef(null);
  const hoveredCellIdRef = useRef(null);
  const popupRef = useRef(null);

  // Clear selections and popups when view or assessment changes
  useEffect(() => {
    if (activeAbortRef.current) {
      activeAbortRef.current.abort();
      activeAbortRef.current = null;
    }
    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }

    if (map) {
      if (selectedBuildingIdRef.current) {
        try {
          map.setFeatureState(
            {
              source: DAMAGE_SOURCES.BUILDINGS,
              sourceLayer: 'buildings',
              id: selectedBuildingIdRef.current,
            },
            { selected: false }
          );
        } catch {
          // ignore
        }
        selectedBuildingIdRef.current = null;
      }
      if (selectedCellIdRef.current) {
        try {
          map.setFeatureState(
            {
              source: DAMAGE_SOURCES.H3,
              sourceLayer: 'h3',
              id: selectedCellIdRef.current,
            },
            { selected: false }
          );
        } catch {
          // ignore
        }
        selectedCellIdRef.current = null;
      }
    }
  }, [map, view, assessmentId]);

  useEffect(() => {
    if (!map || !assessmentId) return;

    // Mousemove on H3 layer
    const onH3MouseMove = (e) => {
      const zoom = map.getZoom();
      // If in buildings view at zoom 14+, buildings take precedence
      if (view === DAMAGE_VIEWS.BUILDINGS && zoom >= BUILDINGS_MIN_ZOOM) return;
      if (view === DAMAGE_VIEWS.DENSITY) return;

      if (!e.features || e.features.length === 0) return;
      const feat = e.features[0];
      const props = feat.properties;
      map.getCanvas().style.cursor = 'pointer';

      // Tooltip content: e.g. "212 buildings, 198 assessed. 61 damaged (31%), 9 collapsed (5%)."
      const n = props.n ?? 0;
      const na = props.na ?? 0;
      const c0 = props.c0 ?? 0;
      const damaged = Math.max(0, na - c0);
      const collapsed = (props.c3 ?? 0) + (props.c4 ?? 0);
      const damagedPct = na > 0 ? Math.round((damaged / na) * 100) : 0;
      const collapsedPct = na > 0 ? Math.round((collapsed / na) * 100) : 0;

      const html = `
        <div style="font-size: 11px; line-height: 1.4; color: #1e293b; padding: 2px 4px;">
          <div><strong>${n}</strong> buildings, <strong>${na}</strong> assessed.</div>
          <div style="margin-top: 2px;">
            <span style="color: #dc2626; font-weight: 600;">${damaged}</span> damaged (${damagedPct}%),
            <span style="color: #991b1b; font-weight: 600;">${collapsed}</span> collapsed (${collapsedPct}%).
          </div>
        </div>
      `;

      if (!popupRef.current) {
        popupRef.current = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 12,
        });
      }

      popupRef.current.setLngLat(e.lngLat).setHTML(html).addTo(map);

      // Hover outline highlight
      if (hoveredCellIdRef.current && hoveredCellIdRef.current !== feat.id) {
        try {
          map.setFeatureState(
            {
              source: DAMAGE_SOURCES.H3,
              sourceLayer: 'h3',
              id: hoveredCellIdRef.current,
            },
            { hover: false }
          );
        } catch {
          // ignore
        }
      }
      if (feat.id) {
        hoveredCellIdRef.current = feat.id;
        try {
          map.setFeatureState(
            {
              source: DAMAGE_SOURCES.H3,
              sourceLayer: 'h3',
              id: feat.id,
            },
            { hover: true }
          );
        } catch {
          // ignore
        }
      }
    };

    const onH3MouseLeave = () => {
      map.getCanvas().style.cursor = '';
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      if (hoveredCellIdRef.current) {
        try {
          map.setFeatureState(
            {
              source: DAMAGE_SOURCES.H3,
              sourceLayer: 'h3',
              id: hoveredCellIdRef.current,
            },
            { hover: false }
          );
        } catch {
          // ignore
        }
        hoveredCellIdRef.current = null;
      }
    };

    // Click on H3 layer
    const onH3Click = (e) => {
      const zoom = map.getZoom();
      if (view === DAMAGE_VIEWS.BUILDINGS && zoom >= BUILDINGS_MIN_ZOOM) return;
      if (view === DAMAGE_VIEWS.DENSITY) return;
      if (!e.features || e.features.length === 0) return;

      const feat = e.features[0];
      const cellProps = { ...feat.properties, h3: feat.properties.h3 || feat.id };

      // Update cell feature state
      if (selectedCellIdRef.current) {
        try {
          map.setFeatureState(
            {
              source: DAMAGE_SOURCES.H3,
              sourceLayer: 'h3',
              id: selectedCellIdRef.current,
            },
            { selected: false }
          );
        } catch {
          // ignore
        }
      }

      if (feat.id) {
        selectedCellIdRef.current = feat.id;
        try {
          map.setFeatureState(
            {
              source: DAMAGE_SOURCES.H3,
              sourceLayer: 'h3',
              id: feat.id,
            },
            { selected: true }
          );
        } catch {
          // ignore
        }
      }

      if (onSelectCell) {
        onSelectCell(cellProps);
      }
    };

    // Mousemove on Buildings layer
    const onBuildingMouseMove = (e) => {
      if (view !== DAMAGE_VIEWS.BUILDINGS) return;
      if (map.getZoom() < BUILDINGS_MIN_ZOOM) return;
      if (!e.features || e.features.length === 0) return;
      map.getCanvas().style.cursor = 'pointer';
    };

    const onBuildingMouseLeave = () => {
      if (view === DAMAGE_VIEWS.BUILDINGS) {
        map.getCanvas().style.cursor = '';
      }
    };

    // Click on Building layer
    const onBuildingClick = async (e) => {
      if (view !== DAMAGE_VIEWS.BUILDINGS) return;
      if (map.getZoom() < BUILDINGS_MIN_ZOOM) return;
      if (!e.features || e.features.length === 0) return;

      const feat = e.features[0];
      const buildingId = feat.properties.building_id || feat.id;
      if (!buildingId) return;

      // Unselect previous building
      if (selectedBuildingIdRef.current) {
        try {
          map.setFeatureState(
            {
              source: DAMAGE_SOURCES.BUILDINGS,
              sourceLayer: 'buildings',
              id: selectedBuildingIdRef.current,
            },
            { selected: false }
          );
        } catch {
          // ignore
        }
      }

      // Select new building
      selectedBuildingIdRef.current = buildingId;
      try {
        map.setFeatureState(
          {
            source: DAMAGE_SOURCES.BUILDINGS,
            sourceLayer: 'buildings',
            id: buildingId,
          },
          { selected: true }
        );
      } catch {
        // ignore
      }

      // Abort previous in-flight request if present
      if (activeAbortRef.current) {
        activeAbortRef.current.abort();
        activeAbortRef.current = null;
      }

      const controller = new AbortController();
      activeAbortRef.current = controller;

      setIsLoadingBuilding?.(true);
      setBuildingError?.(null);

      try {
        const detail = await getDamageBuilding(
          assessmentId,
          buildingId,
          controller.signal
        );
        if (!controller.signal.aborted) {
          onSelectBuilding?.(detail);
          setIsLoadingBuilding?.(false);
        }
      } catch (err) {
        if (err.name === 'AbortError' || controller.signal.aborted) {
          return; // Aborted cleanly
        }
        setBuildingError?.(err);
        setIsLoadingBuilding?.(false);
      }
    };

    map.on('mousemove', DAMAGE_LAYERS.H3_FILL, onH3MouseMove);
    map.on('mouseleave', DAMAGE_LAYERS.H3_FILL, onH3MouseLeave);
    map.on('click', DAMAGE_LAYERS.H3_FILL, onH3Click);

    map.on('mousemove', DAMAGE_LAYERS.BUILDINGS_FILL, onBuildingMouseMove);
    map.on('mouseleave', DAMAGE_LAYERS.BUILDINGS_FILL, onBuildingMouseLeave);
    map.on('click', DAMAGE_LAYERS.BUILDINGS_FILL, onBuildingClick);

    return () => {
      map.off('mousemove', DAMAGE_LAYERS.H3_FILL, onH3MouseMove);
      map.off('mouseleave', DAMAGE_LAYERS.H3_FILL, onH3MouseLeave);
      map.off('click', DAMAGE_LAYERS.H3_FILL, onH3Click);

      map.off('mousemove', DAMAGE_LAYERS.BUILDINGS_FILL, onBuildingMouseMove);
      map.off('mouseleave', DAMAGE_LAYERS.BUILDINGS_FILL, onBuildingMouseLeave);
      map.off('click', DAMAGE_LAYERS.BUILDINGS_FILL, onBuildingClick);

      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      if (activeAbortRef.current) {
        activeAbortRef.current.abort();
        activeAbortRef.current = null;
      }
    };
  }, [
    map,
    assessmentId,
    view,
    onSelectCell,
    onSelectBuilding,
    setIsLoadingBuilding,
    setBuildingError,
  ]);

  const clearSelection = () => {
    if (activeAbortRef.current) {
      activeAbortRef.current.abort();
      activeAbortRef.current = null;
    }
    if (map && selectedBuildingIdRef.current) {
      try {
        map.setFeatureState(
          {
            source: DAMAGE_SOURCES.BUILDINGS,
            sourceLayer: 'buildings',
            id: selectedBuildingIdRef.current,
          },
          { selected: false }
        );
      } catch {
        // ignore
      }
      selectedBuildingIdRef.current = null;
    }
    if (map && selectedCellIdRef.current) {
      try {
        map.setFeatureState(
          {
            source: DAMAGE_SOURCES.H3,
            sourceLayer: 'h3',
            id: selectedCellIdRef.current,
          },
          { selected: false }
        );
      } catch {
        // ignore
      }
      selectedCellIdRef.current = null;
    }
  };

  return { clearSelection };
}
