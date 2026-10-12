/**
 * @fileoverview Flood Hub overlays panel: significant events, inundation, and urban flash flood (riverine lives in main HMED panel).
 */

import React from 'react';
import PropTypes from 'prop-types';
import { CircleDot, Droplets, CloudRain } from 'lucide-react';
import {
  FLOOD_HUB_INUNDATION_LEGEND_ITEMS,
  FLOOD_HUB_URBAN_FLASH_LIKELIHOOD_ITEMS,
} from '../../utils/hmedMapUtils';
import { FloodHubOverlaySwitch } from './FloodHubOverlayWidgets';

/**
 * @param {object} props
 * @param {object} props.toggles
 * @param {Function} props.setToggles - (patch: object) => void
 */
export function FloodHubPrdControls({ toggles, setToggles }) {
  const eventsLabelId = 'flood-hub-overlay-events';
  const inunLabelId = 'flood-hub-overlay-inun';
  const urbanLabelId = 'flood-hub-overlay-urban';

  return (
    <div className="mb-4 space-y-2.5 rounded-lg border border-sky-100 bg-sky-50/40 px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-sky-950">
        Flood Hub map overlays
      </p>

      <div className="space-y-1 border-t border-sky-100/80 pt-2">
        <div className="space-y-2">
          <div className="flex items-center gap-3 py-1.5">
            <CircleDot className="h-4 w-4 shrink-0 text-slate-500" strokeWidth={2} aria-hidden />
            <span
              id={eventsLabelId}
              className="min-w-0 flex-1 text-[11px] font-semibold text-slate-800"
            >
              Significant flood events
            </span>
            <FloodHubOverlaySwitch
              checked={!!toggles.events}
              labelledBy={eventsLabelId}
              onChange={(v) => setToggles({ events: v })}
            />
          </div>
          {toggles.events ? (
            <div
              className="rounded-lg border border-slate-200/90 bg-slate-100/90 px-3 py-2.5 shadow-inner"
              role="region"
              aria-label="Significant events legend"
            >
              <div className="flex items-center gap-3">
                <div
                  className="relative flex h-9 w-9 shrink-0 items-center justify-center"
                  aria-hidden
                >
                  <span className="absolute h-7 w-7 rounded-full bg-red-400/30" />
                  <span className="relative h-3.5 w-3.5 rounded-full bg-[#ea580c] ring-2 ring-white/90" />
                </div>
                <span className="text-[11px] font-medium text-slate-700">Event present</span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-3 py-1.5">
            <Droplets className="h-4 w-4 shrink-0 text-sky-600" strokeWidth={2} aria-hidden />
            <span
              id={inunLabelId}
              className="min-w-0 flex-1 text-[11px] font-semibold text-slate-800"
            >
              Inundation probability
            </span>
            <FloodHubOverlaySwitch
              checked={!!toggles.inundationProbability}
              labelledBy={inunLabelId}
              onChange={(v) => setToggles({ inundationProbability: v })}
            />
          </div>
          {toggles.inundationProbability ? (
            <div
              className="rounded-lg border border-slate-200/90 bg-slate-100/90 px-3 py-2.5 shadow-inner"
              role="region"
              aria-label="Inundation probability legend"
            >
              <ul className="space-y-2">
                {FLOOD_HUB_INUNDATION_LEGEND_ITEMS.map(({ label, apiToken, color }) => (
                  <li
                    key={apiToken}
                    className="flex items-center gap-2.5 text-[11px] text-slate-700"
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full border border-slate-300/60"
                      style={{ backgroundColor: color }}
                      aria-hidden
                    />
                    <span className="font-medium">{label}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-3 py-1.5">
            <CloudRain className="h-4 w-4 shrink-0 text-sky-600" strokeWidth={2} aria-hidden />
            <span
              id={urbanLabelId}
              className="min-w-0 flex-1 text-[11px] font-semibold text-slate-800"
            >
              Urban Flash Flood
            </span>
            <FloodHubOverlaySwitch
              checked={!!toggles.urbanFlashFlood}
              labelledBy={urbanLabelId}
              onChange={(v) => setToggles({ urbanFlashFlood: v })}
            />
          </div>
          {toggles.urbanFlashFlood ? (
            <div
              className="rounded-lg border border-slate-200/90 bg-slate-100/90 px-3 py-2.5 shadow-inner"
              role="region"
              aria-label="Urban flash flood legend"
            >
              <p className="text-[11px] font-bold text-slate-900">Urban flash flood likelihood</p>
              <p className="text-[10px] text-slate-500 mt-0.5 mb-2">Within 24h</p>
              <ul className="space-y-2 mt-2">
                {FLOOD_HUB_URBAN_FLASH_LIKELIHOOD_ITEMS.map(
                  ({ label, apiToken, color, opacity }) => (
                    <li
                      key={apiToken}
                      className="flex items-center gap-2.5 text-[11px] text-slate-700"
                    >
                      <span
                        className="h-3 w-3 shrink-0 rounded-full border border-slate-300/60"
                        style={{
                          backgroundColor: color,
                          opacity,
                        }}
                        aria-hidden
                      />
                      <span className="font-medium">{label}</span>
                    </li>
                  )
                )}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

FloodHubPrdControls.propTypes = {
  toggles: PropTypes.object.isRequired,
  setToggles: PropTypes.func.isRequired,
};
