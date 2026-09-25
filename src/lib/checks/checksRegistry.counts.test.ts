import { describe, expect, it } from 'vitest';
import { runAllChecks } from './checksRegistry';
import { DataContext, InvoiceHeader } from '@/types/compliance';

describe('record outcome counts', () => {
  it('counts one failed invoice once even when several fields fail', () => {
    const headers: InvoiceHeader[] = [{ invoice_id: 'I1', invoice_number: '', issue_date: '', seller_trn: '', buyer_id: '', currency: '' }];
    const data: DataContext = { buyers: [], headers, lines: [], buyerMap: new Map(), headerMap: new Map(), linesByInvoice: new Map() };
    const result = runAllChecks(data).find(check => check.checkId === 'missing_mandatory_fields')!;
    expect(result.exceptions).toHaveLength(4);
    expect(result.failed).toBe(1);
    expect(result.passed).toBe(0);
  });
});
