import { describe, it, expect } from 'vitest';
import {
  coalesceStreamEventsForUi,
  iterateSseDataPayloads,
  parseSsePayloadToJsonEvents,
} from '@/services/aiAssistantService';
import { parseOrchestratorResponse } from '@/services/parseOrchestratorResponse';

function renderedText(coalesced) {
  const { assistantText } = parseOrchestratorResponse(coalesced, 'turn-1');
  return assistantText;
}

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

async function collect(asyncIterable) {
  const out = [];
  for await (const item of asyncIterable) out.push(item);
  return out;
}

const NODE_START = 'node.start';
const CHAT_FINAL = 'chat.final';
const QUERYING_DATA = 'Querying data';

describe('coalesceStreamEventsForUi — { kind, payload } envelope stream', () => {
  it('extracts the answer from a chat.final frame', () => {
    const events = [
      { kind: NODE_START, payload: { node: 'plan', label: 'Planning' } },
      { kind: 'node.end', payload: { node: 'plan', label: 'Planning' } },
      { kind: CHAT_FINAL, payload: { text: 'Hello! How can I help?' } },
    ];
    const coalesced = coalesceStreamEventsForUi(events);
    expect(coalesced).toBeTruthy();
    expect(renderedText(coalesced)).toBe('Hello! How can I help?');
  });

  it('accumulates token frames for partial (streaming) renders', () => {
    const events = [
      { kind: 'token', payload: { text: 'Hel' } },
      { kind: 'token', payload: { text: 'lo ' } },
      { kind: 'token', payload: { text: 'there' } },
    ];
    expect(renderedText(coalesceStreamEventsForUi(events))).toBe('Hello there');
  });

  it('prefers chat.final over accumulated tokens', () => {
    const events = [
      { kind: 'token', payload: { text: 'partial...' } },
      { kind: CHAT_FINAL, payload: { text: 'the complete answer' } },
    ];
    expect(renderedText(coalesceStreamEventsForUi(events))).toBe('the complete answer');
  });

  it('surfaces an error frame instead of an empty bubble', () => {
    const events = [
      { kind: NODE_START, payload: { node: 'sql_agent', label: QUERYING_DATA } },
      { kind: 'error', payload: { message: 'orchestrator failed' } },
    ];
    expect(renderedText(coalesceStreamEventsForUi(events))).toContain('orchestrator failed');
  });

  it('ignores map.* frames (handled by the map accumulator) — no empty chat', () => {
    const events = [
      { kind: 'map.meta', payload: { columns: ['hex_id'], total_rows: 1 } },
      { kind: 'map.chunk', payload: { start: 0, rows: [['8a2a']] } },
      { kind: 'map.end', payload: {} },
      { kind: CHAT_FINAL, payload: { text: 'Here is your map.' } },
    ];
    expect(renderedText(coalesceStreamEventsForUi(events))).toBe('Here is your map.');
  });

  it('surfaces the current pipeline step as a status/progress segment while streaming', () => {
    const events = [{ kind: NODE_START, payload: { node: 'sql_agent', label: QUERYING_DATA } }];
    const { assistantSegments } = parseOrchestratorResponse(
      coalesceStreamEventsForUi(events),
      'turn-1'
    );
    const statuses = assistantSegments.filter((s) => s.role === 'status');
    expect(statuses).toHaveLength(1);
    expect(statuses[0].text).toMatch(/Querying data/);
  });

  it('shows only the latest step when several nodes have started', () => {
    const events = [
      { kind: NODE_START, payload: { node: 'plan', label: 'Planning' } },
      { kind: 'node.end', payload: { node: 'plan', label: 'Planning' } },
      { kind: NODE_START, payload: { node: 'sql_agent', label: QUERYING_DATA } },
    ];
    const { assistantSegments } = parseOrchestratorResponse(
      coalesceStreamEventsForUi(events),
      'turn-1'
    );
    const statuses = assistantSegments.filter((s) => s.role === 'status');
    expect(statuses).toHaveLength(1);
    expect(statuses[0].text).toMatch(/Querying data/);
  });

  it('replaces the progress chip with the answer once chat.final arrives', () => {
    const events = [
      { kind: NODE_START, payload: { node: 'plan', label: 'Planning' } },
      { kind: CHAT_FINAL, payload: { text: 'the answer' } },
    ];
    const { assistantSegments, assistantText } = parseOrchestratorResponse(
      coalesceStreamEventsForUi(events),
      'turn-1'
    );
    expect(assistantText).toBe('the answer');
    expect(assistantSegments.every((s) => s.role !== 'status')).toBe(true);
  });

  it('returns null when the answer is empty/whitespace only (and no steps ran)', () => {
    const events = [{ kind: CHAT_FINAL, payload: { text: '   ' } }];
    expect(coalesceStreamEventsForUi(events)).toBeNull();
  });
});

