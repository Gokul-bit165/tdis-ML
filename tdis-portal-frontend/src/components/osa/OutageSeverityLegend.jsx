import React from 'react';

const SEVERITY_LEVELS = [
  { color: '#4A90D9', label: '1 - 50' },
  { color: '#5BC0DE', label: '51 - 100' },
  { color: '#7FD4A6', label: '101 - 250' },
  { color: '#5CB85C', label: '251 - 500' },
  { color: '#B8D935', label: '501 - 1,000' },
  { color: '#F0D735', label: '1,001 - 1,500' },
  { color: '#F5A623', label: '1,501 - 2,000' },
  { color: '#A67C52', label: '2,001 - 3,000' },
  { color: '#8B2E2E', label: '3,001+' },
];

/**
 * 9-level "Customers Out" outage severity legend.
 * Used in mobile Legend tab and desktop control panel.
 */
export function OutageSeverityLegend() {
  return (
    <div className="pt-3 border-t border-gray-200">
      <label className="block text-xs font-semibold text-gray-700 mb-2">Customers Out</label>
      <div className="space-y-1">
        {SEVERITY_LEVELS.map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-sm flex-shrink-0"
              style={{ backgroundColor: color, opacity: 0.8 }}
            />
            <span className="text-[10px] text-gray-600">{label}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 pt-3 border-t border-gray-100 text-[10px] text-gray-500 text-center leading-snug">
        Data source:{' '}
        <a
          href="https://poweroutage.com"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-gray-600 underline decoration-gray-300 underline-offset-2 hover:text-[#324755] hover:decoration-[#324755]"
        >
          Poweroutage.com
        </a>
      </p>
    </div>
  );
}
