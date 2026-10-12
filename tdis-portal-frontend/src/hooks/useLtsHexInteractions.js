/**
 * @fileoverview LTS Flash Flood hex layer click/hover and popup.
 */

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { getMapPopupOffset, getOptimalAnchor } from '../utils/osaUtils';
import { MAP_UI_TOP_PADDING } from '../config/mapConfig';

const LTS_POPUP_HEIGHT = 520;
const LTS_POPUP_WIDTH = 400;
import {
  LAYER_CONFIG,
  LTS_LAYER_ID,
  getLayerPropertyName,
} from '../config/ltsFlashFloodLayerConfig';
import { HMED_CONFIG } from '../config/mapConfig';
import { buildLtsHexPopupHtml } from '../utils/ltsHexPopupUtils';
import { trackMapInteraction } from '../utils/googleAnalytics.js';

const ALL_LEVELS = [6, 7, 8, 9, 10];
const hourOptions = HMED_CONFIG.hourOptions;

function hmHexDbg() {
  // Intentionally silent — verbose hex traces stay out of the browser console.
}

function formatValue(val) {
  if (val === null || isNaN(val)) return 'N/A';
  return val.toFixed(3);
}

function getIntensityLevel(val) {
  if (val === null || isNaN(val)) return 'N/A';
  if (val > 1.5) return 'Extreme';
  if (val > 1.0) return 'Major';
  if (val > 0.5) return 'Significant';
  if (val > 0.25) return 'Elevated';
  return 'Minimal';
}

function getIntensityColor(val) {
  if (val === null || isNaN(val)) return 'text-gray-500';
  if (val > 1.5) return 'text-red-800';
  if (val > 1.0) return 'text-red-700';
  if (val > 0.5) return 'text-orange-700';
  if (val > 0.25) return 'text-yellow-700';
  return 'text-blue-700';
}

/**
 * @param {React.RefObject} mapRef
 * @param {boolean} mapReady
 * @param {number} selectedHours
 * @param {boolean} isMobile
 * @param {number} [hexLayersGeneration] - increment when map hex layers are rebuilt; re-attaches handlers
 */
