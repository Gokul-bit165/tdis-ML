/**
 * @fileoverview ResponsiveNavigation component that provides adaptive navigation
 * based on screen size. On desktop, it shows a side navigation panel. On mobile/tablet,
 * it transforms into a top navigation bar.
 */

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Menu, X } from 'lucide-react';

const MotionDiv = motion.div;
const MotionButton = motion.button;

const SECTION_WHAT_WE_DO = 'what-we-do';
const SECTION_WHO_WORKS_WITH_US = 'who-works-with-us';
const SECTION_APP_DATASET_INTAKE = 'app-dataset-intake';
const SECTION_CONTACT_US = 'contact-us';

const DESKTOP_NAV_LINK_CLASS =
  'w-full text-left px-4 py-2 rounded-md hover:bg-[#334755]/10 transition-colors font-extrabold text-[#334755]';
const MOBILE_NAV_LINK_CLASS =
  'w-full text-left px-4 py-3 rounded-md hover:bg-[#334755]/10 transition-colors font-bold text-[#334755]';
const NAV_LINK_ACTIVE_BG_CLASS = 'bg-[#334755]/10';

const DesktopTabContent = ({ activeTab }) => {
    switch (activeTab) {
        case 'hmed':
            return (
                <div className="space-y-4">
                    <div>
                        <h1 className="text-3xl font-black leading-tight text-[#334755]">
                            Hazard Severity Outlook
                        </h1>
                        <p className="text-sm font-medium text-[#334755]/70 mt-1">
                            HSI hazard severity layers
                        </p>
                    </div>
                    <div className="space-y-3">
                        <p className="text-sm leading-relaxed text-[#334755]/90">
                            HSI layers provide short term, predictive metrics of expected hazard severity. Values are dimensionless and scaled so that <span className="font-semibold">~1.0 ≈ a significant planning threshold</span> for that hazard; higher values indicate greater severity.
                        </p>
                    </div>
                </div>
            );
        case 'lts-flash-flood':
            return (
                <div className="space-y-4">
                    <div>
                        <h1 className="text-3xl font-black leading-tight text-[#334755]">
                            Impact Forecast
                        </h1>
                        <p className="text-sm font-medium text-[#334755]/70 mt-1">
                            Flash flood outlook (LTS)
                        </p>
                    </div>
                    <div className="space-y-3">
                        <p className="text-sm leading-relaxed text-[#334755]/90">
                            This view shows where an approaching storm is most likely to produce severe flash flood impacts, using an ordinal severity scale on H3 hex cells. Use alongside—not in place of—official National Weather Service flood warnings.
                        </p>
                    </div>
                </div>
            );
        case 'osa':
            return (
                <>
                    <h1 className="text-4xl font-black mb-4 leading-none text-[#334755]">
                        Infrastructure Status
                    </h1>
                    <p className="text-base font-light text-[#334755]/80">
                        <span className="font-bold text-[#334755]">Infrastructure Status</span> provides comprehensive situational awareness for disaster response operations.
                    </p>
                </>
            );
        case 'ai-assistant':
            return (
                <>
                    <h1 className="text-4xl font-black mb-4 leading-none text-[#334755]">
                        TDIS AI
                    </h1>
                    <p className="text-base font-light text-[#334755]/80">
                        Ask questions about Texas hazards, infrastructure risk, weather events, and community vulnerability. Answers are drawn from authoritative datasets and updated in real time.
                    </p>
                </>
            );
        default:
            return (
                <>
                    <h1 className="text-4xl font-black mb-4 leading-none text-[#334755]">
                        Disaster Support for a better Texas
                    </h1>
                    <p className="text-base font-light text-[#334755]/80">
                        <span className="font-bold text-[#334755]">TDIS provides tools</span> that empower communities across Texas to prepare, respond, and recover from disasters more effectively.
                    </p>
                </>
            );
    }
};

