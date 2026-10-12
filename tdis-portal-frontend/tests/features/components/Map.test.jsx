/**
 * @fileoverview Unit tests for Map component (Active Weather Events)
 * Feature: Active Weather Events
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import MapView from '@/components/Map';
import { useWeatherEventsMap } from '@/hooks/useWeatherEventsMap';

const mockResize = vi.fn();
const mockMapRef = { current: { resize: mockResize } };

vi.mock('mapbox-gl', () => ({
  default: {
    accessToken: '',
    Map: vi.fn(),
    NavigationControl: vi.fn(),
    FullscreenControl: vi.fn(),
    ScaleControl: vi.fn(),
  },
}));

vi.mock('@/hooks/useWeatherEventsMap', () => ({
  useWeatherEventsMap: vi.fn(),
}));

vi.mock('@/components/MapLegend', () => ({
  default: function MockMapLegend({ selectedEvents, loading, eventCounts }) {
    return (
      <div data-testid="map-legend">
        <span data-testid="legend-loading">{String(loading)}</span>
        <span data-testid="legend-events">{JSON.stringify(selectedEvents)}</span>
        <span data-testid="legend-counts">{JSON.stringify(eventCounts)}</span>
      </div>
    );
  },
}));

vi.mock('@/components/ui/map-components', () => ({
  MapLoadingIndicator: () => <div data-testid="map-loading-indicator">Loading</div>,
  MapErrorMessage: ({ message }) => <div data-testid="map-error-message">{message}</div>,
}));

describe('Map (Active Weather Events)', () => {
  const defaultProps = {
    selectedEvents: ['Wildfire', 'Rainfall'],
    setSelectedEvents: vi.fn(),
    layerVisibility: { events: true },
    setEventCounts: vi.fn(),
    isExpanded: false,
    setIsEventCountsLoading: vi.fn(),
    sidebarExpanded: true,
    onMapReady: vi.fn(),
    onMapRefresh: vi.fn(),
    eventCounts: [],
    onLatestEventDate: vi.fn(),
  };

  const defaultReturn = {
    mapRef: mockMapRef,
    loadingStates: { events: false, geojson: false, eventCounts: false },
    error: null,
    setError: vi.fn(),
  };

  beforeEach(() => {
    mockResize.mockClear();
    vi.mocked(useWeatherEventsMap).mockReturnValue(defaultReturn);
  });

  it('renders map container and legend when no error', () => {
    render(<MapView {...defaultProps} />);
    expect(screen.getByTestId('map-legend')).toBeInTheDocument();
    expect(screen.queryByTestId('map-error-message')).not.toBeInTheDocument();
  });

  it('shows MapErrorMessage when useWeatherEventsMap returns error', () => {
    vi.mocked(useWeatherEventsMap).mockReturnValue({
      mapRef: mockMapRef,
      loadingStates: { events: false, geojson: false, eventCounts: false },
      error: 'Failed to load event data.',
      setError: vi.fn(),
    });
    render(<MapView {...defaultProps} />);
    expect(screen.getByTestId('map-error-message')).toHaveTextContent('Failed to load event data.');
  });

  it('still shows legend when there is an error', () => {
    vi.mocked(useWeatherEventsMap).mockReturnValue({
      mapRef: mockMapRef,
      loadingStates: { events: false, geojson: false, eventCounts: false },
      error: 'Mapbox access token is not configured',
      setError: vi.fn(),
    });
    render(<MapView {...defaultProps} />);
    expect(screen.getByTestId('map-legend')).toBeInTheDocument();
  });

  it('shows MapLoadingIndicator when loading', () => {
    vi.mocked(useWeatherEventsMap).mockReturnValue({
      mapRef: mockMapRef,
      loadingStates: { events: true, geojson: false, eventCounts: false },
      error: null,
      setError: vi.fn(),
    });
    render(<MapView {...defaultProps} />);
    expect(screen.getByTestId('map-loading-indicator')).toBeInTheDocument();
  });

  it('passes loading true to MapLegend when any loading state is true', () => {
    vi.mocked(useWeatherEventsMap).mockReturnValue({
      mapRef: mockMapRef,
      loadingStates: { events: false, geojson: true, eventCounts: false },
      error: null,
      setError: vi.fn(),
    });
    render(<MapView {...defaultProps} />);
    expect(screen.getByTestId('legend-loading')).toHaveTextContent('true');
  });

  it('uses default eventCounts when not provided', () => {
    render(<MapView {...defaultProps} eventCounts={undefined} />);
    expect(screen.getByTestId('legend-counts')).toHaveTextContent('[]');
  });
});
