import { describe, expect, it } from 'vitest';

import { runPintAECheck } from '@/lib/checks/pintAECheckRunner';
import { UAE_UC1_CHECK_PACK } from '@/lib/checks/uaeUC1CheckPack';
import { getValidationDRTargets } from '@/lib/registry/validationToDRMap';
import type { Buyer, DataContext, InvoiceHeader } from '@/types/compliance';

function getCheck(checkId: string) {
  const check = UAE_UC1_CHECK_PACK.find((item) => item.check_id === checkId);
  if (!check) throw new Error(`Missing check fixture: ${checkId}`);
  return check;
}

function buildDataContext(buyerOverride: Partial<Buyer>): DataContext {
  const buyer: Buyer = {
    buyer_id: 'B-1',
    buyer_name: 'Buyer LLC',
    buyer_trn: '123456789012345',
    buyer_address: 'Main Street',
    buyer_city: 'Dubai',
    buyer_subdivision: 'AE-DU',
    buyer_country: 'AE',
    ...buyerOverride,
  };

  const header: InvoiceHeader = {
    invoice_id: 'INV-1',
    invoice_number: 'A-1001',
    issue_date: '2026-02-01',
    seller_trn: '123456789012345',
    buyer_id: buyer.buyer_id,
    currency: 'AED',
  };

  return {
    buyers: [buyer],
    headers: [header],
    lines: [],
    buyerMap: new Map([[buyer.buyer_id, buyer]]),
    headerMap: new Map([[header.invoice_id, header]]),
    linesByInvoice: new Map(),
  };
}

describe('UAE-UC1-CHK-020 buyer address coverage', () => {
  it('maps buyer city and subdivision as direct executable DR targets', () => {
    expect(getValidationDRTargets('UAE-UC1-CHK-020')).toEqual([
      { dr_id: 'IBT-050', mapping_type: 'exact', validated_fields: ['buyer_address'] },
      { dr_id: 'IBT-052', mapping_type: 'exact', validated_fields: ['buyer_city'] },
      { dr_id: 'IBT-054', mapping_type: 'exact', validated_fields: ['buyer_subdivision'] },
      { dr_id: 'IBT-055', mapping_type: 'exact', validated_fields: ['buyer_country'] },
    ]);
  });

  it('raises presence exceptions for missing buyer city and subdivision', () => {
    const check = getCheck('UAE-UC1-CHK-020');
    const data = buildDataContext({ buyer_city: '', buyer_subdivision: '' });

    const exceptions = runPintAECheck(check, data);

    expect(exceptions).toHaveLength(2);
    expect(exceptions.map((exception) => exception.field_name)).toEqual(['buyer_city', 'buyer_subdivision']);
  });
});
