/**
 * @fileoverview Unit tests for AIAssistantComposer send/stop controls.
 * Feature: components
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AIAssistantComposer from '@/components/ai-assistant/AIAssistantComposer';

const SEND_LABEL = 'Send message';
const STOP_LABEL = 'Stop generating';
const COMPOSER_PLACEHOLDER = 'Ask TDIS AI anything...';

function renderComposer(props = {}) {
  return render(<AIAssistantComposer onSend={() => {}} {...props} />);
}

describe('AIAssistantComposer', () => {
  it('sends trimmed text from the Send button', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    renderComposer({ onSend });

    await user.type(screen.getByPlaceholderText(COMPOSER_PLACEHOLDER), '  hello  ');
    await user.click(screen.getByRole('button', { name: SEND_LABEL }));

    expect(onSend).toHaveBeenCalledWith('hello');
    expect(screen.getByPlaceholderText(COMPOSER_PLACEHOLDER)).toHaveValue('');
  });

  it('shows Stop instead of Send while streaming and calls onStop', async () => {
    const user = userEvent.setup();
    const onStop = vi.fn();
    renderComposer({ isStreaming: true, onStop });

    expect(screen.queryByRole('button', { name: SEND_LABEL })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: STOP_LABEL }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('does not send when disabled even with text in the box', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    renderComposer({ onSend, disabled: true });

    const textarea = screen.getByPlaceholderText(COMPOSER_PLACEHOLDER);
    await user.type(textarea, 'hello');
    await user.keyboard('{Enter}');

    expect(onSend).not.toHaveBeenCalled();
  });
});
