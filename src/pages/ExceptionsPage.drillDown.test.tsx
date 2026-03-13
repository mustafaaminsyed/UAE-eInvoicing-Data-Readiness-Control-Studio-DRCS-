import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import ExceptionsPage from '@/pages/ExceptionsPage';

vi.mock('@/context/ComplianceContext', () => ({
  useCompliance: () => ({
    isChecksRun: true,
    exceptions: [
      {
        id: 'ex-1',
        checkId: 'vat_calc_mismatch',
        checkName: 'VAT Calculation Mismatch',
        severity: 'High',
        message: 'VAT mismatch',
        datasetType: 'AR',
        sellerTrn: 'TRN-001',
        invoiceNumber: 'INV-1',
      },
      {
        id: 'ex-2',
        checkId: 'buyer_trn_invalid_format',
        checkName: 'Buyer TRN Invalid Format',
        severity: 'Medium',
        message: 'TRN invalid',
        datasetType: 'AR',
        sellerTrn: 'TRN-001',
        invoiceNumber: 'INV-2',
      },
    ],
    direction: 'AR',
    lastChecksRunAt: '2026-03-13T00:00:00.000Z',
    lastChecksRunDatasetType: 'AR',
  }),
}));

vi.mock('@/lib/api/validationExplainApi', () => ({
  generateValidationExplanation: vi.fn(),
}));

vi.mock('@/components/explanations/ExplanationPackPanel', () => ({
  ExplanationPackPanel: () => <div>Explanation Panel</div>,
}));

vi.mock('@/components/run/LastRunContextBanner', () => ({
  LastRunContextBanner: () => <div>Run Banner</div>,
}));

describe('ExceptionsPage heatmap drill-down', () => {
  it('shows a contextual banner and precise exception filtering when drill-down params are present', () => {
    render(
      <MemoryRouter
        initialEntries={[
          '/exceptions?dataset=AR&seller=TRN-001&dimension=tax_logic_integrity&context=entity-risk-matrix&precision=precise',
        ]}
      >
        <Routes>
          <Route path="/exceptions" element={<ExceptionsPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText(/entity risk drill-down/i)).toBeInTheDocument();
    expect(screen.getByText(/tax logic integrity/i)).toBeInTheDocument();
    expect(screen.getByText('VAT Calculation Mismatch')).toBeInTheDocument();
    expect(screen.queryByText('Buyer TRN Invalid Format')).not.toBeInTheDocument();
  });
});
