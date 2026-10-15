import { describe, it, expect } from 'vitest';
import {
  DAMAGE_CLASSES,
  NOT_ASSESSED_CLASS,
  getDamageClassInfo,
  computeDamagedShare,
  computeSevereShare,
  DAMAGED_SHARE_EXPRESSION,
  HEATMAP_K,
  HEATMAP_RADIUS,
} from '@/config/damageAssessmentConfig';

describe('damageAssessmentConfig', () => {
  it('maps five codes to the five exact labels and colours', () => {
    expect(DAMAGE_CLASSES[0]).toEqual({
      code: 0,
      label: 'Undamaged',
      color: '#22A65A',
    });
    expect(DAMAGE_CLASSES[1]).toEqual({
      code: 1,
      label: 'Partial Roof Damage',
      color: '#F5D547',
    });
    expect(DAMAGE_CLASSES[2]).toEqual({
      code: 2,
      label: 'Total Roof Damage',
      color: '#F28C28',
    });
    expect(DAMAGE_CLASSES[3]).toEqual({
      code: 3,
      label: 'Partial Structural Collapse',
      color: '#E44747',
    });
    expect(DAMAGE_CLASSES[4]).toEqual({
      code: 4,
      label: 'Total Structural Collapse',
      color: '#991F36',
    });

    for (let c = 0; c <= 4; c++) {
      const info = getDamageClassInfo(c);
      expect(info.label).toBe(DAMAGE_CLASSES[c].label);
      expect(info.color).toBe(DAMAGE_CLASSES[c].color);
    }
  });

  it('maps unknown code or null/undefined to grey Not Assessed', () => {
    expect(NOT_ASSESSED_CLASS.color).toBe('#9CA3AF');
    expect(NOT_ASSESSED_CLASS.label).toBe('Not Assessed');

    expect(getDamageClassInfo(null)).toEqual(NOT_ASSESSED_CLASS);
    expect(getDamageClassInfo(undefined)).toEqual(NOT_ASSESSED_CLASS);
    expect(getDamageClassInfo(-1)).toEqual(NOT_ASSESSED_CLASS);
    expect(getDamageClassInfo(99)).toEqual(NOT_ASSESSED_CLASS);
    expect(getDamageClassInfo('unknown')).toEqual(NOT_ASSESSED_CLASS);
  });

  it('the share expression returns -1 when na is 0', () => {
    // Pure function evaluation
    expect(computeDamagedShare(0, 0)).toBe(-1);
    expect(computeDamagedShare(null, 0)).toBe(-1);
    expect(computeDamagedShare(-5, 0)).toBe(-1);
    expect(computeSevereShare(0, 0, 0)).toBe(-1);

    // When na > 0, calculates share accurately
    expect(computeDamagedShare(100, 70)).toBeCloseTo(0.3, 5);
    expect(computeSevereShare(100, 5, 5)).toBeCloseTo(0.1, 5);

    // Mapbox GL expression structure
    // ['case', ['>', ['get', 'na'], 0], ['/', ['-', ['get', 'na'], ['get', 'c0']], ['get', 'na']], -1]
    expect(DAMAGED_SHARE_EXPRESSION[0]).toBe('case');
    expect(DAMAGED_SHARE_EXPRESSION[DAMAGED_SHARE_EXPRESSION.length - 1]).toBe(-1);
  });

  it('contains calibrated heatmap constants', () => {
    expect(HEATMAP_K).toBe(6e-9);
    expect(HEATMAP_RADIUS).toBe(24);
  });
});
