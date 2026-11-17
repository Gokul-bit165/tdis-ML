import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import * as drainageService from '@/services/drainageService';
import DrainageMonitoringTab from '@/components/DrainageMonitoringTab';

const handlers = {};
const layerHandlers = {};
const popups = [];
let mockMap;

vi.mock('mapbox-gl-style-switcher', () => ({ MapboxStyleSwitcherControl: function () {} }));
vi.mock('mapbox-gl', () => ({
  default: {
    accessToken: 'test',
    NavigationControl: function () {},
    Popup: function () {
      const popup = {
        setLngLat: () => popup,
        setHTML: (html) => {
          popup.html = html;
          return popup;
        },
        addTo: () => {
          popups.push(popup);
          return popup;
        },
      };
      return popup;
    },
    Map: function () {
      return mockMap;
    },
  },
}));

const summary = {
  run_id: 'r1',
  data_source: 'drone-survey',
  n_defects: 4,
  published_at: '2026-11-17T04:05:22+00:00',
  bbox: [-95.2, 29.5, -95.1, 29.6],
  counts: { tire: 2, bank_erosion: 1, trash_pile: 1 },
};
const feature = (category, area = 1) => ({
  type: 'Feature',
  properties: { category, area },
  geometry: { type: 'Point', coordinates: [-95.15, 29.55] },
});
const points = {
  type: 'FeatureCollection',
  features: [feature('tire'), feature('tire'), feature('bank_erosion'), feature('trash_pile')],
};

