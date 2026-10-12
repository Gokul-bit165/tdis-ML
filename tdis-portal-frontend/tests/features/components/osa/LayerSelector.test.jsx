/**
 * @fileoverview Unit tests for osa/LayerSelector
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LayerSelector } from '@/components/osa/LayerSelector';

describe('LayerSelector', () => {
  it('renders Data Layer label and layer buttons', () => {
    const onSelectLayer = vi.fn();
    const setViewMode = vi.fn();
    render(
      <LayerSelector
        selectedLayer="power_outage"
        onSelectLayer={onSelectLayer}
        setViewMode={setViewMode}
      />
    );
    expect(screen.getByText('Data Layer')).toBeInTheDocument();
    const buttons = screen.getAllByRole('button');
    const labels = buttons.map((b) => b.textContent);
    expect(labels.some((t) => t && t.includes('Power Outages'))).toBe(true);
    expect(labels.some((t) => t && t.includes('Power Outages by Zip'))).toBe(true);
    expect(labels.some((t) => t && t.includes('Road Weather Hazard Alerts'))).toBe(true);
  });

  it('marks selected layer with selected styling', () => {
    render(
      <LayerSelector
        selectedLayer="power_outage_zip"
        onSelectLayer={() => {}}
        setViewMode={() => {}}
      />
    );
    const zipBtn = screen.getByRole('button', { name: /Power Outages by Zip/i });
    expect(zipBtn).toHaveClass('bg-[#324755]');
  });

  it('calls onSelectLayer when a layer button is clicked', async () => {
    const onSelectLayer = vi.fn();
    render(
      <LayerSelector
        selectedLayer="power_outage"
        onSelectLayer={onSelectLayer}
        setViewMode={() => {}}
      />
    );
    const zipLabel = screen.getByText('Power Outages by Zip');
    await userEvent.click(zipLabel.closest('button') || zipLabel);
    expect(onSelectLayer).toHaveBeenCalledWith('power_outage_zip');
  });

  it('calls setViewMode with county when road_closures is selected', async () => {
    const setViewMode = vi.fn();
    render(
      <LayerSelector
        selectedLayer="power_outage"
        onSelectLayer={() => {}}
        setViewMode={setViewMode}
      />
    );
    const hazardBtn = screen.getByRole('button', { name: /Road Weather Hazard Alerts/i });
    await userEvent.click(hazardBtn);
    expect(setViewMode).toHaveBeenCalledWith('county');
  });
});
