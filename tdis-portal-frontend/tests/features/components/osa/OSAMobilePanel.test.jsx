/**
 * @fileoverview Unit tests for osa/OSAMobilePanel
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OSAMobilePanel } from '@/components/osa/OSAMobilePanel';
import { LAYER_CONFIG } from '@/config/osaLayerConfig';

describe('OSAMobilePanel', () => {
  const defaultProps = {
    isExpanded: false,
    onOpen: vi.fn(),
    onClose: vi.fn(),
    onShowInfo: vi.fn(),
    mobileActiveTab: 'summary',
    setMobileActiveTab: vi.fn(),
    currentLayer: LAYER_CONFIG.power_outage,
    selectedLayer: 'power_outage',
    setSelectedLayer: vi.fn(),
    viewMode: 'county',
    handleViewModeChange: vi.fn(),
    setViewMode: vi.fn(),
    summaryStats: { totalCustomersOut: 500, allData: [{ name: 'Harris', customersOut: 500 }] },
    isLoadingData: false,
    searchQuery: '',
    setSearchQuery: vi.fn(),
    handleSummaryItemClick: vi.fn(),
  };

  it('when not expanded shows Controls FAB button', () => {
    render(<OSAMobilePanel {...defaultProps} />);
    expect(screen.getByRole('button', { name: /Controls/i })).toBeInTheDocument();
  });

  it('calls onOpen when Controls FAB is clicked', async () => {
    const onOpen = vi.fn();
    render(<OSAMobilePanel {...defaultProps} onOpen={onOpen} />);
    const fab = screen.getByRole('button', { name: /Controls/i });
    await userEvent.click(fab);
    expect(onOpen).toHaveBeenCalled();
  });

  it('when expanded shows panel with Power Outages title and Summary/Legend tabs', () => {
    render(<OSAMobilePanel {...defaultProps} isExpanded={true} />);
    expect(screen.getByText('Power Outages')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Info/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Summary/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Legend/i })).toBeInTheDocument();
  });

  it('calls onClose when overlay is clicked in expanded panel', async () => {
    const onClose = vi.fn();
    render(<OSAMobilePanel {...defaultProps} isExpanded={true} onClose={onClose} />);
    const overlay = document.querySelector('[class*="bg-black"][class*="inset-0"]');
    expect(overlay).toBeInTheDocument();
    await userEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onShowInfo when Info is clicked', async () => {
    const onShowInfo = vi.fn();
    render(<OSAMobilePanel {...defaultProps} isExpanded={true} onShowInfo={onShowInfo} />);
    const infoBtn = screen.getByRole('button', { name: /Info/i });
    await userEvent.click(infoBtn);
    expect(onShowInfo).toHaveBeenCalledWith(true);
  });

  it('when activeTab is summary shows View Mode and summary content', () => {
    render(<OSAMobilePanel {...defaultProps} isExpanded={true} mobileActiveTab="summary" />);
    expect(screen.getByText('View Mode')).toBeInTheDocument();
    expect(screen.getByText('Total Customers Out:')).toBeInTheDocument();
    expect(screen.getAllByText('500').length).toBeGreaterThanOrEqual(1);
  });

  it('when activeTab is legend shows LayerSelector', () => {
    render(<OSAMobilePanel {...defaultProps} isExpanded={true} mobileActiveTab="legend" />);
    expect(screen.getByText('Data Layer')).toBeInTheDocument();
  });

  it('for road_closures with legend tab shows LayerSelector and AlertTypesLegend', () => {
    render(
      <OSAMobilePanel
        {...defaultProps}
        isExpanded={true}
        currentLayer={LAYER_CONFIG.road_closures}
        selectedLayer="road_closures"
        mobileActiveTab="legend"
      />
    );
    expect(screen.getByText('Data Layer')).toBeInTheDocument();
    expect(screen.getByText('Alert Types')).toBeInTheDocument();
  });
});
