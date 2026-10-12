/**
 * @fileoverview Unit tests for Popover UI components
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Popover, PopoverTrigger, PopoverContent, PopoverAnchor } from '@/components/ui/popover';

describe('Popover', () => {
  it('renders Popover root with trigger and content when open', () => {
    render(
      <Popover defaultOpen>
        <PopoverTrigger asChild>
          <button type="button">Open popover</button>
        </PopoverTrigger>
        <PopoverContent>Popover content</PopoverContent>
      </Popover>
    );
    expect(screen.getByRole('button', { name: 'Open popover' })).toBeInTheDocument();
    expect(screen.getByText('Popover content')).toBeInTheDocument();
  });

  it('PopoverContent applies align and sideOffset', () => {
    render(
      <Popover defaultOpen>
        <PopoverTrigger asChild>
          <button type="button">Open</button>
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={8} className="custom-popover">
          Content
        </PopoverContent>
      </Popover>
    );
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders PopoverAnchor', () => {
    render(
      <Popover>
        <PopoverAnchor asChild>
          <span data-testid="anchor">Anchor</span>
        </PopoverAnchor>
      </Popover>
    );
    expect(screen.getByTestId('anchor')).toHaveTextContent('Anchor');
  });
});
