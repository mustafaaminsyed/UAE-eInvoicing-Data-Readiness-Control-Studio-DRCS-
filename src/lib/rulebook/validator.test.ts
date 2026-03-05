import { describe, expect, it } from 'vitest';
import { validateMofRulebook } from '@/lib/rulebook/validator';
import type { MofRulebook } from '@/lib/rulebook/types';

function buildValidRulebook(): MofRulebook {
  return {
    spec: {
      jurisdiction: 'UAE',
      source_document: { title: 'test', version: '1', date: '2026-01-01' },
    },
    field_dictionary: {
      fields: [
        { field_number: 1, name: 'Invoice number', section: '4.1', cardinality: '1..1', applies_to: ['tax_invoice'] },
        { field_number: 11, name: 'Seller electronic address', section: '4.1', cardinality: '1..1', applies_to: ['tax_invoice'] },
      ],
    },
    validation_rules: [
      {
        rule_id: 'RULE_1',
        invoice_type: 'tax_invoice',
        severity: 'error',
        type: 'presence',
        required_field_numbers: [1, 11],
        exception_code: 'EINV_MISSING_MANDATORY_FIELD',
      },
      {
        rule_id: 'RULE_2',
        invoice_type: 'tax_invoice',
        severity: 'error',
        type: 'regex',
        field_number: 11,
        pattern: '^[0-9]{10}$',
        exception_code: 'EINV_FIELD_FORMAT_INVALID',
      },
    ],
    exception_explanations: [
      {
        exception_code: 'EINV_MISSING_MANDATORY_FIELD',
        severity: 'error',
        message: 'x',
        explanation_template: 'x',
        suggested_fix: 'x',
      },
      {
        exception_code: 'EINV_FIELD_FORMAT_INVALID',
        severity: 'error',
        message: 'x',
        explanation_template: 'x',
        suggested_fix: 'x',
      },
    ],
  };
}

describe('validateMofRulebook', () => {
  it('accepts valid payload', () => {
    const result = validateMofRulebook(buildValidRulebook());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects duplicate field numbers and missing references', () => {
    const bad = buildValidRulebook();
    bad.field_dictionary.fields.push({
      field_number: 11,
      name: 'Duplicate',
      section: '4.1',
      cardinality: '1..1',
      applies_to: ['tax_invoice'],
    });
    bad.validation_rules[1].field_number = 999;

    const result = validateMofRulebook(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Duplicate field_number'))).toBe(true);
    expect(result.errors.some((e) => e.includes('unknown field_number'))).toBe(true);
  });
});
