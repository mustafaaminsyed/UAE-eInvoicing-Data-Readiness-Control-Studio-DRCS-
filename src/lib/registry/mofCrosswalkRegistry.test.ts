import { describe, expect, it } from 'vitest';
import {
  getMoFCrosswalkDenominatorPolicy,
  getMoFCrosswalkRow,
  getMoFCrosswalkRows,
  getMoFCrosswalkRowsForFieldId,
} from '@/lib/registry/mofCrosswalkRegistry';

describe('mofCrosswalkRegistry', () => {
  it('has unique tuple keys by (document_type, mof_field_id)', () => {
    const rows = getMoFCrosswalkRows();
    const keySet = new Set(rows.map((row) => row.key));

    expect(keySet.size).toBe(rows.length);
  });

  it('keeps document-type field counts explicit', () => {
    const taxRows = getMoFCrosswalkRows('tax_invoice');
    const commercialRows = getMoFCrosswalkRows('commercial_xml');

    expect(taxRows).toHaveLength(51);
    expect(commercialRows).toHaveLength(49);
  });

  it('keeps collision IDs semantically distinct by document type', () => {
    for (const fieldId of [24, 25, 48, 49]) {
      const pair = getMoFCrosswalkRowsForFieldId(fieldId);
      expect(pair.tax_invoice).toBeDefined();
      expect(pair.commercial_xml).toBeDefined();
      expect(pair.tax_invoice?.mofBusinessTerm).not.toBe(pair.commercial_xml?.mofBusinessTerm);
    }
  });

  it('exposes explicit denominator policy without collapsing layers', () => {
    const policy = getMoFCrosswalkDenominatorPolicy();

    expect(policy.mofTaxMandatoryFields).toBe(51);
    expect(policy.mofCommercialMandatoryFields).toBe(49);
    expect(policy.pintRegistryFields).toBe(50);
    expect(policy.ingestionSourceColumns).toBe(45);
  });

  it('resolves targeted rows used by priority-gap fixes', () => {
    const commercial49 = getMoFCrosswalkRow('commercial_xml', 49);
    const tax50 = getMoFCrosswalkRow('tax_invoice', 50);
    const tax51 = getMoFCrosswalkRow('tax_invoice', 51);

    expect(commercial49?.sourceColumns).toContain('description');
    expect(commercial49?.mofBusinessTerm).toBe('Item description');
    expect(tax50?.mofBusinessTerm).toBe('Item name');
    expect(tax51?.mofBusinessTerm).toBe('Item description');
    expect(tax50?.sourceColumns[0]).toBe('item_name');
    expect(tax51?.sourceColumns[0]).toBe('description');
  });
});

