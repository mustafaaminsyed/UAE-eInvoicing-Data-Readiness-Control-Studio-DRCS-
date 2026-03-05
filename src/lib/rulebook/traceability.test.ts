import { describe, expect, it } from 'vitest';
import { buildMofRuleTraceability } from '@/lib/rulebook/traceability';
import type { MofRulebook } from '@/lib/rulebook/types';

describe('buildMofRuleTraceability', () => {
  it('maps MoF field numbers to DR IDs from crosswalk', () => {
    const rulebook: MofRulebook = {
      spec: {
        jurisdiction: 'UAE',
        source_document: { title: 'x', version: '1', date: '2026-01-01' },
      },
      field_dictionary: { fields: [] },
      validation_rules: [
        {
          rule_id: 'RULE-1',
          invoice_type: 'tax_invoice',
          severity: 'error',
          type: 'presence',
          required_field_numbers: [1, 2],
          exception_code: 'EINV_MISSING_MANDATORY_FIELD',
        },
      ],
      exception_explanations: [],
    };

    const trace = buildMofRuleTraceability(rulebook);
    expect(trace).toHaveLength(1);
    expect(trace[0].rule_id).toBe('RULE-1');
    expect(trace[0].exception_code).toBe('EINV_MISSING_MANDATORY_FIELD');
    expect(trace[0].affected_dr_ids).toEqual(expect.arrayContaining(['IBT-001', 'IBT-002']));
  });
});

