import { describe, expect, it } from 'vitest';

import { computeDashboardMetrics } from '@/hooks/useDashboardMetrics';

describe('computeDashboardMetrics', () => {
  it('keeps submission-ready rate separate from rule pass rate when one document fails any rule', () => {
    const metrics = computeDashboardMetrics({
      totalInvoicesInScope: 1,
      checkResults: [
        { passed: 1, failed: 0, severity: 'High', exceptions: [] },
        { passed: 1, failed: 0, severity: 'High', exceptions: [] },
        { passed: 1, failed: 0, severity: 'High', exceptions: [] },
        { passed: 1, failed: 0, severity: 'High', exceptions: [] },
        {
          passed: 0,
          failed: 1,
          severity: 'High',
          exceptions: [{ invoiceId: 'INV-1', severity: 'High' }],
        },
      ],
      exceptions: [{ invoiceId: 'INV-1', severity: 'High' }],
    });

    expect(metrics.submissionReadyCount).toBe(0);
    expect(metrics.submissionReadyRate).toBe(0);
    expect(metrics.rulePassRate).toBe(80);
    expect(metrics.totalRuleOutcomes).toBe(5);
  });

  it('derives blocker outcome volume separately from affected document count', () => {
    const metrics = computeDashboardMetrics({
      totalInvoicesInScope: 3,
      checkResults: [
        {
          passed: 0,
          failed: 18,
          severity: 'Critical',
          exceptions: [
            { invoiceId: 'INV-1', severity: 'Critical' },
            { invoiceId: 'INV-1', severity: 'Critical' },
            { invoiceId: 'INV-1', severity: 'Critical' },
            { invoiceId: 'INV-1', severity: 'Critical' },
            { invoiceId: 'INV-1', severity: 'Critical' },
            { invoiceId: 'INV-1', severity: 'Critical' },
            { invoiceId: 'INV-2', severity: 'Critical' },
            { invoiceId: 'INV-2', severity: 'Critical' },
            { invoiceId: 'INV-2', severity: 'Critical' },
            { invoiceId: 'INV-2', severity: 'Critical' },
            { invoiceId: 'INV-2', severity: 'Critical' },
            { invoiceId: 'INV-3', severity: 'Critical' },
            { invoiceId: 'INV-3', severity: 'Critical' },
            { invoiceId: 'INV-3', severity: 'Critical' },
            { invoiceId: 'INV-3', severity: 'Critical' },
            { invoiceId: 'INV-3', severity: 'Critical' },
            { invoiceId: 'INV-3', severity: 'Critical' },
            { invoiceId: 'INV-3', severity: 'Critical' },
          ],
        },
      ],
      exceptions: [
        { invoiceId: 'INV-1', severity: 'Critical' },
        { invoiceId: 'INV-1', severity: 'Critical' },
        { invoiceId: 'INV-1', severity: 'Critical' },
        { invoiceId: 'INV-1', severity: 'Critical' },
        { invoiceId: 'INV-1', severity: 'Critical' },
        { invoiceId: 'INV-1', severity: 'Critical' },
        { invoiceId: 'INV-2', severity: 'Critical' },
        { invoiceId: 'INV-2', severity: 'Critical' },
        { invoiceId: 'INV-2', severity: 'Critical' },
        { invoiceId: 'INV-2', severity: 'Critical' },
        { invoiceId: 'INV-2', severity: 'Critical' },
        { invoiceId: 'INV-3', severity: 'Critical' },
        { invoiceId: 'INV-3', severity: 'Critical' },
        { invoiceId: 'INV-3', severity: 'Critical' },
        { invoiceId: 'INV-3', severity: 'Critical' },
        { invoiceId: 'INV-3', severity: 'Critical' },
        { invoiceId: 'INV-3', severity: 'Critical' },
        { invoiceId: 'INV-3', severity: 'Critical' },
      ],
    });

    expect(metrics.criticalBlockerOutcomes).toBe(18);
    expect(metrics.criticalBlockerDocumentCount).toBe(3);
    expect(metrics.avgCriticalBlockersPerDocument).toBe(6.0);
  });
});
