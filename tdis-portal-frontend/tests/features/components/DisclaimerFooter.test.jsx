/**
 * @fileoverview Unit tests for DisclaimerFooter component
 * Feature: components
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DisclaimerFooter from '@/components/DisclaimerFooter';

// Real AnimatePresence keeps exiting children mounted in jsdom, which hides close behavior.
vi.mock('framer-motion', () => ({
  motion: {
    button: ({ children, ...props }) => <button {...props}>{children}</button>,
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }) => children,
}));

describe('DisclaimerFooter', () => {
  it('renders disclaimer summary', () => {
    render(
      <DisclaimerFooter
        onMapRefresh={vi.fn()}
        activeTab="active-weather-events"
        latestEventDate={null}
      />
    );
    expect(screen.getAllByText(/Disclaimer/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/View full disclaimer/i).length).toBeGreaterThan(0);
  });

  it('opens full disclaimer modal when View full disclaimer is clicked', async () => {
    render(
      <DisclaimerFooter
        onMapRefresh={vi.fn()}
        activeTab="active-weather-events"
        latestEventDate={null}
      />
    );
    const buttons = screen.getAllByRole('button', { name: /View full disclaimer/i });
    await userEvent.click(buttons[0]);
    expect(screen.getAllByText(/Texas Disaster Information System/i).length).toBeGreaterThan(0);
  });

  it('shows LastUpdated for active-weather-events tab', () => {
    render(
      <DisclaimerFooter
        onMapRefresh={vi.fn()}
        activeTab="active-weather-events"
        latestEventDate={null}
        refreshCadence="Every 30 minutes"
      />
    );
    expect(screen.getAllByText(/Refresh cadence/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Every 30 minutes/i).length).toBeGreaterThan(0);
  });

  it('shows HMED precipitation refresh cadence', () => {
    render(
      <DisclaimerFooter
        onMapRefresh={vi.fn()}
        activeTab="hmed"
        refreshCadence="Every 6 hours"
      />
    );
    expect(screen.getAllByText(/Every 6 hours/i).length).toBeGreaterThan(0);
  });

  it('shows HMED Flood Hub refresh cadence', () => {
    render(
      <DisclaimerFooter
        onMapRefresh={vi.fn()}
        activeTab="hmed"
        refreshCadence="Every 1 hour"
      />
    );
    expect(screen.getAllByText(/Every 1 hour/i).length).toBeGreaterThan(0);
  });

  it('shows Impact Forecast refresh cadence', () => {
    render(
      <DisclaimerFooter
        onMapRefresh={vi.fn()}
        activeTab="lts-flash-flood"
        refreshCadence="Every 6 hours"
      />
    );
    expect(screen.getAllByText(/Every 6 hours/i).length).toBeGreaterThan(0);
  });

  it('shows Infrastructure Status refresh cadence', () => {
    render(
      <DisclaimerFooter
        onMapRefresh={vi.fn()}
        activeTab="osa"
        refreshCadence="Every 1 hour"
      />
    );
    expect(screen.getAllByText(/Every 1 hour/i).length).toBeGreaterThan(0);
  });

  it('hides LastUpdated when refreshCadence is not provided', () => {
    render(
      <DisclaimerFooter
        onMapRefresh={vi.fn()}
        activeTab="ai-assistant"
      />
    );
    expect(screen.queryByText(/Refresh cadence/i)).not.toBeInTheDocument();
  });

  describe('full disclaimer modal', () => {
    const BACKDROP_LABEL = 'Close disclaimer';

    const getBackdrop = () => screen.getByRole('button', { name: BACKDROP_LABEL });

    /** Opens the modal via one of the two responsive trigger buttons. */
    const openModal = async (triggerIndex = 0) => {
      render(<DisclaimerFooter onMapRefresh={vi.fn()} activeTab="hmed" />);
      const triggers = screen.getAllByRole('button', { name: /View full disclaimer/i });
      await userEvent.click(triggers[triggerIndex]);
      return screen.getByRole('dialog');
    };

    it('opens from the small-screen trigger', async () => {
      await openModal(1);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('renders every disclaimer paragraph', async () => {
      const dialog = await openModal();
      expect(dialog.querySelectorAll('p.text-sm').length).toBeGreaterThan(0);
    });

    it('closes on the header close icon', async () => {
      await openModal();
      // Header icon button and footer button share the "Close" name; header comes first.
      await userEvent.click(screen.getAllByRole('button', { name: 'Close' })[0]);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('closes on the footer Close button', async () => {
      await openModal();
      await userEvent.click(screen.getAllByRole('button', { name: 'Close' })[1]);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('closes on a backdrop click', async () => {
      await openModal();
      await userEvent.click(getBackdrop());
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('closes on Enter and Space from the focused backdrop', async () => {
      await openModal();

      fireEvent.keyDown(getBackdrop(), { key: 'Enter' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      await userEvent.click(screen.getAllByRole('button', { name: /View full disclaimer/i })[0]);
      fireEvent.keyDown(getBackdrop(), { key: ' ' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('ignores other keys on the backdrop', async () => {
      await openModal();
      fireEvent.keyDown(getBackdrop(), { key: 'a' });
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('stays open on clicks and keystrokes inside the dialog', async () => {
      const dialog = await openModal();

      await userEvent.click(dialog);
      fireEvent.keyDown(dialog, { key: 'Enter' });

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });
});
