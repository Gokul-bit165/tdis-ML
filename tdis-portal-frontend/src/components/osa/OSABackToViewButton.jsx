import React from 'react';
import { Undo2 } from 'lucide-react';

/**
 * "Back to previous view" button shown after Zoom to county (Road Weather Hazard Alerts layer).
 */
export function OSABackToViewButton({ onBack, title = 'Return to your previous map position' }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="absolute bottom-[100px] left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 px-4 py-2.5 bg-white text-[#324755] rounded-lg shadow-md border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-colors"
      style={{ pointerEvents: 'auto' }}
      title={title}
    >
      <Undo2 className="w-5 h-5 shrink-0 text-[#324755]" aria-hidden />
      <span className="flex flex-col items-start text-left">
        <span className="text-sm font-semibold leading-tight">Back to previous view</span>
        <span className="text-xs text-gray-500 font-normal leading-tight mt-0.5">
          Return to last map position
        </span>
      </span>
    </button>
  );
}
