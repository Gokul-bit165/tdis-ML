/**
 * @fileoverview Unit tests for LayerControl component
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LayerControl from '@/components/LayerControl';

describe('LayerControl', () => {
  it('renders layer trigger button with aria-label', () => {
    const setShowLayerMenu = vi.fn();
    render(
      <LayerControl
        setShowLayerMenu={setShowLayerMenu}
        layerVisibility={{ outline: true, events: true }}
        setLayerVisibility={() => {}}
      />
    );
    expect(screen.getByLabelText(/Toggle map layers menu/i)).toBeInTheDocument();
  });

  it('calls setShowLayerMenu when trigger is clicked', async () => {
    const user = userEvent.setup();
    const setShowLayerMenu = vi.fn();
    render(
      <LayerControl
        setShowLayerMenu={setShowLayerMenu}
        layerVisibility={{ outline: true, events: true }}
        setLayerVisibility={() => {}}
      />
    );
    await user.click(screen.getByLabelText(/Toggle map layers menu/i));
    expect(setShowLayerMenu).toHaveBeenCalled();
  });

  it('opens dropdown and shows layer options when clicked', async () => {
    const user = userEvent.setup();
    render(
      <LayerControl
        setShowLayerMenu={() => {}}
        layerVisibility={{ outline: true, events: true }}
        setLayerVisibility={() => {}}
      />
    );
    await user.click(screen.getByLabelText(/Toggle map layers menu/i));
    expect(screen.getByText('Map Layers')).toBeInTheDocument();
    expect(screen.getByText('Texas Counties')).toBeInTheDocument();
    expect(screen.getByText('Hazards')).toBeInTheDocument();
  });

  it('calls setLayerVisibility when Texas Counties is toggled', async () => {
    const user = userEvent.setup();
    const setLayerVisibility = vi.fn();
    render(
      <LayerControl
        setShowLayerMenu={() => {}}
        layerVisibility={{ outline: true, events: true }}
        setLayerVisibility={setLayerVisibility}
      />
    );
    await user.click(screen.getByLabelText(/Toggle map layers menu/i));
    await user.click(screen.getByText('Texas Counties'));
    expect(setLayerVisibility).toHaveBeenCalled();
  });

  it('calls setLayerVisibility when Hazards is toggled', async () => {
    const user = userEvent.setup();
    const setLayerVisibility = vi.fn();
    render(
      <LayerControl
        setShowLayerMenu={() => {}}
        layerVisibility={{ outline: false, events: true }}
        setLayerVisibility={setLayerVisibility}
      />
    );
    await user.click(screen.getByLabelText(/Toggle map layers menu/i));
    await user.click(screen.getByText('Hazards'));
    expect(setLayerVisibility).toHaveBeenCalled();
  });
});
