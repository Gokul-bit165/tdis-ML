/**
 * @fileoverview Unit tests for EmailSubscriptionForm component
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EmailSubscriptionForm from '@/components/EmailSubscriptionForm';

const mockSuccessToast = vi.fn();
const mockErrorToast = vi.fn();

vi.mock('@/utils/toast', () => ({
  successToast: (msg) => mockSuccessToast(msg),
  errorToast: (msg) => mockErrorToast(msg),
}));

const TEST_EMAIL = 'user@example.com';

const mockTrigger = vi.fn();
vi.mock('@/services/api', () => ({
  useSubscribeUserMutation: vi.fn(() => [mockTrigger, { isLoading: false }]),
}));

describe('EmailSubscriptionForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders section and heading', () => {
    render(<EmailSubscriptionForm />);
    expect(
      screen.getByRole('heading', { name: /Want to stay aware of TDIS activities/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Sign up for our email list/i)).toBeInTheDocument();
  });

  it('renders email input and subscribe button', () => {
    render(<EmailSubscriptionForm />);
    expect(screen.getByPlaceholderText(/Enter your email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Subscribe/i })).toBeInTheDocument();
  });

  it('shows "Email is required" when subscribing with empty email', () => {
    render(<EmailSubscriptionForm />);
    fireEvent.click(screen.getByRole('button', { name: /Subscribe/i }));
    expect(screen.getByText(/Email is required/i)).toBeInTheDocument();
    expect(mockTrigger).not.toHaveBeenCalled();
  });

  it('shows "Please enter a valid email address" for invalid email', () => {
    render(<EmailSubscriptionForm />);
    fireEvent.change(screen.getByPlaceholderText(/Enter your email/i), {
      target: { value: 'invalid' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Subscribe/i }));
    expect(screen.getByText(/Please enter a valid email address/i)).toBeInTheDocument();
    expect(mockTrigger).not.toHaveBeenCalled();
  });

  it('clears error when user types after error', async () => {
    render(<EmailSubscriptionForm />);
    fireEvent.click(screen.getByRole('button', { name: /Subscribe/i }));
    expect(screen.getByText(/Email is required/i)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/Enter your email/i), {
      target: { value: TEST_EMAIL },
    });
    await waitFor(() => {
      expect(screen.queryByText(/Email is required/i)).not.toBeInTheDocument();
    });
  });

  it('calls subscribe mutation and shows success toast on success', async () => {
    mockTrigger.mockReturnValue({
      unwrap: () => Promise.resolve(),
    });
    render(<EmailSubscriptionForm />);
    fireEvent.change(screen.getByPlaceholderText(/Enter your email/i), {
      target: { value: TEST_EMAIL },
    });
    fireEvent.click(screen.getByRole('button', { name: /Subscribe/i }));
    await waitFor(() => {
      expect(mockTrigger).toHaveBeenCalledWith({ emailAddress: TEST_EMAIL });
      expect(mockSuccessToast).toHaveBeenCalledWith('Successfully subscribed to TDIS updates!');
    });
  });

  it('shows error toast on subscription failure', async () => {
    mockTrigger.mockReturnValue({
      unwrap: () => Promise.reject(new Error('Network error')),
    });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<EmailSubscriptionForm />);
    fireEvent.change(screen.getByPlaceholderText(/Enter your email/i), {
      target: { value: TEST_EMAIL },
    });
    fireEvent.click(screen.getByRole('button', { name: /Subscribe/i }));
    await new Promise((r) => setTimeout(r, 50));
    expect(mockErrorToast).toHaveBeenCalledWith('Unable to subscribe. Please try again later.');
    consoleSpy.mockRestore();
  });

  it('submit on Enter key triggers subscribe', () => {
    mockTrigger.mockReturnValue({ unwrap: () => Promise.resolve() });
    render(<EmailSubscriptionForm />);
    const input = screen.getByPlaceholderText(/Enter your email/i);
    fireEvent.change(input, { target: { value: TEST_EMAIL } });
    fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', charCode: 13 });
    expect(mockTrigger).toHaveBeenCalledWith({ emailAddress: TEST_EMAIL });
  });

  it('Enter with invalid email does not call trigger', () => {
    render(<EmailSubscriptionForm />);
    const input = screen.getByPlaceholderText(/Enter your email/i);
    fireEvent.change(input, { target: { value: 'bad' } });
    fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', charCode: 13 });
    expect(mockTrigger).not.toHaveBeenCalled();
  });

  it('when isLoading true button shows Subscribing and is disabled', async () => {
    const api = await import('@/services/api');
    api.useSubscribeUserMutation.mockReturnValue([mockTrigger, { isLoading: true }]);
    render(<EmailSubscriptionForm />);
    expect(screen.getByRole('button', { name: /Subscribing/i })).toBeDisabled();
  });
});
