/**
 * @fileoverview Unit tests for ScrollToTop component
 * Feature: layout
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ScrollToTop from '@/components/ScrollToTop';

describe('ScrollToTop', () => {
  beforeEach(() => {
    window.scrollTo = vi.fn();
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true });
  });

  it('does not show button when scroll is at top', () => {
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true });
    render(<ScrollToTop />);
    expect(screen.queryByRole('button', { name: /Scroll to top/i })).not.toBeInTheDocument();
  });

  it('shows button when scroll is past 300px', async () => {
    Object.defineProperty(window, 'scrollY', { value: 400, writable: true });
    render(<ScrollToTop />);
    await act(async () => {
      window.dispatchEvent(new Event('scroll'));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Scroll to top/i })).toBeInTheDocument();
    });
  });

  it('calls scrollTo when button is clicked', async () => {
    Object.defineProperty(window, 'scrollY', { value: 400, writable: true });
    render(<ScrollToTop />);
    await act(async () => {
      window.dispatchEvent(new Event('scroll'));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Scroll to top/i })).toBeInTheDocument();
    });
    const button = screen.getByRole('button', { name: /Scroll to top/i });
    await userEvent.click(button);
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });
});
