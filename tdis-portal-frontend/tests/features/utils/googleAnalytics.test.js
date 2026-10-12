/**
 * @fileoverview Unit tests for utils/googleAnalytics
 * Feature: utils
 */
import { createElement } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, renderHook, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import {
  trackEvent,
  trackFilterChange,
  trackLayerToggle,
  trackMapInteraction,
  trackAiAssistant,
  trackToolClick,
  trackClick,
  trackOutboundClick,
  trackScroll,
  trackFirstVisit,
  usePageViews,
  FILTER_CHANGE,
  TOOL_CLICK,
  CLICK,
  SCROLL,
  FIRST_VISIT,
  NAVIGATION,
  MAP_INTERACTION,
  DATASET_INTAKE,
  EVENT_SELECTION,
  LAYER_TOGGLE,
  TOOL_INTERACTION,
  AI_ASSISTANT,
} from '@/utils/googleAnalytics';

const DOES_NOT_THROW_WHEN_GTAG_MISSING = 'does not throw when gtag is missing';
const EXAMPLE_URL = 'https://example.com';
const EXAMPLE_DOMAIN = 'example.com';
const GA_TRACKING_ID = 'G-TESTID';
const GA_SCRIPT_SRC = `https://www.googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}`;
const FIRST_VISIT_STORAGE_KEY = 'tdis_portal_ga_first_visit';

function PageViewsHarness({ nextPath }) {
  usePageViews();
  const navigate = useNavigate();
  return createElement('button', { type: 'button', onClick: () => navigate(nextPath) }, 'go');
}

function renderPageViews(initialPath = '/ga-home') {
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: [initialPath] },
      createElement(PageViewsHarness, { nextPath: `${initialPath}-next` })
    )
  );
}

function gaScript() {
  return document.querySelector(`script[src="${GA_SCRIPT_SRC}"]`);
}

function setScrollGeometry({ scrollHeight, innerHeight, scrollY }) {
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    configurable: true,
    value: scrollHeight,
  });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: innerHeight });
  Object.defineProperty(window, 'scrollY', { configurable: true, value: scrollY });
}

