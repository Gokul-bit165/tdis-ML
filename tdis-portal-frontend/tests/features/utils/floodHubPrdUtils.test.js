import { describe, expect, it } from 'vitest';
import {
  buildGaugeHydrographFromFields,
  buildFloodHubGaugePanelModel,
  FLOOD_HUB_GAUGE_HYDROGRAPH_HOURS,
} from '../../../src/utils/floodHubPrdUtils';

describe('floodHubPrdUtils', () => {
  describe('buildGaugeHydrographFromFields', () => {
    it('returns null when peak and current are both null', () => {
      expect(
        buildGaugeHydrographFromFields({
          peak: null,
          current: null,
          warning: 1,
          danger: 2,
          extreme: 3,
        })
      ).toBeNull();
    });

    it('uses current at 0h and peak at 72h when both present', () => {
      const h = buildGaugeHydrographFromFields({
        peak: 10,
        current: 4,
        warning: 5,
        danger: 7,
        extreme: 9,
      });
      expect(h).toEqual({
        mode: 'legacy',
        hours: [0, FLOOD_HUB_GAUGE_HYDROGRAPH_HOURS],
        values: [4, 10],
        warning: 5,
        danger: 7,
        extreme: 9,
      });
    });

    it('duplicates the only available scalar to both endpoints', () => {
      expect(
        buildGaugeHydrographFromFields({
          peak: 8,
          current: null,
          warning: null,
          danger: null,
          extreme: null,
        })
      ).toEqual({
        mode: 'legacy',
        hours: [0, FLOOD_HUB_GAUGE_HYDROGRAPH_HOURS],
        values: [8, 8],
        warning: null,
        danger: null,
        extreme: null,
      });
      expect(
        buildGaugeHydrographFromFields({
          peak: null,
          current: 3,
          warning: null,
          danger: null,
          extreme: null,
        })
      ).toEqual({
        mode: 'legacy',
        hours: [0, FLOOD_HUB_GAUGE_HYDROGRAPH_HOURS],
        values: [3, 3],
        warning: null,
        danger: null,
        extreme: null,
      });
    });

    it('uses daily series when dischargeByDay has enough points', () => {
      const h = buildGaugeHydrographFromFields({
        peak: 99,
        current: 1,
        warning: 10,
        dischargeByDay: {
          dayOffsets: [-2, -1, 0, 1, 2, 3, 4, 5],
          values: [0.2, 0.5, 40, 2, 4, 3, 2, 2],
        },
      });
      expect(h?.mode).toBe('daily');
      expect(h?.nowDayIndex).toBe(2);
      expect(h?.values?.length).toBe(8);
    });

    it('prefers daily series even when peak and current are null', () => {
      const h = buildGaugeHydrographFromFields({
        peak: null,
        current: null,
        dischargeByDay: {
          dayOffsets: [-2, -1, 0, 1, 2, 3, 4, 5],
          values: [1, 2, 3, 4, 3, 2, 1, 1],
        },
      });
      expect(h?.mode).toBe('daily');
    });
  });

  describe('buildFloodHubGaugePanelModel', () => {
    it('fills lat/lon from map click when tile attributes have no coordinates', () => {
      const { fields } = buildFloodHubGaugePanelModel(
        { gauge_id: 'x', warning_threshold: '1' },
        { lng: -97.56458, lat: 26.497917 }
      );
      expect(fields.gaugeLongitude).toBeCloseTo(-97.56458, 5);
      expect(fields.gaugeLatitude).toBeCloseTo(26.497917, 5);
    });

    it('does not override tile lat/lon when both are present', () => {
      const { fields } = buildFloodHubGaugePanelModel(
        { gauge_id: 'x', latitude: '10', longitude: '20', warning_threshold: '1' },
        { lng: 99, lat: 88 }
      );
      expect(fields.gaugeLatitude).toBe(10);
      expect(fields.gaugeLongitude).toBe(20);
    });
  });
});
