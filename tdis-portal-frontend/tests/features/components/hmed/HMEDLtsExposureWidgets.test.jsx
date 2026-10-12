/**
 * @fileoverview Unit tests for hmed/HMEDLtsExposureWidgets
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HMEDLtsExposureWidgets } from '@/components/hmed/HMEDLtsExposureWidgets';

const sampleData = {
  run_date: '2026-09-07',
  counties_in_scope: 4,
  total_structures: 12500,
  total_residential: 9000,
  total_commercial: 2000,
  total_industrial: 500,
  total_agriculture: 400,
  total_education: 200,
  total_government: 150,
  total_assembly: 80,
  total_utility_misc: 120,
  total_unclassified: 50,
  hospital_count: 3,
  grocery_count: 12,
  emergency_facility_count: 5,
};

describe('HMEDLtsExposureWidgets', () => {
  const defaultProps = {
    data: null,
    loading: false,
    error: null,
    minLtsLevel: 4,
    onMinLtsLevelChange: vi.fn(),
    onRefresh: vi.fn(),
  };

  beforeEach(() => {
    window.gtag = vi.fn();
  });

  afterEach(() => {
    delete window.gtag;
  });

  it('tracks filter_change when switching to Potentially Very High', async () => {
    const onMinLtsLevelChange = vi.fn();
    render(
      <HMEDLtsExposureWidgets {...defaultProps} onMinLtsLevelChange={onMinLtsLevelChange} />
    );
    await userEvent.click(screen.getByRole('button', { name: /Potentially Very High/i }));
    expect(onMinLtsLevelChange).toHaveBeenCalledWith(5);
    expect(window.gtag).toHaveBeenCalledWith(
      'event',
      'filter_change',
      expect.objectContaining({
        tab: 'lts-flash-flood',
        layer_name: 'lts_flash_flood',
        filter_name: 'Potentially Very High',
        previous_filter: 'Potentially High',
        lts_min_level: 5,
      })
    );
  });

  it('does not track when the selected LTS tier is clicked again', async () => {
    const onMinLtsLevelChange = vi.fn();
    render(
      <HMEDLtsExposureWidgets {...defaultProps} onMinLtsLevelChange={onMinLtsLevelChange} />
    );
    await userEvent.click(screen.getByRole('button', { name: /Potentially High/i }));
    expect(onMinLtsLevelChange).toHaveBeenCalledWith(4);
    expect(window.gtag).not.toHaveBeenCalled();
  });

  it('shows a loading empty state and disables refresh', () => {
    const onRefresh = vi.fn();
    render(
      <HMEDLtsExposureWidgets {...defaultProps} loading onRefresh={onRefresh} />
    );

    expect(screen.getByText('Loading potential impact…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh potential impact data' })).toBeDisabled();
  });

  it('does not show the loading empty state when data is already present', () => {
    render(<HMEDLtsExposureWidgets {...defaultProps} data={sampleData} loading />);

    expect(screen.queryByText('Loading potential impact…')).not.toBeInTheDocument();
    expect(screen.getByText(/Run: 2026-09-07/)).toBeInTheDocument();
  });

  it('renders the error banner and skips exposure totals', () => {
    render(
      <HMEDLtsExposureWidgets
        {...defaultProps}
        error="Summary request failed"
        data={sampleData}
      />
    );

    expect(screen.getByText('Summary request failed')).toBeInTheDocument();
    expect(screen.queryByText(/Run:/)).not.toBeInTheDocument();
    expect(screen.queryByText('Buildings (structures)')).not.toBeInTheDocument();
    expect(screen.queryByText('Loading potential impact…')).not.toBeInTheDocument();
  });

  it('renders run metadata, structure totals, and critical facilities', () => {
    render(<HMEDLtsExposureWidgets {...defaultProps} data={sampleData} />);

    expect(screen.getByText(/Run: 2026-09-07/)).toBeInTheDocument();
    expect(screen.getByText(/4 counties in scope/)).toBeInTheDocument();
    expect(screen.getByText('12,500')).toBeInTheDocument();
    expect(screen.getByText('Hospitals')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Grocery')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Emergency')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('omits counties-in-scope when the field is null and formats missing counts as dashes', () => {
    render(
      <HMEDLtsExposureWidgets
        {...defaultProps}
        data={{
          run_date: null,
          counties_in_scope: null,
          total_structures: null,
          hospital_count: Number.NaN,
          grocery_count: 1,
          emergency_facility_count: 1,
        }}
      />
    );

    expect(screen.getByText(/Run: —/)).toBeInTheDocument();
    expect(screen.queryByText(/counties in scope/)).not.toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);
  });

  it('expands and collapses the buildings breakdown', async () => {
    render(<HMEDLtsExposureWidgets {...defaultProps} data={sampleData} />);

    expect(screen.queryByText('Residential')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Buildings \(structures\)/i }));

    expect(screen.getByText('Residential')).toBeInTheDocument();
    expect(screen.getByText('9,000')).toBeInTheDocument();
    expect(screen.getByText('Commercial')).toBeInTheDocument();
    expect(screen.getByText('Unclassified')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Buildings \(structures\)/i }));

    expect(screen.queryByText('Residential')).not.toBeInTheDocument();
  });

  it('calls onRefresh from the header control', async () => {
    const onRefresh = vi.fn();
    render(<HMEDLtsExposureWidgets {...defaultProps} data={sampleData} onRefresh={onRefresh} />);

    await userEvent.click(screen.getByRole('button', { name: 'Refresh potential impact data' }));

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('shows the no-high-threat banner when counties_in_scope is zero', () => {
    render(
      <HMEDLtsExposureWidgets
        {...defaultProps}
        minLtsLevel={5}
        data={{
          ...sampleData,
          counties_in_scope: 0,
          total_structures: 0,
          hospital_count: 0,
          grocery_count: 0,
          emergency_facility_count: 0,
        }}
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent(/No high-threat regions/);
    expect(screen.getByRole('status')).toHaveTextContent(/LTS 5 \(Potentially Very High\)/);
  });

  it('treats zero structures and facilities as empty when county count is missing', () => {
    render(
      <HMEDLtsExposureWidgets
        {...defaultProps}
        data={{
          run_date: '2026-09-07',
          total_structures: 0,
          hospital_count: 0,
          grocery_count: 0,
          emergency_facility_count: 0,
        }}
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent(/No high-threat regions/);
    expect(screen.getByRole('status')).toHaveTextContent(/LTS 4 \(Potentially High\)/);
  });

  it('does not treat missing counties as empty when any modeled count is present', () => {
    render(
      <HMEDLtsExposureWidgets
        {...defaultProps}
        data={{
          run_date: '2026-09-07',
          total_structures: 10,
          hospital_count: 0,
          grocery_count: 0,
          emergency_facility_count: 0,
        }}
      />
    );

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('skips the empty-outlook banner when data is not an object', () => {
    render(<HMEDLtsExposureWidgets {...defaultProps} data={1} />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText(/Run: —/)).toBeInTheDocument();
  });

  it('falls back to L# chip labels when a severity tier is missing from config', async () => {
    const onMinLtsLevelChange = vi.fn();
    render(
      <HMEDLtsExposureWidgets
        {...defaultProps}
        minLtsLevel={4}
        onMinLtsLevelChange={onMinLtsLevelChange}
        severityLevels={[{ value: 9, color: '#111111', label: 'Unused' }]}
        data={{
          run_date: '2026-09-07',
          counties_in_scope: 0,
          total_structures: 0,
          hospital_count: 0,
          grocery_count: 0,
          emergency_facility_count: 0,
        }}
      />
    );

    expect(screen.getByRole('button', { name: '≥ L4' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '≥ L5' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/LTS 4/);
    expect(screen.getByRole('status')).not.toHaveTextContent('(');

    await userEvent.click(screen.getByRole('button', { name: '≥ L5' }));

    expect(onMinLtsLevelChange).toHaveBeenCalledWith(5);
    expect(window.gtag).toHaveBeenCalledWith(
      'event',
      'filter_change',
      expect.objectContaining({
        filter_name: 'L5',
        previous_filter: 'L4',
        lts_min_level: 5,
      })
    );
  });
});
