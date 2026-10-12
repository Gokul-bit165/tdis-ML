/**
 * Sanitizes NaN values in an object recursively.
 * Converts NaN, "NaN" strings, and null to null.
 */
function sanitizeNaN(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number' && isNaN(value)) {
    return null;
  }
  if (typeof value === 'string' && value.toLowerCase() === 'nan') {
    return null;
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeNaN);
  }
  if (typeof value === 'object') {
    const sanitized = {};
    for (const [key, val] of Object.entries(value)) {
      sanitized[key] = sanitizeNaN(val);
    }
    return sanitized;
  }
  return value;
}

/**
 * Pulls assistant-visible text from one `output[]` message block.
 * @param {Array<{ type?: string, text?: string }>|undefined} content
 * @returns {string}
 */
function extractTextFromMessageContent(content) {
  if (!Array.isArray(content)) return '';
  const textContent = content.find((c) => c.type === 'output_text' && c.text);
  if (textContent?.text) return textContent.text;
  const firstTextContent = content.find((c) => c.text);
  return firstTextContent?.text ?? '';
}

/** Strip orchestrator prefix from visible assistant text (streaming final item). */
function stripChatMarkerPrefix(text) {
  if (typeof text !== 'string') return text;
  const p = '__CHAT__:';
  const t = text.trimStart();
  if (t.startsWith(p)) return t.slice(p.length);
  return text;
}

/**
 * Remove internal planning lines like `Step 1 [commonsense_agent]: …` from assistant-visible text.
 * @param {string} text
 * @returns {string}
 */
export function stripOrchestratorStepDirectiveLines(text) {
  if (typeof text !== 'string') return text;
  const without = text
    .split(/\r?\n/)
    .filter((line) => !/^\s*Step\s+\d+\s*\[[^\]]+\]\s*:/.test(line))
    .join('\n');
  return without.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Python / pandas often emit bare `NaN` / `Infinity` (invalid JSON). Without this, `JSON.parse`
 * fails on `map.chunk` envelopes and the raw string is shown in chat instead of being routed to the map.
 * @param {string} text
 * @returns {string}
 */
export function sanitizeWireJsonLiterals(text) {
  if (typeof text !== 'string') return text;
  if (!/\bNaN\b|-Infinity|\bInfinity\b/.test(text)) return text;
  return text
    .replace(/\bNaN\b/g, 'null')
    .replace(/-Infinity\b/g, 'null')
    .replace(/\bInfinity\b/g, 'null');
}

/**
 * `__MAP__:` payloads from stream `output_item.done` — JSON array as quoted string or raw `[...]`.
 *
 * SSE `response.output_item.done` → `item.content[].text` often carries a JSON envelope:
 * `{ "kind": "status" | "map.meta" | "map.chunk" | "map.end" | "chat.final", "payload": ... }`.
 * @param {string} text
 * @returns {{ kind: string, payload: Record<string, unknown> } | null}
 */
export function parseKindEnvelopeText(text) {
  if (typeof text !== 'string') return null;
  const t = text.trim();
  if (!t.startsWith('{')) return null;
  const parseEnvelope = (source) => {
    try {
      const obj = JSON.parse(source);
      if (obj && typeof obj === 'object' && typeof obj.kind === 'string') {
        let payload = {};
        if (obj.payload != null && typeof obj.payload === 'object' && !Array.isArray(obj.payload)) {
          payload = /** @type {Record<string, unknown>} */ (obj.payload);
        }
        return { kind: obj.kind, payload };
      }
    } catch {
      /* ignore */
    }
    return null;
  };
  return parseEnvelope(t) ?? parseEnvelope(sanitizeWireJsonLiterals(t));
}

/**
 * @param {string} text
 * @returns {string|null} pass to parseMapRecordsFromString
 */
