/**
 * @fileoverview Unit tests for Footer component
 * Feature: layout
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Footer from '@/components/Footer';

const mockTrackOutboundClick = vi.fn();
vi.mock('@/utils/googleAnalytics.js', () => ({
  trackOutboundClick: (...args) => mockTrackOutboundClick(...args),
}));

describe('Footer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders copyright text', () => {
    render(<Footer />);
    expect(screen.getByText(/TDIS © All rights reserved/i)).toBeInTheDocument();
  });

  it('renders GLO and TAMU logo links with safe outbound attributes', () => {
    render(<Footer />);
    const glo = screen.getByRole('link', { name: /Texas General Land Office official seal/i });
    const tamu = screen.getByRole('link', { name: /TAMU Logo/i });

    expect(glo).toHaveAttribute('href', 'https://www.glo.texas.gov/');
    expect(tamu).toHaveAttribute('href', 'https://www.tamu.edu/');
    [glo, tamu].forEach((link) => {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
    expect(screen.getByAltText(/Texas General Land Office official seal/i)).toHaveAttribute(
      'src',
      '/glowhite.png'
    );
    expect(screen.getByAltText('TAMU Logo')).toHaveAttribute('src', '/tamulogo-white.png');
  });

  it('tracks outbound clicks for GLO and TAMU links', async () => {
    const user = userEvent.setup();
    render(<Footer />);

    await user.click(screen.getByRole('link', { name: /Texas General Land Office official seal/i }));
    expect(mockTrackOutboundClick).toHaveBeenCalledWith('https://www.glo.texas.gov/');

    await user.click(screen.getByRole('link', { name: /TAMU Logo/i }));
    expect(mockTrackOutboundClick).toHaveBeenCalledWith('https://www.tamu.edu/');
    expect(mockTrackOutboundClick).toHaveBeenCalledTimes(2);
  });
});
