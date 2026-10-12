/**
 * @fileoverview Unit tests for config/disclaimerConfig
 * Feature: config / disclaimer
 */
import { describe, it, expect } from 'vitest';
import { disclaimerConfig } from '@/config/disclaimerConfig';

describe('config/disclaimerConfig', () => {
  it('has storageKey', () => {
    expect(disclaimerConfig.storageKey).toBe('disclaimer_accepted');
  });

  it('has logo paths', () => {
    expect(disclaimerConfig.tdisLogo).toBeDefined();
    expect(disclaimerConfig.tamuLogo).toBeDefined();
    expect(disclaimerConfig.idrtLogo).toBeDefined();
  });

  it('has welcome and disclaimer text', () => {
    expect(disclaimerConfig.welcomeText).toBeDefined();
    expect(disclaimerConfig.welcomeTitle).toBeDefined();
    expect(disclaimerConfig.disclaimerTitle).toBe('Disclaimer');
    expect(Array.isArray(disclaimerConfig.disclaimerText)).toBe(true);
    expect(disclaimerConfig.disclaimerText.length).toBeGreaterThan(0);
  });

  it('has acceptButtonText', () => {
    expect(disclaimerConfig.acceptButtonText).toBe('I ACCEPT');
  });

  it('has footerPoweredBy', () => {
    expect(disclaimerConfig.footerPoweredBy).toBeDefined();
  });
});
