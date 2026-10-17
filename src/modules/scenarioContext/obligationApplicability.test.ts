import { describe, expect, it } from 'vitest';

import {
  buildObligationApplicabilityReport,
  evaluateObligationApplicability,
} from '@/modules/scenarioContext/obligationApplicability';
import type { ScenarioInvoiceInput } from '@/modules/scenarioLens/types';

function input(header: Record<string, unknown>): ScenarioInvoiceInput {
  return { header, lines: [], buyer: null } as ScenarioInvoiceInput;
}

describe('shadow obligation applicability', () => {
  it('applies credit-note obligations while honoring the VD exception', () => {
    const creditNote = input({ invoice_type: '381', credit_note_reason_code: 'ADJ' });
    expect(evaluateObligationApplicability('BTAE-03', creditNote)?.state).toBe('applicable');
    expect(evaluateObligationApplicability('IBT-025', creditNote)?.state).toBe('applicable');

    const voidCreditNote = input({ invoice_type: '381', credit_note_reason_code: 'VD' });
    expect(evaluateObligationApplicability('IBT-025', voidCreditNote)?.state).toBe('not_applicable');
  });

  it('does not apply credit-note terms to a standard invoice', () => {
    const standard = input({ invoice_type: '380' });
    expect(evaluateObligationApplicability('BTAE-03', standard)?.state).toBe('not_applicable');
    expect(evaluateObligationApplicability('IBT-025', standard)?.state).toBe('not_applicable');
  });

  it('selects one seller identifier and excludes its alternative', () => {
    const vatSeller = input({ invoice_type: '380', seller_trn: '100000000000003' });
    expect(evaluateObligationApplicability('IBT-031', vatSeller)?.state).toBe('applicable');
    expect(evaluateObligationApplicability('IBT-032', vatSeller)?.state).toBe('not_applicable');

    const tinSeller = input({ invoice_type: '388', seller_tax_registration_id: '1000000001' });
    expect(evaluateObligationApplicability('IBT-031', tinSeller)?.state).toBe('not_applicable');
    expect(evaluateObligationApplicability('IBT-032', tinSeller)?.state).toBe('applicable');
  });

  it('keeps missing alternative and payment evidence unresolved', () => {
    const unknown = input({ invoice_type: '380' });
    expect(evaluateObligationApplicability('IBT-031', unknown)?.state).toBe('unresolved');
    expect(evaluateObligationApplicability('IBT-032', unknown)?.state).toBe('unresolved');
    expect(evaluateObligationApplicability('IBT-113', unknown)?.state).toBe('unresolved');
  });

  it("requires the invoice note only when billing frequency is Others", () => {
    expect(evaluateObligationApplicability('IBT-022', input({ billing_frequency: 'Others' }))?.state).toBe('applicable');
    expect(evaluateObligationApplicability('IBT-022', input({ billing_frequency: 'Monthly' }))?.state).toBe('not_applicable');
    expect(evaluateObligationApplicability('IBT-022', input({}))?.state).toBe('unresolved');
  });

  it('marks the complete report as non-authoritative shadow output', () => {
    const report = buildObligationApplicabilityReport(input({ invoice_type: '380', seller_trn: '100000000000003' }));
    expect(report.decisions).toHaveLength(9);
    expect(report.summary.applicable + report.summary.not_applicable + report.summary.unresolved).toBe(9);
    expect(report).toMatchObject({ shadow: true, authoritative: false });
    expect(report.decisions.every((item) => item.shadow && !item.authoritative)).toBe(true);
  });
});
