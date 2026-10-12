/**
 * Session ID utility for LangGraph memory persistence.
 *
 * Generates a single UUID v4 per page load and returns the same value on every
 * subsequent call. This ensures all AI Assistant turns within one browser
 * session share the same thread_id in the LangGraph backend.
 */

let _sessionId = null;

/**
 * Returns a stable session UUID for the current page lifecycle.
 * The ID is lazily created on the first call and reused thereafter.
 *
 * @returns {string} A UUID v4 string, e.g. "f47ac10b-58cc-4372-a567-0e02b2c3d479"
 */
export function getSessionId() {
  if (!_sessionId) {
    _sessionId = crypto.randomUUID();
  }
  return _sessionId;
}

/**
 * Resets the cached session ID so the next call to {@link getSessionId}
 * generates a fresh UUID. Exposed primarily for testing.
 */
export function resetSessionId() {
  _sessionId = null;
}
