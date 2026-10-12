/**
 * @fileoverview Unit tests for services/apiClient
 * Feature: services
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getEvents, getCountsByType, getLatestEndTime } from '@/services/apiClient';

const THROWS_WHEN_BASE_URL_NOT_CONFIGURED = 'throws when BASE_URL is not configured';
const START_DATE = '2025-01-01';
const END_DATE = '2025-01-02';

describe('services/apiClient', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('getEvents', () => {
    it(THROWS_WHEN_BASE_URL_NOT_CONFIGURED, async () => {
      await expect(getEvents(START_DATE, END_DATE)).rejects.toThrow();
    });
  });

  describe('getCountsByType', () => {
    it(THROWS_WHEN_BASE_URL_NOT_CONFIGURED, async () => {
      await expect(getCountsByType(START_DATE, END_DATE)).rejects.toThrow();
    });
  });

  describe('getLatestEndTime', () => {
    it(THROWS_WHEN_BASE_URL_NOT_CONFIGURED, async () => {
      await expect(getLatestEndTime()).rejects.toThrow();
    });
  });
});
