import { MofRulebook, RulebookValidationResult } from '@/lib/rulebook/types';

const SUPPORTED_RULE_TYPES = new Set([
  'presence',
  'equals',
  'regex',
  'conditional_format',
  'default_if_missing',
  'fx_consistency',
]);

function hasDuplicate(values: number[] | string[]): boolean {
  return new Set(values).size !== values.length;
}

export function validateMofRulebook(rulebook: MofRulebook): RulebookValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!rulebook?.spec?.jurisdiction) {
    errors.push('Missing spec.jurisdiction');
  }

  const fields = rulebook?.field_dictionary?.fields ?? [];
  const rules = rulebook?.validation_rules ?? [];
  const exceptions = rulebook?.exception_explanations ?? [];

  if (fields.length === 0) errors.push('field_dictionary.fields is empty');
  if (rules.length === 0) errors.push('validation_rules is empty');
  if (exceptions.length === 0) errors.push('exception_explanations is empty');

  const fieldNumbers = fields.map((f) => f.field_number);
  if (hasDuplicate(fieldNumbers)) errors.push('Duplicate field_number values in field_dictionary.fields');

  const ruleIds = rules.map((r) => r.rule_id);
  if (hasDuplicate(ruleIds)) errors.push('Duplicate rule_id values in validation_rules');

  const fieldNumberSet = new Set(fieldNumbers);
  const exceptionCodeSet = new Set(exceptions.map((e) => e.exception_code));

  for (const rule of rules) {
    if (!SUPPORTED_RULE_TYPES.has(rule.type)) {
      errors.push(`Unsupported rule type: ${rule.type} (${rule.rule_id})`);
    }

    if (!rule.exception_code) {
      errors.push(`Missing exception_code for rule ${rule.rule_id}`);
    } else if (!exceptionCodeSet.has(rule.exception_code)) {
      warnings.push(`Rule ${rule.rule_id} references unknown exception_code: ${rule.exception_code}`);
    }

    if (rule.type === 'presence') {
      if (!Array.isArray(rule.required_field_numbers) || rule.required_field_numbers.length === 0) {
        errors.push(`Presence rule ${rule.rule_id} missing required_field_numbers`);
      } else {
        const unknown = rule.required_field_numbers.filter((n) => !fieldNumberSet.has(n));
        if (unknown.length > 0) {
          errors.push(`Presence rule ${rule.rule_id} references unknown field_number(s): ${unknown.join(', ')}`);
        }
      }
    } else {
      if (typeof rule.field_number !== 'number') {
        errors.push(`Rule ${rule.rule_id} missing field_number`);
      } else if (!fieldNumberSet.has(rule.field_number)) {
        errors.push(`Rule ${rule.rule_id} references unknown field_number: ${rule.field_number}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
