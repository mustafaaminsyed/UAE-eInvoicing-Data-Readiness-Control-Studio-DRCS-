import { describe, expect, it } from 'vitest';
import { DataContext, InvoiceHeader } from '@/types/compliance';
import { runPintAECheck } from '@/lib/checks/pintAECheckRunner';
import { UAE_UC1_CHECK_PACK } from '@/lib/checks/uaeUC1CheckPack';

function buildDataContext(overrides: Partial<InvoiceHeader>): DataContext {
  const buyers = [
    {
      buyer_id: 'B-1',
      buyer_name: 'Buyer LLC',
      buyer_trn: '123456789012345',
    },
  ];

  const header: InvoiceHeader = {
    invoice_id: 'INV-1',
    invoice_number: 'A-1001',
    issue_date: '2026-02-01',
    seller_trn: '123456789012345',
    buyer_id: 'B-1',
    currency: 'AED',
    ...overrides,
  };

  const headers = [header];
  const lines = [];

  return {
    buyers,
    headers,
    lines,
    buyerMap: new Map(buyers.map((buyer) => [buyer.buyer_id, buyer])),
    headerMap: new Map(headers.map((item) => [item.invoice_id, item])),
    linesByInvoice: new Map(),
  };
}

function getCheck(checkId: string) {
  const check = UAE_UC1_CHECK_PACK.find((item) => item.check_id === checkId);
  if (!check) throw new Error(`Missing check fixture: ${checkId}`);
  return check;
}

describe('runPintAECheck executor registry parity', () => {
  it('handles presence check UAE-UC1-CHK-001', () => {
    const check = getCheck('UAE-UC1-CHK-001');
    const data = buildDataContext({ invoice_number: '' });

    const exceptions = runPintAECheck(check, data);

    expect(exceptions).toHaveLength(1);
    expect(exceptions[0].check_id).toBe('UAE-UC1-CHK-001');
    expect(exceptions[0].invoice_id).toBe('INV-1');
    expect(exceptions[0].field_name).toBe('invoice_number');
    expect(exceptions[0].message).toContain('Missing required field');
  });

  it('handles pattern check UAE-UC1-CHK-003', () => {
    const check = getCheck('UAE-UC1-CHK-003');
    const data = buildDataContext({ issue_date: '2026/02/01' });

    const exceptions = runPintAECheck(check, data);

    expect(exceptions).toHaveLength(1);
    expect(exceptions[0].check_id).toBe('UAE-UC1-CHK-003');
    expect(exceptions[0].invoice_id).toBe('INV-1');
    expect(exceptions[0].field_name).toBe('issue_date');
    expect(exceptions[0].message).toContain('format invalid');
  });

  it('handles codelist check UAE-UC1-CHK-006', () => {
    const check = getCheck('UAE-UC1-CHK-006');
    const data = buildDataContext({ currency: 'ZZZ' });

    const exceptions = runPintAECheck(check, data);

    expect(exceptions).toHaveLength(1);
    expect(exceptions[0].check_id).toBe('UAE-UC1-CHK-006');
    expect(exceptions[0].invoice_id).toBe('INV-1');
    expect(exceptions[0].field_name).toBe('currency');
    expect(exceptions[0].message).toContain('ISO4217 codelist');
  });
});
