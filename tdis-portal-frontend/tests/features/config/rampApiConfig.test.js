/**
 * @fileoverview Unit tests for RAMP API URL helpers.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

describe('rampApiConfig', () => {
  const originalEnv = { ...import.meta.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.stubEnv('VITE_RAMP_API_ROOT', originalEnv.VITE_RAMP_API_ROOT ?? '');
    vi.stubEnv('VITE_RAMP_API_KEY', originalEnv.VITE_RAMP_API_KEY ?? '');
  });

  it('normalizes trailing slashes and builds URLs with search params', async () => {
    vi.stubEnv('VITE_RAMP_API_ROOT', 'https://ramp.example.com/api/');
    vi.stubEnv('VITE_RAMP_API_KEY', 'secret-key');
    const mod = await import('@/config/rampApiConfig');

    expect(mod.normalizeRampApiRoot('https://x.test///')).toBe('https://x.test');
    expect(mod.getRampApiRoot()).toBe('https://ramp.example.com/api');
    expect(mod.buildRampApiHeaders({ Accept: 'text/plain' })['X-API-Key']).toBe('secret-key');
    expect(mod.getRampApiUrl('/downloads/points-of-interest/schools/geojson', { county: '201' })).toBe(
      'https://ramp.example.com/api/downloads/points-of-interest/schools/geojson?county=201'
    );
    expect(mod.getRampApiUrl('relative', { county: '', city: null })).toContain('/relative');
  });

  it('throws when RAMP root is unset', async () => {
    vi.stubEnv('VITE_RAMP_API_ROOT', '');
    const mod = await import('@/config/rampApiConfig');
    expect(() => mod.getRampApiUrl('/x')).toThrow(/RAMP API not configured/);
  });
});
