/**
 * @fileoverview Gauge / event / inundation detail side panel for Google Flood Hub overlays.
 * Stage chart uses current + predicted peak from vector tiles (`public.google_flood_hub_gauges`); enrichments may still be static.
 */

import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import {
  X,
  ExternalLink,
  AlertTriangle,
  Info,
  CalendarRange,
  Users,
  MapPinned,
  Gauge,
  Hash,
  Clock,
  Sparkles,
  ChevronRight,
  CheckCircle,
  TrendingUp,
  Layers,
} from 'lucide-react';
import {
  formatFloodHubUnitLabel,
  formatIsoTimeForPopup,
  getFloodHubInundationSeverityPresentation,
  getFloodHubUrbanFlashLikelihoodPresentation,
} from '../../utils/hmedMapUtils';
import {
  resolveNwpsUrl,
  resolveQualityVerified,
  buildGaugeHydrographFromFields,
  FLOOD_HUB_GAUGE_HYDROGRAPH_HOURS,
} from '../../utils/floodHubPrdUtils';
import { LAYER_CONFIG } from '../../config/hmedLayerConfig';
import CustomTooltip from '../ui/CustomTooltip';

/** Educational copy for the gauge side panel (Flood Hub). */
const FLOOD_HUB_GAUGE_INFO = {
  sourceBody:
    'We use a variety of different sources for the gauge ongoing data. This value indicates where the gauge data is sourced from. Possible sources include Hybas, GRDC, Caravan, etc.',
  higherConfidence:
    "Predictions that meet Google's high standards for accuracy, using reliable data and validated models.",
  lowerConfidence:
    'Same hydrologic model that we use for higher-confidence gauges, but potentially less data or lower accuracy, leading to greater uncertainty.',
  inundationIntro:
    'Inundation maps show the areas likely to be underwater during a flood, with darker blues indicating a higher chance of flooding. Inundation maps are not supported for all gauges. When available, the inundation map may show:',
  inundationSometimes:
    '"Sometimes" indicates that an inundation map for this gauge will appear only if a recent satellite image is available.',
};

function finiteNumbers(...values) {
  return values.filter((value) => typeof value === 'number' && Number.isFinite(value));
}

/**
 * Full glossary dialog (portal); opened from the gauge panel info control.
 * @param {{ onClose: () => void; gaugeDataSource: string; staticDetail: { inundationMapAvailable?: boolean } }} props
 */
