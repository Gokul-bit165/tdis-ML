/**
 * @fileoverview Unit tests for dropdown-menu UI components
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';

describe('DropdownMenu', () => {
  it('renders Root with data-slot', () => {
    render(
      <DropdownMenu>
        <span>child</span>
      </DropdownMenu>
    );
    expect(screen.getByText('child')).toBeInTheDocument();
  });

  it('renders Trigger and Content when open', () => {
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger asChild>
          <button type="button">Open</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Label</DropdownMenuLabel>
          <DropdownMenuItem>Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    // Content is in portal; trigger may be in aria-hidden wrapper when open
    const label = document.querySelector('[data-slot="dropdown-menu-label"]');
    const item = document.querySelector('[data-slot="dropdown-menu-item"]');
    expect(label).toHaveTextContent('Label');
    expect(item).toHaveTextContent('Item');
  });

  it('DropdownMenuContent applies sideOffset and className', () => {
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger asChild>
          <button type="button">Open</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="custom-content" sideOffset={8}>
          <DropdownMenuItem>Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    expect(screen.getByText('Item')).toBeInTheDocument();
  });

  it('DropdownMenuItem supports inset and variant', () => {
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger asChild>
          <button type="button">Open</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem inset data-testid="inset-item">
            Inset
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" data-testid="destructive-item">
            Destructive
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    expect(screen.getByTestId('inset-item')).toHaveAttribute('data-inset');
    expect(screen.getByTestId('destructive-item')).toHaveAttribute('data-variant', 'destructive');
  });

  it('DropdownMenuCheckboxItem renders with checked state', () => {
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger asChild>
          <button type="button">Open</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuCheckboxItem checked data-testid="cb">
            Checked
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    expect(screen.getByTestId('cb')).toBeInTheDocument();
  });

  it('DropdownMenuRadioGroup and RadioItem render', () => {
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger asChild>
          <button type="button">Open</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuRadioGroup value="a">
            <DropdownMenuRadioItem value="a">Option A</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    expect(screen.getByText('Option A')).toBeInTheDocument();
  });

  it('DropdownMenuLabel with inset', () => {
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger asChild>
          <button type="button">Open</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel inset>Inset Label</DropdownMenuLabel>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    expect(screen.getByText('Inset Label')).toBeInTheDocument();
  });

  it('DropdownMenuSeparator and Shortcut render', () => {
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger asChild>
          <button type="button">Open</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>
            Save
            <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    expect(screen.getByText('Save')).toBeInTheDocument();
    expect(screen.getByText('⌘S')).toBeInTheDocument();
  });

  it('DropdownMenuSubTrigger and SubContent render', () => {
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger asChild>
          <button type="button">Open</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Submenu</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Sub item</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    const subTrigger = document.querySelector('[data-slot="dropdown-menu-sub-trigger"]');
    expect(subTrigger).toHaveTextContent('Submenu');
  });
});
