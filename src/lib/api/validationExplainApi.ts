import { supabase } from '@/integrations/supabase/client';
import { Exception } from '@/types/compliance';
import {
  ExceptionLike,
  GenerateValidationExplanationOptions,
  ValidationExplainFunctionInput,
  ValidationExplanation,
  ValidationRisk,
} from '@/types/validationExplain';

const DEFAULT_TENANT_ID = 'default';
const DEFAULT_PROMPT_VERSION = 'v1';
const TABLE_NAME = 'validation_explanations';
type HeuristicRuleHint =
  | 'buyer_trn_format'
  | 'seller_trn_format'
  | 'required_presence'
  | 'numeric_mismatch'
  | 'date_format'
  | 'generic';

function toRisk(severity: string | undefined): ValidationRisk {
  if (severity === 'Critical' || severity === 'High' || severity === 'Medium' || severity === 'Low') {
    return severity;
  }
  return 'Medium';
}

function clampConfidence(value: unknown, fallback = 0.55): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (Number.isFinite(num)) {
    if (num < 0) return 0;
    if (num > 1) return 1;
    return num;
  }
  return fallback;
}

function safeString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function normalizeText(value: unknown): string {
  return safeString(value).trim().toLowerCase();
}

function detectHeuristicRule(exception: ExceptionLike): HeuristicRuleHint {
  const corpus = [
    normalizeText(exception.checkId),
    normalizeText(exception.checkName),
    normalizeText(exception.field),
    normalizeText(exception.message),
  ].join(' ');
  const field = normalizeText(exception.field);

  const looksFormatIssue =
    corpus.includes('invalid') || corpus.includes('format') || corpus.includes('pattern');

  if ((corpus.includes('buyer_trn') || field === 'buyer_trn') && looksFormatIssue) {
    return 'buyer_trn_format';
  }
  if ((corpus.includes('seller_trn') || field === 'seller_trn') && looksFormatIssue) {
    return 'seller_trn_format';
  }
  if (corpus.includes('date') && looksFormatIssue) {
    return 'date_format';
  }
  if (
    corpus.includes('required') ||
    corpus.includes('missing') ||
    corpus.includes('present') ||
    corpus.includes('empty')
  ) {
    return 'required_presence';
  }
  if (
    corpus.includes('mismatch') ||
    corpus.includes('does not match') ||
    corpus.includes('difference') ||
    corpus.includes('variance')
  ) {
    return 'numeric_mismatch';
  }
  return 'generic';
}

function extractExpectedDigitLength(expected: string): number | null {
  const match = expected.match(/(\d+)\s*[- ]?digit/i);
  if (!match) return null;
  const numeric = Number(match[1]);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Math.trunc(numeric);
}

function parseNumeric(value: unknown): number | null {
  const normalized = safeString(value).replace(/,/g, '').trim();
  if (!normalized) return null;
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) return null;
  return numeric;
}

function formatNumeric(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function computeHeuristicConfidence(
  rule: HeuristicRuleHint,
  field: string,
  expected: string,
  actual: string,
  message: string,
): number {
  let confidence = rule === 'generic' ? 0.42 : 0.56;
  if (field) confidence += 0.1;
  if (expected) confidence += 0.1;
  if (actual) confidence += 0.1;
  if (expected && actual) confidence += 0.05;
  if (message) confidence += 0.05;
  if (rule === 'buyer_trn_format' || rule === 'seller_trn_format') confidence += 0.05;
  return clampConfidence(confidence, 0.45);
}

function hashString(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24);
  }
  return (hash >>> 0).toString(16);
}

export function buildValidationExceptionKey(exception: ExceptionLike): string {
  const keyMaterial = [
    exception.validationRunId || 'local',
    exception.datasetType || exception.direction || 'NA',
    exception.checkId || 'NA',
    exception.invoiceId || 'NA',
    exception.lineId || 'NA',
    exception.field || 'NA',
    hashString(exception.message || ''),
  ].join('|');
  return keyMaterial;
}

