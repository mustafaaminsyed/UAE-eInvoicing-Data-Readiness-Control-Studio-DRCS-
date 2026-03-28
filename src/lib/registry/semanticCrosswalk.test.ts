import { describe, expect, it } from 'vitest';

import {
  getSemanticCrosswalkRowByCanonicalField,
  getSemanticCrosswalkRowByDrId,
  getSemanticCrosswalkRowByMoFFieldNumber,
  getSemanticCrosswalkRows,
} from '@/lib/registry/semanticCrosswalk';

describe('semanticCrosswalk', () => {
  it('covers only the first 29 MoF fields in v1', () => {
    const rows = getSemanticCrosswalkRows();

    expect(rows).toHaveLength(29);
    expect(rows[0]?.mofFieldNumber).toBe(1);
    expect(rows[28]?.mofFieldNumber).toBe(29);
  });

  it('models BTUAE-02 as conditional and indirectly traceable', () => {
    const row = getSemanticCrosswalkRowByMoFFieldNumber(5);

    expect(row?.semanticId).toBe('BTUAE-02');
    expect(row?.dcsCanonicalField).toBe('transaction_type_code');
    expect(row?.mappingType).toBe('CONDITIONAL');
    expect(row?.targetStateTraceability).toBe('INDIRECT_RULE');
    expect(row?.currentStateTraceability).toBe('INDIRECT_RULE');
  });

  it('keeps BTUAE-15 seller-side and preserves buyer divergence for fields 24 and 25', () => {
    const sellerTypeRow = getSemanticCrosswalkRowByDrId('BTUAE-15');
    const buyerIdentifierRow = getSemanticCrosswalkRowByMoFFieldNumber(24);
    const buyerSchemeRow = getSemanticCrosswalkRowByCanonicalField('buyer_identifier_scheme_or_type');

    expect(sellerTypeRow?.mofFieldNumber).toBe(14);
    expect(sellerTypeRow?.dcsCanonicalField).toBe('seller_legal_reg_id_type');
    expect(sellerTypeRow?.currentStateTraceability).toBe('DIRECT_RULE');
    expect(sellerTypeRow?.runtimeAlignmentStatus).toBe('ALIGNED');

    expect(buyerIdentifierRow?.documentApplicability).toBe('divergent');
    expect(buyerIdentifierRow?.semanticIdByDocumentType).toEqual({
      tax_invoice: 'IBT-048',
      commercial_xml: 'IBT-047',
    });
    expect(buyerIdentifierRow?.currentStateTraceability).toBe('MAPPING_INCONSISTENT');
    expect(buyerIdentifierRow?.runtimeAlignmentStatus).toBe('NOT_ALIGNED');

    expect(buyerSchemeRow?.semanticIdByDocumentType).toEqual({
      tax_invoice: 'IBT-048-1',
      commercial_xml: 'BTAE-16',
    });
    expect(buyerSchemeRow?.runtimeAlignmentStatus).toBe('NOT_ALIGNED');
  });

  it('makes current runtime drift explicit for missing-rule and reference-style rows', () => {
    const sellerRegIdRow = getSemanticCrosswalkRowByMoFFieldNumber(13);
    const buyerCityRow = getSemanticCrosswalkRowByMoFFieldNumber(27);
    const buyerSubdivisionRow = getSemanticCrosswalkRowByMoFFieldNumber(28);
    const sellerEndpointSchemeRow = getSemanticCrosswalkRowByMoFFieldNumber(12);
    const buyerEndpointSchemeRow = getSemanticCrosswalkRowByMoFFieldNumber(23);

    expect(sellerRegIdRow?.currentStateTraceability).toBe('DIRECT_RULE');
    expect(sellerRegIdRow?.runtimeAlignmentStatus).toBe('ALIGNED');
    expect(buyerCityRow?.currentStateTraceability).toBe('DIRECT_RULE');
    expect(buyerCityRow?.runtimeAlignmentStatus).toBe('ALIGNED');
    expect(buyerSubdivisionRow?.currentStateTraceability).toBe('DIRECT_RULE');
    expect(buyerSubdivisionRow?.runtimeAlignmentStatus).toBe('ALIGNED');

    expect(sellerEndpointSchemeRow?.targetStateTraceability).toBe('SYSTEM_DEFAULT');
    expect(sellerEndpointSchemeRow?.currentStateTraceability).toBe('REFERENCE_ONLY');
    expect(sellerEndpointSchemeRow?.runtimeAlignmentStatus).toBe('PARTIALLY_ALIGNED');

    expect(buyerEndpointSchemeRow?.currentStateTraceability).toBe('REFERENCE_ONLY');
    expect(buyerEndpointSchemeRow?.runtimeAlignmentStatus).toBe('PARTIALLY_ALIGNED');
  });
});
