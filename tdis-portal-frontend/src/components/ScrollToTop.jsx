/**
 * @fileoverview ScrollToTop component that provides a floating button to smoothly scroll
 * to the top of the page. Implements animated transitions and hover effects using
 * Framer Motion. Includes accessibility features and responsive design.
 *
 * @module ScrollToTop
 * @requires react
 * @requires lucide-react
 * @requires framer-motion
 * @requires ../lib/utils
 */

import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MotionButton = motion.button;
const MotionDiv = motion.div;
import { cn } from '../lib/utils';

/**
 * ScrollToTop Component
 *
 * A floating action button that appears when the user scrolls down the page,
 * allowing them to quickly return to the top with a smooth animation.
 *
 * Features:
 * - Appears after scrolling 300px down
 * - Smooth scroll animation
 * - Animated entrance and exit
 * - Hover and tap animations
 * - Continuous arrow animation
 * - Accessible button
 * - Responsive design
 * - Shadow effects
 * - Brand-consistent styling
 *
 * Animation States:
 * - Initial: Fade in and scale up from bottom
 * - Hover: Scale up and color change
 * - Tap: Scale down
 * - Exit: Fade out and scale down
 * - Arrow: Continuous floating animation
 *
 * @component
 * @returns {JSX.Element} Floating scroll-to-top button
 *
 * @example
 * ```jsx
 * // Basic usage
 * <ScrollToTop />
 * ```
 */
const ScrollToTop = () => {
  /**
   * State for controlling button visibility
   * @type {[boolean, Function]} Visibility state and setter
   * @default false
   */
  const [isVisible, setIsVisible] = useState(false);

  /**
   * Toggles button visibility based on scroll position
   * Shows button when page is scrolled more than 300px
   * Hides button when near the top
   *
   * @function
   * @private
   */
  const toggleVisibility = () => {
    if (window.scrollY > 300) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  };

  /**
   * Effect hook to manage scroll event listener
   * Adds scroll event listener on mount
   * Removes listener on cleanup
   *
   * @effect
   * @listens window.scroll
   */
  useEffect(() => {
    window.addEventListener('scroll', toggleVisibility);
    return () => {
      window.removeEventListener('scroll', toggleVisibility);
    };
  }, []);

  /**
   * Scrolls the window to the top with smooth animation
   *
   * @function
   * @private
   */
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  return (
    /**
     * Animated button container
     * Manages button presence and animations
     *
     * @returns {JSX.Element} Scroll to top button with animations
     */
    <AnimatePresence>
      {isVisible && (
        <MotionButton
          onClick={scrollToTop}
          aria-label="Scroll to top"
          initial={{ opacity: 0, y: 20, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.8 }}
          transition={{
            type: 'spring',
            stiffness: 400,
            damping: 20,
          }}
          whileHover={{
            scale: 1.1,
            backgroundColor: '#4A6B7A',
            transition: { duration: 0.2 },
          }}
          whileTap={{ scale: 0.95 }}
          className={cn(
            'cursor-pointer',
            'fixed bottom-5 right-5 w-10 h-10 rounded-full z-50',
            'bg-[#87BCBF] text-[#324755]',
            'flex items-center justify-center',
            'shadow-md',
            'hover:shadow-lg hover:shadow-[#87BCBF]/20'
          )}
        >
          {/* Animated arrow icon */}
          <MotionDiv
            animate={{ y: [0, -2, 0] }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            <ArrowUp size={24} />
          </MotionDiv>
        </MotionButton>
      )}
    </AnimatePresence>
  );
};

export default ScrollToTop;
