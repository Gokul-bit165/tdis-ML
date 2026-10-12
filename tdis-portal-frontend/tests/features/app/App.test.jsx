/**
 * @fileoverview Unit tests for App
 * Feature: app
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import App from '@/App';
import store from '@/store';

vi.mock('@/services/eventService', () => ({
  fetchEventCounts: vi.fn(),
  fetchEventData: vi.fn().mockResolvedValue({
    geojson: { type: 'FeatureCollection', features: [] },
    latestEventDate: null,
  }),
}));

function renderApp(initialRoute = '/') {
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialRoute]}>
        <App />
      </MemoryRouter>
    </Provider>
  );
}

describe('App', () => {
  it('renders without crashing', () => {
    renderApp();
    expect(document.body).toBeTruthy();
  });

  it('shows disclaimer when not accepted', () => {
    renderApp();
    expect(screen.getByText(/I ACCEPT/i)).toBeInTheDocument();
  });

  it('renders footer', () => {
    renderApp();
    expect(screen.getByText(/TDIS © All rights reserved/i)).toBeInTheDocument();
  });
});
