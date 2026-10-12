/**
 * @fileoverview Unit tests for hazard map API base resolution.
 * Feature: config
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getHazardMapApiBase,
  TDIS_AI_HAZARD_API_ORIGIN,
} from '@/config/hazardMapConfig';

const LOCAL_API = 'http://127.0.0.1:8000';

describe('getHazardMapApiBase', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('falls back to the TDIS AI host when no override is set', () => {
    vi.stubEnv('VITE_HAZARD_MAP_API_BASE', '');
    vi.stubEnv('VITE_AI_API_URL', '');

    expect(getHazardMapApiBase()).toBe(TDIS_AI_HAZARD_API_ORIGIN);
  });

  it('accepts a loopback http override for local API testing', () => {
    vi.stubEnv('VITE_HAZARD_MAP_API_BASE', `${LOCAL_API}/`);

    expect(getHazardMapApiBase()).toBe(LOCAL_API);
  });

  it('accepts localhost as well as 127.0.0.1', () => {
    vi.stubEnv('VITE_HAZARD_MAP_API_BASE', 'http://localhost:8000');

    expect(getHazardMapApiBase()).toBe('http://localhost:8000');
  });

  it('prefers the dedicated override over VITE_AI_API_URL', () => {
    vi.stubEnv('VITE_HAZARD_MAP_API_BASE', LOCAL_API);
    vi.stubEnv('VITE_AI_API_URL', 'https://api-tdis-ai.dev.cloud.tdis.io');

    expect(getHazardMapApiBase()).toBe(LOCAL_API);
  });

  it('ignores non-loopback http and unresolved pipeline placeholders', () => {
    vi.stubEnv('VITE_HAZARD_MAP_API_BASE', 'http://example.com');
    vi.stubEnv('VITE_AI_API_URL', 'https://$(vite_ai_api_url)');

    expect(getHazardMapApiBase()).toBe(TDIS_AI_HAZARD_API_ORIGIN);
  });

  it('uses VITE_AI_API_URL when no dedicated override exists', () => {
    vi.stubEnv('VITE_HAZARD_MAP_API_BASE', '');
    vi.stubEnv('VITE_AI_API_URL', LOCAL_API);

    expect(getHazardMapApiBase()).toBe(LOCAL_API);
  });
});
