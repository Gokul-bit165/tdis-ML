/**
 * @fileoverview WhatWeDo component that showcases the organization's main services and capabilities
 * through an interactive tabbed interface. Implements animated transitions and responsive design
 * using Framer Motion. Features video and image content with consistent branding.
 *
 * @module WhatWeDo
 * @requires react
 * @requires framer-motion
 * @requires ./utils/googleAnalytics
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const MotionButton = motion.button;
import { trackToolClick, trackFilterChange } from '../utils/googleAnalytics.js';

const tools = [
  {
    id: 'protect',
    title: 'Protect property',
    description:
      'Buyers Aware provides property-specific disaster risk information for potential homebuyers.',
    video: '/buyers-aware.mp4',
    tags: ['Mitigate', 'Recover'],
    url: 'https://buyersaware.org/',
  },
  {
    id: 'prepare',
    title: 'Find disaster data',
    description:
      'The Data & Models Query Tool (DMQT) provides emergency agencies and communities the ability to search, discover, and reuse models stored on the TDIS platform.',
    video: '/data_models.mp4',
    tags: ['Mitigate', 'Prepare', 'Recover'],
    url: 'https://dmqt.cloud.tdis.io/',
  },
  {
    id: 'mitigation',
    title: 'Mitigation Assistance for Tailoring Choices',
    description:
      'MATCH tool aims to support communities pursuing flood mitigation and resilience projects.',
    image: '/match.webp',
    tags: ['Mitigate', 'Recover'],
    url: 'https://findfundingtx.cloud.tdis.io/',
  },
  {
    id: 'risk',
    title: 'Risk Assessment Mapping Portal',
    description:
      'RAMP enables planners to create maps, charts, and download data for local hazard mitigation planning.',
    image: '/ramp.webp',
    tags: ['Mitigate', 'Recover'],
    url: 'https://ramp.cloud.tdis.io/',
  },
  {
    id: 'help-people',
    title: 'Track flood hazard models',
    description:
      'Measuring, Mapping, and Managing Flood Risk in Texas (M3FR) improves flood risk communication by integrating multiple types of flood risk and hazard models.',
    video: '/m3fr.mp4',
    tags: ['Mitigate', 'Prepare'],
    url: 'https://floodmodels.cloud.tdis.io/',
  },
  {
    id: 'coordinate',
    title: 'Coordinate information gathering ',
    description:
      'In partnership with the Texas Water Development Board, our Model Management and Storage Solution (MS2) collects complex flood models from regional engineers all across Texas.',
    image: '/ms2.webp',
    tags: ['Prepare', 'Recover'],
    url: 'https://twdb.cloud.tdis.io/',
  },
  {
    id: 'metadata',
    title: 'Update information',
    description:
      'TDIS Metadata portal creates an easy way of creating and uploading metadata for Hydraulic and Hydrologic models.',
    video: '/tdis_meta.mp4',
    tags: ['Mitigate'],
    url: 'https://tdismeta.cloud.tdis.io/login',
  },
];

/**
 * WhatWeDo Component
 *
 * An interactive section that presents the organization's main services through
 * a tabbed interface with animated transitions and rich media content.
 *
 * Features:
 * - Interactive tab navigation
 * - Animated content transitions
 * - Responsive video and image content
 * - Staggered animations
 * - Hover and tap effects
 * - Consistent branding
 * - Mobile-friendly design
 * - Accessible navigation
 *
 * Content Sections:
 * - Help People (DRIP): Flood damage documentation tool
 * - Prepare (RAMP): Risk assessment and mapping tool
 * - Protect Property (Buyers Aware): Property risk assessment portal
 * - Coordinate (MS2): Flood model management system
 *
 * @component
 * @returns {JSX.Element} Interactive services showcase section
 *
 * @example
 * ```jsx
 * // Basic usage
 * <WhatWeDo />
 * ```
 */
