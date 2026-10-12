/**
 * @fileoverview Unit tests for ThreadList lock, search, and empty states.
 * Feature: components
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ThreadList from '@/components/ai-assistant/ThreadList';

function renderList(props = {}) {
  return render(
    <ThreadList
      threads={[]}
      loading={false}
      error={null}
      onRetry={() => {}}
      onSelectThread={() => {}}
      onNewThread={() => {}}
      onDeleteThread={() => {}}
      {...props}
    />
  );
}

function manyThreads() {
  return Array.from({ length: 8 }, (_, i) => ({
    id: `th${i}`,
    title: i === 0 ? 'Floods' : `Thread ${i}`,
    last_active_at: '2026-08-01T00:00:00Z',
  }));
}

describe('ThreadList', () => {
  it('locks the conversation list while the assistant is answering', () => {
    renderList({ locked: true, isDraftComposer: true });
    const panel = screen.getByRole('region', { name: 'Conversations' });
    expect(panel).toHaveClass('ai-panel--locked');
    expect(panel).toHaveAttribute('inert');
  });

  it('leaves the list interactive when not locked', () => {
    renderList({
      threads: [{ id: 'th1', title: 'Floods', last_active_at: '2026-08-01T00:00:00Z' }],
    });
    const panel = screen.getByRole('region', { name: 'Conversations' });
    expect(panel).not.toHaveClass('ai-panel--locked');
    expect(panel).not.toHaveAttribute('inert');
    expect(screen.getByText('Floods')).toBeInTheDocument();
  });

  it('shows an empty prompt when there are no conversations', () => {
    const onNewThread = vi.fn();
    renderList({ onNewThread });
    expect(screen.getByText('No conversations yet')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start your first chat' }));
    expect(onNewThread).toHaveBeenCalledTimes(1);
  });

  it('shows a loading status and retryable error', () => {
    const { rerender } = renderList({ loading: true });
    expect(screen.getByText('Loading conversations…')).toBeInTheDocument();

    const onRetry = vi.fn();
    rerender(
      <ThreadList
        threads={[]}
        loading={false}
        error="Could not load conversations"
        onRetry={onRetry}
        onSelectThread={() => {}}
        onNewThread={() => {}}
        onDeleteThread={() => {}}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /Try again/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('collapses the list and filters by search', () => {
    renderList({ threads: manyThreads() });
    fireEvent.click(screen.getByRole('button', { name: 'Hide list' }));
    expect(screen.getByRole('button', { name: 'Show list' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show list' }));

    const search = screen.getByPlaceholderText('Search conversations…');
    fireEvent.change(search, { target: { value: 'Floods' } });
    expect(screen.getByText('Floods')).toBeInTheDocument();
    fireEvent.change(search, { target: { value: 'zzzz-no-match' } });
    expect(screen.getByText('No conversations match your search.')).toBeInTheDocument();
  }, 15000);
});
