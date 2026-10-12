/**
 * @fileoverview Unit tests for AppDatasetIntake component
 * Feature: components
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AppDatasetIntake from '@/components/AppDatasetIntake';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockTrackEvent = vi.fn();
vi.mock('@/utils/googleAnalytics.js', () => ({
  trackEvent: (...args) => mockTrackEvent(...args),
  DATASET_INTAKE: 'dataset_intake',
}));

function renderIntake() {
  return render(
    <MemoryRouter>
      <AppDatasetIntake />
    </MemoryRouter>
  );
}

describe('AppDatasetIntake', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the intake section heading and description', () => {
    renderIntake();
    expect(screen.getByRole('region', { name: /Application and Datasets Submission/i })).toHaveAttribute(
      'id',
      'app-dataset-intake'
    );
    expect(
      screen.getByRole('heading', { name: /Application\/Datasets In-Take Process/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/TDIS Working Committee/i)).toBeInTheDocument();
  });

  it('tracks analytics and navigates to the intake form on click', async () => {
    const user = userEvent.setup();
    renderIntake();
    await user.click(screen.getByRole('button', { name: /View application intake process/i }));

    expect(mockTrackEvent).toHaveBeenCalledWith('dataset_intake', 'dataset_intake', {
      tab: 'home',
      action: 'open_form',
      event_label: 'open_form',
    });
    expect(mockNavigate).toHaveBeenCalledWith('/application-in-take');
  });
});
