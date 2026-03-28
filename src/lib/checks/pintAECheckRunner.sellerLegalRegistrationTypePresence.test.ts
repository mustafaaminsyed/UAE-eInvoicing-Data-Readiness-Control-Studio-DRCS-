import { describe, expect, it } from 'vitest';

import { runPintAECheck } from '@/lib/checks/pintAECheckRunner';
import { UAE_UC1_CHECK_PACK } from '@/lib/checks/uaeUC1CheckPack';
import { getValidationDRTargets } from '@/lib/registry/validationToDRMap';
import type { DataContext, InvoiceHeader } from '@/types/compliance';

function getCheck(checkId: string) {
  const check = UAE_UC1_CHECK_PACK.find((item) => item.check_id === checkId);
  if (!check) throw new Error(`Missing check fixture: ${checkId}`);
  return check;
}

function buildDataContext(overrides: Partial<InvoiceHeader>): DataContext {
  const header: InvoiceHeader = {
    invoice_id: 'INV-1',
    invoice_number: 'A-1001',
    issue_date: '2026-02-01',
    seller_trn: '123456789012345',
    seller_legal_reg_id: 'LIC-12345',
    seller_legal_reg_id_type: 'TL',
    buyer_id: 'B-1',
    currency: 'AED',
    ...overrides,
  };

  return {
    buyers: [
      {
        buyer_id: 'B-1',
        buyer_name: 'Buyer LLC',
        buyer_trn: '123456789012345',
      },
    ],
    headers: [header],
    lines: [],
    buyerMap: new Map([['B-1', { buyer_id: 'B-1', buyer_name: 'Buyer LLC', buyer_trn: '123456789012345' }]]),
    headerMap: new Map([[header.invoice_id, header]]),
    linesByInvoice: new Map(),
  };
}

describe('UAE-UC1-CHK-014B seller legal registration type presence', () => {
  it('maps directly to BTUAE-15', () => {
    expect(getValidationDRTargets('UAE-UC1-CHK-014B')).toEqual([
      { dr_id: 'BTUAE-15', mapping_type: 'exact', validated_fields: ['seller_legal_reg_id_type'] },
    ]);
  });

  it('raises a presence exception when seller_legal_reg_id_type is missing and seller_legal_reg_id exists', () => {
    const check = getCheck('UAE-UC1-CHK-014B');
    const data = buildDataContext({ seller_legal_reg_id_type: '' });

    const exceptions = runPintAECheck(check, data);

    expect(exceptions).toHaveLength(1);
    expect(exceptions[0].check_id).toBe('UAE-UC1-CHK-014B');
    expect(exceptions[0].field_name).toBe('seller_legal_reg_id_type');
    expect(exceptions[0].message).toContain('Missing seller legal registration identifier type');
  });

  it('does not raise an exception when seller_legal_reg_id is absent', () => {
    const check = getCheck('UAE-UC1-CHK-014B');
    const data = buildDataContext({ seller_legal_reg_id: '', seller_legal_reg_id_type: '' });

    const exceptions = runPintAECheck(check, data);

    expect(exceptions).toHaveLength(0);
  });
});