function mapRowToExplanation(row: any, source: ValidationExplanation['source'], cached: boolean): ValidationExplanation {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    exceptionKey: row.exception_key,
    checkExceptionId: row.check_exception_id,
    validationRunId: row.validation_run_id,
    invoiceId: row.invoice_id,
    ruleCode: row.rule_code,
    checkId: row.check_id,
    checkName: row.check_name,
    datasetType: row.dataset_type,
    direction: row.direction,
    explanation: row.explanation,
    risk: toRisk(row.risk),
    recommendedFix: row.recommended_fix,
    confidence: clampConfidence(row.confidence),
    model: row.model,
    promptVersion: row.prompt_version || DEFAULT_PROMPT_VERSION,
    sourceContext: (row.source_context as Record<string, unknown> | null) || null,
    status: row.status === 'failed' ? 'failed' : 'completed',
    errorMessage: row.error_message,
    generatedAt: row.generated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    source,
    cached,
  };
}

function buildHeuristicExplanation(exception: ExceptionLike, tenantId: string, exceptionKey: string, promptVersion: string): ValidationExplanation {
  const expected = safeString(exception.expectedValue).trim();
  const actual = safeString(exception.actualValue).trim();
  const field = exception.field || 'the validated field';
  const invoiceRef = exception.invoiceNumber || exception.invoiceId || 'the invoice';
  const risk = toRisk(exception.severity);
  const message = safeString(exception.message).trim();
  const ruleHint = detectHeuristicRule(exception);
  const confidence = computeHeuristicConfidence(ruleHint, field, expected, actual, message);
  const expectedDisplay = expected || '(defined rule)';
  const actualDisplay = actual || '(empty)';
  let explanation = '';
  let recommendedFix = '';

  if (ruleHint === 'buyer_trn_format' || ruleHint === 'seller_trn_format') {
    const expectedDigits = extractExpectedDigitLength(expected) || 15;
    const actualDigitsOnly = actual.replace(/\D/g, '');
    const issues: string[] = [];
    if (!actual) {
      issues.push('The value is empty.');
    } else {
      if (!/^\d+$/.test(actual)) issues.push('It contains non-numeric characters.');
      if (actualDigitsOnly.length !== expectedDigits) {
        issues.push(`It has ${actualDigitsOnly.length} digits instead of ${expectedDigits}.`);
      }
    }
    const subject = ruleHint === 'buyer_trn_format' ? 'Buyer TRN' : 'Seller TRN';
    const issueSummary =
      issues.length > 0
        ? issues.join(' ')
        : `It does not satisfy the expected ${expectedDigits}-digit numeric format.`;
    explanation = `${subject} format validation failed for ${invoiceRef}. ${issueSummary} Expected ${expectedDisplay} but found ${actualDisplay}.`;
    recommendedFix = `Correct ${field} to a ${expectedDigits}-digit numeric value (digits only, no spaces or letters), validate at source upload, then re-run checks.`;
  } else if (ruleHint === 'required_presence') {
    explanation = `${field} is mandatory for ${invoiceRef} but is missing or blank. ${message}`;
    recommendedFix = `Populate ${field} in source data and mapping output for all required records, then re-run checks.`;
  } else if (ruleHint === 'numeric_mismatch') {
    const expectedNum = parseNumeric(expected);
    const actualNum = parseNumeric(actual);
    const mismatchDetail =
      expectedNum !== null && actualNum !== null
        ? `Expected ${formatNumeric(expectedNum)} but found ${formatNumeric(actualNum)} (difference ${formatNumeric(Math.abs(expectedNum - actualNum))}).`
        : `Expected ${expectedDisplay} but found ${actualDisplay}.`;
    explanation = `Numeric consistency validation failed for ${invoiceRef}. ${mismatchDetail}`;
    recommendedFix = `Recalculate ${field} using the check formula and source line values, then align totals and re-run checks.`;
  } else if (ruleHint === 'date_format') {
    const expectedPattern = expected || 'YYYY-MM-DD';
    explanation = `Date format validation failed for ${invoiceRef}. Field ${field} has value ${actualDisplay}, which does not match ${expectedPattern}.`;
    recommendedFix = `Normalize ${field} to ${expectedPattern} in source extraction or mapping transformation, then re-run checks.`;
  } else {
    explanation = [
      `Rule ${exception.checkId || 'unknown rule'} failed for ${invoiceRef}.`,
      message,
      `Field ${field} expected ${expectedDisplay} but found ${actualDisplay}.`,
    ]
      .filter(Boolean)
      .join(' ');
    recommendedFix = expected
      ? `Review ${field} and align it to ${expected}. Re-run checks after correction.`
      : `Review ${field} for format/completeness against ${exception.checkName || exception.checkId || 'the check'}. Re-run checks after correction.`;
  }

  return {
    tenantId,
    exceptionKey,
    checkExceptionId: null,
    validationRunId: exception.validationRunId || null,
    invoiceId: exception.invoiceId || null,
    ruleCode: exception.checkId || null,
    checkId: exception.checkId || null,
    checkName: exception.checkName || null,
    datasetType: exception.datasetType || null,
    direction: exception.direction || null,
    explanation,
    risk,
    recommendedFix,
    confidence,
    model: 'heuristic-local-v2',
    promptVersion,
    sourceContext: {
      heuristic_version: 'v2',
      rule_hint: ruleHint,
      evidence: {
        field,
        expected_value: expected || null,
        actual_value: actual || null,
        message: message || null,
      },
    },
    status: 'completed',
    errorMessage: null,
    generatedAt: new Date().toISOString(),
    source: 'fallback',
    cached: false,
  };
}

