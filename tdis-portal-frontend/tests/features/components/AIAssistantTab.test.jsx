/**
 * @fileoverview Unit tests for AIAssistantTab send/history/thread wiring.
 * Feature: components
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AIAssistantTab from '@/components/AIAssistantTab';

const keycloakState = vi.hoisted(() => {
  const state = {
    initialising: false,
    authenticated: true,
    error: null,
    login: vi.fn(),
    token: 'token',
    getToken: () => state.token,
  };
  return state;
});

const threadFns = vi.hoisted(() => ({
  loadThreads: vi.fn(),
  createNewThread: vi.fn(),
  removeThread: vi.fn(),
  loading: false,
  error: null,
  selectOnCreate: false,
}));

const hazardMocks = vi.hoisted(() => ({
  selectMetric: vi.fn(),
  showAnswerMap: vi.fn(),
  lastMapProps: null,
}));

const motionMocks = vi.hoisted(() => ({ reduced: false }));

vi.mock('@/hooks/useKeycloak', () => ({
  useKeycloak: () => keycloakState,
}));

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useReducedMotion: () => motionMocks.reduced,
  };
});

vi.mock('@/hooks/useThreads', async () => {
  const { useState } = await import('react');
  return {
    useThreads: () => {
      const [activeThreadId, setActiveThreadId] = useState(null);
      const [threads] = useState([
        { id: 'thread-1', title: 'Floods', last_active_at: '2026-08-01T12:00:00Z' },
        { id: 'thread-2', title: 'Wind', last_active_at: '2026-07-01T12:00:00Z' },
      ]);
      return {
        threads,
        quota: { allocated: 20, consumed: 1, remaining: 19, resetDate: null },
        loading: threadFns.loading,
        error: threadFns.error,
        activeThreadId,
        loadThreads: threadFns.loadThreads,
        createNewThread: async (title) => {
          const created = await threadFns.createNewThread(title);
          if (threadFns.selectOnCreate) {
            setActiveThreadId(created.id);
          }
          return created;
        },
        selectThread: setActiveThreadId,
        removeThread: async (id) => {
          await threadFns.removeThread(id);
          setActiveThreadId((current) => (current === id ? null : current));
        },
      };
    },
  };
});

vi.mock('@/hooks/useHazardBrowseLayer', () => ({
  useHazardBrowseLayer: () => ({
    hazardMetric: 'HRCN',
    records: [],
    loading: false,
    error: null,
    preferBrowse: true,
    selectMetric: hazardMocks.selectMetric,
    showAnswerMap: hazardMocks.showAnswerMap,
  }),
}));

vi.mock('@/components/ai-assistant/AIAssistantMap', () => ({
  default: (props) => {
    hazardMocks.lastMapProps = props;
    return (
      <div data-testid="ai-map">
        <button type="button" onClick={() => props.onSelectHazardMetric?.('WFIR')}>
          pick-hazard
        </button>
        <button type="button" onClick={() => props.onSelectFeature?.({ id: 'feat-1' })}>
          pick-feature
        </button>
        <button type="button" onClick={() => props.onShowAnswerMap?.()}>
          show-answer-map
        </button>
        <button type="button" onClick={() => props.onAnswerMapAvailable?.()}>
          answer-map-ready
        </button>
      </div>
    );
  },
}));

vi.mock('@/services/threadService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    submitQuery: vi.fn(),
    fetchChatThreadHistory: vi.fn(),
  };
});

function mockStreamBody(chunks) {
  const encoder = new TextEncoder();
  let i = 0;
  return {
    getReader() {
      return {
        read() {
          return i < chunks.length
            ? Promise.resolve({ done: false, value: encoder.encode(chunks[i++]) })
            : Promise.resolve({ done: true, value: undefined });
        },
        releaseLock() {},
      };
    },
  };
}

const COMPOSER_PLACEHOLDER = 'Ask TDIS AI anything...';
const SEND_LABEL = 'Send message';
const STOP_LABEL = 'Stop generating';

function renderTab() {
  return render(
    <MemoryRouter>
      <AIAssistantTab />
    </MemoryRouter>
  );
}

describe('AIAssistantTab', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
    keycloakState.initialising = false;
    keycloakState.authenticated = true;
    keycloakState.error = null;
    keycloakState.login = vi.fn();
    keycloakState.token = 'token';
    threadFns.loading = false;
    threadFns.error = null;
    threadFns.selectOnCreate = false;
    threadFns.createNewThread.mockResolvedValue({ id: 'thread-new' });
    threadFns.removeThread.mockResolvedValue(undefined);
    motionMocks.reduced = false;
    hazardMocks.lastMapProps = null;
    const { submitQuery, fetchChatThreadHistory } = await import('@/services/threadService');
    vi.mocked(submitQuery).mockResolvedValue({
      body: mockStreamBody([
        'data: {"kind":"chat.final","payload":{"text":"Austin is in Texas."}}\n\n',
      ]),
    });
    vi.mocked(fetchChatThreadHistory).mockResolvedValue({ items: [] });
  });

  it('streams a reply into the transcript', async () => {
    const user = userEvent.setup();
    renderTab();

    await user.type(screen.getByPlaceholderText(COMPOSER_PLACEHOLDER), 'Where is Austin?');
    await user.click(screen.getByRole('button', { name: SEND_LABEL }));

    await waitFor(() => {
      expect(screen.getByText(/Austin is in Texas/)).toBeInTheDocument();
    });
    expect(threadFns.loadThreads).toHaveBeenCalled();
    expect(threadFns.createNewThread).toHaveBeenCalled();
  }, 15000);

  it('stops generation while a reply is in flight', async () => {
    const user = userEvent.setup();
    const { submitQuery } = await import('@/services/threadService');
    let release;
    vi.mocked(submitQuery).mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      })
    );

    renderTab();
    await user.type(screen.getByPlaceholderText(COMPOSER_PLACEHOLDER), 'Slow question');
    await user.click(screen.getByRole('button', { name: SEND_LABEL }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: STOP_LABEL })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: STOP_LABEL }));

    release({
      body: mockStreamBody(['data: {"kind":"chat.final","payload":{"text":"late answer"}}\n\n']),
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: SEND_LABEL })).toBeInTheDocument();
    });
  }, 15000);

  it('records an error turn when the stream fails', async () => {
    const user = userEvent.setup();
    const { submitQuery } = await import('@/services/threadService');
    vi.mocked(submitQuery).mockRejectedValue(new Error('orchestrator down'));

    renderTab();
    await user.type(screen.getByPlaceholderText(COMPOSER_PLACEHOLDER), 'Fail please');
    await user.click(screen.getByRole('button', { name: SEND_LABEL }));

    await waitFor(() => {
      expect(screen.getByText(/orchestrator down/)).toBeInTheDocument();
    });
  }, 15000);

  it('loads thread history, older pages, and retries after an error', async () => {
    const user = userEvent.setup();
    const { fetchChatThreadHistory } = await import('@/services/threadService');
    vi.mocked(fetchChatThreadHistory)
      .mockRejectedValueOnce(new Error('history down'))
      .mockResolvedValueOnce({
        items: [{ id: 'm1', user_message: 'Hello', assistant_response: 'Hi there' }],
        has_more: true,
        next_offset: 1,
      })
      .mockResolvedValueOnce({
        items: [{ id: 'm0', user_message: 'Earlier', assistant_response: 'Older reply' }],
        has_more: false,
        next_offset: 2,
      });

    renderTab();
    await user.click(screen.getByText('Floods'));

    await waitFor(() => {
      expect(screen.getByText('history down')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => {
      expect(screen.getByText('Hi there')).toBeInTheDocument();
    });

    const transcript = document.querySelector('.ai-chat-messages');
    Object.defineProperty(transcript, 'scrollHeight', { configurable: true, value: 1200 });
    transcript.scrollTop = 0;
    transcript.dispatchEvent(new Event('scroll'));

    await waitFor(() => {
      expect(screen.getByText('Older reply')).toBeInTheDocument();
    });
  }, 15000);

  it('starts a new chat from an open thread', async () => {
    const user = userEvent.setup();
    const { fetchChatThreadHistory } = await import('@/services/threadService');
    vi.mocked(fetchChatThreadHistory).mockResolvedValue({
      items: [{ id: 'm1', user_message: 'Hello', assistant_response: 'Hi there' }],
    });

    renderTab();
    await user.click(screen.getByText('Floods'));
    await waitFor(() => {
      expect(screen.getByText('Hi there')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Start a new conversation' }));
    await waitFor(() => {
      expect(screen.getByText('TDIS AI Assistant')).toBeInTheDocument();
    });
  }, 15000);

  it('shows the sign-in gate when the session is not authenticated', async () => {
    const user = userEvent.setup();
    keycloakState.authenticated = false;
    renderTab();
    expect(screen.getByRole('heading', { name: 'Sign in to continue' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sign in with your account' }));
    expect(keycloakState.login).toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Request Access' })).toHaveAttribute(
      'href',
      '/request-access'
    );
    await user.click(screen.getByRole('link', { name: 'Request Access' }));
  });

  it('shows a session check while Keycloak is initialising', () => {
    keycloakState.initialising = true;
    renderTab();
    expect(screen.getByText('Checking your session')).toBeInTheDocument();
  });

  it('skips motion offsets while checking the session if the user prefers reduced motion', () => {
    motionMocks.reduced = true;
    keycloakState.initialising = true;
    renderTab();
    expect(screen.getByText('Checking your session')).toBeInTheDocument();
  });

  it('shows an auth error and reloads on retry', async () => {
    const user = userEvent.setup();
    keycloakState.error = 'Keycloak is unreachable';
    const reload = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload },
    });
    renderTab();
    expect(screen.getByRole('heading', { name: 'Sign-in is unavailable' })).toBeInTheDocument();
    expect(screen.getByText('Keycloak is unreachable')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reload and retry' }));
    expect(reload).toHaveBeenCalled();
  });

  it('sends on an existing thread without creating another', async () => {
    const user = userEvent.setup();
    const { fetchChatThreadHistory, submitQuery } = await import('@/services/threadService');
    vi.mocked(fetchChatThreadHistory).mockResolvedValue({
      items: [{ id: 'm1', user_message: 'Hello', assistant_response: 'Hi there' }],
    });
    renderTab();
    await user.click(screen.getByText('Floods'));
    await waitFor(() => {
      expect(screen.getByText('Hi there')).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText(COMPOSER_PLACEHOLDER), 'Follow up');
    await user.click(screen.getByRole('button', { name: SEND_LABEL }));
    await waitFor(() => {
      expect(screen.getByText(/Austin is in Texas/)).toBeInTheDocument();
    });
    expect(threadFns.createNewThread).not.toHaveBeenCalled();
    expect(submitQuery).toHaveBeenCalledWith('token', 'Follow up', 'thread-1', expect.any(Object));
  }, 15000);

  it('keeps optimistic turns when history returns empty right after thread create', async () => {
    const user = userEvent.setup();
    threadFns.selectOnCreate = true;
    const { fetchChatThreadHistory } = await import('@/services/threadService');
    let releaseHistory;
    vi.mocked(fetchChatThreadHistory).mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseHistory = resolve;
        })
    );
    renderTab();
    await user.type(screen.getByPlaceholderText(COMPOSER_PLACEHOLDER), 'Where is Austin?');
    await user.click(screen.getByRole('button', { name: SEND_LABEL }));
    await waitFor(() => {
      expect(typeof releaseHistory).toBe('function');
      expect(screen.getByText('Where is Austin?')).toBeInTheDocument();
    });
    releaseHistory({ items: [] });
    await waitFor(() => {
      expect(screen.getByText(/Austin is in Texas/)).toBeInTheDocument();
    });
    expect(screen.getByText('Where is Austin?')).toBeInTheDocument();
    await user.click(screen.getByText('Floods'));
    await waitFor(() => {
      expect(screen.queryByText('Where is Austin?')).not.toBeInTheDocument();
    });
  }, 15000);

  it('clears history protection once the server returns mapped turns', async () => {
    const user = userEvent.setup();
    threadFns.selectOnCreate = true;
    const { fetchChatThreadHistory } = await import('@/services/threadService');
    vi.mocked(fetchChatThreadHistory).mockResolvedValue({
      items: [{ id: 'm1', user_message: 'Hello', assistant_response: 'From history' }],
    });
    renderTab();
    await user.type(screen.getByPlaceholderText(COMPOSER_PLACEHOLDER), 'Where is Austin?');
    await user.click(screen.getByRole('button', { name: SEND_LABEL }));
    await waitFor(() => {
      expect(screen.getByText('From history')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Floods'));
    await waitFor(() => {
      expect(screen.getByText('From history')).toBeInTheDocument();
    });
  }, 15000);

  it('clears protected history merge when switching to another thread', async () => {
    const user = userEvent.setup();
    const { fetchChatThreadHistory } = await import('@/services/threadService');
    vi.mocked(fetchChatThreadHistory).mockImplementation(async (_token, threadId) => {
      if (threadId === 'thread-1') {
        return { items: [{ id: 'm1', user_message: 'Hello', assistant_response: 'Hi there' }] };
      }
      return { items: [] };
    });
    renderTab();
    await user.type(screen.getByPlaceholderText(COMPOSER_PLACEHOLDER), 'Where is Austin?');
    await user.click(screen.getByRole('button', { name: SEND_LABEL }));
    await waitFor(() => {
      expect(screen.getByText(/Austin is in Texas/)).toBeInTheDocument();
    });
    await user.click(screen.getByText('Floods'));
    await waitFor(() => {
      expect(screen.getByText('Hi there')).toBeInTheDocument();
    });
  }, 15000);

  it('surfaces a non-Error history failure and ignores abort errors', async () => {
    const user = userEvent.setup();
    const { fetchChatThreadHistory } = await import('@/services/threadService');
    const abortErr = new Error('aborted');
    abortErr.name = 'AbortError';
    vi.mocked(fetchChatThreadHistory)
      .mockRejectedValueOnce(abortErr)
      .mockRejectedValueOnce('history exploded');
    renderTab();
    await user.click(screen.getByText('Floods'));
    await waitFor(() => {
      expect(screen.queryByText('Could not load conversation history')).not.toBeInTheDocument();
    });
    await user.click(screen.getByText('Wind'));
    await waitFor(() => {
      expect(screen.getByText('Could not load conversation history')).toBeInTheDocument();
    });
  }, 15000);

  it('skips history mapping when the access token is missing', async () => {
    const user = userEvent.setup();
    keycloakState.token = null;
    const { fetchChatThreadHistory } = await import('@/services/threadService');
    renderTab();
    await user.click(screen.getByText('Floods'));
    await waitFor(() => {
      expect(fetchChatThreadHistory).not.toHaveBeenCalled();
    });
  });

  it('does not load older pages without a token and drops in-flight pages after a thread change', async () => {
    const user = userEvent.setup();
    const { fetchChatThreadHistory } = await import('@/services/threadService');
    let releaseOlder;
    vi.mocked(fetchChatThreadHistory)
      .mockResolvedValueOnce({
        items: [{ id: 'm1', user_message: 'Hello', assistant_response: 'Hi there' }],
        has_more: true,
        next_offset: 1,
      })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseOlder = resolve;
          })
      );
    renderTab();
    await user.click(screen.getByText('Floods'));
    await waitFor(() => {
      expect(screen.getByText('Hi there')).toBeInTheDocument();
    });

    const transcript = document.querySelector('.ai-chat-messages');
    Object.defineProperty(transcript, 'scrollHeight', { configurable: true, value: 1200 });
    transcript.scrollTop = 0;
    transcript.dispatchEvent(new Event('scroll'));

    await waitFor(() => {
      expect(typeof releaseOlder).toBe('function');
    });
    await user.click(screen.getByRole('button', { name: 'Start a new conversation' }));
    releaseOlder({
      items: [{ id: 'm0', user_message: 'Earlier', assistant_response: 'Older reply' }],
    });
    expect(screen.queryByText('Older reply')).not.toBeInTheDocument();
  }, 15000);

  it('does not fetch older history when the access token is missing', async () => {
    const user = userEvent.setup();
    const { fetchChatThreadHistory } = await import('@/services/threadService');
    vi.mocked(fetchChatThreadHistory).mockResolvedValue({
      items: [{ id: 'm1', user_message: 'Hello', assistant_response: 'Hi there' }],
      has_more: true,
      next_offset: 1,
    });
    renderTab();
    await user.click(screen.getByText('Floods'));
    await waitFor(() => {
      expect(screen.getByText('Hi there')).toBeInTheDocument();
    });
    keycloakState.token = null;
    vi.mocked(fetchChatThreadHistory).mockClear();
    const transcript = document.querySelector('.ai-chat-messages');
    Object.defineProperty(transcript, 'scrollHeight', { configurable: true, value: 1200 });
    transcript.scrollTop = 0;
    transcript.dispatchEvent(new Event('scroll'));
    await waitFor(() => {
      expect(fetchChatThreadHistory).not.toHaveBeenCalled();
    });
  }, 15000);

  it('shows a non-Error message when older history fails', async () => {
    const user = userEvent.setup();
    const { fetchChatThreadHistory } = await import('@/services/threadService');
    vi.mocked(fetchChatThreadHistory)
      .mockResolvedValueOnce({
        items: [{ id: 'm1', user_message: 'Hello', assistant_response: 'Hi there' }],
        has_more: true,
        next_offset: 1,
      })
      .mockRejectedValueOnce('older exploded');
    renderTab();
    await user.click(screen.getByText('Floods'));
    await waitFor(() => {
      expect(screen.getByText('Hi there')).toBeInTheDocument();
    });
    const transcript = document.querySelector('.ai-chat-messages');
    Object.defineProperty(transcript, 'scrollHeight', { configurable: true, value: 1200 });
    transcript.scrollTop = 0;
    transcript.dispatchEvent(new Event('scroll'));
    await waitFor(() => {
      expect(screen.getByText('Could not load older messages')).toBeInTheDocument();
    });
  }, 15000);

  it('deletes the active thread into a draft and swallows delete failures', async () => {
    const user = userEvent.setup();
    const { fetchChatThreadHistory } = await import('@/services/threadService');
    vi.mocked(fetchChatThreadHistory).mockResolvedValue({
      items: [{ id: 'm1', user_message: 'Hello', assistant_response: 'Hi there' }],
    });
    renderTab();
    await user.click(screen.getByText('Floods'));
    await waitFor(() => {
      expect(screen.getByText('Hi there')).toBeInTheDocument();
    });
    await user.click(screen.getByLabelText('Actions for Floods'));
    await user.click(screen.getByRole('menuitem', { name: /Delete/i }));
    await user.click(screen.getByRole('button', { name: 'Delete conversation' }));
    await waitFor(() => {
      expect(threadFns.removeThread).toHaveBeenCalledWith('thread-1');
      expect(screen.getByText('TDIS AI Assistant')).toBeInTheDocument();
    });

    threadFns.removeThread.mockRejectedValueOnce(new Error('cannot delete'));
    await user.click(screen.getByText('Wind'));
    await waitFor(() => {
      expect(fetchChatThreadHistory).toHaveBeenCalled();
    });
    await user.click(screen.getByLabelText('Actions for Wind'));
    await user.click(screen.getByRole('menuitem', { name: /Delete/i }));
    await user.click(screen.getByRole('button', { name: 'Delete conversation' }));
    await waitFor(() => {
      expect(threadFns.removeThread).toHaveBeenCalledWith('thread-2');
    });
  }, 15000);

  it('deletes an inactive thread without resetting the open draft', async () => {
    const user = userEvent.setup();
    renderTab();
    expect(screen.getByText('TDIS AI Assistant')).toBeInTheDocument();
    await user.click(screen.getByLabelText('Actions for Floods'));
    await user.click(screen.getByRole('menuitem', { name: /Delete/i }));
    await user.click(screen.getByRole('button', { name: 'Delete conversation' }));
    expect(threadFns.removeThread).toHaveBeenCalledWith('thread-1');
    expect(screen.getByText('TDIS AI Assistant')).toBeInTheDocument();
  });

  it('records a generic send error when the stream rejects a non-Error', async () => {
    const user = userEvent.setup();
    const { submitQuery } = await import('@/services/threadService');
    vi.mocked(submitQuery).mockRejectedValue('orchestrator exploded');
    renderTab();
    await user.type(screen.getByPlaceholderText(COMPOSER_PLACEHOLDER), 'Fail please');
    await user.click(screen.getByRole('button', { name: SEND_LABEL }));
    await waitFor(() => {
      expect(screen.getByText(/Failed to get response from API/)).toBeInTheDocument();
    });
  }, 15000);

  it('forwards map and hazard callbacks from the assistant map', async () => {
    const user = userEvent.setup();
    renderTab();
    await user.click(screen.getByRole('button', { name: 'pick-feature' }));
    expect(hazardMocks.lastMapProps.selectedFeature).toEqual({ id: 'feat-1' });
    await user.click(screen.getByRole('button', { name: 'pick-hazard' }));
    expect(hazardMocks.selectMetric).toHaveBeenCalledWith('WFIR');
    expect(hazardMocks.lastMapProps.selectedFeature).toBeNull();
    await user.click(screen.getByRole('button', { name: 'show-answer-map' }));
    await user.click(screen.getByRole('button', { name: 'answer-map-ready' }));
    expect(hazardMocks.showAnswerMap).toHaveBeenCalledTimes(2);
  });

  it('retries thread list load when the sidebar reports an error', async () => {
    const user = userEvent.setup();
    threadFns.error = 'threads down';
    renderTab();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(threadFns.loadThreads).toHaveBeenCalled();
  });

  it('ignores a late history page after the user starts a new chat', async () => {
    const user = userEvent.setup();
    const { fetchChatThreadHistory } = await import('@/services/threadService');
    let release;
    vi.mocked(fetchChatThreadHistory).mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        })
    );
    renderTab();
    await user.click(screen.getByText('Floods'));
    await user.click(screen.getByRole('button', { name: 'Start a new conversation' }));
    release({ items: [{ id: 'm1', user_message: 'Hello', assistant_response: 'Hi there' }] });
    await waitFor(() => {
      expect(screen.queryByText('Hi there')).not.toBeInTheDocument();
    });
  }, 15000);
});
