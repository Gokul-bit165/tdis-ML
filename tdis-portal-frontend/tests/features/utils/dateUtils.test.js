/**
 * @fileoverview Unit tests for utils/dateUtils
 * Feature: utils
 */
import { describe, it, expect } from 'vitest';
import { getDateRangeForLastTwoDays, get24HourRollingWindow } from '@/utils/dateUtils';

describe('utils/dateUtils', () => {
  describe('getDateRangeForLastTwoDays', () => {
    it('returns array of two date strings in YYYY-MM-DD format', () => {
      const result = getDateRangeForLastTwoDays();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result[1]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('second element is today and first is yesterday', () => {
      const result = getDateRangeForLastTwoDays();
      const today = new Date().toISOString().split('T')[0];
      expect(result[1]).toBe(today);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(result[0]).toBe(yesterday.toISOString().split('T')[0]);
    });
  });

  describe('get24HourRollingWindow', () => {
    it('returns array of two ISO timestamp strings', () => {
      const result = get24HourRollingWindow();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(() => new Date(result[0])).not.toThrow();
      expect(() => new Date(result[1])).not.toThrow();
    });

    it('first timestamp is before second by ~24 hours', () => {
      const [start, end] = get24HourRollingWindow();
      const diff = new Date(end) - new Date(start);
      const twentyFourHours = 24 * 60 * 60 * 1000;
      expect(Math.abs(diff - twentyFourHours)).toBeLessThan(5000);
    });
  });
});
