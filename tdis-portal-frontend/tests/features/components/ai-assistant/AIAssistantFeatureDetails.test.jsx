/**
 * @fileoverview Unit tests for hex feature details labels.
 * Feature: components
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AIAssistantFeatureDetails from '@/components/ai-assistant/AIAssistantFeatureDetails';

describe('AIAssistantFeatureDetails', () => {
  it('labels the API pop field as Population', () => {
    render(
      <AIAssistantFeatureDetails
        feature={{ hex_id: '862a10727ffffff', pop: 1240, risk: 0.4 }}
        onClose={() => {}}
      />
    );
    expect(screen.getByText('Population')).toBeInTheDocument();
    expect(screen.getAllByText('1,240').length).toBeGreaterThan(0);
  });
});
