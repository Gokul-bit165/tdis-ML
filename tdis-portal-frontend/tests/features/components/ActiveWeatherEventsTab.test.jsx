/**
 * @fileoverview Unit tests for ActiveWeatherEventsTab component
 * Feature: Active Weather Events
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ActiveWeatherEventsTab from '@/components/ActiveWeatherEventsTab';

vi.mock('@/components/Map.jsx', () => ({
  default: function MockMap(props) {
    return (
      <div data-testid="map-container">
        <span data-testid="map-selected-events">{JSON.stringify(props.selectedEvents)}</span>
        <span data-testid="map-event-counts">{JSON.stringify(props.eventCounts)}</span>
        <span data-testid="map-layer-visibility">{JSON.stringify(props.layerVisibility)}</span>
        <span data-testid="map-sidebar-expanded">{String(props.sidebarExpanded)}</span>
      </div>
    );
  },
}));

describe('ActiveWeatherEventsTab', () => {
  const defaultProps = {
    selectedEvents: ['Wildfire', 'Rainfall'],
    setSelectedEvents: vi.fn(),
    layerVisibility: { events: true, counties: false },
    setEventCounts: vi.fn(),
    isExpanded: false,
    isEventCountsLoading: false,
    setIsEventCountsLoading: vi.fn(),
    sidebarExpanded: true,
    onMapReady: vi.fn(),
    onMapRefresh: vi.fn(),
    eventCounts: [],
    onLatestEventDate: vi.fn(),
  };

  it('renders a full-size container with Map', () => {
    render(<ActiveWeatherEventsTab {...defaultProps} />);
    const map = screen.getByTestId('map-container');
    expect(map).toBeInTheDocument();
    const wrapper = map.closest('.absolute.inset-0');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveClass('w-full', 'h-full');
  });

  it('passes selectedEvents to Map', () => {
    const selected = ['Earthquake', 'Hail'];
    render(<ActiveWeatherEventsTab {...defaultProps} selectedEvents={selected} />);
    expect(screen.getByTestId('map-selected-events')).toHaveTextContent(JSON.stringify(selected));
  });

  it('passes eventCounts to Map', () => {
    const counts = [{ type: 'wildfire', count: 5 }];
    render(<ActiveWeatherEventsTab {...defaultProps} eventCounts={counts} />);
    expect(screen.getByTestId('map-event-counts')).toHaveTextContent(JSON.stringify(counts));
  });

  it('passes layerVisibility to Map', () => {
    const visibility = { events: false, counties: true };
    render(<ActiveWeatherEventsTab {...defaultProps} layerVisibility={visibility} />);
    expect(screen.getByTestId('map-layer-visibility')).toHaveTextContent(
      JSON.stringify(visibility)
    );
  });

  it('passes sidebarExpanded to Map', () => {
    render(<ActiveWeatherEventsTab {...defaultProps} sidebarExpanded={false} />);
    expect(screen.getByTestId('map-sidebar-expanded')).toHaveTextContent('false');
  });
});
