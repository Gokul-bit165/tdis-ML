/**
 * @fileoverview Unit tests for TimeLegendCard component
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TimeLegendCard from '@/components/TimeLegendCard';

describe('TimeLegendCard', () => {
  it('renders Filter event types label', () => {
    render(
      <TimeLegendCard
        selectedEvents={[]}
        setSelectedEvents={() => {}}
        loading={false}
        onMapRefresh={() => {}}
      />
    );
    expect(screen.getByText(/Filter event types/i)).toBeInTheDocument();
  });

  it('renders LastUpdated section', () => {
    render(
      <TimeLegendCard
        selectedEvents={[]}
        setSelectedEvents={() => {}}
        loading={false}
        onMapRefresh={() => {}}
      />
    );
    expect(screen.getByText(/Refresh cadence/i)).toBeInTheDocument();
  });

  it('renders event type buttons when not loading', () => {
    render(
      <TimeLegendCard
        selectedEvents={[]}
        setSelectedEvents={() => {}}
        loading={false}
        onMapRefresh={() => {}}
      />
    );
    expect(screen.getByText('Wildfire')).toBeInTheDocument();
    expect(screen.getByText('Rainfall')).toBeInTheDocument();
    expect(screen.getByText('High wind')).toBeInTheDocument();
  });

  it('renders skeletons when loading', () => {
    render(
      <TimeLegendCard
        selectedEvents={[]}
        setSelectedEvents={() => {}}
        loading
        onMapRefresh={() => {}}
      />
    );
    const skeletons = document.querySelectorAll('[class*="animate-pulse"], [class*="rounded"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('calls setSelectedEvents when event button is clicked', async () => {
    const user = userEvent.setup();
    const setSelectedEvents = vi.fn();
    render(
      <TimeLegendCard
        selectedEvents={[]}
        setSelectedEvents={setSelectedEvents}
        loading={false}
        onMapRefresh={() => {}}
      />
    );
    await user.click(screen.getByText('Wildfire'));
    expect(setSelectedEvents).toHaveBeenCalled();
  });

  it('selected event has aria-pressed true', () => {
    render(
      <TimeLegendCard
        selectedEvents={['Wildfire']}
        setSelectedEvents={() => {}}
        loading={false}
        onMapRefresh={() => {}}
      />
    );
    const wildfireButton = screen.getByRole('button', { name: /Wildfire/i });
    expect(wildfireButton).toHaveAttribute('aria-pressed', 'true');
  });
});
