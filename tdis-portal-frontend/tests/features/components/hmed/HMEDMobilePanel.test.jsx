/**
 * @fileoverview Unit tests for hmed/HMEDMobilePanel
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HMEDMobilePanel } from '@/components/hmed/HMEDMobilePanel';
import { LAYER_CONFIG } from '@/config/hmedLayerConfig';

vi.mock('framer-motion', () => ({
  motion: {
    button: ({ children, ...p }) => React.createElement('button', p, children),
    div: ({ children, ...p }) => React.createElement('div', p, children),
  },
  AnimatePresence: ({ children }) => children,
}));

describe('HMEDMobilePanel', () => {
  const defaultProps = {
    isExpanded: false,
    onOpen: vi.fn(),
    onClose: vi.fn(),
    onShowInfo: vi.fn(),
    currentLayer: LAYER_CONFIG.precipitation,
    selectedLayer: 'precipitation',
    setSelectedLayer: vi.fn(),
    selectedHours: 3,
    setSelectedHours: vi.fn(),
  };

  beforeEach(() => {
    window.gtag = vi.fn();
  });

  afterEach(() => {
    delete window.gtag;
  });

  it('when not expanded shows Controls FAB button', () => {
    render(<HMEDMobilePanel {...defaultProps} />);
    expect(screen.getByRole('button', { name: /Controls/i })).toBeInTheDocument();
  });

  it('calls onOpen when Controls FAB is clicked', async () => {
    const onOpen = vi.fn();
    render(<HMEDMobilePanel {...defaultProps} onOpen={onOpen} />);
    const fab = screen.getByRole('button', { name: /Controls/i });
    await userEvent.click(fab);
    expect(onOpen).toHaveBeenCalled();
  });

  it('when expanded shows panel with Precipitation HSI title and Info', () => {
    render(<HMEDMobilePanel {...defaultProps} isExpanded={true} />);
    expect(screen.getByText(/Precipitation HSI/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Info/i })).toBeInTheDocument();
  });

  it('calls onClose when overlay is clicked in expanded panel', async () => {
    const onClose = vi.fn();
    render(<HMEDMobilePanel {...defaultProps} isExpanded={true} onClose={onClose} />);
    const overlay = document.querySelector('[class*="bg-black"][class*="inset-0"]');
    expect(overlay).toBeInTheDocument();
    await userEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onShowInfo when Info is clicked', async () => {
    const onShowInfo = vi.fn();
    render(<HMEDMobilePanel {...defaultProps} isExpanded={true} onShowInfo={onShowInfo} />);
    const infoBtn = screen.getByRole('button', { name: /Info/i });
    await userEvent.click(infoBtn);
    expect(onShowInfo).toHaveBeenCalledWith(true);
  });

  it('when expanded shows Hazard Layer and Time Window', () => {
    render(<HMEDMobilePanel {...defaultProps} isExpanded={true} />);
    expect(screen.getByText('Hazard Layer')).toBeInTheDocument();
    expect(screen.getByText('Time Window')).toBeInTheDocument();
    expect(screen.getByText('Intensity Scale')).toBeInTheDocument();
  });

  it('calls setSelectedHours when time window is clicked', async () => {
    const setSelectedHours = vi.fn();
    render(
      <HMEDMobilePanel {...defaultProps} isExpanded={true} setSelectedHours={setSelectedHours} />
    );
    await userEvent.click(screen.getByRole('button', { name: '12h' }));
    expect(setSelectedHours).toHaveBeenCalledWith(12);
  });

  it('tracks filter_change when switching precipitation time window', async () => {
    render(<HMEDMobilePanel {...defaultProps} isExpanded={true} />);
    await userEvent.click(screen.getByRole('button', { name: '12h' }));
    expect(window.gtag).toHaveBeenCalledWith(
      'event',
      'filter_change',
      expect.objectContaining({
        tab: 'hmed',
        layer_name: 'precipitation',
        filter_name: '12h',
        previous_filter: '3h',
        event_label: '12h',
      })
    );
  });

  it('does not track filter_change when the current time window is clicked again', async () => {
    render(<HMEDMobilePanel {...defaultProps} isExpanded={true} />);
    await userEvent.click(screen.getByRole('button', { name: '3h' }));
    expect(window.gtag).not.toHaveBeenCalled();
  });

  it('switches layers from the expanded panel and tracks layer_toggle', async () => {
    const setSelectedLayer = vi.fn();
    render(
      <HMEDMobilePanel {...defaultProps} isExpanded={true} setSelectedLayer={setSelectedLayer} />
    );

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
    const setSelectedLayer = vi.fn();
    render(
      <HMEDMobilePanel {...defaultProps} isExpanded={true} setSelectedLayer={setSelectedLayer} />
    );

    await userEvent.click(screen.getByRole('button', { name: /Precipitation/i }));

    expect(setSelectedLayer).toHaveBeenCalledWith('precipitation');
    expect(window.gtag).not.toHaveBeenCalled();
  });

  it('closes from the header X control', async () => {
    const onClose = vi.fn();
    render(<HMEDMobilePanel {...defaultProps} isExpanded={true} onClose={onClose} />);

    const closeButtons = screen.getAllByRole('button', { name: 'Close hazard controls' });
    expect(closeButtons.length).toBeGreaterThanOrEqual(2);
    await userEvent.click(closeButtons[closeButtons.length - 1]);

    expect(onClose).toHaveBeenCalled();
  });

  it('shows precipitation intensity ticks, thresholds, and the map-click hint', () => {
    render(<HMEDMobilePanel {...defaultProps} isExpanded={true} />);

    expect(screen.getByText('>0')).toBeInTheDocument();
    expect(screen.getByText('0.25')).toBeInTheDocument();
    expect(screen.getByText('2.0+')).toBeInTheDocument();
    expect(screen.getByText(/minimal/i)).toBeInTheDocument();
    expect(screen.getByText('Extreme')).toBeInTheDocument();
    expect(screen.getByText('Click areas for details')).toBeInTheDocument();
    expect(screen.getByText('Low → High')).toBeInTheDocument();
  });

  it('disables layer switching while data is loading', () => {
    render(
      <HMEDMobilePanel
        {...defaultProps}
        isExpanded={true}
        isLoading
        loadingMessage="Loading hexes…"
      />
    );

    expect(screen.getByRole('button', { name: /Flood Hub/i })).toBeDisabled();
    expect(screen.getByText('Loading hexes…')).toBeInTheDocument();
  });

  describe('Flood Hub layer', () => {
    const floodHubProps = {
      ...defaultProps,
      isExpanded: true,
      currentLayer: LAYER_CONFIG.google_flood_hub,
      selectedLayer: 'google_flood_hub',
    };

    it('replaces the time window with third-party attribution and overlay guidance', () => {
      render(<HMEDMobilePanel {...floodHubProps} />);

      expect(screen.queryByText('Time Window')).not.toBeInTheDocument();
      expect(screen.getByText(/Third-party forecast/i)).toBeInTheDocument();
      expect(screen.getByText('Significant events')).toBeInTheDocument();
    });

    it('hides the intensity scale and the planning caveat', () => {
      render(<HMEDMobilePanel {...floodHubProps} />);

      expect(screen.queryByText('Intensity Scale')).not.toBeInTheDocument();
      expect(screen.queryByText(/Planning tool/i)).not.toBeInTheDocument();
    });

    it('renders riverine toggles when they are wired up', async () => {
      const patchFloodPrdToggles = vi.fn();
      render(
        <HMEDMobilePanel
          {...floodHubProps}
          floodPrdToggles={{ gauges: false }}
          patchFloodPrdToggles={patchFloodPrdToggles}
        />
      );

      expect(screen.getByText('Riverine floods')).toBeInTheDocument();
      expect(screen.getByText('Floods (riverine)')).toBeInTheDocument();
      expect(screen.getByText(/Tap hexes, pins, or events/i)).toBeInTheDocument();
      expect(screen.getByText('Powered by Google Flood Hub')).toBeInTheDocument();
      expect(screen.queryByText('Precipitation HSI')).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('switch'));
      expect(patchFloodPrdToggles).toHaveBeenCalledWith({ gauges: true });
    });

    it('omits the riverine section when toggle handlers are incomplete', () => {
      const { unmount } = render(
        <HMEDMobilePanel {...floodHubProps} floodPrdToggles={{ gauges: true }} />
      );
      expect(screen.queryByText('Floods (riverine)')).not.toBeInTheDocument();
      unmount();

      render(
        <HMEDMobilePanel {...floodHubProps} patchFloodPrdToggles={vi.fn()} />
      );
      expect(screen.queryByText('Floods (riverine)')).not.toBeInTheDocument();
    });
  });

  describe('planning layers without an hourly window', () => {
    const severityLayer = {
      ...LAYER_CONFIG.precipitation,
      hasTimeWindow: false,
      panelSubtitle: 'Localized threat severity',
      severityLevels: [
        { value: 3, label: 'Moderate', color: '#f59e0b' },
        { value: 5, label: 'Extreme', color: '#dc2626' },
      ],
    };

    it('shows the planning caveat and severity scale', () => {
      render(
        <HMEDMobilePanel {...defaultProps} isExpanded={true} currentLayer={severityLayer} />
      );

      expect(screen.getByText(/Planning tool/i)).toBeInTheDocument();
      expect(screen.getByText('Threat severity')).toBeInTheDocument();
      expect(screen.getByText('3 → 5')).toBeInTheDocument();
      expect(screen.getByText('Moderate')).toBeInTheDocument();
    });

    it('falls back to a fixed range when severity levels are absent', () => {
      const { severityLevels: _unused, ...withoutLevels } = severityLayer;
      render(
        <HMEDMobilePanel {...defaultProps} isExpanded={true} currentLayer={withoutLevels} />
      );

      expect(screen.getByText('3 → 5')).toBeInTheDocument();
      expect(screen.getByText(/minimal/i)).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Precipitation', level: 3 })).toBeInTheDocument();
      expect(screen.queryByText(/Precipitation HSI/i)).not.toBeInTheDocument();
      expect(screen.getByText('Localized threat severity')).toBeInTheDocument();
    });

    it('uses the default subtitle when panelSubtitle is omitted', () => {
      const { panelSubtitle: _unused, ...withoutSubtitle } = severityLayer;
      render(
        <HMEDMobilePanel {...defaultProps} isExpanded={true} currentLayer={withoutSubtitle} />
      );

      expect(screen.getByText('Localized threat severity')).toBeInTheDocument();
    });
  });
});
