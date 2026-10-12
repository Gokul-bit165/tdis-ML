/**
 * @fileoverview Unit tests for LastUpdated component
 * Feature: layout
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LastUpdated from '@/components/LastUpdated';

describe('LastUpdated', () => {
  it('renders refresh cadence text', () => {
    render(<LastUpdated />);
    expect(screen.getByText(/Refresh cadence/i)).toBeInTheDocument();
    expect(screen.getByText(/Every 30 minutes/i)).toBeInTheDocument();
  });

  it('renders a custom cadence label', () => {
    render(<LastUpdated cadence="Every 6 hours" />);
    expect(screen.getByText(/Every 6 hours/i)).toBeInTheDocument();
  });
});
