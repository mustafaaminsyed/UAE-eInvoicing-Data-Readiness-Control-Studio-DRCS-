import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import SubmissionsPage from '@/pages/SubmissionsPage';

vi.mock('@/context/ComplianceContext', () => ({
  useCompliance: () => ({
    activeDatasetType: 'AR',
    getDataForDataset: (datasetType: 'AR' | 'AP') =>
      datasetType === 'AR'
        ? {
            buyers: [
              {
                buyer_id: 'buyer-1',
                buyer_name: 'Al Noor Stores LLC',
              },
            ],
            headers: [
              {
                invoice_id: 'inv-1',
                invoice_number: 'INV-001',
                issue_date: '2026-03-05',
                seller_trn: '1000000001',
                seller_name: 'Dariba Retail LLC',
                buyer_id: 'buyer-1',
                currency: 'AED',
              },
            ],
            lines: [
              {
                line_id: 'line-1',
                invoice_id: 'inv-1',
                line_number: 1,
                quantity: 1,
                unit_price: 100,
                line_total_excl_vat: 100,
                vat_rate: 5,
                vat_amount: 5,
              },
            ],
          }
        : {
            buyers: [],
            headers: [],
            lines: [],
          },
    hasDatasetLoaded: (datasetType: 'AR' | 'AP') => datasetType === 'AR',
    getDashboardStats: () => ({
      totalInvoices: 1,
      totalExceptions: 1,
      exceptionsBySeverity: { Critical: 1, High: 0, Medium: 0, Low: 0 },
      topFailingChecks: [],
      passRate: 84,
    }),
    exceptions: [
      {
        id: 'exc-1',
        checkId: 'CHK-01',
        checkName: 'Seller Name Present',
        severity: 'Critical',
        message: 'Missing seller name',
        datasetType: 'AR',
      },
    ],
    isChecksRun: true,
    isRunning: false,
    lastChecksRunAt: '2026-03-19T08:30:00.000Z',
  }),
}));

vi.mock('@/lib/uploadAudit', () => ({
  getUploadAuditLogs: () => [
    {
      id: 'audit-1',
      createdAt: '2026-03-18T11:00:00.000Z',
      datasetType: 'AP',
      buyersCount: 24,
      headersCount: 41,
      linesCount: 126,
      datasets: [
        {
          dataset: 'buyers',
          fileName: 'horizon_buyers.csv',
          fileSize: 100,
          rowCount: 24,
          columnCount: 12,
          requiredMissing: [],
          nullWarnings: [],
        },
        {
          dataset: 'headers',
          fileName: 'horizon_headers.csv',
          fileSize: 100,
          rowCount: 41,
          columnCount: 18,
          requiredMissing: [],
          nullWarnings: [],
        },
        {
          dataset: 'lines',
          fileName: 'horizon_lines.csv',
          fileSize: 100,
          rowCount: 126,
          columnCount: 22,
          requiredMissing: [],
          nullWarnings: [],
        },
      ],
      relationalChecks: [
        {
          label: 'lines.invoice_id -> headers.invoice_id',
          matchPct: 100,
          unmatchedCount: 0,
          total: 126,
        },
      ],
    },
  ],
}));

describe('SubmissionsPage', () => {
  it('renders the dataset queue and opens the submission workspace placeholder for a selected dataset', () => {
    render(
      <MemoryRouter>
        <SubmissionsPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Submission queue')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /upload dataset/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /run validation/i }).length).toBeGreaterThan(0);
    expect(screen.getByText('Dataset name')).toBeInTheDocument();
    expect(screen.getByText('Readiness score')).toBeInTheDocument();

    expect(screen.getAllByText('AR current workspace').length).toBeGreaterThan(1);
    expect(screen.getByText('AP intake 01')).toBeInTheDocument();

    fireEvent.click(screen.getByText('AP intake 01'));

    expect(screen.getByText('Submission workspace')).toBeInTheDocument();
    expect(screen.getAllByText('AP intake 01').length).toBeGreaterThan(1);
    expect(screen.getByText('Attached dataset files')).toBeInTheDocument();
  });
});