function extractMapPayloadAfterMarker(text) {
  if (typeof text !== 'string') return null;
  const trimmed = text.trimStart();
  const prefix = '__MAP__:';
  if (!trimmed.startsWith(prefix)) return null;
  const rest = trimmed.slice(prefix.length).trimStart();
  if (!rest) return null;
  try {
    if (rest.startsWith('"')) {
      const inner = JSON.parse(rest);
      return typeof inner === 'string' ? inner : null;
    }
    if (rest.startsWith('[')) {
      return rest;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * When `output[]` is missing or empty, pull assistant text from common API shapes (FastAPI / OpenAI-like).
 * @param {unknown} response
 * @returns {string}
 */
function extractFallbackAssistantText(response) {
  if (!response || typeof response !== 'object') return '';
  const r = /** @type {Record<string, unknown>} */ (response);
  const directKeys = ['message', 'answer', 'response', 'text'];
  for (const key of directKeys) {
    const v = r[key];
    if (typeof v === 'string' && v.trim()) return v;
  }
  if (typeof r.content === 'string' && r.content.trim()) return r.content;

  const choices = r.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const msg = choices[0]?.message;
    if (msg && typeof msg === 'object' && msg.content != null) {
      const c = msg.content;
      if (typeof c === 'string') return c;
      if (Array.isArray(c)) {
        const parts = c.map((p) => (p && typeof p.text === 'string' ? p.text : '')).filter(Boolean);
        if (parts.length) return parts.join('');
      }
    }
  }
  return '';
}

/**
 * Ordered segments for progressive UI (status chips vs answer card).
 * @typedef {{ id: string, text: string, role: 'status' | 'content', variant: 'status' | 'content' | 'answer' }} AssistantSegment
 */

/**
 * Build segments from each `output[]` message (Databricks multi-block responses).
 * @param {{ output?: unknown }} response
 * @returns {AssistantSegment[]}
 */
/**
 * @returns {{ segments: AssistantSegment[], mapPayloadStrings: string[] }}
 */
function buildAssistantSegments(response) {
  const outputs = response.output;
  if (!Array.isArray(outputs) || outputs.length === 0) {
    return { segments: [], mapPayloadStrings: [] };
  }
  /** @type {{ id: string, text: string, role: 'status' | 'content' }[]} */
  const raw = [];
  /** @type {string[]} */
  const mapPayloadStrings = [];
  let idx = 0;
  for (const item of outputs) {
    if (!item || typeof item !== 'object') continue;
    const itemType = item.type;
    if (itemType && itemType !== 'message' && itemType !== 'text' && itemType !== 'assistant') {
      continue;
    }
    let text = extractTextFromMessageContent(item.content);
    if (!text && typeof item.content === 'string') text = item.content;
    if (!text && typeof item.text === 'string') text = item.text;
    if (!text) continue;

    const envelope = parseKindEnvelopeText(text);
    if (envelope) {
      const { kind, payload } = envelope;
      if (kind === 'map.meta' || kind === 'map.chunk' || kind === 'map.end') {
        continue;
      }
      if (kind === 'status') {
        const node = typeof payload.node === 'string' ? payload.node.trim() : '';
        const label = typeof payload.label === 'string' ? payload.label.trim() : '';
        const progressLabel = label || node || 'step';
        if (progressLabel) {
          raw.push({
            id: `seg-${idx++}`,
            text: `[status:${progressLabel}]`,
            role: 'status',
          });
        }
        continue;
      }
      if (kind === 'chat.final') {
        const finalText = typeof payload.text === 'string' ? payload.text : '';
        const cleaned = stripOrchestratorStepDirectiveLines(
          stripChatMarkerPrefix(finalText.trim())
        );
        if (cleaned) {
          raw.push({
            id: `seg-${idx++}`,
            text: cleaned,
            role: 'content',
          });
        }
        continue;
      }
      continue;
    }

    const mapPayload = extractMapPayloadAfterMarker(text);
    if (mapPayload) {
      mapPayloadStrings.push(mapPayload);
      continue;
    }

    text = stripOrchestratorStepDirectiveLines(stripChatMarkerPrefix(text));
    if (!String(text).trim()) continue;

    const isStatus = /^\[status:/i.test(text.trim());
    raw.push({
      id: `seg-${idx++}`,
      text,
      role: isStatus ? 'status' : 'content',
    });
  }
  const contentIds = raw.filter((s) => s.role === 'content').map((s) => s.id);
  const lastAnswerId = contentIds.length ? contentIds[contentIds.length - 1] : null;

  const segments = raw.map((s) => ({
    ...s,
    variant: s.role === 'status' ? 'status' : s.id === lastAnswerId ? 'answer' : 'content',
  }));
  return { segments, mapPayloadStrings };
}

/**
 * @param {string} mapDataStr
 * @param {string} turnId
 * @returns {unknown[]|undefined}
 */
function parseMapRecordsFromString(mapDataStr, turnId) {
  try {
    let processedStr = mapDataStr.replace(/:\s*NaN(?=\s*[,}])/g, ': null');
    processedStr = processedStr.replace(/":\s*"NaN"/g, '": null');
    processedStr = processedStr.replace(
      /"hex_id"\s*:\s*(\d{10,})/g,
      (_, digits) => `"hex_id": "${BigInt(digits).toString(16).padStart(16, '0')}"`
    );

    const parsed = JSON.parse(processedStr);

    if (!Array.isArray(parsed)) {
      console.warn('🗺️ map_data is not an array:', typeof parsed);
      return undefined;
    }

    const sanitized = sanitizeNaN(parsed);
    return sanitized
      .filter((record) => {
        if (!record || typeof record !== 'object') return false;
        if (!record.hex_id) {
          console.warn('🗺️ Record missing hex_id:', record);
          return false;
        }
        return true;
      })
      .map((record) => ({
        ...record,
        hex_id: String(record.hex_id),
      }));
  } catch (error) {
    console.error('❌ Failed to parse map_data for turn:', turnId, error);
    console.error('🗺️ map_data string (first 500 chars):', mapDataStr.substring(0, 500));
    if (error instanceof SyntaxError) {
      console.error('🗺️ JSON parse error at position:', error.message);
    }
    return undefined;
  }
}

/**
 * Parses the Databricks orchestrator response and extracts:
 * - `assistantSegments` for progressive UI (status + answer blocks)
 * - `assistantText` — full joined text (fallback / copy)
 * - Map records from custom_outputs.map_data (if present)
 */
export function parseOrchestratorResponse(response, turnId) {
  let { segments: assistantSegments, mapPayloadStrings } = buildAssistantSegments(response);
  let assistantText = assistantSegments.length
    ? assistantSegments.map((s) => s.text).join('\n\n')
    : '';

  if (!assistantText.trim()) {
    let fallback = extractFallbackAssistantText(response);
    if (typeof fallback === 'string') {
      fallback = stripOrchestratorStepDirectiveLines(stripChatMarkerPrefix(fallback));
    }
    if (fallback) {
      assistantText = fallback;
      assistantSegments = [
        {
          id: 'seg-fallback',
          text: fallback,
          role: 'content',
          variant: 'answer',
        },
      ];
    }
  }

  /** @type {unknown[]|undefined} */
  let mapRecords = undefined;

  for (const payloadStr of mapPayloadStrings) {
    const rec = parseMapRecordsFromString(payloadStr, turnId);
    if (rec?.length) {
      mapRecords = mapRecords ? mapRecords.concat(rec) : rec;
    }
  }

  const mapDataStr = response.custom_outputs?.map_data;
  if (mapDataStr) {
    const rec = parseMapRecordsFromString(mapDataStr, turnId);
    if (rec?.length) {
      mapRecords = mapRecords ? mapRecords.concat(rec) : rec;
    }
  }

  return {
    assistantText,
    assistantSegments,
    mapRecords,
  };
}
