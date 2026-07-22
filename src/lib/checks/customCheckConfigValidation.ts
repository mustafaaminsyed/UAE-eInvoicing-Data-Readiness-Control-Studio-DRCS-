import type { CustomCheckConfig } from '@/types/customChecks';

const SEARCH_RULE_TYPES = new Set([
  'fuzzy_duplicate',
  'invoice_number_variant',
  'trn_format_similarity',
]);

const VALIDATION_RULE_TYPES = new Set([
  'missing',
  'duplicate',
  'math',
  'regex',
  'custom_formula',
]);

const MATH_OPERATORS = new Set(['=', '!=', '>', '<', '>=', '<=']);

type ValidationOptions = {
  allowedFields?: string[];
};

function isBlank(value: unknown): boolean {
  return typeof value !== 'string' || value.trim().length === 0;
}

function isNonNegativeNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isIntegerInRange(value: unknown, min: number, max: number): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function isDecimalInRange(value: unknown, min: number, max: number): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function isAllowedField(field: string | undefined, allowedFields?: string[]): boolean {
  if (!field || !allowedFields || allowedFields.length === 0) return Boolean(field?.trim());
  return allowedFields.includes(field);
}

export function validateCustomCheckConfig(
  check: Omit<CustomCheckConfig, 'id'> | CustomCheckConfig,
  options: ValidationOptions = {}
): string[] {
  const errors: string[] = [];
  const checkType = check.check_type || 'VALIDATION';
  const { allowedFields } = options;

  if (isBlank(check.name)) {
    errors.push('Check name is required.');
  }

  if (isBlank(check.message_template)) {
    errors.push('Message template is required.');
  }

  if (isBlank(check.dataset_scope)) {
    errors.push('Dataset scope is required.');
  }

  if (checkType === 'SEARCH_CHECK' && !SEARCH_RULE_TYPES.has(check.rule_type)) {
    errors.push('Search checks must use a supported investigation rule type.');
    return errors;
  }

  if (checkType !== 'SEARCH_CHECK' && !VALIDATION_RULE_TYPES.has(check.rule_type)) {
    errors.push('Validation checks must use a supported validation rule type.');
    return errors;
  }

  switch (check.rule_type) {
    case 'missing':
      if (!isAllowedField(check.parameters.field, allowedFields)) {
        errors.push('Missing-field checks require a valid target field.');
      }
      break;

    case 'duplicate':
      if (!Array.isArray(check.parameters.fields) || check.parameters.fields.length === 0) {
        errors.push('Duplicate checks require at least one key field.');
        break;
      }
      if (
        check.parameters.fields.some(
          (field) => !field || (allowedFields && allowedFields.length > 0 && !allowedFields.includes(field))
        )
      ) {
        errors.push('Duplicate checks must only reference valid fields in the selected scope.');
      }
      break;

    case 'math':
      if (isBlank(check.parameters.left_expression)) {
        errors.push('Math checks require a left expression.');
      }
      if (!MATH_OPERATORS.has(check.parameters.operator || '')) {
        errors.push('Math checks require a valid comparison operator.');
      }
      if (isBlank(check.parameters.right_expression)) {
        errors.push('Math checks require a right expression.');
      }
      if (
        check.parameters.tolerance !== undefined &&
        !isNonNegativeNumber(check.parameters.tolerance)
      ) {
        errors.push('Math check tolerance must be zero or greater.');
      }
      break;

    case 'regex':
      if (!isAllowedField(check.parameters.field, allowedFields)) {
        errors.push('Regex checks require a valid target field.');
      }
      if (isBlank(check.parameters.pattern)) {
        errors.push('Regex checks require a regex pattern.');
      } else {
        try {
          new RegExp(check.parameters.pattern || '');
        } catch {
          errors.push('Regex pattern is invalid.');
        }
      }
      break;

    case 'custom_formula':
      if (isBlank(check.parameters.formula)) {
        errors.push('Custom formula checks require a formula expression.');
      }
      break;

    case 'fuzzy_duplicate':
      if (
        !isDecimalInRange(check.parameters.vendor_similarity_threshold, 0.5, 1)
      ) {
        errors.push('Vendor similarity threshold must be between 0.5 and 1.0.');
      }
      if (!isNonNegativeNumber(check.parameters.amount_tolerance)) {
        errors.push('Amount tolerance must be zero or greater.');
      }
      if (!isIntegerInRange(check.parameters.date_window_days, 1, 30)) {
        errors.push('Date window must be a whole number between 1 and 30 days.');
      }
      break;

    case 'invoice_number_variant':
      if (
        !isDecimalInRange(check.parameters.invoice_number_similarity_threshold, 0.5, 1)
      ) {
        errors.push('Invoice number similarity threshold must be between 0.5 and 1.0.');
      }
      break;

    case 'trn_format_similarity':
      if (!isIntegerInRange(check.parameters.trn_distance_threshold, 1, 10)) {
        errors.push('TRN edit-distance threshold must be a whole number between 1 and 10.');
      }
      break;
  }

  return errors;
}
