/**
 * @fileoverview Unit tests for assistant chat stream helpers.
 * Feature: services
 */
import { describe, it, expect, vi } from 'vitest';
import {
  segmentsFromOrchestratorResponse,
  isAbortError,
  clearStreamingFlag,
  updateTurn,
  markMapTurn,
  ingestPayloadEvents,
  publishPartialResponse,
  consumeAssistantStream,
  finalizeAssistantTurn,
  reportAssistantError,
} from '@/services/assistantChatStream';
import { createStreamingMapAccumulator } from '@/services/streamingMapAccumulator';
import { PortalApiError } from '@/services/threadService';
import { coalesceStreamEventsForUi } from '@/services/aiAssistantService';
import * as orchestrator from '@/services/parseOrchestratorResponse';

const TURN_ID = 'turn-1';
const HEX_A = '862a10727ffffff';
const CHAT_FINAL = 'chat.final';

function mockStreamBody(chunks) {
  const encoder = new TextEncoder();
  let i = 0;
  return {
    getReader() {
      return {
        read() {
          return i < chunks.length
            ? Promise.resolve({ done: false, value: encoder.encode(chunks[i++]) })
            : Promise.resolve({ done: true, value: undefined });
        },
        releaseLock() {},
      };
    },
  };
}

describe('assistantChatStream helpers', () => {
  it('builds fallback segments when the orchestrator only returns text', () => {
    const { segments } = segmentsFromOrchestratorResponse(
      { output: [{ type: 'message', content: [{ type: 'output_text', text: 'hello' }] }] },
      TURN_ID
    );
    expect(segments[0]).toMatchObject({ text: 'hello', role: 'content' });
  });

  it('detects abort errors and clears the streaming flag on the matching turn', () => {
    expect(isAbortError({ name: 'AbortError' })).toBe(true);
    expect(isAbortError(new Error('nope'))).toBe(false);

    const setTurns = vi.fn((updater) =>
      updater([
        { id: TURN_ID, _isStreaming: true },
        { id: 'other', _isStreaming: true },
      ])
    );
    clearStreamingFlag(setTurns, TURN_ID);
    const next = setTurns.mock.calls[0][0]([
      { id: TURN_ID, _isStreaming: true },
      { id: 'other', _isStreaming: true },
    ]);
    expect(next[0]._isStreaming).toBe(false);
    expect(next[1]._isStreaming).toBe(true);
  });

  it('updates only the matching turn and records a map turn when rows exist', () => {
    const setTurns = vi.fn((updater) => updater([{ id: TURN_ID, assistantText: 'old' }]));
    updateTurn(setTurns, TURN_ID, () => ({ assistantText: 'new' }));
    const next = setTurns.mock.calls[0][0]([{ id: TURN_ID, assistantText: 'old' }]);
    expect(next[0].assistantText).toBe('new');

    const setLastMapTurnId = vi.fn();
    markMapTurn([], TURN_ID, setLastMapTurnId);
    markMapTurn(undefined, TURN_ID, setLastMapTurnId);
    expect(setLastMapTurnId).not.toHaveBeenCalled();
    markMapTurn([{ hex_id: HEX_A }], TURN_ID, setLastMapTurnId);
    expect(setLastMapTurnId).toHaveBeenCalledWith(TURN_ID);
  });
});

