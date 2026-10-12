/**
 * @fileoverview AppDatasetIntake component that displays a section for application/datasets intake information
 * with animated elements using Framer Motion.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { trackEvent, DATASET_INTAKE } from '../utils/googleAnalytics.js';

const MotionDiv = motion.div;
const MotionH2 = motion.h2;
const MotionButton = motion.button;

/**
 * Animation variants for the container element
 * @constant {Object}
 */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.6,
      staggerChildren: 0.2,
    },
  },
};

/**
 * Animation variants for child elements
 * @constant {Object}
 */
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

/**
 * AppDatasetIntake Component
 *
 * A React component that renders a section displaying information about the application/datasets
 * intake process. It includes animated elements using Framer Motion for enhanced user experience.
 *
 * Features:
 * - Animated entrance effects for all elements
 * - Responsive design with Tailwind CSS
 * - Interactive button with hover and tap animations
 * - Navigation to application intake page
 *
 * @component
 * @returns {JSX.Element} Rendered component
 *
 * @example
 * ```jsx
 * <AppDatasetIntake />
 * ```
 */
const AppDatasetIntake = () => {
  const navigate = useNavigate();

  /**
   * Handles the click event on the view button
   * Navigates to the application intake page
   * @function
   */
  const handleViewClick = () => {
    trackEvent(DATASET_INTAKE, DATASET_INTAKE, { tab: 'home', action: 'open_form', event_label: 'open_form' });
    navigate('/application-in-take');
  };

  return (
    <section
      id="app-dataset-intake"
      className="py-16 px-4 sm:px-6 md:px-8 min-h-[13.90625rem] relative"
      aria-label="Application and Datasets Submission"
    >
      {/* Gradient background */}
      <div
        className="absolute inset-0 z-0"
        style={{
          background:
            'linear-gradient(to bottom right, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 1) 20%, rgba(255, 255, 255, 1) 40%, rgba(250, 250, 250, 1) 60%, rgba(221, 225, 255, 0.14) 80%, rgba(125, 142, 161, 0.22) 95%)',
        }}
      />

      <MotionDiv
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ amount: 0.3 }}
        className="mx-auto max-w-6xl relative z-10"
      >
        <MotionH2
          variants={itemVariants}
          className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#324755] mb-6 text-center"
        >
          Application/Datasets In-Take Process
        </MotionH2>
        <motion.p
          variants={itemVariants}
          className="text-center text-[18px] text-[#324755] mb-12 font-light"
        >
          Individuals or organizations with ideas for new applications or who want to contribute
          their local datasets are encouraged to submit a request to the TDIS Working Committee for
          review and further consideration.
        </motion.p>

        <MotionDiv variants={itemVariants} className="flex justify-center">
          <MotionButton
            onClick={handleViewClick}
            whileHover={{
              scale: 1.05,
              backgroundColor: '#4A6B7A',
              transition: { duration: 0.2 },
            }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 10 }}
            className="bg-[#324755] text-white px-6 py-2 rounded-lg font-bold cursor-pointer hover:shadow-lg hover:shadow-[#87BCBF]/20"
            aria-label="View application intake process"
          >
            Click to view
          </MotionButton>
        </MotionDiv>
      </MotionDiv>
    </section>
  );
};

export default AppDatasetIntake;
