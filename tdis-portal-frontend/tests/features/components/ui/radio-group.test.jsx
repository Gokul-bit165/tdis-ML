/**
 * @fileoverview Unit tests for RadioGroup UI components
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

describe('RadioGroup', () => {
  it('renders RadioGroup with items', () => {
    render(
      <RadioGroup defaultValue="a" data-testid="radio-group">
        <div className="flex items-center gap-2">
          <RadioGroupItem value="a" id="a" />
          <label htmlFor="a">Option A</label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="b" id="b" />
          <label htmlFor="b">Option B</label>
        </div>
      </RadioGroup>
    );
    expect(screen.getByTestId('radio-group')).toBeInTheDocument();
    expect(screen.getByLabelText('Option A')).toBeInTheDocument();
    expect(screen.getByLabelText('Option B')).toBeInTheDocument();
  });

  it('applies custom className to RadioGroup', () => {
    render(
      <RadioGroup className="custom-group" data-testid="rg">
        <RadioGroupItem value="x" id="x" />
      </RadioGroup>
    );
    expect(screen.getByTestId('rg').className).toMatch(/custom-group/);
  });

  it('RadioGroupItem applies custom className', () => {
    render(
      <RadioGroup>
        <RadioGroupItem value="x" id="x" className="custom-item" data-testid="item" />
      </RadioGroup>
    );
    expect(screen.getByTestId('item').className).toMatch(/custom-item/);
  });

  it('allows selecting an option', async () => {
    const user = userEvent.setup();
    render(
      <RadioGroup defaultValue="a">
        <div className="flex items-center gap-2">
          <RadioGroupItem value="a" id="a" />
          <label htmlFor="a">A</label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="b" id="b" />
          <label htmlFor="b">B</label>
        </div>
      </RadioGroup>
    );
    await user.click(screen.getByLabelText('B'));
    expect(screen.getByLabelText('B')).toBeChecked();
  });
});
