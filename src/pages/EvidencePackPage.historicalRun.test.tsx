import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import EvidencePackPage from '@/pages/EvidencePackPage';

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/context/ComplianceContext', () => ({
  useCompliance: () => ({
    buyers: [],
    headers: [],
    lines: [],
    pintAEExceptions: [],
    isChecksRun: false,
    runSummary: null,
    lastPintRuleTelemetry: [],
  }),
}));

vi.mock('@/lib/api/checksApi', () => ({
  fetchCheckRuns: vi.fn(async () => [
    {
      id: 'historic-run-1',
      run_date: '2026-03-14T10:00:00.000Z',
      total_invoices: 10,
      total_exceptions: 1,
      critical_count: 0,
      high_count: 1,
      medium_count: 0,
      low_count: 0,
      pass_rate: 90,
      results_summary: {
        evidenceSnapshot: {
          version: 1,
          captured_at: '2026-03-14T10:00:00.000Z',
          dataset_name: 'Historical Seller',
          counts: {
            totalInvoices: 10,
            totalBuyers: 4,
            totalLines: 20,
          },
          populations: [
            {
              dataset: 'headers',
              columns: [
                { column: 'invoice_number', totalRows: 10, populatedCount: 10, populationPct: 100 },
              ],
            },
          ],
        },
        evidenceRuleExecutionTelemetry: [
          {
            rule_id: 'UAE-UC1-CHK-001',
            execution_count: 10,
            failure_count: 1,
            execution_source: 'runtime',
          },
        ],
      },
    },
  ]),
}));

vi.mock('@/lib/api/pintAEApi', () => ({
  fetchExceptionsByRun: vi.fn(async () => [
    {
      id: 'exc-1',
      timestamp: '2026-03-14T10:00:00.000Z',
      check_id: 'UAE-UC1-CHK-001',
      check_name: 'Invoice number present',
      severity: 'High',
      scope: 'Header',
      rule_type: 'structural_rule',
      execution_layer: 'schema',
      failure_class: 'structural_failure',
      pint_reference_terms: ['IBT-001'],
      invoice_id: 'INV-1',
      invoice_number: 'INV-001',
      message: 'Invoice number missing',
      root_cause_category: 'Data Entry Error',
      owner_team: 'Client Finance',
      sla_target_hours: 24,
      case_status: 'Open',
    },
  ]),
}));

describe('EvidencePackPage historical runs', () => {
  it('renders from the persisted evidence snapshot instead of requiring an in-memory run', async () => {
    render(<EvidencePackPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/persisted snapshot captured for the selected run/i)
      ).toBeInTheDocument();
    });

    expect(screen.getByText('Historical Seller')).toBeInTheDocument();
    expect(screen.queryByText(/Run compliance checks first/i)).not.toBeInTheDocument();
  });
});
