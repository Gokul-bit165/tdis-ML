/**
 * @fileoverview Unit tests for lib/utils (cn)
 * Feature: lib
 */
import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('lib/utils', () => {
  describe('cn', () => {
    it('merges class names', () => {
      expect(cn('foo', 'bar')).toBe('foo bar');
    });

    it('handles conditional classes', () => {
      expect(cn('base', undefined, 'visible')).toBe('base visible');
    });

    it('merges tailwind classes correctly (later overrides)', () => {
      const result = cn('px-2 py-1', 'px-4');
      expect(result).toContain('py-1');
      expect(result).toContain('px-4');
    });

    it('handles undefined and null', () => {
      expect(cn('a', undefined, null, 'b')).toBe('a b');
    });

    it('handles array of classes', () => {
      expect(cn(['a', 'b'], 'c')).toBe('a b c');
    });
  });
});
