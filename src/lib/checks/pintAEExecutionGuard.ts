import { PintAECheck } from '@/types/pintAE';
import { getCodelistCodes } from '@/lib/pintAE/specCatalog';
import { UAE_UC1_CHECK_PACK } from './uaeUC1CheckPack';

const definitions = new Map(UAE_UC1_CHECK_PACK.map(check => [check.check_id, check]));
const fieldRequired = new Set(['001', '002', '003', '004', '005', '012', '014', '019', '022', '023', '024', '026', '033'].map(id => `UAE-UC1-CHK-${id}`));
const decimalChecks = new Set(['022', '023', '024', '026'].map(id => `UAE-UC1-CHK-${id}`));
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

export class PintAEExecutionError extends Error {
  constructor(public readonly code: 'EMPTY_RULESET' | 'INVALID_RULE' | 'UNSUPPORTED_RULE', message: string, public readonly checkId?: string) {
    super(message);
    this.name = 'PintAEExecutionError';
  }
}

export function assertExecutablePintAECheck(check: PintAECheck): void {
  const invalid = (reason: string): never => {
    throw new PintAEExecutionError('INVALID_RULE', `Cannot execute ${check.check_id}: ${reason}`, check.check_id);
  };
  const params = check.parameters;
  if (!params || typeof params !== 'object' || Array.isArray(params)) invalid('parameters must be an object.');
  const definition = definitions.get(check.check_id);
  if (definition && (definition.rule_type !== check.rule_type || definition.scope !== check.scope)) {
    invalid(`executor requires type ${definition.rule_type} and scope ${definition.scope}.`);
  }
  if (!definition) {
    if (!['Presence', 'CodeList'].includes(check.rule_type)) {
      throw new PintAEExecutionError('UNSUPPORTED_RULE', `Cannot execute ${check.check_id}: unsupported rule type ${check.rule_type}.`, check.check_id);
    }
    if (!['Header', 'Lines', 'Party', 'Cross'].includes(check.scope)) invalid('unsupported scope.');
    if (!text(params.field)) invalid('field is required.');
    if (check.rule_type === 'CodeList' && (!text(params.codelist) || getCodelistCodes(params.codelist).length === 0)) {
      invalid(`unknown or missing codelist ${String(params.codelist)}.`);
    }
  }
  if (fieldRequired.has(check.check_id) && !text(params.field)) invalid('field is required.');
  if (check.check_id === 'UAE-UC1-CHK-003') {
    if (!text(params.pattern)) invalid('pattern is required.');
    try { new RegExp(params.pattern); } catch { invalid('pattern is not a valid regular expression.'); }
  }
  if (decimalChecks.has(check.check_id) && (!Number.isInteger(params.max_decimals) || params.max_decimals < 0)) {
    invalid('max_decimals must be a non-negative integer.');
  }
  if (check.check_id === 'UAE-UC1-CHK-016' && (!Array.isArray(params.allowed_values) || params.allowed_values.length === 0 || !params.allowed_values.every(text))) {
    invalid('allowed_values must be a non-empty list of strings.');
  }
  if (params.fields !== undefined && (!Array.isArray(params.fields) || params.fields.length === 0 || !params.fields.every(text))) {
    invalid('fields must be a non-empty list of strings.');
  }
  if (params.tolerance !== undefined && (typeof params.tolerance !== 'number' || !Number.isFinite(params.tolerance) || params.tolerance < 0)) {
    invalid('tolerance must be a finite non-negative number.');
  }
}

export function assertExecutablePintAERuleset(checks: PintAECheck[]): void {
  const enabled = checks.filter(check => check.is_enabled);
  if (!enabled.length) throw new PintAEExecutionError('EMPTY_RULESET', 'No enabled PINT-AE checks are available. Validation was not performed.');
  const ids = new Set<string>();
  for (const check of enabled) {
    if (ids.has(check.check_id)) throw new PintAEExecutionError('INVALID_RULE', `Duplicate enabled check ${check.check_id}.`, check.check_id);
    ids.add(check.check_id);
    assertExecutablePintAECheck(check);
  }
}
