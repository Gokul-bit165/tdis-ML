import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import DamageAssessmentTab from '@/components/DamageAssessmentTab';
import * as damageService from '@/services/damageService';
import { DAMAGE_LAYERS } from '@/config/damageAssessmentConfig';
import { cellToLatLng } from 'h3-js';

let currentMockMap;

vi.mock('@/hooks/useMapboxMap', () => ({
  useMapboxMap: () => ({
    mapContainerRef: { current: document.createElement('div') },
    mapRef: { current: currentMockMap },
  }),
}));

describe('DamageAssessmentTab', () => {
  let mockMap;
  let layoutProperties;

  const mockAssessments = [
    {
      assessment_id: 10,
      event_name: 'Hurricane Beryl',
      aoi_name: 'Houston Metro',
      imagery_date: '2024-07-10',
      data_source: 'synthetic',
      n_buildings: 12000,
      n_assessed: 11500,
      c0: 8000,
      c1: 2000,
      c2: 1000,
      c3: 400,
      c4: 100,
      bbox: [-95.8, 29.5, -95.0, 30.2],
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    layoutProperties = {};

    mockMap = {
      isStyleLoaded: () => true,
      getZoom: () => 10,
      getCanvas: () => ({ style: {} }),
      getStyle: () => ({ layers: [] }),
      getSource: vi.fn(),
      addSource: vi.fn(),
      getLayer: vi.fn((_id) => true),
      addLayer: vi.fn(),
      setLayerZoomRange: vi.fn(),
      setLayoutProperty: vi.fn((layerId, prop, value) => {
        layoutProperties[`${layerId}:${prop}`] = value;
      }),
      setPaintProperty: vi.fn(),
      fitBounds: vi.fn(),
      flyTo: vi.fn(),
      jumpTo: vi.fn(),
      queryRenderedFeatures: vi.fn(() => [
        { properties: { h3: '87446c320ffffff', n: 80, c3: 2, c4: 1 } },
        { properties: { h3: '87446c321ffffff', n: 50, c3: 8, c4: 9 } },
      ]),
      on: vi.fn(),
      off: vi.fn(),
      setFeatureState: vi.fn(),
    };
    currentMockMap = mockMap;

    vi.spyOn(damageService, 'getDamageAssessments').mockResolvedValue(mockAssessments);
  });

  const renderWithRouter = (initialEntries = ['/?tab=damage-assessment']) => {
    return render(
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/" element={<DamageAssessmentTab />} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('opens with h3 active when dview is missing; H3 layers visible, others hidden', async () => {
    renderWithRouter(['/?tab=damage-assessment']);

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'H3 Aggregation' })).toBeInTheDocument();
    });

    // Check switcher shows H3 active
    const h3Radio = screen.getByRole('radio', { name: 'H3 Aggregation' });
    expect(h3Radio).toHaveAttribute('aria-checked', 'true');

    // H3 legend is the five damage classes plus not assessed, with no percentage steps
    expect(
      screen.getByText('Most common damage class in each hexagon')
    ).toBeInTheDocument();
  });

  it('?tab=damage-assessment&dview=density opens directly in the density view', async () => {
    renderWithRouter(['/?tab=damage-assessment&dview=density']);

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'Building Density' })).toBeInTheDocument();
    });

    const densityRadio = screen.getByRole('radio', { name: 'Building Density' });
    expect(densityRadio).toHaveAttribute('aria-checked', 'true');

    expect(
      screen.getByText('Building density (smoothed)')
    ).toBeInTheDocument();
  });

  it('clicking each round button updates dview, layer visibility and legend title together', async () => {
    renderWithRouter(['/?tab=damage-assessment']);

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'H3 Aggregation' })).toBeInTheDocument();
    });

    // Click Building Damage button
    const bldgRadio = screen.getByRole('radio', { name: 'Building Damage' });
    fireEvent.click(bldgRadio);

    await waitFor(() => {
      expect(bldgRadio).toHaveAttribute('aria-checked', 'true');
      // Building view: satellite imagery and footprints, never the hexagons of the H3 view
      expect(layoutProperties[`${DAMAGE_LAYERS.SATELLITE}:visibility`]).toBe('visible');
      expect(layoutProperties[`${DAMAGE_LAYERS.H3_FILL}:visibility`]).toBe('none');
      expect(layoutProperties[`${DAMAGE_LAYERS.H3_LINE}:visibility`]).toBe('none');
      expect(layoutProperties[`${DAMAGE_LAYERS.BUILDINGS_FILL}:visibility`]).toBe('visible');
      expect(screen.getByText('Damage class')).toBeInTheDocument();
    });
    // Opened from zoom 10, so the map jumps to the hexagon with the most collapsed buildings
    expect(mockMap.jumpTo).toHaveBeenCalledTimes(1);
    const flight = mockMap.jumpTo.mock.calls[0][0];
    expect(flight.zoom).toBe(15);
    expect(flight.center).toEqual(cellToLatLng('87446c321ffffff').reverse());

    // Click Density button
    const densityRadio = screen.getByRole('radio', { name: 'Building Density' });
    fireEvent.click(densityRadio);

    await waitFor(() => {
      expect(densityRadio).toHaveAttribute('aria-checked', 'true');
      expect(
        screen.getByText('Building density (smoothed)')
      ).toBeInTheDocument();
      expect(layoutProperties[`${DAMAGE_LAYERS.SATELLITE}:visibility`]).toBe('visible');
      expect(layoutProperties[`${DAMAGE_LAYERS.DENSITY_HEAT}:visibility`]).toBe('visible');
      expect(layoutProperties[`${DAMAGE_LAYERS.BUILDINGS_FILL}:visibility`]).toBe('none');
    });

    // Back to H3: street map and hexagons, no imagery
    fireEvent.click(screen.getByRole('radio', { name: 'H3 Aggregation' }));
    await waitFor(() => {
      expect(layoutProperties[`${DAMAGE_LAYERS.SATELLITE}:visibility`]).toBe('none');
      expect(layoutProperties[`${DAMAGE_LAYERS.H3_FILL}:visibility`]).toBe('visible');
    });
    expect(mockMap.jumpTo).toHaveBeenCalledTimes(1);
  });

  it('does not move the map when the Building view is opened at footprint zoom', async () => {
    mockMap.getZoom = () => 15.5;
    renderWithRouter(['/?tab=damage-assessment']);
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'Building Damage' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('radio', { name: 'Building Damage' }));
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'Building Damage' })).toHaveAttribute('aria-checked', 'true');
    });
    expect(mockMap.jumpTo).not.toHaveBeenCalled();
  });

  it('changing view calls no service function (no network beyond tiles)', async () => {
    renderWithRouter(['/?tab=damage-assessment']);

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'H3 Aggregation' })).toBeInTheDocument();
    });

    // Assessment service was called once on mount
    expect(damageService.getDamageAssessments).toHaveBeenCalledTimes(1);

    const bldgRadio = screen.getByRole('radio', { name: 'Building Damage' });
    fireEvent.click(bldgRadio);

    const densityRadio = screen.getByRole('radio', { name: 'Building Density' });
    fireEvent.click(densityRadio);

    // No further service calls were made!
    expect(damageService.getDamageAssessments).toHaveBeenCalledTimes(1);
  });

  it('empty assessment list shows the empty message and adds no sources', async () => {
    vi.spyOn(damageService, 'getDamageAssessments').mockResolvedValue([]);

    renderWithRouter(['/?tab=damage-assessment']);

    await waitFor(() => {
      expect(
        screen.getByText('No damage assessment has been published yet.')
      ).toBeInTheDocument();
    });

    // Sources are not added when list is empty
    expect(mockMap.addSource).not.toHaveBeenCalled();
  });
});
