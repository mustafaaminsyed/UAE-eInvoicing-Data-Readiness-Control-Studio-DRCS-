import { describe, expect, it } from 'vitest';

import {
  getRegulatoryObligation,
  getRegulatoryObligations,
  getRegulatoryObligationsByState,
} from '@/lib/registry/regulatoryObligationRegistry';

describe('regulatory obligation registry', () => {
  it('seeds the reconciled priority obligations with unique canonical identities', () => {
    const obligations = getRegulatoryObligations();
    expect(obligations.map((entry) => entry.termId)).toEqual([
      'BTAE-07', 'BTAE-03', 'IBT-025', 'IBT-026', 'IBT-031',
      'IBT-032', 'IBT-113', 'BTAE-06', 'IBT-022',
    ]);
    expect(new Set(obligations.map((entry) => entry.termId)).size).toBe(obligations.length);
  });

  it('keeps the ASP UUID outside taxpayer source requirements', () => {
    expect(getRegulatoryObligation('BTAE-07')).toMatchObject({
      responsibility: 'asp_generated',
      acquisitionMethod: 'asp_generation',
      implementationState: 'external_boundary',
      sourceFields: [],
    });
  });

  it('models seller VAT and tax identifiers as one-of alternatives', () => {
    const vatId = getRegulatoryObligation('IBT-031');
    const taxId = getRegulatoryObligation('IBT-032');
    expect(vatId?.applicability).toEqual({
      kind: 'alternative',
      groupId: 'seller-tax-identifier',
      minimumRequired: 1,
      alternatives: ['IBT-031', 'IBT-032'],
    });
    expect(taxId?.applicability).toEqual(vatId?.applicability);
  });

  it('records conditional dependencies without making them universal upload requirements', () => {
    expect(getRegulatoryObligation('IBT-022')?.applicability).toMatchObject({
      kind: 'conditional',
      dependsOn: ['BTAE-06'],
    });
    expect(getRegulatoryObligation('IBT-025')?.applicability).toMatchObject({
      kind: 'conditional',
      dependsOn: ['IBT-003', 'BTAE-03'],
    });
  });

  it('exposes implementation gaps for later prioritisation', () => {
    expect(getRegulatoryObligationsByState('not_implemented').map((entry) => entry.termId)).toEqual([
      'IBT-032', 'IBT-113', 'BTAE-06',
    ]);
  });

  it('returns defensive copies', () => {
    const first = getRegulatoryObligations();
    first[0].sourceFields.push('unexpected');
    expect(getRegulatoryObligation('BTAE-07')?.sourceFields).toEqual([]);
  });
});
