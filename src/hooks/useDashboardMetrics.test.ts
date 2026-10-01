import { describe, expect, it } from 'vitest';

import { computeDashboardMetrics } from '@/hooks/useDashboardMetrics';
import type { ValidationExecutionEvidence } from '@/types/validationExecution';

function evidence(overrides: Partial<ValidationExecutionEvidence>): ValidationExecutionEvidence {
  return {
    ruleId: 'rule', ruleName: 'Rule', controlClass: 'regulatory', layer: 'pint_ae', direction: 'AR',
    registered: true, candidateCount: 1, applicableCount: 1, notApplicableCount: 0,
    evaluatedCount: 1, passedCount: 1, failedCount: 0, notEvaluatedCount: 0,
    applicability: 'applicable', evaluation: 'evaluated', outcome: 'pass', executionSource: 'runtime',
    ...overrides,
  };
}

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

  it('keeps supplementary outcomes out of regulatory headline metrics', () => {
    const metrics = computeDashboardMetrics({
      totalInvoicesInScope: 1,
      checkResults: [],
      validationExecutions: [
        evidence({ ruleId: 'PINT-1' }),
        evidence({
          ruleId: 'CORE-1', controlClass: 'supplementary_data_readiness', layer: 'core',
          passedCount: 0, failedCount: 1, outcome: 'fail',
        }),
      ],
    });

    expect(metrics.rulePassRate).toBe(100);
    expect(metrics.regulatory.evaluatedOutcomes).toBe(1);
    expect(metrics.supplementary.failedOutcomes).toBe(1);
  });

  it('does not count not-evaluated outcomes as passed or report 100% for zero evaluations', () => {
    const metrics = computeDashboardMetrics({
      totalInvoicesInScope: 1,
      checkResults: [],
      validationExecutions: [evidence({
        evaluatedCount: 0, passedCount: 0, notEvaluatedCount: 1,
        evaluation: 'not_evaluated', outcome: 'not_evaluated',
      })],
    });

    expect(metrics.rulePassRate).toBeNull();
    expect(metrics.regulatory.passedOutcomes).toBe(0);
    expect(metrics.regulatory.notEvaluatedOutcomes).toBe(1);
    expect(metrics.evaluationCoverage).toBe(0);
  });

  it('calculates evaluation coverage independently from pass rate', () => {
    const metrics = computeDashboardMetrics({
      totalInvoicesInScope: 1,
      checkResults: [],
      validationExecutions: [evidence({
        candidateCount: 2, applicableCount: 2, evaluatedCount: 1,
        passedCount: 1, notEvaluatedCount: 1,
      })],
    });

    expect(metrics.rulePassRate).toBe(100);
    expect(metrics.evaluationCoverage).toBe(50);
  });
});