describe('utils/googleAnalytics', () => {
  beforeEach(() => {
    window.gtag = vi.fn();
  });

  afterEach(() => {
    delete window.gtag;
  });

  describe('trackEvent', () => {
    it('warns when gtag is missing', () => {
      delete window.gtag;
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      trackEvent(FILTER_CHANGE, NAVIGATION);
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it('sends action, category, and extra params', () => {
      trackEvent(TOOL_CLICK, TOOL_INTERACTION, { tool_name: 'RAMP' });
      expect(window.gtag).toHaveBeenCalledWith(
        'event',
        TOOL_CLICK,
        expect.objectContaining({
          event_category: TOOL_INTERACTION,
          tool_name: 'RAMP',
        })
      );
    });

    it('swallows gtag throws from tracking-prevention stubs', () => {
      window.gtag = vi.fn(() => {
        throw new Error('blocked');
      });
      expect(() => trackEvent(CLICK, NAVIGATION)).not.toThrow();
    });

    it('skips the event call when gtag is present but not a function', () => {
      window.gtag = { not: 'a-function' };
      expect(() => trackEvent(CLICK, NAVIGATION)).not.toThrow();
    });
  });

  describe('trackFilterChange', () => {
    it('calls gtag with filter_change event when gtag exists', () => {
      trackFilterChange('newFilter', 'previousFilter');
      expect(window.gtag).toHaveBeenCalledWith(
        'event',
        'filter_change',
        expect.objectContaining({
          filter_name: 'newFilter',
          previous_filter: 'previousFilter',
          event_label: 'newFilter',
        })
      );
    });

    it(DOES_NOT_THROW_WHEN_GTAG_MISSING, () => {
      delete window.gtag;
      expect(() => trackFilterChange('a', 'b')).not.toThrow();
    });

    it('overrides event_category when provided', () => {
      trackFilterChange('6h', '3h', { event_category: TOOL_INTERACTION, tab: 'hmed' });
      expect(window.gtag).toHaveBeenCalledWith(
        'event',
        'filter_change',
        expect.objectContaining({
          event_category: TOOL_INTERACTION,
          tab: 'hmed',
        })
      );
    });

    it('passes tab and other additional params', () => {
      trackFilterChange('6h', '3h', { tab: 'hmed', layer_name: 'precipitation', filter_click_count: 2 });
      expect(window.gtag).toHaveBeenCalledWith(
        'event',
        'filter_change',
        expect.objectContaining({
          tab: 'hmed',
          layer_name: 'precipitation',
          filter_name: '6h',
          previous_filter: '3h',
          filter_click_count: 2,
        })
      );
    });
  });

  describe('trackLayerToggle', () => {
    it('sends layer_toggle with tab and layer_name', () => {
      trackLayerToggle({ tab: 'hmed', layer_name: 'precipitation' });
      expect(window.gtag).toHaveBeenCalledWith(
        'event',
        'layer_toggle',
        expect.objectContaining({
          event_category: MAP_INTERACTION,
          tab: 'hmed',
          layer_name: 'precipitation',
          event_label: 'precipitation',
        })
      );
    });

    it('includes on when it is a boolean and prefers a custom event_label', () => {
      trackLayerToggle({
        tab: 'osa',
        layer_name: 'outages',
        on: true,
        event_label: 'power',
      });
      expect(window.gtag).toHaveBeenCalledWith(
        'event',
        'layer_toggle',
        expect.objectContaining({
          tab: 'osa',
          on: true,
          event_label: 'power',
        })
      );
    });

    it('omits on when the flag is not a boolean', () => {
      trackLayerToggle({ tab: 'hmed', layer_name: 'wind', on: 'yes' });
      const payload = window.gtag.mock.calls[0][2];
      expect(payload).not.toHaveProperty('on');
    });

    it('uses empty defaults when called with no args', () => {
      trackLayerToggle();
      expect(window.gtag).toHaveBeenCalledWith(
        'event',
        'layer_toggle',
        expect.objectContaining({ event_category: MAP_INTERACTION })
      );
    });
  });

  describe('trackMapInteraction', () => {
    it('sends map_interaction with tab, action, and layer_name', () => {
      trackMapInteraction({ tab: 'osa', action: 'outage_click', layer_name: 'power_outage' });
      expect(window.gtag).toHaveBeenCalledWith(
        'event',
        'map_interaction',
        expect.objectContaining({
          tab: 'osa',
          action: 'outage_click',
          layer_name: 'power_outage',
          event_label: 'outage_click',
        })
      );
    });

    it('omits layer_name when absent and uses a custom event_label', () => {
      trackMapInteraction({ tab: 'hmed', action: 'pan', event_label: 'map-pan' });
      const payload = window.gtag.mock.calls[0][2];
      expect(payload).toMatchObject({ action: 'pan', event_label: 'map-pan' });
      expect(payload).not.toHaveProperty('layer_name');
    });

    it('uses empty defaults when called with no args', () => {
      trackMapInteraction();
      expect(window.gtag).toHaveBeenCalledWith(
        'event',
        'map_interaction',
        expect.objectContaining({ event_category: MAP_INTERACTION })
      );
    });
  });

  describe('trackAiAssistant', () => {
    it('sends ai_assistant with tab and action', () => {
      trackAiAssistant('send_message');
      expect(window.gtag).toHaveBeenCalledWith(
        'event',
        'ai_assistant',
        expect.objectContaining({
          tab: 'ai-assistant',
          action: 'send_message',
          event_label: 'send_message',
        })
      );
    });
  });

  describe('trackToolClick', () => {
    it('calls gtag with tool_click event', () => {
      trackToolClick('tool-1', 'My Tool');
      expect(window.gtag).toHaveBeenCalledWith(
        'event',
        'tool_click',
        expect.objectContaining({
          event_label: 'My Tool',
          tool_name: 'My Tool',
        })
      );
    });

    it(DOES_NOT_THROW_WHEN_GTAG_MISSING, () => {
      delete window.gtag;
      expect(() => trackToolClick('tool-1', 'My Tool')).not.toThrow();
    });

    it('joins tool tags and forwards extra engagement fields', () => {
      trackToolClick('tool-1', 'RAMP', {
        tab: 'home',
        current_filter: 'flood',
        tool_tags: ['flood', 'coast'],
        tool_url: EXAMPLE_URL,
        filter_clicks_before_tool: 3,
        time_on_page: 12,
        extra: 'ok',
      });
      expect(window.gtag).toHaveBeenCalledWith(
        'event',
        'tool_click',
        expect.objectContaining({
          tab: 'home',
          current_filter: 'flood',
          tool_tags: 'flood,coast',
          tool_url: EXAMPLE_URL,
          filter_clicks_before_tool: 3,
          time_on_page: 12,
          extra: 'ok',
        })
      );
    });

    it('treats a missing tool_tags list as empty', () => {
      trackToolClick('tool-1', 'RAMP', { tool_tags: null });
      expect(window.gtag).toHaveBeenCalledWith(
        'event',
        'tool_click',
        expect.objectContaining({ tool_tags: '' })
      );
    });
  });

  describe('trackClick', () => {
    it('calls gtag with click event', () => {
      trackClick(EXAMPLE_URL, EXAMPLE_DOMAIN, true);
      expect(window.gtag).toHaveBeenCalledWith(
        'event',
        'click',
        expect.objectContaining({
          event_category: NAVIGATION,
          link_domain: EXAMPLE_DOMAIN,
          link_url: EXAMPLE_URL,
          outbound: true,
        })
      );
    });

    it('trackOutboundClick sends click with hostname', () => {
      trackOutboundClick('https://www.tamu.edu/path');
      expect(window.gtag).toHaveBeenCalledWith(
        'event',
        'click',
        expect.objectContaining({
          link_url: 'https://www.tamu.edu/path',
          link_domain: 'www.tamu.edu',
          outbound: true,
        })
      );
    });

    it(DOES_NOT_THROW_WHEN_GTAG_MISSING, () => {
      delete window.gtag;
      expect(() => trackClick(EXAMPLE_URL, EXAMPLE_DOMAIN)).not.toThrow();
    });

    it('trackOutboundClick uses an empty domain when the href is not a URL', () => {
      trackOutboundClick('http://');
      expect(window.gtag).toHaveBeenCalledWith(
        'event',
        'click',
        expect.objectContaining({
          link_url: 'http://',
          link_domain: '',
          outbound: true,
        })
      );
    });
  });

  describe('trackScroll', () => {
    it('calls gtag with scroll event', () => {
      trackScroll(90, 'https://referrer.com');
      expect(window.gtag).toHaveBeenCalledWith(
        'event',
        'scroll',
        expect.objectContaining({
          percent_scrolled: 90,
          page_referrer: 'https://referrer.com',
        })
      );
    });

    it(DOES_NOT_THROW_WHEN_GTAG_MISSING, () => {
      delete window.gtag;
      expect(() => trackScroll(25)).not.toThrow();
    });
  });

  describe('trackFirstVisit', () => {
    it('calls gtag with first_visit event', () => {
      trackFirstVisit();
      expect(window.gtag).toHaveBeenCalledWith(
        'event',
        'first_visit',
        expect.objectContaining({
          page_location: window.location.href,
          page_title: document.title,
        })
      );
    });

    it(DOES_NOT_THROW_WHEN_GTAG_MISSING, () => {
      delete window.gtag;
      expect(() => trackFirstVisit()).not.toThrow();
    });
  });

  describe('constants', () => {
    it('exports event name and category constants', () => {
      expect(FILTER_CHANGE).toBe('filter_change');
      expect(TOOL_CLICK).toBe('tool_click');
      expect(CLICK).toBe('click');
      expect(SCROLL).toBe('scroll');
      expect(FIRST_VISIT).toBe('first_visit');
      expect(NAVIGATION).toBe('navigation');
      expect(MAP_INTERACTION).toBe('map_interaction');
      expect(DATASET_INTAKE).toBe('dataset_intake');
      expect(EVENT_SELECTION).toBe('event_selection');
      expect(LAYER_TOGGLE).toBe('layer_toggle');
      expect(TOOL_INTERACTION).toBe('tool_interaction');
      expect(AI_ASSISTANT).toBe('ai_assistant');
    });
  });

  describe('usePageViews', () => {
    beforeEach(() => {
      localStorage.clear();
      document.querySelectorAll('script[src*="googletagmanager.com/gtag/js"]').forEach((node) => {
        node.remove();
      });
      vi.stubEnv('VITE_GOOGLE_ANALYTICS_TRACKING_ID', GA_TRACKING_ID);
    });

    afterEach(() => {
      vi.unstubAllEnvs();
      localStorage.clear();
    });

    it('does not load a script when the tracking id is missing', () => {
      vi.stubEnv('VITE_GOOGLE_ANALYTICS_TRACKING_ID', '');
      renderPageViews();
      expect(gaScript()).toBeNull();
    });

    it('loads the gtag script once and skips a second insert', () => {
      const { unmount } = renderPageViews();
      expect(gaScript()).not.toBeNull();
      expect(gaScript().async).toBe(true);
      unmount();
      renderPageViews('/other');
      expect(document.querySelectorAll(`script[src="${GA_SCRIPT_SRC}"]`)).toHaveLength(1);
    });

    it('does not append a script that is already in the document', () => {
      const existing = document.createElement('script');
      existing.src = GA_SCRIPT_SRC;
      document.head.appendChild(existing);
      renderPageViews();
      expect(document.querySelectorAll(`script[src="${GA_SCRIPT_SRC}"]`)).toHaveLength(1);
    });

    it('defines gtag on load, configs the property, and records a first visit', () => {
      delete window.gtag;
      delete window.dataLayer;
      renderPageViews();
      act(() => {
        gaScript().onload();
      });
      expect(typeof window.gtag).toBe('function');
      expect(window.dataLayer.length).toBeGreaterThan(0);
      expect(localStorage.getItem(FIRST_VISIT_STORAGE_KEY)).toBe('1');
    });

    it('reuses an existing gtag on load and skips a repeat first visit', () => {
      localStorage.setItem(FIRST_VISIT_STORAGE_KEY, '1');
      const gtag = vi.fn();
      window.gtag = gtag;
      renderPageViews();
      act(() => {
        gaScript().onload();
      });
      expect(window.gtag).toBe(gtag);
      expect(gtag).toHaveBeenCalledWith('config', GA_TRACKING_ID, { send_page_view: false });
      expect(gtag.mock.calls.some((call) => call[1] === FIRST_VISIT)).toBe(false);
    });

    it('keeps the app usable when the script errors or onload throws', () => {
      renderPageViews();
      expect(() => gaScript().onerror()).not.toThrow();
      const dataLayerDescriptor = Object.getOwnPropertyDescriptor(window, 'dataLayer');
      Object.defineProperty(window, 'dataLayer', {
        configurable: true,
        get() {
          throw new Error('blocked');
        },
      });
      expect(() => gaScript().onload()).not.toThrow();
      if (dataLayerDescriptor) {
        Object.defineProperty(window, 'dataLayer', dataLayerDescriptor);
      } else {
        delete window.dataLayer;
      }
    });

    it('swallows tracker setup failures in the pathname effect', () => {
      const original = document.querySelector.bind(document);
      const querySpy = vi.spyOn(document, 'querySelector').mockImplementation((selector) => {
        if (String(selector).includes('googletagmanager')) {
          throw new Error('tracking prevention');
        }
        return original(selector);
      });
      expect(() => renderPageViews('/ga-throw')).not.toThrow();
      querySpy.mockRestore();
    });

    it('ignores storage failures while checking first visit', () => {
      const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('private mode');
      });
      renderPageViews();
      expect(() => gaScript().onload()).not.toThrow();
      getItem.mockRestore();
    });

    it('does not send a duplicate page_view for the same pathname', () => {
      renderPageViews('/ga-dup');
      const pageViews = window.gtag.mock.calls.filter((call) => call[1] === 'page_view');
      expect(pageViews).toHaveLength(1);
      fireEvent.click(document.querySelector('button'));
      const afterNav = window.gtag.mock.calls.filter((call) => call[1] === 'page_view');
      expect(afterNav).toHaveLength(2);
      fireEvent.click(document.querySelector('button'));
      expect(window.gtag.mock.calls.filter((call) => call[1] === 'page_view')).toHaveLength(2);
    });

    it('tracks a 90 percent scroll once per path and ignores shallow pages', () => {
      const { unmount } = renderPageViews('/ga-scroll');
      setScrollGeometry({ scrollHeight: 500, innerHeight: 500, scrollY: 0 });
      fireEvent.scroll(window);
      expect(window.gtag.mock.calls.some((call) => call[1] === SCROLL)).toBe(false);

      setScrollGeometry({ scrollHeight: 2000, innerHeight: 500, scrollY: 200 });
      fireEvent.scroll(window);
      expect(window.gtag.mock.calls.some((call) => call[1] === SCROLL)).toBe(false);

      setScrollGeometry({ scrollHeight: 2000, innerHeight: 500, scrollY: 1400 });
      fireEvent.scroll(window);
      fireEvent.scroll(window);
      expect(window.gtag.mock.calls.filter((call) => call[1] === SCROLL)).toHaveLength(1);

      unmount();
    });

    it('removes the scroll listener on unmount', () => {
      const removeSpy = vi.spyOn(window, 'removeEventListener');
      const { unmount } = renderHook(() => usePageViews(), {
        wrapper: ({ children }) =>
          createElement(MemoryRouter, { initialEntries: ['/'] }, children),
      });
      unmount();
      expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
      removeSpy.mockRestore();
    });
  });
});
