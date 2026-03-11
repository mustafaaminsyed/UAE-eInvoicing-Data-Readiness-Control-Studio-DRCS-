import { useEffect } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { ComplianceProvider, useCompliance } from '@/context/ComplianceContext';
import TraceabilityPage from '@/pages/TraceabilityPage';

function SeedUploadedData() {
  const { setData } = useCompliance();

  useEffect(() => {
    setData(
      {
        buyers: [
          {
            buyer_id: 'B001',
            buyer_name: 'Acme LLC',
            buyer_trn: '100000000000003',
            source_row_number: 2,
          },
        ],
        headers: [
          {
            invoice_id: 'INV001',
            invoice_number: 'UAE-2025-0001',
            issue_date: '2025-01-15',
            seller_trn: '100000000000001',
            buyer_id: 'B001',
            currency: 'AED',
            direction: 'AR',
          },
        ],
        lines: [
          {
            line_id: 'L001',
            invoice_id: 'INV001',
            line_number: 1,
            quantity: 10,
            unit_price: 100,
            line_total_excl_vat: 1000,
            vat_rate: 5,
            vat_amount: 50,
          },
        ],
        direction: 'AR',
      },
      'AR'
    );
    // Intentionally run once for test seeding. setData is not memoized in context.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

describe('TraceabilityPage MoF overlay', () => {
  it('keeps tax/commercial rows separate and shows explicit denominator policy', async () => {
    render(
      <MemoryRouter initialEntries={['/traceability']}>
        <ComplianceProvider>
          <SeedUploadedData />
          <Routes>
            <Route path="/traceability" element={<TraceabilityPage />} />
          </Routes>
        </ComplianceProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText('DR Coverage & Traceability')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'MoF Overlay View' }));

    await waitFor(() => {
      expect(screen.getByTestId('mof-overlay-summary')).toHaveTextContent('Showing 100 of 100 MoF fields');
      expect(screen.getByTestId('mof-overlay-summary')).toHaveTextContent('Tax rows: 51');
      expect(screen.getByTestId('mof-overlay-summary')).toHaveTextContent('Commercial rows: 49');
    });

    // Collision IDs remain split by document type semantics.
    expect(screen.getByText('Buyer tax identifier')).toBeInTheDocument();
    expect(screen.getByText('Buyer legal registration identifier')).toBeInTheDocument();
    expect(screen.getByText('VAT line amount in AED')).toBeInTheDocument();
    expect(screen.getAllByText('Item name').length).toBeGreaterThan(0);
    expect(screen.getByText('Invoice line amount in AED')).toBeInTheDocument();
    expect(screen.getAllByText('Item description').length).toBeGreaterThan(0);

    expect(screen.getByTestId('denominator-policy')).toHaveTextContent(
      'MoF Tax 51 | MoF Commercial 49 | PINT 50 | Ingestion 45'
    );
  });
});
