/**
 * @fileoverview Baron rainfall grid hex click/hover and popup.
 */

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { getMapPopupOffset, getOptimalAnchor } from '../utils/osaUtils';
import { MAP_UI_TOP_PADDING } from '../config/mapConfig';
import { LAYER_CONFIG, BARON_RAINFALL_TILE_LAYER_ID } from '../config/baronRainfallGridLayerConfig';
import { buildBaronRainfallGridPopupHtml } from '../utils/baronRainfallGridUtils';
import { trackMapInteraction } from '../utils/googleAnalytics.js';

const BARON_LEVELS = [6, 7, 8];

function levelFromLayerId(layerId) {
  const m = String(layerId || '').match(/^baron-tile-hex-l(\d+)/);
  return m ? Number(m[1]) : 6;
}

/**
 * @param {React.RefObject<import('mapbox-gl').Map|null>} mapRef
 * @param {boolean} mapReady
 * @param {boolean} isMobile
 * @param {number} hexLayersGeneration
 */
export function useBaronRainfallGridHexInteractions(
  mapRef,
  mapReady,
  isMobile,
  hexLayersGeneration = 0
) {
  const activePopupRef = useRef(null);

  useEffect(() => {
    const map = mapRef?.current;
    if (!map || !mapReady) return;

    const config = LAYER_CONFIG[BARON_RAINFALL_TILE_LAYER_ID];
    const levels = config.levels || BARON_LEVELS;

    const handlers = [];

    levels.forEach((level) => {
      const layerId = `baron-tile-hex-l${level}`;
      if (!map.getLayer(layerId)) return;

      const onMouseEnter = () => {
        map.getCanvas().style.cursor = 'pointer';
      };
      const onMouseLeave = () => {
        map.getCanvas().style.cursor = '';
      };
      const onClick = (e) => {
        e.originalEvent?.stopPropagation?.();
        const feature = e.features?.[0];
        if (!feature) return;
        trackMapInteraction({
          action: 'hex_click',
          tab: 'active-weather-events-beta',
          layer_name: 'baron_rainfall',
        });

        if (activePopupRef.current) {
          activePopupRef.current.remove();
          activePopupRef.current = null;
        }

        const props = feature.properties || {};
        const html = buildBaronRainfallGridPopupHtml(props, levelFromLayerId(layerId));
        const anchor = getOptimalAnchor(e.lngLat, map, {
          isMobile,
          popupWidth: isMobile ? undefined : 340,
          popupHeight: 420,
          topReserve: MAP_UI_TOP_PADDING + 8,
        });
        const popup = new mapboxgl.Popup({
          closeButton: true,
          closeOnClick: true,
          maxWidth: isMobile ? 'min(340px, calc(100vw - 32px))' : '340px',
          anchor,
          offset: getMapPopupOffset(anchor, { topReserve: MAP_UI_TOP_PADDING + 8 }),
          className: 'hmed-popup',
        })
          .setLngLat(e.lngLat)
          .setHTML(html)
          .addTo(map);

        activePopupRef.current = popup;
        popup.on('close', () => {
          if (activePopupRef.current === popup) activePopupRef.current = null;
        });
      };

      map.on('click', layerId, onClick);
      map.on('mouseenter', layerId, onMouseEnter);
      map.on('mouseleave', layerId, onMouseLeave);
      handlers.push({ layerId, onClick, onMouseEnter, onMouseLeave });
    });

    return () => {
      handlers.forEach(({ layerId, onClick, onMouseEnter, onMouseLeave }) => {
        try {
          map.off('click', layerId, onClick);
          map.off('mouseenter', layerId, onMouseEnter);
          map.off('mouseleave', layerId, onMouseLeave);
        } catch {
          /* ignore */
        }
      });
      if (activePopupRef.current) {
        activePopupRef.current.remove();
        activePopupRef.current = null;
      }
    };
  }, [mapRef, mapReady, isMobile, hexLayersGeneration]);
}
