import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertCircle, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { cellToLatLng } from 'h3-js';
import { useMapboxMap } from '@/hooks/useMapboxMap';
import {
  DAMAGE_VIEWS,
  DEFAULT_DAMAGE_VIEW,
  H3_METRICS,
  DEFAULT_H3_METRIC,
  DAMAGE_SOURCES,
  DAMAGE_LAYERS,
  BUILDINGS_MIN_ZOOM,
  BUILDINGS_FLY_ZOOM,
} from '@/config/damageAssessmentConfig';
import { getDamageAssessments } from '@/services/damageService';
import { useDamageMapLayers } from '@/hooks/useDamageMapLayers';
import { useDamageInteractions } from '@/hooks/useDamageInteractions';
import DamageViewSwitcher from './damage/DamageViewSwitcher';
import DamageLegend from './damage/DamageLegend';
import DamageDetailPanel from './damage/DamageDetailPanel';

/**
 * DamageAssessmentTab Component
 * Visualizes building damage assessments using vector tiles across 3 views:
 * H3 Aggregation, Building Damage, and Building Density.
 */
export default function DamageAssessmentTab() {
  const [searchParams, setSearchParams] = useSearchParams();

  // URL state
  const rawView = searchParams.get('dview');
  const activeView =
    rawView === DAMAGE_VIEWS.BUILDINGS || rawView === DAMAGE_VIEWS.DENSITY
      ? rawView
      : DAMAGE_VIEWS.H3;

  const rawAid = searchParams.get('da');

  // Component state
  const [assessments, setAssessments] = useState([]);
  const [selectedAid, setSelectedAid] = useState(rawAid ? Number(rawAid) : null);
  const [selectedAssessment, setSelectedAssessment] = useState(null);
  const [assessmentsLoading, setAssessmentsLoading] = useState(true);
  const [assessmentsError, setAssessmentsError] = useState(null);

  const activeMetric = DEFAULT_H3_METRIC;
  const [mapZoom, setMapZoom] = useState(10);
  const [isLoadingTiles, setIsLoadingTiles] = useState(false);
  const [tileError, setTileError] = useState(null);
  const [loadedTimestamp, setLoadedTimestamp] = useState(null);

  // Selection state
  const [selectedCell, setSelectedCell] = useState(null);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [isLoadingBuilding, setIsLoadingBuilding] = useState(false);
  const [buildingError, setBuildingError] = useState(null);

  // Mobile card collapse: default to collapsed on phone screens (< 640px)
  const [isCardCollapsed, setIsCardCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 640;
    }
    return false;
  });

  // Mapbox hook
  const loadLayers = useCallback(() => {
    // Layer setup is handled reactively by useDamageMapLayers
  }, []);

  const { mapContainerRef, mapRef } = useMapboxMap({
    componentName: 'Damage',
    loadLayers,
  });

  // Fetch assessment list once on mount
  const fetchAssessments = useCallback(async () => {
    setAssessmentsLoading(true);
    setAssessmentsError(null);
    try {
      const data = await getDamageAssessments();
      const list = Array.isArray(data) ? data : [];
      setAssessments(list);
      setLoadedTimestamp(new Date().toLocaleTimeString());

      if (list.length > 0) {
        const currentDa = searchParams.get('da');
        let matched = null;
        if (currentDa) {
          matched = list.find((a) => String(a.assessment_id) === String(currentDa));
        }
        const active = matched || list[0];
        setSelectedAid(active.assessment_id);
        setSelectedAssessment(active);

        if (!currentDa || String(currentDa) !== String(active.assessment_id)) {
          setSearchParams(
            (prev) => {
              const next = new URLSearchParams(prev);
              next.set('da', String(active.assessment_id));
              return next;
            },
            { replace: true }
          );
        }
      } else {
        setSelectedAid(null);
        setSelectedAssessment(null);
      }
    } catch (err) {
      setAssessmentsError(err.message || 'Failed to load assessments');
    } finally {
      setAssessmentsLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchAssessments();
  }, [fetchAssessments]);

  // Handle URL change for da from searchParams
  useEffect(() => {
    if (assessments.length > 0) {
      const currentDa = searchParams.get('da');
      if (currentDa) {
        const matched = assessments.find((a) => String(a.assessment_id) === String(currentDa));
        if (matched && matched.assessment_id !== selectedAid) {
          setSelectedAid(matched.assessment_id);
          setSelectedAssessment(matched);
          setSelectedCell(null);
          setSelectedBuilding(null);
        }
      }
    }
  }, [searchParams, assessments, selectedAid]);

  // Fit bounds when assessment changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedAssessment?.bbox) return;

    const bbox = selectedAssessment.bbox;
    // bbox is [west, south, east, north]
    if (Array.isArray(bbox) && bbox.length === 4) {
      try {
        map.fitBounds(
          [
            [bbox[0], bbox[1]],
            [bbox[2], bbox[3]],
          ],
          { padding: 40, maxZoom: 14 }
        );
      } catch {
        // ignore map fitBounds error
      }
    }
  }, [mapRef, selectedAssessment]);

  // Manage vector tile layers
  useDamageMapLayers({
    map: mapRef.current,
    assessmentId: selectedAid,
    view: activeView,
    metric: activeMetric,
  });

  // Manage layer interactions
  const { clearSelection } = useDamageInteractions({
    map: mapRef.current,
    assessmentId: selectedAid,
    view: activeView,
    onSelectCell: (cell) => {
      setSelectedBuilding(null);
      setBuildingError(null);
      setSelectedCell(cell);
    },
    onSelectBuilding: (bldg) => {
      setSelectedCell(null);
      setSelectedBuilding(bldg);
      setBuildingError(null);
    },
    setIsLoadingBuilding,
    setBuildingError,
  });

  // View switch handler (updates URL parameter dview)
  // Opening the Building view from far out would show an empty map, because footprints start at zoom 14.
  // Go to the worst-hit hexagon on screen, or simply zoom in where the user already is. The map jumps
  // instead of animating: a flight loads street and satellite tiles for every zoom level it passes through,
  // which made the view slow to appear.
  const flyToBuildings = () => {
    const map = mapRef.current;
    if (!map || typeof map.getZoom !== 'function' || map.getZoom() >= BUILDINGS_MIN_ZOOM) return;
    let center;
    try {
      const cells = map.getLayer?.(DAMAGE_LAYERS.H3_FILL)
        ? map.queryRenderedFeatures({ layers: [DAMAGE_LAYERS.H3_FILL] })
        : [];
      const collapsed = (f) => Number(f.properties?.c3 || 0) + Number(f.properties?.c4 || 0);
      const worst = cells.reduce((best, f) => {
        if (!best) return f;
        const diff = collapsed(f) - collapsed(best);
        const more = Number(f.properties?.n || 0) > Number(best.properties?.n || 0);
        return diff > 0 || (diff === 0 && more) ? f : best;
      }, null);
      if (worst?.properties?.h3) {
        const [lat, lng] = cellToLatLng(worst.properties.h3);
        center = [lng, lat];
      }
    } catch {
      // fall back to the current map centre
    }
    map.jumpTo?.({ ...(center ? { center } : {}), zoom: BUILDINGS_FLY_ZOOM });
  };

  const handleViewChange = (newView, { fly = true } = {}) => {
    if (fly && newView === DAMAGE_VIEWS.BUILDINGS) flyToBuildings();
    clearSelection();
    setSelectedCell(null);
    setSelectedBuilding(null);
    setBuildingError(null);

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (newView === DAMAGE_VIEWS.H3) {
          next.delete('dview');
        } else {
          next.set('dview', newView);
        }
        return next;
      },
      { replace: true }
    );
  };

  // Assessment select handler (updates URL parameter da)
  const handleAssessmentChange = (aid) => {
    clearSelection();
    setSelectedCell(null);
    setSelectedBuilding(null);
    setBuildingError(null);

    const aidNum = Number(aid);
    setSelectedAid(aidNum);
    const found = assessments.find((a) => a.assessment_id === aidNum);
    setSelectedAssessment(found || null);

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('da', String(aid));
        return next;
      },
      { replace: true }
    );
  };

  // Zoom to hexagon cell footprints
  const handleZoomToCell = (cell) => {
    const map = mapRef.current;
    if (map && cell?.h3) {
      try {
        const [lat, lng] = cellToLatLng(cell.h3);
        map.jumpTo({ center: [lng, lat], zoom: BUILDINGS_FLY_ZOOM });
      } catch {
        // ignore flyTo error
      }
    }
    handleViewChange(DAMAGE_VIEWS.BUILDINGS, { fly: false });
  };

  // Map event listeners for tile loading, errors, and zoom
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    let watchdogTimer = null;

    const clearLoading = () => {
      if (watchdogTimer) {
        clearTimeout(watchdogTimer);
        watchdogTimer = null;
      }
      setIsLoadingTiles(false);
    };

    const onZoom = () => {
      if (typeof map.getZoom === 'function') {
        setMapZoom(map.getZoom());
      }
    };

    const damageSourcesSet = new Set([
      DAMAGE_SOURCES.H3,
      DAMAGE_SOURCES.BUILDINGS,
      DAMAGE_SOURCES.DENSITY,
    ]);

    const onSourceDataLoading = (e) => {
      if (damageSourcesSet.has(e.sourceId)) {
        setIsLoadingTiles(true);
        if (watchdogTimer) clearTimeout(watchdogTimer);
        // Safety timeout so "Updating..." never gets permanently stuck
        watchdogTimer = setTimeout(() => {
          setIsLoadingTiles(false);
        }, 1500);
      }
    };

    const onSourceData = (e) => {
      if (
        damageSourcesSet.has(e.sourceId) &&
        e.isSourceLoaded &&
        (!map.areTilesLoaded || map.areTilesLoaded())
      ) {
        clearLoading();
      }
    };

    const onIdle = () => {
      clearLoading();
    };

    const onError = (e) => {
      if (e.sourceId && damageSourcesSet.has(e.sourceId)) {
        setTileError('Some damage tiles failed to load.');
        clearLoading();
      }
    };

    if (map.on) {
      map.on('zoom', onZoom);
      map.on('sourcedataloading', onSourceDataLoading);
      map.on('sourcedata', onSourceData);
      map.on('idle', onIdle);
      map.on('error', onError);
    }

    if (typeof map.getZoom === 'function') {
      setMapZoom(map.getZoom());
    }

    return () => {
      if (watchdogTimer) clearTimeout(watchdogTimer);
      if (map.off) {
        map.off('zoom', onZoom);
        map.off('sourcedataloading', onSourceDataLoading);
        map.off('sourcedata', onSourceData);
        map.off('idle', onIdle);
        map.off('error', onError);
      }
    };
  }, [mapRef]);

  return (
    <div className="relative w-full h-[calc(100vh-64px)] min-h-[500px]">
      {/* Map control CSS to position Mapbox controls below TabNavigation */}
      <style>{`
        .mapboxgl-ctrl-top-right {
          top: 64px !important;
        }
        @media (max-width: 640px) {
          .mapboxgl-ctrl-top-right {
            top: 56px !important;
          }
        }
      `}</style>

      {/* Mapbox container */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* View Switcher: bottom-left round buttons */}
      {selectedAid && (
        <DamageViewSwitcher
          activeView={activeView}
          onViewChange={handleViewChange}
          isLoadingTiles={isLoadingTiles}
        />
      )}

      {/* Floating zoom guidance chip */}
      {activeView === DAMAGE_VIEWS.BUILDINGS && mapZoom < BUILDINGS_MIN_ZOOM && (
        <div className="absolute top-16 sm:top-[4.5rem] left-1/2 -translate-x-1/2 z-10 px-3 py-1 bg-slate-900/85 text-white text-xs font-medium rounded-full shadow-md pointer-events-none transition-all">
          Zoom in to see individual buildings
        </div>
      )}
      {activeView === DAMAGE_VIEWS.DENSITY && mapZoom >= 16 && (
        <div className="absolute top-16 sm:top-[4.5rem] left-1/2 -translate-x-1/2 z-10 px-3 py-1 bg-slate-900/85 text-white text-xs font-medium rounded-full shadow-md pointer-events-none transition-all">
          Zoom out to see building density
        </div>
      )}

      {/* Selection detail panel */}
      <DamageDetailPanel
        selectedCell={selectedCell}
        selectedBuilding={selectedBuilding}
        isLoadingBuilding={isLoadingBuilding}
        buildingError={buildingError}
        onClose={() => {
          clearSelection();
          setSelectedCell(null);
          setSelectedBuilding(null);
          setBuildingError(null);
        }}
        onZoomToCell={handleZoomToCell}
      />

      {/* Bottom-right info, totals & legend card */}
      <div
        className={`absolute bottom-6 right-4 z-10 ${
          isCardCollapsed
            ? 'w-auto max-w-[calc(100vw-2rem)]'
            : 'w-72 max-w-[calc(100vw-2rem)] max-h-[55vh] sm:max-h-none overflow-y-auto'
        } rounded-lg bg-white/95 p-3.5 sm:p-4 shadow-lg border border-slate-200/80 backdrop-blur-xs pointer-events-auto`}
      >
        {/* Card header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Damage Assessment</h3>
            {loadedTimestamp && (
              <p className="text-[10px] text-slate-500">Loaded {loadedTimestamp}</p>
            )}
          </div>
          {/* Mobile toggle */}
          <button
            type="button"
            onClick={() => setIsCardCollapsed((prev) => !prev)}
            className="sm:hidden p-1 text-slate-500 hover:text-slate-800"
            aria-label={isCardCollapsed ? 'Expand card' : 'Collapse card'}
          >
            {isCardCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Card body */}
        <div className={`${isCardCollapsed ? 'hidden sm:block' : 'block'} mt-2.5 space-y-3`}>
          {/* Status indicators */}
          {isLoadingTiles && (
            <div className="text-[11px] font-medium text-teal-700 bg-teal-50 px-2 py-0.5 rounded flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-600 animate-ping" />
              <span>Updating...</span>
            </div>
          )}

          {tileError && (
            <div className="text-xs text-red-700 bg-red-50 p-2 rounded border border-red-200 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{tileError}</span>
            </div>
          )}

          {/* Assessment request error */}
          {assessmentsError && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-800 space-y-2">
              <div className="flex items-center gap-1.5 font-medium">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>Failed to load assessments</span>
              </div>
              <button
                type="button"
                onClick={fetchAssessments}
                className="w-full flex items-center justify-center gap-1 py-1 px-2 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retry</span>
              </button>
            </div>
          )}

          {/* Empty assessment list */}
          {!assessmentsLoading && !assessmentsError && assessments.length === 0 && (
            <p className="text-xs text-slate-600 py-2">
              No damage assessment has been published yet.
            </p>
          )}

          {/* Assessment selector & totals */}
          {selectedAssessment && (
            <>
              {/* Selector */}
              <div>
                <label
                  htmlFor="assessment-select"
                  className="block text-[11px] font-medium text-slate-500 mb-1"
                >
                  Event & AOI
                </label>
                <select
                  id="assessment-select"
                  value={selectedAid || ''}
                  onChange={(e) => handleAssessmentChange(e.target.value)}
                  className="w-full rounded border border-slate-300 bg-white py-1.5 px-2 text-xs text-slate-800 shadow-2xs focus:border-[#324755] focus:outline-none"
                >
                  {assessments.map((a) => (
                    <option key={a.assessment_id} value={a.assessment_id}>
                      {a.event_name} - {a.aoi_name}{' '}
                      {a.imagery_date ? `(${a.imagery_date})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Synthetic / Test Data Banner */}
              {selectedAssessment.data_source !== 'real' && (
                <div className="py-1 px-2 bg-amber-50 border border-amber-300 text-amber-900 rounded text-[11px] font-medium flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span>Test Dataset ({selectedAssessment.data_source || 'synthetic'})</span>
                </div>
              )}

              {/* Assessment Totals */}
              <div className="bg-slate-50 p-2.5 rounded border border-slate-200/80 text-xs">
                <div className="flex justify-between items-baseline font-semibold text-slate-800 mb-1.5">
                  <span>Total Structures:</span>
                  <span>{selectedAssessment.n_buildings?.toLocaleString() ?? 0}</span>
                </div>
                <div className="flex justify-between items-baseline text-slate-600 mb-2">
                  <span>Assessed:</span>
                  <span>{selectedAssessment.n_assessed?.toLocaleString() ?? 0}</span>
                </div>

                <div className="pt-1.5 border-t border-slate-200/60 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
                  <div className="flex justify-between text-emerald-800">
                    <span>Undamaged:</span>
                    <span className="font-semibold">{selectedAssessment.c0 ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-yellow-800">
                    <span>Part. Roof:</span>
                    <span className="font-semibold">{selectedAssessment.c1 ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-orange-800">
                    <span>Total Roof:</span>
                    <span className="font-semibold">{selectedAssessment.c2 ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-red-800">
                    <span>Part. Struct:</span>
                    <span className="font-semibold">{selectedAssessment.c3 ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-rose-950 col-span-2">
                    <span>Total Collapse:</span>
                    <span className="font-semibold">{selectedAssessment.c4 ?? 0}</span>
                  </div>
                </div>
              </div>

              {/* Info text */}
              <p className="text-[10px] text-slate-500 leading-normal">
                Each hexagon shows its most common damage class. Faint hexagons have &lt;5 assessed buildings.
              </p>

              {/* Legend */}
              <DamageLegend
                view={activeView}
                metric={activeMetric}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