describe('ingestPayloadEvents / publishPartialResponse', () => {
  it('skips map UI updates when no new rows arrive', async () => {
    const setTurns = vi.fn();
    const setLastMapTurnId = vi.fn();
    const parsedEvents = [];
    await ingestPayloadEvents({
      payload: '{"kind":"token","payload":{"text":"hi"}}',
      parsedEvents,
      mapStream: createStreamingMapAccumulator(TURN_ID),
      streamAbort: new AbortController(),
      turnId: TURN_ID,
      setTurns,
      setLastMapTurnId,
    });
    expect(parsedEvents).toHaveLength(1);
    expect(setTurns).not.toHaveBeenCalled();
  });

  it('publishes map rows as they stream in', async () => {
    const setTurns = vi.fn((updater) => updater([{ id: TURN_ID }]));
    const setLastMapTurnId = vi.fn();
    const parsedEvents = [];
    const mapStream = createStreamingMapAccumulator(TURN_ID);
    await ingestPayloadEvents({
      payload: JSON.stringify({ kind: 'map.meta', payload: { columns: ['hex_id', 'value'] } }),
      parsedEvents,
      mapStream,
      streamAbort: new AbortController(),
      turnId: TURN_ID,
      setTurns,
      setLastMapTurnId,
    });
    await ingestPayloadEvents({
      payload: JSON.stringify({
        kind: 'map.chunk',
        payload: { start: 0, rows: [[HEX_A, 1.5]] },
      }),
      parsedEvents,
      mapStream,
      streamAbort: new AbortController(),
      turnId: TURN_ID,
      setTurns,
      setLastMapTurnId,
    });
    expect(setLastMapTurnId).toHaveBeenCalledWith(TURN_ID);
  });

  it('returns immediately when the abort signal is already set', async () => {
    const streamAbort = new AbortController();
    streamAbort.abort();
    const parsedEvents = [];
    await ingestPayloadEvents({
      payload: '{"kind":"token","payload":{"text":"x"}}',
      parsedEvents,
      mapStream: createStreamingMapAccumulator(TURN_ID),
      streamAbort,
      turnId: TURN_ID,
      setTurns: vi.fn(),
      setLastMapTurnId: vi.fn(),
    });
    expect(parsedEvents).toHaveLength(0);
  });

  it('does not publish when there are no segments or map rows', () => {
    const setTurns = vi.fn();
    publishPartialResponse({
      partialResponse: null,
      mapStream: createStreamingMapAccumulator(TURN_ID),
      streamAbort: new AbortController(),
      turnId: TURN_ID,
      setTurns,
      setLastMapTurnId: vi.fn(),
      setIsLoading: vi.fn(),
    });
    expect(setTurns).not.toHaveBeenCalled();
  });

  it('publishes a partial chat answer and clears the spinner', () => {
    const setTurns = vi.fn((updater) => updater([{ id: TURN_ID }]));
    const setIsLoading = vi.fn();
    const setLastMapTurnId = vi.fn();
    const partialResponse = coalesceStreamEventsForUi([
      { kind: CHAT_FINAL, payload: { text: 'hello there' } },
    ]);
    publishPartialResponse({
      partialResponse,
      mapStream: createStreamingMapAccumulator(TURN_ID),
      streamAbort: new AbortController(),
      turnId: TURN_ID,
      setTurns,
      setLastMapTurnId,
      setIsLoading,
    });
    expect(setIsLoading).toHaveBeenCalledWith(false);
    expect(setTurns).toHaveBeenCalled();
  });

  it('skips publishing when the stream was aborted', () => {
    const streamAbort = new AbortController();
    streamAbort.abort();
    const setTurns = vi.fn();
    publishPartialResponse({
      partialResponse: coalesceStreamEventsForUi([
        { kind: CHAT_FINAL, payload: { text: 'late' } },
      ]),
      mapStream: createStreamingMapAccumulator(TURN_ID),
      streamAbort,
      turnId: TURN_ID,
      setTurns,
      setLastMapTurnId: vi.fn(),
      setIsLoading: vi.fn(),
    });
    expect(setTurns).not.toHaveBeenCalled();
  });
});

