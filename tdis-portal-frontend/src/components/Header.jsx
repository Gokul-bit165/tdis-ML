/**
 * @fileoverview Header component that provides the main navigation bar for the application.
 * Includes logo links, navigation buttons, and smooth scrolling functionality.
 * Implements responsive design and animated interactions using Framer Motion.
 *
 * @module Header
 * @requires react-router-dom
 * @requires react
 * @requires framer-motion
 */

import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { trackEvent, trackOutboundClick, NAVIGATION } from '../utils/googleAnalytics.js';

const MotionButton = motion.button;

/**
 * Header Component
 *
 * A responsive navigation header component that provides:
 * - Logo links to partner organizations
 * - Navigation buttons with smooth scrolling
 * - Animated interactions
 * - Responsive design for different screen sizes
 *
 * Features:
 * - Smooth scrolling to sections
 * - Cross-page navigation with scroll position memory
 * - Animated button interactions
 * - Responsive logo sizing
 * - External link handling
 * - Brand-consistent styling
 *
 * @component
 * @returns {JSX.Element} Navigation header with logos and navigation buttons
 *
 * @example
 * ```jsx
 * // Basic usage
 * <Header />
 * ```
 */

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();

  /**
   * Effect hook to handle scroll-to-section functionality
   * Checks for scroll target in location state and performs smooth scroll
   * Clears the scroll target after execution
   *
   * @effect
   * @listens location
   * @listens navigate
   */
  useEffect(() => {
    // Check if we have a scroll target in the location state
    if (location.state?.scrollTo) {
      const sectionId = location.state.scrollTo;
      const element = document.getElementById(sectionId);
      if (element) {
        // Small delay to ensure the page has rendered
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
      // Clear the scroll target from state
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  /**
   * Handles navigation and scrolling to a specific section
   * If not on home page, navigates to home with scroll target
   * If on home page, performs smooth scroll to section
   *
   * @function
   * @param {string} sectionId - The ID of the section to scroll to
   * @returns {void}
   *
   * @example
   * // Scroll to 'what-we-do' section
   * scrollToSection('what-we-do');
   */
  const scrollToSection = (sectionId) => {
    trackEvent(NAVIGATION, NAVIGATION, { tab: 'home', section: sectionId, event_label: sectionId });
    // If we're not on the home page, navigate there first
    if (window.location.pathname !== '/') {
      navigate('/', { state: { scrollTo: sectionId } });
      return;
    }

    // If we're already on home page, just scroll
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  /**
   * Animation properties for navigation buttons
   * @constant {Object}
   * @property {Object} whileHover - Hover state animation
   * @property {Object} whileTap - Tap state animation
   * @property {Object} transition - Animation timing configuration
   */
  const buttonAnimationProps = {
    whileHover: {
      scale: 1.05,
      backgroundColor: '#87BCBF',
      transition: { duration: 0.2 },
    },
    whileTap: { scale: 0.95 },
    transition: { type: 'spring', stiffness: 400, damping: 10 },
  };

  return (
    /**
     * Header container with responsive padding and background
     * Contains two main sections:
     * 1. Left section: Partner logos (TDIS and GLO)
     * 2. Right section: Navigation buttons and TAMU logo
     *
     * @returns {JSX.Element} Header layout structure
     */
    <div
      className={
        'px-2 sm:px-3 md:px-5 py-2 sm:py-3 md:py-4 bg-[#334755] flex justify-between items-center'
      }
    >
      <div className="flex items-center gap-2 sm:gap-3 md:gap-5 cursor-pointer">
        {/* TDIS Logo */}
        <a
          href="https://idrt.tamug.edu/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Visit TDIS website"
          onClick={() => trackOutboundClick('https://idrt.tamug.edu/')}
        >
          <img
            src="/tdislogo-white.png"
            alt="TDIS Logo"
            className="h-7 sm:h-8 md:h-9 transition-transform duration-300 hover:scale-105 hover:rotate-1"
          />
        </a>
        {/* GLO Logo */}
        <a
          href="https://glo.texas.gov/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Visit GLO website"
          onClick={() => trackOutboundClick('https://glo.texas.gov/')}
        >
          <img
            src="/glowhite.png"
            alt="Texas General Land Office official seal"
            className="h-7 sm:h-8 md:h-9 transition-transform duration-300 hover:scale-105 hover:-rotate-1"
          />
        </a>
      </div>

      {/* Right section: Navigation and TAMU logo */}
      <div className="flex items-center gap-10">
        {/* Navigation buttons */}
        <div className="flex gap-2 items-center">
          <MotionButton
            onClick={() => scrollToSection('what-we-do')}
            className="bg-none text-white px-4 py-2 rounded-[100px] font-bold cursor-pointer"
            {...buttonAnimationProps}
          >
            What We Do
          </MotionButton>
          <MotionButton
            onClick={() => scrollToSection('who-works-with-us')}
            className="bg-none text-white px-4 py-2 rounded-[100px] font-bold cursor-pointer"
            {...buttonAnimationProps}
          >
            About TDIS
          </MotionButton>
          <MotionButton
            onClick={() => scrollToSection('contact-us')}
            className="bg-none text-white px-4 py-2 rounded-[100px] font-bold cursor-pointer"
            {...buttonAnimationProps}
          >
            Contact Us
          </MotionButton>
        </div>
        {/* TAMU Logo */}
        <a
          href="https://www.tamu.edu/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Visit Texas A&M University website"
          onClick={() => trackOutboundClick('https://www.tamu.edu/')}
        >
          <img
            src="/tamulogo-white.png"
            alt="Texas A&M University Logo"
            className="h-7 sm:h-8 md:h-9 transition-transform duration-300 hover:rotate-1"
          />
        </a>
      </div>
    </div>
  );
};

export default Header;
