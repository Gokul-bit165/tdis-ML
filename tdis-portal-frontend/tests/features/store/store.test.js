/**
 * @fileoverview Unit tests for store
 * Feature: store
 */
import { describe, it, expect } from 'vitest';
import { store } from '@/store';

describe('store', () => {
  it('has getState', () => {
    expect(store.getState).toBeDefined();
    expect(typeof store.getState).toBe('function');
  });

  it('has dispatch', () => {
    expect(store.dispatch).toBeDefined();
    expect(typeof store.dispatch).toBe('function');
  });

  it('initial state includes api reducer', () => {
    const state = store.getState();
    expect(state).toHaveProperty('api');
  });

  it('dispatch works', () => {
    const action = { type: '@@INIT' };
    expect(() => store.dispatch(action)).not.toThrow();
  });
});
