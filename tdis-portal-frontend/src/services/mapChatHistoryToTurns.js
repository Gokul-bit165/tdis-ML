import {
  parseOrchestratorResponse,
  stripOrchestratorStepDirectiveLines,
} from '@/services/parseOrchestratorResponse';

/** @param {unknown} payload */
export function extractHistoryItems(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (typeof payload !== 'object') return [];
  const p = /** @type {Record<string, unknown>} */ (payload);
  for (const key of ['items', 'messages', 'history', 'data', 'results']) {
    if (Array.isArray(p[key])) return p[key];
  }
  return [];
}

/**
 * Parse pagination hints from GET .../history JSON.
 * @param {unknown} payload
 * @param {number} limit
 * @param {number} requestedOffset
 */
export function parseHistoryPage(payload, limit, requestedOffset) {
  const items = extractHistoryItems(payload);
  let hasMore = false;
  let nextOffset = requestedOffset + items.length;

  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const p = /** @type {Record<string, unknown>} */ (payload);
    if (typeof p.has_more === 'boolean') hasMore = p.has_more;
    else if (typeof p.hasMore === 'boolean') hasMore = p.hasMore;

    if (typeof p.next_offset === 'number' && Number.isFinite(p.next_offset)) {
      nextOffset = p.next_offset;
    } else if (typeof p.nextOffset === 'number' && Number.isFinite(p.nextOffset)) {
      nextOffset = p.nextOffset;
    }

    if (typeof p.total === 'number' && Number.isFinite(p.total)) {
      hasMore = requestedOffset + items.length < p.total;
    } else if (typeof p.has_more !== 'boolean' && typeof p.hasMore !== 'boolean') {
      hasMore = items.length >= limit;
    }
  } else {
    hasMore = items.length >= limit;
  }

  return { items, hasMore, nextOffset };
}

function stripChatMarkerPrefix(text) {
  if (typeof text !== 'string') return text;
  const p = '__CHAT__:';
  const t = text.trimStart();
  if (t.startsWith(p)) return t.slice(p.length);
  return text;
}

function normalizeCreatedAt(row) {
  const v = row.created_at ?? row.createdAt ?? row.timestamp ?? row.ts ?? row.created;
  if (typeof v === 'string' && v.trim()) return v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return new Date(v).toISOString();
  return new Date().toISOString();
}

function extractMessageContent(row) {
  const c = row.content ?? row.text ?? row.body ?? row.message;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) {
    return c.map((p) => (p && typeof p.text === 'string' ? p.text : '')).join('');
  }
  if (c && typeof c === 'object' && typeof c.text === 'string') return c.text;
  return '';
}

/**
 * @param {unknown} assistantRaw
 * @param {string} turnId
 */
function assistantPayloadToTurnParts(assistantRaw, turnId) {
  if (assistantRaw == null) {
    return { segments: [], text: '', mapRecords: undefined };
  }
  if (typeof assistantRaw === 'string') {
    let text = stripOrchestratorStepDirectiveLines(stripChatMarkerPrefix(assistantRaw));
    if (!text) return { segments: [], text: '', mapRecords: undefined };
    return {
      segments: [
        {
          id: 'seg-fallback',
          text,
          role: 'content',
          variant: 'answer',
        },
      ],
      text,
      mapRecords: undefined,
    };
  }
  if (typeof assistantRaw === 'object') {
    const { assistantSegments, assistantText, mapRecords } = parseOrchestratorResponse(
      assistantRaw,
      turnId
    );
    let segments = assistantSegments?.length ? assistantSegments : [];
    let text = assistantText?.trim() ? assistantText : '';
    if (!segments.length && text) {
      segments = [
        {
          id: 'seg-fallback',
          text,
          role: 'content',
          variant: 'answer',
        },
      ];
    }
    return { segments, text, mapRecords };
  }
  return { segments: [], text: '', mapRecords: undefined };
}

function sortTurnsChrono(turns) {
  return [...turns].sort((a, b) => {
    const ta = new Date(a.createdAt).getTime();
    const tb = new Date(b.createdAt).getTime();
    if (ta !== tb) return ta - tb;
    const sa = typeof a._histSeq === 'number' ? a._histSeq : 0;
    const sb = typeof b._histSeq === 'number' ? b._histSeq : 0;
    return sa - sb;
  });
}

/**
 * Collect consecutive assistant rows (API may emit several `ai` parts per user turn).
 * @param {Record<string, unknown>[]} chunkRows
 * @param {string} turnId
 */
function buildTurnFromAiRows(chunkRows, turnId) {
  const texts = chunkRows.map((r) => extractMessageContent(r).trim()).filter((t) => t.length > 0);
  const combined = texts.join('\n\n');
  const parts = assistantPayloadToTurnParts(combined, turnId);
  return {
    assistantSegments: parts.segments.length ? parts.segments : undefined,
    assistantText: parts.segments?.length ? '' : parts.text || '',
    revealedSegmentIndex: parts.segments?.length ? parts.segments.length - 1 : undefined,
    mapRecords: parts.mapRecords,
  };
}

/**
 * @param {unknown[]} records
 * @param {string} threadId
 * @param {string} idPrefix
 */
