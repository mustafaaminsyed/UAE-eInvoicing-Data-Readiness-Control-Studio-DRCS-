import { describe, expect, it } from 'vitest';
import { runAllChecksWithTelemetry } from '@/lib/checks/checksRegistry';
import type { Buyer, DataContext, InvoiceHeader, InvoiceLine } from '@/types/compliance';

function context(buyerTrn: string | undefined, taxCategory?: string): DataContext {
  const buyer: Buyer = { buyer_id: 'B-1', buyer_name: 'Buyer', buyer_trn: buyerTrn };
  const header: InvoiceHeader = {
    invoice_id: 'I-1', invoice_number: 'INV-1', issue_date: '2026-10-01', seller_trn: '123456789012345',
    buyer_id: buyer.buyer_id, currency: 'AED',
  };
  const line: InvoiceLine = {
    line_id: 'L-1', invoice_id: header.invoice_id, line_number: 1, description: 'Service', quantity: 1,
    unit_price: 100, line_total_excl_vat: 100, vat_rate: taxCategory === 'AE' ? 0 : 5,
    vat_amount: taxCategory === 'AE' ? 0 : 5, tax_category_code: taxCategory,
  };
  return {
    buyers: [buyer], headers: [header], lines: [line],
    buyerMap: new Map([[buyer.buyer_id, buyer]]),
    headerMap: new Map([[header.invoice_id, header]]),
    linesByInvoice: new Map([[header.invoice_id, [line]]]),
  };
}

describe('Buyer TRN supplementary controls', () => {
  it('passes a valid supplied TRN and evaluates applicability', () => {
    const result = runAllChecksWithTelemetry(context('123456789012345'));
    expect(result.checkResults.find((item) => item.checkId === 'buyer_trn_missing')).toMatchObject({ passed: 1, failed: 0 });
  });

  it('fails an invalid supplied TRN', () => {
    const result = runAllChecksWithTelemetry(context('invalid'));
    expect(result.checkResults.find((item) => item.checkId === 'buyer_trn_invalid_format')?.failed).toBe(1);
  });

  it('marks blank indeterminate TRN as not evaluated, never passed or failed', () => {
    const result = runAllChecksWithTelemetry(context(undefined));
    const evidence = result.executionEvidence.find((item) => item.ruleId === 'buyer_trn_missing');
    expect(result.checkResults.find((item) => item.checkId === 'buyer_trn_missing')).toMatchObject({ passed: 0, failed: 0 });
    expect(evidence).toMatchObject({ passedCount: 0, failedCount: 0, notEvaluatedCount: 1, outcome: 'not_evaluated' });
  });

  it('fails a blank TRN when reverse charge deterministically requires it', () => {
    const result = runAllChecksWithTelemetry(context(undefined, 'AE'));
    expect(result.checkResults.find((item) => item.checkId === 'buyer_trn_missing')?.failed).toBe(1);
    expect(result.executionEvidence.find((item) => item.ruleId === 'buyer_trn_missing')).toMatchObject({
      failedCount: 1, notEvaluatedCount: 0, outcome: 'fail',
    });
  });
});
