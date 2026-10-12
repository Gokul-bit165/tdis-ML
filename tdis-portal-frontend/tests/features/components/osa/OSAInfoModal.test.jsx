/**
 * @fileoverview Unit tests for osa/OSAInfoModal
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OSAInfoModal } from '@/components/osa/OSAInfoModal';

describe('OSAInfoModal', () => {
  it('renders nothing when open is false', () => {
    const { container } = render(<OSAInfoModal open={false} onClose={() => {}} />);
    expect(container.querySelector('.fixed.inset-0')).toBeNull();
  });

  it('renders modal content when open is true', () => {
    render(<OSAInfoModal open={true} onClose={() => {}} />);
    const dialog = screen.getByRole('dialog');
    expect(screen.getByRole('heading', { name: /Power Outage Information/i })).toBeInTheDocument();
    expect(screen.getByText(/Infrastructure Status/i)).toBeInTheDocument();
    expect(screen.getByText(/Available Layers/i)).toBeInTheDocument();
    expect(screen.getByText(/Customers Out Severity Levels/i)).toBeInTheDocument();
    expect(screen.getByText(/What you'll see/i)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Got it/i })).toBeInTheDocument();
  });

  it('calls onClose when Close button is clicked', async () => {
    const onClose = vi.fn();
    render(<OSAInfoModal open={true} onClose={onClose} />);
    const closeBtn = screen.getByLabelText('Close');
    await userEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Got it button is clicked', async () => {
    const onClose = vi.fn();
    render(<OSAInfoModal open={true} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: /Got it/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<OSAInfoModal open={true} onClose={onClose} />);
    const backdrop = document.querySelector('[class*="inset-0"][class*="bg-black"]');
    expect(backdrop).toBeInTheDocument();
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it('shows Road Weather Hazard Alerts content when selectedLayer is road_closures', () => {
    render(<OSAInfoModal open={true} onClose={() => {}} selectedLayer="road_closures" />);
    expect(
      screen.getByRole('heading', { name: /Road Weather Hazard Alerts Information/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Crowdsourced Situational Awareness \(Waze Alerts\)/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Waze Road Hazard Layer/i)).toBeInTheDocument();
    expect(screen.getByText(/Reported Hazard Types/i)).toBeInTheDocument();
    expect(screen.getByText(/How to Interpret This Layer/i)).toBeInTheDocument();
    expect(screen.getByText(/Flooding \/ standing water/i)).toBeInTheDocument();
  });
});
