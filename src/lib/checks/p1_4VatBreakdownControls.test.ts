import { describe, expect, it } from 'vitest';
import { runPintAECheckWithTelemetry } from './pintAECheckRunner';
import { UAE_UC1_CHECK_PACK } from './uaeUC1CheckPack';
import { DataContext, InvoiceHeader, InvoiceLine } from '@/types/compliance';

const check = (id: string) => UAE_UC1_CHECK_PACK.find((item) => item.check_id === id)!;

function context(vatTotal: number, adjustments: 'absent' | 'unknown' = 'absent'): DataContext {
  const header: InvoiceHeader = {
    invoice_id: 'INV-1', invoice_number: 'INV-1', issue_date: '2026-01-01', seller_trn: '100000000000001',
    buyer_id: 'B-1', currency: 'AED', vat_total: vatTotal,
    ...(adjustments === 'absent' ? { document_level_allowance_total: 0, document_level_charge_total: 0 } : {}),
  };
  const lines: InvoiceLine[] = [{
    line_id: 'L1', invoice_id: 'INV-1', line_number: 1, quantity: 1, unit_price: 100,
    line_total_excl_vat: 100, vat_rate: 5, vat_amount: 999, tax_category_code: 'S',
  }];
  return {
    buyers: [], headers: [header], lines, buyerMap: new Map(),
    headerMap: new Map([[header.invoice_id, header]]), linesByInvoice: new Map([[header.invoice_id, lines]]),
  };
}

describe('P1.4 VAT breakdown controls', () => {
  it('passes IBT-110 reconciliation against derived IBT-117 rather than line VAT', () => {
    const result = runPintAECheckWithTelemetry(check('UAE-UC1-CHK-029'), context(5));
    expect(result.exceptions).toHaveLength(0);
    expect(result.executionResults).toContainEqual(expect.objectContaining({ status: 'passed' }));
  });

  it('fails IBT-110 reconciliation when the derived breakdown sum differs', () => {
    const result = runPintAECheckWithTelemetry(check('UAE-UC1-CHK-029'), context(6));
    expect(result.exceptions[0]?.message).toContain('sum of derived IBT-117 breakdowns');
    expect(result.executionResults).toContainEqual(expect.objectContaining({ status: 'failed' }));
  });

  it.each(['UAE-UC1-CHK-027', 'UAE-UC1-CHK-028', 'UAE-UC1-CHK-029', 'UAE-UC1-CHK-054'])(
    'reports dependency/not-evaluated rather than false PASS for %s',
    (id) => {
      const result = runPintAECheckWithTelemetry(check(id), context(5, 'unknown'));
      expect(result.exceptions).toHaveLength(0);
      expect(result.telemetry).toMatchObject({ execution_count: 0, not_evaluated_count: 1, passed_count: 0 });
      expect(result.executionResults[0]).toMatchObject({ status: 'not_evaluated' });
      expect(result.executionResults[0].reason).toContain('Document-adjustment dependency');
    }
  );
});
