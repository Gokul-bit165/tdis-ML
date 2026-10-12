/**
 * @fileoverview Unit tests for Calendar UI component
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Calendar } from '@/components/ui/calendar';

const DAY_PICKER_TEST_ID = 'day-picker';

vi.mock('react-day-picker', () => ({
  DayPicker: ({ className, showOutsideDays, classNames: _classNames, components, ...rest }) => (
    <div data-testid={DAY_PICKER_TEST_ID} data-show-outside-days={showOutsideDays} className={className}>
      <span data-testid="day-picker-props">{JSON.stringify({ mode: rest.mode })}</span>
      {components?.IconLeft && <components.IconLeft data-testid="icon-left" />}
      {components?.IconRight && <components.IconRight data-testid="icon-right" />}
    </div>
  ),
}));

describe('Calendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders DayPicker with default showOutsideDays', () => {
    render(<Calendar />);
    expect(screen.getByTestId(DAY_PICKER_TEST_ID)).toBeInTheDocument();
    expect(screen.getByTestId(DAY_PICKER_TEST_ID)).toHaveAttribute('data-show-outside-days', 'true');
  });

  it('passes showOutsideDays false when provided', () => {
    render(<Calendar showOutsideDays={false} />);
    expect(screen.getByTestId(DAY_PICKER_TEST_ID)).toHaveAttribute('data-show-outside-days', 'false');
  });

  it('applies custom className', () => {
    render(<Calendar className="custom-calendar" />);
    const picker = screen.getByTestId(DAY_PICKER_TEST_ID);
    expect(picker.className).toMatch(/custom-calendar/);
  });

  it('renders with mode range for range styling', () => {
    render(<Calendar mode="range" />);
    expect(screen.getByTestId('day-picker-props')).toHaveTextContent('range');
  });

  it('renders icon components', () => {
    render(<Calendar />);
    expect(screen.getByTestId('icon-left')).toBeInTheDocument();
    expect(screen.getByTestId('icon-right')).toBeInTheDocument();
  });
});
