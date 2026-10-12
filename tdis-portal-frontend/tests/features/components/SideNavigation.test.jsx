/**
 * @fileoverview Unit tests for SideNavigation component
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SideNavigation from '@/components/SideNavigation';

const mockNavigate = vi.fn();
let mockLocation = { pathname: '/', state: null };

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockLocation,
  };
});

const PROJECTS_TOOLS_LIST_LABEL = 'Projects/Tools List';

describe('SideNavigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders toggle button', () => {
    render(
      <MemoryRouter>
        <SideNavigation isExpanded={false} setIsExpanded={() => {}} />
      </MemoryRouter>
    );
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('calls setIsExpanded when toggle is clicked', async () => {
    const user = userEvent.setup();
    const setIsExpanded = vi.fn();
    render(
      <MemoryRouter>
        <SideNavigation isExpanded={false} setIsExpanded={setIsExpanded} />
      </MemoryRouter>
    );
    await user.click(screen.getByRole('button'));
    expect(setIsExpanded).toHaveBeenCalledWith(true);
  });

  it('when expanded shows navigation links', () => {
    render(
      <MemoryRouter>
        <SideNavigation isExpanded setIsExpanded={() => {}} />
      </MemoryRouter>
    );
    expect(screen.getByText(PROJECTS_TOOLS_LIST_LABEL)).toBeInTheDocument();
    expect(screen.getByText('About TDIS')).toBeInTheDocument();
    expect(screen.getByText('Application Intake')).toBeInTheDocument();
    expect(screen.getByText('Contact Us')).toBeInTheDocument();
  });

  it('when expanded shows title and logo', () => {
    render(
      <MemoryRouter>
        <SideNavigation isExpanded setIsExpanded={() => {}} />
      </MemoryRouter>
    );
    expect(screen.getByText(/Disaster Support for a better Texas/i)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /TDIS Logo/i })).toBeInTheDocument();
  });

  it('clicking nav link calls scrollToSection which navigates when not on home', async () => {
    const user = userEvent.setup();
    mockLocation = { pathname: '/other', state: null };
    render(
      <MemoryRouter>
        <SideNavigation isExpanded setIsExpanded={() => {}} />
      </MemoryRouter>
    );
    await user.click(screen.getByText(PROJECTS_TOOLS_LIST_LABEL));
    expect(mockNavigate).toHaveBeenCalledWith('/', { state: { scrollTo: 'what-we-do' } });
    mockLocation = { pathname: '/', state: null };
  });

  it('clicking each expanded nav link navigates with the matching section', async () => {
    const user = userEvent.setup();
    mockLocation = { pathname: '/other', state: null };
    render(
      <MemoryRouter>
        <SideNavigation isExpanded setIsExpanded={() => {}} />
      </MemoryRouter>
    );

    await user.click(screen.getByText('About TDIS'));
    expect(mockNavigate).toHaveBeenCalledWith('/', { state: { scrollTo: 'who-works-with-us' } });
    await user.click(screen.getByText('Application Intake'));
    expect(mockNavigate).toHaveBeenCalledWith('/', { state: { scrollTo: 'app-dataset-intake' } });
    await user.click(screen.getByText('Contact Us'));
    expect(mockNavigate).toHaveBeenCalledWith('/', { state: { scrollTo: 'contact-us' } });

    mockLocation = { pathname: '/', state: null };
  });

  it('when collapsed does not show nav content', () => {
    render(
      <MemoryRouter>
        <SideNavigation isExpanded={false} setIsExpanded={() => {}} />
      </MemoryRouter>
    );
    expect(screen.queryByText(PROJECTS_TOOLS_LIST_LABEL)).not.toBeInTheDocument();
  });
});
