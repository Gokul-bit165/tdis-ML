import { describe, it, expect } from 'vitest';
import {
  parseLtsHexCount,
  formatLtsHexCount,
  extractLtsHexExposure,
  buildLtsHexPopupHtml,
  buildLtsHexExposureSectionHtml,
} from '../../../src/utils/ltsHexPopupUtils';

describe('ltsHexPopupUtils', () => {
  it('parseLtsHexCount handles text DB values', () => {
    expect(parseLtsHexCount('42')).toBe(42);
    expect(parseLtsHexCount('None')).toBe(null);
    expect(parseLtsHexCount(null)).toBe(null);
  });

  it('extractLtsHexExposure reads structure columns from MVT props', () => {
    const exp = extractLtsHexExposure(
      {
        h3_l10_id: '604763433853ffff',
        hsi_peak: '1.25',
        total_structures: '120',
        total_residentialstructures: '80',
        total_commercial_structures: '40',
        hospital_count: '1',
        grocery_count: '2',
        emergency_facility_count: '0',
        fetched_at: '2024-06-01T12:00:00Z',
      },
      10
    );
    expect(exp.h3Id).toBe('604763433853ffff');
    expect(exp.hsiPeak).toBeCloseTo(1.25, 3);
    expect(exp.totalStructures).toBe(120);
    expect(exp.buildings[0]).toEqual({ label: 'Residential', value: 80 });
    expect(exp.hospitalCount).toBe(1);
    expect(exp.hasExposure).toBe(true);
  });

  it('buildLtsHexPopupHtml shows full labels without truncation', () => {
    const html = buildLtsHexPopupHtml(
      {
        lts_level: '4',
        lts_label: 'Potentially High',
        risk_zone: '3',
        peak_start_time: '2024-06-01T12:00:00Z',
        peak_end_time: '2024-06-02T06:00:00Z',
        total_structures: '9',
        total_residentialstructures: '4',
        total_agriculture_structures: '5',
        hospital_count: '0',
        grocery_count: '0',
        emergency_facility_count: '0',
        h3_l10_id: '604763433853ffff',
        fetched_at: '2024-05-15T22:00:00Z',
      },
      10
    );
    expect(html).toContain('lts-hex-popup');
    expect(html).toContain('Potentially High');
    expect(html).toContain('Level 4');
    expect(html).toContain('604763433853ffff');
    expect(html).toContain('Residential');
    expect(html).toContain('Emergency facilities');
    expect(html).not.toContain('…');
  });

  it('buildLtsHexExposureSectionHtml remains available for slice mode', () => {
    const html = buildLtsHexExposureSectionHtml(
      { total_structures: '5', total_residentialstructures: '5' },
      10
    );
    expect(html).toContain('lts-hex-popup--slice');
    expect(html).toContain('Total structures');
  });

  it('formatLtsHexCount uses em dash for missing', () => {
    expect(formatLtsHexCount(null)).toBe('—');
    expect(formatLtsHexCount(1000)).toBe('1,000');
  });
});