describe('DrainageMonitoringTab', () => {
  let sources;
  let layout;
  let paint;

  beforeEach(() => {
    vi.useRealTimers();
    Object.keys(handlers).forEach((k) => delete handlers[k]);
    Object.keys(layerHandlers).forEach((k) => delete layerHandlers[k]);
    popups.length = 0;
    sources = {};
    layout = {};
    paint = {};
    mockMap = {
      addControl: vi.fn(),
      on: vi.fn((event, layerOrFn, fn) => {
        if (fn) layerHandlers[`${event}:${layerOrFn}`] = fn;
        else handlers[event] = layerOrFn;
      }),
      remove: vi.fn(),
      getSource: vi.fn((id) => {
        sources[id] ??= {
          setData: vi.fn(),
          getClusterExpansionZoom: vi.fn(),
          getClusterLeaves: vi.fn(),
        };
        return sources[id];
      }),
      getLayer: vi.fn(() => true),
      setLayoutProperty: vi.fn((id, prop, value) => {
        layout[`${id}:${prop}`] = value;
      }),
      setPaintProperty: vi.fn((id, prop, value) => {
        paint[`${id}:${prop}`] = value;
      }),
      setFilter: vi.fn(),
      fitBounds: vi.fn(),
      easeTo: vi.fn(),
      getZoom: vi.fn(() => 12),
      getCanvas: () => ({ style: {} }),
    };
    vi.spyOn(drainageService, 'getDrainageSummary').mockResolvedValue(summary);
    vi.spyOn(drainageService, 'getDrainagePoints').mockResolvedValue(points);
    vi.spyOn(drainageService, 'getDrainagePolygons').mockResolvedValue({
      type: 'FeatureCollection',
      features: [],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const renderLoaded = async () => {
    render(<DrainageMonitoringTab />);
    act(() => handlers.load());
    await screen.findByText('Survey run r1');
  };
  const toggleFor = (label) => screen.getByRole('switch', { name: label });

  it('shows the published run and a legend with counts, unknown classes under Other', async () => {
    await renderLoaded();
    const legend = screen.getByRole('list', { name: 'Defect classes' });
    expect(within(legend).getByText('Tires').parentElement).toHaveTextContent('2');
    expect(within(legend).getByText('Other').parentElement).toHaveTextContent('1');
    expect(toggleFor('Tires')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText(/Showing 4 of 4 defects/)).toBeInTheDocument();
  });

  it('puts each class in its own clustered source and frames the survey', async () => {
    await renderLoaded();
    await waitFor(() => expect(sources['drainage-pts-tire'].setData).toHaveBeenCalled());
    expect(sources['drainage-pts-tire'].setData.mock.calls.at(-1)[0].features).toHaveLength(2);
    expect(sources['drainage-pts-bank_erosion'].setData.mock.calls.at(-1)[0].features).toHaveLength(
      1
    );
    expect(sources['drainage-pts-other'].setData.mock.calls.at(-1)[0].features).toHaveLength(1);
    expect(mockMap.fitBounds).toHaveBeenCalled();
  });

  it('fades a class out when its switch is turned off, then stops rendering it', async () => {
    await renderLoaded();
    vi.useFakeTimers();
    fireEvent.click(toggleFor('Tires'));
    expect(toggleFor('Tires')).toHaveAttribute('aria-checked', 'false');
    expect(paint['drainage-pts-tire-pin:icon-opacity']).toBe(0);
    expect(paint['drainage-pts-tire-count:text-opacity']).toBe(0);
    expect(layout['drainage-pts-tire-pin:visibility']).not.toBe('none'); // still fading
    act(() => vi.advanceTimersByTime(300));
    expect(layout['drainage-pts-tire-pin:visibility']).toBe('none');
    expect(paint['drainage-pts-bank_erosion-pin:icon-opacity']).toBe(1);
    expect(screen.getByText(/Showing 2 of 4 defects/)).toBeInTheDocument();
    const outlineFilter = mockMap.setFilter.mock.calls.at(-1)[1];
    expect(JSON.stringify(outlineFilter[1])).not.toContain('"tire"');
  });

  it('keeps a class rendered if it is switched back on during the fade', async () => {
    await renderLoaded();
    vi.useFakeTimers();
    fireEvent.click(toggleFor('Tires'));
    fireEvent.click(toggleFor('Tires'));
    act(() => vi.advanceTimersByTime(300));
    expect(layout['drainage-pts-tire-pin:visibility']).toBe('visible');
    expect(paint['drainage-pts-tire-pin:icon-opacity']).toBe(1);
  });

  it('isolates one class with "Only" and restores with "All"', async () => {
    await renderLoaded();
    fireEvent.click(screen.getByRole('button', { name: 'Show only Bank Erosion' }));
    expect(toggleFor('Bank Erosion')).toHaveAttribute('aria-checked', 'true');
    expect(toggleFor('Tires')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText(/Showing 1 of 4 defects/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getByText(/Showing 4 of 4 defects/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'None' }));
    expect(screen.getByText(/Showing 0 of 4 defects/)).toBeInTheDocument();
  });

  it('zooms into a group that splits, and summarises one that cannot', async () => {
    await renderLoaded();
    const click = layerHandlers['click:drainage-pts-tire-pin'];
    const group = {
      source: 'drainage-pts-tire',
      properties: { point_count: 2, cluster_id: 7, category: undefined },
      geometry: { coordinates: [-95.15, 29.55] },
    };
    const src = mockMap.getSource('drainage-pts-tire');

    src.getClusterExpansionZoom.mockImplementationOnce((id, cb) => cb(null, 16));
    click({ features: [group] });
    expect(mockMap.easeTo).toHaveBeenCalledWith(expect.objectContaining({ zoom: 16 }));

    // Same spot: expansion zoom is beyond the map's maximum, so a summary popup opens instead.
    src.getClusterExpansionZoom.mockImplementationOnce((id, cb) => cb(null, 21));
    src.getClusterLeaves.mockImplementationOnce((id, limit, offset, cb) =>
      cb(null, [feature('tire', 1.5), feature('tire', 2)])
    );
    click({ features: [group] });
    expect(popups.at(-1).html).toContain('2 × Tires');
    expect(popups.at(-1).html).toContain('3.50 m²');
  });

  it('requests outlines for the visible area once zoomed in', async () => {
    mockMap.getZoom.mockReturnValue(17);
    mockMap.getBounds = () => ({
      getWest: () => -95.19,
      getSouth: () => 29.54,
      getEast: () => -95.18,
      getNorth: () => 29.545,
    });
    await renderLoaded();
    act(() => handlers.moveend());
    await waitFor(() => expect(drainageService.getDrainagePolygons).toHaveBeenCalled());
    // Asked with the survey manifest (to find the tiles) and the padded view.
    const [manifestArg, bbox] = drainageService.getDrainagePolygons.mock.calls[0];
    expect(manifestArg.run_id).toBe('r1');
    expect(bbox[0]).toBeLessThan(-95.19);
  });

  it('shows the API error', async () => {
    drainageService.getDrainageSummary.mockRejectedValueOnce(
      new Error('Drainage API 503: Database unavailable')
    );
    render(<DrainageMonitoringTab />);
    expect(await screen.findByText('Drainage API 503: Database unavailable')).toBeInTheDocument();
  });
});
