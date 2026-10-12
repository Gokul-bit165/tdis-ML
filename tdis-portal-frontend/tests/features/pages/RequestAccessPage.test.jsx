/**
 * @fileoverview Unit tests for RequestAccessPage
 * Feature: pages
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import RequestAccessPage from '@/pages/RequestAccessPage';

const mockTrackAiAssistant = vi.fn();
vi.mock('@/utils/googleAnalytics.js', () => ({
  trackAiAssistant: (...args) => mockTrackAiAssistant(...args),
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, children }) => (
    <div data-testid="org-type-select-root">
      <select
        id="org_type"
        aria-label="Organisation Type"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
      >
        <option value="">Select organisation type</option>
        <option value="university">University</option>
        <option value="state">State</option>
        <option value="corporate">Corporate</option>
        <option value="ngo">NGO</option>
      </select>
      {children}
    </div>
  ),
  SelectTrigger: ({ children }) => <div>{children}</div>,
  SelectValue: ({ placeholder }) => <span>{placeholder}</span>,
  SelectContent: ({ children }) => <div>{children}</div>,
  SelectItem: ({ children }) => <span>{children}</span>,
}));

const VALID_FORM = {
  org_name: 'Harris County EOC',
  admin_name: 'Jane Doe',
  admin_email: 'jane@example.gov',
};

function renderPage() {
  return render(
    <MemoryRouter>
      <RequestAccessPage />
    </MemoryRouter>
  );
}

async function fillValidForm(user, orgType = 'university') {
  await user.type(screen.getByLabelText(/Organisation Name/i), VALID_FORM.org_name);
  await user.selectOptions(screen.getByLabelText(/^Organisation Type$/i), orgType);
  await user.type(screen.getByLabelText(/Your Name/i), VALID_FORM.admin_name);
  await user.type(screen.getByLabelText(/Your Email/i), VALID_FORM.admin_email);
}

describe('RequestAccessPage', () => {
  const originalDev = import.meta.env.DEV;
  const originalAiApiUrl = import.meta.env.VITE_AI_API_URL;
  const originalLegacyAiApiUrl = import.meta.env.VITE_TDIS_AI_API_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn();
    import.meta.env.DEV = true;
    import.meta.env.VITE_AI_API_URL = '';
    import.meta.env.VITE_TDIS_AI_API_URL = '';
  });

  afterEach(() => {
    import.meta.env.DEV = originalDev;
    import.meta.env.VITE_AI_API_URL = originalAiApiUrl;
    import.meta.env.VITE_TDIS_AI_API_URL = originalLegacyAiApiUrl;
    vi.restoreAllMocks();
  });

  it('renders heading, copy, sign-in link, and back-to-login navigation', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { name: /Request Access to TDIS AI/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/platform administrator will review/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to Login/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /Sign in/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('button', { name: /Submit Request/i })).toBeEnabled();
  });

  it('shows required-field errors and does not fetch when submitted empty', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /Submit Request/i }));

    expect(screen.getByText('Organisation name is required.')).toBeInTheDocument();
    expect(screen.getByText('Organisation type is required.')).toBeInTheDocument();
    expect(screen.getByText('Your name is required.')).toBeInTheDocument();
    expect(screen.getByText('Your email is required.')).toBeInTheDocument();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('shows min-length, invalid org type, and email format errors', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText(/Organisation Name/i), 'A');
    await user.selectOptions(screen.getByLabelText(/^Organisation Type$/i), 'ngo');
    await user.type(screen.getByLabelText(/Your Name/i), 'B');
    await user.type(screen.getByLabelText(/Your Email/i), 'not-an-email');
    await user.click(screen.getByRole('button', { name: /Submit Request/i }));

    expect(screen.getByText('Organisation name must be at least 2 characters.')).toBeInTheDocument();
    expect(screen.getByText('Select a valid organisation type.')).toBeInTheDocument();
    expect(screen.getByText('Your name must be at least 2 characters.')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('clears a field error when the user edits that field', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /Submit Request/i }));
    expect(screen.getByText('Organisation name is required.')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Organisation Name/i), 'TX');
    await waitFor(() => {
      expect(screen.queryByText('Organisation name is required.')).not.toBeInTheDocument();
    });
  });

  it('shows submitting state then confirmation on 201', async () => {
    const user = userEvent.setup();
    let resolveFetch;
    globalThis.fetch.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );

    renderPage();
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /Submit Request/i }));

    expect(await screen.findByRole('button', { name: /Submitting/i })).toBeDisabled();

    resolveFetch({ status: 201 });

    expect(await screen.findByRole('heading', { name: /Request Submitted/i })).toBeInTheDocument();
    expect(screen.getByText(VALID_FORM.org_name)).toBeInTheDocument();
    expect(screen.getByText(VALID_FORM.admin_email)).toBeInTheDocument();
    expect(screen.getByText(/1-2 business days/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to Login/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /Back to portal/i })).toHaveAttribute('href', '/');
    expect(mockTrackAiAssistant).toHaveBeenCalledWith('request_access_submit');
    expect(globalThis.fetch).toHaveBeenCalledWith('/signup/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        org_name: VALID_FORM.org_name,
        org_type: 'university',
        admin_name: VALID_FORM.admin_name,
        admin_email: VALID_FORM.admin_email,
      }),
    });
  });

  it('shows pending-request error on 409', async () => {
    const user = userEvent.setup();
    globalThis.fetch.mockResolvedValue({ status: 409 });
    renderPage();
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /Submit Request/i }));

    expect(
      await screen.findByText('A request for this email address is already pending.')
    ).toBeInTheDocument();
    expect(mockTrackAiAssistant).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Submit Request/i })).toBeEnabled();
  });

  it('shows validation-style server error on 422', async () => {
    const user = userEvent.setup();
    globalThis.fetch.mockResolvedValue({ status: 422 });
    renderPage();
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /Submit Request/i }));

    expect(await screen.findByText('Please check your details and try again.')).toBeInTheDocument();
  });

  it('shows generic error on unexpected status and on fetch failure', async () => {
    const user = userEvent.setup();
    globalThis.fetch.mockResolvedValue({ status: 500 });
    renderPage();
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /Submit Request/i }));
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/Your Email/i));
    await user.type(screen.getByLabelText(/Your Email/i), 'retry@example.gov');
    await waitFor(() => {
      expect(screen.queryByText('Something went wrong. Please try again.')).not.toBeInTheDocument();
    });

    globalThis.fetch.mockRejectedValue(new Error('network'));
    await user.click(screen.getByRole('button', { name: /Submit Request/i }));
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
  });

  it('trims whitespace in the submitted payload', async () => {
    const user = userEvent.setup();
    globalThis.fetch.mockResolvedValue({ status: 201 });
    renderPage();
    await user.type(screen.getByLabelText(/Organisation Name/i), '  Acme  ');
    await user.selectOptions(screen.getByLabelText(/^Organisation Type$/i), 'state');
    await user.type(screen.getByLabelText(/Your Name/i), '  Pat  ');
    await user.type(screen.getByLabelText(/Your Email/i), '  pat@state.gov  ');
    await user.click(screen.getByRole('button', { name: /Submit Request/i }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });
    expect(JSON.parse(globalThis.fetch.mock.calls[0][1].body)).toEqual({
      org_name: 'Acme',
      org_type: 'state',
      admin_name: 'Pat',
      admin_email: 'pat@state.gov',
    });
  });

  it('posts to a CI https API base with trailing slashes stripped when not in DEV', async () => {
    const user = userEvent.setup();
    import.meta.env.DEV = false;
    import.meta.env.VITE_AI_API_URL = 'https://api-tdis-ai.dev.cloud.tdis.io///';
    globalThis.fetch.mockResolvedValue({ status: 201 });

    renderPage();
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /Submit Request/i }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api-tdis-ai.dev.cloud.tdis.io/signup/organizations',
        expect.any(Object)
      );
    });
  });

  it('falls back to the legacy AI URL when the CI URL is invalid', async () => {
    const user = userEvent.setup();
    import.meta.env.DEV = false;
    import.meta.env.VITE_AI_API_URL = 'https://$(vite_ai_api_url)';
    import.meta.env.VITE_TDIS_AI_API_URL = 'https://legacy.example.com/';
    globalThis.fetch.mockResolvedValue({ status: 201 });

    renderPage();
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /Submit Request/i }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://legacy.example.com/signup/organizations',
        expect.any(Object)
      );
    });
  });

  it('ignores non-string API env values and uses the default production base', async () => {
    const user = userEvent.setup();
    import.meta.env.DEV = false;
    import.meta.env.VITE_AI_API_URL = undefined;
    import.meta.env.VITE_TDIS_AI_API_URL = null;
    globalThis.fetch.mockResolvedValue({ status: 201 });

    renderPage();
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /Submit Request/i }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api-tdis-ai.dev.cloud.tdis.io/signup/organizations',
        expect.any(Object)
      );
    });
  });

  it('uses the default production API base when no valid env URLs exist', async () => {
    const user = userEvent.setup();
    import.meta.env.DEV = false;
    import.meta.env.VITE_AI_API_URL = 'not-https';
    import.meta.env.VITE_TDIS_AI_API_URL = 'http://insecure.example.com';
    globalThis.fetch.mockResolvedValue({ status: 201 });

    renderPage();
    await fillValidForm(user, 'corporate');
    await user.click(screen.getByRole('button', { name: /Submit Request/i }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'https://api-tdis-ai.dev.cloud.tdis.io/signup/organizations',
        expect.any(Object)
      );
    });
    expect(JSON.parse(globalThis.fetch.mock.calls[0][1].body).org_type).toBe('corporate');
  });
});