function FloodHubGaugeInfoDialog({ onClose, gaugeDataSource, staticDetail }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const trimmedSource =
    gaugeDataSource != null && String(gaugeDataSource).trim() !== ''
      ? String(gaugeDataSource).trim()
      : null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[260] cursor-default bg-slate-900/40"
        aria-label="Close gauge information"
        onClick={onClose}
      />
      <div
        className="fixed left-1/2 top-1/2 z-[270] flex max-h-[min(85vh,560px)] w-[min(100vw-1.5rem,28rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="flood-hub-gauge-info-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-gradient-to-r from-sky-600 to-sky-700 px-4 py-3">
          <h2
            id="flood-hub-gauge-info-modal-title"
            className="text-base font-bold tracking-tight text-white"
          >
            Gauge information
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-white transition-colors hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-sm text-slate-700">
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-600">Source</h3>
            {trimmedSource ? (
              <p className="mt-1 font-mono text-xs font-semibold text-sky-900">{trimmedSource}</p>
            ) : (
              <p className="mt-1 text-xs italic text-slate-500">
                No source attribute in tile for this gauge.
              </p>
            )}
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              {FLOOD_HUB_GAUGE_INFO.sourceBody}
            </p>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-600">
              Higher-confidence gauges
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              {FLOOD_HUB_GAUGE_INFO.higherConfidence}
            </p>
            <h3 className="mt-3 text-[11px] font-bold uppercase tracking-wide text-slate-600">
              Lower-confidence gauges
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              {FLOOD_HUB_GAUGE_INFO.lowerConfidence}
            </p>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-600">
              Inundation map
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              {FLOOD_HUB_GAUGE_INFO.inundationIntro}
            </p>
            <ul className="mt-2 list-none space-y-1.5 border-l-2 border-sky-200 pl-3 text-xs text-slate-600">
              <li>
                <span className="font-semibold text-slate-800">Current</span>
                <span className="text-slate-500"> — </span>
                an estimate of the currently inundated area
              </li>
              <li>
                <span className="font-semibold text-slate-800">Forecast</span>
                <span className="text-slate-500"> — </span>
                an estimate of the inundated area on this date in the future
              </li>
              <li>
                <span className="font-semibold text-slate-800">Last image</span>
                <span className="text-slate-500"> — </span>
                the map is based on satellite imagery, taken at the date and time indicated
              </li>
            </ul>
            <p className="mt-3 text-xs italic leading-relaxed text-slate-600">
              {FLOOD_HUB_GAUGE_INFO.inundationSometimes}
            </p>
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                This gauge
              </p>
              <p className="mt-1 text-xs leading-snug text-slate-700">
                <span className="font-semibold text-slate-800">Inundation map: </span>
                {staticDetail.inundationMapAvailable ? (
                  <span>Published for this gauge (demo flag).</span>
                ) : (
                  <span>
                    Not published for this gauge in the demo dataset — many gauges have no
                    inundation map.
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

FloodHubGaugeInfoDialog.propTypes = {
  onClose: PropTypes.func.isRequired,
  gaugeDataSource: PropTypes.string,
  staticDetail: PropTypes.object.isRequired,
};

/**
 * @param {{ fields: object; staticDetail: object; qv: boolean|null }} props
 */
function GaugeInformationBlock({ fields, staticDetail, qv }) {
  const [infoOpen, setInfoOpen] = useState(false);
  const sourceDisp =
    fields.gaugeDataSource != null && String(fields.gaugeDataSource).trim() !== ''
      ? String(fields.gaugeDataSource).trim().toUpperCase()
      : '—';
  const lat = fields.gaugeLatitude;
  const lon = fields.gaugeLongitude;
  const latLonDisp =
    lat != null && lon != null ? `${Number(lat).toFixed(6)},${Number(lon).toFixed(6)}` : '—';
  const stationDisp =
    fields.gaugeStationName != null && String(fields.gaugeStationName).trim() !== ''
      ? String(fields.gaugeStationName).trim()
      : '—';
  const inundationDisp = resolveInundationMapDisplay(fields, staticDetail);

  const inundationFieldTooltip = (
    <>
      <p className="mb-2">{FLOOD_HUB_GAUGE_INFO.inundationIntro}</p>
      <ul className="mb-2 list-disc space-y-1 pl-4 text-left text-xs">
        <li>Current — an estimate of the currently inundated area</li>
        <li>Forecast — an estimate of the inundated area on this date in the future</li>
        <li>
          Last image — the map is based on satellite imagery, taken at the date and time indicated
        </li>
      </ul>
      <p>{FLOOD_HUB_GAUGE_INFO.inundationSometimes}</p>
    </>
  );

  return (
    <>
      <section
        className="space-y-3 rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm"
        aria-labelledby="flood-hub-gauge-info-heading"
      >
        <div className="flex flex-wrap items-center gap-2">
          <h3
            id="flood-hub-gauge-info-heading"
            className="text-base font-bold tracking-tight text-slate-900"
          >
            Gauge information
          </h3>
          <button
            type="button"
            onClick={() => setInfoOpen(true)}
            className="inline-flex shrink-0 rounded-full p-1 text-sky-700 transition-colors hover:bg-sky-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2"
            aria-label="Open gauge information glossary"
            aria-expanded={infoOpen}
            aria-haspopup="dialog"
          >
            <Info className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        </div>

        {qv === true ? (
          <CustomTooltip multiline delay={180} content={FLOOD_HUB_GAUGE_INFO.higherConfidence}>
            <div className="flex w-fit cursor-help items-center gap-2 text-sm text-slate-600">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white shadow-sm">
                <CheckCircle className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
              </span>
              <span className="font-medium text-slate-700">Higher-confidence gauge</span>
            </div>
          </CustomTooltip>
        ) : null}
        {qv === false ? (
          <CustomTooltip multiline delay={180} content={FLOOD_HUB_GAUGE_INFO.lowerConfidence}>
            <div className="flex w-fit cursor-help items-center gap-2 text-sm text-slate-600">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white shadow-sm">
                <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              </span>
              <span className="font-medium text-slate-700">Lower-confidence gauge</span>
            </div>
          </CustomTooltip>
        ) : null}

        <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
          <div>
            <div className="text-[11px] font-medium text-slate-500">River gauge ID</div>
            <div className="mt-0.5 break-all font-mono text-sm font-semibold text-slate-900">
              {fields.gaugeId || '—'}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
              <span>Source</span>
              <CustomTooltip multiline delay={180} content={FLOOD_HUB_GAUGE_INFO.sourceBody}>
                <button
                  type="button"
                  className="-m-0.5 inline-flex rounded p-0.5 text-slate-400 hover:text-sky-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                  aria-label="About data source"
                >
                  <Info className="h-3 w-3" aria-hidden />
                </button>
              </CustomTooltip>
            </div>
            <div className="mt-0.5 text-sm font-semibold text-slate-900">{sourceDisp}</div>
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-500">Lat/Long</div>
            <div className="mt-0.5 break-all text-sm font-semibold text-slate-900">
              {latLonDisp}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-500">Gauge station name</div>
            <div className="mt-0.5 text-sm font-semibold text-slate-900">{stationDisp}</div>
          </div>
          <div className="col-span-2">
            <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
              <span>Inundation map</span>
              <CustomTooltip multiline delay={180} content={inundationFieldTooltip}>
                <button
                  type="button"
                  className="-m-0.5 inline-flex rounded p-0.5 text-slate-400 hover:text-sky-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                  aria-label="About inundation maps"
                >
                  <Info className="h-3 w-3" aria-hidden />
                </button>
              </CustomTooltip>
            </div>
            <div className="mt-0.5 text-sm font-semibold text-slate-900">{inundationDisp}</div>
          </div>
        </div>
      </section>

      {infoOpen && typeof document !== 'undefined'
        ? createPortal(
            <FloodHubGaugeInfoDialog
              onClose={() => setInfoOpen(false)}
              gaugeDataSource={fields.gaugeDataSource}
              staticDetail={staticDetail}
            />,
            document.body
          )
        : null}
    </>
  );
}

GaugeInformationBlock.propTypes = {
  fields: PropTypes.object.isRequired,
  staticDetail: PropTypes.object.isRequired,
};

function PanelDataSourceNote({ children }) {
  return <div className="text-[10px] text-slate-600 leading-snug space-y-1.5">{children}</div>;
}

PanelDataSourceNote.propTypes = {
  children: PropTypes.node,
};

/**
 * @param {{ kind: 'gauge'|'event'|'inundation'; variant?: 'probability'|'history' }} props
 */
function PanelSourceStrip({ kind, variant }) {
  if (
    kind === 'gauge' ||
    kind === 'event' ||
    kind === 'urbanFlash' ||
    (kind === 'inundation' && variant === 'probability')
  ) {
    return null;
  }
  return (
    <div className="shrink-0 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
      <PanelDataSourceNote>
        <p className="text-[11px] text-slate-600">
          Sample overlay only (not live operational data).
        </p>
      </PanelDataSourceNote>
    </div>
  );
}

PanelSourceStrip.propTypes = {
  kind: PropTypes.oneOf(['gauge', 'event', 'inundation', 'urbanFlash']).isRequired,
  variant: PropTypes.oneOf(['probability', 'history']),
};

/**
 * @param {{ inundationMapStatus?: string } & Record<string, unknown>} fields
 * @param {{ inundationMapAvailable?: boolean } & Record<string, unknown>} staticDetail
 * @returns {string}
 */
function resolveInundationMapDisplay(fields, staticDetail) {
  const t =
    fields.inundationMapStatus != null && String(fields.inundationMapStatus).trim() !== ''
      ? String(fields.inundationMapStatus).trim()
      : '';
  if (t) return t;
  if (staticDetail?.inundationMapAvailable === true) return 'Available';
  return 'Sometimes';
}

function chartAddLocalDays(baseDate, dayDelta) {
  const d = new Date(baseDate.getTime());
  d.setDate(d.getDate() + dayDelta);
  return d;
}

function formatShortChartDate(d) {
  return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
}

function formatChartAxisNumber(n) {
  if (!Number.isFinite(n)) return '';
  const abs = Math.abs(n);
  if (abs >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function HydrographSvg({ hydro, unitLabel, referenceDateIso }) {
  const w = 336;
  const h = 188;
  const padL = 46;
  const padR = 10;
  const padT = 14;
  const padB = 36;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const mode = hydro.mode === 'daily' ? 'daily' : 'legacy';

  const refDate = useMemo(() => {
    const s = referenceDateIso != null ? String(referenceDateIso).trim() : '';
    if (s) {
      const d = new Date(s);
      if (!Number.isNaN(d.getTime())) return d;
    }
    return new Date();
  }, [referenceDateIso]);

  const layout = useMemo(() => {
    const warn = hydro.warning;
    const dang = hydro.danger;
    const extr = hydro.extreme;

    if (mode === 'daily') {
      const values = hydro.values;
      const n = values.length;
      const nowDayIndex = Math.max(0, Math.min(hydro.nowDayIndex ?? 2, Math.max(n - 1, 0)));
      const finiteVals = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
      if (finiteVals.length === 0) return null;
      const lo = Math.min(...finiteVals);
      const hi = Math.max(...finiteVals);
      const span = hi - lo || Math.abs(hi) * 0.08 || 1;
      const vmin = lo - span * 0.12;
      const vmax = hi + span * 0.12;
      const inBand = (t) => typeof t === 'number' && Number.isFinite(t) && t >= vmin && t <= vmax;
      const showThresholdLine = {
        warning: inBand(warn),
        danger: inBand(dang),
        extreme: inBand(extr),
      };
      const xAt = (i) => padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
      const yAt = (v) => padT + innerH - ((v - vmin) / (vmax - vmin || 1)) * innerH;
      const pts = values.map((v, i) =>
        v != null && Number.isFinite(v) ? { i, x: xAt(i), y: yAt(v), v: Number(v) } : null
      );
      const baseY = padT + innerH;
      const histPts = pts.filter((p) => p && p.i <= nowDayIndex);
      const forePts = pts.filter((p) => p && p.i >= nowDayIndex);
      const join = (arr) => arr.map((p) => `${p.x},${p.y}`).join(' ');

      let fillD = '';
      if (histPts.length >= 2) {
        const first = histPts[0];
        const last = histPts[histPts.length - 1];
        fillD = `M ${first.x},${baseY} ${histPts.map((p) => `L ${p.x},${p.y}`).join(' ')} L ${last.x},${baseY} Z`;
      }

      const histLine = histPts.length >= 2 ? join(histPts) : '';
      const foreLine = forePts.length >= 2 ? join(forePts) : '';

      const dayOffsets = hydro.dayOffsets || [];
      const xLabels = dayOffsets.map((off, i) => ({
        x: xAt(i),
        label: formatShortChartDate(chartAddLocalDays(refDate, off)),
      }));

      return {
        vmin,
        vmax,
        showThresholdLine,
        yFor: yAt,
        nowX: xAt(nowDayIndex),
        labelNowY: padT + 12,
        fillD,
        histLine,
        foreLine,
        showNow: true,
        xLabels,
        yTicks: [vmin, (vmin + vmax) / 2, vmax],
      };
    }

    const hours = hydro.hours || [0, 72];
    const values = hydro.values || [];
    const finiteVals = finiteNumbers(...values);
    if (finiteVals.length === 0) return null;
    const lo = Math.min(...finiteVals);
    const hi = Math.max(...finiteVals);
    const span = hi - lo || Math.abs(hi) * 0.12 || 1;
    const vmin = lo - span * 0.12;
    const vmax = hi + span * 0.12;
    const inBand = (t) => typeof t === 'number' && Number.isFinite(t) && t >= vmin && t <= vmax;
    const showThresholdLine = {
      warning: inBand(warn),
      danger: inBand(dang),
      extreme: inBand(extr),
    };
    const nh = hours.length;
    const h0 = hours[0] ?? 0;
    const h1 = hours[nh - 1] ?? 1;
    const denom = h1 - h0 || 1;
    const xAt = (i) => padL + (nh <= 1 ? innerW / 2 : ((hours[i] - h0) / denom) * innerW);
    const yAt = (v) => padT + innerH - ((v - vmin) / (vmax - vmin || 1)) * innerH;
    const pts = values
      .map((v, i) =>
        v != null && Number.isFinite(v) ? { i, x: xAt(i), y: yAt(Number(v)), v: Number(v) } : null
      )
      .filter(Boolean);
    const joinPts = (arr) => arr.map((p) => `${p.x},${p.y}`).join(' ');
    const line = pts.length >= 2 ? joinPts(pts) : '';
    return {
      vmin,
      vmax,
      showThresholdLine,
      yFor: yAt,
      nowX: null,
      labelNowY: 0,
      fillD: '',
      histLine: line,
      foreLine: '',
      showNow: false,
      xLabels: [
        { x: xAt(0), label: '0h' },
        { x: xAt(nh - 1), label: `${Math.round(h1)}h` },
      ],
      yTicks: [vmin, (vmin + vmax) / 2, vmax],
    };
  }, [mode, hydro, innerW, innerH, padL, padT, refDate]);

  if (layout == null) return null;

  const thresholdLines = [
    { key: 'warning', v: hydro.warning, stroke: '#ca8a04', show: layout.showThresholdLine.warning },
    { key: 'danger', v: hydro.danger, stroke: '#ea580c', show: layout.showThresholdLine.danger },
    { key: 'extreme', v: hydro.extreme, stroke: '#b91c1c', show: layout.showThresholdLine.extreme },
  ];

  const unitTitle = unitLabel ? `Discharge (${unitLabel})` : 'Discharge';

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-slate-800">{unitTitle}</p>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-h-[220px] text-slate-800" aria-hidden>
        <rect x={padL} y={padT} width={innerW} height={innerH} fill="#f8fafc" rx={4} />
        {layout.yTicks.map((tv, idx) => (
          <g key={`yt-${idx}`}>
            <line
              x1={padL}
              y1={layout.yFor(tv)}
              x2={padL + innerW}
              y2={layout.yFor(tv)}
              stroke="#e2e8f0"
              strokeWidth={0.75}
              opacity={0.9}
            />
            <text
              x={padL - 6}
              y={layout.yFor(tv)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-slate-500"
              style={{ fontSize: 9 }}
            >
              {formatChartAxisNumber(tv)}
            </text>
          </g>
        ))}
        {thresholdLines.map(({ key, v, stroke, show }) =>
          show && typeof v === 'number' && Number.isFinite(v) ? (
            <line
              key={key}
              x1={padL}
              y1={layout.yFor(v)}
              x2={padL + innerW}
              y2={layout.yFor(v)}
              stroke={stroke}
              strokeDasharray="5 4"
              strokeWidth={1.35}
              opacity={0.92}
            />
          ) : null
        )}
        {layout.fillD ? <path d={layout.fillD} fill="rgb(224 242 254)" opacity={0.65} /> : null}
        {layout.histLine ? (
          <polyline
            fill="none"
            stroke="#0284c7"
            strokeWidth={2.25}
            points={layout.histLine}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
        {layout.foreLine ? (
          <polyline
            fill="none"
            stroke="#0284c7"
            strokeWidth={2.25}
            strokeDasharray="5 4"
            points={layout.foreLine}
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity={0.95}
          />
        ) : null}
        {layout.showNow && layout.nowX != null ? (
          <g>
            <line
              x1={layout.nowX}
              y1={padT}
              x2={layout.nowX}
              y2={padT + innerH}
              stroke="#64748b"
              strokeWidth={1}
              strokeDasharray="4 3"
            />
            <text
              x={layout.nowX}
              y={layout.labelNowY}
              textAnchor="middle"
              className="fill-slate-600"
              style={{ fontSize: 9 }}
            >
              Now
            </text>
          </g>
        ) : null}
        {layout.xLabels.map((xl, i) => (
          <text
            key={`xl-${i}`}
            x={xl.x}
            y={h - 8}
            textAnchor="middle"
            className="fill-slate-600"
            style={{ fontSize: 9 }}
          >
            {xl.label}
          </text>
        ))}
      </svg>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-600">
        {typeof hydro.warning === 'number' && Number.isFinite(hydro.warning) ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 rounded-full bg-yellow-500" aria-hidden />
            <span className="font-medium text-slate-700">Warning</span>
            <span className="font-semibold text-slate-800">
              {formatChartAxisNumber(hydro.warning)}
            </span>
          </span>
        ) : null}
        {typeof hydro.danger === 'number' && Number.isFinite(hydro.danger) ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 rounded-full bg-orange-600" aria-hidden />
            <span className="font-medium text-slate-700">Danger</span>
            <span className="font-semibold text-slate-800">
              {formatChartAxisNumber(hydro.danger)}
            </span>
          </span>
        ) : null}
        {typeof hydro.extreme === 'number' && Number.isFinite(hydro.extreme) ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 rounded-full bg-red-700" aria-hidden />
            <span className="font-medium text-slate-700">Extreme</span>
            <span className="font-semibold text-slate-800">
              {formatChartAxisNumber(hydro.extreme)}
            </span>
          </span>
        ) : null}
      </div>
    </div>
  );
}

HydrographSvg.propTypes = {
  hydro: PropTypes.object.isRequired,
  unitLabel: PropTypes.string,
  referenceDateIso: PropTypes.string,
};

function GaugeBody({ fields, staticDetail }) {
  const nwps = resolveNwpsUrl(fields, staticDetail);
  const qv = resolveQualityVerified(fields, staticDetail);
  const unitDisp = formatFloodHubUnitLabel(fields.unit);
  const { peak, current, warning, danger, extreme, dischargeByDay } = fields;
  const hydro = useMemo(
    () =>
      buildGaugeHydrographFromFields({
        peak,
        current,
        warning,
        danger,
        extreme,
        dischargeByDay,
      }),
    [peak, current, warning, danger, extreme, dischargeByDay]
  );

  return (
    <div className="space-y-4 text-sm">
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-slate-800">Forecast hydrograph</span>
          <span className="text-[10px] text-slate-500">
            {hydro?.mode === 'daily'
              ? '−2 … +5 days vs run date'
              : `0–${FLOOD_HUB_GAUGE_HYDROGRAPH_HOURS}h (current → peak)`}
          </span>
        </div>
        {hydro ? (
          <HydrographSvg hydro={hydro} unitLabel={unitDisp} referenceDateIso={fields.fetchedAt} />
        ) : (
          <p className="text-[10px] text-slate-500 border border-slate-100 rounded-lg p-2 bg-slate-50">
            No discharge series in tile — add <span className="font-mono">curr_minus_2</span> …{' '}
            <span className="font-mono">curr_plus_5</span> or{' '}
            <span className="font-mono">current_value</span> /{' '}
            <span className="font-mono">predicted_peak</span>.
          </p>
        )}
      </div>

      <GaugeInformationBlock fields={fields} staticDetail={staticDetail} qv={qv} />

      <div>
        {nwps ? (
          <a
            href={nwps}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-xs font-semibold text-sky-700 hover:text-sky-900"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            NWPS / authoritative gauge page
          </a>
        ) : (
          <p className="text-[10px] text-slate-500">
            No NWPS deep link for this virtual gauge (demo).
          </p>
        )}

        {fields.fetchedAt ? (
          <p className="text-[10px] text-slate-500 mt-2">
            Run time: {formatIsoTimeForPopup(fields.fetchedAt)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

GaugeBody.propTypes = {
  fields: PropTypes.object.isRequired,
  staticDetail: PropTypes.object.isRequired,
};

/**
 * Significant event cell — properties from `public.google_flood_hub_significant_events` (MVT) or legacy demo keys.
 * @param {{ properties: Record<string, unknown> }} props
 */
function SignificantEventBody({ properties: p }) {
  const title = p?.title ?? p?.event_id ?? 'Significant event';
  const displayId =
    p?.event_id != null && String(p.event_id).trim() !== '' ? String(p.event_id) : null;
  const pop = p?.impacted_population_estimate ?? p?.affected_population;
  const popFormatted =
    pop != null && pop !== '' && !Number.isNaN(Number(pop))
      ? Number(pop).toLocaleString('en-US')
      : null;
  const areaSqMiles = mvtText(
    p,
    'area_sq_mile',
    'area_sq_miles',
    'area_sq_mi',
    'area_mi2',
    'Area_Sq_Mile'
  );
  const areaSqKm = mvtText(p, 'area_sq_km', 'area_km2', 'Area_Sq_Km');
  const area = areaSqMiles ?? areaSqKm;
  const areaUnit = areaSqMiles != null ? 'mi²' : 'km²';
  const areaFormatted =
    area != null && area !== '' && !Number.isNaN(Number(area))
      ? `${Number(area).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
      : null;
  const hasWindowHours = p?.forecast_window_hours != null && p?.forecast_window_hours !== '';
  const hasStartEnd = p?.start_time != null && p?.min_end_time != null;
  const note = p?.dataSourceNote;
  const peakNote =
    p?.peak_timing_note != null && String(p.peak_timing_note).trim() !== ''
      ? String(p.peak_timing_note)
      : null;

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-orange-500/10 px-3 py-1 text-[11px] font-semibold text-orange-800 ring-1 ring-orange-200/60">
          <span className="h-2 w-2 shrink-0 rounded-full bg-orange-500" aria-hidden />
          Significant flood event
        </div>
        <div>
          <h3 className="text-lg font-bold tracking-tight text-slate-900 leading-snug">
            {String(title)}
          </h3>
          {displayId && displayId !== String(title) ? (
            <p className="text-xs font-mono text-slate-500 mt-1.5 break-all flex items-start gap-1">
              <Hash className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" aria-hidden />
              {displayId}
            </p>
          ) : null}
        </div>
      </div>

      {(hasWindowHours || hasStartEnd) && (
        <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/90 p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-800 mb-3">
            <CalendarRange className="w-4 h-4 text-orange-600 shrink-0" aria-hidden />
            <span className="text-xs font-bold uppercase tracking-wide text-slate-600">
              Event window
            </span>
          </div>
          {hasStartEnd ? (
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex flex-col items-center pt-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
                  <span className="w-px flex-1 min-h-[28px] bg-gradient-to-b from-slate-200 to-slate-100 my-1" />
                  <span className="h-2 w-2 rounded-full bg-orange-500 ring-4 ring-orange-100" />
                </div>
                <div className="min-w-0 flex-1 space-y-3 text-xs">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-0.5">
                      Starts
                    </p>
                    <p className="font-medium text-slate-900 leading-snug">
                      {formatIsoTimeForPopup(p.start_time)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-0.5">
                      End (min)
                    </p>
                    <p className="font-medium text-slate-900 leading-snug">
                      {formatIsoTimeForPopup(p.min_end_time)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          {hasWindowHours ? (
            <p className="text-xs text-slate-600 mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden />
              <span>
                Forecast horizon:{' '}
                <span className="font-semibold text-slate-800">
                  {String(p.forecast_window_hours)}
                </span>{' '}
                h
              </span>
            </p>
          ) : null}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Users className="w-4 h-4 text-sky-600" strokeWidth={2} aria-hidden />
            <span className="text-[10px] font-bold uppercase tracking-wide">Population (est.)</span>
          </div>
          <p className="text-xl font-bold tabular-nums text-slate-900">{popFormatted ?? '—'}</p>
        </div>
        <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <MapPinned className="w-4 h-4 text-amber-600" strokeWidth={2} aria-hidden />
            <span className="text-[10px] font-bold uppercase tracking-wide">Affected area</span>
          </div>
          <p className="text-xl font-bold tabular-nums text-slate-900">
            {areaFormatted ? `${areaFormatted} ${areaUnit}` : '—'}
          </p>
        </div>
      </div>

      {p?.contributing_gauge_ids != null && String(p.contributing_gauge_ids).trim() !== '' ? (
        <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-3">
          <div className="flex items-center gap-2 text-sky-900 mb-1.5">
            <Gauge className="w-4 h-4 shrink-0" aria-hidden />
            <span className="text-xs font-bold">Contributing gauges</span>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed">
            {String(p.contributing_gauge_ids)}
          </p>
        </div>
      ) : null}

      {peakNote ? (
        <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-3 flex gap-3">
          <Sparkles className="w-4 h-4 text-violet-600 shrink-0 mt-0.5" aria-hidden />
          <p className="text-xs text-slate-800 leading-relaxed">{peakNote}</p>
        </div>
      ) : null}

      {note != null && String(note).trim() !== '' ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-3 text-xs text-amber-950 leading-relaxed">
          {String(note)}
        </div>
      ) : null}

      <div>
        <details className="group rounded-xl border border-slate-200 bg-slate-50/60">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100/80 rounded-xl transition-colors">
            <span className="flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-slate-500" aria-hidden />
              Technical details
            </span>
            <ChevronRight
              className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-90"
              aria-hidden
            />
          </summary>
          <div className="border-t border-slate-200/80 px-3 pb-3 pt-2 space-y-2 text-[11px] text-slate-600">
            {p?.h3_l10_hex != null && String(p.h3_l10_hex).trim() !== '' ? (
              <p className="font-mono break-all">
                <span className="text-slate-500 font-sans">H3 L10: </span>
                {String(p.h3_l10_hex)}
              </p>
            ) : (
              <p className="text-slate-500">No H3 cell on this feature.</p>
            )}
            {p?.fetched_at != null && String(p.fetched_at).trim() !== '' ? (
              <p className="flex items-center gap-1.5 text-slate-500">
                <Clock className="w-3 h-3 shrink-0" aria-hidden />
                Fetched {formatIsoTimeForPopup(p.fetched_at)}
              </p>
            ) : null}
          </div>
        </details>
      </div>
    </div>
  );
}

SignificantEventBody.propTypes = {
  properties: PropTypes.object.isRequired,
};

function mvtText(p, ...keys) {
  if (!p || typeof p !== 'object') return null;
  for (const k of keys) {
    if (k in p && p[k] != null && String(p[k]).trim() !== '') return String(p[k]);
  }
  return null;
}

/**
 * `public.google_flood_hub_status` feature — tile attribute names may vary in case.
 * @param {{ properties: Record<string, unknown> }} props
 */
function FloodStatusBody({ properties: p }) {
  const severity = mvtText(p, 'severity', 'Severity');
  const trend = mvtText(p, 'forecast_trend', 'forecastTrend', 'Forecast_Trend');
  const mapIndex = mvtText(p, 'map_index', 'mapIndex', 'Map_Index');
  const gaugeId = mvtText(p, 'gauge_id', 'gaugeId', 'Gauge_Id');
  const h3 = mvtText(p, 'h3_l10_hex', 'h3L10Hex', 'H3_L10_Hex');
  const issued = p?.issued_time ?? p?.issuedTime;
  const fetched = p?.fetched_at ?? p?.fetchedAt;
  const note =
    p?.dataSourceNote != null && String(p.dataSourceNote).trim() !== ''
      ? String(p.dataSourceNote)
      : null;
  const severityUi = getFloodHubInundationSeverityPresentation(severity);
  const headline = severityUi.label;

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-violet-500/10 px-3 py-1 text-[11px] font-semibold text-violet-800 ring-1 ring-violet-200/60">
          <span className="h-2 w-2 shrink-0 rounded-full bg-violet-500" aria-hidden />
          Inundation status
        </div>
        <div>
          <h3 className="text-lg font-bold tracking-tight text-slate-900 leading-snug flex items-center gap-2.5">
            <span
              className="h-3.5 w-3.5 shrink-0 rounded-full border border-slate-300/60"
              style={{ backgroundColor: severityUi.color }}
              aria-hidden
            />
            {headline}
          </h3>
          {(severity != null && String(severity).trim() !== '') || severityUi.apiToken ? (
            <p className="text-[10px] font-mono text-slate-500 mt-1.5 break-all uppercase tracking-wide">
              {severity != null && String(severity).trim() !== ''
                ? String(severity).trim().toUpperCase()
                : severityUi.apiToken}
            </p>
          ) : null}
          {gaugeId ? (
            <p className="text-xs font-mono text-slate-500 mt-1.5 break-all flex items-start gap-1">
              <Hash className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" aria-hidden />
              {gaugeId}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <TrendingUp className="w-4 h-4 text-violet-600 shrink-0" strokeWidth={2} aria-hidden />
            <span className="text-[10px] font-bold uppercase tracking-wide">Forecast trend</span>
          </div>
          <p className="text-base font-bold text-slate-900 leading-snug">{trend ?? '—'}</p>
        </div>
        <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Layers className="w-4 h-4 text-violet-600 shrink-0" strokeWidth={2} aria-hidden />
            <span className="text-[10px] font-bold uppercase tracking-wide">Map index</span>
          </div>
          <p className="text-xl font-bold tabular-nums text-slate-900">{mapIndex ?? '—'}</p>
        </div>
      </div>

      {note ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-3 text-xs text-amber-950 leading-relaxed">
          {note}
        </div>
      ) : null}

      <div>
        <details className="group rounded-xl border border-slate-200 bg-slate-50/60">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100/80 rounded-xl transition-colors">
            <span className="flex items-center gap-2">
              <Info className="w-3.5 h-3.5 text-slate-500" aria-hidden />
              Technical details
            </span>
            <ChevronRight
              className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-90"
              aria-hidden
            />
          </summary>
          <div className="border-t border-slate-200/80 px-3 pb-3 pt-2 space-y-2 text-[11px] text-slate-600">
            {h3 ? (
              <p className="font-mono break-all">
                <span className="text-slate-500 font-sans">H3 L10: </span>
                {h3}
              </p>
            ) : (
              <p className="text-slate-500">No H3 cell on this feature.</p>
            )}
            {issued != null && String(issued).trim() !== '' ? (
              <p className="flex items-center gap-1.5 text-slate-500">
                <Clock className="w-3 h-3 shrink-0" aria-hidden />
                Issued {formatIsoTimeForPopup(issued)}
              </p>
            ) : null}
            {fetched != null && String(fetched).trim() !== '' ? (
              <p className="flex items-center gap-1.5 text-slate-500">
                <Clock className="w-3 h-3 shrink-0" aria-hidden />
                Fetched {formatIsoTimeForPopup(fetched)}
              </p>
            ) : null}
          </div>
        </details>
      </div>
    </div>
  );
}

FloodStatusBody.propTypes = {
  properties: PropTypes.object.isRequired,
};

function urbanFlashH3Display(p) {
  if (p?.h3_l10_hex != null && String(p.h3_l10_hex).trim() !== '') {
    return { label: 'H3 L10', value: String(p.h3_l10_hex).trim() };
  }
  for (const level of [10, 9, 8, 7, 6]) {
    const raw = p?.[`h3_l${level}_id`];
    if (raw != null && String(raw).trim() !== '') {
      return { label: `H3 L${level}`, value: String(raw).trim() };
    }
  }
  return { label: 'H3', value: null };
}

/**
 * Urban flash flood cell from `public.google_flood_hub_urban_flash_flood_l6` … `_l10` MVT.
 * @param {{ properties: Record<string, unknown> }} props
 */
function UrbanFlashBody({ properties: p }) {
  const likelihoodRaw = p?.likelihood != null ? String(p.likelihood) : null;
  const likelihoodUi = getFloodHubUrbanFlashLikelihoodPresentation(likelihoodRaw);
  const h3 = urbanFlashH3Display(p);
  const forecastHours =
    p?.forecast_period_hours != null && p?.forecast_period_hours !== ''
      ? String(p.forecast_period_hours)
      : null;
  const issueTime = p?.forecast_issue_time ?? p?.forecastIssueTime;
  const fetchedAt = p?.fetched_at ?? p?.fetchedAt;

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-sky-500/10 px-3 py-1 text-[11px] font-semibold text-sky-800 ring-1 ring-sky-200/60">
          <span
            className="h-2 w-2 shrink-0 rounded-full border border-slate-300/60"
            style={{ backgroundColor: likelihoodUi.color, opacity: likelihoodUi.opacity }}
            aria-hidden
          />
          Urban Flash Flood
        </div>
        <div>
          <h3 className="text-lg font-bold tracking-tight text-slate-900 leading-snug flex items-center gap-2.5">
            {likelihoodUi.label}
          </h3>
          {likelihoodRaw ? (
            <p className="text-[10px] font-mono text-slate-500 mt-1.5 uppercase tracking-wide">
              {likelihoodRaw.replace(/\s+/g, '_')}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-2">
            Forecast period
          </p>
          <p className="text-xl font-bold tabular-nums text-slate-900">
            {forecastHours != null ? `${forecastHours} h` : '—'}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-2">
            {h3.label}
          </p>
          <p className="text-sm font-mono font-semibold text-slate-900 break-all">{h3.value ?? '—'}</p>
        </div>
      </div>

      {issueTime != null && String(issueTime).trim() !== '' ? (
        <p className="text-xs text-slate-600 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 shrink-0 text-slate-400" aria-hidden />
          Forecast issued {formatIsoTimeForPopup(issueTime)}
        </p>
      ) : null}
      {fetchedAt != null && String(fetchedAt).trim() !== '' ? (
        <p className="text-xs text-slate-600 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 shrink-0 text-slate-400" aria-hidden />
          Fetched {formatIsoTimeForPopup(fetchedAt)}
        </p>
      ) : null}

      <a
        href="https://www.weather.gov/safety/flood-flash"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-xs font-semibold text-sky-700 hover:text-sky-900"
      >
        <ExternalLink className="w-3.5 h-3.5" />
        NWS flash flood safety
      </a>
    </div>
  );
}

UrbanFlashBody.propTypes = {
  properties: PropTypes.object.isRequired,
};

/** Align with `HMEDFloodHubPrdBanner` — clears `TabNavigation` (absolute z-20 above HMED map). */
const PANEL_TOP_OFFSET_CLASS = 'top-14';

/**
 * @param {object} props
 * @param {object|null} props.selection
 * @param {Function} props.onClose
 * @param {boolean} props.isMobile
 */
export function FloodHubPrdSidePanel({ selection, onClose, isMobile }) {
  if (!selection) return null;
  if (typeof document === 'undefined') return null;

  const headerAccentClass =
    selection.kind === 'gauge'
      ? 'bg-sky-500'
      : selection.kind === 'event'
        ? 'bg-orange-500'
        : selection.kind === 'urbanFlash'
          ? 'bg-sky-500'
          : selection.variant === 'probability'
            ? 'bg-violet-500'
            : 'bg-slate-400';

  const displayEventTitle =
    selection.kind === 'event'
      ? String(selection.properties?.title ?? selection.properties?.event_id ?? '').trim()
      : '';
  const rawEventId =
    selection.kind === 'event' && selection.properties?.event_id != null
      ? String(selection.properties.event_id).trim()
      : '';
  const eventSecondaryLabel =
    selection.kind === 'event' && rawEventId && rawEventId !== displayEventTitle
      ? rawEventId
      : null;

  const inundationProbSecondary =
    selection.kind === 'inundation' && selection.variant === 'probability'
      ? (() => {
          const pr = selection.properties;
          if (!pr || typeof pr !== 'object') return null;
          const gid = mvtText(pr, 'gauge_id', 'gaugeId', 'Gauge_Id');
          if (gid) return gid;
          return mvtText(pr, 'h3_l10_hex', 'h3L10Hex', 'H3_L10_Hex');
        })()
      : null;

  return createPortal(
    <>
      <div
        className={`fixed ${PANEL_TOP_OFFSET_CLASS} left-0 right-0 bottom-0 z-[200] bg-slate-900/45`}
        style={{ pointerEvents: 'auto' }}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={`fixed ${PANEL_TOP_OFFSET_CLASS} right-0 bottom-0 z-[210] flex max-h-[calc(100vh-3.5rem)] min-h-0 flex-col border-l border-slate-200/90 bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.04),-12px_0_40px_-8px_rgba(15,23,42,0.18)] ${
          isMobile ? 'left-0 w-full max-w-full' : 'w-[420px] max-w-[96vw]'
        }`}
        style={{ pointerEvents: 'auto' }}
        role="dialog"
        aria-modal="true"
        aria-label="Flood Hub feature details"
      >
        <div className="relative flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-b from-white to-slate-50/90 px-4 py-3.5">
          <div
            className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-full ${headerAccentClass} opacity-90`}
            aria-hidden
          />
          <div className="min-w-0 pl-3 pr-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Flood Hub
            </p>
            <h2 className="mt-1 text-base font-bold leading-snug tracking-tight text-slate-900">
              {selection.kind === 'gauge' && `${LAYER_CONFIG.google_flood_hub.name} — Gauge detail`}
              {selection.kind === 'event' && 'Significant flood event'}
              {selection.kind === 'urbanFlash' && 'Urban Flash Flood'}
              {selection.kind === 'inundation' &&
                (selection.variant === 'probability'
                  ? 'Inundation probability'
                  : 'Inundation history')}
            </h2>
            {selection.kind === 'event' && eventSecondaryLabel ? (
              <p className="mt-1 text-[11px] text-slate-500 font-mono break-all line-clamp-2">
                {eventSecondaryLabel}
              </p>
            ) : null}
            {selection.kind === 'inundation' &&
            selection.variant === 'probability' &&
            inundationProbSecondary ? (
              <p className="mt-1 text-[11px] text-slate-500 font-mono break-all line-clamp-2">
                {inundationProbSecondary}
              </p>
            ) : null}
            {selection.kind === 'event' ? (
              <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
                Polygon highlights areas of interest from modeled significant events.
              </p>
            ) : selection.kind === 'inundation' && selection.variant === 'probability' ? (
              <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
                Shading reflects modeled flood status for this map cell.
              </p>
            ) : selection.kind === 'inundation' && selection.variant === 'history' ? (
              <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
                Demo history layer — replace with operational tiles when available.
              </p>
            ) : selection.kind === 'urbanFlash' ? (
              <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
                Modeled urban flash-flood likelihood for this H3 cell from Google Flood Hub tiles.
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close panel"
          >
            <X className="w-5 h-5" strokeWidth={2} />
          </button>
        </div>
        <PanelSourceStrip kind={selection.kind} variant={selection.variant} />
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4">
          {selection.kind === 'gauge' && (
            <GaugeBody fields={selection.fields} staticDetail={selection.staticDetail} />
          )}
          {selection.kind === 'event' && <SignificantEventBody properties={selection.properties} />}
          {selection.kind === 'urbanFlash' && <UrbanFlashBody properties={selection.properties} />}
          {selection.kind === 'inundation' && selection.variant === 'probability' && (
            <FloodStatusBody properties={selection.properties} />
          )}
          {selection.kind === 'inundation' && selection.variant === 'history' && (
            <div className="space-y-3 text-sm">
              <p className="text-xs font-bold text-slate-800">Inundation history</p>
              <p className="text-xs text-slate-600 mt-1">Cell: {selection.properties.cell_id}</p>
              <p className="text-xs text-slate-600">
                Historical frequency: {selection.properties.historical_frequency ?? '—'}
              </p>
              <p className="text-[10px] text-slate-500 mt-2">
                {selection.properties.native_resolution_note}
              </p>
              <p className="text-[10px] text-amber-900 bg-amber-50 border border-amber-100 rounded-lg p-2.5 mt-2 leading-relaxed">
                {selection.properties.dataSourceNote}
              </p>
            </div>
          )}
        </div>
      </aside>
    </>,
    document.body
  );
}

FloodHubPrdSidePanel.propTypes = {
  selection: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  isMobile: PropTypes.bool,
};
