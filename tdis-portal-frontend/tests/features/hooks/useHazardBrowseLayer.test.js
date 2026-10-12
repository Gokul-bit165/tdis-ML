/**
 * @fileoverview Unit tests for useHazardBrowseLayer
 * Feature: hooks
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useHazardBrowseLayer } from '@/hooks/useHazardBrowseLayer';
import { fetchHazardMap } from '@/services/hazardMapService';

vi.mock('@/services/hazardMapService', () => ({
  fetchHazardMap: vi.fn(),
}));

const TEST_TOKEN = 'test-token';
const getToken = () => TEST_TOKEN;

const hexes = [{ hex_id: '862a1072fffffff', value: 12.5, risk: 12.5, population: 100 }];

describe('useHazardBrowseLayer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('defaults to HRCN and loads hexes for it', async () => {
    vi.mocked(fetchHazardMap).mockResolvedValue({ metric: 'HRCN', count: 1, hexes });

    const { result } = renderHook(() => useHazardBrowseLayer(getToken));

    expect(result.current.hazardMetric).toBe('HRCN');
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fetchHazardMap).toHaveBeenCalledWith({ metric: 'HRCN', token: TEST_TOKEN });
    expect(result.current.records).toEqual(hexes);
    expect(result.current.error).toBeNull();
    expect(result.current.preferBrowse).toBe(true);
  });

  it('refetches with the new metric when selectMetric is called', async () => {
    vi.mocked(fetchHazardMap).mockResolvedValue({ metric: 'RFLD', count: 1, hexes });

    const { result } = renderHook(() => useHazardBrowseLayer(getToken));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.selectMetric('RFLD'));

    await waitFor(() => expect(result.current.hazardMetric).toBe('RFLD'));
    await waitFor(() =>
      expect(fetchHazardMap).toHaveBeenCalledWith({ metric: 'RFLD', token: TEST_TOKEN })
    );
  });

  it('exposes the failure message and clears records on error', async () => {
    vi.mocked(fetchHazardMap).mockRejectedValue(new Error('Hazard map request failed (500)'));

    const { result } = renderHook(() => useHazardBrowseLayer(getToken));

    await waitFor(() => expect(result.current.error).toBe('Hazard map request failed (500)'));
    expect(result.current.records).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('falls back to a generic message when the rejection is not an Error', async () => {
    vi.mocked(fetchHazardMap).mockRejectedValue('boom');

    const { result } = renderHook(() => useHazardBrowseLayer(getToken));

    await waitFor(() => expect(result.current.error).toBe('Failed to load hazard map'));
  });

  it('does not fetch while disabled (unauthenticated)', async () => {
    const { result } = renderHook(() => useHazardBrowseLayer(getToken, false));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchHazardMap).not.toHaveBeenCalled();
    expect(result.current.records).toEqual([]);
  });

  it('showAnswerMap hands the map to the chat answer, selectMetric wins it back', async () => {
    vi.mocked(fetchHazardMap).mockResolvedValue({ metric: 'HRCN', count: 1, hexes });

    const { result } = renderHook(() => useHazardBrowseLayer(getToken));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.showAnswerMap());
    expect(result.current.preferBrowse).toBe(false);

    act(() => result.current.selectMetric('WFIR'));
    expect(result.current.preferBrowse).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
  });
});
