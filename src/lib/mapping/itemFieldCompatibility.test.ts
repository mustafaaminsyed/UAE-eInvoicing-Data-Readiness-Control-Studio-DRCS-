import { describe, expect, it } from 'vitest';
import { assessItemFieldCompatibility } from '@/lib/mapping/itemFieldCompatibility';
import type { FieldMapping } from '@/types/fieldMapping';

function mapping(id: string, erpColumn: string, targetId: string, ibtReference: string): FieldMapping {
  return {
    id, erpColumn, erpColumnIndex: 0, confidence: 1, isConfirmed: true, transformations: [], sampleValues: [],
    targetField: {
      id: targetId, name: targetId, description: targetId, ibtReference,
      category: 'line', isMandatory: false, dataType: 'string',
    },
  };
}

describe('saved item-field mapping compatibility', () => {
  it('flags legacy reversed mappings without rewriting them', () => {
    const mappings = [mapping('legacy', 'item_name', 'description', 'IBT-153')];
    const before = structuredClone(mappings);
    const result = assessItemFieldCompatibility(mappings);
    expect(result).toMatchObject({ requiresLegacyCompatibility: true, affectedMappingIds: ['legacy'] });
    expect(mappings).toEqual(before);
  });

  it('accepts corrected independent mappings', () => {
    const result = assessItemFieldCompatibility([
      mapping('name', 'item_name', 'item_name', 'IBT-153'),
      mapping('description', 'description', 'description', 'IBT-154'),
    ]);
    expect(result).toEqual({ requiresLegacyCompatibility: false, affectedMappingIds: [], warning: undefined });
  });
});