export function useLtsHexInteractions(
  mapRef,
  mapReady,
  selectedHours,
  isMobile,
  hexLayersGeneration = 0
) {
  const selectedHoursRef = useRef(selectedHours);
  const activePopupRef = useRef(null);

  useEffect(() => {
    selectedHoursRef.current = selectedHours;
  }, [selectedHours]);

  useEffect(() => {
    const map = mapRef?.current;
    if (!map || !mapReady) {
      hmHexDbg('interactions skip', { hasMap: !!map, mapReady });
      return;
    }

    const layer = LAYER_CONFIG[LTS_LAYER_ID];
    const levels = layer.levels || ALL_LEVELS;

    const clickHandlers = [];
    const mouseEnterHandlers = [];
    const mouseLeaveHandlers = [];

    let attached = 0;
    const missing = [];
    levels.forEach((level) => {
      const layerId = `hex-l${level}`;
      if (!map.getLayer(layerId)) {
        missing.push(layerId);
        return;
      }
      const interactId = layerId;
      attached += 1;

      const onMouseEnter = () => {
        map.getCanvas().style.cursor = 'pointer';
      };
      const onMouseLeave = () => {
        map.getCanvas().style.cursor = '';
      };
      const onClick = (e) => {
        if (e?.originalEvent) {
          e.originalEvent.cancelBubble = true;
          if (typeof e.originalEvent.stopPropagation === 'function') {
            e.originalEvent.stopPropagation();
          }
        }
        const props = e.features[0]?.properties || {};
        const currentHours = selectedHoursRef.current;
        const layerConfig = LAYER_CONFIG[LTS_LAYER_ID];

        const isLts = layerConfig.hasTimeWindow === false;
        trackMapInteraction({
          action: 'hex_click',
          tab: isLts ? 'lts-flash-flood' : 'hmed',
          layer_name: layerConfig.id,
        });
        hmHexDbg('hex click', {
          layerId,
          h3Level: level,
          isLts,
          propsKeys: Object.keys(props),
          sample: isLts
            ? {
                lts_level: props.lts_level,
                lts_label: props.lts_label,
                peak_start_time: props.peak_start_time,
                peak_end_time: props.peak_end_time,
              }
            : {},
        });
        const optimalAnchor = getOptimalAnchor(e.lngLat, map, {
          isMobile,
          popupHeight: isLts ? LTS_POPUP_HEIGHT : 400,
          popupWidth: isLts ? LTS_POPUP_WIDTH : 320,
          topReserve: MAP_UI_TOP_PADDING + 8,
        });
        const popupOffset = getMapPopupOffset(optimalAnchor, {
          topReserve: MAP_UI_TOP_PADDING + 8,
        });
        if (activePopupRef.current) {
          activePopupRef.current.remove();
          activePopupRef.current = null;
        }

        let popupHtml;
        if (isLts) {
          popupHtml = buildLtsHexPopupHtml(props, level, {
            layerTitle: 'Impact Forecast',
          });
        } else {
          const hourValues = {};
          hourOptions.forEach((hours) => {
            const propertyName = getLayerPropertyName(layerConfig, hours, undefined, level);
            const valueRaw = props[propertyName] ?? null;
            hourValues[hours] = valueRaw !== null ? Number(valueRaw) : null;
          });
          popupHtml = `
                        <div class="p-4 min-w-[280px]">
                            <div class="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200">
                                <div class="w-2 h-2 rounded-full" style="background-color: ${layerConfig.color}"></div>
                                <p class="font-bold text-sm text-[#324755]">${layerConfig.name} HSI Details</p>
                            </div>
                            <div class="space-y-2.5">
                                <div class="mb-3">
                                    <p class="text-xs font-semibold text-gray-700 mb-2">${layerConfig.name} Values by Time Window:</p>
                                    <div class="space-y-1.5">
                                        ${hourOptions
                                          .map((hours) => {
                                            const value = hourValues[hours];
                                            const isCurrent = hours === currentHours;
                                            const intensity = getIntensityLevel(value);
                                            const colorClass = getIntensityColor(value);
                                            return `
                                                <div class="flex items-center justify-between p-2 rounded-lg border ${isCurrent ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}">
                                                    <div class="flex items-center gap-2">
                                                        <span class="text-xs font-semibold text-gray-700">${hours}h:</span>
                                                        ${isCurrent ? '<span class="text-[10px] bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded font-semibold">Current</span>' : ''}
                                                    </div>
                                                    <div class="flex items-center gap-2">
                                                        <span class="text-sm font-bold ${colorClass}">${formatValue(value)}</span>
                                                        <span class="text-[10px] font-medium text-gray-600">${intensity}</span>
                                                    </div>
                                                </div>
                                            `;
                                          })
                                          .join('')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
        }

        const popup = new mapboxgl.Popup({
          closeButton: true,
          closeOnClick: true,
          className: 'hmed-popup',
          anchor: optimalAnchor,
          offset: popupOffset,
          maxWidth: '420px',
        })
          .setLngLat(e.lngLat)
          .setHTML(popupHtml)
          .addTo(map);

        popup.on('open', () => {
          const popupElement =
            popup.getElement?.() ?? document.querySelector('.mapboxgl-popup.hmed-popup');
          if (popupElement) {
            popupElement.style.zIndex = '9999';
            const tip = popupElement.querySelector('.mapboxgl-popup-tip');
            if (tip) tip.style.zIndex = '9999';
          }
          const popupContent = popupElement?.querySelector('.mapboxgl-popup-content');
          if (popupContent) {
            popupContent.style.zIndex = '9999';
            popupContent.style.maxHeight = 'min(70vh, 560px)';
            popupContent.style.overflowY = 'auto';
          }
          activePopupRef.current = popup;
        });
        popup.on('close', () => {
          if (activePopupRef.current === popup) activePopupRef.current = null;
        });
      };

      map.on('mouseenter', interactId, onMouseEnter);
      map.on('mouseleave', interactId, onMouseLeave);
      map.on('click', interactId, onClick);
      mouseEnterHandlers.push({ layerId: interactId, handler: onMouseEnter });
      mouseLeaveHandlers.push({ layerId: interactId, handler: onMouseLeave });
      clickHandlers.push({ layerId: interactId, handler: onClick });
    });

    hmHexDbg('click/hover handlers attached', {
      layer: LTS_LAYER_ID,
      hexLayersGeneration,
      attached,
      missingLayerIds: missing,
      levelsExpected: levels,
    });

    return () => {
      try {
        if (!map || !map.getStyle()) return;
      } catch {
        return;
      }
      mouseEnterHandlers.forEach(({ layerId, handler }) => {
        try {
          if (map.getLayer(layerId)) map.off('mouseenter', layerId, handler);
        } catch {
          /* ignore */
        }
      });
      mouseLeaveHandlers.forEach(({ layerId, handler }) => {
        try {
          if (map.getLayer(layerId)) map.off('mouseleave', layerId, handler);
        } catch {
          /* ignore */
        }
      });
      clickHandlers.forEach(({ layerId, handler }) => {
        try {
          if (map.getLayer(layerId)) map.off('click', layerId, handler);
        } catch {
          /* ignore */
        }
      });
      try {
        if (activePopupRef.current) {
          activePopupRef.current.remove();
          activePopupRef.current = null;
        }
      } catch {
        /* ignore */
      }
    };
  }, [mapRef, mapReady, isMobile, hexLayersGeneration]);
}
