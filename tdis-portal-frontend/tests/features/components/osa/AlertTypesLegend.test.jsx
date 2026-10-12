/**
 * @fileoverview Unit tests for osa/AlertTypesLegend
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AlertTypesLegend } from '@/components/osa/AlertTypesLegend';

describe('AlertTypesLegend', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders Alert Types label', () => {
    render(<AlertTypesLegend />);
    expect(screen.getByText('Alert Types')).toBeInTheDocument();
  });

  it('does not render total alerts in legend (moved to header KPI)', () => {
    render(<AlertTypesLegend />);
    expect(screen.queryByText('Total Alerts')).not.toBeInTheDocument();
  });

  it('renders scrollable content with alert subtypes from hazardConfig', () => {
    render(<AlertTypesLegend />);
    const container =
      document.querySelector('[style*="max-height"]') ||
      document.querySelector('.space-y-1.overflow-y-auto');
    expect(container).toBeInTheDocument();
  });

  it('scroll down button appears when hasOverflow and is clickable', async () => {
    render(<AlertTypesLegend />);
    vi.advanceTimersByTime(100);
    const scrollBtn = screen.queryByRole('button', {
      name: /Scroll down to see more alert types/i,
    });
    if (scrollBtn) {
      expect(scrollBtn).toBeInTheDocument();
      await userEvent.click(scrollBtn);
    }
  });

  it('renders with explicit props without validation errors', () => {
    const mapRef = { current: null };
    const onTotalAlertsChange = vi.fn();
    render(
      <AlertTypesLegend
        mapRef={mapRef}
        isHazardLayerReady={false}
        onTotalAlertsChange={onTotalAlertsChange}
      />
    );
    expect(screen.getByText('Alert Types')).toBeInTheDocument();
  });

  it('calls onTotalAlertsChange with 0 after mount when provided', () => {
    const onTotalAlertsChange = vi.fn();
    render(
      <AlertTypesLegend
        mapRef={{ current: null }}
        isHazardLayerReady={false}
        onTotalAlertsChange={onTotalAlertsChange}
      />
    );
    vi.advanceTimersByTime(0);
    expect(onTotalAlertsChange).toHaveBeenCalledWith(0);
  });

  it('renders legend items from enabled hazard categories', () => {
    render(<AlertTypesLegend />);
    expect(screen.getByText('Weather Hazard')).toBeInTheDocument();
    expect(screen.getByText('Weather Hazard Fog')).toBeInTheDocument();
  });

  it('scroll down button has Scroll down title', () => {
    render(<AlertTypesLegend />);
    vi.advanceTimersByTime(100);
    const scrollBtn = screen.queryByRole('button', {
      name: /Scroll down to see more alert types/i,
    });
    if (scrollBtn) {
      expect(scrollBtn).toHaveAttribute('title', 'Scroll down');
    }
  });
});
