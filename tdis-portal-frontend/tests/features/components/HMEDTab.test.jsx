/**
 * @fileoverview Unit tests for HMEDTab
 * Mocks Mapbox and map hooks so component renders and HMED UI is testable.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HMEDTab from '@/components/HMEDTab';

const mockUseIsMobile = vi.fn(() => false);
const mockUseHMEDMapLayers = vi.fn(() => ({
  mapRef: { current: null },
  mapReady: false,
  isLoading: false,
  error: null,
  setError: vi.fn(),
  hexLayersGeneration: 0,
}));

vi.mock('mapbox-gl', () => ({ default: {} }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => mockUseIsMobile() }));
vi.mock('@/hooks/useHMEDMapLayers', () => ({
  useHMEDMapLayers: (...args) => mockUseHMEDMapLayers(...args),
}));
vi.mock('@/hooks/useHMEDHexInteractions', () => ({ useHMEDHexInteractions: () => {} }));
vi.mock('@/hooks/useHMEDFloodHubOverlays', () => ({
  useHMEDFloodHubOverlays: () => ({ isLoadingOverlays: false }),
}));
vi.mock('@/hooks/useMapResize', () => ({ useMapResize: () => {} }));

describe('HMEDTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseIsMobile.mockReturnValue(false);
    mockUseHMEDMapLayers.mockReturnValue({
      mapRef: { current: null },
      mapReady: false,
      isLoading: false,
      error: null,
      setError: vi.fn(),
      hexLayersGeneration: 0,
    });
  });

  it('renders map container and control panel', () => {
    render(<HMEDTab />);
    expect(document.querySelector('.relative.w-full.h-full')).toBeInTheDocument();
    expect(screen.getAllByText(/Precipitation HSI/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/3h window/i)).toBeInTheDocument();
  });

  it('renders Info button in control panel', () => {
    render(<HMEDTab />);
    expect(screen.getByRole('button', { name: /Show information/i })).toBeInTheDocument();
  });

  it('opens HMED info modal when Info is clicked', async () => {
    render(<HMEDTab />);
    await userEvent.click(screen.getByRole('button', { name: /Show information/i }));
    expect(
      screen.getByRole('heading', { name: /Precipitation HSI Information/i })
    ).toBeInTheDocument();
  });

  it('renders Hazard Layer selector with Precipitation', () => {
    render(<HMEDTab />);
    expect(screen.getByText('Hazard Layer')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Precipitation/i })).toBeInTheDocument();
  });

  it('renders Time Window options', () => {
    render(<HMEDTab />);
    expect(screen.getByText('Time Window')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '3h' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '6h' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '12h' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '24h' })).toBeInTheDocument();
  });

  it('renders Intensity Scale section', () => {
    render(<HMEDTab />);
    expect(screen.getByText('Intensity Scale')).toBeInTheDocument();
    expect(screen.getByText(/Low → High/i)).toBeInTheDocument();
  });

  it('renders HMEDMobilePanel when useIsMobile returns true', () => {
    mockUseIsMobile.mockReturnValue(true);
    render(<HMEDTab />);
    expect(screen.getByRole('button', { name: /Controls/i })).toBeInTheDocument();
  });

  it('shows loading indicator when useHMEDMapLayers returns isLoading true', () => {
    mockUseHMEDMapLayers.mockReturnValue({
      mapRef: { current: null },
      mapReady: false,
      isLoading: true,
      error: null,
      setError: vi.fn(),
      hexLayersGeneration: 0,
    });
    render(<HMEDTab />);
    expect(screen.getByText('Loading map data')).toBeInTheDocument();
  });

  it('shows error message when useHMEDMapLayers returns error', () => {
    mockUseHMEDMapLayers.mockReturnValue({
      mapRef: { current: null },
      mapReady: false,
      isLoading: false,
      error: 'Failed to load map data.',
      setError: vi.fn(),
      hexLayersGeneration: 0,
    });
    render(<HMEDTab />);
    expect(screen.getByText('Failed to load map data.')).toBeInTheDocument();
  });
});
