/**
 * @fileoverview hmedLtsCountyUtils — search filter and LTS level parsing
 */
import { describe, it, expect } from 'vitest';
import {
  filterLtsCountiesBySearch,
  parseLtsLevel,
  getLtsSeverityChipStyle,
  ltsLevelToDisplayLabel,
  normalizeMvtLtsLabel,
} from '@/utils/hmedLtsCountyUtils';

const MODERATE_LABEL = 'Moderate';
const POTENTIALLY_HIGH_LABEL = 'Potentially High';

const mockLtsConfig = {
  severityLevels: [
    { value: 1, label: 'Low', color: '#22c55e' },
    { value: 3, label: 'High', color: '#f97316' },
  ],
};

describe('hmedLtsCountyUtils', () => {
  describe('filterLtsCountiesBySearch', () => {
    const rows = [
      { county: 'Travis County', countyfips: '48453' },
      { county: 'Bexar County', countyfips: '48029' },
    ];

    it('returns all when query empty', () => {
      expect(filterLtsCountiesBySearch(rows, '')).toEqual(rows);
      expect(filterLtsCountiesBySearch(rows, '   ')).toEqual(rows);
    });

    it('filters by county name case-insensitive', () => {
      expect(filterLtsCountiesBySearch(rows, 'travis')).toEqual([rows[0]]);
    });

    it('filters by FIPS substring', () => {
      expect(filterLtsCountiesBySearch(rows, '029')).toEqual([rows[1]]);
    });

    it('returns empty array for empty input', () => {
      expect(filterLtsCountiesBySearch(null, 'x')).toEqual([]);
      expect(filterLtsCountiesBySearch([], 'x')).toEqual([]);
    });
  });

  describe('parseLtsLevel', () => {
    it('parses numeric strings', () => {
      expect(parseLtsLevel('3')).toBe(3);
    });

    it('returns null for out of range', () => {
      expect(parseLtsLevel(0)).toBeNull();
      expect(parseLtsLevel(6)).toBeNull();
      expect(parseLtsLevel('')).toBeNull();
    });
  });

  describe('ltsLevelToDisplayLabel', () => {
    it('maps legacy 1–2 and 3 to Moderate; 4–5 to Potentially High / Potentially Very High', () => {
      expect(ltsLevelToDisplayLabel(1)).toBe(MODERATE_LABEL);
      expect(ltsLevelToDisplayLabel(2)).toBe(MODERATE_LABEL);
      expect(ltsLevelToDisplayLabel(3)).toBe(MODERATE_LABEL);
      expect(ltsLevelToDisplayLabel('4')).toBe(POTENTIALLY_HIGH_LABEL);
      expect(ltsLevelToDisplayLabel(5)).toBe('Potentially Very High');
    });
  });

  describe('normalizeMvtLtsLabel', () => {
    it('replaces string None with level-based label', () => {
      expect(normalizeMvtLtsLabel('None', 1)).toBe(MODERATE_LABEL);
      expect(normalizeMvtLtsLabel('none', 2)).toBe(MODERATE_LABEL);
    });

    it('maps legacy tier words using numeric level (trust level for inconsistent MVT)', () => {
      expect(normalizeMvtLtsLabel('Very Low', 4)).toBe(POTENTIALLY_HIGH_LABEL);
      expect(normalizeMvtLtsLabel('Medium', 3)).toBe(MODERATE_LABEL);
    });

    it('maps deprecated tier words to level-based label (historical MVT text)', () => {
      expect(normalizeMvtLtsLabel('Low', 2)).toBe(MODERATE_LABEL);
    });

    it('maps legacy High / Very High MVT strings to current tier names when level matches', () => {
      expect(normalizeMvtLtsLabel('High', 4)).toBe(POTENTIALLY_HIGH_LABEL);
      expect(normalizeMvtLtsLabel('Very High', 5)).toBe('Potentially Very High');
    });
  });

  describe('getLtsSeverityChipStyle', () => {
    it('matches config by level', () => {
      const s = getLtsSeverityChipStyle(mockLtsConfig, 3);
      expect(s.label).toBe('High');
      expect(s.text).toBe('#f97316');
    });

    it('uses chipText when set (contrast on pale chip fill)', () => {
      const cfg = {
        severityLevels: [
          { value: 3, color: '#6366f1', label: MODERATE_LABEL, chipText: '#312e81' },
        ],
      };
      const s = getLtsSeverityChipStyle(cfg, 3);
      expect(s.text).toBe('#312e81');
    });

    it('legacy numeric 1–2 uses Moderate chip styling', () => {
      const cfg = {
        severityLevels: [
          { value: 3, color: '#6366f1', label: MODERATE_LABEL, chipText: '#312e81' },
          { value: 4, color: '#ca8a04', label: POTENTIALLY_HIGH_LABEL, chipText: '#713f12' },
        ],
      };
      const s = getLtsSeverityChipStyle(cfg, 1);
      expect(s.label).toBe(MODERATE_LABEL);
      expect(s.text).toBe('#312e81');
    });

    it('falls back when unknown level', () => {
      const s = getLtsSeverityChipStyle(mockLtsConfig, 99);
      expect(s.label).toBe('—');
    });
  });
});
