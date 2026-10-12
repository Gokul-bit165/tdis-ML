import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { trackAiAssistant } from '@/utils/googleAnalytics.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ORG_TYPES = ['university', 'state', 'corporate'];
const DEFAULT_TDIS_AI_API_BASE_PROD = 'https://api-tdis-ai.dev.cloud.tdis.io';

const initialForm = {
  org_name: '',
  org_type: '',
  admin_name: '',
  admin_email: '',
};

const requestAccessThemeStyle = {
  '--primary': '#324755',
  '--primary-foreground': '#ffffff',
  '--secondary': '#F0F3F4',
  '--secondary-foreground': '#324755',
  '--muted': '#F0F3F4',
  '--muted-foreground': '#334755',
  '--accent': '#F0F3F4',
  '--accent-foreground': '#324755',
  '--border': '#CBD1D3',
  '--input': '#CBD1D3',
  '--ring': '#87BCBF',
};

const headerBackButtonClass =
  'border-white/35 bg-transparent text-primary-foreground hover:border-white hover:bg-white/10 hover:text-primary-foreground';

function stripTrailingSlashes(value) {
  while (value.endsWith('/')) value = value.slice(0, -1);
  return value;
}

function isValidAiApiBaseUrl(raw) {
  return /^https:\/\/.+/i.test(raw) && !raw.includes('$(');
}

function resolveSignupApiBase() {
  if (import.meta.env.DEV) return '';
  const fromCi =
    typeof import.meta.env.VITE_AI_API_URL === 'string'
      ? import.meta.env.VITE_AI_API_URL.trim()
      : '';
  if (fromCi && isValidAiApiBaseUrl(fromCi)) return stripTrailingSlashes(fromCi);
  const legacy =
    typeof import.meta.env.VITE_TDIS_AI_API_URL === 'string'
      ? import.meta.env.VITE_TDIS_AI_API_URL.trim()
      : '';
  if (legacy && isValidAiApiBaseUrl(legacy)) return stripTrailingSlashes(legacy);
  return DEFAULT_TDIS_AI_API_BASE_PROD;
}

function buildSignupUrl() {
  const baseUrl = resolveSignupApiBase();
  return baseUrl ? `${baseUrl}/signup/organizations` : '/signup/organizations';
}

function validateForm(form) {
  const nextErrors = {};
  if (!form.org_name.trim()) {
    nextErrors.org_name = 'Organisation name is required.';
  } else if (form.org_name.trim().length < 2) {
    nextErrors.org_name = 'Organisation name must be at least 2 characters.';
  }

  if (!form.org_type) {
    nextErrors.org_type = 'Organisation type is required.';
  } else if (!ORG_TYPES.includes(form.org_type)) {
    nextErrors.org_type = 'Select a valid organisation type.';
  }

  if (!form.admin_name.trim()) {
    nextErrors.admin_name = 'Your name is required.';
  } else if (form.admin_name.trim().length < 2) {
    nextErrors.admin_name = 'Your name must be at least 2 characters.';
  }

  if (!form.admin_email.trim()) {
    nextErrors.admin_email = 'Your email is required.';
  } else if (!EMAIL_PATTERN.test(form.admin_email.trim())) {
    nextErrors.admin_email = 'Enter a valid email address.';
  }

  return nextErrors;
}

async function submitAccessRequest(form) {
  return fetch(buildSignupUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      org_name: form.org_name.trim(),
      org_type: form.org_type,
      admin_name: form.admin_name.trim(),
      admin_email: form.admin_email.trim(),
    }),
  });
}

function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-destructive">
      {message}
    </p>
  );
}

function ConfirmationState({ form }) {
  return (
    <div>
      <div className="border-b border-border bg-primary px-6 py-5 text-primary-foreground">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-foreground/70">
              TDIS AI
            </p>
            <h1 className="mt-1 text-2xl font-bold">Request Submitted</h1>
          </div>
          <Button asChild variant="outline" className={headerBackButtonClass}>
            <Link to="/">Back to Login</Link>
          </Button>
        </div>
      </div>
      <div className="p-6">
        <div className="rounded-lg border border-border bg-muted p-4">
          <p className="text-sm leading-relaxed text-foreground">
            Your access request for{' '}
            <span className="font-semibold text-primary">{form.org_name}</span> has been received.
            We will review your request and send an email to{' '}
            <span className="font-semibold text-primary">{form.admin_email}</span> when a decision
            has been made.
          </p>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          This typically takes 1-2 business days.
        </p>
      </div>
      <div className="border-t border-border bg-muted px-6 py-4">
        <Button asChild className="w-full">
          <Link to="/">Back to portal</Link>
        </Button>
      </div>
    </div>
  );
}

