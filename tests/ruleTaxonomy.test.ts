import { describe, expect, it } from 'vitest';
import { UAE_UC1_CHECK_PACK } from '@/lib/checks/uaeUC1CheckPack';
import {
  ALLOWED_EXECUTION_LAYERS,
  ALLOWED_RULE_TYPES,
  assertPintAETaxonomy,
  getFailureClassForRule,
} from '@/lib/validation/pintAERuleMetadata';

describe('PINT-AE rule taxonomy enforcement', () => {
  it('classifies every curated rule with an allowed rule_type and execution_layer', () => {
    expect(() => assertPintAETaxonomy(UAE_UC1_CHECK_PACK)).not.toThrow();

    for (const check of UAE_UC1_CHECK_PACK) {
      expect(ALLOWED_RULE_TYPES).toContain(check.rule_type);
      expect(ALLOWED_EXECUTION_LAYERS).toContain(check.execution_layer);
    }
  });

  it('rejects rules with unsupported taxonomy values', () => {
    expect(() =>
      assertPintAETaxonomy([
        {
          check_id: 'BROKEN',
          rule_type: 'Presence' as any,
          execution_layer: 'schema',
        },
      ])
    ).toThrow(/invalid rule_type/i);
  });

  it('derives evidence failure classes from rule taxonomy', () => {
    expect(getFailureClassForRule('dynamic_codelist', 'codelist')).toBe('codelist_failure');
    expect(getFailureClassForRule('fixed_literal', 'national_rule')).toBe('fixed_rule_failure');
    expect(getFailureClassForRule('enumeration', 'national_rule')).toBe('enumeration_failure');
    expect(getFailureClassForRule('dependency_rule', 'dependency_rule')).toBe('dependency_failure');
    expect(getFailureClassForRule('structural_rule', 'semantic_rule')).toBe('semantic_failure');
    expect(getFailureClassForRule('structural_rule', 'schema')).toBe('structural_failure');
  });
});
