import { describe, expect, it } from 'vitest';
import { runRulebookShadowChecks } from '@/lib/rulebook/shadowRunner';
import type { DataContext } from '@/types/compliance';
import type { MofRulebook, AdaptedRulebookCheck } from '@/lib/rulebook/types';

function baseData(): DataContext {
  const buyers = [
    {
      buyer_id: 'B-1',
      buyer_name: 'Buyer 1',
      buyer_country: 'AE',
      buyer_electronic_address: '0235:1234567890',
    },
  ];
  const headers = [
    {
      invoice_id: 'INV-1',
      invoice_number: 'INV-100',
      issue_date: '2026-03-06',
      seller_trn: '123456789012345',
      buyer_id: 'B-1',
      currency: 'AED',
      seller_electronic_address: '123',
    },
  ];
  const lines = [
    {
      line_id: 'L-1',
      invoice_id: 'INV-1',
      line_number: 1,
      quantity: 1,
      unit_price: 10,
      item_gross_price: 10,
      line_discount: 0,
      line_total_excl_vat: 10,
      line_amount_aed: 10,
      vat_rate: 5,
      vat_amount: 0.5,
      line_vat_amount_aed: 0.5,
      unit_of_measure: 'EA',
    },
  ];
  const buyerMap = new Map(buyers.map((b) => [b.buyer_id, b]));
  const headerMap = new Map(headers.map((h) => [h.invoice_id, h]));
  const linesByInvoice = new Map<string, typeof lines>();
  linesByInvoice.set('INV-1', lines);
  return { buyers, headers, lines, buyerMap, headerMap, linesByInvoice };
}

