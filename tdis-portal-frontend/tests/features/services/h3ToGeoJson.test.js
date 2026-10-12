/**
 * @fileoverview Unit tests for H3 record → GeoJSON conversion.
 * Feature: services
 */
import { describe, it, expect, vi } from 'vitest';
import { h3ToGeoJson } from '@/services/h3ToGeoJson';

const VALID_HEX = '862a10727ffffff';

describe('h3ToGeoJson', () => {
  it('drops records without hex_id and keeps valid cells', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const geojson = h3ToGeoJson([{ pop: 12 }, { hex_id: VALID_HEX, pop: 99 }]);
    expect(geojson.type).toBe('FeatureCollection');
    expect(geojson.features).toHaveLength(1);
    expect(geojson.features[0].properties.pop).toBe(99);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
