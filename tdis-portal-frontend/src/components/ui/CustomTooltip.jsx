import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

const MotionDiv = motion.div;

const TRANSPARENT_BORDER_SIDE = '6px solid transparent';

/**
 * Custom Tooltip Component
 * Uses React Portal to render tooltip outside of parent overflow containers
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - The element to attach the tooltip to
 * @param {React.ReactNode} props.content - Tooltip content (text or JSX)
 * @param {number} props.delay - Delay before showing tooltip (default: 300ms)
 * @param {string} props.position - Preferred position: 'top' | 'bottom' (default: 'bottom')
 * @param {boolean} [props.multiline] - When true, tooltip wraps text and uses a max width (for longer help copy)
 */
const CustomTooltip = ({
  children,
  content,
  delay = 300,
  position = 'bottom',
  multiline = false,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState(null);
  const [tooltipStyle, setTooltipStyle] = useState({});
  const [actualPosition, setActualPosition] = useState(position);
  const containerRef = useRef(null);
  const tooltipRef = useRef(null);
  const [isPositioned, setIsPositioned] = useState(false);

  const calculatePosition = useCallback(() => {
    if (!containerRef.current || !tooltipRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const gap = 8;
    const padding = 12;

    let positionToUse = position;

    // Check if tooltip would go below viewport
    if (position === 'bottom' && rect.bottom + tooltipRect.height + gap > viewportHeight) {
      positionToUse = 'top';
    }
    // Check if tooltip would go above viewport
    else if (position === 'top' && rect.top - tooltipRect.height - gap < 0) {
      positionToUse = 'bottom';
    }

    // Calculate top position
    let top = positionToUse === 'top' ? rect.top - gap : rect.bottom + gap;

    // Calculate horizontal position - center on trigger, but constrain to viewport
    const triggerCenterX = rect.left + rect.width / 2;
    let left = triggerCenterX - tooltipRect.width / 2;

    // Constrain to viewport edges
    if (left < padding) {
      left = padding;
    } else if (left + tooltipRect.width > viewportWidth - padding) {
      left = viewportWidth - tooltipRect.width - padding;
    }

    setActualPosition(positionToUse);
    setTooltipStyle({
      top: top,
      left: left,
      transform: positionToUse === 'top' ? 'translateY(-100%)' : '',
    });
    setIsPositioned(true);
  }, [position]);

  const handleMouseEnter = () => {
    const id = setTimeout(() => {
      setIsVisible(true);
      setIsPositioned(false);
    }, delay);
    setTimeoutId(id);
  };

  const handleMouseLeave = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      setTimeoutId(null);
    }
    setIsVisible(false);
    setIsPositioned(false);
  };

  // Calculate position after tooltip is rendered
  useLayoutEffect(() => {
    if (isVisible && tooltipRef.current) {
      calculatePosition();
    }
  }, [isVisible, calculatePosition]);

  // Recalculate position on scroll/resize while visible
  useEffect(() => {
    if (!isVisible) return;

    const handleUpdate = () => calculatePosition();
    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);

    return () => {
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [isVisible, calculatePosition]);

  const getAnimationProps = () => {
    if (actualPosition === 'top') {
      return {
        initial: { opacity: 0, scale: 0.95, y: 5 },
        animate: { opacity: isPositioned ? 1 : 0, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.95, y: 5 },
      };
    }
    return {
      initial: { opacity: 0, scale: 0.95, y: -5 },
      animate: { opacity: isPositioned ? 1 : 0, scale: 1, y: 0 },
      exit: { opacity: 0, scale: 0.95, y: -5 },
    };
  };

  const hasContent = content != null && (typeof content !== 'string' || content.trim().length > 0);

  const tooltipContent = isVisible && hasContent && (
    <AnimatePresence>
      <MotionDiv
        ref={tooltipRef}
        {...getAnimationProps()}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className={`fixed z-[9999] text-white bg-gray-900 rounded-lg shadow-lg pointer-events-none ${
          multiline
            ? 'max-w-xs px-3 py-2.5 text-xs font-normal text-left whitespace-normal leading-snug sm:max-w-sm'
            : 'px-3 py-2 text-xs font-medium whitespace-nowrap'
        }`}
        style={tooltipStyle}
      >
        {content}
        {/* Arrow - positioned at trigger center */}
        <div
          className="absolute"
          style={{
            width: 0,
            height: 0,
            left: containerRef.current
              ? containerRef.current.getBoundingClientRect().left +
                containerRef.current.getBoundingClientRect().width / 2 -
                (tooltipStyle.left || 0)
              : '50%',
            transform: 'translateX(-50%)',
            ...(actualPosition === 'top'
              ? {
                  bottom: '-5px',
                  borderLeft: TRANSPARENT_BORDER_SIDE,
                  borderRight: TRANSPARENT_BORDER_SIDE,
                  borderTop: '6px solid rgb(17, 24, 39)',
                }
              : {
                  top: '-5px',
                  borderLeft: TRANSPARENT_BORDER_SIDE,
                  borderRight: TRANSPARENT_BORDER_SIDE,
                  borderBottom: '6px solid rgb(17, 24, 39)',
                }),
          }}
        />
      </MotionDiv>
    </AnimatePresence>
  );

  return (
    <div
      ref={containerRef}
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {typeof document !== 'undefined' && createPortal(tooltipContent, document.body)}
    </div>
  );
};

export default CustomTooltip;
