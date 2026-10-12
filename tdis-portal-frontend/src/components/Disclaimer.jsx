/**
 * @fileoverview Disclaimer component that displays a blocking disclaimer screen
 * until the user accepts the terms. Always shows on app load (controlled by parent).
 *
 * @module Disclaimer
 * @requires ./config/disclaimerConfig
 * @requires ./Disclaimer.css
 */

import PropTypes from 'prop-types';
import { disclaimerConfig } from '../config/disclaimerConfig.js';
import './Disclaimer.css';

/**
 * Disclaimer Component
 *
 * A full-screen overlay that blocks access to the application until the user
 * accepts the disclaimer terms. Visibility is controlled by the parent component.
 * Always displays when rendered - no localStorage checks.
 *
 * Features:
 * - Always visible when rendered (parent controls visibility)
 * - Two-panel layout (left: logo/title, right: content/button)
 * - Handles accept button click and calls onAccept callback
 * - Fully configurable via disclaimerConfig
 *
 * @component
 * @param {Object} props - Component props
 * @param {Function} [props.onAccept] - Callback function called when user accepts
 * @returns {JSX.Element} Disclaimer overlay
 *
 * @example
 * ```jsx
 * <Disclaimer onAccept={() => console.log('Accepted')} />
 * ```
 */
const Disclaimer = ({ onAccept }) => {
  /**
   * Handles the accept button click
   * Hides the disclaimer and calls optional onAccept callback
   * Note: localStorage is not checked - disclaimer always shows on app load
   *
   * @function
   * @returns {void}
   */
  const handleAccept = () => {
    if (onAccept) {
      onAccept();
    }
  };

  return (
    <div className="disclaimer-overlay">
      <div className="disclaimer-container">
        {/* Left Panel */}
        <div className="disclaimer-left-panel">
          <div className="disclaimer-left-content">
            {/* TDIS Logo Section */}
            {disclaimerConfig.tdisLogo && (
              <div className="disclaimer-logo-section disclaimer-tdis-section">
                <img
                  src={disclaimerConfig.tdisLogo}
                  alt="TDIS Logo"
                  className="disclaimer-tdis-logo"
                />
              </div>
            )}

            {/* Texas A&M University Logo Section */}
            {disclaimerConfig.tamuLogo && (
              <div className="disclaimer-logo-section disclaimer-tamu-section">
                <img
                  src={disclaimerConfig.tamuLogo}
                  alt="Texas A&M University Logo"
                  className="disclaimer-tamu-logo"
                />
              </div>
            )}

            {/* IDRT Logo Section */}
            {disclaimerConfig.idrtLogo && (
              <div className="disclaimer-logo-section disclaimer-idrt-section">
                <img
                  src={disclaimerConfig.idrtLogo}
                  alt="IDRT Logo"
                  className="disclaimer-idrt-logo"
                />
              </div>
            )}

            {/* Footer */}
            {disclaimerConfig.footerPoweredBy && (
              <div className="disclaimer-footer">
                <p className="disclaimer-footer-text">{disclaimerConfig.footerPoweredBy}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel */}
        <div className="disclaimer-right-panel">
          <div className="disclaimer-content">
            {/* Welcome Section */}
            {disclaimerConfig.welcomeText && (
              <p className="disclaimer-welcome-text">{disclaimerConfig.welcomeText}</p>
            )}
            {disclaimerConfig.welcomeTitle && (
              <h2 className="disclaimer-welcome-title">{disclaimerConfig.welcomeTitle}</h2>
            )}

            {/* Information Section */}
            {disclaimerConfig.informationText && (
              <p className="disclaimer-information-text">{disclaimerConfig.informationText}</p>
            )}
            {disclaimerConfig.informationLink && (
              <a
                href={disclaimerConfig.informationLink}
                target="_blank"
                rel="noopener noreferrer"
                className="disclaimer-information-link"
              >
                {disclaimerConfig.informationLinkText}
              </a>
            )}

            {/* Disclaimer Section */}
            {disclaimerConfig.disclaimerTitle && (
              <h3 className="disclaimer-disclaimer-title">{disclaimerConfig.disclaimerTitle}</h3>
            )}
            {disclaimerConfig.disclaimerText && (
              <div className="disclaimer-disclaimer-text">
                {disclaimerConfig.disclaimerText.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            )}
          </div>

          {/* Button Container */}
          <div className="disclaimer-button-container">
            <button onClick={handleAccept} className="disclaimer-accept-button">
              {disclaimerConfig.acceptButtonText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

Disclaimer.propTypes = {
  onAccept: PropTypes.func,
};

export default Disclaimer;
