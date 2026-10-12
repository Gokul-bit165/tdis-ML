import React, { useRef, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Sparkles, Loader2 } from 'lucide-react';
import AIAssistantMessage from './AIAssistantMessage';
import AIAssistantComposer from './AIAssistantComposer';
import AIAssistantQuotaBar from './AIAssistantQuotaBar';
import AIAssistantThinking from './AIAssistantThinking';
import './AIAssistantTab.css';

const SCROLL_TOP_THRESHOLD_PX = 72;
const LOAD_OLDER_COOLDOWN_MS = 500;

/**
 * @param {object} props
 * @param {object[]} props.turns
 * @param {boolean} props.isLoading
 * @param {(text: string) => void} props.onSendMessage
 * @param {() => void} [props.onStopGeneration]

 * @param {boolean} [props.historyLoading]
 * @param {boolean} [props.historyLoadingMore]
 * @param {boolean} [props.historyHasMore]
 * @param {string|null} [props.historyError]
 * @param {() => Promise<void>|void} [props.onLoadOlderHistory]
 * @param {() => void} [props.onRetryHistory]
 * @param {{ allocated: number, consumed: number, remaining: number, resetDate: string | null } | null} [props.quota]
 * @param {boolean} [props.quotaLoading]
 * @param {string | null} [props.quotaError]
 */
const AIAssistantChat = ({
  turns,
  isLoading,
  onSendMessage,
  onStopGeneration,
  historyLoading = false,
  historyLoadingMore = false,
  historyHasMore = false,
  historyError = null,
  onLoadOlderHistory,
  onRetryHistory,
  quota = null,
  quotaLoading = false,
  quotaError = null,
}) => {
  const messagesEndRef = useRef(null);
  const scrollRootRef = useRef(null);
  const ignoreNextAutoScrollRef = useRef(false);
  const lastOlderFetchRef = useRef(0);

  useEffect(() => {
    if (ignoreNextAutoScrollRef.current) {
      ignoreNextAutoScrollRef.current = false;
      return;
    }
    if (turns.length === 0 && !isLoading) return;

    const streaming = isLoading || turns.some((t) => t._isStreaming);
    const timeoutId = setTimeout(
      () => {
        messagesEndRef.current?.scrollIntoView({
          behavior: streaming ? 'smooth' : 'auto',
          block: 'end',
        });
      },
      streaming ? 50 : 0
    );
    return () => clearTimeout(timeoutId);
  }, [turns, isLoading]);

  const isAssistantBusy = isLoading || turns.some((t) => t._isStreaming);

  const handleScroll = useCallback(() => {
    const el = scrollRootRef.current;
    if (
      !el ||
      isAssistantBusy ||
      historyLoading ||
      historyLoadingMore ||
      !historyHasMore ||
      typeof onLoadOlderHistory !== 'function'
    ) {
      return;
    }
    if (el.scrollTop > SCROLL_TOP_THRESHOLD_PX) return;
    if (Date.now() - lastOlderFetchRef.current < LOAD_OLDER_COOLDOWN_MS) return;

    lastOlderFetchRef.current = Date.now();
    ignoreNextAutoScrollRef.current = true;

    const prevHeight = el.scrollHeight;
    const prevTop = el.scrollTop;

    void Promise.resolve(onLoadOlderHistory()).then(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const next = scrollRootRef.current;
          if (!next) return;
          next.scrollTop = next.scrollHeight - prevHeight + prevTop;
        });
      });
    });
  }, [isAssistantBusy, historyLoading, historyLoadingMore, historyHasMore, onLoadOlderHistory]);

  const showEmptyState = turns.length === 0 && !isLoading && !historyLoading && !historyError;

  const quotaExhausted = quota != null && quota.remaining <= 0;
  const composerDisabled = historyLoading || quotaExhausted;

  return (
    <div className="ai-chat-panel">
      <div
        ref={scrollRootRef}
        className="ai-chat-messages"
        onScroll={handleScroll}
        aria-busy={isAssistantBusy || undefined}
      >
        {historyError && (
          <div className="ai-chat-history-error" role="alert">
            <p>{historyError}</p>
            {typeof onRetryHistory === 'function' ? (
              <button type="button" className="ai-chat-history-retry" onClick={onRetryHistory}>
                Try again
              </button>
            ) : null}
          </div>
        )}

        {historyLoading && turns.length === 0 ? (
          <div className="ai-chat-history-loading" role="status" aria-live="polite">
            <Loader2 className="ai-chat-history-loading__icon" size={22} aria-hidden />
            <span>Loading conversation…</span>
          </div>
        ) : null}

        {historyLoadingMore ? (
          <div
            className="ai-chat-history-loading ai-chat-history-loading--inline"
            aria-live="polite"
          >
            <Loader2 className="ai-chat-history-loading__icon" size={18} aria-hidden />
            <span>Loading older messages…</span>
          </div>
        ) : null}

        {showEmptyState ? (
          <div className="ai-chat-empty">
            <div className="ai-chat-empty-icon" aria-hidden>
              <Sparkles size={26} strokeWidth={2} />
            </div>
            <h3>TDIS AI Assistant</h3>
            <p className="ai-chat-empty-lead">
              Ask about Texas hazards, weather, infrastructure, and more. Updates appear step by
              step as the model works.
            </p>
          </div>
        ) : null}

        {turns.map((turn) => (
          <AIAssistantMessage key={turn.id} turn={turn} isStreaming={turn._isStreaming || false} />
        ))}
        {isAssistantBusy && <AIAssistantThinking />}
        <div ref={messagesEndRef} />
      </div>
      <AIAssistantQuotaBar quota={quota} loading={quotaLoading} error={quotaError} />
      <AIAssistantComposer
        onSend={onSendMessage}
        onStop={onStopGeneration}
        disabled={composerDisabled}
        isStreaming={isAssistantBusy}
      />
    </div>
  );
};

AIAssistantChat.propTypes = {
  turns: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      _isStreaming: PropTypes.bool,
    })
  ).isRequired,
  isLoading: PropTypes.bool.isRequired,
  onSendMessage: PropTypes.func.isRequired,
  onStopGeneration: PropTypes.func,
  historyLoading: PropTypes.bool,
  historyLoadingMore: PropTypes.bool,
  historyHasMore: PropTypes.bool,
  historyError: PropTypes.string,
  onLoadOlderHistory: PropTypes.func,
  onRetryHistory: PropTypes.func,
  quota: PropTypes.shape({
    allocated: PropTypes.number,
    consumed: PropTypes.number,
    remaining: PropTypes.number.isRequired,
    resetDate: PropTypes.string,
  }),
  quotaLoading: PropTypes.bool,
  quotaError: PropTypes.string,
};

export default AIAssistantChat;
