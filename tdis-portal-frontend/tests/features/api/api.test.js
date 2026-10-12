/**
 * @fileoverview Unit tests for services/api (RTK Query)
 * Feature: api
 */
import { describe, it, expect } from 'vitest';
import { api, useSendEmailMutation, useSubscribeUserMutation } from '@/services/api';

describe('api', () => {
  it('has reducerPath api', () => {
    expect(api.reducerPath).toBe('api');
  });

  it('has endpoints sendEmail and subscribeUser', () => {
    expect(api.endpoints.sendEmail).toBeDefined();
    expect(api.endpoints.subscribeUser).toBeDefined();
  });

  it('sendEmail endpoint has initiate for mutations', () => {
    const endpoint = api.endpoints.sendEmail;
    expect(typeof endpoint.initiate).toBe('function');
  });

  it('subscribeUser endpoint has initiate for mutations', () => {
    const endpoint = api.endpoints.subscribeUser;
    expect(typeof endpoint.initiate).toBe('function');
  });

  it('exports useSendEmailMutation hook', () => {
    expect(typeof useSendEmailMutation).toBe('function');
  });

  it('exports useSubscribeUserMutation hook', () => {
    expect(typeof useSubscribeUserMutation).toBe('function');
  });
});
