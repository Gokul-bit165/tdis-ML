import React from 'react';
import { LAYER_CONFIG } from '../../config/osaLayerConfig';
import { trackLayerToggle } from '../../utils/googleAnalytics.js';

/**
 * Shared layer selector: list of LAYER_CONFIG buttons.
 * Used in mobile Legend tab and desktop control panel.
 */
export function LayerSelector({ selectedLayer, onSelectLayer, setViewMode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-2">Data Layer</label>
      <div className="flex flex-col gap-1.5">
        {Object.values(LAYER_CONFIG).map((layer) => {
          const LayerIcon = layer.icon;
          const isSelected = selectedLayer === layer.id;
          return (
            <button
              key={layer.id}
              onClick={() => {
                trackLayerToggle({
                  layer_name: layer.id,
                  tab: 'osa',
                });
                onSelectLayer(layer.id);
                if (layer.id === 'road_closures') setViewMode('county');
              }}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-semibold transition-all duration-200 ${
                isSelected
                  ? 'bg-[#324755] text-white shadow-sm'
                  : 'text-gray-600 hover:text-[#324755] hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <LayerIcon
                className="w-4 h-4"
                style={{ color: isSelected ? 'white' : layer.color }}
              />
              <span className="flex-1 text-left">{layer.name}</span>
              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white"></div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
