/**
 * @fileoverview Unit tests for hooks/use-mobile
 * Feature: hooks
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useIsMobile } from '@/hooks/use-mobile';

describe('hooks/use-mobile', () => {
  let matchMediaMock;

  beforeEach(() => {
    matchMediaMock = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    window.matchMedia = matchMediaMock;
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
  });

  it('returns a boolean', () => {
    const { result } = renderHook(() => useIsMobile());
    expect(typeof result.current).toBe('boolean');
  });

  it('uses matchMedia with mobile breakpoint', () => {
    renderHook(() => useIsMobile());
    expect(matchMediaMock).toHaveBeenCalledWith('(max-width: 767px)');
  });

  it('returns false when innerWidth is desktop', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('returns true when innerWidth is below breakpoint', () => {
    Object.defineProperty(window, 'innerWidth', { value: 400, writable: true });
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });
});
