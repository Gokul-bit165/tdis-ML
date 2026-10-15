import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import { Hexagon, Building2, Radar, Loader2 } from 'lucide-react';
import { DAMAGE_VIEWS } from '@/config/damageAssessmentConfig';

const VIEW_OPTIONS = [
  {
    id: DAMAGE_VIEWS.H3,
    label: 'H3 Aggregation',
    description: 'Hexagonal summaries of building damage shares and dominant classes',
    icon: Hexagon,
  },
  {
    id: DAMAGE_VIEWS.BUILDINGS,
    label: 'Building Damage',
    description: 'Individual building footprint classifications (zoom 14+)',
    icon: Building2,
  },
  {
    id: DAMAGE_VIEWS.DENSITY,
    label: 'Building Density',
    description: 'Smoothed building count density heatmap calibrated across all zooms',
    icon: Radar,
  },
];

/**
 * DamageViewSwitcher
 * Three round buttons switching between H3 Aggregation, Building Damage, and Building Density.
 * Positioned inside the map container at bottom-left above the Mapbox scale control and logo.
 */
export default function DamageViewSwitcher({
  activeView = DAMAGE_VIEWS.H3,
  onViewChange,
  isLoadingTiles = false,
}) {
  const buttonRefs = useRef({});

  const handleKeyDown = (e, currentIndex) => {
    let nextIndex = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % VIEW_OPTIONS.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + VIEW_OPTIONS.length) % VIEW_OPTIONS.length;
    }

    if (nextIndex !== null) {
      e.preventDefault();
      const nextView = VIEW_OPTIONS[nextIndex].id;
      if (onViewChange) {
        onViewChange(nextView);
      }
      buttonRefs.current[nextView]?.focus();
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label="Damage map view"
      className="absolute left-4 bottom-14 z-10 flex flex-row items-center gap-2 pointer-events-auto"
    >
      {VIEW_OPTIONS.map((option, idx) => {
        const Icon = option.icon;
        const isActive = activeView === option.id;

        return (
          <div key={option.id} className="relative group flex items-center justify-center">
            <button
              ref={(el) => {
                buttonRefs.current[option.id] = el;
              }}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={option.label}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onViewChange?.(option.id)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              className={`relative flex items-center justify-center rounded-full transition-all duration-150 shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#324755] w-10 h-10 md:w-10 md:h-10 max-sm:w-11 max-sm:h-11 ${
                isActive
                  ? 'bg-[#324755] text-white shadow-lg'
                  : 'bg-white/90 text-slate-700 hover:bg-white hover:text-slate-900 border border-slate-200/60'
              }`}
            >
              {isActive && isLoadingTiles ? (
                <Loader2 className="w-5 h-5 animate-spin text-white" aria-hidden="true" />
              ) : (
                <Icon className="w-5 h-5 transition-transform" aria-hidden="true" />
              )}
            </button>
            <span
              role="tooltip"
              className="pointer-events-none absolute bottom-full mb-2 hidden group-hover:block group-focus-visible:block whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white shadow-md z-30"
            >
              {option.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

DamageViewSwitcher.propTypes = {
  activeView: PropTypes.string,
  onViewChange: PropTypes.func.isRequired,
  isLoadingTiles: PropTypes.bool,
};
