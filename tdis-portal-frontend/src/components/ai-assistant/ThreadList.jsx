import React, { useMemo, useState, useCallback, useId } from 'react';
import PropTypes from 'prop-types';
import {
  MessageSquarePlus,
  MessageSquare,
  MoreHorizontal,
  Search,
  Trash2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DeleteConversationDialog } from './DeleteConversationDialog';
import { formatLastActive, groupThreadsByDate, filterThreadsBySearch } from './threadListUtils';

const SEARCH_MIN_THREADS = 8;
const SKELETON_COUNT = 4;

function ThreadListSkeleton() {
  return (
    <ul className="ai-thread-skeleton-list" aria-hidden>
      {Array.from({ length: SKELETON_COUNT }, (_, i) => (
        <li key={i} className="ai-thread-skeleton">
          <span className="ai-thread-skeleton__icon" />
          <span className="ai-thread-skeleton__lines">
            <span className="ai-thread-skeleton__line ai-thread-skeleton__line--title" />
            <span className="ai-thread-skeleton__line ai-thread-skeleton__line--meta" />
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * @param {object} props
 */
function ConversationRow({ title, meta, isActive, isDraft, onSelect, onDelete, menuLabel }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      className={`ai-thread-row${isActive ? ' ai-thread-row--active' : ''}${
        isDraft ? ' ai-thread-row--draft' : ''
      }`}
    >
      <button
        type="button"
        className="ai-thread-row__main"
        onClick={onSelect}
        aria-current={isActive ? 'true' : undefined}
      >
        <span className="ai-thread-row__icon" aria-hidden>
          <MessageSquare className="h-4 w-4" strokeWidth={2} />
        </span>
        <span className="ai-thread-row__text">
          <span className="ai-thread-row__title" title={title}>
            {title}
          </span>
          <span className="ai-thread-row__meta">{meta}</span>
        </span>
        {isDraft ? <span className="ai-thread-row__badge">Draft</span> : null}
      </button>
      {onDelete ? (
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="ai-thread-row__menu"
              aria-label={`Actions for ${menuLabel}`}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" strokeWidth={2} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="z-[250] min-w-[10rem]">
            <DropdownMenuItem
              variant="destructive"
              className="text-red-700 focus:text-red-700"
              onSelect={() => {
                setMenuOpen(false);
                onDelete();
              }}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

ConversationRow.propTypes = {
  title: PropTypes.string.isRequired,
  meta: PropTypes.string.isRequired,
  isActive: PropTypes.bool.isRequired,
  isDraft: PropTypes.bool,
  onSelect: PropTypes.func.isRequired,
  onDelete: PropTypes.func,
  menuLabel: PropTypes.string.isRequired,
};

ConversationRow.defaultProps = {
  isDraft: false,
  onDelete: undefined,
};

function ThreadListHeader({
  threadsCount,
  loading,
  error,
  isDraftComposer,
  listCollapsed,
  listBodyId,
  onToggleCollapsed,
  onNewThread,
}) {
  const showCollapse = (threadsCount > 0 || isDraftComposer) && !loading;
  const newThreadLabel = isDraftComposer
    ? 'Continue new conversation (unsaved)'
    : 'Start a new conversation';

  return (
    <div className="ai-thread-panel__head">
      <div className="ai-thread-panel__title-row">
        <h2 className="ai-thread-panel__title">
          Conversations
          {!loading && !error ? (
            <span className="ai-thread-panel__count">{threadsCount}</span>
          ) : null}
        </h2>
        {showCollapse ? (
          <button
            type="button"
            className="ai-thread-panel__collapse"
            onClick={onToggleCollapsed}
            aria-expanded={!listCollapsed}
            aria-controls={listBodyId}
          >
            {listCollapsed ? 'Show list' : 'Hide list'}
          </button>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onNewThread}
        className={`ai-thread-new ai-thread-new--block${
          isDraftComposer ? ' ai-thread-new--draft' : ''
        }`}
        aria-label={newThreadLabel}
        aria-pressed={isDraftComposer}
      >
        <span className="ai-thread-new__icon" aria-hidden>
          <MessageSquarePlus className="ai-thread-new__glyph" strokeWidth={2.25} size={18} />
        </span>
        <span className="ai-thread-new__copy">
          <span className="ai-thread-new__label">New chat</span>
          {isDraftComposer ? (
            <span className="ai-thread-new__status">Draft</span>
          ) : (
            <span className="ai-thread-new__hint">Blank slate</span>
          )}
        </span>
      </button>
    </div>
  );
}

ThreadListHeader.propTypes = {
  threadsCount: PropTypes.number.isRequired,
  loading: PropTypes.bool.isRequired,
  error: PropTypes.string,
  isDraftComposer: PropTypes.bool.isRequired,
  listCollapsed: PropTypes.bool.isRequired,
  listBodyId: PropTypes.string.isRequired,
  onToggleCollapsed: PropTypes.func.isRequired,
  onNewThread: PropTypes.func.isRequired,
};

function ThreadSearch({ searchFieldId, searchQuery, onSearchChange }) {
  return (
    <div className="ai-thread-search">
      <Search className="ai-thread-search__icon" aria-hidden size={16} strokeWidth={2} />
      <label htmlFor={searchFieldId} className="sr-only">
        Search conversations
      </label>
      <input
        id={searchFieldId}
        type="search"
        className="ai-thread-search__input"
        placeholder="Search conversations…"
        value={searchQuery}
        onChange={onSearchChange}
        autoComplete="off"
      />
    </div>
  );
}

ThreadSearch.propTypes = {
  searchFieldId: PropTypes.string.isRequired,
  searchQuery: PropTypes.string.isRequired,
  onSearchChange: PropTypes.func.isRequired,
};

function ThreadGroups({
  threads,
  groupedThreads,
  filteredThreads,
  searchQuery,
  isDraftComposer,
  activeThreadId,
  onSelectDraft,
  onSelectThread,
  onDeleteThread,
  onNewThread,
}) {
  if (threads.length === 0 && !isDraftComposer) {
    return (
      <div className="ai-thread-empty">
        <MessageSquare className="ai-thread-empty__icon" size={28} strokeWidth={1.5} aria-hidden />
        <p className="ai-thread-empty__title">No conversations yet</p>
        <p className="ai-thread-empty__lead">
          Ask a question about Texas data to start your first thread.
        </p>
        <button type="button" className="ai-thread-empty__cta" onClick={onNewThread}>
          Start your first chat
        </button>
      </div>
    );
  }

  if (filteredThreads.length === 0 && searchQuery.trim()) {
    return <p className="ai-thread-panel__status">No conversations match your search.</p>;
  }

  return (
    <>
      {isDraftComposer ? (
        <div className="ai-thread-group">
          <p className="ai-thread-group__label">Draft</p>
          <ul className="ai-thread-group__list">
            <li>
              <ConversationRow
                title="New conversation"
                meta="Unsaved — send a message to keep"
                isActive={!activeThreadId}
                isDraft
                onSelect={onSelectDraft}
                menuLabel="draft conversation"
              />
            </li>
          </ul>
        </div>
      ) : null}

      {groupedThreads.map((group) => (
        <div key={group.id} className="ai-thread-group">
          <p className="ai-thread-group__label">{group.label}</p>
          <ul className="ai-thread-group__list">
            {group.threads.map((thread) => {
              const title = thread.title || 'Untitled conversation';
              return (
                <li key={thread.id}>
                  <ConversationRow
                    title={title}
                    meta={formatLastActive(thread.last_active_at)}
                    isActive={!isDraftComposer && thread.id === activeThreadId}
                    onSelect={() => onSelectThread(thread.id)}
                    onDelete={() => onDeleteThread(thread)}
                    menuLabel={title}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </>
  );
}

ThreadGroups.propTypes = {
  threads: PropTypes.array.isRequired,
  groupedThreads: PropTypes.array.isRequired,
  filteredThreads: PropTypes.array.isRequired,
  searchQuery: PropTypes.string.isRequired,
  isDraftComposer: PropTypes.bool.isRequired,
  activeThreadId: PropTypes.string,
  onSelectDraft: PropTypes.func.isRequired,
  onSelectThread: PropTypes.func.isRequired,
  onDeleteThread: PropTypes.func.isRequired,
  onNewThread: PropTypes.func.isRequired,
};

function ThreadListContent(props) {
  if (props.loading) {
    return (
      <div className="ai-thread-panel__content" role="status" aria-live="polite">
        <p className="ai-thread-panel__status">Loading conversations…</p>
        <ThreadListSkeleton />
      </div>
    );
  }

  if (props.error) {
    return (
      <div className="ai-thread-panel__content ai-thread-panel__content--error" role="alert">
        <div className="ai-thread-error">
          <AlertCircle className="ai-thread-error__icon" aria-hidden size={20} />
          <p className="ai-thread-error__text">{props.error}</p>
          <button type="button" className="ai-thread-error__retry" onClick={props.onRetry}>
            <RefreshCw size={16} aria-hidden />
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-thread-panel__scroll">
      <ThreadGroups {...props} />
    </div>
  );
}

ThreadListContent.propTypes = {
  loading: PropTypes.bool.isRequired,
  error: PropTypes.string,
  onRetry: PropTypes.func.isRequired,
  threads: PropTypes.array.isRequired,
  groupedThreads: PropTypes.array.isRequired,
  filteredThreads: PropTypes.array.isRequired,
  searchQuery: PropTypes.string.isRequired,
  isDraftComposer: PropTypes.bool.isRequired,
  activeThreadId: PropTypes.string,
  onSelectDraft: PropTypes.func.isRequired,
  onSelectThread: PropTypes.func.isRequired,
  onDeleteThread: PropTypes.func.isRequired,
  onNewThread: PropTypes.func.isRequired,
};

const ThreadList = ({
  threads,
  activeThreadId,
  isDraftComposer,
  loading,
  error,
  onRetry,
  onSelectThread,
  onNewThread,
  onDeleteThread,
  locked = false,
}) => {
  const searchFieldId = useId();
  const [listCollapsed, setListCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);

  const showSearch = threads.length >= SEARCH_MIN_THREADS;

  const filteredThreads = useMemo(
    () => filterThreadsBySearch(threads, searchQuery),
    [threads, searchQuery]
  );

  const groupedThreads = useMemo(() => groupThreadsByDate(filteredThreads), [filteredThreads]);

  const handleDeleteClick = useCallback((thread) => {
    setPendingDelete({ id: thread.id, title: thread.title || '' });
  }, []);

  const handleCancelDelete = useCallback(() => {
    setPendingDelete(null);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (!pendingDelete?.id) return;
    onDeleteThread(pendingDelete.id);
    setPendingDelete(null);
  }, [pendingDelete, onDeleteThread]);

  const handleSelectDraft = useCallback(() => {
    if (!isDraftComposer) {
      onNewThread();
    }
  }, [isDraftComposer, onNewThread]);

  const listBodyId = 'assistant-thread-panel';
  const handleToggleCollapsed = useCallback(() => {
    setListCollapsed((value) => !value);
  }, []);
  const handleSearchChange = useCallback((event) => {
    setSearchQuery(event.target.value);
  }, []);

  return (
    <section
      className={`ai-thread-panel${locked ? ' ai-panel--locked' : ''}`}
      aria-label="Conversations"
      inert={locked || undefined}
    >
      <ThreadListHeader
        threadsCount={threads.length}
        loading={loading}
        error={error}
        isDraftComposer={isDraftComposer}
        listCollapsed={listCollapsed}
        listBodyId={listBodyId}
        onToggleCollapsed={handleToggleCollapsed}
        onNewThread={onNewThread}
      />

      <div
        id={listBodyId}
        className={`ai-thread-panel__body${listCollapsed ? ' ai-thread-panel__body--collapsed' : ''}`}
        role="region"
        aria-label="Conversation list"
      >
        {showSearch && !loading && !error ? (
          <ThreadSearch
            searchFieldId={searchFieldId}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
          />
        ) : null}

        <ThreadListContent
          loading={loading}
          error={error}
          onRetry={onRetry}
          threads={threads}
          groupedThreads={groupedThreads}
          filteredThreads={filteredThreads}
          searchQuery={searchQuery}
          isDraftComposer={isDraftComposer}
          activeThreadId={activeThreadId}
          onSelectDraft={handleSelectDraft}
          onSelectThread={onSelectThread}
          onDeleteThread={handleDeleteClick}
          onNewThread={onNewThread}
        />
      </div>

      <DeleteConversationDialog
        open={pendingDelete != null}
        threadTitle={pendingDelete?.title ?? ''}
        onCancel={handleCancelDelete}
        onConfirm={handleConfirmDelete}
      />
    </section>
  );
};

ThreadList.propTypes = {
  threads: PropTypes.array.isRequired,
  activeThreadId: PropTypes.string,
  isDraftComposer: PropTypes.bool,
  loading: PropTypes.bool.isRequired,
  error: PropTypes.string,
  onRetry: PropTypes.func.isRequired,
  onSelectThread: PropTypes.func.isRequired,
  onNewThread: PropTypes.func.isRequired,
  onDeleteThread: PropTypes.func.isRequired,
  locked: PropTypes.bool,
};

ThreadList.defaultProps = {
  activeThreadId: null,
  isDraftComposer: false,
  error: null,
};

export default ThreadList;
