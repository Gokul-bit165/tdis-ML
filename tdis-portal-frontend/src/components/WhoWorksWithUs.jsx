/**
 * @fileoverview WhoWorksWithUs component that showcases the different stakeholders
 * and partners who collaborate with TDIS. Implements an animated grid of cards
 * with hover effects using Framer Motion. Features a responsive design with
 * a background image overlay.
 *
 * @module WhoWorksWithUs
 * @requires react
 * @requires framer-motion
 */
import { motion } from 'framer-motion';

const MotionDiv = motion.div;
const MotionH2 = motion.h2;

import React from 'react';

/**
 * Animation variants for container elements
 * Controls staggered animation of child cards
 * @constant {Object}
 * @property {Object} hidden - Initial state with opacity 0
 * @property {Object} show - Visible state with staggered children animation
 * @property {Object} show.transition - Animation timing and stagger configuration
 */
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
    },
  },
};

/**
 * Animation variants for individual card items
 * Controls fade and slide animations for cards
 * @constant {Object}
 * @property {Object} hidden - Initial state with opacity 0 and y offset
 * @property {Object} show - Visible state with opacity 1 and no offset
 */
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

const backgroundVariants = {
  initial: { opacity: 0 },
  animate: {
    opacity: [0, 1, 1, 0],
    transition: {
      duration: 15,
      repeat: Infinity,
      repeatType: 'loop',
      ease: 'easeInOut',
      times: [0, 0.3, 0.7, 1],
    },
  },
};

/**
 * Card content data for different stakeholder groups
 * @constant {Array<Object>}
 * @property {string} title - Card title/heading
 * @property {string} content - Card description text
 */
const cards = [
  {
    title: 'Public Sector Employees',
    content:
      'TDIS equips emergency managers, city planners, and public officials with powerful tools to make data-informed decisions during all phases of disaster management.',
  },
  {
    title: 'Funders',
    content:
      'Funding from state-level grant providers supports critical data systems that help communities prepare for and recover from emergencies more effectively.',
  },
  {
    title: 'Researchers / Academics',
    content:
      'TDIS connects academic institutions with real-world challenges, facilitating research that improves disaster science and policy.',
  },
  {
    title: 'Texans',
    content:
      'TDIS equips Texans with tools and data to navigate emergencies—from planning ahead to managing recovery.',
  },
];

/**
 * WhoWorksWithUs Component
 *
 * A responsive section that displays information about different stakeholder
 * groups who collaborate with TDIS through an animated grid of cards.
 *
 * Features:
 * - Animated card grid layout
 * - Staggered entrance animations
 * - Hover effects on cards
 * - Responsive design
 * - Background image with overlay
 * - Glassmorphism card design
 * - Shadow effects
 * - Consistent branding
 *
 * Card Categories:
 * - Public Sector Employees: Emergency managers and city planners
 * - Funders: State-level grant providers
 * - Researchers/Academics: Academic institutions
 * - Texans: General public
 *
 * @component
 * @returns {JSX.Element} Stakeholder showcase section
 *
 * @example
 * ```jsx
 * // Basic usage
 * <WhoWorksWithUs />
 * ```
 */
