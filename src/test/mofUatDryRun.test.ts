import { describe, expect, it } from 'vitest';
import { runRulebookShadowChecks } from '@/lib/rulebook/shadowRunner';
import type { AdaptedRulebookCheck, MofRulebook } from '@/lib/rulebook/types';
import type { DataContext } from '@/types/compliance';

function baseContext(): DataContext {
  const buyers = [
    {
      buyer_id: 'B-1',
      buyer_name: 'Buyer One LLC',
      buyer_legal_reg_id: 'BLID-001',
      buyer_legal_reg_id_type: 'TL',
    },
  ];
  const headers = [
    {
      invoice_id: 'INV-1',
      invoice_number: 'INV-1001',
      issue_date: '2026-03-06',
      seller_trn: '123456789012345',
      buyer_id: 'B-1',
      invoice_type: 'commercial_xml',
      currency: 'AED',
      fx_rate: 1,
    },
  ];
  const lines = [
    {
      line_id: 'L-1',
      invoice_id: 'INV-1',
      line_number: 1,
      description: 'Service line',
      quantity: 2,
      unit_price: 100,
      item_gross_price: 100,
      line_discount: 0,
      line_total_excl_vat: 200,
      vat_rate: 5,
      vat_amount: 10,
      line_vat_amount_aed: 10,
      line_amount_aed: 200,
    },
  ];

  return {
    buyers,
    headers,
    lines,
    buyerMap: new Map(buyers.map((b) => [b.buyer_id, b])),
    headerMap: new Map(headers.map((h) => [h.invoice_id, h])),
    linesByInvoice: new Map([['INV-1', lines]]),
  };
}

function rulebookWithRules(validation_rules: MofRulebook['validation_rules']): MofRulebook {
  return {
    spec: {
      jurisdiction: 'UAE',
      source_document: { title: 'UAT', version: '1', date: '2026-03-06' },
    },
    field_dictionary: { fields: [] },
    validation_rules,
    exception_explanations: [],
  };
}

function adapted(check: AdaptedRulebookCheck): AdaptedRulebookCheck[] {
  return [check];
}

