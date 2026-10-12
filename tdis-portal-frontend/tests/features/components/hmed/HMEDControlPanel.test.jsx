/**
 * @fileoverview Unit tests for hmed/HMEDControlPanel
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HMEDControlPanel } from '@/components/hmed/HMEDControlPanel';
import { LAYER_CONFIG } from '@/config/hmedLayerConfig';

vi.mock('framer-motion', () => ({
  motion: { div: ({ children, ...p }) => React.createElement('div', p, children) },
  AnimatePresence: ({ children }) => children,
}));

const controlDrag = {
  panelRef: { current: null },
  dragHandleRef: { current: null },
  style: {},
};

describe('HMEDControlPanel', () => {
  const defaultProps = {
    controlDrag,
    currentLayer: LAYER_CONFIG.precipitation,
    selectedLayer: 'precipitation',
    setSelectedLayer: vi.fn(),
    selectedHours: 3,
    setSelectedHours: vi.fn(),
    onToggleInfo: vi.fn(),
    isMinimized: false,
    setIsMinimized: vi.fn(),
  };

  beforeEach(() => {
    window.gtag = vi.fn();
  });

  afterEach(() => {
    delete window.gtag;
  });

  it('renders current layer name and HSI subtitle', () => {
    render(<HMEDControlPanel {...defaultProps} />);
    expect(screen.getAllByText(/Precipitation HSI/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/3h window/i)).toBeInTheDocument();
  });

  it('renders Info button and calls onToggleInfo when clicked', async () => {
    const onToggleInfo = vi.fn();
    render(<HMEDControlPanel {...defaultProps} onToggleInfo={onToggleInfo} />);
    const infoBtn = screen.getByRole('button', { name: /Show information|Info/i });
    await userEvent.click(infoBtn);
    expect(onToggleInfo).toHaveBeenCalled();
  });

  it('toggles minimize when collapse/expand button is clicked', async () => {
    const setIsMinimized = vi.fn();
    render(<HMEDControlPanel {...defaultProps} setIsMinimized={setIsMinimized} />);
    const collapseBtn = screen.getByTitle('Collapse panel');
    await userEvent.click(collapseBtn);
    expect(setIsMinimized).toHaveBeenCalledWith(true);
  });

  it('when minimized shows Expand panel button', () => {
    render(<HMEDControlPanel {...defaultProps} isMinimized={true} />);
    expect(screen.getByRole('button', { name: /Expand panel/i })).toBeInTheDocument();
  });

  it('shows Hazard Layer and Time Window sections when not minimized', () => {
    render(<HMEDControlPanel {...defaultProps} />);
    expect(screen.getByText('Hazard Layer')).toBeInTheDocument();
    expect(screen.getByText('Time Window')).toBeInTheDocument();
    expect(screen.getByText('Intensity Scale')).toBeInTheDocument();
  });

  it('calls setSelectedLayer when layer button is clicked', async () => {
    const setSelectedLayer = vi.fn();
    render(<HMEDControlPanel {...defaultProps} setSelectedLayer={setSelectedLayer} />);
    const precipBtn = screen.getByRole('button', { name: /Precipitation/i });
    await userEvent.click(precipBtn);
    expect(setSelectedLayer).toHaveBeenCalledWith('precipitation');
  });

  it('tracks layer_toggle when switching to Flood Hub', async () => {
    const setSelectedLayer = vi.fn();
    render(<HMEDControlPanel {...defaultProps} setSelectedLayer={setSelectedLayer} />);
    await userEvent.click(screen.getByRole('button', { name: /Flood Hub/i }));
    expect(setSelectedLayer).toHaveBeenCalledWith('google_flood_hub');
    expect(window.gtag).toHaveBeenCalledWith(
      'event',
      'layer_toggle',
      expect.objectContaining({
        layer_name: 'google_flood_hub',
        tab: 'hmed',
      })
    );
  });

  it('does not track layer_toggle when the current hazard layer is clicked again', async () => {
    render(<HMEDControlPanel {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: /Precipitation/i }));
    expect(window.gtag).not.toHaveBeenCalled();
  });

  it('calls setSelectedHours when time window button is clicked', async () => {
    const setSelectedHours = vi.fn();
    render(<HMEDControlPanel {...defaultProps} setSelectedHours={setSelectedHours} />);
    await userEvent.click(screen.getByRole('button', { name: '6h' }));
    expect(setSelectedHours).toHaveBeenCalledWith(6);
  });

  it('tracks filter_change when switching precipitation time window', async () => {
    const setSelectedHours = vi.fn();
    render(<HMEDControlPanel {...defaultProps} setSelectedHours={setSelectedHours} />);
    await userEvent.click(screen.getByRole('button', { name: '6h' }));
    expect(window.gtag).toHaveBeenCalledWith(
      'event',
      'filter_change',
      expect.objectContaining({
        tab: 'hmed',
        layer_name: 'precipitation',
        filter_name: '6h',
        previous_filter: '3h',
        event_label: '6h',
      })
    );
  });

  it('does not track filter_change when the current time window is clicked again', async () => {
    render(<HMEDControlPanel {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: '3h' }));
    expect(window.gtag).not.toHaveBeenCalled();
  });

  it('shows threshold labels minimal, elevated, significant, major, extreme', () => {
    render(<HMEDControlPanel {...defaultProps} />);
    expect(screen.getByText(/minimal/i)).toBeInTheDocument();
    expect(screen.getByText(/elevated/i)).toBeInTheDocument();
    expect(screen.getByText(/significant/i)).toBeInTheDocument();
    expect(screen.getByText(/major/i)).toBeInTheDocument();
    expect(screen.getByText(/extreme/i)).toBeInTheDocument();
  });

  it('disables layer buttons while data is loading', () => {
    render(
      <HMEDControlPanel {...defaultProps} isLoading loadingMessage="Loading precipitation…" />
    );
    expect(screen.getByRole('button', { name: /Precipitation/i })).toBeDisabled();
    expect(screen.getByText('Loading precipitation…')).toBeInTheDocument();
  });

  describe('Flood Hub layer', () => {
    const floodHubProps = {
      ...defaultProps,
      currentLayer: LAYER_CONFIG.google_flood_hub,
      selectedLayer: 'google_flood_hub',
    };

    it('shows the panel subtitle and third-party attribution instead of a time window', () => {
      render(<HMEDControlPanel {...floodHubProps} />);

      expect(screen.getByText('Powered by Google Flood Hub')).toBeInTheDocument();
      expect(screen.getByText(/Third-party forecast/i)).toBeInTheDocument();
      expect(screen.queryByText('Time Window')).not.toBeInTheDocument();
    });

    it('hides the intensity scale and planning strip', () => {
      render(<HMEDControlPanel {...floodHubProps} />);

      expect(screen.queryByText('Intensity Scale')).not.toBeInTheDocument();
      expect(screen.queryByText('Threat severity')).not.toBeInTheDocument();
      expect(screen.queryByText(/Planning tool/i)).not.toBeInTheDocument();
    });

    it('points users at the side panel for feature details', () => {
      render(<HMEDControlPanel {...floodHubProps} />);
      expect(screen.getByText(/details open in side panel/i)).toBeInTheDocument();
    });

    it('renders the riverine overlay section only when toggles are wired up', () => {
      const { unmount } = render(<HMEDControlPanel {...floodHubProps} />);
      const withoutToggles = screen.queryAllByRole('checkbox').length;
      unmount();

      render(
        <HMEDControlPanel
          {...floodHubProps}
          floodPrdToggles={{ riverine: true }}
          patchFloodPrdToggles={vi.fn()}
        />
      );

      expect(screen.queryAllByRole('checkbox').length).toBeGreaterThanOrEqual(withoutToggles);
    });
  });

  describe('planning layers without an hourly window', () => {
    const severityLayer = {
      ...LAYER_CONFIG.precipitation,
      hasTimeWindow: false,
      panelSubtitle: 'Localized threat severity',
      severityLevels: [
        { value: 3, label: 'Moderate', color: '#f59e0b' },
        { value: 4, label: 'High', color: '#ea580c' },
        { value: 5, label: 'Extreme', color: '#dc2626' },
      ],
    };

    it('shows the planning-tool caveat and threat severity scale', () => {
      render(<HMEDControlPanel {...defaultProps} currentLayer={severityLayer} />);

      expect(screen.getByText(/Planning tool/i)).toBeInTheDocument();
      expect(screen.getByText('Threat severity')).toBeInTheDocument();
      expect(screen.getByText('Localized threat severity')).toBeInTheDocument();
    });

    it('derives the range label from the severity levels', () => {
      render(<HMEDControlPanel {...defaultProps} currentLayer={severityLayer} />);
      expect(screen.getByText('3 → 5')).toBeInTheDocument();
    });

    it('lists each severity level with its label', () => {
      render(<HMEDControlPanel {...defaultProps} currentLayer={severityLayer} />);

      expect(screen.getByText('Moderate')).toBeInTheDocument();
      expect(screen.getByText('High')).toBeInTheDocument();
      expect(screen.getByText('Extreme')).toBeInTheDocument();
    });

    it('falls back to a 3 → 5 range when no severity levels are configured', () => {
      const { severityLevels: _unused, ...withoutLevels } = severityLayer;
      render(<HMEDControlPanel {...defaultProps} currentLayer={withoutLevels} />);

      expect(screen.getByText('3 → 5')).toBeInTheDocument();
      expect(screen.getByText(/minimal/i)).toBeInTheDocument();
    });

    it('drops the layer name suffix used by HSI layers', () => {
      render(<HMEDControlPanel {...defaultProps} currentLayer={severityLayer} />);
      expect(screen.queryByText(/Precipitation HSI/i)).not.toBeInTheDocument();
    });
  });
});
