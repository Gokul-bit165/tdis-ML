/**
 * @fileoverview Unit tests for Header component
 * Feature: layout
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Header from '@/components/Header';

const mockNavigate = vi.fn();
const gaMocks = vi.hoisted(() => ({
  trackEvent: vi.fn(),
  trackOutboundClick: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/utils/googleAnalytics.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    trackEvent: (...args) => gaMocks.trackEvent(...args),
    trackOutboundClick: (...args) => gaMocks.trackOutboundClick(...args),
  };
});

function renderHeader(initialEntries = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Header />
    </MemoryRouter>
  );
}

const WHAT_WE_DO_SECTION_ID = 'what-we-do';
const CONTACT_US_SECTION_ID = 'contact-us';
const ABOUT_SECTION_ID = 'who-works-with-us';

describe('Header', () => {
  const originalGetElementById = document.getElementById.bind(document);
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { pathname: '/' },
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    document.getElementById = originalGetElementById;
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
  });

  it('renders navigation buttons', () => {
    renderHeader();
    expect(screen.getByRole('button', { name: /What We Do/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /About TDIS/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Contact Us/i })).toBeInTheDocument();
  });

  it('renders TDIS and GLO logo links', () => {
    renderHeader();
    expect(screen.getByRole('link', { name: /Visit TDIS website/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Visit GLO website/i })).toBeInTheDocument();
  });

  it('renders TAMU logo link', () => {
    renderHeader();
    expect(
      screen.getByRole('link', { name: /Visit Texas A&M University website/i })
    ).toBeInTheDocument();
  });

  it('tracks outbound clicks on partner logos', () => {
    renderHeader();
    fireEvent.click(screen.getByRole('link', { name: /Visit TDIS website/i }));
    fireEvent.click(screen.getByRole('link', { name: /Visit GLO website/i }));
    fireEvent.click(screen.getByRole('link', { name: /Visit Texas A&M University website/i }));
    expect(gaMocks.trackOutboundClick).toHaveBeenCalledWith('https://idrt.tamug.edu/');
    expect(gaMocks.trackOutboundClick).toHaveBeenCalledWith('https://glo.texas.gov/');
    expect(gaMocks.trackOutboundClick).toHaveBeenCalledWith('https://www.tamu.edu/');
  });

  it('scrollToSection on home page scrolls to element when id exists', () => {
    const mockScrollIntoView = vi.fn();
    const el = document.createElement('div');
    el.id = WHAT_WE_DO_SECTION_ID;
    el.scrollIntoView = mockScrollIntoView;
    document.getElementById = vi.fn((id) => (id === WHAT_WE_DO_SECTION_ID ? el : null));
    renderHeader(['/']);
    fireEvent.click(screen.getByRole('button', { name: /What We Do/i }));
    expect(gaMocks.trackEvent).toHaveBeenCalledWith(
      'navigation',
      'navigation',
      expect.objectContaining({ tab: 'home', section: WHAT_WE_DO_SECTION_ID })
    );
    expect(mockScrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
  });

  it('does not scroll when the home-page section is missing', () => {
    document.getElementById = vi.fn(() => null);
    renderHeader(['/']);
    fireEvent.click(screen.getByRole('button', { name: /About TDIS/i }));
    expect(gaMocks.trackEvent).toHaveBeenCalledWith(
      'navigation',
      'navigation',
      expect.objectContaining({ section: ABOUT_SECTION_ID })
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('scrollToSection when not on home navigates with scrollTo state', () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { pathname: '/other' },
    });
    renderHeader(['/other']);
    fireEvent.click(screen.getByRole('button', { name: /What We Do/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/', { state: { scrollTo: WHAT_WE_DO_SECTION_ID } });
  });

  it('navigates home with Contact Us as the scroll target from another route', () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { pathname: '/tools' },
    });
    renderHeader(['/tools']);
    fireEvent.click(screen.getByRole('button', { name: /Contact Us/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/', { state: { scrollTo: CONTACT_US_SECTION_ID } });
  });

  it('useEffect scrolls to section when location.state.scrollTo is set and clears state', () => {
    const mockScrollIntoView = vi.fn();
    const el = document.createElement('div');
    el.id = CONTACT_US_SECTION_ID;
    el.scrollIntoView = mockScrollIntoView;
    document.getElementById = vi.fn((id) => (id === CONTACT_US_SECTION_ID ? el : null));
    const { unmount } = render(
      <MemoryRouter
        initialEntries={[{ pathname: '/', state: { scrollTo: CONTACT_US_SECTION_ID } }]}
      >
        <Header />
      </MemoryRouter>
    );
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(document.getElementById).toHaveBeenCalledWith(CONTACT_US_SECTION_ID);
    expect(mockScrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true, state: {} });
    unmount();
  });

  it('clears scrollTo state even when the target element is missing', () => {
    document.getElementById = vi.fn(() => null);
    render(
      <MemoryRouter initialEntries={[{ pathname: '/home', state: { scrollTo: 'missing' } }]}>
        <Header />
      </MemoryRouter>
    );
    expect(mockNavigate).toHaveBeenCalledWith('/home', { replace: true, state: {} });
    act(() => {
      vi.advanceTimersByTime(200);
    });
  });
});