const WhatWeDo = () => {
  const [activeFilter, setActiveFilter] = useState('All Tools');
  const [filterClickCount, setFilterClickCount] = useState(0);
  const [pageLoadTime, setPageLoadTime] = useState(Date.now());

  // Track time on page
  useEffect(() => {
    setPageLoadTime(Date.now());
  }, []);

  const getTimeOnPage = () => {
    return Math.floor((Date.now() - pageLoadTime) / 1000); // seconds
  };

  const handleFilterClick = (filter) => {
    const previousFilter = activeFilter;
    setActiveFilter(filter);
    setFilterClickCount((prev) => prev + 1);

    trackFilterChange(filter, previousFilter, {
      tab: 'home',
      filter_click_count: filterClickCount + 1,
      time_on_page: getTimeOnPage(),
    });
  };

  const handleToolClick = (toolId, toolTitle) => {
    const tool = tools.find((t) => t.id === toolId);

    trackToolClick(toolId, toolTitle, {
      tool_url: tool?.url || '',
      current_filter: activeFilter,
      tool_tags: tool?.tags || [],
      filter_clicks_before_tool: filterClickCount,
      time_on_page: getTimeOnPage(),
    });
  };

  const filteredTools =
    activeFilter === 'All Tools' ? tools : tools.filter((tool) => tool.tags.includes(activeFilter));

  return (
    /**
     * Main section container
     * Implements responsive padding and background
     * Contains tab navigation and content area
     *
     * @returns {JSX.Element} Services showcase section
     */
    <section
      id="what-we-do"
      className="py-16 px-2 sm:px-4 md:px-6 lg:px-8 min-h-[662px] border-t border-b border-gray-200 relative"
      aria-label="Our Tools section"
    >
      {/* Gradient background */}
      <div
        className="absolute inset-0 z-0"
        style={{
          background:
            'linear-gradient(to bottom right, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 1) 20%, rgba(255, 255, 255, 1) 40%, rgba(250, 250, 250, 1) 60%, rgba(221, 225, 255, 0.14) 80%, rgba(125, 142, 161, 0.22) 95%)',
        }}
      />

      {/* Container for all content */}
      <div className="mx-auto max-w-6xl relative z-10">
        {/* Section title */}
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#324755] mb-4 text-left">
          Our Tools
        </h2>

        {/* Subhead */}
        <p className="text-lg text-[#324755]/80 mb-12 max-w-3xl font-light">
          Our different tools offer opportunities to map risks, track impacts, find recovery
          resources, and support disaster planning across Texas.
        </p>

        {/* Filter buttons */}
        <div className="flex flex-wrap gap-2 items-center justify-center pb-4 border-b border-b-[#E2E8F0] mb-6">
          {['All Tools', 'Prepare', 'Mitigate', 'Recover'].map((filter) => (
            <MotionButton
              key={filter}
              onClick={() => handleFilterClick(filter)}
              className={`px-4 py-2 rounded-[100px] font-bold cursor-pointer
                            ${
                              activeFilter === filter
                                ? 'bg-[#324755] text-white'
                                : 'text-[#324755]/70 hover:bg-[#324755]/10'
                            }`}
              whileHover={{
                scale: 1.05,
                transition: { duration: 0.2 },
              }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 10 }}
            >
              {filter}
            </MotionButton>
          ))}
        </div>

        {/* Tools grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredTools.map((tool) => (
            <div key={tool.id} className="flex flex-col h-full">
              <div className="relative w-full mb-8">
                {tool.video ? (
                  <video
                    src={tool.video}
                    autoPlay
                    muted
                    loop
                    className="w-full h-48 object-cover rounded-lg border border-[#324755]/100 border-1 relative z-10"
                  />
                ) : (
                  <img
                    src={tool.image}
                    alt=""
                    className="w-full h-48 object-cover rounded-md border border-[#324755]/100 border-1 relative z-10"
                  />
                )}
              </div>
              <div className="flex flex-col flex-grow">
                <h3 className="text-lg font-bold mb-2 text-[#324755]">{tool.title}</h3>
                <p className="text-sm text-[#324755] mb-4 font-light flex-grow">
                  {tool.description}
                </p>
                <div className="relative inline-block self-start">
                  <motion.a
                    href={tool.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => handleToolClick(tool.id, tool.title)}
                    whileHover={{
                      scale: 1.05,
                      backgroundColor: '#324755',
                      transition: { duration: 0.2 },
                    }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 10 }}
                    className="relative bg-[#324755] text-white px-6 py-2 rounded-md font-bold cursor-pointer hover:shadow-lg hover:shadow-[#324755]/20 inline-block"
                  >
                    Visit
                  </motion.a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhatWeDo;
