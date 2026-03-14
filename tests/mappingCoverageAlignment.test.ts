import { describe, expect, it } from 'vitest';

import { analyzeCoverage, analyzeRegistryCoverage } from '@/lib/mapping/coverageAnalyzer';
import { getPintFieldById, type FieldMapping } from '@/types/fieldMapping';

function buildMapping(fieldId: string): FieldMapping {
  const targetField = getPintFieldById(fieldId);
  if (!targetField) {
    throw new Error(`Unknown field ${fieldId}`);
  }

  return {
    id: `mapping-${fieldId}`,
    erpColumn: fieldId,
    erpColumnIndex: 0,
    targetField,
    confidence: 1,
    isConfirmed: true,
    transformations: [],
    sampleValues: ['sample'],
  };
}

describe('mapping coverage alignment', () => {
  it('counts legacy alias mappings as covered mandatory fields', () => {
    const legacyLikeMappings = [
      {
        ...buildMapping('seller_electronic_address'),
        targetField: {
          ...buildMapping('seller_electronic_address').targetField,
          id: 'seller_endpoint',
        },
      },
    ];

    const coverage = analyzeCoverage(legacyLikeMappings);

    expect(coverage.mappedMandatory.map((field) => field.id)).toContain('seller_electronic_address');
    expect(coverage.unmappedMandatory.map((field) => field.id)).not.toContain('seller_electronic_address');
  });

  it('derives registry coverage from canonical internal columns, not stale ibt references', () => {
    const registryCoverage = analyzeRegistryCoverage([
      {
        ...buildMapping('vat_amount'),
        targetField: {
          ...buildMapping('vat_amount').targetField,
          id: 'line_vat_amount',
          ibtReference: 'IBT-117',
        },
      },
      buildMapping('goods_service_type'),
    ]);

    const mappedDrIds = new Set([
      ...registryCoverage.mappedMandatory.map((field) => field.dr_id),
      ...registryCoverage.mappedConditional.map((field) => field.dr_id),
    ]);

    expect(mappedDrIds.has('BTUAE-08')).toBe(true);
  });
});
