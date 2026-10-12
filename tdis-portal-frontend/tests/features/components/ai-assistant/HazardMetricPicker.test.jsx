/**
 * @fileoverview Unit tests for HazardMetricPicker
 * Feature: components
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HazardMetricPicker from '@/components/ai-assistant/HazardMetricPicker';
import { HAZARD_METRICS } from '@/config/hazardMapConfig';

const HAZARD_REQUEST_ERROR = 'Hazard map request failed (500)';

function renderPicker(props = {}) {
  return render(
    <HazardMetricPicker metric="HRCN" onChange={() => {}} count={0} {...props} />
  );
}

describe('HazardMetricPicker', () => {
  it('renders every hazard code as an option with the current one selected', () => {
    renderPicker({ isActiveLayer: true });

    const select = screen.getByLabelText(/Hazard layer/i);
    expect(select).toHaveValue('HRCN');
    expect(screen.getAllByRole('option')).toHaveLength(HAZARD_METRICS.length);
    expect(screen.getByRole('option', { name: 'Riverine Flood' })).toBeInTheDocument();
  });

  it('reports the selected hazard code on change', async () => {
    const onChange = vi.fn();
    renderPicker({ onChange });

    await userEvent.selectOptions(screen.getByLabelText(/Hazard layer/i), 'WFIR');

    expect(onChange).toHaveBeenCalledWith('WFIR');
  });

  it('shows the hex count and label when the hazard layer is active', () => {
    renderPicker({ count: 1234, isActiveLayer: true });

    expect(screen.getByText('1,234 hexes — Hurricane')).toBeInstanceOf(HTMLOutputElement);
  });

  it('shows a loading status and disables the select while fetching', () => {
    renderPicker({ loading: true });

    expect(screen.getByText('Loading Hurricane…')).toBeInstanceOf(HTMLOutputElement);
    expect(screen.getByLabelText(/Hazard layer/i)).toBeDisabled();
  });

  it('surfaces the error message instead of the count', () => {
    renderPicker({ error: HAZARD_REQUEST_ERROR, count: 5 });

    const status = screen.getByText(HAZARD_REQUEST_ERROR);
    expect(status).toHaveTextContent(HAZARD_REQUEST_ERROR);
    expect(status.className).toContain('ai-hazard-picker__status--error');
  });

  it('prompts the user to pick a hazard while the chat answer owns the map', () => {
    renderPicker({ isActiveLayer: false, count: 9 });

    expect(
      screen.getByText('Showing chat answer — pick a hazard to browse')
    ).toBeInstanceOf(HTMLOutputElement);
  });

  it('offers a way back to the answer map while browsing hazards', async () => {
    const onShowAnswerMap = vi.fn();
    renderPicker({ isActiveLayer: true, hasAnswerMap: true, onShowAnswerMap });

    await userEvent.click(screen.getByRole('button', { name: /Show answer map/i }));

    expect(onShowAnswerMap).toHaveBeenCalledTimes(1);
  });

  it('hides the restore control when no answer map is available', () => {
    renderPicker({ isActiveLayer: true, hasAnswerMap: false });

    expect(screen.queryByRole('button', { name: /Show answer map/i })).toBeNull();
  });

  it('shows a placeholder instead of the hazard label while the chat answer owns the map', () => {
    renderPicker({ isActiveLayer: false });
    const select = screen.getByLabelText(/Hazard layer/i);
    expect(select).toHaveValue('');
    expect(screen.getByRole('option', { name: '— chat answer —' })).toBeDisabled();
  });

  it('shows the hazard label again once the hazard layer owns the map', () => {
    renderPicker({ isActiveLayer: true });
    const select = screen.getByLabelText(/Hazard layer/i);
    expect(select).toHaveValue('HRCN');
    expect(screen.queryByRole('option', { name: '— chat answer —' })).toBeNull();
  });

  it('hides the restore control while the answer map is already showing', () => {
    renderPicker({ isActiveLayer: false, hasAnswerMap: true, onShowAnswerMap: () => {} });

    expect(screen.queryByRole('button', { name: /Show answer map/i })).toBeNull();
  });
});
