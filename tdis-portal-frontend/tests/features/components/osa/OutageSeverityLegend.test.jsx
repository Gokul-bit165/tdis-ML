/**
 * @fileoverview Unit tests for osa/OutageSeverityLegend
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OutageSeverityLegend } from '@/components/osa/OutageSeverityLegend';

describe('OutageSeverityLegend', () => {
  it('renders Customers Out label', () => {
    render(<OutageSeverityLegend />);
    expect(screen.getByText('Customers Out')).toBeInTheDocument();
  });

  it('renders Poweroutage.com data attribution link', () => {
    render(<OutageSeverityLegend />);
    expect(screen.getByText(/Data source:/i)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /Poweroutage\.com/i });
    expect(link).toHaveAttribute('href', 'https://poweroutage.com');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('renders all 9 severity level labels', () => {
    render(<OutageSeverityLegend />);
    expect(screen.getByText('1 - 50')).toBeInTheDocument();
    expect(screen.getByText('51 - 100')).toBeInTheDocument();
    expect(screen.getByText('101 - 250')).toBeInTheDocument();
    expect(screen.getByText('251 - 500')).toBeInTheDocument();
    expect(screen.getByText('501 - 1,000')).toBeInTheDocument();
    expect(screen.getByText('1,001 - 1,500')).toBeInTheDocument();
    expect(screen.getByText('1,501 - 2,000')).toBeInTheDocument();
    expect(screen.getByText('2,001 - 3,000')).toBeInTheDocument();
    expect(screen.getByText('3,001+')).toBeInTheDocument();
  });
});
