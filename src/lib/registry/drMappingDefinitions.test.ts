import { describe, expect, it } from 'vitest';

import { getValidationIdsForDR, VALIDATION_TO_DR_MAP } from '@/lib/registry/validationToDRMap';
import { PINT_AE_UC1_FIELDS } from '@/types/fieldMapping';

describe('DR mapping definitions', () => {
  it('does not label fx_rate as IBT-007', () => {
    const field = PINT_AE_UC1_FIELDS.find((entry) => entry.id === 'fx_rate');

    expect(field).toBeDefined();
    expect(field?.ibtReference).toBe('BTAE-04');
  });

  it('links seller BTUAE-15 only through the seller-side legal registration type rule', () => {
    expect(getValidationIdsForDR('BTUAE-15')).toEqual(['UAE-UC1-CHK-014B']);
    expect(getValidationIdsForDR('BTUAE-15', { includeReferenceOnly: true })).toEqual(['UAE-UC1-CHK-014B']);
  });

  it('maps CHK-035 to the source tax category used by current BTAE-08 rules', () => {
    const mapping = VALIDATION_TO_DR_MAP.find((entry) => entry.validation_id === 'UAE-UC1-CHK-035');

    expect(mapping?.dr_targets).toEqual(expect.arrayContaining([
      expect.objectContaining({ dr_id: 'IBT-151', validated_fields: ['tax_category_code'] }),
    ]));
  });

  it('classifies IBT-106 as derived from IBT-131 and exposes conditional IBT-149 source input', () => {
    expect(PINT_AE_UC1_FIELDS.some((entry) => entry.id === 'sum_line_net_amount')).toBe(false);
    expect(PINT_AE_UC1_FIELDS.find((entry) => entry.id === 'price_base_quantity')).toMatchObject({
      ibtReference: 'IBT-149',
      isMandatory: false,
    });

    const mapping = VALIDATION_TO_DR_MAP.find((entry) => entry.validation_id === 'UAE-UC1-CHK-021');
    expect(mapping?.dr_targets).toEqual(expect.arrayContaining([
      expect.objectContaining({ dr_id: 'IBT-106', validated_fields: ['line_total_excl_vat'] }),
    ]));
  });
});