const MobileTabContent = ({ activeTab }) => {
    switch (activeTab) {
        case 'hmed':
            return (
                <div className="mb-4 space-y-3">
                    <div>
                        <h2 className="text-lg font-black text-[#334755]">Hazard Severity Outlook</h2>
                        <p className="text-xs font-medium text-[#334755]/70 mt-0.5">
                            HSI hazard severity layers
                        </p>
                    </div>
                    <p className="text-xs leading-relaxed text-[#334755]/90">
                        HSI layers provide short term, predictive metrics of expected hazard severity. Values are dimensionless and scaled so that <span className="font-semibold">~1.0 ≈ a significant planning threshold</span> for that hazard; higher values indicate greater severity.
                    </p>
                </div>
            );
        case 'lts-flash-flood':
            return (
                <div className="mb-4 space-y-3">
                    <div>
                        <h2 className="text-lg font-black text-[#334755]">Impact Forecast</h2>
                        <p className="text-xs font-medium text-[#334755]/70 mt-0.5">
                            Flash flood outlook (LTS)
                        </p>
                    </div>
                    <p className="text-xs leading-relaxed text-[#334755]/90">
                        Ordinal flash-flood threat severity on H3 hex cells. Complement official NWS warnings—do not replace them.
                    </p>
                </div>
            );
        case 'osa':
            return (
                <div className="mb-4">
                    <h2 className="text-lg font-black text-[#334755] mb-2">Infrastructure Status</h2>
                    <p className="text-sm text-[#334755]/80 mb-4">
                        <span className="font-bold text-[#334755]">Infrastructure Status</span> provides comprehensive situational awareness for disaster response operations.
                    </p>
                </div>
            );
        case 'ai-assistant':
            return (
                <div className="mb-4">
                    <h2 className="text-lg font-black text-[#334755] mb-2">TDIS AI</h2>
                    <p className="text-sm text-[#334755]/80 mb-4">
                        Assistant replies stream over SSE from your configured backend. Sign-in uses Keycloak.
                    </p>
                </div>
            );
        default:
            return (
                <p className="text-sm text-[#334755]/80 mb-4">
                    <span className="font-bold text-[#334755]">TDIS provides tools</span> that empower communities across Texas to prepare, respond, and recover from disasters more effectively.
                </p>
            );
    }
};

DesktopTabContent.propTypes = {
    activeTab: PropTypes.string,
};

MobileTabContent.propTypes = {
    activeTab: PropTypes.string,
};

