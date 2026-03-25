import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import DataTwinPage from '@/pages/DataTwinPage';

vi.mock('@/context/ComplianceContext', () => ({
  useCompliance: () => ({
    getDataForDataset: (dataset: 'AR' | 'AP') =>
      dataset === 'AR'
        ? {
            buyers: [{ buyer_id: 'B-100', buyer_name: 'Buyer 100' }],
            headers: [
              {
                invoice_id: 'INV-100',
                invoice_number: 'UAE-INV-100',
                issue_date: '2026-03-01',
                seller_trn: '100000000000001',
                seller_name: 'Dariba Live LLC',
                buyer_id: 'B-100',
                currency: 'AED',
                source_row_number: 12,
              },
            ],
            lines: [
              {
                line_id: 'LINE-100',
                invoice_id: 'INV-100',
                line_number: 1,
                quantity: 1,
                unit_price: 100,
                line_total_excl_vat: 100,
                vat_rate: 5,
                vat_amount: 5,
              },
            ],
            direction: 'AR',
          }
        : { buyers: [], headers: [], lines: [], direction: 'AP' },
    getInvoiceDetails: (invoiceId: string) =>
      invoiceId === 'INV-100'
        ? {
            header: {
              invoice_id: 'INV-100',
              invoice_number: 'UAE-INV-100',
              issue_date: '2026-03-01',
              seller_trn: '100000000000001',
              seller_name: 'Dariba Live LLC',
              buyer_id: 'B-100',
              currency: 'AED',
              source_row_number: 12,
            },
            lines: [{ invoice_id: 'INV-100' }],
            buyer: { buyer_id: 'B-100', buyer_name: 'Buyer 100' },
            exceptions: [
              {
                id: 'EX-100',
                checkId: 'seller_identity_completeness',
                checkName: 'Seller identity completeness',
                severity: 'High',
                message: 'Seller legal registration detail is missing.',
                field: 'seller_trn',
                datasetType: 'AR',
                invoiceId: 'INV-100',
                invoiceNumber: 'UAE-INV-100',
              },
            ],
            pintAEExceptions: [{ message: 'PINT exception' }],
          }
        : { header: undefined, lines: [], buyer: undefined, exceptions: [], pintAEExceptions: [] },
    exceptions: [
      {
        id: 'EX-100',
        checkId: 'seller_identity_completeness',
        checkName: 'Seller identity completeness',
        severity: 'High',
        message: 'Seller legal registration detail is missing.',
        field: 'seller_trn',
        datasetType: 'AR',
        invoiceId: 'INV-100',
        invoiceNumber: 'UAE-INV-100',
      },
    ],
    isChecksRun: true,
    activeMappingProfileByDirection: {
      AR: { id: 'uae-ar-baseline', version: 2 },
      AP: null,
    },
    lastChecksRunAt: '2026-03-25T10:30:00.000Z',
    lastChecksRunDatasetType: 'AR',
    runSummary: {
      total_invoices_tested: 1,
      total_exceptions: 1,
      pass_rate_percent: 0,
    },
  }),
}));

describe('Data Twin route', () => {
  it('renders a live invoice-backed twin and updates node detail context when a node is selected', () => {
    render(
      <MemoryRouter initialEntries={['/data-twin']}>
        <Routes>
          <Route path="/data-twin" element={<DataTwinPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Invoice lineage canvas')).toBeInTheDocument();
    expect(screen.getAllByText('UAE-INV-100').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Dariba Live LLC').length).toBeGreaterThan(0);
    expect(screen.getByText('Trace summary')).toBeInTheDocument();
    expect(screen.getByText('Record notes')).toBeInTheDocument();
    expect(screen.getByText('Related issues')).toBeInTheDocument();
    expect(screen.getAllByText('Source').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Mapping').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Rule').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Exception').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Evidence').length).toBeGreaterThan(0);

    const exceptionNodeButton = screen.getByRole('button', { name: /exception case/i });

    fireEvent.click(exceptionNodeButton);

    expect(screen.getByText('Exception node')).toBeInTheDocument();
    expect(screen.getAllByText('1 linked').length).toBeGreaterThan(0);
    expect(exceptionNodeButton).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: /mapping profile/i }));
    expect(screen.getAllByText(/uae-ar-baseline v2/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /open mapping studio/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /evidence pack/i }));
    expect(screen.getByText(/1 invoice with 1 total exception/i)).toBeInTheDocument();
  });
});
