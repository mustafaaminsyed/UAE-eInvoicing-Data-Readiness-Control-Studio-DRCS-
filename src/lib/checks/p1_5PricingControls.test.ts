import { describe, expect, it } from 'vitest';
import { runPintAECheck } from './pintAECheckRunner';
import { UAE_UC1_CHECK_PACK } from './uaeUC1CheckPack';
import type { DataContext, InvoiceHeader, InvoiceLine } from '@/types/compliance';

const check = UAE_UC1_CHECK_PACK.find((item) => item.check_id === 'UAE-UC1-CHK-062')!;

function context(lines: InvoiceLine[]): DataContext {
  const headers: InvoiceHeader[] = [{ invoice_id: 'I1', invoice_number: 'INV-1', issue_date: '2026-01-01', seller_trn: '100000000000003', buyer_id: 'B1', currency: 'AED' }];
  return { buyers: [], headers, lines, buyerMap: new Map(), headerMap: new Map(headers.map((h) => [h.invoice_id, h])), linesByInvoice: new Map([['I1', lines]]) };
}

function line(overrides: Partial<InvoiceLine> = {}): InvoiceLine {
  return { line_id: 'L1', invoice_id: 'I1', line_number: 1, quantity: 1, unit_price: 100, line_total_excl_vat: 100, vat_rate: 5, vat_amount: 5, ...overrides };
}

describe('P1.5 item price runtime control', () => {
  it('accepts discount and no-discount pricing without using line allowance fields', () => {
    expect(runPintAECheck(check, context([line({ item_price_discount: 20, line_allowance_amount: 7 })]))).toHaveLength(0);
    expect(runPintAECheck(check, context([line({ line_discount: 7 })]))).toHaveLength(0);
  });

  it.each([
    { unit_price: -1 },
    { item_price_discount: -1 },
    { price_base_quantity: 0 },
  ])('rejects invalid pricing facts %#', (overrides) => {
    expect(runPintAECheck(check, context([line(overrides)]))).toHaveLength(1);
  });

  it('evaluates credit-note pricing without sign inversion and each line independently', () => {
    const data = context([line(), line({ line_id: 'L2', line_number: 2, unit_price: -2 })]);
    data.headers[0].invoice_type = '381';
    const failures = runPintAECheck(check, data);
    expect(failures).toHaveLength(1);
    expect(failures[0].line_id).toBe('L2');
  });
});
