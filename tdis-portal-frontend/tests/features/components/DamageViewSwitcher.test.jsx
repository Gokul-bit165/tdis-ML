import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DamageViewSwitcher from '@/components/damage/DamageViewSwitcher';
import { DAMAGE_VIEWS } from '@/config/damageAssessmentConfig';

describe('DamageViewSwitcher', () => {
  it('renders radiogroup with three view options and correct roles', () => {
    const onViewChange = vi.fn();
    render(
      <DamageViewSwitcher
        activeView={DAMAGE_VIEWS.H3}
        onViewChange={onViewChange}
        isLoadingTiles={false}
      />
    );

    const group = screen.getByRole('radiogroup', { name: /Damage map view/i });
    expect(group).toBeInTheDocument();

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);

    expect(screen.getByRole('radio', { name: 'H3 Aggregation' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(screen.getByRole('radio', { name: 'Building Damage' })).toHaveAttribute(
      'aria-checked',
      'false'
    );
    expect(screen.getByRole('radio', { name: 'Building Density' })).toHaveAttribute(
      'aria-checked',
      'false'
    );
  });

  it('handles click to change view', () => {
    const onViewChange = vi.fn();
    render(
      <DamageViewSwitcher
        activeView={DAMAGE_VIEWS.H3}
        onViewChange={onViewChange}
      />
    );

    const bldgRadio = screen.getByRole('radio', { name: 'Building Damage' });
    fireEvent.click(bldgRadio);
    expect(onViewChange).toHaveBeenCalledWith(DAMAGE_VIEWS.BUILDINGS);
  });

  it('navigates with arrow keys (right/down moves next, left/up moves previous)', () => {
    const onViewChange = vi.fn();
    render(
      <DamageViewSwitcher
        activeView={DAMAGE_VIEWS.H3}
        onViewChange={onViewChange}
      />
    );

    const h3Radio = screen.getByRole('radio', { name: 'H3 Aggregation' });
    h3Radio.focus();

    // Arrow right -> moves to buildings (index 1)
    fireEvent.keyDown(h3Radio, { key: 'ArrowRight' });
    expect(onViewChange).toHaveBeenCalledWith(DAMAGE_VIEWS.BUILDINGS);

    // Arrow left on first item -> wraps to density (index 2)
    fireEvent.keyDown(h3Radio, { key: 'ArrowLeft' });
    expect(onViewChange).toHaveBeenCalledWith(DAMAGE_VIEWS.DENSITY);
  });

  it('shows loading spinner when tiles are loading on active button', () => {
    const { container } = render(
      <DamageViewSwitcher
        activeView={DAMAGE_VIEWS.H3}
        onViewChange={() => {}}
        isLoadingTiles={true}
      />
    );

    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });
});
