/**
 * @fileoverview Unit tests for hooks/useOSASummaryData
 * Feature: OSA summary data
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOSASummaryData } from '@/hooks/useOSASummaryData';
import * as powerOutageService from '@/services/powerOutageService';

vi.mock('@/services/powerOutageService', () => ({
  getPowerOutageCounties: vi.fn(),
  getPowerOutageZips: vi.fn(),
  getPowerOutageUtilities: vi.fn(),
}));

const countyLayer = { id: 'power_outage' };
const hazardLayer = { id: 'road_closures' };

describe('useOSASummaryData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(powerOutageService.getPowerOutageCounties).mockResolvedValue([
      { CountyName: 'Harris County', CustomersOut: 100 },
      { CountyName: 'Dallas County', CustomersOut: 200 },
    ]);
    vi.mocked(powerOutageService.getPowerOutageZips).mockResolvedValue([
      { ZCTA5CE20: '75001', total_customers_out: 50, centroid_lon: -96.5, centroid_lat: 32.8 },
    ]);
    vi.mocked(powerOutageService.getPowerOutageUtilities).mockResolvedValue([
      { UtilityName: 'Oncor', CustomersOut: 300 },
    ]);
  });

  it('returns viewMode, setViewMode, handleViewModeChange, summaryStats, isLoadingData, searchQuery, setSearchQuery, handleSummaryItemClick', async () => {
    const mapRef = { current: null };
    const { result } = renderHook(() => useOSASummaryData(countyLayer, mapRef));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current).toHaveProperty('viewMode');
    expect(result.current).toHaveProperty('setViewMode');
    expect(result.current).toHaveProperty('handleViewModeChange');
    expect(result.current).toHaveProperty('summaryStats');
    expect(result.current).toHaveProperty('isLoadingData');
    expect(result.current).toHaveProperty('searchQuery');
    expect(result.current).toHaveProperty('setSearchQuery');
    expect(result.current).toHaveProperty('handleSummaryItemClick');
  });

  it('starts with viewMode county and fetches counties on mount', async () => {
    const mapRef = { current: null };
    const { result } = renderHook(() => useOSASummaryData(countyLayer, mapRef));
    expect(result.current.viewMode).toBe('county');
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(powerOutageService.getPowerOutageCounties).toHaveBeenCalled();
    expect(result.current.summaryStats.allData.length).toBe(2);
    expect(result.current.summaryStats.totalCustomersOut).toBe(300);
  });

  it('handleViewModeChange updates viewMode and clears searchQuery', async () => {
    const mapRef = { current: null };
    const { result } = renderHook(() => useOSASummaryData(countyLayer, mapRef));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(() => {
      result.current.setSearchQuery('harris');
    });
    expect(result.current.searchQuery).toBe('harris');
    await act(() => {
      result.current.handleViewModeChange('zip');
    });
    expect(result.current.viewMode).toBe('zip');
    expect(result.current.searchQuery).toBe('');
  });

  it('when viewMode is zip fetches zips and updates summaryStats', async () => {
    const mapRef = { current: null };
    const { result } = renderHook(() => useOSASummaryData(countyLayer, mapRef));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(() => {
      result.current.handleViewModeChange('zip');
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(powerOutageService.getPowerOutageZips).toHaveBeenCalled();
    expect(result.current.summaryStats.allData.some((d) => d.name === '75001')).toBe(true);
    expect(result.current.summaryStats.totalCustomersOut).toBe(50);
  });

  it('when viewMode is utility fetches utilities', async () => {
    const mapRef = { current: null };
    const { result } = renderHook(() => useOSASummaryData(countyLayer, mapRef));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(() => {
      result.current.handleViewModeChange('utility');
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(powerOutageService.getPowerOutageUtilities).toHaveBeenCalled();
    expect(result.current.summaryStats.allData.some((d) => d.name === 'Oncor')).toBe(true);
  });

  it('summaryStats filters by searchQuery', async () => {
    const mapRef = { current: null };
    const { result } = renderHook(() => useOSASummaryData(countyLayer, mapRef));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(() => {
      result.current.setSearchQuery('Harris');
    });
    expect(result.current.summaryStats.allData.length).toBe(1);
    expect(result.current.summaryStats.allData[0].name).toBe('Harris County');
  });

  it('handleSummaryItemClick calls mapRef.current.flyTo when center is valid', async () => {
    const flyTo = vi.fn();
    const mapRef = { current: { flyTo } };
    const { result } = renderHook(() => useOSASummaryData(countyLayer, mapRef));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const item = result.current.summaryStats.allData[0];
    item.center = [-95.3, 29.7];
    act(() => {
      result.current.handleSummaryItemClick(item);
    });
    expect(flyTo).toHaveBeenCalledWith({ center: [-95.3, 29.7], zoom: 10, duration: 1000 });
  });

  it('handleSummaryItemClick does nothing when mapRef.current is null', async () => {
    const mapRef = { current: null };
    const { result } = renderHook(() => useOSASummaryData(countyLayer, mapRef));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const item = { name: 'Harris', center: [-95.3, 29.7] };
    act(() => {
      result.current.handleSummaryItemClick(item);
    });
    expect(() => {}).not.toThrow();
  });

  it('handleSummaryItemClick does nothing when center is invalid', async () => {
    const flyTo = vi.fn();
    const mapRef = { current: { flyTo } };
    const { result } = renderHook(() => useOSASummaryData(countyLayer, mapRef));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => {
      result.current.handleSummaryItemClick({ name: 'X', center: null });
    });
    act(() => {
      result.current.handleSummaryItemClick({ name: 'Y', center: [1] });
    });
    act(() => {
      result.current.handleSummaryItemClick({ name: 'Z', center: [NaN, 29.7] });
    });
    expect(flyTo).not.toHaveBeenCalled();
  });

  it('for road_closures layer county viewMode returns empty allData', async () => {
    const mapRef = { current: null };
    const { result } = renderHook(() => useOSASummaryData(hazardLayer, mapRef));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.viewMode).toBe('county');
    expect(result.current.summaryStats.allData).toEqual([]);
    expect(result.current.summaryStats.totalCustomersOut).toBe(0);
  });

  it('handles fetch error for counties', async () => {
    vi.mocked(powerOutageService.getPowerOutageCounties).mockRejectedValue(
      new Error('Network error')
    );
    const mapRef = { current: null };
    const { result } = renderHook(() => useOSASummaryData(countyLayer, mapRef));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.summaryStats.allData).toEqual([]);
  });
});
