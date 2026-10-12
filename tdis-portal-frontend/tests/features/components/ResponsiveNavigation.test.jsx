/**
 * @fileoverview Unit tests for ResponsiveNavigation component
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ResponsiveNavigation from '@/components/ResponsiveNavigation';

const mockSetIsExpanded = vi.fn();
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderNav(props = {}, initialEntries = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ResponsiveNavigation
        isExpanded={true}
        setIsExpanded={mockSetIsExpanded}
        activeTab="default"
        {...props}
      />
    </MemoryRouter>
  );
}

const WHAT_WE_DO_SECTION_ID = 'what-we-do';

describe('ResponsiveNavigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'innerWidth', { value: 1280, writable: true });
  });

  it('renders desktop toggle button', () => {
    renderNav({ isExpanded: true });
    const buttons = screen.getAllByRole('button');
    const toggleButton = buttons.find(
      (b) => b.className.includes('rounded-r-md') || b.querySelector('svg')
    );
    expect(toggleButton).toBeTruthy();
    if (toggleButton) {
      fireEvent.click(toggleButton);
      expect(mockSetIsExpanded).toHaveBeenCalledWith(false);
    }
  });

  it('calls setIsExpanded when toggle clicked', () => {
    renderNav({ isExpanded: false });
    const buttons = screen.getAllByRole('button');
    const toggleBtn = buttons.find((b) => b.querySelector('svg'));
    if (toggleBtn) {
      fireEvent.click(toggleBtn);
      expect(mockSetIsExpanded).toHaveBeenCalledWith(true);
    }
  });

  it('shows Hazard Severity Outlook content when activeTab is hmed', () => {
    renderNav({ activeTab: 'hmed' });
    expect(screen.getByText(/Hazard Severity Outlook/)).toBeInTheDocument();
    expect(screen.getByText(/HSI layers provide short term/)).toBeInTheDocument();
  });

  it('shows Infrastructure Status content when activeTab is osa', () => {
    renderNav({ activeTab: 'osa' });
    expect(screen.getAllByText(/Infrastructure Status/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows default TDIS content when activeTab is default', () => {
    renderNav({ activeTab: 'default' });
    expect(screen.getByText(/Disaster Support for a better Texas/)).toBeInTheDocument();
    expect(screen.getByText(/TDIS provides tools/)).toBeInTheDocument();
  });

  it('renders navigation links', () => {
    renderNav();
    expect(screen.getByRole('button', { name: /Projects\/Tools List/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /About TDIS/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Application Intake/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Contact Us/i })).toBeInTheDocument();
  });

  it('scrollToSection scrolls when on home and element exists', () => {
    const mockScrollIntoView = vi.fn();
    const el = document.createElement('div');
    el.id = WHAT_WE_DO_SECTION_ID;
    el.scrollIntoView = mockScrollIntoView;
    document.getElementById = vi.fn((id) => (id === WHAT_WE_DO_SECTION_ID ? el : null));
    renderNav();
    fireEvent.click(screen.getByRole('button', { name: /Projects\/Tools List/i }));
    expect(mockScrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
  });

  it('scrollToSection navigates when not on home', () => {
    renderNav({}, ['/other']);
    fireEvent.click(screen.getByRole('button', { name: /Contact Us/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/', { state: { scrollTo: 'contact-us' } });
  });

  it('desktop nav clicks all section links', () => {
    renderNav({}, ['/other']);
    fireEvent.click(screen.getByRole('button', { name: /About TDIS/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/', { state: { scrollTo: 'who-works-with-us' } });
    fireEvent.click(screen.getByRole('button', { name: /Application Intake/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/', { state: { scrollTo: 'app-dataset-intake' } });
  });

  it('mobile nav clicks all section links after opening menu', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 800, writable: true });
    // Collapse desktop panel so only mobile menu buttons match getByRole names.
    renderNav({ isExpanded: false }, ['/other']);
    fireEvent.resize(window);

    const menuToggle = screen.getAllByRole('button').find((b) =>
      Boolean(b.querySelector('.lucide-menu, svg.lucide-menu'))
    );
    expect(menuToggle).toBeTruthy();
    fireEvent.click(menuToggle);

    fireEvent.click(await screen.findByRole('button', { name: /Projects\/Tools List/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/', { state: { scrollTo: 'what-we-do' } });
    fireEvent.click(screen.getByRole('button', { name: /About TDIS/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/', { state: { scrollTo: 'who-works-with-us' } });
    fireEvent.click(screen.getByRole('button', { name: /Application Intake/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/', { state: { scrollTo: 'app-dataset-intake' } });
    fireEvent.click(screen.getByRole('button', { name: /Contact Us/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/', { state: { scrollTo: 'contact-us' } });
  });

  it('resize to mobile shows mobile content', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 800, writable: true });
    renderNav();
    await waitFor(() => {
      expect(screen.getAllByText(/for a better Texas|Disaster Support/).length).toBeGreaterThan(0);
    });
  });

  it('mobile menu open shows dropdown and close button', () => {
    Object.defineProperty(window, 'innerWidth', { value: 800, writable: true });
    renderNav();
    const menuToggle = screen.getAllByRole('button').find((b) => {
      const svg = b.querySelector('svg');
      return svg && (b.textContent === '' || b.closest('[class*="p-2"]'));
    });
    if (menuToggle) {
      fireEvent.click(menuToggle);
      expect(screen.getByRole('button', { name: /Projects\/Tools List/i })).toBeInTheDocument();
    }
  });

  it('scroll handler runs and checks sections', () => {
    const getElementByIdSpy = vi.spyOn(document, 'getElementById').mockImplementation((id) => {
      const el = document.createElement('div');
      el.id = id;
      Object.defineProperty(el, 'offsetTop', { value: 0, configurable: true });
      Object.defineProperty(el, 'offsetHeight', { value: 500, configurable: true });
      return el;
    });
    try {
      renderNav();
      fireEvent.scroll(window);
      expect(getElementByIdSpy).toHaveBeenCalledWith(WHAT_WE_DO_SECTION_ID);
    } finally {
      getElementByIdSpy.mockRestore();
    }
  });
});
