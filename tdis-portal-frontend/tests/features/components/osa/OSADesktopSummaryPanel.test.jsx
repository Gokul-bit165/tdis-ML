/**
 * @fileoverview Unit tests for osa/OSADesktopSummaryPanel
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OSADesktopSummaryPanel } from '@/components/osa/OSADesktopSummaryPanel';
import { LAYER_CONFIG } from '@/config/osaLayerConfig';

const summaryDrag = {
  panelRef: { current: null },
  dragHandleRef: { current: null },
  style: {},
};

const HARRIS_COUNTY = 'Harris County';

describe('OSADesktopSummaryPanel', () => {
  const defaultProps = {
    summaryDrag,
    currentLayer: LAYER_CONFIG.power_outage,
    viewMode: 'county',
    handleViewModeChange: vi.fn(),
    summaryStats: {
      totalCustomersOut: 1000,
      allData: [
        { name: HARRIS_COUNTY, customersOut: 500 },
        { name: 'Dallas County', customersOut: 500 },
      ],
    },
    isLoadingData: false,
    searchQuery: '',
    setSearchQuery: vi.fn(),
    handleSummaryItemClick: vi.fn(),
    isSummaryMinimized: false,
    setIsSummaryMinimized: vi.fn(),
  };

  it('renders View Mode with County, Zip, Utility buttons', () => {
    render(<OSADesktopSummaryPanel {...defaultProps} />);
    expect(screen.getByText('View Mode')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /County/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Zip/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Utility/i })).toBeInTheDocument();
  });

  it('shows Summary Statistics and total customers out', () => {
    render(<OSADesktopSummaryPanel {...defaultProps} />);
    expect(screen.getByText('Summary Statistics')).toBeInTheDocument();
    expect(screen.getByText('Total Customers Out:')).toBeInTheDocument();
    expect(screen.getByText('1,000')).toBeInTheDocument();
  });

  it('calls handleViewModeChange when view mode button is clicked', async () => {
    const handleViewModeChange = vi.fn();
    render(
      <OSADesktopSummaryPanel {...defaultProps} handleViewModeChange={handleViewModeChange} />
    );
    const zipLabel = screen.getByText('Zip');
    await userEvent.click(zipLabel.closest('button') || zipLabel);
    expect(handleViewModeChange).toHaveBeenCalledWith('zip');
  });

  it('shows search input and list of counties', () => {
    render(<OSADesktopSummaryPanel {...defaultProps} />);
    expect(screen.getByPlaceholderText(/Search counties/i)).toBeInTheDocument();
    expect(screen.getByText(HARRIS_COUNTY)).toBeInTheDocument();
    expect(screen.getByText('Dallas County')).toBeInTheDocument();
    expect(screen.getAllByText('500').length).toBeGreaterThanOrEqual(1);
  });

  it('calls setSearchQuery when typing in search', async () => {
    const setSearchQuery = vi.fn();
    render(<OSADesktopSummaryPanel {...defaultProps} setSearchQuery={setSearchQuery} />);
    const input = screen.getByPlaceholderText(/Search counties/i);
    await userEvent.type(input, 'a');
    expect(setSearchQuery).toHaveBeenCalled();
  });

  it('shows loading state', () => {
    render(<OSADesktopSummaryPanel {...defaultProps} isLoadingData={true} />);
    expect(screen.getByText(/Loading counties/i)).toBeInTheDocument();
  });

  it('for road_closures layer shows only County in view mode (no Zip/Utility)', () => {
    render(
      <OSADesktopSummaryPanel
        {...defaultProps}
        currentLayer={LAYER_CONFIG.road_closures}
        viewMode="county"
        summaryStats={{ totalCustomersOut: 0, allData: [] }}
      />
    );
    expect(screen.getByText('County')).toBeInTheDocument();
    expect(screen.queryByText('Zip')).not.toBeInTheDocument();
    expect(screen.queryByText('Utility')).not.toBeInTheDocument();
  });

  it('calls handleSummaryItemClick when road_closures item is clicked', async () => {
    const handleSummaryItemClick = vi.fn();
    const roadClosuresWithSummary = { ...LAYER_CONFIG.road_closures, showSummaryStats: true };
    render(
      <OSADesktopSummaryPanel
        {...defaultProps}
        currentLayer={roadClosuresWithSummary}
        summaryStats={{
          totalCustomersOut: 100,
          allData: [{ name: HARRIS_COUNTY, customersOut: 100, center: [-95.3, 29.7] }],
        }}
        handleSummaryItemClick={handleSummaryItemClick}
      />
    );
    const item = screen.getByText(HARRIS_COUNTY);
    await userEvent.click(item);
    expect(handleSummaryItemClick).toHaveBeenCalledWith(
      expect.objectContaining({ name: HARRIS_COUNTY })
    );
  });

  it('toggles summary minimized when collapse button clicked', async () => {
    const setIsSummaryMinimized = vi.fn();
    render(
      <OSADesktopSummaryPanel {...defaultProps} setIsSummaryMinimized={setIsSummaryMinimized} />
    );
    const collapseBtn = screen.getByTitle('Collapse summary');
    await userEvent.click(collapseBtn);
    expect(setIsSummaryMinimized).toHaveBeenCalledWith(true);
  });
});
