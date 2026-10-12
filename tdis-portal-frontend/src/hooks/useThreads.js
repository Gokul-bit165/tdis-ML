import { useCallback, useEffect, useState } from 'react';
import { createThread, deleteThread, fetchThreads } from '@/services/threadService';

/**
 * @param {() => string | null | undefined} getToken
 * @param {boolean} sessionReady — false while Keycloak is still initialising; avoids racing
 *   {@link fetchThreads} before {@code keycloak.token} exists (first visit after redirect).
 */
export function useThreads(getToken, sessionReady = true) {
  const [threads, setThreads] = useState([]);
  const [quota, setQuota] = useState(null);
  /** Start true so we never treat "not loaded yet" as an empty list (avoids racing createNewThread before fetch completes). */
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeThreadId, setActiveThreadId] = useState(null);

  const loadThreads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        setThreads([]);
        setActiveThreadId(null);
        return;
      }
      const { threads: nextThreads, quota: nextQuota } = await fetchThreads(token);
      setThreads(nextThreads);
      setQuota(nextQuota ?? null);
      setActiveThreadId((current) => {
        if (current && nextThreads.some((thread) => thread.id === current)) {
          return current;
        }
        // Keep explicit "no thread" (draft composer) across list refresh — do not snap to first.
        if (current == null) {
          return null;
        }
        return nextThreads[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  const createNewThread = useCallback(
    async (title) => {
      const threadTitle =
        typeof title === 'string' && title.trim() ? title.trim() : 'New Conversation';
      const token = await getToken();
      const newThread = await createThread(token, threadTitle);
      setThreads((prev) => [newThread, ...prev.filter((thread) => thread.id !== newThread.id)]);
      setActiveThreadId(newThread.id);
      setError(null);
      return newThread;
    },
    [getToken]
  );

  const selectThread = useCallback((threadId) => {
    setActiveThreadId(threadId);
  }, []);

  const removeThread = useCallback(
    async (threadId) => {
      const token = await getToken();
      await deleteThread(token, threadId);
      setThreads((prev) => {
        const next = prev.filter((thread) => thread.id !== threadId);
        setActiveThreadId((current) => (current === threadId ? (next[0]?.id ?? null) : current));
        return next;
      });
      setError(null);
    },
    [getToken]
  );

  useEffect(() => {
    if (!sessionReady) {
      return;
    }
    loadThreads();
  }, [loadThreads, sessionReady]);

  return {
    threads,
    quota,
    loading,
    error,
    activeThreadId,
    loadThreads,
    createNewThread,
    selectThread,
    removeThread,
  };
}
