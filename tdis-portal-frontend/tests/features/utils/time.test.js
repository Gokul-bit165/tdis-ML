/**
 * @fileoverview Unit tests for utils/time
 * Feature: utils
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { DateTime } from 'luxon';
import { formatForPopup, getTimeAgo, formatEventDate } from '@/utils/time';

describe('utils/time', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('formatForPopup', () => {
    it('returns N/A for null/undefined', () => {
      expect(formatForPopup(null)).toBe('N/A');
      expect(formatForPopup(undefined)).toBe('N/A');
    });

    it('returns N/A for empty string', () => {
      expect(formatForPopup('')).toBe('N/A');
    });

    it('formats valid ISO timestamp', () => {
      const result = formatForPopup('2025-01-15T12:00:00.000Z');
      expect(result).not.toBe('N/A');
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });

    it('appends Z when not present for UTC interpretation', () => {
      const result = formatForPopup('2025-01-15T12:00:00.000');
      expect(result).not.toBe('N/A');
    });

    it('returns N/A for invalid timestamps', () => {
      expect(formatForPopup('not-a-timestamp')).toBe('N/A');
    });

    it('returns N/A when DateTime parsing throws', () => {
      vi.spyOn(DateTime, 'fromISO').mockImplementation(() => {
        throw new Error('parse failed');
      });
      expect(formatForPopup('2025-01-15T12:00:00.000Z')).toBe('N/A');
    });
  });

  describe('getTimeAgo', () => {
    it('returns empty string for null/undefined', () => {
      expect(getTimeAgo(null)).toBe('');
      expect(getTimeAgo(undefined)).toBe('');
    });

    it('returns "Just now" for recent date', () => {
      const now = new Date();
      expect(getTimeAgo(now)).toBe('Just now');
    });

    it('returns "X minutes ago" for minutes in the past', () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      expect(getTimeAgo(fiveMinAgo)).toBe('5 minutes ago');
    });

    it('returns "X hour(s) ago" for hours in the past', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const result = getTimeAgo(twoHoursAgo);
      expect(result).toMatch(/\d+ hour(s)? ago/);
    });

    it('handles ISO string', () => {
      const past = new Date(Date.now() - 3 * 60 * 1000).toISOString();
      expect(getTimeAgo(past)).toMatch(/minute(s)? ago/);
    });
  });

  describe('formatEventDate', () => {
    it('returns N/A for null/undefined', () => {
      expect(formatEventDate(null)).toBe('N/A');
      expect(formatEventDate(undefined)).toBe('N/A');
    });

    it('formats valid timestamp', () => {
      const result = formatEventDate('2025-12-04T20:45:33.653068');
      expect(result).not.toBe('N/A');
      expect(result).toMatch(/Dec 4, 2025/);
      expect(result).toContain('CST');
    });

    it('returns N/A for invalid timestamps', () => {
      expect(formatEventDate('not-a-timestamp')).toBe('N/A');
    });

    it('returns N/A when DateTime parsing throws', () => {
      vi.spyOn(DateTime, 'fromISO').mockImplementation(() => {
        throw new Error('parse failed');
      });
      expect(formatEventDate('2025-12-04T20:45:33.653068')).toBe('N/A');
    });
  });
});
