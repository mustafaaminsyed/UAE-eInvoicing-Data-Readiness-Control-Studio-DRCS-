import { describe, expect, it } from 'vitest';
import {
  getMoFBaselineFieldCount,
  getMoFDerivedRules,
  getMoFDocumentTypes,
  getMoFFieldById,
  getMoFFields,
  getMoFMandatoryFields,
  getMoFSpecRegistry,
} from '@/lib/registry/mofSpecRegistry';

describe('mofSpecRegistry', () => {
  it('loads MoF source-truth schema metadata', () => {
    const registry = getMoFSpecRegistry();
    expect(registry.meta.schema_name).toBe('UAE_eInvoice_MoF_Source_Schema_v1');
    expect(registry.meta.schema_version).toBe('1.0.0');
  });

  it('exposes tax/commercial document types and baseline counts', () => {
    expect(getMoFDocumentTypes()).toEqual(['tax_invoice', 'commercial_xml']);
    expect(getMoFBaselineFieldCount('tax_invoice')).toBe(51);
    expect(getMoFBaselineFieldCount('commercial_xml')).toBe(49);
  });

  it('returns mandatory fields by document_type without mixing AR/AP direction', () => {
    const taxMandatory = getMoFMandatoryFields('tax_invoice');
    const commercialMandatory = getMoFMandatoryFields('commercial_xml');

    expect(taxMandatory).toHaveLength(51);
    expect(commercialMandatory).toHaveLength(49);
    expect(taxMandatory.every((f) => f.document_type === 'tax_invoice')).toBe(true);
    expect(commercialMandatory.every((f) => f.document_type === 'commercial_xml')).toBe(true);
  });

  it('keeps explicit tax/commercial tail divergence', () => {
    expect(getMoFFieldById('tax_invoice', 51)).toBeDefined();
    expect(getMoFFieldById('commercial_xml', 51)).toBeUndefined();
    expect(getMoFFieldById('commercial_xml', 49)).toBeDefined();
  });

  it('does not force predefined literals for commercial fields 7 and 8', () => {
    const field7 = getMoFFieldById('commercial_xml', 7);
    const field8 = getMoFFieldById('commercial_xml', 8);
    expect(field7?.source_status).toBe('source_literal_with_pending_literal_confirmation');
    expect(field8?.source_status).toBe('source_literal_with_pending_literal_confirmation');
  });

  it('returns source-derived rules only via derived helper', () => {
    const derivedTaxRules = getMoFDerivedRules('tax_invoice');
    const derivedCommercialRules = getMoFDerivedRules('commercial_xml');

    expect(Array.isArray(derivedTaxRules)).toBe(true);
    expect(Array.isArray(derivedCommercialRules)).toBe(true);
    expect(
      derivedTaxRules.every((entry) => entry.rules.every((rule) => rule.rule_class === 'source_derived'))
    ).toBe(true);
    expect(
      derivedCommercialRules.every((entry) => entry.rules.every((rule) => rule.rule_class === 'source_derived'))
    ).toBe(true);
  });

  it('returns sorted fields per document_type', () => {
    const taxFields = getMoFFields('tax_invoice');
    expect(taxFields[0].field_id).toBe(1);
    expect(taxFields[taxFields.length - 1].field_id).toBe(51);
  });
});

