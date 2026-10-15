/**
 * @fileoverview Unit tests for TabNavigation component
 * Feature: components
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import TabNavigation from '@/components/TabNavigation';

const mocks = vi.hoisted(() => ({
  auth: { authenticated: false, user: null, logout: vi.fn() },
  isMobile: false,
  navigate: vi.fn(),
  trackEvent: vi.fn(),
}));

vi.mock('@/hooks/useKeycloak', () => ({
  useKeycloak: () => mocks.auth,
}));

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => mocks.isMobile,
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => mocks.navigate };
});

vi.mock('@/utils/googleAnalytics.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, trackEvent: (...args) => mocks.trackEvent(...args) };
});

function renderTabNavigation(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

/** The horizontally scrolling tab strip only exists in the mobile layout. */
function getScrollStrip() {
  return document.querySelector('.scrollbar-hide');
}

/** Drive the scroll listener with a given geometry. */
function scrollStrip({ scrollLeft, scrollWidth = 600, clientWidth = 300 }) {
  const strip = getScrollStrip();
  Object.defineProperty(strip, 'scrollLeft', { value: scrollLeft, configurable: true });
  Object.defineProperty(strip, 'scrollWidth', { value: scrollWidth, configurable: true });
  Object.defineProperty(strip, 'clientWidth', { value: clientWidth, configurable: true });
  act(() => {
    fireEvent.scroll(strip);
  });
  return strip;
}

const FADE_SELECTOR = '.pointer-events-none.absolute';
const FLAG_ON = 'true';
const ARIA_SELECTED = 'aria-selected';
const USER_MENU_LABEL = 'Account and sign out';