const WhoWorksWithUs = () => {
  return (
    /**
     * Main section container
     * Implements responsive padding and background image
     * Contains title, card grid, and descriptive text
     *
     * @returns {JSX.Element} Stakeholder showcase section
     */
    <section
      id="who-works-with-us"
      className="py-8 px-4 sm:px-6 md:px-8 min-h-[28rem] relative overflow-hidden"
      aria-label="About TDIS section"
    >
      {/* Background layers */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(temp_image_1.png)' }}
      />
      <MotionDiv
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(temp_image_2.png)' }}
        variants={backgroundVariants}
        initial="initial"
        animate="animate"
      />

      {/* Gradient overlay */}
      <div
        className="absolute inset-0 z-10"
        style={{
          background:
            'linear-gradient(to right, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 1) 20%, rgba(255, 255, 255, 1) 40%, rgba(255, 255, 255, 0.9) 60%, rgba(255, 255, 255, 0.6) 80%, rgba(255, 255, 255, 0.5) 100%)',
        }}
      />

      <div className="mx-auto max-w-7xl relative z-20">
        {/* Section title with animation */}
        <MotionH2
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#324755] mb-8"
        >
          About TDIS
        </MotionH2>

        {/* Main content container with cards and text */}
        <div className="flex flex-col lg:flex-row gap-2 items-start">
          {/* Descriptive text blurb */}
          <MotionDiv
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ amount: 0.3 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex-1 lg:max-w-md"
          >
            <div className="pr-6">
              <p className="text-[#324755]/80 leading-relaxed mb-4 font-light">
                The Texas Disaster Information System (TDIS) is a project funded by the{' '}
                <a href="https://www.glo.texas.gov/">
                  <b>Texas General Land Office (GLO)</b>
                </a>{' '}
                and built by{' '}
                <a href="https://idrt.tamug.edu/">
                  <b>
                    Texas A&amp;M University&apos;s Institute for a Disaster Resilient Texas (IDRT)
                  </b>
                </a>
                . It was created in partnership with the{' '}
                <a href="https://www.twdb.texas.gov/">
                  <b>Texas Water Development Board (TWDB)</b>
                </a>{' '}
                and the{' '}
                <a href="https://tdem.texas.gov/">
                  <b>Texas Division of Emergency Management (TDEM)</b>
                </a>
                . The GLO funded the design and development of TDIS, including funding to maintain
                TDIS through 2027.
              </p>
              <p className="text-[#324755]/80 leading-relaxed mb-6 font-light">
                TDIS is a comprehensive data platform intended for natural disaster management in
                Texas. TDIS aims to streamline the ingestion, storage, processing, and utilization
                of disaster-related data, with a focus on improving natural disaster preparedness,
                response, recovery, and mitigation efforts across Texas.
              </p>

              {/* Partner logos */}
              <div className="flex items-center justify-start gap-4 flex-wrap">
                <a
                  href="https://www.glo.texas.gov/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 inline-flex items-center justify-center rounded-lg bg-[#334755] p-1.5 opacity-90 hover:opacity-100 transition-opacity duration-200"
                  title="Texas General Land Office"
                >
                  <img
                    src="/glowhite.png"
                    alt="Texas General Land Office official seal"
                    className="h-9 w-9 object-contain"
                  />
                </a>
                <a
                  href="https://tdem.texas.gov/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0"
                >
                  <img
                    src="/TDEM.png"
                    alt="Texas Division of Emergency Management"
                    className="h-12 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity duration-200"
                  />
                </a>
                <a
                  href="https://www.twdb.texas.gov/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0"
                >
                  <img
                    src="/TWDB.png"
                    alt="Texas Water Development Board"
                    className="h-12 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity duration-200"
                  />
                </a>
              </div>
            </div>
          </MotionDiv>
          {/* Large card container for all stakeholder cards */}
          <MotionDiv
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ amount: 0.3 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex-1 relative"
          >
            {/* Light green SVG border behind the card */}
            <div className="absolute -bottom-[0px] -left-[0px] w-full h-[calc(100%-40px)] z-0 mt-10 lg:mt-0 sm:h-[calc(100%-80px)] md:h-[calc(100%-40px)] lg:h-full">
              <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <rect
                  x="0"
                  y="0"
                  width="100"
                  height="100"
                  fill="none"
                  stroke="#87BCBF"
                  strokeWidth=".75"
                  rx="3"
                />
              </svg>
            </div>

            <div
              className="bg-white/100 backdrop-blur-sm rounded-lg p-2 pt-5 border border-[#324755]/100 border-1 mt-10 lg:mt-0 relative z-10 -translate-x-[-10px] -translate-y-[10px]"
              style={{
                boxShadow:
                  '0px 4px 6px -1px rgba(0, 0, 0, 0.10), 0px 2px 4px -2px rgba(0, 0, 0, 0.10)',
                backgroundImage: 'url(/white_rectangle.png)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              <div className="relative z-30">
                <h3 className="text-3xl text-center font-bold text-[#324755] mb-4">
                  Who works with us?
                </h3>

                {/* Animated card grid container */}
                <MotionDiv
                  variants={container}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ amount: 0.3 }}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-0"
                  role="list"
                  aria-label="Stakeholder cards"
                >
                  {/* Individual stakeholder cards */}
                  {cards.map((card) => (
                    <MotionDiv
                      key={card.title}
                      variants={item}
                      className="rounded-lg p-3 relative min-h-[100px] flex flex-col justify-center"
                      role="listitem"
                    >
                      <div className="absolute inset-0 bg-white/30 rounded-lg  z-10" />
                      <div className="absolute -bottom-[8px] -left-[8px] w-full h-full z-0"></div>
                      <div className="relative z-20">
                        <h4 className="text-lg text-[#324755] leading-tight  font-bold mb-2">
                          {card.title}
                        </h4>
                        <p className="text-sm text-[#324755]/80 font-light">{card.content}</p>
                      </div>
                    </MotionDiv>
                  ))}
                </MotionDiv>
              </div>
            </div>
          </MotionDiv>
        </div>
      </div>
    </section>
  );
};

export default WhoWorksWithUs;
