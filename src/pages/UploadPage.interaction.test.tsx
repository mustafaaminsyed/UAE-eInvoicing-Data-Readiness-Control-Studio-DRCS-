import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import UploadPage from '@/pages/UploadPage';
import { ComplianceProvider } from '@/context/ComplianceContext';

vi.mock('@/lib/api/pintAEApi', async () => {
  const actual = await vi.importActual<any>('@/lib/api/pintAEApi');
  return {
    ...actual,
    seedUC1CheckPack: vi.fn(async () => ({ success: true, message: 'ok' })),
  };
});

describe('UploadPage interactions', () => {
  it('renders document scenario guidance', () => {
    render(
      <MemoryRouter>
        <ComplianceProvider>
          <UploadPage />
        </ComplianceProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('Supported document scenarios')).toBeInTheDocument();
    expect(screen.getByText('Credit note requirements')).toBeInTheDocument();
  });

  it('describes the canonical upload path and directs source extracts to Mapping Studio', () => {
    render(
      <MemoryRouter>
        <ComplianceProvider>
          <UploadPage />
        </ComplianceProvider>
      </MemoryRouter>
    );

    const progress = screen.getByRole('list', { name: 'Ingestion progress' });
    expect(progress).toHaveTextContent('Upload');
    expect(progress).toHaveTextContent('Structural Validation');
    expect(progress).toHaveTextContent('Run Checks');
    expect(progress).not.toHaveTextContent('Mapping');
    expect(screen.getByText('Canonical DRCS CSV templates')).toBeInTheDocument();
    expect(screen.getByText(/non-canonical ERP\/source extracts, aliased columns, or a combined export/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Mapping Studio first' })).toBeInTheDocument();
  });

  it('does not open file picker when switching AR/AP and sample scenario toggles', () => {
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click');

    render(
      <MemoryRouter>
        <ComplianceProvider>
          <UploadPage />
        </ComplianceProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('radio', { name: 'Customer Invoices (AR / Outbound)' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Vendor Invoices (AP / Inbound)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Positive Samples' }));
    fireEvent.click(screen.getByRole('button', { name: 'Negative Test Samples' }));

    expect(clickSpy).not.toHaveBeenCalled();
    clickSpy.mockRestore();
  });
});
