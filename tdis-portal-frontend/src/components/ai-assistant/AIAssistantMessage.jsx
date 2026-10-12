import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { CheckCircle2, Gauge } from 'lucide-react';
import { formatQuotaResetDate } from '@/services/threadService';
import './AIAssistantTab.css';

/**
 * @param {string} text
 * @returns {string} Human label inside [status: …]
 */
function formatStatusLabel(text) {
  const m = /^\[status:\s*([^\]]+)\]/i.exec(text.trim());
  return m ? m[1].trim() : text.trim();
}

/** Interim orchestrator chips to drop once real assistant content is shown. */
const TRANSIENT_PROGRESS_LABEL_RE =
  /^(planning complete|querying data complete|preparing map data complete)\.?$/i;

/**
 * @param {{ text?: string, variant?: string, role?: string }} seg
 */
function isTransientProgressSegment(seg) {
  const raw = String(seg.text ?? '').trim();
  if (!raw) return false;
  const looksLikeStatusWrapper = /^\[status:/i.test(raw);
  const isStatusSeg = seg.variant === 'status' || seg.role === 'status' || looksLikeStatusWrapper;
  if (isStatusSeg) {
    return TRANSIENT_PROGRESS_LABEL_RE.test(formatStatusLabel(seg.text));
  }
  if (seg.variant === 'content' || seg.variant === 'answer') {
    return TRANSIENT_PROGRESS_LABEL_RE.test(raw);
  }
  return false;
}

/**
 * @param {object[]} segments
 * @param {number} afterIndex
 * @param {number} maxIdxInclusive
 */
function hasSubsequentNonTransientSegment(segments, afterIndex, maxIdxInclusive) {
  for (let j = afterIndex + 1; j <= maxIdxInclusive && j < segments.length; j++) {
    if (!isTransientProgressSegment(segments[j])) return true;
  }
  return false;
}

/**
 * @param {{ payload: Record<string, unknown> | null | undefined }} props
 */
function AssistantQuotaError({ payload }) {
  if (!payload || typeof payload !== 'object') return null;
  return (
    <div className="ai-error-card ai-error-card--quota" role="alert">
      <div className="ai-error-card__lead">
        <div className="ai-error-card__icon" aria-hidden>
          <Gauge size={22} strokeWidth={2} />
        </div>
        <div>
          <h4 className="ai-error-card__title">Query limit reached</h4>
          <p className="ai-error-card__summary">
            You have used all AI queries for this period. You can send new questions after your
            quota resets.
          </p>
        </div>
      </div>
      {(typeof payload.reset_date === 'string' && payload.reset_date.trim()) ||
      typeof payload.queries_allocated === 'number' ? (
        <dl className="ai-error-card__meta">
          {typeof payload.reset_date === 'string' && payload.reset_date.trim() ? (
            <>
              <dt>Resets on</dt>
              <dd>{formatQuotaResetDate(payload.reset_date.trim())}</dd>
            </>
          ) : null}
          {typeof payload.queries_allocated === 'number' ? (
            <>
              <dt>Allowance</dt>
              <dd>
                {typeof payload.queries_remaining === 'number'
                  ? `${payload.queries_remaining} of ${payload.queries_allocated} queries left this period`
                  : `${payload.queries_allocated} queries per period`}
              </dd>
            </>
          ) : null}
        </dl>
      ) : null}
    </div>
  );
}

/**
 * @param {object} props
 * @param {object} props.turn
 * @param {boolean} [props.isStreaming]
 */
const AIAssistantMessage = ({ turn, isStreaming = false }) => {
  const prefersReducedMotion = useReducedMotion();
  const hasMap = turn.mapRecords && turn.mapRecords.length > 0;
  const segments = turn.assistantSegments;
  const maxIdx = typeof turn.revealedSegmentIndex === 'number' ? turn.revealedSegmentIndex : -1;
  const useSegments = Array.isArray(segments) && segments.length > 0;

  const visibleSegments = useSegments
    ? segments
        .map((seg, i) => ({ seg, i }))
        .filter(({ i }) => i <= maxIdx)
        .filter(
          ({ seg, i }) =>
            !isTransientProgressSegment(seg) ||
            !hasSubsequentNonTransientSegment(segments, i, maxIdx)
        )
        .map(({ seg }) => seg)
    : [];

  const isError =
    !useSegments && turn.assistantText && /^Error:/i.test(String(turn.assistantText).trim());
  const isQuotaUi =
    isError &&
    turn.assistantApiError &&
    typeof turn.assistantApiError === 'object' &&
    (turn.assistantApiStatus === 429 || turn.assistantApiError.error === 'quota_exceeded');
  const errorBodyText = isError
    ? String(turn.assistantText)
        .replace(/^\s*Error:\s*/i, '')
        .trim()
    : '';
  const legacyStreaming = isStreaming && turn._isStreaming && !useSegments;

  const spring = prefersReducedMotion
    ? { duration: 0.01 }
    : { type: 'spring', stiffness: 420, damping: 32, mass: 0.85 };

  return (
    <>
      {turn.userText && (
        <div className="ai-msg ai-msg-user">
          <div className="ai-msg-content ai-msg-content--user">
            <div className="ai-msg-text">{turn.userText}</div>
          </div>
        </div>
      )}

      {useSegments && (
        <div className="ai-msg ai-msg-assistant" aria-live="polite" aria-relevant="additions">
          <div className="ai-assistant-column">
            {isStreaming && maxIdx >= 0 && maxIdx < segments.length - 1 && (
              <div className="ai-live-rail" aria-hidden>
                <span className="ai-live-rail__dot" />
                <span className="ai-live-rail__text">Updating</span>
              </div>
            )}
            <AnimatePresence mode="popLayout" initial={false}>
              {visibleSegments.map((seg) => {
                const isStatus = seg.variant === 'status' || seg.role === 'status';
                const isAnswer = seg.variant === 'answer';

                if (isStatus) {
                  return (
                    <motion.div
                      key={seg.id}
                      layout
                      initial={prefersReducedMotion ? false : { opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={spring}
                      className="ai-segment ai-segment--status"
                    >
                      <div
                        className="ai-status-chip"
                        role="status"
                        aria-label={formatStatusLabel(seg.text)}
                      >
                        <span className="ai-status-chip__mark" aria-hidden>
                          <CheckCircle2 size={13} strokeWidth={2.5} />
                        </span>
                        <span className="ai-status-chip__label">{formatStatusLabel(seg.text)}</span>
                      </div>
                    </motion.div>
                  );
                }

                return (
                  <motion.div
                    key={seg.id}
                    layout
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={spring}
                    className={`ai-segment ${isAnswer ? 'ai-segment--answer' : 'ai-segment--content'}`}
                  >
                    <div
                      className={
                        isAnswer
                          ? 'ai-answer-card'
                          : 'ai-msg-content ai-msg-content--assistant-plain'
                      }
                    >
                      <div className="ai-msg-text ai-msg-markdown">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{seg.text}</ReactMarkdown>
                      </div>
                      {hasMap && !isStreaming && isAnswer && (
                        <div className="ai-map-badge">
                          <span className="ai-badge-icon">🗺️</span>
                          <span>Map data ready</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}

      {!useSegments && turn.assistantText && (
        <div className="ai-msg ai-msg-assistant">
          {isQuotaUi ? (
            <AssistantQuotaError payload={turn.assistantApiError} />
          ) : (
            <div
              className={
                isError
                  ? 'ai-msg-content ai-msg-content--error'
                  : 'ai-msg-content ai-msg-content--assistant-plain'
              }
            >
              <div className="ai-msg-text ai-msg-markdown">
                {isError ? (
                  <p
                    className={
                      errorBodyText.includes('\n')
                        ? 'ai-error-plain ai-error-plain--multiline'
                        : 'ai-error-plain'
                    }
                  >
                    {errorBodyText}
                  </p>
                ) : (
                  <>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{turn.assistantText}</ReactMarkdown>
                    {legacyStreaming && <span className="ai-typing-cursor">▊</span>}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default AIAssistantMessage;
