import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DamageDetailPanel from '@/components/damage/DamageDetailPanel';

describe('DamageDetailPanel', () => {
  it('renders building details, but omits confidence and damage_pct when they are null', () => {
    const buildingWithNulls = {
      building_id: 'bldg-999',
      damage_class: 3,
      confidence: null,
      damage_pct: null,
      assessed_at: '2024-07-15T10:00:00Z',
      model: 'xBD-ResNet50',
    };

    render(
      <DamageDetailPanel
        selectedBuilding={buildingWithNulls}
        onClose={() => {}}
      />
    );

    expect(screen.getByText('bldg-999')).toBeInTheDocument();
    expect(screen.getByText('Partial Structural Collapse')).toBeInTheDocument();
    expect(screen.getByText('xBD-ResNet50')).toBeInTheDocument();

    // Confidence and damage % must NOT be rendered when null
    expect(screen.queryByText(/Confidence:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Damage %:/i)).not.toBeInTheDocument();
  });

  it('renders confidence and damage_pct when they are non-null numbers', () => {
    const building = {
      building_id: 'bldg-101',
      damage_class: 1,
      confidence: 0.885,
      damage_pct: 25.4,
    };

    render(
      <DamageDetailPanel
        selectedBuilding={building}
        onClose={() => {}}
      />
    );

    expect(screen.getByText('88.5%')).toBeInTheDocument();
    expect(screen.getByText('25.4%')).toBeInTheDocument();
  });

  it('shows unavailable message when building returns 404', () => {
    const error404 = new Error('Damage API 404: Building not found');
    error404.status = 404;

    render(
      <DamageDetailPanel
        buildingError={error404}
        onClose={() => {}}
      />
    );

    expect(screen.getByText('This building is no longer available.')).toBeInTheDocument();
  });

  it('renders hexagon cell details and triggers zoom callback', () => {
    const cell = {
      h3: '882681a339fffff',
      res: 8,
      n: 212,
      na: 198,
      c0: 137,
      c1: 42,
      c2: 10,
      c3: 6,
      c4: 3,
      dom: 0,
    };
    const onZoom = vi.fn();
    const onClose = vi.fn();

    render(
      <DamageDetailPanel
        selectedCell={cell}
        onClose={onClose}
        onZoomToCell={onZoom}
      />
    );

    expect(screen.getByText('882681a339fffff')).toBeInTheDocument();
    expect(screen.getByText('212')).toBeInTheDocument();
    expect(screen.getByText('198')).toBeInTheDocument();

    const zoomBtn = screen.getByRole('button', { name: /Zoom to buildings/i });
    fireEvent.click(zoomBtn);
    expect(onZoom).toHaveBeenCalledWith(cell);

    const closeBtn = screen.getByRole('button', { name: /Close details panel/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
