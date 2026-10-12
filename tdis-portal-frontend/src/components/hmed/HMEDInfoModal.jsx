/**
 * @fileoverview HMED info modal: About HSI, How to read, Note, What you'll see, Notes & caveats.
 */

import React from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MotionDiv = motion.div;

/**
 * @param {boolean} show
 * @param {Function} onClose - () => void
 * @param {Object} currentLayer - LAYER_CONFIG[selectedLayer]
 */
export function HMEDInfoModal({ show, onClose, currentLayer }) {
  const isFloodHub = currentLayer?.floodHubGauge === true;
  const isLts = currentLayer?.hasTimeWindow === false && !isFloodHub;

  /**
   * No backdrop-filter blur: blurring a full-screen layer over Mapbox GL forces very expensive
   * GPU compositing and often makes the page feel frozen / the cursor laggy.
   * Portal to document.body avoids parent transform/stacking quirks that break fixed overlays.
   */
  const modalTree = (
    <AnimatePresence>
      {show && (
        <>
          <MotionDiv
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClose();
              }
            }}
            role="button"
            tabIndex={0}
            aria-label="Close modal"
            className="fixed inset-0 bg-black/55 z-[200]"
            style={{ pointerEvents: 'auto' }}
          />
          <MotionDiv
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ pointerEvents: 'none' }}
          >
            <div
              className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col"
              style={{ pointerEvents: 'auto' }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              tabIndex={0}
            >
              <div
                className={`flex items-center justify-between p-5 pb-4 border-b border-gray-200 ${
                  isFloodHub
                    ? 'bg-gradient-to-r from-sky-800 to-cyan-950'
                    : isLts
                      ? 'bg-gradient-to-r from-blue-900 to-indigo-950'
                      : 'bg-gradient-to-r from-[#324755] to-[#334755]'
                }`}
              >
                <div className="flex items-center gap-3">
                  {React.createElement(currentLayer.icon, {
                    className: 'w-5 h-5',
                    style: { color: 'white' },
                  })}
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      {isFloodHub
                        ? `${currentLayer.name} — Information`
                        : isLts
                          ? `${currentLayer.name} — Information`
                          : `${currentLayer.name} HSI Information`}
                    </h2>
                    <p className="text-xs text-white/80">
                      {isFloodHub
                        ? (currentLayer.panelSubtitle ?? 'Powered by Google Flood Hub')
                        : isLts
                          ? 'Localized Threat Severity (LTS)'
                          : 'Hazard Severity Outlook'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-white/20 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 p-5 space-y-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                {isFloodHub ? (
                  <>
                    <div className="bg-gradient-to-r from-sky-50 to-cyan-50 border-l-4 border-sky-600 pl-4 py-3 rounded-r">
                      <p className="font-semibold text-[#324755] mb-2 text-sm">About this layer</p>
                      <p className="text-xs text-[#324755]/90 leading-relaxed">
                        {currentLayer.description}
                      </p>
                    </div>
                    <div className="bg-white border border-sky-100 rounded-lg pl-4 py-3 shadow-sm">
                      <p className="font-semibold text-[#324755] mb-1.5 text-sm">
                        How tiers are colored
                      </p>
                      <p className="text-xs text-[#324755]/90 leading-relaxed">
                        Each H3 cell is shaded from the{' '}
                        <span className="font-semibold">forecast peak</span> value (
                        <span className="font-semibold">predicted_peak</span>) compared to the
                        gauge&apos;s warning, danger, and extreme thresholds supplied with the
                        dataset. <span className="font-semibold">Normal</span> means the peak is
                        below the warning threshold; higher tiers mean the forecast peak crosses
                        successively higher thresholds.
                      </p>
                    </div>
                    <div className="bg-violet-50/80 border border-violet-100 rounded-lg pl-4 py-3 shadow-sm">
                      <p className="font-semibold text-[#324755] mb-1.5 text-sm">
                        Supplemental map overlays
                      </p>
                      <p className="text-xs text-[#324755]/90 leading-relaxed">
                        Riverine <span className="font-semibold">Flood Hub</span> gauge hexes and
                        the expected-severity legend are in the main{' '}
                        <span className="font-semibold">HMED</span> controls panel. Use the{' '}
                        <span className="font-semibold">Flood Hub overlays</span> widget
                        (bottom-left on desktop, <span className="font-semibold">Overlays</span> on
                        mobile) for <span className="font-semibold">significant events</span>,{' '}
                        <span className="font-semibold">inundation probability</span> (status
                        polygons with opacity from probability fields when present), and{' '}
                        <span className="font-semibold">Urban Flash Flood</span> (24-hour urban
                        likelihood, beta). Some overlays still use in-browser GeoJSON demo sample
                        data until TDIS Gold tiles exist for each sub-product; Urban Flash Flood
                        uses live vector tiles from the tile server. The gauge side panel shows
                        hydrograph, NWPS link, and quality flags when properties are available or
                        when demo fallbacks apply.
                      </p>
                    </div>
                    <div className="bg-amber-50 border-l-4 border-amber-500 pl-4 py-3 rounded-r">
                      <p className="text-xs text-amber-950 leading-relaxed">
                        <span className="font-bold">Important:</span> Data are provided for
                        situational awareness only. They are not official flood warnings, watches,
                        or evacuation guidance. Always follow the National Weather Service and local
                        emergency officials.
                      </p>
                    </div>
                    <div className="bg-sky-50/80 border-l-4 border-sky-500 pl-4 py-3 rounded-r">
                      <p className="text-xs text-sky-950 leading-relaxed">
                        <span className="font-bold">Attribution:</span> Google Flood Hub material is
                        used under applicable license terms (e.g. CC BY where noted). Virtual gauges
                        (IDs such as <span className="font-mono">hybas_*</span>) represent
                        basin-linked forecast points, not necessarily a single physical sensor.
                      </p>
                    </div>
                    <div className="border-l-4 border-gray-300 pl-4 py-3 rounded-r bg-gray-50/80">
                      <p className="font-semibold text-[#324755] mb-2 text-sm">
                        Documentation and resources
                      </p>
                      <ul className="space-y-2 text-xs text-[#324755]/90">
                        {(currentLayer.documentationLinks || []).map((link) => (
                          <li key={link.href}>
                            <a
                              href={link.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-800 font-semibold underline underline-offset-2 hover:text-blue-950"
                            >
                              {link.label}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                ) : isLts ? (
                  <>
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-600 pl-4 py-3 rounded-r">
                      <p className="font-semibold text-[#324755] mb-2 text-sm">About this layer</p>
                      <p className="text-xs text-[#324755]/90 leading-relaxed">
                        {currentLayer.description}
                      </p>
                    </div>
                    <div className="bg-white border border-blue-100 rounded-lg pl-4 py-3 shadow-sm">
                      <p className="font-semibold text-[#324755] mb-1.5 text-sm">
                        24-hour forecast window
                      </p>
                      <p className="text-xs text-[#324755]/90 leading-relaxed">
                        LTS is tied to a <span className="font-semibold">24-hour</span> outlook:
                        severity and potential-impact summaries describe threat and impact{' '}
                        <span className="font-semibold">forecasted</span> for that window, not past
                        or real-time observed events.
                      </p>
                    </div>
                    <div className="bg-blue-50/50 border-l-4 border-blue-500 pl-4 py-3 rounded-r">
                      <p className="font-semibold text-[#324755] mb-2 text-sm">
                        Anticipatory planning and action
                      </p>
                      <p className="text-xs text-[#324755]/90 leading-relaxed mb-2">
                        Use TIF/LTS to get ahead of developing flash-flood risk—staging resources,
                        briefing teams, and coordinating with partners—before impacts unfold. It
                        supports <span className="font-semibold">early</span> decisions; it is not a
                        damage assessment and does not show actual losses.
                      </p>
                    </div>
                    <div className="bg-indigo-50/50 border-l-4 border-indigo-500 pl-4 py-3 rounded-r">
                      <p className="font-semibold text-[#324755] mb-2 text-sm">
                        Hotspot severity (two tiers on map)
                      </p>
                      <ul className="space-y-1.5 text-xs text-[#324755]/90">
                        {(currentLayer.severityLevelsUi || currentLayer.severityLevels || []).map(
                          (s) => (
                            <li key={s.value} className="flex items-start gap-2">
                              <span
                                className="w-3 h-3 rounded-full shrink-0 mt-0.5 border border-white shadow-sm"
                                style={{ backgroundColor: s.color }}
                              />
                              <span>
                                <span className="font-semibold">
                                  {s.value} — {s.label}:
                                </span>{' '}
                                Higher level indicates greater localized flash-flood threat during
                                the <span className="font-semibold">24-hour</span> forecast window.
                              </span>
                            </li>
                          )
                        )}
                      </ul>
                      <p className="text-[10px] text-gray-600 mt-2 leading-snug">
                        LTS is tuned to surface flash-flood hotspots: only levels{' '}
                        <span className="font-semibold">4</span> and{' '}
                        <span className="font-semibold">5</span> are drawn. Historical data or tiles
                        may still include <span className="font-semibold">3</span> (Moderate) or{' '}
                        <span className="font-semibold">1–2</span> (legacy); those are not shown on
                        this map.
                      </p>
                    </div>
                    <div className="bg-amber-50 border-l-4 border-amber-500 pl-4 py-3 rounded-r">
                      <p className="text-xs text-amber-950 leading-relaxed">
                        <span className="font-bold">Important:</span> LTS reflects{' '}
                        <span className="font-semibold">forecasted</span> threat and potential
                        impact, not verified damage or official warning polygons. It does{' '}
                        <span className="font-semibold">not</span> replace flood warnings, watches,
                        or evacuation orders from the National Weather Service or other authorities.
                      </p>
                    </div>
                    <div className="border-l-4 border-gray-400 pl-4 py-3 rounded-r">
                      <p className="font-semibold text-[#324755] mb-1 text-sm">On the map</p>
                      <p className="text-xs text-[#324755]/90 leading-relaxed">
                        Hex cells show forecasted threat severity at H3 resolution. Click a hex for
                        level, risk zone, and related indicators. County potential-impact totals use
                        the same latest run and severity threshold you select in the panel.
                      </p>
                    </div>
                    <div className="border-l-4 border-gray-300 pl-4 py-3 rounded-r bg-gray-50/80">
                      <p className="font-semibold text-[#324755] mb-2 text-sm">
                        Documentation and resources
                      </p>
                      <ul className="space-y-2 text-xs text-[#324755]/90">
                        {(currentLayer.documentationLinks || []).map((link) => (
                          <li key={link.href}>
                            <a
                              href={link.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-800 font-semibold underline underline-offset-2 hover:text-blue-950"
                            >
                              {link.label}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-indigo-500 pl-4 py-3 rounded-r">
                      <p className="font-semibold text-[#324755] mb-2 text-sm">
                        About HSI {currentLayer.name}
                      </p>
                      <p className="text-xs text-[#324755]/90 leading-relaxed mb-2">
                        {currentLayer.description}
                      </p>
                      <p className="text-xs text-[#324755]/90 leading-relaxed italic">
                        Example: The 3-hour HSI indicates the peak severity level for any 3-hour
                        rainfall accumulation occurring within the upcoming 66-hour period.
                      </p>
                    </div>
                    <div className="bg-blue-50/50 border-l-4 border-blue-500 pl-4 py-3 rounded-r">
                      <p className="font-semibold text-[#324755] mb-2 text-sm">How to read</p>
                      <ul className="space-y-2 text-xs text-[#324755]/90">
                        <li className="flex items-start">
                          <span className="font-medium mr-2">•</span>
                          <span>
                            <span className="font-semibold">&gt; 0 and &lt; 0.5:</span> Elevated but
                            below planning threshold
                          </span>
                        </li>
                        <li className="flex items-start">
                          <span className="font-medium mr-2">•</span>
                          <span>
                            <span className="font-semibold">0.5 – 1.0:</span> Approaching threshold
                          </span>
                        </li>
                        <li className="flex items-start">
                          <span className="font-medium mr-2">•</span>
                          <span>
                            <span className="font-semibold">1.0 – 1.5:</span> At/above threshold
                            (major)
                          </span>
                        </li>
                        <li className="flex items-start">
                          <span className="font-medium mr-2">•</span>
                          <span>
                            <span className="font-semibold">&gt; 1.5:</span> Well above threshold
                            (extreme)
                          </span>
                        </li>
                      </ul>
                    </div>
                    <div className="bg-amber-50/50 border-l-4 border-amber-500 pl-4 py-3 rounded-r">
                      <p className="text-sm text-[#324755]/90 leading-relaxed">
                        <span className="font-semibold">Note:</span> HSIs are forecast based
                        indicators, not warnings. Local conditions (e.g., drainage, antecedent
                        saturation, fuel state) may change actual impact.
                      </p>
                    </div>
                    <div className="border-l-4 border-[#324755] pl-4 py-3">
                      <p className="font-semibold text-[#324755] mb-2 text-sm">
                        What you&apos;ll see
                      </p>
                      <ul className="space-y-2 text-xs text-[#324755]/90">
                        <li className="flex items-start">
                          <span className="font-medium mr-2">•</span>
                          <span>
                            Each hex shows{' '}
                            <span className="font-semibold">severity of potential impact</span> (HSI
                            by time window) and, when you click, the{' '}
                            <span className="font-semibold">timing</span> when the{' '}
                            <span className="font-semibold">highest</span> impact would occur in
                            that cell (start/end for the peak window).
                          </span>
                        </li>
                        <li className="flex items-start">
                          <span className="font-medium mr-2">•</span>
                          <span>
                            Index values (dimensionless) for 3h, 6h, 12h, and 24h windows from the
                            same model run
                          </span>
                        </li>
                        <li className="flex items-start">
                          <span className="font-medium mr-2">•</span>
                          <span>
                            Higher numbers = greater {currentLayer.name.toLowerCase()} hazard
                            severity
                          </span>
                        </li>
                      </ul>
                    </div>
                    <div className="bg-red-50/50 border-l-4 border-red-400 pl-4 py-3 rounded-r">
                      <p className="font-semibold text-[#324755] mb-1 text-sm">Notes & caveats</p>
                      <p className="text-xs text-[#324755]/90 leading-relaxed">
                        Indicates potential {currentLayer.name.toLowerCase()} severity, not flood
                        extent. Runoff, soils, terrain, and drainage capacity are not directly
                        captured here.
                      </p>
                    </div>
                    {Array.isArray(currentLayer.dataSources) &&
                      currentLayer.dataSources.length > 0 && (
                        <div className="border-l-4 border-gray-300 pl-4 py-3 rounded-r bg-gray-50/80">
                          <p className="font-semibold text-[#324755] mb-2 text-sm">Data sources</p>
                          <ul className="space-y-2.5 text-xs text-[#324755]/90">
                            {currentLayer.dataSources.map((src) => (
                              <li key={src.href ?? src.source}>
                                <span className="font-semibold">{src.label}: </span>
                                {src.href ? (
                                  <a
                                    href={src.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-800 font-semibold underline underline-offset-2 hover:text-blue-950"
                                  >
                                    {src.source}
                                  </a>
                                ) : (
                                  <span className="font-semibold">{src.source}</span>
                                )}
                                {src.detail && (
                                  <span className="block text-[#324755]/80 leading-relaxed">
                                    {src.detail}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                  </>
                )}
              </div>

              <div className="p-4 pt-3 border-t border-gray-200 bg-gray-50/50">
                <button
                  onClick={onClose}
                  className={`w-full px-4 py-2 text-white text-sm font-semibold rounded-lg transition-colors ${
                    isFloodHub
                      ? 'bg-sky-700 hover:bg-sky-800'
                      : isLts
                        ? 'bg-blue-700 hover:bg-blue-800'
                        : 'bg-[#324755] hover:bg-[#334755]'
                  }`}
                >
                  Got it
                </button>
              </div>
            </div>
          </MotionDiv>
        </>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modalTree, document.body);
}

HMEDInfoModal.propTypes = {
  show: PropTypes.bool,
  onClose: PropTypes.func,
  currentLayer: PropTypes.object,
};
