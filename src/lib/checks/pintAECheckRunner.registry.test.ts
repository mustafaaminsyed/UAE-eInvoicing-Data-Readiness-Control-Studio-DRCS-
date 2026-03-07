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

  it('uses system default for CHK-010 when specification identifier is missing', () => {
    const check = getCheck('UAE-UC1-CHK-010');
    const data = buildDataContext({ spec_id: '' });

    const exceptions = runPintAECheck(check, data);

    expect(exceptions).toHaveLength(0);
  });

  it('fails CHK-010 when missing and system default is disabled', () => {
    const check = getCheck('UAE-UC1-CHK-010');
    const strictCheck = {
      ...check,
      parameters: {
        ...check.parameters,
        allow_system_default: false,
      },
    };
    const data = buildDataContext({ spec_id: '' });

    const exceptions = runPintAECheck(strictCheck, data);

    expect(exceptions).toHaveLength(1);
    expect(exceptions[0].check_id).toBe('UAE-UC1-CHK-010');
    expect(exceptions[0].field_name).toBe('spec_id');
    expect(exceptions[0].message).toContain('Missing specification identifier');
  });

  it('fails CHK-010 when specification identifier has invalid prefix', () => {
    const check = getCheck('UAE-UC1-CHK-010');
    const data = buildDataContext({ spec_id: 'urn:peppol:pint:billing-1@uae-1' });

    const exceptions = runPintAECheck(check, data);

    expect(exceptions).toHaveLength(1);
    expect(exceptions[0].check_id).toBe('UAE-UC1-CHK-010');
    expect(exceptions[0].message).toContain('Invalid specification identifier');
  });

  it('passes CHK-010 when specification identifier starts with allowed prefix', () => {
    const check = getCheck('UAE-UC1-CHK-010');
    const data = buildDataContext({ spec_id: 'urn:peppol:pint:billing-1@ae-1#2.0' });

    const exceptions = runPintAECheck(check, data);

    expect(exceptions).toHaveLength(0);
  });

  it('uses system default for CHK-011 when business process is missing', () => {
    const check = getCheck('UAE-UC1-CHK-011');
    const data = buildDataContext({ business_process: '' });

    const exceptions = runPintAECheck(check, data);

    expect(exceptions).toHaveLength(0);
  });

  it('fails CHK-011 when missing and system default is disabled', () => {
    const check = getCheck('UAE-UC1-CHK-011');
    const strictCheck = {
      ...check,
      parameters: {
        ...check.parameters,
        allow_system_default: false,
      },
    };
    const data = buildDataContext({ business_process: '' });

    const exceptions = runPintAECheck(strictCheck, data);

    expect(exceptions).toHaveLength(1);
    expect(exceptions[0].check_id).toBe('UAE-UC1-CHK-011');
    expect(exceptions[0].field_name).toBe('business_process');
    expect(exceptions[0].message).toContain('Missing business process type');
  });

  it('passes CHK-011 for both allowed business process values', () => {
    const check = getCheck('UAE-UC1-CHK-011');
    const billing = buildDataContext({ business_process: 'urn:peppol:bis:billing' });
    const selfBilling = buildDataContext({ business_process: 'urn:peppol:bis:selfbilling' });

    expect(runPintAECheck(check, billing)).toHaveLength(0);
    expect(runPintAECheck(check, selfBilling)).toHaveLength(0);
  });
});
