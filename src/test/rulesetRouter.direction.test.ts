import { describe, expect, it } from 'vitest';
import { buildOrganizationProfileExceptions, getRulesetForDirection } from '@/lib/validation/rulesetRouter';
import { Buyer, InvoiceHeader } from '@/types/compliance';
import { OrganizationProfile } from '@/types/direction';

describe('ruleset routing by direction', () => {
  it('routes AR and AP explicitly', () => {
    expect(getRulesetForDirection('AR')).toBe('AR');
    expect(getRulesetForDirection('AP')).toBe('AP');
  });

  it('validates our-side TRN against org profile by direction', () => {
    const profile: OrganizationProfile = { ourEntityTRNs: ['100000000000001'] };
    const headers: InvoiceHeader[] = [
      {
        invoice_id: 'INV-1',
        invoice_number: 'INV-1',
        issue_date: '2026-01-01',
        seller_trn: '999999999999999',
        buyer_id: 'B-1',
        currency: 'AED',
      },
    ];
    const buyerMap = new Map<string, Buyer>([
      ['B-1', { buyer_id: 'B-1', buyer_name: 'Counterparty', buyer_trn: '999999999999998' }],
    ]);

    const arExceptions = buildOrganizationProfileExceptions(profile, { direction: 'AR', headers, buyerMap });
    const apExceptions = buildOrganizationProfileExceptions(profile, { direction: 'AP', headers, buyerMap });

    expect(arExceptions).toHaveLength(1);
    expect(arExceptions[0].field).toBe('seller_trn');
    expect(arExceptions[0].direction).toBe('AR');

    expect(apExceptions).toHaveLength(1);
    expect(apExceptions[0].field).toBe('buyer_trn');
    expect(apExceptions[0].direction).toBe('AP');
  });
});

