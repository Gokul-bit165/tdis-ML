import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const MotionDiv = motion.div;
const MotionButton = motion.button;
import { ChevronLeft } from 'lucide-react';

const SECTION_WHAT_WE_DO = 'what-we-do';
const SECTION_WHO_WORKS_WITH_US = 'who-works-with-us';
const SECTION_APP_DATASET_INTAKE = 'app-dataset-intake';
const SECTION_CONTACT_US = 'contact-us';

const NAV_LINK_CLASS =
  'w-full text-left px-4 py-2 rounded-md hover:bg-[#334755]/10 transition-colors font-extrabold text-[#334755]';
const NAV_LINK_ACTIVE_BG_CLASS = 'bg-[#334755]/10';

const SideNavigation = ({ isExpanded, setIsExpanded }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeSection, setActiveSection] = useState('');

  const scrollToSection = (sectionId) => {
    if (location.pathname !== '/') {
      navigate('/', { state: { scrollTo: sectionId } });
      return;
    }

    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Track which section is currently in view
  useEffect(() => {
    const handleScroll = () => {
      const sections = [
        { id: SECTION_WHAT_WE_DO, name: SECTION_WHAT_WE_DO },
        { id: SECTION_WHO_WORKS_WITH_US, name: SECTION_WHO_WORKS_WITH_US },
        { id: SECTION_APP_DATASET_INTAKE, name: SECTION_APP_DATASET_INTAKE },
        { id: SECTION_CONTACT_US, name: SECTION_CONTACT_US },
      ];

      const scrollPosition = window.scrollY + window.innerHeight / 2;

      for (const section of sections) {
        const element = document.getElementById(section.id);
        if (element) {
          const { offsetTop, offsetHeight } = element;
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveSection(section.name);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Check initial position

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="fixed left-0 top-0 h-screen z-50 flex">
      {/* Main Navigation Panel */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <MotionDiv
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-white text-[#334755] h-full p-4 flex flex-col border-r border-[#334755]"
          >
            {/* Logo */}
            <div className="mb-8 bg-[#334755] p-4 -mx-4 -mt-4">
              <a href="https://idrt.tamug.edu/" target="_blank" rel="noopener noreferrer">
                <img
                  src="/tdislogo-white.png"
                  alt="TDIS Logo"
                  className="w-[60%] mx-auto transition-transform duration-300 hover:scale-105"
                />
              </a>
            </div>

            {/* Title and Subtitle */}
            <div className="mb-8">
              <h1 className="text-4xl font-black mb-4 leading-none text-[#334755]">
                Disaster Support for a better Texas
              </h1>
              <p className="text-base font-light text-[#334755]/80">
                <span className="font-bold text-[#334755]">TDIS provides tools</span> that empower
                communities across Texas to prepare, respond, and recover from disasters more
                effectively.
              </p>
            </div>

            {/* Navigation Links - Moved to bottom */}
            <nav className="space-y-4 mt-auto mb-4">
              <MotionButton
                onClick={() => scrollToSection(SECTION_WHAT_WE_DO)}
                className={`${NAV_LINK_CLASS} ${activeSection === SECTION_WHAT_WE_DO ? NAV_LINK_ACTIVE_BG_CLASS : ''}`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Projects/Tools List
              </MotionButton>

              <MotionButton
                onClick={() => scrollToSection(SECTION_WHO_WORKS_WITH_US)}
                className={`${NAV_LINK_CLASS} ${activeSection === SECTION_WHO_WORKS_WITH_US ? NAV_LINK_ACTIVE_BG_CLASS : ''}`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                About TDIS
              </MotionButton>

              <MotionButton
                onClick={() => scrollToSection(SECTION_APP_DATASET_INTAKE)}
                className={`${NAV_LINK_CLASS} ${activeSection === SECTION_APP_DATASET_INTAKE ? NAV_LINK_ACTIVE_BG_CLASS : ''}`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Application Intake
              </MotionButton>

              <MotionButton
                onClick={() => scrollToSection(SECTION_CONTACT_US)}
                className={`${NAV_LINK_CLASS} ${activeSection === SECTION_CONTACT_US ? NAV_LINK_ACTIVE_BG_CLASS : ''}`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Contact Us
              </MotionButton>
            </nav>

            {/* Bottom Logo Bar */}
            <div className="bg-[#334755] p-2 -mx-4 -mb-4 flex items-center justify-center gap-2">
              <a href="https://www.glo.texas.gov/" target="_blank" rel="noopener noreferrer">
                <img
                  src="/glowhite.png"
                  alt="Texas General Land Office official seal"
                  className="h-8"
                />
              </a>
              <a href="https://www.tamu.edu/" target="_blank" rel="noopener noreferrer">
                <img src="/tamulogo-white.png" alt="TAMU Logo" className="h-8" />
              </a>
            </div>
          </MotionDiv>
        )}
      </AnimatePresence>

      {/* Toggle Button */}
      <MotionButton
        onClick={() => setIsExpanded(!isExpanded)}
        className="bg-white text-[#334755] p-2 rounded-r-md self-start mt-4 hover:bg-[#334755]/10"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        animate={{ rotate: isExpanded ? 0 : 180 }}
        transition={{ duration: 0.2 }}
      >
        <ChevronLeft className="w-5 h-5" />
      </MotionButton>
    </div>
  );
};

export default SideNavigation;