function historyRoleMessagesToTurns(records, threadId, idPrefix) {
  /** @type {object[]} */
  const turns = [];
  let idx = 0;
  let seq = 0;

  const nextTurnId = (row) => {
    const r = /** @type {Record<string, unknown>} */ (row);
    return typeof r.id === 'string' && r.id.trim()
      ? `${idPrefix}-${r.id}`
      : `${idPrefix}-${threadId}-${idx++}`;
  };

  const isHumanRole = (r) => {
    const role = String(r.role ?? r.sender ?? '').toLowerCase();
    return role === 'user' || role === 'human';
  };

  const isAssistantRole = (r) => {
    const role = String(r.role ?? r.sender ?? '').toLowerCase();
    return role === 'assistant' || role === 'ai' || role === 'bot';
  };

  let i = 0;
  while (i < records.length) {
    const raw = records[i];
    if (!raw || typeof raw !== 'object') {
      i += 1;
      continue;
    }
    const row = /** @type {Record<string, unknown>} */ (raw);
    const role = String(row.role ?? row.sender ?? '').toLowerCase();

    if (role === 'system') {
      i += 1;
      continue;
    }

    if (isHumanRole(row)) {
      const userText = extractMessageContent(row);
      i += 1;
      /** @type {Record<string, unknown>[]} */
      const aiRows = [];
      while (i < records.length) {
        const r2 = records[i];
        if (!r2 || typeof r2 !== 'object') break;
        const r2row = /** @type {Record<string, unknown>} */ (r2);
        const r2role = String(r2row.role ?? r2row.sender ?? '').toLowerCase();
        if (r2role === 'system') {
          i += 1;
          continue;
        }
        if (isHumanRole(r2row)) break;
        if (isAssistantRole(r2row)) {
          aiRows.push(r2row);
          i += 1;
          continue;
        }
        break;
      }
      const combinedAi = aiRows
        .map((r) => extractMessageContent(r).trim())
        .filter(Boolean)
        .join('\n\n');
      if (!userText.trim() && !combinedAi.trim()) continue;

      const turnId = nextTurnId(row);
      const assistant = buildTurnFromAiRows(aiRows, turnId);
      turns.push({
        id: turnId,
        createdAt: normalizeCreatedAt(row),
        userText,
        ...assistant,
        _histSeq: seq++,
        _fromHistory: true,
      });
      continue;
    }

    if (isAssistantRole(row)) {
      /** @type {Record<string, unknown>[]} */
      const aiRows = [];
      while (i < records.length) {
        const r2 = records[i];
        if (!r2 || typeof r2 !== 'object') break;
        const r2row = /** @type {Record<string, unknown>} */ (r2);
        const r2role = String(r2row.role ?? r2row.sender ?? '').toLowerCase();
        if (r2role === 'system') {
          i += 1;
          continue;
        }
        if (isHumanRole(r2row)) break;
        if (isAssistantRole(r2row)) {
          aiRows.push(r2row);
          i += 1;
          continue;
        }
        break;
      }
      if (aiRows.length === 0) continue;

      const turnId = nextTurnId(aiRows[0]);
      const assistant = buildTurnFromAiRows(aiRows, turnId);
      turns.push({
        id: turnId,
        createdAt: normalizeCreatedAt(aiRows[0]),
        userText: '',
        ...assistant,
        _histSeq: seq++,
        _fromHistory: true,
      });
      continue;
    }

    i += 1;
  }

  return turns;
}

/**
 * Map GET /history rows to UI turns (user bubble + assistant segments).
 * Supports: paired rows (user_message + assistant_response), or role-based message arrays.
 *
 * @param {unknown[]} records
 * @param {string} threadId
 * @param {string} [idPrefix]
 */
export function mapHistoryRecordsToTurns(records, threadId, idPrefix = 'hist') {
  if (!Array.isArray(records) || records.length === 0) return [];

  const looksLikeRoleBased = records.some(
    (r) =>
      r &&
      typeof r === 'object' &&
      typeof (/** @type {Record<string, unknown>} */ (r).role) === 'string'
  );

  if (looksLikeRoleBased) {
    return sortTurnsChrono(historyRoleMessagesToTurns(records, threadId, idPrefix));
  }

  /** @type {object[]} */
  const turns = [];
  records.forEach((raw, i) => {
    if (!raw || typeof raw !== 'object') return;
    const row = /** @type {Record<string, unknown>} */ (raw);

    const um = row.user_message ?? row.user_text ?? row.query ?? row.prompt ?? row.user;
    const ar =
      row.assistant_response ??
      row.response ??
      row.assistant ??
      row.answer ??
      row.bot ??
      row.output;

    const userText = typeof um === 'string' ? um : typeof um === 'number' ? String(um) : '';

    if (ar == null && !userText.trim()) return;

    const turnId =
      typeof row.id === 'string' && row.id.trim()
        ? `${idPrefix}-${row.id}`
        : `${idPrefix}-${threadId}-${i}`;

    const parts = assistantPayloadToTurnParts(ar ?? '', turnId);
    turns.push({
      id: turnId,
      createdAt: normalizeCreatedAt(row),
      userText,
      assistantSegments: parts.segments.length ? parts.segments : undefined,
      assistantText: parts.segments?.length ? '' : parts.text || '',
      revealedSegmentIndex: parts.segments?.length ? parts.segments.length - 1 : undefined,
      mapRecords: parts.mapRecords,
      _histSeq: i,
      _fromHistory: true,
    });
  });

  return sortTurnsChrono(turns);
}

/**
 * @param {object[]} turns
 */
export function dedupeTurnsById(turns) {
  const seen = new Set();
  return turns.filter((t) => {
    const id = t && typeof t.id === 'string' ? t.id : '';
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