function RequestAccessHeader() {
  return (
    <div className="border-b border-border bg-primary px-6 py-5 text-primary-foreground">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-foreground/70">
            TDIS AI
          </p>
          <h1 className="mt-1 text-2xl font-bold">Request Access to TDIS AI</h1>
          <p className="mt-2 text-sm leading-relaxed text-primary-foreground/80">
            Complete the form below and a platform administrator will review your request.
          </p>
        </div>
        <Button asChild variant="outline" className={headerBackButtonClass}>
          <Link to="/">Back to Login</Link>
        </Button>
      </div>
    </div>
  );
}

function SignInPrompt() {
  return (
    <div className="border-t border-border bg-muted px-6 py-4 text-center text-sm text-muted-foreground">
      Already have an account?{' '}
      <Link className="font-semibold text-primary underline-offset-4 hover:underline" to="/">
        Sign in
      </Link>
    </div>
  );
}

function RequestAccessForm({ form, errors, serverError, submitting, onFieldChange, onSubmit }) {
  return (
    <form onSubmit={onSubmit} noValidate>
      <RequestAccessHeader />
      <div className="grid gap-5 p-6">
        <div className="grid gap-2">
          <Label className="text-primary" htmlFor="org_name">
            Organisation Name
          </Label>
          <Input
            id="org_name"
            type="text"
            placeholder="e.g. Harris County EOC"
            value={form.org_name}
            onChange={(event) => onFieldChange('org_name', event.target.value)}
            aria-invalid={Boolean(errors.org_name)}
            aria-describedby={errors.org_name ? 'org_name-error' : undefined}
          />
          <FieldError id="org_name-error" message={errors.org_name} />
        </div>

        <div className="grid gap-2">
          <Label className="text-primary" htmlFor="org_type">
            Organisation Type
          </Label>
          <Select value={form.org_type} onValueChange={(value) => onFieldChange('org_type', value)}>
            <SelectTrigger
              id="org_type"
              className="w-full"
              aria-invalid={Boolean(errors.org_type)}
              aria-describedby={errors.org_type ? 'org_type-error' : undefined}
            >
              <SelectValue placeholder="Select organisation type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="university">University</SelectItem>
              <SelectItem value="state">State</SelectItem>
              <SelectItem value="corporate">Corporate</SelectItem>
            </SelectContent>
          </Select>
          <FieldError id="org_type-error" message={errors.org_type} />
        </div>

        <div className="grid gap-2">
          <Label className="text-primary" htmlFor="admin_name">
            Your Name
          </Label>
          <Input
            id="admin_name"
            type="text"
            placeholder="First and last name"
            value={form.admin_name}
            onChange={(event) => onFieldChange('admin_name', event.target.value)}
            aria-invalid={Boolean(errors.admin_name)}
            aria-describedby={errors.admin_name ? 'admin_name-error' : undefined}
          />
          <FieldError id="admin_name-error" message={errors.admin_name} />
        </div>

        <div className="grid gap-2">
          <Label className="text-primary" htmlFor="admin_email">
            Your Email
          </Label>
          <Input
            id="admin_email"
            type="email"
            placeholder="you@organisation.gov"
            value={form.admin_email}
            onChange={(event) => onFieldChange('admin_email', event.target.value)}
            aria-invalid={Boolean(errors.admin_email)}
            aria-describedby={errors.admin_email ? 'admin_email-error' : undefined}
          />
          <FieldError id="admin_email-error" message={errors.admin_email} />
        </div>

        {serverError ? (
          <div className="rounded-lg border border-destructive/40 bg-background p-3">
            <p className="text-sm font-medium text-destructive">{serverError}</p>
          </div>
        ) : null}

        <Button type="submit" className="h-10 w-full" disabled={submitting}>
          {submitting ? 'Submitting...' : 'Submit Request'}
        </Button>
      </div>
      <SignInPrompt />
    </form>
  );
}

function RequestAccessPage() {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState('');

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setServerError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validateForm(form);
    setErrors(nextErrors);
    setServerError('');
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const response = await submitAccessRequest(form);
      if (response.status === 201) {
        trackAiAssistant('request_access_submit');
        setSubmitted(true);
        return;
      }
      if (response.status === 409) {
        setServerError('A request for this email address is already pending.');
        return;
      }
      if (response.status === 422) {
        setServerError('Please check your details and try again.');
        return;
      }
      setServerError('Something went wrong. Please try again.');
    } catch {
      setServerError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main
      className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-muted px-4 py-12 text-foreground"
      style={requestAccessThemeStyle}
    >
      <section className="w-full max-w-[480px] overflow-hidden rounded-lg border border-border bg-background">
        {submitted ? (
          <ConfirmationState form={form} />
        ) : (
          <RequestAccessForm
            form={form}
            errors={errors}
            serverError={serverError}
            submitting={submitting}
            onFieldChange={updateField}
            onSubmit={handleSubmit}
          />
        )}
      </section>
    </main>
  );
}

export default RequestAccessPage;