describe('coalesceStreamEventsForUi — non-envelope streams', () => {
  it('returns null for streams with no { kind, payload } frames', () => {
    const events = [
      { type: 'response.output_text.delta', item_id: 'a', delta: 'foo' },
      { output: [{ type: 'message', content: [{ type: 'output_text', text: 'x' }] }] },
    ];
    expect(coalesceStreamEventsForUi(events)).toBeNull();
  });
});

describe('iterateSseDataPayloads', () => {
  it('yields the data payload from a single SSE block', async () => {
    const out = await collect(iterateSseDataPayloads(mockStreamBody(['data: {"a":1}\n\n'])));
    expect(out).toEqual(['{"a":1}']);
  });

  it('yields multiple blocks from one chunk', async () => {
    const out = await collect(
      iterateSseDataPayloads(mockStreamBody(['data: {"a":1}\n\ndata: {"b":2}\n\n']))
    );
    expect(out).toEqual(['{"a":1}', '{"b":2}']);
  });

  it('reassembles a block split across chunks', async () => {
    const out = await collect(iterateSseDataPayloads(mockStreamBody(['data: {"a":', '1}\n\n'])));
    expect(out).toEqual(['{"a":1}']);
  });

  it('normalizes CRLF line endings', async () => {
    const out = await collect(iterateSseDataPayloads(mockStreamBody(['data: hi\r\n\r\n'])));
    expect(out).toEqual(['hi']);
  });

  it('joins multi-line data fields', async () => {
    const out = await collect(
      iterateSseDataPayloads(mockStreamBody(['data: line1\ndata: line2\n\n']))
    );
    expect(out).toEqual(['line1\nline2']);
  });

  it('skips [DONE] sentinels', async () => {
    const out = await collect(
      iterateSseDataPayloads(mockStreamBody(['data: {"a":1}\n\ndata: [DONE]\n\n']))
    );
    expect(out).toEqual(['{"a":1}']);
  });

  it('flushes a trailing block with no terminating blank line', async () => {
    const out = await collect(iterateSseDataPayloads(mockStreamBody(['data: {"x":1}'])));
    expect(out).toEqual(['{"x":1}']);
  });

  it('accepts a raw JSON block without a data: prefix', async () => {
    const out = await collect(iterateSseDataPayloads(mockStreamBody(['{"raw":1}\n\n'])));
    expect(out).toEqual(['{"raw":1}']);
  });

  it('ignores SSE comment/keep-alive blocks (no data: field, not JSON)', async () => {
    const out = await collect(
      iterateSseDataPayloads(mockStreamBody([': keep-alive\n\ndata: {"a":1}\n\n']))
    );
    expect(out).toEqual(['{"a":1}']);
  });
});

describe('parseSsePayloadToJsonEvents', () => {
  it('parses a single JSON object', () => {
    expect(parseSsePayloadToJsonEvents('{"a":1}')).toEqual([{ a: 1 }]);
  });

  it('returns [] for the [DONE] sentinel', () => {
    expect(parseSsePayloadToJsonEvents('[DONE]')).toEqual([]);
  });

  it('returns [] for empty/whitespace input', () => {
    expect(parseSsePayloadToJsonEvents('   ')).toEqual([]);
  });

  it('returns [] for non-string input', () => {
    expect(parseSsePayloadToJsonEvents(null)).toEqual([]);
    expect(parseSsePayloadToJsonEvents(undefined)).toEqual([]);
  });

  it('parses NDJSON (one JSON object per line)', () => {
    expect(parseSsePayloadToJsonEvents('{"a":1}\n{"b":2}')).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it('skips malformed lines within NDJSON', () => {
    expect(parseSsePayloadToJsonEvents('{"a":1}\nnot json\n{"b":2}')).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it('skips [DONE] lines within NDJSON', () => {
    expect(parseSsePayloadToJsonEvents('{"a":1}\n[DONE]')).toEqual([{ a: 1 }]);
  });

  it('recovers map.chunk frames containing bare NaN/Infinity (pandas wire output)', () => {
    const frame =
      '{"kind": "map.chunk", "payload": {"start": 0, "rows": [["604759248676585471", "98.15", "0.0", NaN, "286.0"], ["604686063641821183", "54.35", Infinity, NaN, "4930.0"]]}}';
    const events = parseSsePayloadToJsonEvents(frame);
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('map.chunk');
    expect(events[0].payload.rows).toEqual([
      ['604759248676585471', '98.15', '0.0', null, '286.0'],
      ['604686063641821183', '54.35', null, null, '4930.0'],
    ]);
  });
});
