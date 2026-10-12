/**
 * @fileoverview Hook for hazard layer map click: point popup and county popup with subtype breakdown.
 */

import { useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import { getWeatherHazardByCounty } from '../services/hazardService';
import { getSubtypeDisplayName } from '../config/hazardConfig';
import {
  getAllHazardLayerIds,
  formatHazardPopupContent,
  HAZARD_LAYER_IDS,
} from '../utils/hazardMapUtils';
import { getOptimalAnchor } from '../utils/osaUtils';
import { isMapAlive } from '../utils/mapUtils';
import { trackMapInteraction } from '../utils/googleAnalytics.js';

/**
 * @param {React.RefObject} mapRef
 * @param {boolean} isInitialized - hazardLayers.isInitialized
 * @param {boolean} isMobile
 * @param {Function} setPreviousMapView - state setter for "Back to previous view"
 */
export function useHazardMapClick(mapRef, isInitialized, isMobile, setPreviousMapView) {
  useEffect(() => {
    if (!mapRef?.current || !isInitialized) return;

    const map = mapRef.current;
    if (!isMapAlive(map)) return;

    const hazardLayerIds = getAllHazardLayerIds();
    const pointLayerIds = [HAZARD_LAYER_IDS.pointsCircle, HAZARD_LAYER_IDS.roadClosureLine];
    const countyLayerIds = [
      HAZARD_LAYER_IDS.countyFill,
      HAZARD_LAYER_IDS.countyOutline,
      HAZARD_LAYER_IDS.countyCountLabel,
    ];

    const getBoundsFromFeature = (feature) => {
      const geom = feature?.geometry;
      if (!geom || !geom.coordinates) return null;
      let coords = [];
      if (geom.type === 'Polygon') {
        coords = geom.coordinates[0] || [];
      } else if (geom.type === 'MultiPolygon') {
        geom.coordinates.forEach((poly) => {
          coords = coords.concat(poly[0] || []);
        });
      }
      if (coords.length === 0) return null;
      const lngs = coords.map((c) => c[0]);
      const lats = coords.map((c) => c[1]);
      return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
    };

    const buildCountyPopupHtml = (countyName, rows, bounds) => {
      const name = countyName || 'County';
      const zoomButton =
        bounds != null
          ? `<button type="button" class="zoom-to-county-btn mt-3 w-full py-2 px-3 text-xs font-semibold text-[#324755] bg-gray-100 hover:bg-gray-200 rounded border border-gray-300 transition-colors" data-bounds="${bounds.join(',')}">Zoom to county</button>`
          : '';
      if (!rows || rows.length === 0) {
        return `<div class="p-4 min-w-[240px]"><p class="font-bold text-sm text-[#324755] mb-2">${name}</p><p class="text-xs text-gray-500">No subtype data.</p>${zoomButton}</div>`;
      }
      const tableRows = rows
        .map((r) => {
          const subDisplay = getSubtypeDisplayName(r.subtype, r.type);
          const count = r.alert_count != null ? Number(r.alert_count).toLocaleString() : '0';
          return `<tr><td class="text-xs text-gray-700 pr-3">${subDisplay}</td><td class="text-xs font-semibold text-amber-600 text-right">${count}</td></tr>`;
        })
        .join('');
      return `
                <div class="p-4 min-w-[260px]">
                    <p class="font-bold text-sm text-[#324755] mb-3 pb-2 border-b border-gray-200">${name}</p>
                    <table class="w-full text-left border-collapse">
                        <thead><tr><th class="text-xs font-semibold text-gray-600 pb-1">Subtype</th><th class="text-xs font-semibold text-gray-600 pb-1 text-right"># of Alerts</th></tr></thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                    ${zoomButton}
                </div>`;
    };

    const panIfNearEdge = (e) => {
      const container = map.getContainer();
      const width = container.getBoundingClientRect().width;
      const x = e.point.x;
      const edgeFraction = 0.28;
      const targetFraction = 0.38;
      let panX = 0;
      if (x < width * edgeFraction) {
        panX = width * targetFraction - x;
      } else if (x > width * (1 - edgeFraction)) {
        panX = width * (1 - targetFraction) - x;
      }
      const maxPan = width * 0.4;
      panX = Math.max(-maxPan, Math.min(maxPan, panX));
      if (Math.abs(panX) > 8) {
        const center = map.getCenter();
        const centerPoint = map.project(center);
        const newCenter = map.unproject([centerPoint.x - panX, centerPoint.y]);
        map.jumpTo({ center: newCenter });
      }
    };

    const handleMapClick = (e) => {
      const tapLngLat = map.unproject(e.point);
      const popupMaxWidth = isMobile ? '90vw' : '400px';
      const pointFeatures = map.queryRenderedFeatures(e.point, { layers: pointLayerIds });
      const countyFeatures = map.queryRenderedFeatures(e.point, { layers: countyLayerIds });
      if (pointFeatures.length > 0) {
        const feature = pointFeatures[0];
        trackMapInteraction({
          action: 'hazard_point_click',
          tab: 'osa',
          layer_name: 'road_hazards',
        });
        const props = feature.properties || {};
        const popupLngLat =
          feature.geometry?.coordinates?.length >= 2
            ? feature.geometry.coordinates.slice(0, 2)
            : tapLngLat;
        const popup = new mapboxgl.Popup({
          closeButton: true,
          closeOnClick: true,
          className: 'osa-popup',
          anchor: getOptimalAnchor(popupLngLat, map, { isMobile }),
          offset: isMobile ? 15 : 10,
          maxWidth: popupMaxWidth,
        })
          .setLngLat(popupLngLat)
          .addTo(map);
        popup.setHTML(formatHazardPopupContent(props, 'point'));
        panIfNearEdge(e);
        return;
      }
      if (countyFeatures.length === 0) return;

      const feature = countyFeatures[0];
      const props = feature.properties || {};
      trackMapInteraction({
        action: 'hazard_county_click',
        tab: 'osa',
        layer_name: 'road_hazards',
      });
      const countyName = props.county_name ?? props.CountyName ?? '';
      const countyBounds = getBoundsFromFeature(feature);
      const popup = new mapboxgl.Popup({
        closeButton: true,
        closeOnClick: true,
        className: 'osa-popup',
        anchor: getOptimalAnchor(tapLngLat, map, { isMobile }),
        offset: isMobile ? 15 : 10,
        maxWidth: popupMaxWidth,
      })
        .setLngLat(tapLngLat)
        .addTo(map);
      popup.setHTML(
        '<div class="p-4 min-w-[200px]"><p class="text-sm text-gray-500">Loading...</p></div>'
      );
      const setCountyContent = (name, rows) => {
        popup.setHTML(buildCountyPopupHtml(name || countyName, rows, countyBounds));
        const el = popup.getElement();
        const zoomBtn = el?.querySelector('.zoom-to-county-btn');
        if (zoomBtn && countyBounds && countyBounds.length === 4 && setPreviousMapView) {
          zoomBtn.addEventListener('click', () => {
            const c = map.getCenter();
            setPreviousMapView({
              center: [c.lng, c.lat],
              zoom: map.getZoom(),
              bearing: map.getBearing(),
              pitch: map.getPitch(),
            });
            map.fitBounds(
              [
                [countyBounds[0], countyBounds[1]],
                [countyBounds[2], countyBounds[3]],
              ],
              {
                padding: 40,
                maxZoom: 12,
                duration: 600,
              }
            );
            popup.remove();
          });
        }
      };
      getWeatherHazardByCounty(countyName)
        .then(({ county_name: name, rows }) => {
          setCountyContent(name || countyName, rows);
        })
        .catch(() => {
          setCountyContent(countyName, []);
        });
      panIfNearEdge(e);
    };

    const handleMouseEnter = () => {
      map.getCanvas().style.cursor = 'pointer';
    };
    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = '';
    };

    map.on('click', handleMapClick);
    hazardLayerIds.forEach((layerId) => {
      if (map.getLayer(layerId)) {
        map.on('mouseenter', layerId, handleMouseEnter);
        map.on('mouseleave', layerId, handleMouseLeave);
      }
    });

    return () => {
      if (!isMapAlive(map)) return;
      map.off('click', handleMapClick);
      hazardLayerIds.forEach((layerId) => {
        if (map.getLayer(layerId)) {
          map.off('mouseenter', layerId, handleMouseEnter);
          map.off('mouseleave', layerId, handleMouseLeave);
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: avoid remounting map/geometry layers
  }, [isInitialized, isMobile, setPreviousMapView]);
}
