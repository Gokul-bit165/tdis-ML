import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const GA_NOT_INITIALIZED_WARNING = 'Google Analytics is not initialized.';

/** Ignore `?tab=` and location.state so tab switches and in-page scrolls are not extra page views. */
let lastPageViewPath = '';
let scrollSentForPath = '';

const callGtag = (...args) => {
  try {
    if (typeof globalThis.gtag === 'function') {
      globalThis.gtag(...args);
    }
  } catch {
    // Edge Tracking Prevention and ad blockers may stub gtag with a throwing function.
  }
};

const sendUniquePageView = (pathname) => {
  if (!pathname || pathname === lastPageViewPath || typeof globalThis.gtag !== 'function') {
    return;
  }
  lastPageViewPath = pathname;
  callGtag('event', 'page_view', {
    page_location: globalThis.location.href,
    page_title: document.title,
    engagement_time_msec: 0,
  });
};

const loadGAScript = (trackingId) => {
  if (
    document.querySelector(
      `script[src="https://www.googletagmanager.com/gtag/js?id=${trackingId}"]`
    )
  ) {
    return;
  }

  const script = document.createElement('script');
  script.src = `https://www.googletagmanager.com/gtag/js?id=${trackingId}`;
  script.async = true;
  script.onerror = () => {
    // Blocked by Edge Tracking Prevention / extensions — keep the app usable.
  };
  script.onload = () => {
    try {
      globalThis.dataLayer = globalThis.dataLayer || [];
      if (typeof globalThis.gtag !== 'function') {
        globalThis.gtag = function gtag() {
          globalThis.dataLayer.push(arguments);
        };
      }
      callGtag('js', new Date());
      callGtag('config', trackingId, { send_page_view: false });
      sendUniquePageView(globalThis.location.pathname);
      maybeTrackFirstVisit();
    } catch {
      // Ignore tracker setup failures so they cannot blank the page.
    }
  };
  document.head.appendChild(script);
};

const FIRST_VISIT_STORAGE_KEY = 'tdis_portal_ga_first_visit';
/** One scroll event per path, matching GA4 enhanced-measurement default. */
const SCROLL_THRESHOLD_PERCENT = 90;

const maybeTrackFirstVisit = () => {
  try {
    if (globalThis.localStorage.getItem(FIRST_VISIT_STORAGE_KEY)) {
      return;
    }
    trackFirstVisit();
    globalThis.localStorage.setItem(FIRST_VISIT_STORAGE_KEY, '1');
  } catch {
    // Ignore storage access errors (private mode, disabled cookies).
  }
};

export const usePageViews = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    try {
      const googleAnalyticsToken = import.meta.env.VITE_GOOGLE_ANALYTICS_TRACKING_ID;
      if (!googleAnalyticsToken) {
        return;
      }
      loadGAScript(googleAnalyticsToken);
      sendUniquePageView(pathname);
      maybeTrackFirstVisit();
    } catch {
      // Tracker must never take down the portal (common in Edge Tracking Prevention).
    }
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => {
      if (scrollSentForPath === pathname) {
        return;
      }
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - globalThis.innerHeight;
      if (scrollable <= 0) {
        return;
      }
      const percent = Math.round((globalThis.scrollY / scrollable) * 100);
      if (percent >= SCROLL_THRESHOLD_PERCENT) {
        scrollSentForPath = pathname;
        trackScroll(SCROLL_THRESHOLD_PERCENT);
      }
    };

    globalThis.addEventListener('scroll', onScroll, { passive: true });
    return () => globalThis.removeEventListener('scroll', onScroll);
  }, [pathname]);
};

// Event names and categories. Keep this list small so GA reports stay comparable.
export const FILTER_CHANGE = 'filter_change';
export const TOOL_CLICK = 'tool_click';
export const CLICK = 'click';
export const SCROLL = 'scroll';
export const FIRST_VISIT = 'first_visit';
export const NAVIGATION = 'navigation';
export const MAP_INTERACTION = 'map_interaction';
export const DATASET_INTAKE = 'dataset_intake';
export const EVENT_SELECTION = 'event_selection';
export const LAYER_TOGGLE = 'layer_toggle';
export const TOOL_INTERACTION = 'tool_interaction';
export const AI_ASSISTANT = 'ai_assistant';

