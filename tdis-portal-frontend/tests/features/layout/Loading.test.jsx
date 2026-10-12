/**
 * @fileoverview Unit tests for Loading component
 * Feature: layout
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Loading from '@/components/Loading';

describe('Loading', () => {
  it('renders loading text', () => {
    render(<Loading text="Loading..." />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<Loading text="Wait" className="custom-class" />);
    const wrapper = container.firstChild;
    expect(wrapper).toHaveClass('custom-class');
  });
});
