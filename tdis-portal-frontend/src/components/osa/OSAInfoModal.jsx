import React from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, X, AlertTriangle } from 'lucide-react';

const MotionDiv = motion.div;

const ROAD_WEATHER_LAYER_ID = 'road_closures';

/**
 * OSA Info popup modal: layer descriptions, severity levels, what you'll see, notes.
 * Content switches by selectedLayer (Power Outage vs Road Weather Hazard Alerts).
 */
export function OSAInfoModal({ open, onClose, selectedLayer = 'power_outage' }) {
  const isRoadWeather = selectedLayer === ROAD_WEATHER_LAYER_ID;

  return (
    <AnimatePresence>
      {open && (
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
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            style={{ pointerEvents: 'auto' }}
          />
          <MotionDiv
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
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
                className={`flex items-center justify-between p-5 pb-4 border-b border-gray-200 ${isRoadWeather ? 'bg-gradient-to-r from-amber-600 to-amber-700' : 'bg-gradient-to-r from-orange-600 to-orange-700'}`}
              >
                <div className="flex items-center gap-3">
                  {isRoadWeather ? (
                    <AlertTriangle className="w-5 h-5 text-white" />
                  ) : (
                    <Zap className="w-5 h-5 text-white" />
                  )}
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      {isRoadWeather
                        ? 'Road Weather Hazard Alerts Information'
                        : 'Power Outage Information'}
                    </h2>
                    <p className="text-xs text-white/80">Infrastructure Status</p>
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
                {isRoadWeather ? <RoadWeatherHazardContent /> : <PowerOutageContent />}
              </div>

              <div className="p-4 pt-3 border-t border-gray-200 bg-gray-50/50">
                <button
                  onClick={onClose}
                  className={`w-full px-4 py-2 text-white text-sm font-semibold rounded-lg transition-colors ${isRoadWeather ? 'bg-amber-600 hover:bg-amber-700' : 'bg-orange-600 hover:bg-orange-700'}`}
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
}

function PowerOutageContent() {
  return (
    <>
      <div className="bg-blue-50/50 border-l-4 border-blue-500 pl-4 py-3 rounded-r">
        <p className="font-semibold text-[#324755] mb-2 text-sm">Available Layers</p>
        <div className="space-y-3 text-xs text-[#324755]/90">
          <div>
            <p className="font-semibold mb-1">Power Outage Monitoring Layer</p>
            <p className="leading-relaxed">
              Displays current outage status (updated hourly) by zip code, utility, and county for
              high-resolution regional tracking.
            </p>
          </div>
          <div>
            <p className="font-semibold mb-1">Point Outage Layer</p>
            <p className="leading-relaxed">
              Provides hyper-local outage data for a service point, refreshed hourly, displaying
              precise outage status for the immediate vicinity of designated points.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-orange-50/50 border-l-4 border-orange-500 pl-4 py-3 rounded-r">
        <p className="font-semibold text-[#324755] mb-2 text-sm">Customers Out Severity Levels</p>
        <ul className="space-y-1 text-xs text-[#324755]/90">
          {[
            ['1-50', 'Blue'],
            ['51-100', 'Light blue/Teal'],
            ['101-250', 'Light green'],
            ['251-500', 'Green'],
            ['501-1,000', 'Yellow-green'],
            ['1,001-1,500', 'Yellow'],
            ['1,501-2,000', 'Orange'],
            ['2,001-3,000', 'Brown'],
            ['3,001+', 'Dark red'],
          ].map(([range, label]) => (
            <li key={range} className="flex items-start">
              <span className="font-medium mr-2">•</span>
              <span>
                <span className="font-semibold">{range}:</span> {label}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="border-l-4 border-[#324755] pl-4 py-3">
        <p className="font-semibold text-[#324755] mb-2 text-sm">What you'll see</p>
        <ul className="space-y-2 text-xs text-[#324755]/90">
          <li className="flex items-start">
            <span className="font-medium mr-2">•</span>
            <span>Power outage data across Texas updated hourly</span>
          </li>
          <li className="flex items-start">
            <span className="font-medium mr-2">•</span>
            <span>Color-coded severity levels from minimal (blue) to critical (dark red)</span>
          </li>
          <li className="flex items-start">
            <span className="font-medium mr-2">•</span>
            <span>County boundaries for geographic reference</span>
          </li>
          <li className="flex items-start">
            <span className="font-medium mr-2">•</span>
            <span>Click on areas or points to view detailed outage information</span>
          </li>
        </ul>
      </div>

      <div className="bg-amber-50/50 border-l-4 border-amber-500 pl-4 py-3 rounded-r">
        <p className="text-sm text-[#324755]/90 leading-relaxed">
          <span className="font-semibold">Note:</span> Power outage data is updated hourly. Values
          represent the number of customers affected in each area or at each point location.
        </p>
      </div>

      <p className="text-[11px] text-gray-500 text-center pt-1">
        Data source:{' '}
        <a
          href="https://poweroutage.com"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[#324755] underline underline-offset-2 hover:text-orange-700"
        >
          Poweroutage.com
        </a>
      </p>
    </>
  );
}

function RoadWeatherHazardContent() {
  return (
    <>
      <p className="text-xs text-[#324755]/90 leading-relaxed">
        Crowdsourced Situational Awareness (Waze Alerts)
      </p>

      <div className="bg-blue-50/50 border-l-4 border-blue-500 pl-4 py-3 rounded-r">
        <p className="font-semibold text-[#324755] mb-2 text-sm">Available Layers</p>
        <div className="space-y-3 text-xs text-[#324755]/90">
          <p className="font-semibold mb-1">Waze Road Hazard Layer</p>
          <p className="leading-relaxed">
            Displays near–real-time, crowdsourced reports of weather-related road hazards submitted
            by Waze users. Each point represents a user-reported hazard at an approximate location
            and time.
          </p>
        </div>
      </div>

      <div className="border-l-4 border-[#324755] pl-4 py-3">
        <p className="font-semibold text-[#324755] mb-2 text-sm">Reported Hazard Types</p>
        <ul className="space-y-1 text-xs text-[#324755]/90">
          <li className="flex items-start">
            <span className="font-medium mr-2">•</span>
            <span>Flooding / standing water</span>
          </li>
          <li className="flex items-start">
            <span className="font-medium mr-2">•</span>
            <span>Ice, snow, or slippery road conditions</span>
          </li>
          <li className="flex items-start">
            <span className="font-medium mr-2">•</span>
            <span>Heavy rain or reduced visibility</span>
          </li>
          <li className="flex items-start">
            <span className="font-medium mr-2">•</span>
            <span>Fog or dust</span>
          </li>
          <li className="flex items-start">
            <span className="font-medium mr-2">•</span>
            <span>Weather-related roadway hazards</span>
          </li>
        </ul>
      </div>

      <div className="border-l-4 border-[#324755] pl-4 py-3">
        <p className="font-semibold text-[#324755] mb-2 text-sm">What You'll See</p>
        <ul className="space-y-2 text-xs text-[#324755]/90">
          <li className="flex items-start">
            <span className="font-medium mr-2">•</span>
            <span>Point-based hazard alerts updated continuously as users report conditions</span>
          </li>
          <li className="flex items-start">
            <span className="font-medium mr-2">•</span>
            <span>Clusters of alerts indicating potential high-impact corridors or hotspots</span>
          </li>
          <li className="flex items-start">
            <span className="font-medium mr-2">•</span>
            <span>Approximate location and timestamp of each reported hazard</span>
          </li>
          <li className="flex items-start">
            <span className="font-medium mr-2">•</span>
            <span>
              Clickable points to view hazard type, report time, and user confirmation status
            </span>
          </li>
        </ul>
      </div>

      <div className="border-l-4 border-[#324755] pl-4 py-3">
        <p className="font-semibold text-[#324755] mb-2 text-sm">How to Interpret This Layer</p>
        <ul className="space-y-2 text-xs text-[#324755]/90">
          <li className="flex items-start">
            <span className="font-medium mr-2">•</span>
            <span>
              <span className="font-semibold">Observational signals, not mapped coverage</span> —
              Alerts indicate user-reported conditions at specific locations. They do not define
              hazard boundaries or closures.
            </span>
          </li>
          <li className="flex items-start">
            <span className="font-medium mr-2">•</span>
            <span>
              <span className="font-semibold">Clusters indicate higher confidence</span> — Multiple
              similar reports within a short time and distance suggest increased likelihood of
              road-level impact.
            </span>
          </li>
          <li className="flex items-start">
            <span className="font-medium mr-2">•</span>
            <span>
              <span className="font-semibold">Traffic-dependent reporting</span> — Alerts are more
              common on high-traffic roads. The absence of reports does not imply safe or clear
              conditions.
            </span>
          </li>
          <li className="flex items-start">
            <span className="font-medium mr-2">•</span>
            <span>
              <span className="font-semibold">Dynamic and time-sensitive</span> — Reports may expire
              or be cleared as conditions change or users confirm the hazard is no longer present.
            </span>
          </li>
        </ul>
      </div>

      <div className="bg-amber-50/50 border-l-4 border-amber-500 pl-4 py-3 rounded-r space-y-2">
        <p className="font-semibold text-[#324755] text-sm">Notes</p>
        <p className="text-xs text-[#324755]/90 leading-relaxed">
          This layer is not authoritative and should be used alongside official sources.
        </p>
        <p className="text-xs text-[#324755]/90 leading-relaxed">
          Isolated reports should be treated as preliminary signals and corroborated before
          informing operational or life-safety decisions.
        </p>
      </div>
    </>
  );
}

OSAInfoModal.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  selectedLayer: PropTypes.string,
};
