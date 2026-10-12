/**
 * @fileoverview TabNavigation component that provides tab switching functionality
 * Mobile-optimized with horizontal scrolling and short labels.
 * Map product tabs are grouped; TDIS AI uses a branded pill (slate + teal) beside a soft divider.
 */

import React, { useRef, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import './TabNavigation.css';
import { useNavigate } from 'react-router-dom';
import { BotMessageSquare, CloudLightning, CloudRain, Droplets, Flame, Zap } from 'lucide-react';
import { useIsMobile } from '../hooks/use-mobile';
import { useKeycloak } from '@/hooks/useKeycloak';
import CustomTooltip from './ui/CustomTooltip';
import UserBar from './ai-assistant/UserBar';
import { motion } from 'framer-motion';
import { isAdmin, isSuperAdmin } from '@/lib/roles';
import {
    ACTIVE_WEATHER_EVENTS_BETA_TAB,
    AI_ASSISTANT_TAB,
    isActiveWeatherEventsBetaEnabled,
    isTdisAiEnabled,
} from '@/config/featureFlags';
import { trackEvent, NAVIGATION } from '../utils/googleAnalytics.js';

const MotionButton = motion.button;

const mapTabsConfig = [
    {
        value: 'active-weather-events',
        label: 'Live Weather',
        shortLabel: 'Live',
        icon: CloudLightning,
        iconColor: '#3b82f6'
    },
    {
        value: ACTIVE_WEATHER_EVENTS_BETA_TAB,
        label: 'Live Weather — Beta',
        shortLabel: 'Live β',
        icon: CloudRain,
        iconColor: '#0284c7'
    },
    {
        value: 'hmed',
        label: 'Hazard Severity Outlook',
        shortLabel: 'Outlook',
        icon: Droplets,
        iconColor: '#3b82f6'
    },
    {
        value: 'lts-flash-flood',
        label: 'Impact Forecast',
        shortLabel: 'Impact',
        icon: CloudRain,
        iconColor: '#0d9488'
    },
    {
        value: 'osa',
        label: 'Infrastructure Status',
        shortLabel: 'Infra',
        icon: Zap,
        iconColor: '#f59e0b'
    },
    {
        value: 'wildfire-ignition',
        label: 'Wildfire Ignition',
        shortLabel: 'Fire',
        icon: Flame,
        iconColor: '#ef4444'
    }
];

const assistantTabConfig = {
    value: AI_ASSISTANT_TAB,
    label: 'TDIS AI',
    shortLabel: 'AI',
    icon: BotMessageSquare,
    tooltip: 'Conversational assistant for Texas hazard and infrastructure data.',
};

const getAdminAction = ({ showAdminPanel, showManageOrg }) => {
    if (showAdminPanel) {
        return { label: 'Admin Panel', path: '/admin/signups' };
    }
    if (showManageOrg) {
        return { label: 'Manage Org', path: '/org/members' };
    }
    return { label: null, path: null };
};

const TabNavigation = ({ activeTab, setActiveTab }) => {
    const scrollContainerRef = useRef(null);
    const [showLeftFade, setShowLeftFade] = useState(false);
    const [showRightFade, setShowRightFade] = useState(false);
    const isMobile = useIsMobile();
    const { authenticated, user, logout } = useKeycloak();
    const navigate = useNavigate();

    const updateScrollIndicators = () => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const { scrollLeft, scrollWidth, clientWidth } = container;
        setShowLeftFade(scrollLeft > 10);
        setShowRightFade(scrollLeft < scrollWidth - clientWidth - 10);
    };

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        updateScrollIndicators();
        container.addEventListener('scroll', updateScrollIndicators);
        window.addEventListener('resize', updateScrollIndicators);

        return () => {
            container.removeEventListener('scroll', updateScrollIndicators);
            window.removeEventListener('resize', updateScrollIndicators);
        };
    }, []);

    useEffect(() => {
        if (!isMobile || !scrollContainerRef.current) return;
        const activeButton = scrollContainerRef.current.querySelector('[aria-selected="true"]');
        if (activeButton) {
            activeButton.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
    }, [activeTab, isMobile]);

    const showTdisAi = isTdisAiEnabled();
    const mapTabs = mapTabsConfig.filter((tab) => {
        if (tab.value === ACTIVE_WEATHER_EVENTS_BETA_TAB) return isActiveWeatherEventsBetaEnabled();
        return true;
    });
    const isAiActive = showTdisAi && activeTab === assistantTabConfig.value;
    const AssistantIcon = assistantTabConfig.icon;
    const showAdminPanel = isSuperAdmin(user?.roles);
    const showManageOrg = isAdmin(user?.roles) && !showAdminPanel;
    const { label: adminActionLabel, path: adminActionPath } = getAdminAction({
        showAdminPanel,
        showManageOrg,
    });

    const handleTabClick = (tabValue) => {
        if (tabValue !== activeTab) {
            trackEvent(NAVIGATION, NAVIGATION, {
                tab: tabValue,
                previous_tab: activeTab,
                event_label: tabValue,
            });
        }
        setActiveTab(tabValue);
    };

    const renderMapTab = (tab) => {
        const isActive = activeTab === tab.value;
        const Icon = tab.icon;
        const displayLabel = isMobile ? tab.shortLabel : tab.label;

        return (
            <div key={tab.value} className="relative shrink-0">
                <CustomTooltip content={isMobile ? tab.label : undefined}>
                    <MotionButton
                        onClick={() => handleTabClick(tab.value)}
                        className={`tdis-map-tab${isActive ? ' tdis-map-tab--active' : ''}`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                        aria-selected={isActive}
                        role="tab"
                    >
                        <Icon
                            className="h-4 w-4 shrink-0"
                            style={{
                                color: isActive ? 'var(--tdis-white)' : tab.iconColor,
                            }}
                        />
                        <span className="relative z-10 whitespace-nowrap">{displayLabel}</span>
                    </MotionButton>
                </CustomTooltip>
            </div>
        );
    };

    const renderAssistantTab = () => (
        <CustomTooltip
            content={
                isMobile ? assistantTabConfig.tooltip : `${assistantTabConfig.label}. ${assistantTabConfig.tooltip}`
            }
        >
            <MotionButton
                onClick={() => handleTabClick(assistantTabConfig.value)}
                className={`tdis-ai-tab${isAiActive ? ' tdis-ai-tab--active' : ''}`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                aria-selected={isAiActive}
                role="tab"
            >
                <span className="tdis-ai-tab__icon-wrap" aria-hidden>
                    <AssistantIcon className="tdis-ai-tab__glyph" strokeWidth={2.25} />
                </span>
                <span className="tdis-ai-tab__label relative z-10 whitespace-nowrap">
                    {isMobile ? assistantTabConfig.shortLabel : assistantTabConfig.label}
                </span>
            </MotionButton>
        </CustomTooltip>
    );

    return (
        <div
            className="absolute top-0 left-0 right-0 z-20 backdrop-blur-sm"
            style={{
                background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0.5) 50%, rgba(255, 255, 255, 0) 100%)'
            }}
        >
            {isMobile ? (
                <div className="relative flex w-full items-center gap-2 px-3 py-2.5">
                    <div className="relative min-w-0 flex-1">
                        {showLeftFade && (
                            <div
                                className="pointer-events-none absolute left-0 top-0 bottom-0 z-10 w-8"
                                style={{
                                    background: 'linear-gradient(to right, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0) 100%)'
                                }}
                            />
                        )}
                        {showRightFade && (
                            <div
                                className="pointer-events-none absolute right-0 top-0 bottom-0 z-10 w-8"
                                style={{
                                    background: 'linear-gradient(to left, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0) 100%)'
                                }}
                            />
                        )}
                        <div
                            ref={scrollContainerRef}
                            className="scrollbar-hide flex items-center gap-2 overflow-x-auto flex-nowrap pb-px"
                            style={{
                                scrollbarWidth: 'none',
                                msOverflowStyle: 'none',
                                WebkitOverflowScrolling: 'touch'
                            }}
                        >
                            {mapTabs.map(renderMapTab)}
                        </div>
                    </div>
                    {showTdisAi ? (
                        <>
                            <div className="tdis-tab-divider my-2" aria-hidden />
                            <div className="flex shrink-0 items-center">{renderAssistantTab()}</div>
                        </>
                    ) : null}
                    {authenticated ? (
                        <div className="ml-auto flex shrink-0 items-center border-l border-gray-200/90 pl-3">
                            <UserBar
                                user={user}
                                preferredUsername={user?.preferredUsername ?? null}
                                onLogout={logout}
                                adminActionLabel={adminActionLabel}
                                onAdminAction={adminActionPath ? () => navigate(adminActionPath) : null}
                            />
                        </div>
                    ) : null}
                </div>
            ) : (
                <div className="flex w-full items-center gap-2 px-4 py-2.5">
                    <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-2">
                        {mapTabs.map(renderMapTab)}
                    </div>
                    {showTdisAi ? (
                        <div className="flex shrink-0 items-center gap-3">
                            <div className="tdis-tab-divider" aria-hidden />
                            {renderAssistantTab()}
                        </div>
                    ) : null}
                    {authenticated ? (
                        <div className="flex shrink-0 items-center border-l border-gray-200/90 pl-5 ml-2">
                            <UserBar
                                user={user}
                                preferredUsername={user?.preferredUsername ?? null}
                                onLogout={logout}
                                adminActionLabel={adminActionLabel}
                                onAdminAction={adminActionPath ? () => navigate(adminActionPath) : null}
                            />
                        </div>
                    ) : null}
                </div>
            )}

        </div>
    );
};

TabNavigation.propTypes = {
    activeTab: PropTypes.string.isRequired,
    setActiveTab: PropTypes.func.isRequired,
};

export default TabNavigation;
