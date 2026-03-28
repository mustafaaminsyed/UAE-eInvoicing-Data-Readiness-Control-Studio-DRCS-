import { describe, expect, it } from 'vitest';

import {
  getBuyerSemanticAliasByMoFFieldNumber,
  interpretBuyerSemanticAlias,
} from '@/lib/registry/semanticCrosswalkBuyerAlias';
import { getSemanticCrosswalkRowByMoFFieldNumber } from '@/lib/registry/semanticCrosswalk';

describe('semanticCrosswalkBuyerAlias', () => {
  it('resolves field 24 semantics by document type without claiming runtime split support', () => {
    expect(getBuyerSemanticAliasByMoFFieldNumber(24, 'tax_invoice')).toEqual({
      crosswalkRowKey: 'CW-024',
      documentType: 'tax_invoice',
      effectiveSemanticId: 'IBT-048',
      effectiveCanonicalField: 'buyer_tax_identifier',
      currentRuntimeFallbackFields: ['buyer_trn', 'buyer_legal_reg_id'],
      runtimeSemanticSplitSupported: false,
    });

    expect(getBuyerSemanticAliasByMoFFieldNumber(24, 'commercial_xml')).toEqual({
      crosswalkRowKey: 'CW-024',
      documentType: 'commercial_xml',
      effectiveSemanticId: 'IBT-047',
      effectiveCanonicalField: 'buyer_legal_reg_id',
      currentRuntimeFallbackFields: ['buyer_trn', 'buyer_legal_reg_id'],
      runtimeSemanticSplitSupported: false,
    });
  });

  it('resolves field 25 semantics by document type without changing runtime fallback behavior', () => {
    expect(getBuyerSemanticAliasByMoFFieldNumber(25, 'tax_invoice')).toEqual({
      crosswalkRowKey: 'CW-025',
      documentType: 'tax_invoice',
      effectiveSemanticId: 'IBT-048-1',
      effectiveCanonicalField: 'buyer_tax_scheme_code',
      currentRuntimeFallbackFields: ['buyer_legal_reg_id_type', 'buyer_reg_id_type'],
      runtimeSemanticSplitSupported: false,
    });

    expect(getBuyerSemanticAliasByMoFFieldNumber(25, 'commercial_xml')).toEqual({
      crosswalkRowKey: 'CW-025',
      documentType: 'commercial_xml',
      effectiveSemanticId: 'BTAE-16',
      effectiveCanonicalField: 'buyer_legal_reg_id_type',
      currentRuntimeFallbackFields: ['buyer_legal_reg_id_type', 'buyer_reg_id_type'],
      runtimeSemanticSplitSupported: false,
    });
  });

  it('can interpret the existing crosswalk rows directly for read-only consumers', () => {
    const row = getSemanticCrosswalkRowByMoFFieldNumber(24);
    expect(row).toBeDefined();

    const interpretation = interpretBuyerSemanticAlias(row!, 'commercial_xml');
    expect(interpretation.effectiveSemanticId).toBe('IBT-047');
    expect(interpretation.runtimeSemanticSplitSupported).toBe(false);
  });
});
