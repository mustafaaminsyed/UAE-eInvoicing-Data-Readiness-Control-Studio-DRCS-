import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { Navigation } from '@/components/Navigation';

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light', setTheme: vi.fn() }),
}));

vi.mock('@/context/ComplianceContext', () => ({
  useCompliance: () => ({
    activeDatasetType: 'AP',
    isDataLoaded: true,
    isChecksRun: false,
  }),
}));

describe('Navigation', () => {
  it('renders compact workspace context and utilities without duplicate route navigation', () => {
    render(
      <MemoryRouter initialEntries={['/upload']}>
        <Navigation />
      </MemoryRouter>
    );

    expect(screen.getByText('UAE e-Invoicing')).toBeInTheDocument();
    expect(screen.queryByText('Upload workspace')).not.toBeInTheDocument();
    expect(screen.getByText('AP / Inbound')).toBeInTheDocument();
    expect(screen.getByText('Data loaded')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Light mode enabled' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Primary navigation' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Run Checks' })).not.toBeInTheDocument();
  });

  it('remains absent from the landing page', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <Navigation />
      </MemoryRouter>
    );

    expect(container).toBeEmptyDOMElement();
  });
});
