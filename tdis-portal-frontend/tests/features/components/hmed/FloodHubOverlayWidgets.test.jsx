/**
 * @fileoverview Unit tests for hmed/FloodHubOverlayWidgets
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  FloodHubOverlaySwitch,
  FloodHubRiverineSection,
  RIVERINE_SEVERITY_LEGEND,
} from '@/components/hmed/FloodHubOverlayWidgets';

describe('RIVERINE_SEVERITY_LEGEND', () => {
  it('lists Extreme through Normal in map-tier order', () => {
    expect(RIVERINE_SEVERITY_LEGEND.map((row) => row.label)).toEqual([
      'Extreme',
      'Danger',
      'Warning',
      'No data',
      'Normal',
    ]);
  });
});

describe('FloodHubOverlaySwitch', () => {
  beforeEach(() => {
    window.gtag = vi.fn();
  });

  afterEach(() => {
    delete window.gtag;
  });

  it('exposes checked state and uses labelledBy when ariaLabel is omitted', () => {
    render(
      <>
        <span id="floods-label">Floods (riverine)</span>
        <FloodHubOverlaySwitch checked={false} labelledBy="floods-label" onChange={vi.fn()} />
      </>
    );

    const sw = screen.getByRole('switch');
    expect(sw).toHaveAttribute('aria-checked', 'false');
    expect(sw).toHaveAttribute('aria-labelledby', 'floods-label');
    expect(sw).not.toHaveAttribute('aria-label');
  });

  it('prefers ariaLabel over labelledBy', () => {
    render(
      <FloodHubOverlaySwitch
        checked
        labelledBy="ignored"
        ariaLabel="Show riverine gauges below warning threshold"
        onChange={vi.fn()}
      />
    );

    const sw = screen.getByRole('switch', {
      name: 'Show riverine gauges below warning threshold',
    });
    expect(sw).toHaveAttribute('aria-checked', 'true');
    expect(sw).not.toHaveAttribute('aria-labelledby');
  });

  it('tracks layer_toggle and reports the next checked value', async () => {
    const onChange = vi.fn();
    render(
      <FloodHubOverlaySwitch
        checked={false}
        ariaLabel="Floods (riverine)"
        onChange={onChange}
      />
    );

    await userEvent.click(screen.getByRole('switch'));

    expect(onChange).toHaveBeenCalledWith(true);
    expect(window.gtag).toHaveBeenCalledWith(
      'event',
      'layer_toggle',
      expect.objectContaining({
        layer_name: 'Floods (riverine)',
        on: true,
        tab: 'hmed',
      })
    );
  });

  it('falls back to flood_hub_overlay when neither label is provided', async () => {
    const onChange = vi.fn();
    render(<FloodHubOverlaySwitch checked onChange={onChange} />);

    await userEvent.click(screen.getByRole('switch'));

    expect(onChange).toHaveBeenCalledWith(false);
    expect(window.gtag).toHaveBeenCalledWith(
      'event',
      'layer_toggle',
      expect.objectContaining({
        layer_name: 'flood_hub_overlay',
        on: false,
        tab: 'hmed',
      })
    );
  });

  it('uses labelledBy as the analytics layer name when ariaLabel is absent', async () => {
    render(<FloodHubOverlaySwitch checked={false} labelledBy="flood-hub-main-floods" onChange={vi.fn()} />);

    await userEvent.click(screen.getByRole('switch'));

    expect(window.gtag).toHaveBeenCalledWith(
      'event',
      'layer_toggle',
      expect.objectContaining({
        layer_name: 'flood-hub-main-floods',
        on: true,
      })
    );
  });

  it('does not call onChange when disabled', () => {
    const onChange = vi.fn();
    render(<FloodHubOverlaySwitch checked={false} disabled onChange={onChange} />);

    const sw = screen.getByRole('switch');
    expect(sw).toBeDisabled();
    fireEvent.click(sw);

    expect(onChange).not.toHaveBeenCalled();
    expect(window.gtag).not.toHaveBeenCalled();
  });
});

describe('FloodHubRiverineSection', () => {
  beforeEach(() => {
    window.gtag = vi.fn();
  });

  afterEach(() => {
    delete window.gtag;
  });

  it('hides the severity legend until riverine floods are on', () => {
    render(<FloodHubRiverineSection toggles={{ gauges: false }} setToggles={vi.fn()} />);

    expect(screen.getByText('Riverine floods')).toBeInTheDocument();
    expect(screen.getByText('Floods (riverine)')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Riverine floods severity' })).not.toBeInTheDocument();
    expect(screen.queryByText('Expected severity')).not.toBeInTheDocument();
  });

  it('turns gauges on and patches setToggles', async () => {
    const setToggles = vi.fn();
    render(<FloodHubRiverineSection toggles={{ gauges: false }} setToggles={setToggles} />);

    await userEvent.click(screen.getByRole('switch'));

    expect(setToggles).toHaveBeenCalledWith({ gauges: true });
  });

  it('lists expected-severity rows and a Normal-tier overlay switch when gauges are on', () => {
    render(
      <FloodHubRiverineSection
        toggles={{ gauges: true, riverineShowNormal: true }}
        setToggles={vi.fn()}
      />
    );

    expect(screen.getByRole('region', { name: 'Riverine floods severity' })).toBeInTheDocument();
    expect(screen.getByText('Expected severity')).toBeInTheDocument();
    expect(screen.getByText('Extreme')).toBeInTheDocument();
    expect(screen.getByText('Danger')).toBeInTheDocument();
    expect(screen.getByText('Warning')).toBeInTheDocument();
    expect(screen.getByText('No data')).toBeInTheDocument();
    expect(screen.getByText('Normal')).toBeInTheDocument();

    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(3);
    expect(
      screen.getByRole('switch', { name: 'Show riverine gauges below warning threshold' })
    ).toHaveAttribute('aria-checked', 'true');
  });

  it('treats missing riverineShowNormal as shown (not false)', () => {
    render(<FloodHubRiverineSection toggles={{ gauges: true }} setToggles={vi.fn()} />);

    expect(
      screen.getByRole('switch', { name: 'Show riverine gauges below warning threshold' })
    ).toHaveAttribute('aria-checked', 'true');
  });

  it('turns off Normal-tier gauges when the inner switch is clicked', async () => {
    const setToggles = vi.fn();
    render(
      <FloodHubRiverineSection
        toggles={{ gauges: true, riverineShowNormal: true }}
        setToggles={setToggles}
      />
    );

    await userEvent.click(
      screen.getByRole('switch', { name: 'Show riverine gauges below warning threshold' })
    );

    expect(setToggles).toHaveBeenCalledWith({ riverineShowNormal: false });
  });

  it('marks the Normal switch unchecked when riverineShowNormal is false', () => {
    render(
      <FloodHubRiverineSection
        toggles={{ gauges: true, riverineShowNormal: false }}
        setToggles={vi.fn()}
      />
    );

    expect(
      screen.getByRole('switch', { name: 'Show riverine gauges below warning threshold' })
    ).toHaveAttribute('aria-checked', 'false');
  });

  it('hides extended coverage until riverine floods are on', () => {
    render(<FloodHubRiverineSection toggles={{ gauges: false }} setToggles={vi.fn()} />);

    expect(screen.queryByRole('region', { name: 'Extended coverage' })).not.toBeInTheDocument();
    expect(screen.queryByText('Lower-confidence gauges only')).not.toBeInTheDocument();
  });

  it('defaults the lower-confidence switch to off when the toggle is unset', () => {
    render(<FloodHubRiverineSection toggles={{ gauges: true }} setToggles={vi.fn()} />);

    expect(screen.getByRole('region', { name: 'Extended coverage' })).toBeInTheDocument();
    expect(screen.getByText('Extended coverage')).toBeInTheDocument();
    expect(
      screen.getByRole('switch', { name: 'Lower-confidence gauges only' })
    ).toHaveAttribute('aria-checked', 'false');
  });

  it('marks the lower-confidence switch checked when riverineLowerConfidenceOnly is true', () => {
    render(
      <FloodHubRiverineSection
        toggles={{ gauges: true, riverineLowerConfidenceOnly: true }}
        setToggles={vi.fn()}
      />
    );

    expect(
      screen.getByRole('switch', { name: 'Lower-confidence gauges only' })
    ).toHaveAttribute('aria-checked', 'true');
  });

  it('opens the disclaimer dialog when turning lower-confidence gauges on', async () => {
    const setToggles = vi.fn();
    render(
      <FloodHubRiverineSection
        toggles={{ gauges: true, riverineLowerConfidenceOnly: false }}
        setToggles={setToggles}
      />
    );

    await userEvent.click(screen.getByRole('switch', { name: 'Lower-confidence gauges only' }));

    expect(setToggles).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        'This information may be less accurate, and intended for expert and research use only'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'I accept' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('enables lower-confidence gauges only after accepting the disclaimer', async () => {
    const setToggles = vi.fn();
    render(
      <FloodHubRiverineSection
        toggles={{ gauges: true, riverineLowerConfidenceOnly: false }}
        setToggles={setToggles}
      />
    );

    await userEvent.click(screen.getByRole('switch', { name: 'Lower-confidence gauges only' }));
    await userEvent.click(screen.getByRole('button', { name: 'I accept' }));

    expect(setToggles).toHaveBeenCalledWith({ riverineLowerConfidenceOnly: true });
    expect(window.gtag).toHaveBeenCalledWith(
      'event',
      'layer_toggle',
      expect.objectContaining({
        layer_name: 'Lower-confidence gauges only',
        on: true,
        tab: 'hmed',
      })
    );
  });

  it('does not enable lower-confidence gauges when the disclaimer is cancelled', async () => {
    const setToggles = vi.fn();
    render(
      <FloodHubRiverineSection
        toggles={{ gauges: true, riverineLowerConfidenceOnly: false }}
        setToggles={setToggles}
      />
    );

    await userEvent.click(screen.getByRole('switch', { name: 'Lower-confidence gauges only' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(setToggles).not.toHaveBeenCalled();
    expect(
      screen.queryByText(
        'This information may be less accurate, and intended for expert and research use only'
      )
    ).not.toBeInTheDocument();
  });

  it('turns lower-confidence gauges off without showing the disclaimer', async () => {
    const setToggles = vi.fn();
    render(
      <FloodHubRiverineSection
        toggles={{ gauges: true, riverineLowerConfidenceOnly: true }}
        setToggles={setToggles}
      />
    );

    await userEvent.click(screen.getByRole('switch', { name: 'Lower-confidence gauges only' }));

    expect(setToggles).toHaveBeenCalledWith({ riverineLowerConfidenceOnly: false });
    expect(
      screen.queryByText(
        'This information may be less accurate, and intended for expert and research use only'
      )
    ).not.toBeInTheDocument();
  });
});
