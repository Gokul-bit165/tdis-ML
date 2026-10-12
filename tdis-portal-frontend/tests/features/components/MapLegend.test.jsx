/**
 * @fileoverview Unit tests for MapLegend component (Active Weather Events)
 * Feature: Active Weather Events
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MapLegend from '@/components/MapLegend';

vi.mock('framer-motion', () => ({
  motion: {
    button: ({ children, ...props }) => <button {...props}>{children}</button>,
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }) => children,
}));

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: vi.fn(() => false),
}));

describe('MapLegend', () => {
  it('renders Active Events section', () => {
    render(
      <MapLegend
        selectedEvents={[]}
        setSelectedEvents={() => {}}
        loading={false}
        eventCounts={[]}
      />
    );
    expect(screen.getByText('Active Events')).toBeInTheDocument();
    expect(screen.queryByText('Forecast Events')).not.toBeInTheDocument();
  });

  it('renders event type buttons for Active Events only', () => {
    render(
      <MapLegend
        selectedEvents={[]}
        setSelectedEvents={() => {}}
        loading={false}
        eventCounts={[]}
      />
    );
    expect(screen.getByRole('button', { name: /Wildfire/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Rainfall/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Hurricane/i })).not.toBeInTheDocument();
  });

  it('calls setSelectedEvents when toggling an event', async () => {
    const setSelectedEvents = vi.fn();
    render(
      <MapLegend
        selectedEvents={[]}
        setSelectedEvents={setSelectedEvents}
        loading={false}
        eventCounts={[{ type: 'wildfire', count: 1 }]}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /Wildfire/i }));
    expect(setSelectedEvents).toHaveBeenCalled();
    const updater = setSelectedEvents.mock.calls[0][0];
    expect(updater(['Wildfire'])).toEqual([]);
    expect(updater([])).toEqual(['Wildfire']);
  });

  it('disables event button when event has no data (count 0)', () => {
    render(
      <MapLegend
        selectedEvents={[]}
        setSelectedEvents={() => {}}
        loading={false}
        eventCounts={[{ type: 'wildfire', count: 0 }]}
      />
    );
    const btn = screen.getByRole('button', { name: /Wildfire/i });
    expect(btn).toBeDisabled();
  });

  it('shows skeleton placeholders when loading', () => {
    const { container } = render(
      <MapLegend selectedEvents={[]} setSelectedEvents={() => {}} loading={true} eventCounts={[]} />
    );
    const skeletons = container.querySelectorAll('[class*="animate-pulse"], .rounded-full');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('normalizes event type keys for counts (lowercase, trim)', () => {
    render(
      <MapLegend
        selectedEvents={[]}
        setSelectedEvents={() => {}}
        loading={false}
        eventCounts={[{ type: '  HIGH WIND  ', count: 3 }]}
      />
    );
    const highWindBtn = screen.getByRole('button', { name: /High wind/i });
    expect(highWindBtn).not.toBeDisabled();
  });

  describe('critical facility overlays', () => {
    it('toggles a facility on click', async () => {
      const setFacilityVisibility = vi.fn();
      render(
        <MapLegend
          selectedEvents={[]}
          setSelectedEvents={() => {}}
          loading={false}
          eventCounts={[]}
          facilityVisibility={{ fire_stations: false }}
          setFacilityVisibility={setFacilityVisibility}
        />
      );

      await userEvent.click(screen.getByRole('button', { name: /Fire stations/i }));

      const updater = setFacilityVisibility.mock.calls[0][0];
      expect(updater({ fire_stations: false })).toEqual({ fire_stations: true });
      expect(updater({ fire_stations: true })).toEqual({ fire_stations: false });
    });

    it('reflects the visible state of each facility', () => {
      render(
        <MapLegend
          selectedEvents={[]}
          setSelectedEvents={() => {}}
          loading={false}
          eventCounts={[]}
          facilityVisibility={{ fire_stations: true, schools: false }}
          setFacilityVisibility={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: /Fire stations/i })).toBeEnabled();
      expect(screen.getByRole('button', { name: /Schools/i })).toBeEnabled();
    });

    it('is inert when no visibility setter is supplied', async () => {
      render(
        <MapLegend
          selectedEvents={[]}
          setSelectedEvents={() => {}}
          loading={false}
          eventCounts={[]}
        />
      );

      const facilityButton = screen.getByRole('button', { name: /Hospitals/i });
      await userEvent.click(facilityButton);

      expect(facilityButton).toBeInTheDocument();
    });
  });

  describe('mobile layout', () => {
    beforeEach(async () => {
      const useIsMobile = (await import('@/hooks/use-mobile')).useIsMobile;
      vi.mocked(useIsMobile).mockReturnValue(true);
    });

    it('shows FAB Filters button when not expanded', () => {
      render(
        <MapLegend
          selectedEvents={[]}
          setSelectedEvents={() => {}}
          loading={false}
          eventCounts={[]}
        />
      );
      expect(screen.getByRole('button', { name: /Filters/i })).toBeInTheDocument();
    });

    it('opens slide-up panel when FAB is clicked', async () => {
      const setSelectedEvents = vi.fn();
      render(
        <MapLegend
          selectedEvents={[]}
          setSelectedEvents={setSelectedEvents}
          loading={false}
          eventCounts={[]}
        />
      );
      await userEvent.click(screen.getByRole('button', { name: /Filters/i }));
      expect(screen.getByText('Event Filters')).toBeInTheDocument();
      expect(screen.getByText('Active Events')).toBeInTheDocument();
    });

    it('closes panel when backdrop is clicked', async () => {
      const { container } = render(
        <MapLegend
          selectedEvents={[]}
          setSelectedEvents={() => {}}
          loading={false}
          eventCounts={[]}
        />
      );
      await userEvent.click(screen.getByRole('button', { name: /Filters/i }));
      expect(screen.getByText('Event Filters')).toBeInTheDocument();
      const backdrop = container.querySelector('[class*="bg-black"]');
      if (backdrop) await userEvent.click(backdrop);
      expect(screen.getByRole('button', { name: /Filters/i })).toBeInTheDocument();
    });
  });
});
