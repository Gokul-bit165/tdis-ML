import React, { useEffect, useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { ChevronDown } from 'lucide-react';
import {
  getSubtypeDisplayName,
  getEnabledCategories,
  HAZARD_TILE_LAYERS,
  HAZARD_ZOOM_THRESHOLDS,
} from '../../config/hazardConfig';
import { HAZARD_SOURCE_IDS } from '../../utils/hazardMapUtils';

/** Zoom at or below this level is considered "statewide"; total is only updated in this range so it does not change when user zooms to a county. */
const STATEWIDE_ZOOM_MAX = HAZARD_ZOOM_THRESHOLDS.countyTotal.max;

/**
 * Scrollable Alert Types legend for Road Weather & Hazard layer.
 * Owns its scroll ref and "more below" overflow state (Phase 6).
 * Total alerts is computed only at statewide zoom (county view) and is not updated when zoomed in (e.g. after "Zoom to county").
 */
export function AlertTypesLegend({ mapRef, isHazardLayerReady, onTotalAlertsChange }) {
  const scrollRef = useRef(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [totalAlerts, setTotalAlerts] = useState(0);

  useEffect(() => {
    const check = () => {
      const el = scrollRef.current;
      setHasOverflow(!!(el && el.scrollHeight > el.clientHeight));
    };
    const t = setTimeout(check, 50);
    window.addEventListener('resize', check);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', check);
    };
  }, []);

  useEffect(() => {
    if (!mapRef?.current || !isHazardLayerReady) {
      setTotalAlerts(0);
      return;
    }

    const map = mapRef.current;
    let rafId = null;

    const computeTotalFromTiles = () => {
      if (!map.getSource(HAZARD_SOURCE_IDS.countyTotal)) return;
      const zoom = map.getZoom();
      if (zoom > STATEWIDE_ZOOM_MAX) {
        return;
      }
      const features = map.querySourceFeatures(HAZARD_SOURCE_IDS.countyTotal, {
        sourceLayer: HAZARD_TILE_LAYERS.countyTotal,
      });
      const seen = new Set();
      let total = 0;
      features.forEach((feature) => {
        const featureProps = feature?.properties || {};
        const key =
          featureProps.county_name ||
          featureProps.CountyName ||
          featureProps.COUNTY ||
          featureProps.NAME ||
          featureProps.FIPS;
        if (key && seen.has(key)) return;
        if (key) seen.add(key);
        total += Number(featureProps.total_alert_count || featureProps.alert_count || 0) || 0;
      });
      setTotalAlerts(total);
    };

    const handleIdle = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(computeTotalFromTiles);
    };

    map.on('idle', handleIdle);
    handleIdle();

    return () => {
      map.off('idle', handleIdle);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [mapRef, isHazardLayerReady]);

  useEffect(() => {
    if (typeof onTotalAlertsChange === 'function') {
      onTotalAlertsChange(totalAlerts);
    }
  }, [totalAlerts, onTotalAlertsChange]);

  const scrollDown = () => {
    const el = scrollRef.current;
    if (el) el.scrollBy({ top: el.clientHeight, behavior: 'smooth' });
  };

  return (
    <div className="pt-3 border-t border-gray-200">
      <h3 className="block text-xs font-semibold text-gray-700 mb-2">Alert Types</h3>
      <div
        ref={scrollRef}
        className="space-y-1 overflow-y-auto pr-1"
        style={{
          maxHeight: '12rem',
          scrollbarWidth: 'thin',
          scrollbarColor: '#cbd5e1 #f1f5f9',
        }}
      >
        {Object.values(getEnabledCategories()).flatMap((cat) =>
          cat.subtypes.map((sub) => (
            <div key={sub.id} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-sm flex-shrink-0"
                style={{ backgroundColor: sub.color, opacity: 0.9 }}
              />
              <span className="text-[10px] text-gray-600">
                {getSubtypeDisplayName(sub.id, cat.typeField)}
              </span>
            </div>
          ))
        )}
      </div>
      {hasOverflow && (
        <button
          type="button"
          onClick={scrollDown}
          className="flex items-center justify-center w-full mt-1.5 p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
          title="Scroll down"
          aria-label="Scroll down to see more alert types"
        >
          <ChevronDown className="w-4 h-4 shrink-0" />
        </button>
      )}
    </div>
  );
}

AlertTypesLegend.propTypes = {
  mapRef: PropTypes.shape({ current: PropTypes.any }),
  isHazardLayerReady: PropTypes.bool,
  onTotalAlertsChange: PropTypes.func,
};

AlertTypesLegend.defaultProps = {
  mapRef: { current: null },
  isHazardLayerReady: false,
  onTotalAlertsChange: undefined,
};
