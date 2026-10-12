/**
 * @fileoverview Unit tests for SidebarContent component
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SidebarContent from '@/components/SidebarContent';

describe('SidebarContent', () => {
  it('renders Select Event Types label', () => {
    render(
      <SidebarContent
        selectedEvents={[]}
        setSelectedEvents={() => {}}
        eventCounts={[]}
        isEventCountsLoading={false}
      />
    );
    expect(screen.getByText('Select Event Types')).toBeInTheDocument();
  });

  it('renders Events label', () => {
    render(
      <SidebarContent
        selectedEvents={[]}
        setSelectedEvents={() => {}}
        eventCounts={[]}
        isEventCountsLoading={false}
      />
    );
    expect(screen.getByText('Events')).toBeInTheDocument();
  });

  it('renders EventSelector', () => {
    render(
      <SidebarContent
        selectedEvents={[]}
        setSelectedEvents={() => {}}
        eventCounts={[]}
        isEventCountsLoading={false}
      />
    );
    expect(screen.getByText('Select events')).toBeInTheDocument();
  });

  it('renders LastUpdated section', () => {
    render(
      <SidebarContent
        selectedEvents={[]}
        setSelectedEvents={() => {}}
        eventCounts={[]}
        isEventCountsLoading={false}
      />
    );
    expect(screen.getByText(/Refresh cadence/i)).toBeInTheDocument();
  });
});
