/**
 * @fileoverview Unit tests for Sheet UI components
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from '@/components/ui/sheet';

describe('Sheet', () => {
  it('renders Sheet with trigger', () => {
    render(
      <Sheet>
        <SheetTrigger asChild>
          <button type="button">Open sheet</button>
        </SheetTrigger>
        <SheetContent>Content</SheetContent>
      </Sheet>
    );
    expect(screen.getByRole('button', { name: 'Open sheet' })).toBeInTheDocument();
  });

  it('opens and shows content when trigger clicked', async () => {
    const user = userEvent.setup();
    render(
      <Sheet>
        <SheetTrigger asChild>
          <button type="button">Open</button>
        </SheetTrigger>
        <SheetContent>Sheet body</SheetContent>
      </Sheet>
    );
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByText('Sheet body')).toBeInTheDocument();
  });

  it('SheetContent applies side prop', () => {
    render(
      <Sheet defaultOpen>
        <SheetContent side="left" data-testid="content">
          Left sheet
        </SheetContent>
      </Sheet>
    );
    expect(screen.getByTestId('content')).toBeInTheDocument();
    expect(screen.getByText('Left sheet')).toBeInTheDocument();
  });

  it('SheetContent with side top and bottom', () => {
    const { unmount } = render(
      <Sheet defaultOpen>
        <SheetContent side="top">Top</SheetContent>
      </Sheet>
    );
    expect(screen.getByText('Top')).toBeInTheDocument();
    unmount();
    render(
      <Sheet defaultOpen>
        <SheetContent side="bottom">Bottom</SheetContent>
      </Sheet>
    );
    expect(screen.getByText('Bottom')).toBeInTheDocument();
  });

  it('renders SheetHeader, SheetFooter, SheetTitle, SheetDescription', () => {
    render(
      <Sheet defaultOpen>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Sheet Title</SheetTitle>
            <SheetDescription>Sheet description text.</SheetDescription>
          </SheetHeader>
          <p>Body</p>
          <SheetFooter>
            <SheetClose asChild>
              <button type="button">Done</button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    );
    expect(screen.getByText('Sheet Title')).toBeInTheDocument();
    expect(screen.getByText('Sheet description text.')).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
  });

  it('has accessible close button', () => {
    render(
      <Sheet defaultOpen>
        <SheetContent>Content</SheetContent>
      </Sheet>
    );
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });
});
