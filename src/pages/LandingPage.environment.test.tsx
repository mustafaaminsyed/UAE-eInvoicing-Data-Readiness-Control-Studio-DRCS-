import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
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

describe('LandingPage public dashboard preview', () => {
  it('renders the illustrative dashboard without private controls', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Readiness dashboard')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /uae e-invoicing readiness/i })).toBeInTheDocument();
    expect(screen.getByText('Mandatory coverage')).toBeInTheDocument();
    expect(screen.getByText('Readiness score')).toBeInTheDocument();
    expect(screen.getByText(/UAE Enterprise/)).toBeInTheDocument();
    expect(screen.getByText('Top issues requiring attention')).toBeInTheDocument();
    expect(screen.getByText('Illustrative sample metrics')).toBeInTheDocument();
    expect(screen.getByText('Peppol interoperability framework')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /uae ministry of finance emblem/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /uae federal tax authority logo/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /peppol logo/i })).toBeInTheDocument();
    expect(screen.getByText(/not endorsed by/i)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /get started/i })[0]).toHaveAttribute('href', '/upload');
    expect(screen.getByRole('link', { name: /see how it works/i })).toHaveAttribute('href', '#workflow');
    expect(screen.getByRole('link', { name: /explore the workflow/i })).toHaveAttribute('href', '#workflow');
    expect(screen.queryByRole('button', { name: /dev/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /prod/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /phase 1 mandatory implementation countdown/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Engro/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/IBR-\d+/i)).not.toBeInTheDocument();
  });

  it('opens the external PINT playbook from the Resources menu', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );

    const resourcesButton = screen.getByRole('button', { name: /resources/i });
    expect(resourcesButton).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(resourcesButton);

    const playbook = screen.getByRole('menuitem', { name: /pint data requirements playbook/i });
    expect(resourcesButton).toHaveAttribute('aria-expanded', 'true');
    expect(playbook).toHaveAttribute('href', 'https://claude.ai/artifact/NDJhTZAmgYoDaLU46UYZUU');
    expect(playbook).toHaveAttribute('target', '_blank');
    expect(playbook).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(screen.getByText(/separate from the DRCS production validation engine/i)).toBeInTheDocument();
  });
});
