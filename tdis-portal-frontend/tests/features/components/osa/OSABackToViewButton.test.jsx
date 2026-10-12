/**
 * @fileoverview Unit tests for osa/OSABackToViewButton
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OSABackToViewButton } from '@/components/osa/OSABackToViewButton';

describe('OSABackToViewButton', () => {
  it('renders button with default title and text', () => {
    const onBack = vi.fn();
    render(<OSABackToViewButton onBack={onBack} />);
    const btn = screen.getByRole('button', { name: /Back to previous view/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute('title', 'Return to your previous map position');
    expect(screen.getByText(/Return to last map position/i)).toBeInTheDocument();
  });

  it('uses custom title when provided', () => {
    render(<OSABackToViewButton onBack={() => {}} title="Custom back title" />);
    expect(screen.getByRole('button')).toHaveAttribute('title', 'Custom back title');
  });

  it('calls onBack when clicked', async () => {
    const onBack = vi.fn();
    render(<OSABackToViewButton onBack={onBack} />);
    const btn = screen.getByRole('button');
    await userEvent.click(btn);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
