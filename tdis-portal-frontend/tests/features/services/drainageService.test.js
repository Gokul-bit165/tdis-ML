import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearDrainageTileCache,
  getDrainagePoints,
  getDrainagePolygons,
  getDrainageSummary,
  tilesInView,
} from '@/services/drainageService';

const okJson = (body) => ({ ok: true, json: async () => body });
const manifest = {
  version: '20261117120000',
  cell_deg: 0.02,
  // tiles: x = floor(lon / 0.02), y = floor(lat / 0.02)
  cells: [
    [-4760, 1476],
    [-4759, 1476],
    [-4755, 1475],
  ],
};
const fc = (...categories) => ({
  type: 'FeatureCollection',
  features: categories.map((category) => ({ type: 'Feature', properties: { category } })),
});

describe('drainageService', () => {
  beforeEach(() => clearDrainageTileCache());
  afterEach(() => vi.restoreAllMocks());

  it('reads manifest.json without caching, so new uploads show up', async () => {
    global.fetch = vi.fn().mockResolvedValue(okJson(manifest));
    await getDrainageSummary();
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toMatch(/\/manifest\.json$/);
    expect(init.cache).toBe('no-store');
  });

  it('tags data files with the survey version', async () => {
    global.fetch = vi.fn().mockResolvedValue(okJson(fc('tire')));
    await getDrainagePoints(manifest);
    expect(global.fetch.mock.calls[0][0]).toMatch(/\/points\.geojson\?v=20261117120000$/);
  });

  it('picks only the outline tiles that overlap the view', () => {
    // A view around lon -95.19 / lat 29.53 touches tiles x=-4760..-4759, y=1476 only.
    expect(tilesInView(manifest, [-95.195, 29.525, -95.175, 29.535])).toEqual([
      [-4760, 1476],
      [-4759, 1476],
    ]);
    expect(tilesInView(manifest, [-90, 30, -89.9, 30.1])).toEqual([]);
  });

  it('merges the tiles in view and downloads each tile once', async () => {
    global.fetch = vi.fn((url) =>
      Promise.resolve(okJson(url.includes('-4760_1476') ? fc('tire') : fc('bank_erosion', 'tire')))
    );
    const view = [-95.195, 29.525, -95.175, 29.535];
    const first = await getDrainagePolygons(manifest, view);
    expect(first.features).toHaveLength(3);
    await getDrainagePolygons(manifest, view);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch.mock.calls.map((c) => c[0]).join(' ')).toContain(
      'polygons_-4760_1476.geojson?v=20261117120000'
    );
  });

  it('explains network or CORS failures instead of "Failed to fetch"', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(getDrainageSummary()).rejects.toThrow(/could not be loaded \(network or CORS\)/);
  });

  it('retries a tile that failed to download', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404, text: async () => 'BlobNotFound' })
      .mockResolvedValue(okJson(fc('tire')));
    const view = [-95.195, 29.525, -95.181, 29.535]; // one tile
    await expect(getDrainagePolygons(manifest, view)).rejects.toThrow(
      'Drainage data 404: BlobNotFound'
    );
    expect((await getDrainagePolygons(manifest, view)).features).toHaveLength(1);
  });
});
