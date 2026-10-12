/**
 * @fileoverview Unit tests for EventSelector component
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EventSelector from '@/components/EventSelector';

const SELECT_EVENTS_LABEL = 'Select events';

describe('EventSelector', () => {
  it('renders trigger with placeholder when no events selected', () => {
    render(<EventSelector selectedEvents={[]} setSelectedEvents={() => {}} />);
    expect(screen.getByText(SELECT_EVENTS_LABEL)).toBeInTheDocument();
  });

  it('renders count when one event selected', () => {
    render(<EventSelector selectedEvents={['Wildfire']} setSelectedEvents={() => {}} />);
    expect(screen.getByText('1 event selected')).toBeInTheDocument();
  });

  it('renders plural count when multiple events selected', () => {
    render(
      <EventSelector selectedEvents={['Wildfire', 'Rainfall']} setSelectedEvents={() => {}} />
    );
    expect(screen.getByText('2 events selected')).toBeInTheDocument();
  });

  it('opens dropdown and shows event options when clicked', async () => {
    const user = userEvent.setup();
    render(<EventSelector selectedEvents={[]} setSelectedEvents={() => {}} />);
    await user.click(screen.getByText(SELECT_EVENTS_LABEL));
    expect(screen.getByText('Select Events')).toBeInTheDocument();
    expect(screen.getByText('Wildfire')).toBeInTheDocument();
    expect(screen.getByText('Rainfall')).toBeInTheDocument();
    expect(screen.getByText('High wind')).toBeInTheDocument();
  });

  it('calls setSelectedEvents when checkbox is toggled', async () => {
    const user = userEvent.setup();
    const setSelectedEvents = vi.fn();
    render(<EventSelector selectedEvents={[]} setSelectedEvents={setSelectedEvents} />);
    await user.click(screen.getByText(SELECT_EVENTS_LABEL));
    await user.click(screen.getByText('Wildfire'));
    expect(setSelectedEvents).toHaveBeenCalled();
  });

  it('removes event when unchecking', async () => {
    const user = userEvent.setup();
    const setSelectedEvents = vi.fn();
    render(<EventSelector selectedEvents={['Wildfire']} setSelectedEvents={setSelectedEvents} />);
    await user.click(screen.getByText('1 event selected'));
    await user.click(screen.getByText('Wildfire'));
    expect(setSelectedEvents).toHaveBeenCalled();
  });
});
