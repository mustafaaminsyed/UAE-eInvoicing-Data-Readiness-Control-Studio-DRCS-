import { describe, expect, it } from 'vitest';
import { adaptMofRulebook } from '@/lib/rulebook/adapter';
import type { MofRulebook } from '@/lib/rulebook/types';

describe('adaptMofRulebook', () => {
  it('marks unmapped field numbers as non-executable', () => {
    const rulebook: MofRulebook = {
      spec: {
        jurisdiction: 'UAE',
        source_document: { title: 'x', version: '1', date: '2026-01-01' },
      },
      field_dictionary: {
        fields: [{ field_number: 999, name: 'Unknown', section: 'x', cardinality: '1..1', applies_to: ['tax_invoice'] }],
      },
      validation_rules: [
        {
          rule_id: 'RULE_UNKNOWN',
          invoice_type: 'tax_invoice',
          severity: 'error',
          type: 'regex',
          field_number: 999,
          pattern: '^x$',
          exception_code: 'EINV_FIELD_FORMAT_INVALID',
        },
      ],
      exception_explanations: [
        {
          exception_code: 'EINV_FIELD_FORMAT_INVALID',
          severity: 'error',
          message: 'x',
          explanation_template: 'x',
          suggested_fix: 'x',
        },
      ],
    };

    const adapted = adaptMofRulebook(rulebook);
    expect(adapted.checks).toHaveLength(1);
    expect(adapted.checks[0].executable).toBe(false);
    expect(adapted.nonExecutableCount).toBe(1);
  });

  it('maps field 25 to buyer_legal_reg_id_type as executable', () => {
    const rulebook: MofRulebook = {
      spec: {
        jurisdiction: 'UAE',
        source_document: { title: 'x', version: '1', date: '2026-01-01' },
      },
      field_dictionary: {
        fields: [{ field_number: 25, name: 'Buyer legal registration identifier type', section: '4.1', cardinality: '1..1', applies_to: ['tax_invoice'] }],
      },
      validation_rules: [
        {
          rule_id: 'RULE_25',
          invoice_type: 'tax_invoice',
          severity: 'error',
          type: 'regex',
          field_number: 25,
          pattern: '^(TL|EID|PAS|CD)$',
          exception_code: 'EINV_FIELD_VALUE_INVALID',
        },
      ],
      exception_explanations: [
        {
          exception_code: 'EINV_FIELD_VALUE_INVALID',
          severity: 'error',
          message: 'x',
          explanation_template: 'x',
          suggested_fix: 'x',
        },
      ],
    };

    const adapted = adaptMofRulebook(rulebook);
    expect(adapted.checks[0].executable).toBe(true);
    expect(adapted.checks[0].internalField).toBe('buyer_legal_reg_id_type');
  });
});
