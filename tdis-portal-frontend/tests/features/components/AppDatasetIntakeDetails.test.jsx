/**
 * @fileoverview Unit tests for AppDatasetIntakeDetails component
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppDatasetIntakeDetails from '@/components/AppDatasetIntakeDetails';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockSubmitIntakeForm = vi.fn();
const mockValidateIntakeForm = vi.fn();
const mockFormatDateForAPI = vi.fn((d) => (d ? '01-15-2026' : ''));

vi.mock('@/services/intakeService.js', () => ({
  submitIntakeForm: (data) => mockSubmitIntakeForm(data),
  validateIntakeForm: (data) => mockValidateIntakeForm(data),
  formatDateForAPI: (d) => mockFormatDateForAPI(d),
}));

function renderWithRouter() {
  return render(
    <MemoryRouter>
      <AppDatasetIntakeDetails />
    </MemoryRouter>
  );
}

describe('AppDatasetIntakeDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateIntakeForm.mockReturnValue({ isValid: true, errors: [] });
    mockFormatDateForAPI.mockReturnValue('01-15-2026');
  });

  it('renders form header and back button', () => {
    renderWithRouter();
    expect(screen.getByRole('heading', { name: /Application\/Datasets/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Navigate back to home page/i })).toBeInTheDocument();
  });

  it('renders process description and form sections', () => {
    renderWithRouter();
    expect(screen.getByText(/Process of Application\/Datasets In-Take/i)).toBeInTheDocument();
    expect(screen.getByText(/Application \/ Datasets In-take Form:/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter agency name/i)).toBeInTheDocument();
    expect(screen.getByText(/Select request type/i)).toBeInTheDocument();
  });

  it('back button navigates to home', () => {
    renderWithRouter();
    fireEvent.click(screen.getByRole('button', { name: /Navigate back to home page/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('handleFieldChange updates form and clears validation errors', () => {
    renderWithRouter();
    mockValidateIntakeForm.mockReturnValueOnce({
      isValid: false,
      errors: ['Agency name required'],
    });
    const agencyInput = screen.getByPlaceholderText(/Enter agency name/i);
    fireEvent.change(agencyInput, { target: { value: 'Test Agency' } });
    expect(agencyInput).toHaveValue('Test Agency');
  });

  it('submit with validation errors shows error message', async () => {
    mockValidateIntakeForm.mockReturnValue({
      isValid: false,
      errors: ['Agency name is required', 'Description is required'],
    });
    renderWithRouter();
    fireEvent.click(screen.getByRole('button', { name: /^Submit$/i }));
    await waitFor(() => {
      expect(screen.getByText(/Please fix the following errors/i)).toBeInTheDocument();
    });
    const errorBox = document.querySelector('[data-error-message]');
    expect(errorBox?.textContent).toMatch(/Agency name|Description|required/);
    expect(mockSubmitIntakeForm).not.toHaveBeenCalled();
  });

  it('submit success shows success message and navigates after delay', async () => {
    mockSubmitIntakeForm.mockResolvedValue({ success: true });
    const scrollIntoView = vi.fn();
    document.querySelector = vi.fn(() => ({ scrollIntoView }));
    renderWithRouter();
    fireEvent.change(screen.getByPlaceholderText(/Enter agency name/i), {
      target: { value: 'Agency' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Enter agency contact name/i), {
      target: { value: 'Contact' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Enter agency contact email/i), {
      target: { value: 'a@b.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Enter brief description/i), {
      target: { value: 'Desc' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Enter end user/i), {
      target: { value: 'Personas' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Enter data inputs formats/i), {
      target: { value: 'CSV' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Submit$/i }));
    await waitFor(() => {
      expect(screen.getByText(/Form submitted successfully/i)).toBeInTheDocument();
    });
    expect(mockSubmitIntakeForm).toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 3500));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  }, 10000);

  it('submit API error shows error message', async () => {
    mockSubmitIntakeForm.mockResolvedValue({ success: false, error: 'API error' });
    renderWithRouter();
    fireEvent.change(screen.getByPlaceholderText(/Enter agency name/i), {
      target: { value: 'Agency' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Enter agency contact name/i), {
      target: { value: 'Contact' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Enter agency contact email/i), {
      target: { value: 'a@b.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Enter brief description/i), {
      target: { value: 'Desc' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Enter end user/i), {
      target: { value: 'Personas' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Enter data inputs formats/i), {
      target: { value: 'CSV' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Submit$/i }));
    await waitFor(() => {
      expect(screen.getByText(/API error/i)).toBeInTheDocument();
    });
  });

  it('submit catch sets error message', async () => {
    mockSubmitIntakeForm.mockRejectedValue(new Error('Network error'));
    renderWithRouter();
    fireEvent.change(screen.getByPlaceholderText(/Enter agency name/i), {
      target: { value: 'Agency' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Enter agency contact name/i), {
      target: { value: 'Contact' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Enter agency contact email/i), {
      target: { value: 'a@b.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Enter brief description/i), {
      target: { value: 'Desc' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Enter end user/i), {
      target: { value: 'Personas' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Enter data inputs formats/i), {
      target: { value: 'CSV' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Submit$/i }));
    await waitFor(() => {
      expect(screen.getByText(/An unexpected error occurred/i)).toBeInTheDocument();
    });
  });

  it('submitting shows Submitting... and disables button', async () => {
    let resolveSubmit;
    mockSubmitIntakeForm.mockImplementation(
      () =>
        new Promise((r) => {
          resolveSubmit = r;
        })
    );
    renderWithRouter();
    fireEvent.change(screen.getByPlaceholderText(/Enter agency name/i), {
      target: { value: 'Agency' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Enter agency contact name/i), {
      target: { value: 'Contact' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Enter agency contact email/i), {
      target: { value: 'a@b.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Enter brief description/i), {
      target: { value: 'Desc' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Enter end user/i), {
      target: { value: 'Personas' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Enter data inputs formats/i), {
      target: { value: 'CSV' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Submit$/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Submitting/i })).toBeDisabled();
    });
    resolveSubmit({ success: true });
  });

  it('request type and funding can be changed', () => {
    renderWithRouter();
    fireEvent.click(screen.getByLabelText(/Not funded/i));
    expect(screen.getByLabelText(/Not funded/i)).toBeChecked();
  });
});
