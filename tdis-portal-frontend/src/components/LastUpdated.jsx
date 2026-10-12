/**
 * @file LastUpdated.jsx
 * @description Simple static indicator for refresh cadence.
 */

import React from 'react';
import PropTypes from 'prop-types';

const LastUpdated = ({ cadence = 'Every 30 minutes' }) => (
  <div className="text-[#334755] text-xs">
    <div className="flex items-center gap-2">
      <span className="font-semibold">Refresh cadence:</span>
      <span>{cadence}</span>
    </div>
  </div>
);

LastUpdated.propTypes = {
  cadence: PropTypes.string,
};

export default LastUpdated;
