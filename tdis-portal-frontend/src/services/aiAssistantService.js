/**
 * SSE parsing utilities for TDIS AI Assistant chat streams.
 *
 * Streaming HTTP is handled by `submitQuery` in `threadService.js` → `VITE_AI_API_URL` + `/queries/chat/chat-stream`.
 */
import { sanitizeWireJsonLiterals } from '@/services/parseOrchestratorResponse';

/**
 * `map.chunk` frames may carry bare `NaN`/`Infinity` from pandas (invalid JSON) — without
 * the sanitize fallback the whole 500-row chunk is silently dropped and no hexes render.
 * @param {string} text
 * @returns {unknown|undefined} parsed JSON, or undefined when unparseable either way
 */
function parseJsonLoose(text) {
    try {
        return JSON.parse(text);
    } catch {
        try {
            return JSON.parse(sanitizeWireJsonLiterals(text));
        } catch {
            return undefined;
        }
    }
}

/** Yields each SSE `data:` payload (handles CRLF and multi-line data fields).
 * @param {ReadableStream<Uint8Array>} body
 */
export async function* iterateSseDataPayloads(body) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            buffer = buffer.replace(/\r\n/g, '\n');

            let sep;
            while ((sep = buffer.indexOf('\n\n')) !== -1) {
                const block = buffer.slice(0, sep);
                buffer = buffer.slice(sep + 2);
                const payload = extractDataPayload(block);
                if (payload !== null) yield payload;
            }
        }
        if (buffer.trim()) {
            const payload = extractDataPayload(buffer);
            if (payload !== null) yield payload;
        }
    } finally {
        reader.releaseLock();
    }
}

/**
 * Parse one SSE/fragment string into zero or more JSON objects (single JSON or NDJSON lines).
 * @param {string} payload
 * @returns {unknown[]}
 */
export function parseSsePayloadToJsonEvents(payload) {
    const trimmed = typeof payload === 'string' ? payload.trim() : '';
    if (!trimmed || trimmed === '[DONE]') return [];
    const whole = parseJsonLoose(trimmed);
    if (whole !== undefined) return [whole];
    const out = [];
    for (const line of trimmed.split('\n')) {
        const t = line.trim();
        if (!t || t === '[DONE]') continue;
        const parsed = parseJsonLoose(t);
        if (parsed !== undefined) out.push(parsed);
        // else: skip bad line
    }
    return out;
}

function extractDataPayload(block) {
    const dataLines = [];
    for (const line of block.split('\n')) {
        const clean = line.replace(/\r$/, '');
        if (clean.startsWith('data:')) {
            dataLines.push(clean.slice(5).trimStart());
        }
    }
    if (!dataLines.length) {
        const trimmed = block.trim();
        if (
            trimmed.length > 0 &&
            trimmed !== '[DONE]' &&
            (trimmed.startsWith('{') || trimmed.startsWith('['))
        ) {
            return trimmed;
        }
        return null;
    }
    const payload = dataLines.join('\n');
    if (payload === '[DONE]') return null;
    return payload;
}

function toKindFrame(ev) {
    if (!ev || typeof ev !== 'object' || typeof ev.kind !== 'string') return null;
    const payload = ev.payload && typeof ev.payload === 'object' ? ev.payload : {};
    return {
        kind: ev.kind,
        text: typeof payload.text === 'string' ? payload.text : '',
        message: typeof payload.message === 'string' ? payload.message : '',
        node: typeof payload.node === 'string' ? payload.node : '',
        label: typeof payload.label === 'string' ? payload.label : '',
    };
}

function answerOutput(text) {
    return { output: [{ type: 'message', content: [{ type: 'output_text', text }] }] };
}

function statusOutput(step) {
    const envelope = JSON.stringify({
        kind: 'status',
        payload: { node: step.node, label: step.label },
    });
    return { output: [{ type: 'message', content: [{ type: 'output_text', text: envelope }] }] };
}

function coalesceKindEnvelopeStream(parsedEvents) {
    let finalText = '';
    let streamedText = '';
    let errorText = '';
    let sawEnvelope = false;
    let currentStep = null;

    for (const ev of parsedEvents) {
        const frame = toKindFrame(ev);
        if (!frame) continue;
        sawEnvelope = true;
        if (frame.kind === 'chat.final' && frame.text) finalText = frame.text;
        else if (frame.kind === 'token') streamedText += frame.text;
        else if (frame.kind === 'error' && frame.message) errorText = frame.message;
        else if (frame.kind === 'node.start' && (frame.label || frame.node)) {
            currentStep = { node: frame.node, label: frame.label };
        }
    }

    if (!sawEnvelope) return null;

    const text = finalText || streamedText || errorText;
    if (text.trim()) return answerOutput(text);

    if (currentStep) return statusOutput(currentStep);

    return null;
}

export function coalesceStreamEventsForUi(parsedEvents) {
    if (!parsedEvents.length) return null;
    return coalesceKindEnvelopeStream(parsedEvents);
}
