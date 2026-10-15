import React from 'react';
import PropTypes from 'prop-types';
import { X, ZoomIn, Loader2 } from 'lucide-react';
import { getDamageClassInfo, DAMAGE_CLASSES } from '@/config/damageAssessmentConfig';

/**
 * DamageDetailPanel
 * Displays details for a selected H3 hexagon or individual building footprint.
 */
export default function DamageDetailPanel({
  selectedCell,
  selectedBuilding,
  isLoadingBuilding = false,
  buildingError = null,
  onClose,
  onZoomToCell,
}) {
  if (!selectedCell && !selectedBuilding && !isLoadingBuilding && !buildingError) {
    return null;
  }

  return (
    <div
      className="absolute top-16 sm:top-[4.5rem] right-2 sm:right-14 z-20 w-80 max-w-[calc(100vw-1.5rem)] rounded-lg bg-white/95 p-4 shadow-xl border border-slate-200/80 backdrop-blur-xs pointer-events-auto"
      role="region"
      aria-label="Selection details"
    >
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <h3 className="text-sm font-semibold text-slate-900">
          {selectedBuilding || isLoadingBuilding || buildingError
            ? 'Building Details'
            : 'Hexagon Details'}
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details panel"
          className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-3 text-xs text-slate-700 space-y-2.5">
        {/* Loading building details */}
        {isLoadingBuilding && (
          <div className="flex items-center justify-center py-6 text-slate-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#324755]" />
            <span>Loading building details...</span>
          </div>
        )}

        {/* Building 404 / Error */}
        {!isLoadingBuilding && buildingError && (
          <div className="py-3 text-amber-800 bg-amber-50 p-2.5 rounded border border-amber-200">
            {buildingError.status === 404 || String(buildingError).includes('404')
              ? 'This building is no longer available.'
              : 'Failed to load building details.'}
          </div>
        )}

        {/* Building details */}
        {!isLoadingBuilding && selectedBuilding && !buildingError && (
          <div className="space-y-2">
            <div className="flex justify-between items-baseline gap-2">
              <span className="text-slate-500 font-medium">Building ID:</span>
              <span className="font-mono text-slate-900 select-all font-semibold">
                {selectedBuilding.building_id}
              </span>
            </div>

            <div className="flex justify-between items-center gap-2">
              <span className="text-slate-500 font-medium">Damage Class:</span>
              {(() => {
                const info = getDamageClassInfo(selectedBuilding.damage_class);
                return (
                  <span
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold text-white shadow-2xs"
                    style={{ backgroundColor: info.color }}
                  >
                    {info.label}
                  </span>
                );
              })()}
            </div>

            {selectedBuilding.assessed_at && (
              <div className="flex justify-between items-baseline gap-2">
                <span className="text-slate-500 font-medium">Assessed:</span>
                <span className="text-slate-900">
                  {new Date(selectedBuilding.assessed_at).toLocaleDateString()}
                </span>
              </div>
            )}

            {(selectedBuilding.imagery_date || selectedBuilding.imagery_ref) && (
              <div className="flex justify-between items-baseline gap-2">
                <span className="text-slate-500 font-medium">Imagery:</span>
                <span className="text-slate-900">
                  {selectedBuilding.imagery_date || selectedBuilding.imagery_ref}
                </span>
              </div>
            )}

            {selectedBuilding.model && (
              <div className="flex justify-between items-baseline gap-2">
                <span className="text-slate-500 font-medium">Model:</span>
                <span className="text-slate-900">{selectedBuilding.model}</span>
              </div>
            )}

            {/* Render confidence only when not null */}
            {selectedBuilding.confidence !== null && selectedBuilding.confidence !== undefined && (
              <div className="flex justify-between items-baseline gap-2">
                <span className="text-slate-500 font-medium">Confidence:</span>
                <span className="text-slate-900 font-medium">
                  {(Number(selectedBuilding.confidence) * 100).toFixed(1)}%
                </span>
              </div>
            )}

            {/* Render damage_pct only when not null */}
            {selectedBuilding.damage_pct !== null && selectedBuilding.damage_pct !== undefined && (
              <div className="flex justify-between items-baseline gap-2">
                <span className="text-slate-500 font-medium">Damage %:</span>
                <span className="text-slate-900 font-medium">
                  {Number(selectedBuilding.damage_pct).toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        )}

        {/* Hexagon cell details */}
        {!selectedBuilding && !isLoadingBuilding && !buildingError && selectedCell && (
          <div className="space-y-2.5">
            <div className="flex justify-between items-baseline gap-2">
              <span className="text-slate-500 font-medium">H3 Index:</span>
              <span className="font-mono text-slate-900 select-all font-semibold">
                {selectedCell.h3}
              </span>
            </div>

            {selectedCell.res !== undefined && (
              <div className="flex justify-between items-baseline gap-2">
                <span className="text-slate-500 font-medium">Resolution:</span>
                <span className="text-slate-900 font-medium">{selectedCell.res}</span>
              </div>
            )}

            <div className="flex justify-between items-baseline gap-2">
              <span className="text-slate-500 font-medium">Total Buildings:</span>
              <span className="text-slate-900 font-semibold">{selectedCell.n ?? 0}</span>
            </div>

            <div className="flex justify-between items-baseline gap-2">
              <span className="text-slate-500 font-medium">Assessed:</span>
              <span className="text-slate-900 font-semibold">{selectedCell.na ?? 0}</span>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <span className="text-slate-500 font-medium block mb-1.5">Class Breakdown:</span>
              <div className="space-y-1">
                {[0, 1, 2, 3, 4].map((c) => {
                  const classInfo = DAMAGE_CLASSES[c];
                  const count = selectedCell[`c${c}`] ?? 0;
                  return (
                    <div key={c} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: classInfo.color }}
                        />
                        <span className="text-slate-600 truncate">{classInfo.label}</span>
                      </div>
                      <span className="font-medium text-slate-900">{count}</span>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between pt-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-[#9CA3AF]" />
                    <span className="text-slate-600">Not Assessed</span>
                  </div>
                  <span className="font-medium text-slate-900">
                    {Math.max(0, (selectedCell.n ?? 0) - (selectedCell.na ?? 0))}
                  </span>
                </div>
              </div>
            </div>

            {onZoomToCell && (
              <button
                type="button"
                onClick={() => onZoomToCell(selectedCell)}
                className="mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md bg-[#324755] text-white hover:bg-slate-800 transition-colors text-xs font-medium shadow-2xs"
              >
                <ZoomIn className="w-3.5 h-3.5" />
                <span>Zoom to buildings</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

DamageDetailPanel.propTypes = {
  selectedCell: PropTypes.object,
  selectedBuilding: PropTypes.object,
  isLoadingBuilding: PropTypes.bool,
  buildingError: PropTypes.any,
  onClose: PropTypes.func.isRequired,
  onZoomToCell: PropTypes.func,
};
