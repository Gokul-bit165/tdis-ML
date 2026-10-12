/**
 * @fileoverview Unit tests for portalApiConfig
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getPortalApiBaseUrl,
  getPortalApiUrl,
  buildPortalApiHeaders,
} from '@/config/portalApiConfig';

describe('portalApiConfig', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_URL', 'https://api.example.com/api/v1');
    vi.stubEnv('VITE_EVENTS_API_URL', '');
    vi.stubEnv('VITE_EVENTS_API_KEY', 'test-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses VITE_API_URL as portal base', () => {
    expect(getPortalApiBaseUrl()).toBe('https://api.example.com/api/v1');
  });

  it('builds paths under portal base', () => {
    expect(getPortalApiUrl('/events/', { page: 1 })).toBe(
      'https://api.example.com/api/v1/events/?page=1'
    );
  });

  it('adds X-API-Key when configured', () => {
    expect(buildPortalApiHeaders()['X-API-Key']).toBe('test-key');
  });
});