/**
 * Portal GA event schema (use these helpers instead of ad-hoc trackEvent payloads):
 *
 * | Event            | When                                      | Required params                          |
 * |------------------|-------------------------------------------|------------------------------------------|
 * | filter_change    | Any picker (tools, hours, LTS tier)       | tab, filter_name, previous_filter        |
 * | layer_toggle     | Map layer on/off or layer switch          | tab, layer_name                          |
 * | map_interaction  | Click on the map (hex, outage, hazard)    | tab, action                              |
 * | event_selection  | Live Weather event checkboxes             | tab, event_name, selected                |
 * | navigation       | Header section or product tab             | tab (and previous_tab when switching)    |
 * | ai_assistant     | Assistant UI actions                      | tab, action                              |
 * | dataset_intake   | Intake open/submit                        | tab, action                              |
 *
 * Shared keys: tab, event_label. Do not invent parallel names (hours vs filter_name, etc.).
 */
const pageContext = () => ({
  page_location: globalThis.location.href,
  page_title: document.title,
});

export const trackEvent = (action, category, extra = {}) => {
  if (!globalThis.gtag) {
    console.warn(GA_NOT_INITIALIZED_WARNING);
    return;
  }

  callGtag('event', action, {
    event_category: category,
    ...pageContext(),
    ...extra,
  });
};

export const trackFilterChange = (newFilter, previousFilter, additionalParams = {}) => {
  const { event_category = NAVIGATION, ...rest } = additionalParams;
  trackEvent(FILTER_CHANGE, event_category, {
    event_label: newFilter,
    filter_name: newFilter,
    previous_filter: previousFilter,
    ...rest,
  });
};

export const trackLayerToggle = ({ tab, layer_name, on, event_label, ...rest } = {}) => {
  trackEvent(LAYER_TOGGLE, MAP_INTERACTION, {
    tab,
    layer_name,
    event_label: event_label ?? layer_name,
    ...(typeof on === 'boolean' ? { on } : {}),
    ...rest,
  });
};

export const trackMapInteraction = ({ tab, action, layer_name, event_label, ...rest } = {}) => {
  trackEvent(MAP_INTERACTION, MAP_INTERACTION, {
    tab,
    action,
    event_label: event_label ?? action,
    ...(layer_name ? { layer_name } : {}),
    ...rest,
  });
};

export const trackAiAssistant = (action, extra = {}) => {
  trackEvent(AI_ASSISTANT, AI_ASSISTANT, {
    tab: 'ai-assistant',
    action,
    event_label: action,
    ...extra,
  });
};

export const trackToolClick = (_toolId, toolName, additionalParams = {}) => {
  const {
    tab = 'home',
    current_filter = '',
    tool_tags = [],
    tool_url = '',
    filter_clicks_before_tool = 0,
    time_on_page = 0,
    ...rest
  } = additionalParams;
  trackEvent(TOOL_CLICK, TOOL_INTERACTION, {
    tab,
    current_filter,
    event_label: toolName,
    tool_name: toolName,
    tool_tags: (tool_tags || []).join(','),
    tool_url,
    filter_clicks_before_tool,
    time_on_page,
    ...rest,
  });
};

export const trackClick = (linkUrl, linkDomain, isOutbound = false) => {
  trackEvent(CLICK, NAVIGATION, {
    link_domain: linkDomain,
    link_url: linkUrl,
    outbound: isOutbound,
  });
};

export const trackOutboundClick = (href) => {
  let linkDomain = '';
  try {
    linkDomain = new URL(href, globalThis.location.origin).hostname;
  } catch {
    linkDomain = '';
  }
  trackClick(href, linkDomain, true);
};

export const trackScroll = (percentScrolled, pageReferrer = '') => {
  trackEvent(SCROLL, NAVIGATION, {
    page_referrer: pageReferrer,
    percent_scrolled: percentScrolled,
  });
};

export const trackFirstVisit = () => {
  trackEvent(FIRST_VISIT, NAVIGATION, {});
};
