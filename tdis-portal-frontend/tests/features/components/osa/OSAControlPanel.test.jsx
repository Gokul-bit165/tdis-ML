/**
 * @fileoverview Unit tests for osa/OSAControlPanel
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OSAControlPanel } from '@/components/osa/OSAControlPanel';
import { LAYER_CONFIG } from '@/config/osaLayerConfig';

const controlDrag = {
  panelRef: { current: null },
  dragHandleRef: { current: null },
  style: {},
};

describe('OSAControlPanel', () => {
  const defaultProps = {
    controlDrag,
    currentLayer: LAYER_CONFIG.power_outage,
    selectedLayer: 'power_outage',
    setSelectedLayer: vi.fn(),
    setViewMode: vi.fn(),
    onShowInfo: vi.fn(),
    isMinimized: false,
    setIsMinimized: vi.fn(),
  };

  it('renders current layer name and OSA subtitle', () => {
    render(<OSAControlPanel {...defaultProps} />);
    expect(screen.getAllByText('Power Outages').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Infrastructure Status')).toBeInTheDocument();
  });

  it('renders Info button and calls onShowInfo when clicked', async () => {
    const onShowInfo = vi.fn();
    render(<OSAControlPanel {...defaultProps} onShowInfo={onShowInfo} />);
    const infoBtn = screen.getByRole('button', { name: /Info|Show information/i });
    await userEvent.click(infoBtn);
    expect(onShowInfo).toHaveBeenCalledWith(true);
  });

  it('toggles minimize when collapse/expand button is clicked', async () => {
    const setIsMinimized = vi.fn();
    render(<OSAControlPanel {...defaultProps} setIsMinimized={setIsMinimized} />);
    const collapseBtn = screen.getByTitle('Collapse panel');
    await userEvent.click(collapseBtn);
    expect(setIsMinimized).toHaveBeenCalledWith(true);
  });

  it('when minimized shows Expand panel button', () => {
    render(<OSAControlPanel {...defaultProps} isMinimized={true} />);
    expect(screen.getByRole('button', { name: /Expand panel/i })).toBeInTheDocument();
  });

  it('shows LayerSelector and OutageSeverityLegend for power_outage', () => {
    render(<OSAControlPanel {...defaultProps} />);
    expect(screen.getByText('Data Layer')).toBeInTheDocument();
    expect(screen.getByText('Customers Out')).toBeInTheDocument();
    expect(screen.getByText(/Click areas for outage details/i)).toBeInTheDocument();
  });

  it('shows AlertTypesLegend when selectedLayer is road_closures', () => {
    render(
      <OSAControlPanel
        {...defaultProps}
        currentLayer={LAYER_CONFIG.road_closures}
        selectedLayer="road_closures"
      />
    );
    expect(screen.getByText('Alert Types')).toBeInTheDocument();
    expect(screen.getByText(/Click areas for alert details/i)).toBeInTheDocument();
  });

  it('shows header KPI for total alerts when selectedLayer is road_closures', () => {
    render(
      <OSAControlPanel
        {...defaultProps}
        currentLayer={LAYER_CONFIG.road_closures}
        selectedLayer="road_closures"
      />
    );
    expect(screen.getByText(/Active Alerts \(Statewide\)/)).toBeInTheDocument();
    expect(screen.getByRole('status', { name: /Statewide active alerts/i })).toBeInTheDocument();
  });
});
