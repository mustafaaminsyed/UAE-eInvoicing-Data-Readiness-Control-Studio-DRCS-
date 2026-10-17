import { describe, expect, it } from 'vitest';

import { buildObligationRuntimeComparison } from '@/modules/scenarioContext/obligationRuntimeComparison';
import type { ScenarioInvoiceInput } from '@/modules/scenarioLens/types';
import type { ValidationExecutionEvidence } from '@/types/validationExecution';

const standardInvoice = {
  header: { invoice_type: '380', seller_trn: '100000000000003', billing_frequency: 'Monthly', paid_amount: 0 },
  lines: [],
  buyer: null,
} as ScenarioInvoiceInput;

function execution(ruleId: string, evaluatedCount: number): ValidationExecutionEvidence {
  return {
    ruleId,
    ruleName: ruleId,
    controlClass: 'regulatory',
    layer: 'pint_ae',
    direction: 'AR',
    registered: true,
    candidateCount: 1,
    applicableCount: evaluatedCount ? 1 : 0,
    notApplicableCount: evaluatedCount ? 0 : 1,
    evaluatedCount,
    passedCount: evaluatedCount,
    failedCount: 0,
    notEvaluatedCount: 0,
    applicability: evaluatedCount ? 'applicable' : 'not_applicable',
    evaluation: evaluatedCount ? 'evaluated' : 'not_evaluated',
    outcome: evaluatedCount ? 'pass' : 'not_applicable',
    executionSource: 'runtime',
  };
}

describe('obligation runtime comparison', () => {
  it('reports linked runtime evaluation as aligned for an applicable obligation', () => {
    const report = buildObligationRuntimeComparison([standardInvoice], [execution('UAE-UC1-CHK-013', 1)]);
    expect(report.rows.find((row) => row.termId === 'IBT-031')).toMatchObject({
      shadowApplicableCount: 1,
      runtimeEvaluatedCount: 1,
      status: 'aligned',
    });
  });

  it('flags runtime execution against a wholly not-applicable shadow population', () => {
    const report = buildObligationRuntimeComparison([standardInvoice], [execution('UAE-UC1-CHK-055', 1)]);
    expect(report.rows.find((row) => row.termId === 'BTAE-03')?.status).toBe('not_applicable_but_evaluated');
  });

  it('flags applicable obligations without linked runtime support', () => {
    const report = buildObligationRuntimeComparison([standardInvoice], [execution('UAE-UC1-CHK-013', 1)]);
    expect(report.rows.find((row) => row.termId === 'BTAE-07')?.status).toBe('unsupported');
  });

  it('keeps unresolved applicability in policy review', () => {
    const unresolved = { header: { invoice_type: '380' }, lines: [], buyer: null } as ScenarioInvoiceInput;
    const report = buildObligationRuntimeComparison([unresolved], [execution('UAE-UC1-CHK-013', 1)]);
    expect(report.rows.find((row) => row.termId === 'IBT-031')?.status).toBe('policy_review');
  });

  it('does not claim alignment before a runtime run exists', () => {
    const report = buildObligationRuntimeComparison([standardInvoice], []);
    expect(report.rows.find((row) => row.termId === 'IBT-031')?.status).toBe('policy_review');
    expect(report).toMatchObject({ shadow: true, authoritative: false, invoiceCount: 1 });
  });
});
