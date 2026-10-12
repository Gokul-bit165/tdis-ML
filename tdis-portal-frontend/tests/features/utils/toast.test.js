/**
 * @fileoverview Unit tests for utils/toast
 * Feature: utils
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toast } from 'react-toastify';
import { errorToast, successToast } from '@/utils/toast';

vi.mock('react-toastify', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
  Slide: {},
}));

describe('utils/toast', () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockClear();
    vi.mocked(toast.success).mockClear();
  });

  describe('errorToast', () => {
    it('calls toast.error with message and options', () => {
      errorToast('Something went wrong');
      expect(toast.error).toHaveBeenCalledWith('Something went wrong', expect.any(Object));
    });

    it('passes toastId when provided', () => {
      errorToast('Error', 'my-id');
      expect(toast.error).toHaveBeenCalledWith(
        'Error',
        expect.objectContaining({ toastId: 'my-id' })
      );
    });
  });

  describe('successToast', () => {
    it('calls toast.success with message and options', () => {
      successToast('Saved!');
      expect(toast.success).toHaveBeenCalledWith('Saved!', expect.any(Object));
    });

    it('passes toastId when provided', () => {
      successToast('Done', 'success-id');
      expect(toast.success).toHaveBeenCalledWith(
        'Done',
        expect.objectContaining({ toastId: 'success-id' })
      );
    });
  });
});