const ResponsiveNavigation = ({ isExpanded, setIsExpanded, activeTab }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [activeSection, setActiveSection] = useState('');
    const [isMobile, setIsMobile] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Detect mobile screen size
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 1024); // lg breakpoint
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const scrollToSection = (sectionId) => {
        if (location.pathname !== '/') {
            navigate('/', { state: { scrollTo: sectionId } });
            return;
        }
        
        const element = document.getElementById(sectionId);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
        
        // Close mobile menu after navigation
        if (isMobile) {
            setIsMobileMenuOpen(false);
        }
    };

    // Track which section is currently in view
    useEffect(() => {
        const handleScroll = () => {
            const sections = [
                { id: SECTION_WHAT_WE_DO, name: SECTION_WHAT_WE_DO },
                { id: SECTION_WHO_WORKS_WITH_US, name: SECTION_WHO_WORKS_WITH_US },
                { id: SECTION_APP_DATASET_INTAKE, name: SECTION_APP_DATASET_INTAKE },
                { id: SECTION_CONTACT_US, name: SECTION_CONTACT_US }
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

    // Desktop Side Navigation
    const DesktopNavigation = () => (
        <div className="fixed left-0 top-0 h-screen z-50 flex">
            {/* Main Navigation Panel */}
            <AnimatePresence initial={false}>
                {isExpanded && (
                    <MotionDiv
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 280, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="bg-white text-[#334755] h-full flex flex-col border-r border-[#334755]"
                    >
                        {/* Logo */}
                        <div className="bg-[#334755] p-3 flex-shrink-0">
                            <a href="https://idrt.tamug.edu/" target="_blank" rel="noopener noreferrer">
                                <img
                                    src="/tdislogo-white.png"
                                    alt="TDIS Logo"
                                    className="h-10 mx-auto transition-transform duration-300 hover:scale-105"
                                />
                            </a>
                        </div>

                        {/* Scrollable Content Area */}
                        <div 
                            className="flex-1 overflow-y-auto p-4 flex flex-col scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent"
                            style={{
                                scrollbarWidth: 'thin',
                                scrollbarColor: '#cbd5e1 transparent',
                                scrollbarGutter: 'stable'
                            }}
                        >
                            {/* Tab-Specific Content */}
                            <div className="mb-8 flex-shrink-0">
                                <DesktopTabContent activeTab={activeTab} />
                            </div>

                        {/* Navigation Links */}
                        <nav className="space-y-1.5 mt-auto mb-4">
                            <MotionButton
                                onClick={() => scrollToSection(SECTION_WHAT_WE_DO)}
                                className={`${DESKTOP_NAV_LINK_CLASS} ${activeSection === SECTION_WHAT_WE_DO ? NAV_LINK_ACTIVE_BG_CLASS : ''}`}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                Projects/Tools List
                            </MotionButton>

                            <MotionButton
                                onClick={() => scrollToSection(SECTION_WHO_WORKS_WITH_US)}
                                className={`${DESKTOP_NAV_LINK_CLASS} ${activeSection === SECTION_WHO_WORKS_WITH_US ? NAV_LINK_ACTIVE_BG_CLASS : ''}`}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                About TDIS
                            </MotionButton>

                            <MotionButton
                                onClick={() => scrollToSection(SECTION_APP_DATASET_INTAKE)}
                                className={`${DESKTOP_NAV_LINK_CLASS} ${activeSection === SECTION_APP_DATASET_INTAKE ? NAV_LINK_ACTIVE_BG_CLASS : ''}`}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                Application Intake
                            </MotionButton>

                            <MotionButton
                                onClick={() => scrollToSection(SECTION_CONTACT_US)}
                                className={`${DESKTOP_NAV_LINK_CLASS} ${activeSection === SECTION_CONTACT_US ? NAV_LINK_ACTIVE_BG_CLASS : ''}`}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                Contact Us
                            </MotionButton>
                            </nav>
                        </div>

                        {/* Bottom Logo Bar */}
                        <div className="bg-[#334755] p-2 flex items-center justify-center gap-2 flex-shrink-0">
                            <a href="https://www.glo.texas.gov/" target="_blank" rel="noopener noreferrer">
                                <img src="/glowhite.png" alt="Texas General Land Office official seal" className="h-8" />
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

    // Mobile Top Navigation
    const MobileNavigation = () => (
        <div className="lg:hidden">
            {/* Top Navigation Bar */}
            <div className="bg-white text-[#334755] p-4 border-b border-[#334755]/20 shadow-sm">
                <div className="flex items-center justify-between">
                    {/* Logo and Title */}
                    <div className="flex items-center gap-3">
                        <a href="https://idrt.tamug.edu/" target="_blank" rel="noopener noreferrer">
                            <img
                                src="/tdislogo-white.png"
                                alt="TDIS Logo"
                                className="h-8 bg-[#334755] p-1 rounded"
                            />
                        </a>
                        <div>
                            <h1 className="text-lg font-black text-[#334755] leading-tight">
                                Disaster Support
                            </h1>
                            <p className="text-xs text-[#334755]/70">
                                for a better Texas
                            </p>
                        </div>
                    </div>

                    {/* Mobile Menu Toggle */}
                    <MotionButton
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className="p-2 hover:bg-[#334755]/10 rounded-md"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        {isMobileMenuOpen ? (
                            <X className="w-6 h-6" />
                        ) : (
                            <Menu className="w-6 h-6" />
                        )}
                    </MotionButton>
                </div>
            </div>

            {/* Mobile Menu Dropdown */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <MotionDiv
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="bg-white border-b border-[#334755]/20 shadow-lg overflow-hidden"
                    >
                        <div className="p-4">
                            {/* Tab-Specific Content */}
                            <MobileTabContent activeTab={activeTab} />

                            {/* Navigation Links */}
                            <nav className="space-y-2">
                                <MotionButton
                                    onClick={() => scrollToSection(SECTION_WHAT_WE_DO)}
                                    className={`${MOBILE_NAV_LINK_CLASS} ${activeSection === SECTION_WHAT_WE_DO ? NAV_LINK_ACTIVE_BG_CLASS : ''}`}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    Projects/Tools List
                                </MotionButton>

                                <MotionButton
                                    onClick={() => scrollToSection(SECTION_WHO_WORKS_WITH_US)}
                                    className={`${MOBILE_NAV_LINK_CLASS} ${activeSection === SECTION_WHO_WORKS_WITH_US ? NAV_LINK_ACTIVE_BG_CLASS : ''}`}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    About TDIS
                                </MotionButton>

                                <MotionButton
                                    onClick={() => scrollToSection(SECTION_APP_DATASET_INTAKE)}
                                    className={`${MOBILE_NAV_LINK_CLASS} ${activeSection === SECTION_APP_DATASET_INTAKE ? NAV_LINK_ACTIVE_BG_CLASS : ''}`}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    Application Intake
                                </MotionButton>

                                <MotionButton
                                    onClick={() => scrollToSection(SECTION_CONTACT_US)}
                                    className={`${MOBILE_NAV_LINK_CLASS} ${activeSection === SECTION_CONTACT_US ? NAV_LINK_ACTIVE_BG_CLASS : ''}`}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    Contact Us
                                </MotionButton>
                            </nav>

                            {/* Partner Logos */}
                            <div className="mt-4 pt-4 border-t border-[#334755]/20 bg-[#334755] -mx-4 -mb-4 p-4 flex items-center justify-center gap-4">
                                <a href="https://www.glo.texas.gov/" target="_blank" rel="noopener noreferrer">
                                    <img src="/glowhite.png" alt="Texas General Land Office official seal" className="h-6" />
                                </a>
                                <a href="https://www.tamu.edu/" target="_blank" rel="noopener noreferrer">
                                    <img src="/tamulogo-white.png" alt="TAMU Logo" className="h-6" />
                                </a>
                            </div>
                        </div>
                    </MotionDiv>
                )}
            </AnimatePresence>
        </div>
    );

    return (
        <>
            {/* Desktop Navigation */}
            <div className="hidden lg:block">
                <DesktopNavigation />
            </div>

            {/* Mobile Navigation */}
            <MobileNavigation />
        </>
    );
};

ResponsiveNavigation.propTypes = {
    isExpanded: PropTypes.bool.isRequired,
    setIsExpanded: PropTypes.func.isRequired,
    activeTab: PropTypes.string,
};

export default ResponsiveNavigation; 