function serializeExceptionForFunction(exception: Exception): ValidationExplainFunctionInput['exception'] {
  return {
    id: exception.id,
    check_id: exception.checkId,
    check_name: exception.checkName,
    severity: exception.severity,
    message: exception.message,
    invoice_id: exception.invoiceId || null,
    invoice_number: exception.invoiceNumber || null,
    seller_trn: exception.sellerTrn || null,
    buyer_id: exception.buyerId || null,
    line_id: exception.lineId || null,
    field_name: exception.field || null,
    expected_value: exception.expectedValue ?? null,
    actual_value: exception.actualValue ?? null,
    dataset_type: exception.datasetType || null,
    direction: exception.direction || null,
    validation_run_id: exception.validationRunId || null,
  };
}

async function persistFallback(explanation: ValidationExplanation): Promise<void> {
  const { error } = await supabase.from(TABLE_NAME).upsert(
    {
      tenant_id: explanation.tenantId,
      exception_key: explanation.exceptionKey,
      check_exception_id: explanation.checkExceptionId,
      validation_run_id: explanation.validationRunId,
      invoice_id: explanation.invoiceId,
      rule_code: explanation.ruleCode,
      check_id: explanation.checkId,
      check_name: explanation.checkName,
      dataset_type: explanation.datasetType,
      direction: explanation.direction,
      explanation: explanation.explanation,
      risk: explanation.risk,
      recommended_fix: explanation.recommendedFix,
      confidence: explanation.confidence,
      model: explanation.model,
      prompt_version: explanation.promptVersion,
      source_context: explanation.sourceContext,
      status: explanation.status,
      error_message: explanation.errorMessage,
      generated_at: explanation.generatedAt || new Date().toISOString(),
    },
    { onConflict: 'tenant_id,exception_key' },
  );
  if (error) {
    // Keep UX working even if persistence is unavailable.
    console.warn('[Validation Explain] Could not persist fallback explanation:', error.message);
  }
}

export async function fetchValidationExplanation(
  exception: ExceptionLike,
  tenantId = DEFAULT_TENANT_ID,
): Promise<ValidationExplanation | null> {
  const exceptionKey = buildValidationExceptionKey(exception);
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('exception_key', exceptionKey)
    .maybeSingle();

  if (error || !data) return null;
  return mapRowToExplanation(data, 'cache', true);
}

export async function generateValidationExplanation(
  exception: Exception,
  options: GenerateValidationExplanationOptions = {},
): Promise<ValidationExplanation> {
  const tenantId = options.tenantId || DEFAULT_TENANT_ID;
  const promptVersion = options.promptVersion || DEFAULT_PROMPT_VERSION;
  const regenerate = options.regenerate === true;
  const exceptionKey = buildValidationExceptionKey(exception);

  if (!regenerate) {
    const cached = await fetchValidationExplanation(exception, tenantId);
    if (cached) return cached;
  }

  const payload: ValidationExplainFunctionInput = {
    exception_key: exceptionKey,
    tenant_id: tenantId,
    regenerate,
    prompt_version: promptVersion,
    exception: serializeExceptionForFunction(exception),
  };

  try {
    const { data, error } = await supabase.functions.invoke('validation-explain', {
      body: payload,
    });

    if (!error && data && typeof data === 'object' && data.explanation) {
      return mapRowToExplanation(data, 'edge', false);
    }
  } catch (err) {
    console.warn('[Validation Explain] Edge function call failed:', err);
  }

  const fallback = buildHeuristicExplanation(exception, tenantId, exceptionKey, promptVersion);
  await persistFallback(fallback);
  return fallback;
}
