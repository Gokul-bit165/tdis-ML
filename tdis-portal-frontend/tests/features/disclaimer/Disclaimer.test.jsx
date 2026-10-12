/**
 * @fileoverview Unit tests for Disclaimer component
 * Feature: disclaimer
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Disclaimer from '@/components/Disclaimer';

describe('Disclaimer', () => {
  it('renders disclaimer overlay with welcome title', () => {
    render(<Disclaimer onAccept={() => {}} />);
    expect(
      screen.getByRole('heading', { level: 2, name: /Texas Disaster Information System/i })
    ).toBeInTheDocument();
  });

  it('renders accept button', () => {
    render(<Disclaimer onAccept={() => {}} />);
    expect(screen.getByRole('button', { name: /I ACCEPT/i })).toBeInTheDocument();
  });

  it('calls onAccept when button is clicked', async () => {
    const onAccept = vi.fn();
    render(<Disclaimer onAccept={onAccept} />);
    await userEvent.click(screen.getByRole('button', { name: /I ACCEPT/i }));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it('renders without onAccept (optional)', () => {
    render(<Disclaimer />);
    expect(screen.getByRole('button', { name: /I ACCEPT/i })).toBeInTheDocument();
  });

  it('does not throw when clicking accept without onAccept', async () => {
    render(<Disclaimer />);
    await userEvent.click(screen.getByRole('button', { name: /I ACCEPT/i }));
    expect(true).toBe(true);
  });
});
