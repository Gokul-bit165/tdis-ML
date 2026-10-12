/**
 * @fileoverview Unit tests for EventCards component
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EventCards from '@/components/EventCards';

describe('EventCards', () => {
  it('renders loading skeletons when isEventCountsLoading is true', () => {
    render(<EventCards eventCounts={[]} isEventCountsLoading />);
    const skeletons = document.querySelectorAll(
      '[class*="rounded-full"], [class*="rounded-\\[12px\\]"]'
    );
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it('renders empty state when not loading and eventCounts is empty', () => {
    render(<EventCards eventCounts={[]} isEventCountsLoading={false} />);
    expect(screen.getByText(/No events data available/i)).toBeInTheDocument();
  });

  it('renders event cards when eventCounts has data', () => {
    const eventCounts = [
      { type: 'fire', count: 5 },
      { type: 'flood', count: 3 },
    ];
    render(<EventCards eventCounts={eventCounts} isEventCountsLoading={false} />);
    expect(screen.getByText('Fire')).toBeInTheDocument();
    expect(screen.getByText('Flood')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders event type with capitalized first letter', () => {
    render(
      <EventCards eventCounts={[{ type: 'wildfire', count: 1 }]} isEventCountsLoading={false} />
    );
    expect(screen.getByText('Wildfire')).toBeInTheDocument();
  });
});
