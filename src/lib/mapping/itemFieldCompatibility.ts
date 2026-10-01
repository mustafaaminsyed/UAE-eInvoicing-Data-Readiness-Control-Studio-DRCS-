import type { FieldMapping } from '@/types/fieldMapping';

export interface ItemFieldCompatibilityAssessment {
  requiresLegacyCompatibility: boolean;
  affectedMappingIds: string[];
  warning?: string;
}

/**
 * Detects saved mappings created under the former reversed/cross-filled item semantics.
 * Detection never rewrites the customer's mapping; callers must explicitly opt into
 * the legacy execution adapter while the mapping is reviewed.
 */
export function assessItemFieldCompatibility(mappings: FieldMapping[]): ItemFieldCompatibilityAssessment {
  const affected = mappings.filter((mapping) => {
    const source = mapping.erpColumn.trim().toLowerCase();
    const target = mapping.targetField.id;
    return (
      (target === 'description' && /(^|_)(item_name|product_name)($|_)/.test(source)) ||
      (target === 'item_name' && /(^|_)(description|item_description|line_desc)($|_)/.test(source)) ||
      (target === 'description' && mapping.targetField.ibtReference === 'IBT-153') ||
      (target === 'item_name' && mapping.targetField.ibtReference === 'IBT-154')
    );
  });

  return {
    requiresLegacyCompatibility: affected.length > 0,
    affectedMappingIds: affected.map((mapping) => mapping.id),
    warning: affected.length > 0
      ? 'This saved mapping appears to use legacy item-name/item-description semantics. It has not been rewritten. Review it before disabling the explicit legacy compatibility adapter.'
      : undefined,
  };
}
