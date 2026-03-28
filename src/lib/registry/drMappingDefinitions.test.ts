import { describe, expect, it } from 'vitest';

import { getValidationIdsForDR } from '@/lib/registry/validationToDRMap';
import { PINT_AE_UC1_FIELDS } from '@/types/fieldMapping';

describe('DR mapping definitions', () => {
  it('does not label fx_rate as IBT-007', () => {
    const field = PINT_AE_UC1_FIELDS.find((entry) => entry.id === 'fx_rate');

    expect(field).toBeDefined();
    expect(field?.ibtReference).toBe('BTUAE-002');
  });

  it('does not link seller BTUAE-15 through the buyer-side CHK-037 mapping', () => {
    expect(getValidationIdsForDR('BTUAE-15')).toEqual([]);
    expect(getValidationIdsForDR('BTUAE-15', { includeReferenceOnly: true })).toEqual([]);
  });
});
