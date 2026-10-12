import React from 'react';
import PropTypes from 'prop-types';
import { ZoomIn } from 'lucide-react';

/**
 * One row in the OSA summary list.
 * Road closures rows are keyboard/click zoom targets; outage rows are display-only.
 */
export function SummaryListItem({ item, index, isRoadClosures, onItemClick, withTransition = false }) {
    const baseClass =
        'flex items-center justify-between p-2 rounded bg-gray-50 border border-gray-200 hover:bg-gray-100';
    const transitionSuffix = withTransition ? ' transition-colors' : '';

    const interactiveProps = isRoadClosures
        ? {
              role: 'button',
              tabIndex: 0,
              onClick: () => onItemClick(item),
              onKeyDown: (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onItemClick(item);
                  }
              },
              title: 'Click to zoom the map to this county',
              className: `${baseClass}${transitionSuffix} cursor-pointer`,
          }
        : {
              className: `${baseClass}${transitionSuffix}`,
          };

    return (
        <div {...interactiveProps}>
            <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-xs font-bold text-[#324755] w-6 flex-shrink-0">{index + 1}.</span>
                {isRoadClosures ? (
                    <ZoomIn
                        className="w-4 h-4 flex-shrink-0 text-orange-600 shrink-0"
                        aria-label="Click to zoom to this county"
                        title="Click to zoom to this county"
                    />
                ) : null}
                <span className="text-xs font-medium text-gray-700 truncate">{item.name}</span>
            </div>
            <span className="text-xs font-bold text-[#dc2626] ml-2 flex-shrink-0">
                {(item.customersOut || 0).toLocaleString()}
            </span>
        </div>
    );
}

SummaryListItem.propTypes = {
    item: PropTypes.object,
    index: PropTypes.number,
    isRoadClosures: PropTypes.bool,
    onItemClick: PropTypes.func,
    withTransition: PropTypes.bool,
};
