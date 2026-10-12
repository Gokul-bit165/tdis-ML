/**
 * @fileoverview Unit tests for Select UI components
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

describe('Select', () => {
  it('renders Select with trigger and value', () => {
    render(
      <Select>
        <SelectTrigger data-testid="trigger">
          <SelectValue placeholder="Pick one" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Option A</SelectItem>
          <SelectItem value="b">Option B</SelectItem>
        </SelectContent>
      </Select>
    );
    expect(screen.getByTestId('trigger')).toBeInTheDocument();
    expect(screen.getByText('Pick one')).toBeInTheDocument();
  });

  it('SelectTrigger applies size and className', () => {
    render(
      <Select>
        <SelectTrigger size="sm" className="custom-trigger" data-testid="trigger">
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="x">X</SelectItem>
        </SelectContent>
      </Select>
    );
    const trigger = screen.getByTestId('trigger');
    expect(trigger).toHaveAttribute('data-size', 'sm');
    expect(trigger.className).toMatch(/custom-trigger/);
  });

  it('when open shows select items in content', () => {
    render(
      <Select defaultOpen>
        <SelectTrigger>
          <SelectValue placeholder="Pick" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Option A</SelectItem>
          <SelectItem value="b">Option B</SelectItem>
        </SelectContent>
      </Select>
    );
    const items = document.querySelectorAll('[data-slot="select-item"]');
    expect(items.length).toBe(2);
    expect(items[0]).toHaveTextContent('Option A');
    expect(items[1]).toHaveTextContent('Option B');
  });

  it('SelectContent with SelectGroup/Label/Separator renders', () => {
    render(
      <Select defaultOpen>
        <SelectTrigger>
          <SelectValue placeholder="Pick" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Group 1</SelectLabel>
            <SelectItem value="1">One</SelectItem>
            <SelectSeparator />
            <SelectItem value="2">Two</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    );
    expect(screen.getByText('Group 1')).toBeInTheDocument();
    expect(screen.getByText('One')).toBeInTheDocument();
    expect(screen.getByText('Two')).toBeInTheDocument();
  });
});