describe('consumeAssistantStream / finalizeAssistantTurn', () => {
  it('consumes an SSE chat.final stream and finalizes the turn', async () => {
    const setTurns = vi.fn((updater) => updater([{ id: TURN_ID }]));
    const setLastMapTurnId = vi.fn();
    const setIsLoading = vi.fn();
    const streamAbort = new AbortController();
    const body = mockStreamBody(['data: {"kind":"chat.final","payload":{"text":"done"}}\n\n']);
    const { parsedEvents, mapStream } = await consumeAssistantStream(body, {
      streamAbort,
      turnId: TURN_ID,
      setTurns,
      setLastMapTurnId,
      setIsLoading,
    });
    const completed = finalizeAssistantTurn({
      parsedEvents,
      mapStream,
      streamAbort,
      turnId: TURN_ID,
      setTurns,
      setLastMapTurnId,
      setIsLoading,
    });
    expect(completed).toBe(true);
  });

  it('stops consuming when the abort signal fires between payloads', async () => {
    const streamAbort = new AbortController();
    const encoder = new TextEncoder();
    const chunks = [
      'data: {"kind":"token","payload":{"text":"a"}}\n\n',
      'data: {"kind":"chat.final","payload":{"text":"never"}}\n\n',
    ];
    let i = 0;
    const body = {
      getReader() {
        return {
          read() {
            if (i === 1) streamAbort.abort();
            return i < chunks.length
              ? Promise.resolve({ done: false, value: encoder.encode(chunks[i++]) })
              : Promise.resolve({ done: true, value: undefined });
          },
          releaseLock() {},
        };
      },
    };
    const { parsedEvents, mapStream } = await consumeAssistantStream(body, {
      streamAbort,
      turnId: TURN_ID,
      setTurns: vi.fn(),
      setLastMapTurnId: vi.fn(),
      setIsLoading: vi.fn(),
    });
    expect(
      finalizeAssistantTurn({
        parsedEvents,
        mapStream,
        streamAbort,
        turnId: TURN_ID,
        setTurns: vi.fn(),
        setLastMapTurnId: vi.fn(),
        setIsLoading: vi.fn(),
      })
    ).toBe(false);
  });

  it('throws when the stream had no usable payload', () => {
    expect(() =>
      finalizeAssistantTurn({
        parsedEvents: [],
        mapStream: createStreamingMapAccumulator(TURN_ID),
        streamAbort: new AbortController(),
        turnId: TURN_ID,
        setTurns: vi.fn(),
        setLastMapTurnId: vi.fn(),
        setIsLoading: vi.fn(),
      })
    ).toThrow(/without a usable payload/);
  });

  it('uses fallback segments when the parser returns text without blocks', () => {
    const spy = vi.spyOn(orchestrator, 'parseOrchestratorResponse').mockReturnValue({
      assistantText: 'plain answer',
      assistantSegments: [],
      mapRecords: undefined,
    });
    const { segments } = segmentsFromOrchestratorResponse({}, TURN_ID);
    expect(segments[0]).toMatchObject({ id: 'seg-fallback', text: 'plain answer' });
    spy.mockRestore();
  });

  it('throws when the coalesced payload has no assistant segments', () => {
    const spy = vi.spyOn(orchestrator, 'parseOrchestratorResponse').mockReturnValue({
      assistantText: '',
      assistantSegments: [],
      mapRecords: undefined,
    });
    const setIsLoading = vi.fn();
    expect(() =>
      finalizeAssistantTurn({
        parsedEvents: [{ kind: CHAT_FINAL, payload: { text: 'ignored by mock' } }],
        mapStream: createStreamingMapAccumulator(TURN_ID),
        streamAbort: new AbortController(),
        turnId: TURN_ID,
        setTurns: vi.fn(),
        setLastMapTurnId: vi.fn(),
        setIsLoading,
      })
    ).toThrow(/Empty response from assistant/);
    expect(setIsLoading).toHaveBeenCalledWith(false);
    spy.mockRestore();
  });
});

describe('reportAssistantError', () => {
  it('clears streaming on abort and does not load threads', async () => {
    const setTurns = vi.fn();
    const loadThreads = vi.fn();
    await reportAssistantError({ name: 'AbortError' }, TURN_ID, setTurns, loadThreads);
    expect(setTurns).toHaveBeenCalled();
    expect(loadThreads).not.toHaveBeenCalled();
  });

  it('records a generic message for non-Error rejections', async () => {
    const setTurns = vi.fn((updater) => updater([{ id: TURN_ID }]));
    await reportAssistantError('boom', TURN_ID, setTurns, vi.fn());
    const next = setTurns.mock.calls[0][0]([{ id: TURN_ID }]);
    expect(next[0].assistantText).toBe('Error: Failed to get response from API');
  });

  it('reloads threads on quota exceeded', async () => {
    const loadThreads = vi.fn().mockResolvedValue(undefined);
    const setTurns = vi.fn();
    const err = new PortalApiError('quota', {
      status: 429,
      payload: { error: 'quota_exceeded' },
    });
    await reportAssistantError(err, TURN_ID, setTurns, loadThreads);
    expect(loadThreads).toHaveBeenCalledTimes(1);
  });
});
