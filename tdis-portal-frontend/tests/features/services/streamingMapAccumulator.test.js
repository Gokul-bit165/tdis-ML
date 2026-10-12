import { describe, it, expect } from 'vitest';
import {
  createStreamingMapAccumulator,
  mergeMapRecordsByHexId,
} from '@/services/streamingMapAccumulator';

function feed(acc, rawPayload) {
  acc.ingestEvent(JSON.parse(rawPayload), rawPayload);
}

const META_HEX_VALUE = '{"kind":"map.meta","payload":{"columns":["hex_id","value"]}}';

describe('createStreamingMapAccumulator — { kind, payload } map envelopes', () => {
  it('accumulates rows from map.meta + map.chunk frames', () => {
    const acc = createStreamingMapAccumulator('turn-1');
    feed(acc, '{"kind":"map.meta","payload":{"columns":["hex_id","value"],"total_rows":2}}');
    feed(
      acc,
      '{"kind":"map.chunk","payload":{"start":0,"rows":[[617700169958293503,1.5],[617700169958293504,2.0]]}}'
    );
    const merged = acc.getMerged();
    expect(merged).toHaveLength(2);
    expect(merged.every((r) => /^[0-9a-f]{16}$/.test(r.hex_id))).toBe(true);
    // 64-bit ids differ by 1 — proves precision was preserved from the raw wire text.
    expect(new Set(merged.map((r) => r.hex_id)).size).toBe(2);
    expect(merged[0].value).toBe(1.5);
  });

  it('coerces numeric string columns and preserves quoted hex_id', () => {
    const acc = createStreamingMapAccumulator('turn-1');
    feed(acc, META_HEX_VALUE);
    feed(acc, '{"kind":"map.chunk","payload":{"start":0,"rows":[["617700169958293503","3.25"]]}}');
    const merged = acc.getMerged();
    expect(merged).toHaveLength(1);
    expect(merged[0].hex_id).toMatch(/^[0-9a-f]{16}$/);
    expect(merged[0].value).toBe(3.25);
  });

  it('merges rows across multiple map.chunk frames', () => {
    const acc = createStreamingMapAccumulator('turn-1');
    feed(acc, META_HEX_VALUE);
    feed(acc, '{"kind":"map.chunk","payload":{"start":0,"rows":[[617700169958293503,1]]}}');
    feed(acc, '{"kind":"map.chunk","payload":{"start":1,"rows":[[617700169958293504,2]]}}');
    expect(acc.getMerged()).toHaveLength(2);
  });

  it('ignores map.chunk that arrives before columns are known', () => {
    const acc = createStreamingMapAccumulator('turn-1');
    feed(acc, '{"kind":"map.chunk","payload":{"start":0,"rows":[[617700169958293503,1]]}}');
    expect(acc.getMerged()).toBeUndefined();
  });

  it('does not treat chat frames as map data', () => {
    const acc = createStreamingMapAccumulator('turn-1');
    feed(acc, '{"kind":"chat.final","payload":{"text":"hi"}}');
    feed(acc, '{"kind":"token","payload":{"text":"x"}}');
    feed(acc, '{"kind":"node.start","payload":{"node":"sql_agent","label":"Querying data"}}');
    expect(acc.getMerged()).toBeUndefined();
  });

  it('exposes the meta columns via getColumns', () => {
    const acc = createStreamingMapAccumulator('turn-1');
    feed(acc, META_HEX_VALUE);
    expect(acc.getColumns()).toEqual(['hex_id', 'value']);
  });
});

describe('mergeMapRecordsByHexId', () => {
  it('merges batches by hex_id (shallow-merges overlapping cells)', () => {
    const prev = [{ hex_id: 'aaaa', v: 1 }];
    const next = [
      { hex_id: 'aaaa', w: 2 },
      { hex_id: 'bbbb', v: 3 },
    ];
    const out = mergeMapRecordsByHexId(prev, next);
    expect(out).toHaveLength(2);
    expect(out.find((r) => r.hex_id === 'aaaa')).toEqual({ hex_id: 'aaaa', v: 1, w: 2 });
  });

  it('returns a copy of prev when next is empty', () => {
    const prev = [{ hex_id: 'aaaa' }];
    expect(mergeMapRecordsByHexId(prev, [])).toEqual(prev);
  });
});