describe('runRulebookShadowChecks', () => {
  it('flags missing mandatory mapped fields for presence rule', () => {
    const data = baseData();
    data.headers[0].invoice_number = '';

    const rulebook: MofRulebook = {
      spec: { jurisdiction: 'UAE', source_document: { title: 'x', version: '1', date: '2026-01-01' } },
      field_dictionary: { fields: [{ field_number: 1, name: 'Invoice number', section: '4.1', cardinality: '1..1', applies_to: ['tax_invoice'] }] },
      validation_rules: [
        {
          rule_id: 'PRESENCE_1',
          invoice_type: 'tax_invoice',
          severity: 'error',
          type: 'presence',
          required_field_numbers: [1],
          exception_code: 'EINV_MISSING_MANDATORY_FIELD',
        },
      ],
      exception_explanations: [],
    };

    const adapted: AdaptedRulebookCheck[] = [
      {
        id: 'PRESENCE_1',
        ruleType: 'presence',
        invoiceTypes: ['tax_invoice'],
        severity: 'High',
        executable: true,
        exceptionCode: 'EINV_MISSING_MANDATORY_FIELD',
      },
    ];

    const result = runRulebookShadowChecks(data, rulebook, adapted);
    expect(result.exceptions.length).toBeGreaterThan(0);
    expect(result.executedRules).toBe(1);
  });

  it('evaluates regex rules against mapped internal field', () => {
    const data = baseData();
    const rulebook: MofRulebook = {
      spec: { jurisdiction: 'UAE', source_document: { title: 'x', version: '1', date: '2026-01-01' } },
      field_dictionary: { fields: [{ field_number: 11, name: 'Seller electronic address', section: '4.1', cardinality: '1..1', applies_to: ['tax_invoice'] }] },
      validation_rules: [
        {
          rule_id: 'REGEX_11',
          invoice_type: 'tax_invoice',
          severity: 'error',
          type: 'regex',
          field_number: 11,
          pattern: '^[0-9]{10}$',
          exception_code: 'EINV_FIELD_FORMAT_INVALID',
        },
      ],
      exception_explanations: [],
    };
    const adapted: AdaptedRulebookCheck[] = [
      {
        id: 'REGEX_11',
        ruleType: 'regex',
        invoiceTypes: ['tax_invoice'],
        severity: 'High',
        executable: true,
        fieldNumber: 11,
        internalField: 'seller_electronic_address',
        exceptionCode: 'EINV_FIELD_FORMAT_INVALID',
      },
    ];

    const result = runRulebookShadowChecks(data, rulebook, adapted);
    expect(result.exceptions.length).toBe(1);
    expect(result.exceptions[0].ruleId).toBe('REGEX_11');
    expect(result.exceptions[0].exceptionCode).toBe('EINV_FIELD_FORMAT_INVALID');
  });

  it('flags AED amount mismatch for fx_consistency rule', () => {
    const data = baseData();
    data.headers[0].invoice_type = 'commercial_xml';
    (data.lines[0] as any).line_amount_aed = 999;

    const rulebook: MofRulebook = {
      spec: { jurisdiction: 'UAE', source_document: { title: 'x', version: '1', date: '2026-01-01' } },
      field_dictionary: { fields: [{ field_number: 49, name: 'Invoice line amount in AED', section: '4.2', cardinality: '1..1', applies_to: ['commercial_xml'] }] },
      validation_rules: [
        {
          rule_id: 'UAE_FIELD_49_AED_AMOUNT_CONSISTENCY',
          invoice_type: 'commercial_xml',
          severity: 'error',
          type: 'fx_consistency',
          field_number: 49,
          exception_code: 'EINV_FIELD_VALUE_INVALID',
        },
      ],
      exception_explanations: [],
    };

    const adapted: AdaptedRulebookCheck[] = [
      {
        id: 'UAE_FIELD_49_AED_AMOUNT_CONSISTENCY',
        ruleType: 'fx_consistency',
        invoiceTypes: ['commercial_xml'],
        severity: 'High',
        executable: true,
        fieldNumber: 49,
        internalField: 'line_amount_aed',
        exceptionCode: 'EINV_FIELD_VALUE_INVALID',
      },
    ];

    const result = runRulebookShadowChecks(data, rulebook, adapted);
    expect(result.exceptions.length).toBe(1);
    expect(result.exceptions[0].ruleId).toBe('UAE_FIELD_49_AED_AMOUNT_CONSISTENCY');
    expect(result.exceptions[0].exceptionCode).toBe('EINV_FIELD_VALUE_INVALID');
  });

  it('flags VAT AED mismatch for field 48 fx_consistency rule', () => {
    const data = baseData();
    data.headers[0].invoice_type = 'commercial_xml';
    (data.lines[0] as any).line_vat_amount_aed = 9;

    const rulebook: MofRulebook = {
      spec: { jurisdiction: 'UAE', source_document: { title: 'x', version: '1', date: '2026-01-01' } },
      field_dictionary: { fields: [{ field_number: 48, name: 'VAT line amount in AED', section: '4.2', cardinality: '1..1', applies_to: ['commercial_xml'] }] },
      validation_rules: [
        {
          rule_id: 'UAE_FIELD_48_VAT_AMOUNT_AED_CONSISTENCY',
          invoice_type: 'commercial_xml',
          severity: 'error',
          type: 'fx_consistency',
          field_number: 48,
          exception_code: 'EINV_FIELD_VALUE_INVALID',
        },
      ],
      exception_explanations: [],
    };

    const adapted: AdaptedRulebookCheck[] = [
      {
        id: 'UAE_FIELD_48_VAT_AMOUNT_AED_CONSISTENCY',
        ruleType: 'fx_consistency',
        invoiceTypes: ['commercial_xml'],
        severity: 'High',
        executable: true,
        fieldNumber: 48,
        internalField: 'line_vat_amount_aed',
        exceptionCode: 'EINV_FIELD_VALUE_INVALID',
      },
    ];

    const result = runRulebookShadowChecks(data, rulebook, adapted);
    expect(result.exceptions.length).toBe(1);
    expect(result.exceptions[0].ruleId).toBe('UAE_FIELD_48_VAT_AMOUNT_AED_CONSISTENCY');
  });

  it('flags gross price mismatch for field 44 consistency rule', () => {
    const data = baseData();
    data.headers[0].invoice_type = 'commercial_xml';
    (data.lines[0] as any).item_gross_price = 12;
    (data.lines[0] as any).unit_price = 10;
    (data.lines[0] as any).line_discount = 0;
    (data.lines[0] as any).quantity = 1;

    const rulebook: MofRulebook = {
      spec: { jurisdiction: 'UAE', source_document: { title: 'x', version: '1', date: '2026-01-01' } },
      field_dictionary: { fields: [{ field_number: 44, name: 'Item gross price', section: '4.2', cardinality: '1..1', applies_to: ['commercial_xml'] }] },
      validation_rules: [
        {
          rule_id: 'UAE_FIELD_44_ITEM_GROSS_PRICE_CONSISTENCY',
          invoice_type: 'commercial_xml',
          severity: 'error',
          type: 'gross_price_consistency',
          field_number: 44,
          exception_code: 'EINV_FIELD_VALUE_INVALID',
        },
      ],
      exception_explanations: [],
    };

    const adapted: AdaptedRulebookCheck[] = [
      {
        id: 'UAE_FIELD_44_ITEM_GROSS_PRICE_CONSISTENCY',
        ruleType: 'gross_price_consistency',
        invoiceTypes: ['commercial_xml'],
        severity: 'High',
        executable: true,
        fieldNumber: 44,
        internalField: 'item_gross_price',
        exceptionCode: 'EINV_FIELD_VALUE_INVALID',
      },
    ];

    const result = runRulebookShadowChecks(data, rulebook, adapted);
    expect(result.exceptions.length).toBe(1);
    expect(result.exceptions[0].ruleId).toBe('UAE_FIELD_44_ITEM_GROSS_PRICE_CONSISTENCY');
  });
});
