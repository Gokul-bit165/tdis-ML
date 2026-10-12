import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, SlidersHorizontal, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { CRITICAL_FACILITY_LAYERS } from "@/config/criticalFacilitiesConfig";
import { trackEvent, EVENT_SELECTION, MAP_INTERACTION } from "@/utils/googleAnalytics.js";

const MotionButton = motion.button;
const MotionDiv = motion.div;
const LEGEND_ACCENT_TEXT_CLASS = 'text-[#324755]';

const activeEvents = [
  "Wildfire",
  "Rainfall",
  "High wind",
  "Earthquake",
  "Hail"
];

/**
 * MapLegend Component
 *
 * Displays a clickable legend of event types with icons, styled like HMED/OSA tabs.
 * Also toggles critical-facility overlays (fire stations / schools / hospitals).
 */
const normalizeEventKey = (value) =>
  String(value || "")
    .toLowerCase()
    .replaceAll(/\s+/g, " ")
    .trim();

const MapLegend = ({
  selectedEvents,
  setSelectedEvents,
  loading,
  eventCounts = [],
  facilityVisibility = {},
  setFacilityVisibility,
}) => {
  const isMobile = useIsMobile();
  const [isExpanded, setIsExpanded] = useState(false);

  const countsByEvent = useMemo(() => {
    const map = new Map();
    eventCounts.forEach(({ type, count }) => {
      map.set(normalizeEventKey(type), Number(count) || 0);
    });
    return map;
  }, [eventCounts]);

  const handleToggle = (event) => {
    const selected = !selectedEvents.includes(event);
    trackEvent(EVENT_SELECTION, MAP_INTERACTION, {
      tab: 'active-weather-events',
      event_name: event,
      event_label: event,
      selected,
      source: 'map_legend',
    });
    setSelectedEvents((prev) =>
      prev.includes(event)
        ? prev.filter((e) => e !== event)
        : [...prev, event]
    );
  };

  const handleFacilityToggle = (facilityId) => {
    if (!setFacilityVisibility) return;
    setFacilityVisibility((prev) => ({
      ...prev,
      [facilityId]: !prev[facilityId],
    }));
  };

  const renderEventButton = (event) => {
    const eventKey = normalizeEventKey(event);
    const count = countsByEvent.has(eventKey) ? countsByEvent.get(eventKey) : undefined;
    const hasData = typeof count === "number" ? count > 0 : false;
    const selected = selectedEvents.includes(event);

    return (
      <button
        key={event}
        type="button"
        onClick={() => {
          if (hasData) handleToggle(event);
        }}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ${
          selected
            ? LEGEND_ACCENT_TEXT_CLASS
            : 'text-gray-600 hover:text-[#324755] hover:bg-gray-100 border border-gray-200'
        } ${hasData === false ? 'opacity-60 cursor-not-allowed' : ''}`}
        disabled={hasData === false}
      >
        <img
          src={`/${event.toLowerCase()}.png`}
          alt={event}
          className="w-4 h-4"
          style={{
            filter: selected ? "none" : "grayscale(100%)",
            opacity: selected ? 1 : 0.6
          }}
          draggable={false}
        />
        <span className="flex-1 text-left leading-tight">{event}</span>
        <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
          {hasData === false ? (
            <span className="text-[9px] font-semibold text-gray-400">–</span>
          ) : (
            <Check
              className={`w-4 h-4 ${selected ? LEGEND_ACCENT_TEXT_CLASS : 'text-gray-400'}`}
              strokeWidth={2.5}
            />
          )}
        </div>
      </button>
    );
  };

  const renderFacilityButton = (facility) => {
    const selected = Boolean(facilityVisibility[facility.id]);
    const disabled = !facility.hasData;

    return (
      <button
        key={facility.id}
        type="button"
        onClick={() => {
          if (!disabled) handleFacilityToggle(facility.id);
        }}
        disabled={disabled}
        title={disabled ? 'Data not available yet' : facility.label}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ${
          selected && !disabled
            ? LEGEND_ACCENT_TEXT_CLASS
            : 'text-gray-600 hover:text-[#324755] hover:bg-gray-100 border border-gray-200'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span
          className="w-3.5 h-3.5 rounded-full flex-shrink-0 border border-white shadow-sm"
          style={{ backgroundColor: facility.color }}
          aria-hidden
        />
        <span className="flex-1 text-left leading-tight">{facility.label}</span>
        <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
          {disabled ? (
            <span className="text-[9px] font-semibold text-gray-400">Soon</span>
          ) : (
            <Check
              className={`w-4 h-4 ${selected ? LEGEND_ACCENT_TEXT_CLASS : 'text-gray-400'}`}
              strokeWidth={2.5}
            />
          )}
        </div>
      </button>
    );
  };

  const renderSkeleton = () => (
    <div className="flex items-center gap-2.5 px-3 py-2">
      <Skeleton className="w-4 h-4 rounded-full" />
      <Skeleton className="h-4 flex-1 rounded" />
    </div>
  );

  const renderPanelContent = () => (
    <>
      <div className="mb-3">
        <h3 className="block text-xs font-semibold text-gray-700 mb-2">Active Events</h3>
        <div className="flex flex-col gap-1.5">
          {loading
            ? activeEvents.map((event) => (
                <div key={event}>{renderSkeleton()}</div>
              ))
            : activeEvents.map((event) => renderEventButton(event))
          }
        </div>
      </div>
      <div className="pt-2 border-t border-gray-100">
        <h3 className="block text-xs font-semibold text-gray-700 mb-2">Critical facilities</h3>
        <div className="flex flex-col gap-1.5">
          {CRITICAL_FACILITY_LAYERS.map((facility) => renderFacilityButton(facility))}
        </div>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <>
        <AnimatePresence>
          {!isExpanded && (
            <MotionButton
              type="button"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsExpanded(true)}
              className="absolute bottom-28 right-3 z-20 flex items-center gap-2 px-4 py-3 bg-[#324755] text-white rounded-full shadow-lg hover:bg-[#3d5566] transition-colors"
              style={{
                boxShadow: '0 4px 20px rgba(50, 71, 85, 0.35)'
              }}
            >
              <SlidersHorizontal className="w-5 h-5" />
              <span className="text-sm font-semibold">Filters</span>
            </MotionButton>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isExpanded && (
            <>
              <MotionButton
                type="button"
                aria-label="Close event filters"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 bg-black/40 z-30"
                onClick={() => setIsExpanded(false)}
              />

              <MotionDiv
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{
                  type: "spring",
                  damping: 30,
                  stiffness: 300
                }}
                className="absolute bottom-0 left-0 right-0 z-40 bg-white rounded-t-2xl shadow-2xl"
                style={{ maxHeight: "70vh" }}
              >
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-10 h-1 bg-gray-300 rounded-full" />
                </div>

                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-5 h-5 text-[#324755]" />
                    <h3 className="text-base font-bold text-[#324755]">Event Filters</h3>
                  </div>
                  <button
                    type="button"
                    aria-label="Close event filters"
                    onClick={() => setIsExpanded(false)}
                    className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                <div className="p-5 overflow-y-auto" style={{ maxHeight: "calc(70vh - 80px)" }}>
                  {renderPanelContent()}
                </div>
              </MotionDiv>
            </>
          )}
        </AnimatePresence>
      </>
    );
  }

  return (
    <div
      className="absolute bottom-14 right-2 z-30 bg-white rounded-lg shadow-lg border border-gray-200 p-4 min-w-[200px]"
    >
      {renderPanelContent()}
    </div>
  );
};

MapLegend.propTypes = {
  selectedEvents: PropTypes.arrayOf(PropTypes.string),
  setSelectedEvents: PropTypes.func,
  loading: PropTypes.bool,
  eventCounts: PropTypes.array,
  facilityVisibility: PropTypes.object,
  setFacilityVisibility: PropTypes.func,
};

export default MapLegend;
