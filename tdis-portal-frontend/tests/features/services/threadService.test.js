/**
 * @fileoverview Unit tests for threadService.submitQuery abort signal.
 * Feature: services
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { submitQuery } from '@/services/threadService';

const TEST_TOKEN = 'test-token';

describe('submitQuery', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('forwards an abort signal to fetch', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: null,
    });
    vi.stubGlobal('fetch', fetchMock);

    await submitQuery(TEST_TOKEN, 'hello', 'thread-1', { signal: controller.signal });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0];
    expect(options.signal).toBe(controller.signal);
    expect(options.headers.Authorization).toBe(`Bearer ${TEST_TOKEN}`);
  });
});
