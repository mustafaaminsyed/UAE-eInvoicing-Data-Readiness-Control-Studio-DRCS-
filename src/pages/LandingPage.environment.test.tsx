import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import LandingPage from '@/pages/LandingPage';

vi.mock('@/context/ComplianceContext', () => ({
  useCompliance: () => ({
    isDataLoaded: false,
    isChecksRun: false,
    headers: [],
  }),
}));

vi.mock('@/lib/api/mappingApi', () => ({
  fetchActiveTemplates: vi.fn(async () => []),
}));

vi.mock('@/lib/api/casesApi', () => ({
  fetchCases: vi.fn(async () => []),
}));

vi.mock('next-themes', () => ({
  useTheme: () => ({
    resolvedTheme: 'dark',
    setTheme: vi.fn(),
  }),
}));

describe('LandingPage environment selector', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders DEV/PROD access toggle and switches the active preview route', async () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Client access')).toBeInTheDocument();
    });

    expect(screen.getByText('Operating context')).toBeInTheDocument();
    expect(screen.getByText('United Arab Emirates')).toBeInTheDocument();
    expect(screen.getByText('GST • UTC+04:00')).toBeInTheDocument();

    const devButton = screen.getByRole('button', { name: /dev/i });
    const prodButton = screen.getByRole('button', { name: /prod/i });

    expect(devButton).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByText(/DEV ACCESS|DEV sandbox lane selected/i).length).toBeGreaterThan(0);

    fireEvent.click(prodButton);

    expect(prodButton).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByText(/PROD ACCESS|PROD production lane selected/i).length).toBeGreaterThan(0);
    expect(window.localStorage.getItem('drcs.preview_environment_v1')).toBe('PROD');
  });
});
