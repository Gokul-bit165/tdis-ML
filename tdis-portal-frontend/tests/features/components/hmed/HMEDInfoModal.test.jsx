/**
 * @fileoverview Unit tests for hmed/HMEDInfoModal
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HMEDInfoModal } from '@/components/hmed/HMEDInfoModal';
import { LAYER_CONFIG } from '@/config/hmedLayerConfig';

vi.mock('framer-motion', () => ({
  motion: { div: ({ children, ...p }) => React.createElement('div', p, children) },
  AnimatePresence: ({ children }) => children,
}));

describe('HMEDInfoModal', () => {
  const currentLayer = LAYER_CONFIG.precipitation;

  it('renders nothing when show is false', () => {
    render(<HMEDInfoModal show={false} onClose={() => {}} currentLayer={currentLayer} />);
    expect(screen.queryByRole('heading', { name: /Precipitation HSI Information/i })).toBeNull();
  });

  it('renders modal content when show is true', () => {
    render(<HMEDInfoModal show={true} onClose={() => {}} currentLayer={currentLayer} />);
    const dialog = screen.getByRole('dialog');
    expect(
      screen.getByRole('heading', { name: /Precipitation HSI Information/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Hazard Severity Outlook/i)).toBeInTheDocument();
    expect(screen.getByText(/About HSI Precipitation/i)).toBeInTheDocument();
    expect(screen.getByText(/How to read/i)).toBeInTheDocument();
    expect(screen.getByText(/What you'll see/i)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Got it/i })).toBeInTheDocument();
  });

  it('calls onClose when Close button is clicked', async () => {
    const onClose = vi.fn();
    render(<HMEDInfoModal show={true} onClose={onClose} currentLayer={currentLayer} />);
    const closeBtn = screen.getByLabelText('Close');
    await userEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Got it button is clicked', async () => {
    const onClose = vi.fn();
    render(<HMEDInfoModal show={true} onClose={onClose} currentLayer={currentLayer} />);
    await userEvent.click(screen.getByRole('button', { name: /Got it/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('displays currentLayer description', () => {
    render(<HMEDInfoModal show={true} onClose={() => {}} currentLayer={currentLayer} />);
    expect(
      screen.getByText(/Precipitation HSI provides short term, predictive metrics/i)
    ).toBeInTheDocument();
  });

  it('displays Notes & caveats section', () => {
    render(<HMEDInfoModal show={true} onClose={() => {}} currentLayer={currentLayer} />);
    expect(screen.getByText(/Notes & caveats/i)).toBeInTheDocument();
  });
});
