/** TDIS AI Assistant threads + streaming chat (FastAPI). Not the general portal API. */
const DEFAULT_AI_API_BASE_PROD = 'https://api-tdis-ai.dev.cloud.tdis.io';

function isValidAiApiBaseUrl(raw) {
  return /^https:\/\/.+/i.test(raw) && !raw.includes('$(');
}

function resolveAiAssistantApiBase() {
  const raw =
    typeof import.meta.env.VITE_AI_API_URL === 'string'
      ? import.meta.env.VITE_AI_API_URL.trim()
      : '';
  if (raw && isValidAiApiBaseUrl(raw)) return raw.replace(/\/+$/, '');
  // Local `npm run dev`: omit VITE_AI_API_URL to use Vite proxy (/queries → 127.0.0.1:8000), avoids CORS.
  if (import.meta.env.DEV) return '';
  return DEFAULT_AI_API_BASE_PROD.replace(/\/+$/, '');
}

const API_BASE = resolveAiAssistantApiBase();

/** Rich error from Portal FastAPI (parsed JSON body attached for UI). */
export class PortalApiError extends Error {
  /**
   * @param {string} message
   * @param {{ status?: number, code?: string, payload?: object | null }} meta
   */
  constructor(message, meta = {}) {
    super(message);
    this.name = 'PortalApiError';
    this.status = meta.status;
    this.code = meta.code;
    this.payload = meta.payload ?? null;
  }
}

/**
 * @param {string} isoDate — e.g. "2026-06-06"
 */
export function formatQuotaResetDate(isoDate) {
  try {
    const normalized = /^\d{4}-\d{2}-\d{2}$/.test(isoDate) ? `${isoDate}T12:00:00` : isoDate;
    const d = new Date(normalized);
    if (Number.isNaN(d.getTime())) return isoDate;
    return d.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return isoDate;
  }
}

/**
 * @param {object} p — API JSON body (quota_exceeded, etc.)
 */
function buildQuotaMessage(p) {
  const lines = [];
  lines.push("You've reached your AI query limit for this billing period.");
  if (typeof p.reset_date === 'string' && p.reset_date.trim()) {
    lines.push(`Quota resets on ${formatQuotaResetDate(p.reset_date.trim())}.`);
  }
  if (typeof p.queries_allocated === 'number') {
    const rem =
      typeof p.queries_remaining === 'number'
        ? `${p.queries_remaining} of ${p.queries_allocated} queries remaining before reset.`
        : `${p.queries_allocated} queries per period.`;
    lines.push(rem);
  }
  return lines.join('\n\n');
}

/**
 * @param {number} status
 * @param {object | null} payload
 * @param {string} rawText
 */
function buildUserFacingMessage(status, payload, rawText) {
  if (payload && typeof payload === 'object') {
    const code = payload.error ?? payload.code;
    if (status === 429 || code === 'quota_exceeded') {
      return buildQuotaMessage(payload);
    }
    if (typeof payload.message === 'string' && payload.message.trim()) {
      return payload.message.trim();
    }
  }
  if (status === 429) {
    return 'Too many requests. Please try again later.';
  }
  const snippet = (rawText || '').trim();
  if (snippet.length > 0 && snippet.length < 500 && !snippet.startsWith('{')) {
    return status ? `${snippet} (${status})` : snippet;
  }
  return `Request failed${status ? ` (${status})` : ''}`;
}

async function parseError(response) {
  const text = await response.text().catch(() => '');
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  const message = buildUserFacingMessage(response.status, payload, text);
  const code = payload && typeof payload === 'object' ? (payload.error ?? payload.code) : undefined;

  throw new PortalApiError(message, {
    status: response.status,
    code: typeof code === 'string' ? code : undefined,
    payload: payload && typeof payload === 'object' ? payload : null,
  });
}

/** FastAPI / custom body: treat as “no messages yet”, not a failure. */
function textIndicatesEmptyChatHistory(text, payload) {
  const parts = [text];
  if (payload && typeof payload === 'object') {
    if (typeof payload.detail === 'string') parts.push(payload.detail);
    if (typeof payload.message === 'string') parts.push(payload.message);
  }
  return parts.some((p) => typeof p === 'string' && /no chat history found/i.test(p));
}

/** Thread rows may use `id`, `chat_thread_id`, or `thread_id` depending on schema / serializer. */
function normalizeThread(thread) {
  if (!thread || typeof thread !== 'object') return thread;
  const id = thread.id ?? thread.chat_thread_id ?? thread.thread_id;
  if (id == null || id === '') return thread;
  return { ...thread, id: String(id) };
}

