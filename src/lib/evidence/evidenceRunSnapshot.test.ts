import { describe, expect, it } from 'vitest';

import {
  buildEvidenceRunSnapshot,
  getEvidenceRuleExecutionTelemetry,
  getEvidenceRunSnapshot,
} from '@/lib/evidence/evidenceRunSnapshot';
import type { CheckRun } from '@/types/customChecks';

describe('evidenceRunSnapshot', () => {
  it('builds a lightweight run-scoped snapshot from runtime data', () => {
    const snapshot = buildEvidenceRunSnapshot(
      [{ buyer_id: 'B001', buyer_name: 'Acme' } as any],
      [{ invoice_id: 'INV-1', seller_name: 'Seller One', seller_trn: '123' } as any],
      [{ invoice_id: 'INV-1', line_id: '1', description: 'Item A' } as any],
    );

    expect(snapshot.version).toBe(1);
    expect(snapshot.dataset_name).toBe('Seller One');
    expect(snapshot.counts).toEqual({
      totalInvoices: 1,
      totalBuyers: 1,
      totalLines: 1,
    });
    expect(snapshot.populations.length).toBeGreaterThan(0);
  });

  it('extracts a persisted evidence snapshot from a saved check run', () => {
    const run: CheckRun = {
      id: 'run-1',
      run_date: new Date().toISOString(),
      total_invoices: 1,
      total_exceptions: 0,
      critical_count: 0,
      high_count: 0,
      medium_count: 0,
      low_count: 0,
      pass_rate: 100,
      results_summary: {
        evidenceSnapshot: {
          version: 1,
          captured_at: new Date().toISOString(),
          dataset_name: 'Historical Seller',
          counts: { totalInvoices: 10, totalBuyers: 4, totalLines: 25 },
          populations: [],
        },
      },
    };

    expect(getEvidenceRunSnapshot(run)).toMatchObject({
      dataset_name: 'Historical Seller',
      counts: { totalInvoices: 10, totalBuyers: 4, totalLines: 25 },
    });
  });

  it('extracts persisted runtime telemetry from a saved check run', () => {
    const run: CheckRun = {
      id: 'run-2',
      run_date: new Date().toISOString(),
      total_invoices: 1,
      total_exceptions: 0,
      critical_count: 0,
      high_count: 0,
      medium_count: 0,
      low_count: 0,
      pass_rate: 100,
      results_summary: {
        evidenceRuleExecutionTelemetry: [
          {
            rule_id: 'UAE-UC1-CHK-001',
            execution_count: 10,
            failure_count: 2,
            execution_source: 'runtime',
          },
        ],
      },
    };

    expect(getEvidenceRuleExecutionTelemetry(run)).toEqual([
      {
        rule_id: 'UAE-UC1-CHK-001',
        execution_count: 10,
        failure_count: 2,
        execution_source: 'runtime',
      },
    ]);
  });
});
