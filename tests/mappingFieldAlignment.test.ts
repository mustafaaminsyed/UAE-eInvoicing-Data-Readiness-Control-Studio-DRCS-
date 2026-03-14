import { describe, expect, it } from 'vitest';

import {
  getCanonicalPintFieldId,
  getPintFieldById,
  normalizeFieldMappings,
  PINT_AE_UC1_FIELDS,
  type FieldMapping,
} from '@/types/fieldMapping';

function buildLegacyMapping(fieldId: string): FieldMapping {
  return {
    id: `mapping-${fieldId}`,
    erpColumn: fieldId,
    erpColumnIndex: 0,
    targetField: {
      id: fieldId,
      name: fieldId,
      description: fieldId,
      ibtReference: 'IBT-000',
      category: 'header',
      isMandatory: true,
      dataType: 'string',
    },
    confidence: 1,
    isConfirmed: true,
    transformations: [],
    sampleValues: ['sample'],
  };
}

describe('mapping field alignment', () => {
  it('normalizes legacy field IDs to canonical runtime field IDs', () => {
    expect(getCanonicalPintFieldId('seller_endpoint')).toBe('seller_electronic_address');
    expect(getCanonicalPintFieldId('seller_street')).toBe('seller_address');
    expect(getCanonicalPintFieldId('line_vat_amount')).toBe('vat_amount');
  });

  it('normalizes loaded mappings that still use legacy target field ids', () => {
    const normalized = normalizeFieldMappings([
      buildLegacyMapping('seller_endpoint'),
      buildLegacyMapping('line_vat_amount'),
    ]);

    expect(normalized[0].targetField.id).toBe('seller_electronic_address');
    expect(normalized[1].targetField.id).toBe('vat_amount');
  });

  it('exposes the new UAE VAT dependency fields in the mapping catalog', () => {
    expect(getPintFieldById('exemption_reason_code')?.name).toBe('Exemption Reason Code');
    expect(getPintFieldById('exemption_reason_text')?.name).toBe('Exemption Reason Text');
    expect(getPintFieldById('goods_service_type')?.name).toBe('Goods / Service Type');

    const ids = new Set(PINT_AE_UC1_FIELDS.map((field) => field.id));
    expect(ids.has('exemption_reason_code')).toBe(true);
    expect(ids.has('exemption_reason_text')).toBe(true);
    expect(ids.has('goods_service_type')).toBe(true);
  });
});
