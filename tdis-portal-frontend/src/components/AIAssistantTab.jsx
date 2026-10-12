import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useKeycloak } from '@/hooks/useKeycloak';
import { submitQuery, fetchChatThreadHistory } from '@/services/threadService';
import {
  parseHistoryPage,
  mapHistoryRecordsToTurns,
  dedupeTurnsById,
} from '@/services/mapChatHistoryToTurns';
import {
  consumeAssistantStream,
  finalizeAssistantTurn,
  reportAssistantError,
} from '@/services/assistantChatStream';
import { trackAiAssistant } from '@/utils/googleAnalytics.js';
import { useThreads } from '@/hooks/useThreads';
import { useHazardBrowseLayer } from '@/hooks/useHazardBrowseLayer';
import AIAssistantChat from './ai-assistant/AIAssistantChat';
import AIAssistantMap from './ai-assistant/AIAssistantMap';
import ThreadList from './ai-assistant/ThreadList';
import './ai-assistant/AIAssistantTab.css';

const MotionDiv = motion.div;
const MotionHeading = motion.h2;
const MotionParagraph = motion.p;

const HISTORY_PAGE_SIZE = 50;

const AIAssistantTab = () => {
  const { initialising, authenticated, error: authError, login, getToken } = useKeycloak();
  const prefersReducedMotion = useReducedMotion();
  const hazardLayer = useHazardBrowseLayer(getToken, authenticated);
  const [turns, setTurns] = useState([]);
  const turnsRef = useRef(turns);
  turnsRef.current = turns;
  const [activeTurnId, setActiveTurnId] = useState('');
  const [lastMapTurnId, setLastMapTurnId] = useState(null);
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyNextOffset, setHistoryNextOffset] = useState(0);
  const [historyRetryTick, setHistoryRetryTick] = useState(0);
  const historySeqRef = useRef(0);
  const historyAbortRef = useRef(null);
  const streamAbortRef = useRef(null);
  const loadOlderSnapshotRef = useRef({
    threadId: null,
    hasMore: false,
    nextOffset: 0,
    loadingMore: false,
    loading: false,
  });
  const {
    threads,
    quota,
    loading: threadsLoading,
    error: threadsError,
    activeThreadId,
    loadThreads,
    createNewThread,
    selectThread,
    removeThread,
  } = useThreads(getToken, !initialising);
  /**
   * After lazy thread creation on first send, server history is often empty while local turns
   * already hold the optimistic turn. Avoid replacing them until the send handler finishes.
   */
  const protectHistoryMergeForThreadIdRef = useRef(null);
  /** Local "new chat" with no server thread until first send. */
  const [isDraftComposer, setIsDraftComposer] = useState(false);
  /** Prevents draft-reset effect from re-selecting an old thread while first message creates a thread. */
  const isCreatingThreadRef = useRef(false);
  const wasAuthenticatedRef = useRef(false);

  useEffect(() => {
    return () => {
      streamAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    loadOlderSnapshotRef.current = {
      threadId: activeThreadId,
      hasMore: historyHasMore,
      nextOffset: historyNextOffset,
      loadingMore: historyLoadingMore,
      loading: historyLoading,
    };
  }, [activeThreadId, historyHasMore, historyNextOffset, historyLoadingMore, historyLoading]);

  useEffect(() => {
    if (!authenticated || !activeThreadId) {
      historyAbortRef.current?.abort();
      return;
    }

    const threadId = activeThreadId;
    const staleProtect = protectHistoryMergeForThreadIdRef.current;
    if (staleProtect && staleProtect !== threadId) {
      protectHistoryMergeForThreadIdRef.current = null;
    }

    const seq = ++historySeqRef.current;

    historyAbortRef.current?.abort();
    const ac = new AbortController();
    historyAbortRef.current = ac;

    setHistoryLoading(true);
    setHistoryError(null);
    setHistoryHasMore(false);
    setHistoryNextOffset(0);

    (async () => {
      try {
        const token = getToken();
        if (!token) {
          if (historySeqRef.current === seq) {
            setTurns([]);
            setHistoryLoading(false);
          }
          return;
        }
        const raw = await fetchChatThreadHistory(token, threadId, {
          limit: HISTORY_PAGE_SIZE,
          offset: 0,
          signal: ac.signal,
        });
        if (historySeqRef.current !== seq) return;

        const { items, hasMore, nextOffset } = parseHistoryPage(raw, HISTORY_PAGE_SIZE, 0);
        const mapped = mapHistoryRecordsToTurns(items, threadId);
        const prevTurns = turnsRef.current;
        const protectId = protectHistoryMergeForThreadIdRef.current;
        const useLocalWhileEmpty =
          mapped.length === 0 && protectId === threadId && prevTurns.length > 0;
        const nextTurns = useLocalWhileEmpty ? prevTurns : mapped;
        if (!useLocalWhileEmpty && protectId === threadId) {
          protectHistoryMergeForThreadIdRef.current = null;
        }
        setTurns(nextTurns);
        setHistoryHasMore(hasMore);
        setHistoryNextOffset(nextOffset);

        const lastWithMap = [...nextTurns].reverse().find((t) => t.mapRecords?.length > 0);
        setLastMapTurnId(lastWithMap ? lastWithMap.id : null);
        const last = nextTurns[nextTurns.length - 1];
        setActiveTurnId(last?.id ?? '');
      } catch (err) {
        if (err?.name === 'AbortError') return;
        if (historySeqRef.current !== seq) return;
        const msg = err instanceof Error ? err.message : 'Could not load conversation history';
        setHistoryError(msg);
        setTurns([]);
        setHistoryHasMore(false);
      } finally {
        if (historySeqRef.current === seq) {
          setHistoryLoading(false);
        }
      }
    })();

    return () => {
      ac.abort();
    };
  }, [authenticated, activeThreadId, getToken, historyRetryTick]);

  /** After sign-in, open a blank composer instead of the most recent thread. */
  useEffect(() => {
    if (authenticated && !wasAuthenticatedRef.current) {
      protectHistoryMergeForThreadIdRef.current = null;
      historySeqRef.current += 1;
      historyAbortRef.current?.abort();
      streamAbortRef.current?.abort();
      selectThread(null);
      setIsDraftComposer(true);
      setTurns([]);
      setActiveTurnId('');
      setLastMapTurnId(null);
      setSelectedFeature(null);
      setHistoryError(null);
      setHistoryHasMore(false);
      setHistoryNextOffset(0);
    }
    wasAuthenticatedRef.current = authenticated;
    if (!authenticated) {
      setIsDraftComposer(false);
    }
  }, [authenticated, selectThread]);

  /** No active thread → blank draft (login, new chat, empty list). Never auto-open threads[0]. */
  useEffect(() => {
    if (!authenticated || threadsLoading) return;
    if (activeThreadId != null) return;
    if (isDraftComposer) return;
    if (isCreatingThreadRef.current) return;
    setIsDraftComposer(true);
  }, [authenticated, threadsLoading, activeThreadId, isDraftComposer]);

  /**
   * Handles sending a user message and calling the AI Assistant via Portal API
   */
  const handleSendMessage = useCallback(
    async (userText) => {
      if (!userText.trim() || isLoading) return;

      trackAiAssistant('send_message');

      const turnId = `turn-${Date.now()}`;
      const createdAt = new Date().toISOString();

      // Add user message immediately
      const userTurn = {
        id: turnId,
        createdAt,
        userText,
        assistantText: '',
      };

      setTurns((prev) => [...prev, userTurn]);
      setActiveTurnId(turnId);
      setIsLoading(true);
      setSelectedFeature(null);

      const streamAbort = new AbortController();
      streamAbortRef.current = streamAbort;

      try {
        const accessToken = getToken();
        let threadId = activeThreadId;
        if (!threadId) {
          isCreatingThreadRef.current = true;
          const titleFromMessage = userText.trim().slice(0, 80);
          try {
            const createdThread = await createNewThread(titleFromMessage || 'New Conversation');
            threadId = createdThread.id;
            protectHistoryMergeForThreadIdRef.current = threadId;
            setIsDraftComposer(false);
          } finally {
            isCreatingThreadRef.current = false;
          }
        }

        const streamRes = await submitQuery(accessToken, userText, threadId, {
          signal: streamAbort.signal,
        });
        const streamContext = {
          streamAbort,
          turnId,
          setTurns,
          setLastMapTurnId,
          setIsLoading,
        };
        const streamState = await consumeAssistantStream(streamRes.body, streamContext);
        const completed = finalizeAssistantTurn({ ...streamContext, ...streamState });
        if (completed) await loadThreads();
      } catch (err) {
        await reportAssistantError(err, turnId, setTurns, loadThreads);
      } finally {
        if (streamAbortRef.current === streamAbort) {
          streamAbortRef.current = null;
        }
        setIsLoading(false);
      }
    },
    [isLoading, getToken, activeThreadId, createNewThread, loadThreads]
  );

  /**
   * UI-only stop: cancel the browser request, drop the busy state right away, and keep whatever
   * partial reply already streamed in. The backend may still finish the query on its own.
   */
  const handleStopGeneration = useCallback(() => {
    const controller = streamAbortRef.current;
    streamAbortRef.current = null;
    controller?.abort();
    setIsLoading(false);
    setTurns((prev) =>
      prev.map((turn) => (turn._isStreaming ? { ...turn, _isStreaming: false } : turn))
    );
  }, []);

  /**
   * Map layer context for the active / last-map turn (records + streaming flag for camera).
   */
  const getActiveMapContext = useCallback(() => {
    const turnId = lastMapTurnId || activeTurnId;
    if (!turnId) return { mapRecords: undefined, isMapStreaming: false };
    const turn = turns.find((t) => t.id === turnId);
    return {
      mapRecords: turn?.mapRecords,
      mapColumns: turn?.mapColumns,
      isMapStreaming: turn?._isStreaming === true,
    };
  }, [turns, activeTurnId, lastMapTurnId]);

  const handleRetryHistory = useCallback(() => {
    setHistoryRetryTick((t) => t + 1);
  }, []);

  /** While a reply streams, the tab is read-only except for the composer's Stop control. */
  const isAssistantBusy = isLoading || turns.some((turn) => turn._isStreaming);

  const handleSelectHazardMetric = useCallback(
    (metric) => {
      hazardLayer.selectMetric(metric);
      setSelectedFeature(null);
    },
    [hazardLayer]
  );

  const loadOlderHistory = useCallback(async () => {
    const snap = loadOlderSnapshotRef.current;
    if (!snap.threadId || !snap.hasMore || snap.loadingMore || snap.loading) {
      return;
    }
    const threadAtStart = snap.threadId;
    const offsetAtStart = snap.nextOffset;

    setHistoryLoadingMore(true);
    setHistoryError(null);
    try {
      const token = getToken();
      if (!token) return;

      const raw = await fetchChatThreadHistory(token, threadAtStart, {
        limit: HISTORY_PAGE_SIZE,
        offset: offsetAtStart,
      });

      if (loadOlderSnapshotRef.current.threadId !== threadAtStart) {
        return;
      }

      const { items, hasMore, nextOffset } = parseHistoryPage(
        raw,
        HISTORY_PAGE_SIZE,
        offsetAtStart
      );
      const mapped = mapHistoryRecordsToTurns(items, threadAtStart, `hist-${offsetAtStart}`);
      setTurns((prev) => dedupeTurnsById([...mapped, ...prev]));
      setHistoryHasMore(hasMore);
      setHistoryNextOffset(nextOffset);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not load older messages';
      setHistoryError(msg);
    } finally {
      setHistoryLoadingMore(false);
    }
  }, [getToken]);

  if (initialising) {
    const instant = prefersReducedMotion === true;
    return (
      <section
        className="ai-assistant-auth-shell ai-assistant-auth-shell--busy"
        aria-label="Authentication status"
      >
        <MotionDiv
          className="ai-assistant-auth-panel"
          role="presentation"
          initial={instant ? false : { opacity: 0.85, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={instant ? { duration: 0 } : { duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="ai-assistant-auth-accent" aria-hidden />
          <div className="ai-auth-session-meter" aria-hidden="true">
            <div className="ai-auth-session-meter__track">
              <div className="ai-auth-session-meter__bar" />
            </div>
          </div>
          <div className="ai-assistant-auth-inner">
            <MotionParagraph
              className="ai-assistant-auth-kicker"
              initial={instant ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={
                instant ? { duration: 0 } : { delay: 0.06, duration: 0.32, ease: 'easeOut' }
              }
            >
              TDIS AI Assistant
            </MotionParagraph>
            <MotionHeading
              className="ai-assistant-auth-title"
              id="ai-assistant-auth-heading"
              initial={instant ? false : { opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={
                instant ? { duration: 0 } : { delay: 0.12, duration: 0.36, ease: [0.16, 1, 0.3, 1] }
              }
            >
              Checking your session
            </MotionHeading>
            <MotionParagraph
              className="ai-assistant-auth-loading"
              role="status"
              aria-live="polite"
              aria-busy="true"
              initial={instant ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={
                instant ? { duration: 0 } : { delay: 0.2, duration: 0.35, ease: 'easeOut' }
              }
            >
              Verifying sign-in with your organization. This usually takes a moment.
            </MotionParagraph>
            <div className="ai-auth-loading-dots" aria-hidden="true">
              <span className="ai-auth-loading-dots__dot" />
              <span className="ai-auth-loading-dots__dot" />
              <span className="ai-auth-loading-dots__dot" />
            </div>
          </div>
        </MotionDiv>
      </section>
    );
  }

  if (authError) {
    return (
      <section className="ai-assistant-auth-shell" aria-label="Authentication error">
        <div className="ai-assistant-auth-panel">
          <div className="ai-assistant-auth-accent" aria-hidden />
          <div className="ai-assistant-auth-inner">
            <p className="ai-assistant-auth-kicker">TDIS AI Assistant</p>
            <h2 className="ai-assistant-auth-title" id="ai-assistant-auth-heading">
              Sign-in is unavailable
            </h2>
            <p className="ai-assistant-auth-error-msg" role="alert">
              {authError}
            </p>
            <p className="ai-assistant-auth-hint">
              If the problem continues, confirm you are online and that authentication services are
              reachable, then try again.
            </p>
            <div className="ai-assistant-auth-actions ai-assistant-auth-actions--full">
              <button
                type="button"
                className="ai-assistant-auth-btn ai-assistant-auth-btn--primary"
                onClick={() => window.location.reload()}
              >
                Reload and retry
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!authenticated) {
    return (
      <section className="ai-assistant-auth-shell" aria-labelledby="ai-assistant-auth-heading">
        <div className="ai-assistant-auth-panel">
          <div className="ai-assistant-auth-accent" aria-hidden />
          <div className="ai-assistant-auth-inner">
            <p className="ai-assistant-auth-kicker">TDIS AI Assistant</p>
            <h2 className="ai-assistant-auth-title" id="ai-assistant-auth-heading">
              Sign in to continue
            </h2>
            <p className="ai-assistant-auth-lead">
              The assistant uses your TDIS identity. After you sign in, you will land back on this
              tab with the map and chat ready to use.
            </p>
            <div className="ai-assistant-auth-actions ai-assistant-auth-actions--full">
              <button
                type="button"
                className="ai-assistant-auth-btn ai-assistant-auth-btn--primary"
                onClick={() => {
                  trackAiAssistant('sign_in');
                  login();
                }}
              >
                Sign in with your account
              </button>
            </div>
            <div className="ai-assistant-auth-access">
              <p className="ai-assistant-auth-access__text">Don&apos;t have access?</p>
              <Link
                to="/request-access"
                className="ai-assistant-auth-btn ai-assistant-auth-btn--outline"
                onClick={() => trackAiAssistant('request_access')}
              >
                Request Access
              </Link>
            </div>
            <p className="ai-assistant-auth-footnote">
              You may be redirected to your organization&apos;s sign-in page.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const handleNewThread = () => {
    trackAiAssistant('new_thread');
    streamAbortRef.current?.abort();
    historySeqRef.current += 1;
    historyAbortRef.current?.abort();
    setIsDraftComposer(true);
    protectHistoryMergeForThreadIdRef.current = null;
    selectThread(null);
    setHistoryError(null);
    setHistoryHasMore(false);
    setHistoryNextOffset(0);
    setTurns([]);
    setActiveTurnId('');
    setLastMapTurnId(null);
    setSelectedFeature(null);
  };

  const handleSelectThread = (threadId) => {
    trackAiAssistant('select_thread');
    streamAbortRef.current?.abort();
    historySeqRef.current += 1;
    historyAbortRef.current?.abort();
    setIsDraftComposer(false);
    protectHistoryMergeForThreadIdRef.current = null;
    selectThread(threadId);
    setHistoryError(null);
    setTurns([]);
    setActiveTurnId('');
    setLastMapTurnId(null);
    setSelectedFeature(null);
  };

  const handleDeleteThread = async (threadId) => {
    const wasActive = activeThreadId === threadId;
    try {
      await removeThread(threadId);
      trackAiAssistant('delete_thread');
      if (wasActive) {
        streamAbortRef.current?.abort();
        historySeqRef.current += 1;
        historyAbortRef.current?.abort();
        selectThread(null);
        setIsDraftComposer(true);
        setTurns([]);
        setActiveTurnId('');
        setLastMapTurnId(null);
        setSelectedFeature(null);
        setHistoryError(null);
        setHistoryHasMore(false);
        setHistoryNextOffset(0);
      }
    } catch {
      /* Delete failed silently — user can retry */
    }
  };

  return (
    <div className="ai-assistant-tab-root flex min-h-0 flex-col pt-14">
      <div className="flex min-h-0 flex-1">
        <div className="ai-assistant-container h-full min-h-0">
          <AIAssistantMap
            {...getActiveMapContext()}
            isAnswering={isAssistantBusy}
            selectedFeature={selectedFeature}
            onSelectFeature={setSelectedFeature}
            hazardMetric={hazardLayer.hazardMetric}
            hazardRecords={hazardLayer.records}
            hazardLoading={hazardLayer.loading}
            hazardError={hazardLayer.error}
            preferHazardLayer={hazardLayer.preferBrowse}
            onSelectHazardMetric={handleSelectHazardMetric}
            onAnswerMapAvailable={hazardLayer.showAnswerMap}
            onShowAnswerMap={hazardLayer.showAnswerMap}
          />
          <div className="ai-assistant-rail">
            <ThreadList
              locked={isAssistantBusy}
              threads={threads}
              activeThreadId={activeThreadId}
              isDraftComposer={isDraftComposer}
              loading={threadsLoading}
              error={threadsError}
              onRetry={loadThreads}
              onSelectThread={handleSelectThread}
              onNewThread={handleNewThread}
              onDeleteThread={handleDeleteThread}
            />
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <AIAssistantChat
                key={activeThreadId ?? (isDraftComposer ? 'draft' : 'none')}
                turns={turns}
                isLoading={isLoading}
                onSendMessage={handleSendMessage}
                onStopGeneration={handleStopGeneration}
                historyLoading={historyLoading}
                historyLoadingMore={historyLoadingMore}
                historyHasMore={historyHasMore}
                historyError={historyError}
                onLoadOlderHistory={loadOlderHistory}
                onRetryHistory={handleRetryHistory}
                quota={quota}
                quotaLoading={threadsLoading}
                quotaError={threadsError}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAssistantTab;