function buildAuthHeaders(token, extraHeaders = {}) {
  const parsedToken = typeof token === 'string' ? token.trim() : '';
  if (!parsedToken) {
    throw new Error('Missing access token');
  }
  return {
    Authorization: `Bearer ${parsedToken}`,
    'Content-Type': 'application/json',
    ...extraHeaders,
  };
}

/**
 * @param {string} token
 * @returns {Promise<{ threads: object[], quota: ReturnType<typeof normalizeQuota> | null }>}
 */
export async function fetchThreads(token) {
  const response = await fetch(`${API_BASE}/queries/get-active-chat-threads`, {
    method: 'GET',
    headers: buildAuthHeaders(token),
  });
  if (!response.ok) {
    throw await parseError(response);
  }
  const payload = await response.json();
  let list = [];
  if (Array.isArray(payload)) list = payload;
  else if (Array.isArray(payload?.items)) list = payload.items;
  else if (Array.isArray(payload?.threads)) list = payload.threads;
  else if (Array.isArray(payload?.data)) list = payload.data;
  else if (Array.isArray(payload?.results)) list = payload.results;
  return {
    threads: list.map((t) => normalizeThread(t)),
    quota: payload?.quota ? normalizeQuota(payload.quota) : null,
  };
}

export async function createThread(token, title) {
  const response = await fetch(`${API_BASE}/queries/create-chat-thread`, {
    method: 'POST',
    headers: buildAuthHeaders(token, {
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({ title }),
  });
  if (!response.ok) {
    throw await parseError(response);
  }
  return normalizeThread(await response.json());
}

export async function deleteThread(token, threadId) {
  const response = await fetch(`${API_BASE}/queries/delete-chat-thread/${threadId}`, {
    method: 'DELETE',
    headers: buildAuthHeaders(token),
  });
  if (!response.ok) {
    throw await parseError(response);
  }
}

/**
 * @param {string} token
 * @param {string} chatThreadId
 * @param {{ limit?: number, offset?: number, signal?: AbortSignal }} [opts]
 */
export async function fetchChatThreadHistory(token, chatThreadId, opts = {}) {
  const limit = typeof opts.limit === 'number' && opts.limit > 0 ? opts.limit : 50;
  const offset = typeof opts.offset === 'number' && opts.offset >= 0 ? opts.offset : 0;
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  const id = encodeURIComponent(String(chatThreadId).trim());
  const response = await fetch(`${API_BASE}/queries/chat-thread/${id}/history?${params}`, {
    method: 'GET',
    headers: buildAuthHeaders(token),
    signal: opts.signal,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }
    if (
      textIndicatesEmptyChatHistory(text, payload) ||
      // Some APIs return 404 for a new thread until the first message exists.
      response.status === 404
    ) {
      return { items: [], total: 0, limit, offset };
    }
    const message = buildUserFacingMessage(response.status, payload, text);
    const code =
      payload && typeof payload === 'object' ? (payload.error ?? payload.code) : undefined;
    throw new PortalApiError(message, {
      status: response.status,
      code: typeof code === 'string' ? code : undefined,
      payload: payload && typeof payload === 'object' ? payload : null,
    });
  }
  return response.json();
}

/**
 * @param {object | null | undefined} payload
 * @returns {{ allocated: number, consumed: number, remaining: number, resetDate: string | null }}
 */
export function normalizeQuota(payload) {
  const quota = payload && typeof payload === 'object' ? payload : {};
  const allocated = Number(quota.queries_allocated ?? 0);
  const consumed = Number(quota.queries_consumed ?? 0);
  const remaining = Number(quota.queries_remaining ?? Math.max(allocated - consumed, 0));
  const resetRaw =
    typeof quota.reset_date === 'string' && quota.reset_date.trim()
      ? quota.reset_date.trim()
      : typeof quota.billing_period_end === 'string' && quota.billing_period_end.trim()
        ? quota.billing_period_end.trim()
        : null;
  return {
    allocated,
    consumed,
    remaining,
    resetDate: resetRaw,
  };
}

export async function submitQuery(token, query, threadId, { signal } = {}) {
  const response = await fetch(`${API_BASE}/queries/chat/chat-stream`, {
    method: 'POST',
    headers: buildAuthHeaders(token, {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    }),
    body: JSON.stringify({
      query,
      chat_thread_id: threadId,
    }),
    signal,
  });
  if (!response.ok) {
    throw await parseError(response);
  }
  return response;
}
