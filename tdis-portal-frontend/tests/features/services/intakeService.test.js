/**
 * @fileoverview Unit tests for intakeService (application/datasets intake form)
 * Feature: Intake form submission and validation
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { submitIntakeForm, validateIntakeForm, formatDateForAPI } from '@/services/intakeService';

describe('intakeService', () => {
  const originalFetch = global.fetch;

  const validFormData = {
    requestType: 'application',
    agencyName: 'Test Agency',
    agencyContactName: 'Jane Doe',
    agencyContactEmail: 'jane@example.com',
    description: 'Brief description',
    personas: 'End users',
    funding: 'funded',
    dateNeededBy: '12-31-2025',
    dataInputsFormats: 'CSV, JSON',
  };

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('submitIntakeForm', () => {
    it('returns error when required fields are missing', async () => {
      const result = await submitIntakeForm({
        ...validFormData,
        agencyName: '',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required fields');
      expect(result.error).toContain('agencyName');
      expect(fetch).not.toHaveBeenCalled();
    });

    it('returns error when multiple required fields are missing', async () => {
      const result = await submitIntakeForm({
        ...validFormData,
        description: '',
        personas: '',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required fields');
      expect(result.error).toContain('description');
      expect(fetch).not.toHaveBeenCalled();
    });

    it('sends correctly formatted request body and returns success', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: '123', status: 'created' }),
      });

      const result = await submitIntakeForm(validFormData);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: '123', status: 'created' });
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('create/opportunity'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: expect.any(String),
        })
      );
      const body = JSON.parse(fetch.mock.calls[0][1].body);
      expect(body.agency_name_1717755330398).toBe('Test Agency');
      expect(body.agency_contact_email_1718354565735).toBe('jane@example.com');
      expect(body.select_one_1717755404504).toBe('funded');
      expect(body.estimated_file_size_1723451107441).toBe('100MB');
      expect(body.data_output_formats_1717755544582).toBe('json');
    });

    it('uses optional estimatedFileSize and nativeDataFormats when provided', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });
      await submitIntakeForm({
        ...validFormData,
        estimatedFileSize: '500MB',
        nativeDataFormats: 'GeoJSON',
      });
      const body = JSON.parse(fetch.mock.calls[0][1].body);
      expect(body.estimated_file_size_1723451107441).toBe('500MB');
      expect(body.data_output_formats_1717755544582).toBe('GeoJSON');
    });

    it('returns error when API response is not ok', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad request - invalid data'),
      });

      const result = await submitIntakeForm(validFormData);
      expect(result.success).toBe(false);
      expect(result.error).toContain('API request failed');
      expect(result.error).toContain('400');
      expect(result.error).toContain('Bad request');
    });

    it('returns network error message on CORS error', async () => {
      global.fetch.mockRejectedValueOnce(new Error('CORS policy blocked'));

      const result = await submitIntakeForm(validFormData);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
      expect(result.error).toContain('Unable to connect');
    });

    it('returns network error message on Failed to fetch', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Failed to fetch'));

      const result = await submitIntakeForm(validFormData);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('returns funding error when error message includes fund_type', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Invalid fund_type value'));

      const result = await submitIntakeForm(validFormData);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid funding status');
    });

    it('returns funding error when error message includes funding', async () => {
      global.fetch.mockRejectedValueOnce(new Error('funding must be selected'));

      const result = await submitIntakeForm(validFormData);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid funding status');
    });

    it('returns error message for other errors', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Custom error message'));

      const result = await submitIntakeForm(validFormData);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Custom error message');
    });

    it('returns generic message when error has no message', async () => {
      global.fetch.mockRejectedValueOnce(new Error());

      const result = await submitIntakeForm(validFormData);
      expect(result.success).toBe(false);
      expect(result.error).toContain('An unexpected error occurred');
    });
  });

  describe('validateIntakeForm', () => {
    it('returns valid when all fields are correct', () => {
      const result = validateIntakeForm(validFormData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns error when agency name is missing', () => {
      const result = validateIntakeForm({
        ...validFormData,
        agencyName: '',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Agency name is required');
    });

    it('returns error when agency name is only whitespace', () => {
      const result = validateIntakeForm({
        ...validFormData,
        agencyName: '   ',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Agency name is required');
    });

    it('returns error when agency contact name is missing', () => {
      const result = validateIntakeForm({
        ...validFormData,
        agencyContactName: '',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Agency contact name is required');
    });

    it('returns error when agency contact email is missing', () => {
      const result = validateIntakeForm({
        ...validFormData,
        agencyContactEmail: '',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Agency contact email is required');
    });

    it('returns error when email format is invalid', () => {
      const result = validateIntakeForm({
        ...validFormData,
        agencyContactEmail: 'not-an-email',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Please enter a valid email address');
    });

    it('accepts valid email formats', () => {
      expect(validateIntakeForm({ ...validFormData, agencyContactEmail: 'a@b.co' }).isValid).toBe(
        true
      );
      expect(
        validateIntakeForm({ ...validFormData, agencyContactEmail: 'user+tag@domain.org' }).isValid
      ).toBe(true);
    });

    it('returns error when description is missing', () => {
      const result = validateIntakeForm({
        ...validFormData,
        description: '',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Brief description is required');
    });

    it('returns error when personas is missing', () => {
      const result = validateIntakeForm({
        ...validFormData,
        personas: '',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('End user personas is required');
    });

    it('returns error when funding is missing', () => {
      const result = validateIntakeForm({
        ...validFormData,
        funding: '',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Please select funding status');
    });

    it('returns error when dateNeededBy is missing', () => {
      const result = validateIntakeForm({
        ...validFormData,
        dateNeededBy: '',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Date needed by is required');
    });

    it('returns error when dataInputsFormats is missing', () => {
      const result = validateIntakeForm({
        ...validFormData,
        dataInputsFormats: '',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Data inputs formats is required');
    });

    it('returns error when requestType is not application or datasets', () => {
      const result = validateIntakeForm({
        ...validFormData,
        requestType: 'other',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Request type must be either "application" or "datasets"');
    });

    it('accepts requestType application and datasets', () => {
      expect(validateIntakeForm({ ...validFormData, requestType: 'application' }).isValid).toBe(
        true
      );
      expect(validateIntakeForm({ ...validFormData, requestType: 'datasets' }).isValid).toBe(true);
    });

    it('returns error when funding is not funded or not-funded', () => {
      const result = validateIntakeForm({
        ...validFormData,
        funding: 'partial',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Funding status must be either "Funded" or "not-funded"');
    });

    it('accepts funding funded and not-funded', () => {
      expect(validateIntakeForm({ ...validFormData, funding: 'funded' }).isValid).toBe(true);
      expect(validateIntakeForm({ ...validFormData, funding: 'not-funded' }).isValid).toBe(true);
    });

    it('collects multiple validation errors', () => {
      const result = validateIntakeForm({
        ...validFormData,
        agencyName: '',
        agencyContactEmail: 'bad',
        funding: '',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('formatDateForAPI', () => {
    it('returns empty string when date is null', () => {
      expect(formatDateForAPI(null)).toBe('');
    });

    it('returns empty string when date is undefined', () => {
      expect(formatDateForAPI(undefined)).toBe('');
    });

    it('returns MM-DD-YYYY for a given date', () => {
      const date = new Date(2025, 0, 15); // Jan 15, 2025
      expect(formatDateForAPI(date)).toBe('01-15-2025');
    });

    it('pads single-digit month and day with zero', () => {
      const date = new Date(2025, 8, 5); // Sep 5, 2025
      expect(formatDateForAPI(date)).toBe('09-05-2025');
    });
  });
});
