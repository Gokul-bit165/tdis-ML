/**
 * @fileoverview EventCards component that displays event statistics in an animated card format.
 * Provides a responsive grid of cards showing different event types and their counts,
 * with loading states and empty data handling.
 *
 * @module EventCards
 * @requires @/components/ui/skeleton
 * @requires framer-motion
 */

import { Skeleton } from '@/components/ui/skeleton.jsx';
import { motion } from 'framer-motion';

const MotionDiv = motion.div;
const MotionImg = motion.img;
const MotionP = motion.p;

/**
 * Animation variants for the container element
 * Controls the initial fade-in and staggered children animations
 * @constant {Object}
 * @property {Object} hidden - Initial state with opacity 0
 * @property {Object} visible - Final state with opacity 1 and staggered children
 * @property {Object} visible.transition - Animation timing configuration
 * @property {number} visible.transition.staggerChildren - Delay between child animations (0.1s)
 */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

/**
 * EventCards Component
 *
 * The main component that renders a collection of event cards showing event statistics.
 * Handles loading states, empty data scenarios, and animated transitions.
 *
 * Features:
 * - Responsive card grid layout
 * - Loading skeleton states
 * - Empty state handling
 * - Animated transitions and hover effects
 * - Event type icons with counts
 * - Consistent styling and branding
 *
 * @component
 * @param {Object} props - Component props
 * @param {Array<{type: string, count: number}>} props.eventCounts - Array of event types and their counts
 * @param {boolean} props.isEventCountsLoading - Loading state indicator
 * @returns {JSX.Element} Event cards, loading skeletons, or empty state message
 *
 * @example
 * ```jsx
 * // Basic usage with data
 * <EventCards
 *   eventCounts={[
 *     { type: 'fire', count: 5 },
 *     { type: 'flood', count: 3 }
 *   ]}
 *   isEventCountsLoading={false}
 * />
 * ```
 *
 * @example
 * ```jsx
 * // Loading state
 * <EventCards
 *   eventCounts={[]}
 *   isEventCountsLoading={true}
 * />
 * ```
 */
const EventCards = ({ eventCounts, isEventCountsLoading }) => {
  return (
    <MotionDiv
      className="flex flex-wrap gap-2 bg-white flex-col"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {isEventCountsLoading ? (
        Array.from({ length: 3 }).map((_, index) => <SkeletonCard key={index} />)
      ) : eventCounts.length === 0 ? (
        <MotionDiv
          className="flex justify-center items-center w-full h-16 text-gray-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          No events data available
        </MotionDiv>
      ) : (
        eventCounts.map(({ type, count }, index) => (
          <EventCard key={type} type={type} count={count} index={index} />
        ))
      )}
    </MotionDiv>
  );
};

/**
 * EventCard Component
 *
 * Individual card component displaying an event type and its count.
 * Includes animated hover effects and icon display.
 *
 * Features:
 * - Animated entrance and hover effects
 * - Event type icon display
 * - Count display with hover animation
 * - Responsive layout
 * - Consistent styling with brand colors
 *
 * @component
 * @param {Object} props - Component props
 * @param {string} props.type - Type of event (e.g., 'fire', 'flood')
 * @param {number} props.count - Number of events of this type
 * @param {number} props.index - Index of the event in the array (used for staggered animation)
 * @returns {JSX.Element} Card with event icon, name, and count
 *
 * @example
 * ```jsx
 * <EventCard
 *   type="fire"
 *   count={5}
 *   index={0}
 * />
 * ```
 */
const EventCard = ({ type, count, index }) => {
  /**
   * Animation variants for individual cards
   * Controls the slide-up animation with staggered delay
   * @constant {Object}
   * @property {Object} hidden - Initial state with opacity 0 and y offset
   * @property {Object} visible - Final state with opacity 1 and y at 0
   * @property {Object} visible.transition - Animation timing configuration
   * @property {number} visible.transition.delay - Staggered delay based on index
   * @property {number} visible.transition.duration - Animation duration (0.3s)
   */
  const cardVariants = {
    hidden: {
      opacity: 0,
      y: 20,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        delay: index * 0.1,
        duration: 0.3,
      },
    },
  };

  return (
    <MotionDiv
      className="flex-1 rounded-[12px] border border-[#CBD1D3] bg-white h-[64px] flex items-center py-3 px-4"
      variants={cardVariants}
      whileHover={{
        backgroundColor: '#F8F9FA',
        borderColor: '#87BCBF',
        transition: { duration: 0.2 },
      }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
    >
      <div className="flex justify-between items-center flex-1">
        <div className="flex items-center gap-3">
          <MotionImg
            src={`/${type}.png`}
            alt={type}
            className="w-10 h-10"
            whileHover={{ scale: 1.1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 10 }}
          />
          <MotionP
            className="text-[18px] font-semibold text-[#334755]"
            whileHover={{ color: '#87BCBF' }}
            transition={{ duration: 0.2 }}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </MotionP>
        </div>

        <MotionP
          className="text-[22px] font-semibold text-[#334755]"
          whileHover={{ scale: 1.1, color: '#87BCBF' }}
          transition={{ type: 'spring', stiffness: 400, damping: 10 }}
        >
          {count}
        </MotionP>
      </div>
    </MotionDiv>
  );
};

/**
 * SkeletonCard Component
 *
 * Loading skeleton component for event cards.
 * Provides a placeholder UI while data is being fetched.
 *
 * Features:
 * - Animated fade-in effect
 * - Placeholder for icon and text
 * - Consistent sizing with actual cards
 * - Smooth transition states
 *
 * @component
 * @returns {JSX.Element} Skeleton card with placeholder content
 *
 * @example
 * ```jsx
 * // Used within EventCards during loading
 * <SkeletonCard />
 * ```
 */
const SkeletonCard = () => {
  return (
    <MotionDiv
      className="flex-1 rounded-[12px] border border-gray-200 bg-white h-[64px] flex items-center py-3 px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex justify-between items-center flex-1">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-full" />
          <Skeleton className="h-6 w-[100px]" />
        </div>
        <Skeleton className="h-8 w-[50px]" />
      </div>
    </MotionDiv>
  );
};

export default EventCards;
