import { parseKindEnvelopeText, parseOrchestratorResponse } from '@/services/parseOrchestratorResponse';

/**
 * Merges map record batches by `hex_id` so streaming chunks can append or refresh cells.
 * @param {object[]|undefined} prev
 * @param {object[]|undefined} next
 * @returns {object[]|undefined}
 */
export function mergeMapRecordsByHexId(prev, next) {
    if (!next?.length) return prev?.length ? [...prev] : undefined;
    if (!prev?.length) return [...next];
    const byHex = new Map();
    for (const r of prev) {
        if (r && typeof r === 'object' && r.hex_id != null && String(r.hex_id) !== '') {
            byHex.set(String(r.hex_id), r);
        }
    }
    for (const r of next) {
        if (!r || typeof r !== 'object' || r.hex_id == null || String(r.hex_id) === '') continue;
        const id = String(r.hex_id);
        const existing = byHex.get(id);
        byHex.set(id, existing ? { ...existing, ...r } : r);
    }
    return Array.from(byHex.values());
}

/**
 * H3 cell ids are 64-bit; JSON may send them as decimal integers or hex strings.
 * @param {unknown} raw
 * @returns {string|null}
 */
function normalizeHexIdCell(raw) {
    if (raw == null) return null;
    if (typeof raw === 'number' && Number.isFinite(raw)) {
        try {
            return BigInt(Math.trunc(raw)).toString(16).padStart(16, '0');
        } catch {
            return null;
        }
    }
    const s = String(raw).trim();
    if (!s) return null;
    if (/^[0-9a-fA-F]{15,16}$/i.test(s)) {
        try {
            return BigInt(`0x${s}`).toString(16).padStart(16, '0');
        } catch {
            return s.toLowerCase().padStart(16, '0');
        }
    }
    if (/^\d{10,}$/.test(s)) {
        try {
            return BigInt(s).toString(16).padStart(16, '0');
        } catch {
            return null;
        }
    }
    return s;
}

/**
 * TDIS AI may emit columnar `map.chunk` rows as arrays of strings. Coerce finite numeric strings
 * so choropleth code (`detectNumericField` expects numbers) and Mapbox interpolate work.
 * Never runs on `hex_id`: 64‑bit IDs must not go through `Number()` (precision loss).
 *
 * @param {string} columnKey
 * @param {unknown} raw
 * @returns {unknown}
 */
function coerceColumnarCell(columnKey, raw) {
    if (raw == null || columnKey === 'hex_id') return raw;
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'string') {
        const t = raw.trim();
        if (t === '' || t === 'null' || t === 'undefined') return raw;
        if (t === 'NaN') return null;
        if (/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(t)) {
            const n = Number(t);
            if (Number.isFinite(n)) return n;
        }
    }
    return raw;
}

/**
 * @param {string[]} columns
 * @param {unknown[][]} rows
 * @returns {object[]}
 */
function hydrateColumnarRows(columns, rows) {
    if (!Array.isArray(columns) || columns.length === 0 || !Array.isArray(rows)) return [];
    const out = [];
    for (const row of rows) {
        if (!Array.isArray(row)) continue;
        const o = {};
        for (let i = 0; i < columns.length; i++) {
            const key = columns[i];
            if (key === undefined || key === '') continue;
            o[key] = coerceColumnarCell(String(key), row[i]);
        }
        const hexNorm = normalizeHexIdCell(o.hex_id);
        if (hexNorm != null && hexNorm !== '') {
            o.hex_id = hexNorm;
            out.push(o);
        }
    }
    return out;
}

/**
 * @param {unknown} rows
 * @returns {boolean}
 */
function isColumnarRowBatch(rows) {
    return Array.isArray(rows) && rows.length > 0 && Array.isArray(rows[0]);
}

/**
 * `JSON.parse` destroys 64-bit `hex_id` values in `map.chunk` rows (IEEE double).
 * Re-read each row's leading decimal id from the raw wire `text` and build objects with `BigInt`.
 *
 * @param {string} rawContentText — `item.content[].text` (inner JSON string)
 * @param {string[]} columns
 * @param {unknown[][]} parsedRows — `payload.rows` after JSON.parse (hex_id column unreliable)
 * @returns {object[] | null} null → caller should fall back to {@link hydrateColumnarRows}
 */
