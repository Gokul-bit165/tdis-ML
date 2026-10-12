/**
 * @fileoverview Unit tests for OSATab
 * Mocks Mapbox and map hooks so component renders and OSA UI is testable.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OSATab from '@/components/OSATab';

vi.mock('mapbox-gl', () => ({ default: {} }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/hooks/useOSAMapLayers', () => ({
  useOSAMapLayers: () => ({
    mapRef: { current: null },
    mapReady: false,
    isLoading: false,
    error: null,
    setError: vi.fn(),
    updateLayerVisibility: vi.fn(),
  }),
}));
vi.mock('@/hooks/useOSASummaryData', () => ({
  useOSASummaryData: () => ({
    viewMode: 'county',
    setViewMode: vi.fn(),
    handleViewModeChange: vi.fn(),
    summaryStats: { totalCustomersOut: 0, allData: [] },
    isLoadingData: false,
    searchQuery: '',
    setSearchQuery: vi.fn(),
    handleSummaryItemClick: vi.fn(),
  }),
}));
vi.mock('@/hooks/useHazardLayers', () => ({
  useHazardLayers: () => ({ isInitialized: false }),
}));
vi.mock('@/hooks/useHazardMapClick', () => ({ useHazardMapClick: () => {} }));
vi.mock('@/hooks/useMapResize', () => ({ useMapResize: () => {} }));

describe('OSATab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders map container and control panel', () => {
    render(<OSATab />);
    expect(document.querySelector('.relative.w-full.h-full')).toBeInTheDocument();
    expect(screen.getAllByText('Power Outages').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Infrastructure Status')).toBeInTheDocument();
  });

  it('renders Info button in control panel', () => {
    render(<OSATab />);
    expect(screen.getByRole('button', { name: /Show information/i })).toBeInTheDocument();
  });

  it('opens OSA info modal when Info is clicked', async () => {
    render(<OSATab />);
    await userEvent.click(screen.getByRole('button', { name: /Show information/i }));
    expect(screen.getByRole('heading', { name: /Power Outage Information/i })).toBeInTheDocument();
  });

  it('renders Data Layer selector with power outage options', () => {
    render(<OSATab />);
    expect(screen.getByText('Data Layer')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Power Outages by Zip/i })).toBeInTheDocument();
  });
});