describe('MoF UAT dry-run scenarios', () => {
  it('Scenario A baseline pass returns zero shadow exceptions', () => {
    const data = baseContext();
    const rb = rulebookWithRules([
      {
        rule_id: 'UAE_FIELD_25_BUYER_LEGAL_REG_ID_TYPE_CODELIST',
        invoice_type: ['tax_invoice', 'commercial_xml'],
        severity: 'error',
        type: 'regex',
        field_number: 25,
        pattern: '^(TL|EID|PAS|CD)$',
        exception_code: 'EINV_FIELD_VALUE_INVALID',
      },
      {
        rule_id: 'UAE_FIELD_49_AED_AMOUNT_CONSISTENCY',
        invoice_type: 'commercial_xml',
        severity: 'error',
        type: 'fx_consistency',
        field_number: 49,
        exception_code: 'EINV_FIELD_VALUE_INVALID',
      },
    ]);

    const checks: AdaptedRulebookCheck[] = [
      {
        id: 'UAE_FIELD_25_BUYER_LEGAL_REG_ID_TYPE_CODELIST',
        ruleType: 'regex',
        invoiceTypes: ['tax_invoice', 'commercial_xml'],
        severity: 'High',
        executable: true,
        fieldNumber: 25,
        internalField: 'buyer_legal_reg_id_type',
        exceptionCode: 'EINV_FIELD_VALUE_INVALID',
      },
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

    const result = runRulebookShadowChecks(data, rb, checks);
    expect(result.exceptions).toHaveLength(0);
  });

  it('Scenario B missing field 24 is detected', () => {
    const data = baseContext();
    data.buyers[0].buyer_legal_reg_id = '';

    const rb = rulebookWithRules([
      {
        rule_id: 'UAE_MOF_4_2_REQUIRED_FIELDS_PRESENT',
        invoice_type: 'commercial_xml',
        severity: 'error',
        type: 'presence',
        required_field_numbers: [24],
        exception_code: 'EINV_MISSING_MANDATORY_FIELD',
      },
    ]);

    const result = runRulebookShadowChecks(
      data,
      rb,
      adapted({
        id: 'UAE_MOF_4_2_REQUIRED_FIELDS_PRESENT',
        ruleType: 'presence',
        invoiceTypes: ['commercial_xml'],
        severity: 'High',
        executable: true,
        exceptionCode: 'EINV_MISSING_MANDATORY_FIELD',
      })
    );

    expect(result.exceptions.length).toBeGreaterThan(0);
    expect(result.exceptions[0].field).toBe('buyer_legal_reg_id');
  });

  it('Scenario C invalid field 25 codelist is detected', () => {
    const data = baseContext();
    data.buyers[0].buyer_legal_reg_id_type = 'ABC';

    const rb = rulebookWithRules([
      {
        rule_id: 'UAE_FIELD_25_BUYER_LEGAL_REG_ID_TYPE_CODELIST',
        invoice_type: ['tax_invoice', 'commercial_xml'],
        severity: 'error',
        type: 'regex',
        field_number: 25,
        pattern: '^(TL|EID|PAS|CD)$',
        exception_code: 'EINV_FIELD_VALUE_INVALID',
      },
    ]);

    const result = runRulebookShadowChecks(
      data,
      rb,
      adapted({
        id: 'UAE_FIELD_25_BUYER_LEGAL_REG_ID_TYPE_CODELIST',
        ruleType: 'regex',
        invoiceTypes: ['tax_invoice', 'commercial_xml'],
        severity: 'High',
        executable: true,
        fieldNumber: 25,
        internalField: 'buyer_legal_reg_id_type',
        exceptionCode: 'EINV_FIELD_VALUE_INVALID',
      })
    );

    expect(result.exceptions.length).toBe(1);
    expect(result.exceptions[0].ruleId).toBe('UAE_FIELD_25_BUYER_LEGAL_REG_ID_TYPE_CODELIST');
  });

  it('Scenario D field 49 AED mismatch is detected', () => {
    const data = baseContext();
    data.lines[0].line_amount_aed = 199;

    const rb = rulebookWithRules([
      {
        rule_id: 'UAE_FIELD_49_AED_AMOUNT_CONSISTENCY',
        invoice_type: 'commercial_xml',
        severity: 'error',
        type: 'fx_consistency',
        field_number: 49,
        exception_code: 'EINV_FIELD_VALUE_INVALID',
      },
    ]);

    const result = runRulebookShadowChecks(
      data,
      rb,
      adapted({
        id: 'UAE_FIELD_49_AED_AMOUNT_CONSISTENCY',
        ruleType: 'fx_consistency',
        invoiceTypes: ['commercial_xml'],
        severity: 'High',
        executable: true,
        fieldNumber: 49,
        internalField: 'line_amount_aed',
        exceptionCode: 'EINV_FIELD_VALUE_INVALID',
      })
    );

    expect(result.exceptions.length).toBe(1);
    expect(result.exceptions[0].ruleId).toBe('UAE_FIELD_49_AED_AMOUNT_CONSISTENCY');
  });

  it('Scenario E non-AED missing FX rate is detected', () => {
    const data = baseContext();
    data.headers[0].currency = 'USD';
    data.headers[0].fx_rate = undefined;
    data.lines[0].line_amount_aed = 200;

    const rb = rulebookWithRules([
      {
        rule_id: 'UAE_FIELD_49_AED_AMOUNT_CONSISTENCY',
        invoice_type: 'commercial_xml',
        severity: 'error',
        type: 'fx_consistency',
        field_number: 49,
        exception_code: 'EINV_FIELD_VALUE_INVALID',
      },
    ]);

    const result = runRulebookShadowChecks(
      data,
      rb,
      adapted({
        id: 'UAE_FIELD_49_AED_AMOUNT_CONSISTENCY',
        ruleType: 'fx_consistency',
        invoiceTypes: ['commercial_xml'],
        severity: 'High',
        executable: true,
        fieldNumber: 49,
        internalField: 'line_amount_aed',
        exceptionCode: 'EINV_FIELD_VALUE_INVALID',
      })
    );

    expect(result.exceptions.length).toBe(1);
    expect(result.exceptions[0].message).toContain('missing/invalid fx_rate');
  });

  it('Field 44 and 48 checks detect mismatches', () => {
    const data = baseContext();
    data.lines[0].item_gross_price = 120;
    data.lines[0].line_vat_amount_aed = 15;

    const rb = rulebookWithRules([
      {
        rule_id: 'UAE_FIELD_44_ITEM_GROSS_PRICE_CONSISTENCY',
        invoice_type: 'commercial_xml',
        severity: 'error',
        type: 'gross_price_consistency',
        field_number: 44,
        exception_code: 'EINV_FIELD_VALUE_INVALID',
      },
      {
        rule_id: 'UAE_FIELD_48_VAT_AMOUNT_AED_CONSISTENCY',
        invoice_type: 'commercial_xml',
        severity: 'error',
        type: 'fx_consistency',
        field_number: 48,
        exception_code: 'EINV_FIELD_VALUE_INVALID',
      },
    ]);

    const checks: AdaptedRulebookCheck[] = [
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

    const result = runRulebookShadowChecks(data, rb, checks);
    expect(result.exceptions.length).toBe(2);
  });
});