describe('TabNavigation', () => {
  beforeEach(() => {
    mocks.auth = { authenticated: false, user: null, logout: vi.fn() };
    mocks.isMobile = false;
    mocks.navigate = vi.fn();
    mocks.trackEvent.mockReset();
    // jsdom does not implement scrollIntoView, which the mobile layout calls.
    Element.prototype.scrollIntoView = vi.fn();
    vi.stubEnv('VITE_ENABLE_TDIS_AI', 'false');
    vi.stubEnv('VITE_ENABLE_ACTIVE_WEATHER_EVENTS_BETA', 'false');
    vi.stubEnv('VITE_ENABLE_DAMAGE_ASSESSMENT', 'false');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders default tabs', () => {
    const setActiveTab = vi.fn();
    renderTabNavigation(
      <TabNavigation activeTab="active-weather-events" setActiveTab={setActiveTab} />
    );
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(5);
  });

  it('calls setActiveTab when tab is clicked', async () => {
    const setActiveTab = vi.fn();
    renderTabNavigation(
      <TabNavigation activeTab="active-weather-events" setActiveTab={setActiveTab} />
    );
    const tabs = screen.getAllByRole('tab');
    await userEvent.click(tabs[1]); // Hazard Severity Outlook (hmed)
    expect(setActiveTab).toHaveBeenCalledWith('hmed');
    expect(mocks.trackEvent).toHaveBeenCalledWith(
      'navigation',
      'navigation',
      expect.objectContaining({ tab: 'hmed', previous_tab: 'active-weather-events' })
    );
  });

  it('still selects the current tab without emitting a navigation event', async () => {
    const setActiveTab = vi.fn();
    renderTabNavigation(
      <TabNavigation activeTab="active-weather-events" setActiveTab={setActiveTab} />
    );
    await userEvent.click(screen.getAllByRole('tab')[0]);
    expect(setActiveTab).toHaveBeenCalledWith('active-weather-events');
    expect(mocks.trackEvent).not.toHaveBeenCalled();
  });

  it('marks active tab with aria-selected', () => {
    renderTabNavigation(<TabNavigation activeTab="osa" setActiveTab={() => {}} />);
    const tabs = screen.getAllByRole('tab');
    const activeTab = tabs.find((t) => t.getAttribute(ARIA_SELECTED) === FLAG_ON);
    expect(activeTab).toBeDefined();
    expect(activeTab).toHaveTextContent(/Infrastructure Status|Infra/);
  });

  it('includes the Live Weather beta tab when its flag is on', () => {
    vi.stubEnv('VITE_ENABLE_ACTIVE_WEATHER_EVENTS_BETA', FLAG_ON);
    renderTabNavigation(<TabNavigation activeTab="hmed" setActiveTab={() => {}} />);
    expect(screen.getAllByRole('tab')).toHaveLength(6);
    expect(screen.getByText('Live Weather — Beta')).toBeInTheDocument();
  });

  it('includes the Damage Assessment tab when its flag is on', () => {
    vi.stubEnv('VITE_ENABLE_DAMAGE_ASSESSMENT', FLAG_ON);
    renderTabNavigation(<TabNavigation activeTab="hmed" setActiveTab={() => {}} />);
    expect(screen.getByText('Damage Assessment')).toBeInTheDocument();
  });

  it('hides the Damage Assessment tab when its flag is off', () => {
    vi.stubEnv('VITE_ENABLE_DAMAGE_ASSESSMENT', 'false');
    renderTabNavigation(<TabNavigation activeTab="hmed" setActiveTab={() => {}} />);
    expect(screen.queryByText('Damage Assessment')).not.toBeInTheDocument();
  });

  describe('TDIS AI pill', () => {
    beforeEach(() => {
      vi.stubEnv('VITE_ENABLE_TDIS_AI', FLAG_ON);
    });

    it('renders the assistant tab and switches to it on click', async () => {
      const setActiveTab = vi.fn();
      renderTabNavigation(<TabNavigation activeTab="hmed" setActiveTab={setActiveTab} />);

      const aiTab = screen.getByText('TDIS AI').closest('button');
      expect(aiTab).toHaveAttribute(ARIA_SELECTED, 'false');

      await userEvent.click(aiTab);
      expect(setActiveTab).toHaveBeenCalledWith('ai-assistant');
      expect(mocks.trackEvent).toHaveBeenCalledWith(
        'navigation',
        'navigation',
        expect.objectContaining({ tab: 'ai-assistant', previous_tab: 'hmed' })
      );
    });

    it('marks the assistant tab active when it is the current tab', () => {
      renderTabNavigation(<TabNavigation activeTab="ai-assistant" setActiveTab={() => {}} />);
      const aiTab = screen.getByText('TDIS AI').closest('button');
      expect(aiTab).toHaveAttribute(ARIA_SELECTED, FLAG_ON);
      expect(aiTab.className).toContain('tdis-ai-tab--active');
    });
  });

  describe('mobile layout', () => {
    beforeEach(() => {
      mocks.isMobile = true;
    });

    it('uses short labels', () => {
      renderTabNavigation(<TabNavigation activeTab="osa" setActiveTab={() => {}} />);
      expect(screen.getByText('Infra')).toBeInTheDocument();
      expect(screen.queryByText('Infrastructure Status')).not.toBeInTheDocument();
    });

    it('uses the AI short label and skips scrolling when the pill is outside the strip', () => {
      vi.stubEnv('VITE_ENABLE_TDIS_AI', FLAG_ON);
      Element.prototype.scrollIntoView.mockClear();
      renderTabNavigation(<TabNavigation activeTab="ai-assistant" setActiveTab={() => {}} />);
      expect(screen.getByText('AI')).toBeInTheDocument();
      expect(screen.queryByText('TDIS AI')).not.toBeInTheDocument();
      expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
    });

    it('shows the beta short label when that flag is on', () => {
      vi.stubEnv('VITE_ENABLE_ACTIVE_WEATHER_EVENTS_BETA', FLAG_ON);
      renderTabNavigation(<TabNavigation activeTab="hmed" setActiveTab={() => {}} />);
      expect(screen.getByText('Live β')).toBeInTheDocument();
    });

    it('scrolls the active tab into view', () => {
      renderTabNavigation(<TabNavigation activeTab="hmed" setActiveTab={() => {}} />);

      expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith(
        expect.objectContaining({ inline: 'center' })
      );
    });

    it('shows no fades when the strip is scrolled to the start and fully visible', () => {
      renderTabNavigation(<TabNavigation activeTab="hmed" setActiveTab={() => {}} />);

      scrollStrip({ scrollLeft: 0, scrollWidth: 300, clientWidth: 300 });

      expect(document.querySelectorAll(FADE_SELECTOR)).toHaveLength(0);
    });

    it('shows the right fade when more tabs remain to the right', () => {
      renderTabNavigation(<TabNavigation activeTab="hmed" setActiveTab={() => {}} />);

      scrollStrip({ scrollLeft: 0, scrollWidth: 600, clientWidth: 300 });

      const fades = document.querySelectorAll(FADE_SELECTOR);
      expect(fades).toHaveLength(1);
      expect(fades[0].className).toContain('right-0');
    });

    it('shows both fades mid-scroll', () => {
      renderTabNavigation(<TabNavigation activeTab="hmed" setActiveTab={() => {}} />);

      scrollStrip({ scrollLeft: 150, scrollWidth: 600, clientWidth: 300 });

      const fades = document.querySelectorAll(FADE_SELECTOR);
      expect(fades).toHaveLength(2);
    });

    it('shows only the left fade at the end of the strip', () => {
      renderTabNavigation(<TabNavigation activeTab="hmed" setActiveTab={() => {}} />);

      scrollStrip({ scrollLeft: 300, scrollWidth: 600, clientWidth: 300 });

      const fades = document.querySelectorAll(FADE_SELECTOR);
      expect(fades).toHaveLength(1);
      expect(fades[0].className).toContain('left-0');
    });

    it('recomputes fades on window resize', () => {
      renderTabNavigation(<TabNavigation activeTab="hmed" setActiveTab={() => {}} />);
      const strip = scrollStrip({ scrollLeft: 0, scrollWidth: 300, clientWidth: 300 });

      Object.defineProperty(strip, 'scrollWidth', { value: 900, configurable: true });
      act(() => {
        fireEvent(window, new Event('resize'));
      });

      expect(document.querySelectorAll(FADE_SELECTOR)).toHaveLength(1);
    });

    it('detaches its scroll and resize listeners on unmount', () => {
      const removeSpy = vi.spyOn(window, 'removeEventListener');
      const { unmount } = renderTabNavigation(
        <TabNavigation activeTab="hmed" setActiveTab={() => {}} />
      );

      unmount();

      expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));
      removeSpy.mockRestore();
    });
  });

  describe('signed-in user bar', () => {
    const openUserMenu = async () => {
      await userEvent.click(screen.getByLabelText(USER_MENU_LABEL));
    };

    it('is hidden for anonymous visitors', () => {
      renderTabNavigation(<TabNavigation activeTab="hmed" setActiveTab={() => {}} />);
      expect(screen.queryByLabelText(USER_MENU_LABEL)).not.toBeInTheDocument();
    });

    it('offers Admin Panel for super admins and navigates there', async () => {
      mocks.auth = {
        authenticated: true,
        user: { user_id: 'u1', preferredUsername: 'super', roles: ['super_admin', 'admin'] },
        logout: vi.fn(),
      };
      renderTabNavigation(<TabNavigation activeTab="hmed" setActiveTab={() => {}} />);

      await openUserMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: 'Admin Panel' }));

      expect(mocks.navigate).toHaveBeenCalledWith('/admin/signups');
    });

    it('offers Manage Org for org admins and navigates there', async () => {
      mocks.auth = {
        authenticated: true,
        user: { user_id: 'u2', preferredUsername: 'orgadmin', roles: ['admin'] },
        logout: vi.fn(),
      };
      renderTabNavigation(<TabNavigation activeTab="hmed" setActiveTab={() => {}} />);

      await openUserMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: 'Manage Org' }));

      expect(mocks.navigate).toHaveBeenCalledWith('/org/members');
    });

    it('offers no admin action for regular members', async () => {
      mocks.auth = {
        authenticated: true,
        user: { user_id: 'u3', preferredUsername: 'member', roles: ['user'] },
        logout: vi.fn(),
      };
      renderTabNavigation(<TabNavigation activeTab="hmed" setActiveTab={() => {}} />);

      await openUserMenu();

      expect(screen.getAllByRole('menuitem')).toHaveLength(1);
      expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument();
    });

    it('renders the user bar in the mobile layout too', () => {
      mocks.isMobile = true;
      mocks.auth = {
        authenticated: true,
        user: { user_id: 'u4', preferredUsername: 'member', roles: ['user'] },
        logout: vi.fn(),
      };
      renderTabNavigation(<TabNavigation activeTab="hmed" setActiveTab={() => {}} />);

      expect(screen.getByLabelText(USER_MENU_LABEL)).toBeInTheDocument();
    });

    it('signs the user out from the account menu', async () => {
      const logout = vi.fn();
      mocks.auth = {
        authenticated: true,
        user: { user_id: 'u5', preferredUsername: null, roles: ['user'] },
        logout,
      };
      renderTabNavigation(<TabNavigation activeTab="hmed" setActiveTab={() => {}} />);

      await openUserMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
      expect(logout).toHaveBeenCalled();
    });

    it('offers Admin Panel from the mobile user bar', async () => {
      mocks.isMobile = true;
      mocks.auth = {
        authenticated: true,
        user: { user_id: 'u6', preferredUsername: 'super', roles: ['super_admin'] },
        logout: vi.fn(),
      };
      renderTabNavigation(<TabNavigation activeTab="osa" setActiveTab={() => {}} />);

      await openUserMenu();
      await userEvent.click(screen.getByRole('menuitem', { name: 'Admin Panel' }));
      expect(mocks.navigate).toHaveBeenCalledWith('/admin/signups');
    });
  });
});
