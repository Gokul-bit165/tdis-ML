/**
 * @fileoverview Unit tests for AIAssistantChat stop/busy wiring.
 * Feature: components
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AIAssistantChat from '@/components/ai-assistant/AIAssistantChat';

function renderChat(props = {}) {
  Element.prototype.scrollIntoView = vi.fn();
  return render(
    <AIAssistantChat turns={[]} isLoading={false} onSendMessage={() => {}} {...props} />
  );
}

describe('AIAssistantChat', () => {
  it('shows the empty state when there are no turns', () => {
    renderChat();
    expect(screen.getByText('TDIS AI Assistant')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send message' })).toBeInTheDocument();
  });

  it('marks the transcript busy and shows Stop while a turn is streaming', () => {
    const onStopGeneration = vi.fn();
    renderChat({
      turns: [{ id: 't1', userText: 'hi', assistantText: 'partial', _isStreaming: true }],
      onStopGeneration,
    });

    expect(
      screen.getByRole('status', { name: 'Assistant is drafting a reply' })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Stop generating' }));
    expect(onStopGeneration).toHaveBeenCalledTimes(1);
  });

  it('does not load older history while the assistant is busy', () => {
    const onLoadOlderHistory = vi.fn();
    renderChat({
      isLoading: true,
      historyHasMore: true,
      onLoadOlderHistory,
      turns: [{ id: 't1', userText: 'hi' }],
    });

    fireEvent.scroll(document.querySelector('.ai-chat-messages'), { target: { scrollTop: 0 } });
    expect(onLoadOlderHistory).not.toHaveBeenCalled();
  });

  it('retries failed history from the alert', () => {
    const onRetryHistory = vi.fn();
    renderChat({ historyError: 'Could not load conversation history', onRetryHistory });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetryHistory).toHaveBeenCalledTimes(1);
  });

  it('disables the composer when quota is exhausted', () => {
    renderChat({
      quota: { allocated: 10, consumed: 10, remaining: 0, resetDate: null },
    });
    expect(screen.getByPlaceholderText('Ask TDIS AI anything...')).toBeDisabled();
  });

  it('loads older history when the transcript is scrolled near the top', () => {
    const onLoadOlderHistory = vi.fn().mockResolvedValue(undefined);
    renderChat({
      historyHasMore: true,
      onLoadOlderHistory,
      turns: [{ id: 't1', userText: 'hi', assistantText: 'yo' }],
    });

    const el = document.querySelector('.ai-chat-messages');
    el.scrollTop = 10;
    fireEvent.scroll(el);
    expect(onLoadOlderHistory).toHaveBeenCalledTimes(1);
  });
});
