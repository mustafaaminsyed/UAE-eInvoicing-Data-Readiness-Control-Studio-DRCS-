import { describe, expect, it } from 'vitest';
import { validateCustomCheckConfig } from '@/lib/checks/customCheckConfigValidation';
import type { CustomCheckConfig } from '@/types/customChecks';

const baseValidationCheck: CustomCheckConfig = {
  id: 'check-1',
  name: 'Currency present',
  description: 'Checks header currency.',
  severity: 'High',
  check_type: 'VALIDATION',
  dataset_scope: 'header',
  rule_type: 'missing',
  parameters: { field: 'currency' },
  message_template: 'Currency missing for {invoice_number}',
  is_active: true,
};

describe('validateCustomCheckConfig', () => {
  it('accepts a complete missing-field validation check', () => {
    expect(
      validateCustomCheckConfig(baseValidationCheck, {
        allowedFields: ['invoice_number', 'currency'],
      })
    ).toEqual([]);
  });

  it('rejects missing-field checks without a valid target field', () => {
    const errors = validateCustomCheckConfig(
      {
        ...baseValidationCheck,
        parameters: { field: '' },
      },
      {
        allowedFields: ['invoice_number', 'currency'],
      }
    );

    expect(errors).toContain('Missing-field checks require a valid target field.');
  });

  it('rejects duplicate checks without key fields', () => {
    const errors = validateCustomCheckConfig({
      ...baseValidationCheck,
      rule_type: 'duplicate',
      parameters: { fields: [] },
    });

    expect(errors).toContain('Duplicate checks require at least one key field.');
  });

  it('rejects invalid regex patterns', () => {
    const errors = validateCustomCheckConfig(
      {
        ...baseValidationCheck,
        rule_type: 'regex',
        parameters: { field: 'currency', pattern: '[' },
      },
      {
        allowedFields: ['currency'],
      }
    );

    expect(errors).toContain('Regex pattern is invalid.');
  });

  it('rejects math checks with negative tolerance', () => {
    const errors = validateCustomCheckConfig({
      ...baseValidationCheck,
      rule_type: 'math',
      parameters: {
        left_expression: '{total_incl_vat}',
        operator: '=',
        right_expression: '{total_excl_vat} + {vat_total}',
        tolerance: -0.01,
      },
    });

    expect(errors).toContain('Math check tolerance must be zero or greater.');
  });

  it('rejects search checks with thresholds outside supported bounds', () => {
    const errors = validateCustomCheckConfig({
      ...baseValidationCheck,
      check_type: 'SEARCH_CHECK',
      rule_type: 'fuzzy_duplicate',
      parameters: {
        vendor_similarity_threshold: 0.2,
        amount_tolerance: -1,
        date_window_days: 31,
      },
    });

    expect(errors).toContain('Vendor similarity threshold must be between 0.5 and 1.0.');
    expect(errors).toContain('Amount tolerance must be zero or greater.');
    expect(errors).toContain('Date window must be a whole number between 1 and 30 days.');
  });
});