function hydrateMapChunkRowsPreservingHexId(rawContentText, columns, parsedRows) {
    if (
        typeof rawContentText !== 'string' ||
        !Array.isArray(parsedRows) ||
        parsedRows.length === 0 ||
        !columns?.length ||
        columns[0] !== 'hex_id'
    ) {
        return null;
    }
    const keyIdx = rawContentText.indexOf('"rows"');
    if (keyIdx === -1) return null;
    const slice = rawContentText.slice(keyIdx);
    // Row may start with a JSON number or a quoted decimal string for `hex_id`.
    const re = /\[\s*"?(\d{10,})"?\s*,/g;
    const decimals = [];
    let m;
    while ((m = re.exec(slice)) !== null) {
        decimals.push(m[1]);
    }
    if (decimals.length !== parsedRows.length) {
        return null;
    }
    const out = [];
    for (let i = 0; i < parsedRows.length; i++) {
        const row = parsedRows[i];
        if (!Array.isArray(row)) return null;
        const o = {};
        for (let j = 0; j < columns.length; j++) {
            const col = columns[j];
            const cell = j === 0 ? decimals[i] : row[j];
            o[col] = j === 0 ? cell : coerceColumnarCell(String(col), cell);
        }
        const hexNorm = normalizeHexIdCell(o.hex_id);
        if (hexNorm != null && hexNorm !== '') {
            o.hex_id = hexNorm;
            out.push(o);
        }
    }
    return out.length > 0 ? out : null;
}

/**
 * Extract column names from a metadata / chunk SSE JSON object (legacy flat shape).
 * @param {Record<string, unknown>} o
 * @returns {string[]|null}
 */
function readColumnsFromEvent(o) {
    const direct =
        (Array.isArray(o.columns) && o.columns) ||
        (Array.isArray(o.column_names) && o.column_names) ||
        (Array.isArray(o.map_columns) && o.map_columns);
    if (direct?.length) return direct.map(String);

    const meta = o.metadata;
    if (meta && typeof meta === 'object' && Array.isArray(meta.columns) && meta.columns.length) {
        return meta.columns.map(String);
    }
    const mapMeta = o.map_metadata;
    if (mapMeta && typeof mapMeta === 'object' && Array.isArray(mapMeta.columns) && mapMeta.columns.length) {
        return mapMeta.columns.map(String);
    }
    return null;
}

/**
 * @param {unknown} text
 * @returns {{ kind: string, payload: Record<string, unknown> } | null}
 */
/**
 * `response.output_item.done` with `item.content[].text` = `{ "kind": "map.meta" | "map.chunk", ... }`.
 * @param {Record<string, unknown>} o
 * @param {(batch: object[]) => void} applyBatch
 * @param {() => string[] | null} getColumns
 * @param {(cols: string[]) => void} setColumns
 */
function ingestResponsesOutputItemDone(o, applyBatch, getColumns, setColumns) {
    if (o.type !== 'response.output_item.done' || !o.item || typeof o.item !== 'object') return;
    const item = /** @type {Record<string, unknown>} */ (o.item);
    const content = item.content;
    if (!Array.isArray(content)) return;

    for (const part of content) {
        if (!part || typeof part !== 'object' || typeof part.text !== 'string') continue;
        const rawText = part.text;
        const envelope = parseKindEnvelopeText(rawText);
        if (!envelope) continue;

        const { kind, payload } = envelope;
        if (kind === 'map.meta') {
            const cols = payload.columns;
            if (Array.isArray(cols) && cols.length) {
                setColumns(cols.map(String));
            }
            continue;
        }
        if (kind === 'map.chunk') {
            const rowArrays = payload.rows;
            const cols = getColumns();
            if (cols?.length && isColumnarRowBatch(rowArrays)) {
                const precise = hydrateMapChunkRowsPreservingHexId(rawText, cols, rowArrays);
                applyBatch(precise ?? hydrateColumnarRows(cols, rowArrays));
            }
            continue;
        }
    }
}

/**
 * Direct `{ kind, payload }` map envelope — current FastAPI orchestrator contract.
 * @param {Record<string, unknown>} o
 * @param {string|undefined} rawText — raw `data:` frame string, used to preserve 64-bit hex_id
 * @param {(batch: object[]) => void} applyBatch
 * @param {() => string[] | null} getColumns
 * @param {(cols: string[]) => void} setColumns
 * @returns {boolean} true if the event was a map.* envelope (handled)
 */
function ingestKindEnvelope(o, rawText, applyBatch, getColumns, setColumns) {
    if (typeof o.kind !== 'string' || !o.payload || typeof o.payload !== 'object') return false;
    const payload = /** @type {Record<string, unknown>} */ (o.payload);
    if (o.kind === 'map.meta') {
        if (Array.isArray(payload.columns) && payload.columns.length) {
            setColumns(payload.columns.map(String));
        }
        return true;
    }
    if (o.kind === 'map.chunk') {
        const cols = getColumns();
        const rowArrays = payload.rows;
        if (cols?.length && isColumnarRowBatch(rowArrays)) {
            const precise =
                typeof rawText === 'string'
                    ? hydrateMapChunkRowsPreservingHexId(rawText, cols, rowArrays)
                    : null;
            applyBatch(precise ?? hydrateColumnarRows(cols, rowArrays));
        }
        return true;
    }
    return o.kind === 'map.end';
}

/**
 * Accumulates map hex rows across SSE chunks (Responses API envelopes + legacy orchestrator shapes).
 *
 * @param {string} turnId
 */
export function createStreamingMapAccumulator(turnId) {
    /** @type {string[]|null} */
    let columns = null;
    /** @type {object[]} */
    let merged = [];

    /**
     * @param {object[]} batch
     */
    function applyBatch(batch) {
        if (!batch?.length) return;
        const next = mergeMapRecordsByHexId(merged, batch);
        merged = next ?? [];
    }

    return {
        /**
         * @param {unknown} ev — one parsed JSON object from an SSE `data:` frame (or line).
         * @param {string} [rawText] — the raw `data:` payload string, used to preserve 64-bit hex_id.
         */
        ingestEvent(ev, rawText) {
            if (!ev || typeof ev !== 'object') return;

            const o = /** @type {Record<string, unknown>} */ (ev);

            if (
                ingestKindEnvelope(o, rawText, applyBatch, () => columns, (cols) => {
                    columns = cols;
                })
            ) {
                return;
            }

            ingestResponsesOutputItemDone(
                o,
                applyBatch,
                () => columns,
                (cols) => {
                    columns = cols;
                }
            );

            const fromMeta = readColumnsFromEvent(o);
            if (fromMeta?.length) {
                columns = fromMeta;
            }

            const rowCandidates = [o.rows, o.row_batch, o.data_rows, o.values, o.chunk, o.data];
            let rowArrays = null;
            for (const rc of rowCandidates) {
                if (isColumnarRowBatch(rc)) {
                    rowArrays = rc;
                    break;
                }
            }

            const colsForHydrate = columns?.length ? columns : readColumnsFromEvent(o);
            if (colsForHydrate?.length && rowArrays) {
                if (!columns?.length) columns = colsForHydrate;
                applyBatch(hydrateColumnarRows(columns, rowArrays));
            }

            const { mapRecords } = parseOrchestratorResponse(ev, turnId);
            if (mapRecords?.length) {
                applyBatch(mapRecords);
            }
        },

        /**
         * @param {object|null|undefined} response — coalesced orchestrator-style payload so far.
         */
        ingestCoalesced(response) {
            if (!response || typeof response !== 'object') return;
            const { mapRecords } = parseOrchestratorResponse(response, turnId);
            if (mapRecords?.length) {
                applyBatch(mapRecords);
            }
        },

        getMerged() {
            return merged.length > 0 ? merged : undefined;
        },

        getColumns() {
            return columns?.length ? [...columns] : null;
        },
    };
}
