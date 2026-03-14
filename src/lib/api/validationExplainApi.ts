import { checksRegistry } from '@/lib/checks/checksRegistry';
import { UAE_UC1_CHECK_PACK } from '@/lib/checks/uaeUC1CheckPack';
import { fetchActiveTemplates } from '@/lib/api/mappingApi';
import { getPintFieldById } from '@/types/fieldMapping';
import { PINT_AE_CODELISTS } from '@/lib/pintAE/generated/codelists';
import { supabase } from '@/integrations/supabase/client';
import { Exception } from '@/types/compliance';
import {
  ExplanationFixStep,
  ExplanationPack,
  ExplanationRootCause,
  GenerateValidationExplanationInput,
  MappingContext,
  MappingContextProvider,
  ValidationExplainMode,
  ValidationExplanation,
} from '@/types/validationExplain';

const DEFAULT_PROMPT_VERSION = 'validation_explain_v1';
const CACHE_TABLE = 'validation_explanations';

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function roundTo(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function toStringSafe(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value);
}

function ruleHintForException(exception: Exception): string {
  const message = exception.message.toLowerCase();
  const field = (exception.field || '').toLowerCase();
  const checkId = exception.checkId.toLowerCase();

  if (checkId.includes('missing') || message.includes('missing') || message.includes('not found')) {
    return 'required_presence';
  }
  if (
    checkId.includes('mismatch') ||
    message.includes('!=') ||
    message.includes('reconcile') ||
    field.includes('total') ||
    field.includes('amount')
  ) {
    return 'numeric_mismatch';
  }
  if (field.includes('date') || message.includes('date') || message.includes('yyyy')) {
    return 'date_format';
  }
  if (field.includes('trn') || message.includes('trn')) {
    return 'buyer_trn_format';
  }
  return 'generic_validation';
}

function normalizeRootCauseProbabilities(causes: ExplanationRootCause[]): ExplanationRootCause[] {
  if (causes.length === 0) return [];
  const total = causes.reduce((sum, item) => sum + Math.max(0, item.probability), 0);
  if (total <= 0) {
    const uniform = roundTo(1 / causes.length, 3);
    const normalized = causes.map((item) => ({ ...item, probability: uniform }));
    const sum = normalized.reduce((acc, item) => acc + item.probability, 0);
    normalized[normalized.length - 1].probability = roundTo(
      normalized[normalized.length - 1].probability + (1 - sum),
      3
    );
    return normalized;
  }

  const normalized = causes.map((item) => ({
    ...item,
    probability: roundTo(Math.max(0, item.probability) / total, 3),
  }));

  const normalizedSum = normalized.reduce((sum, item) => sum + item.probability, 0);
  const delta = roundTo(1 - normalizedSum, 3);
  normalized[normalized.length - 1].probability = roundTo(
    clamp01(normalized[normalized.length - 1].probability + delta),
    3
  );

  return normalized;
}

function buildRootCauses(
  exception: Exception,
  hint: string,
  mapping: MappingContext | null
): ExplanationRootCause[] {
  const field = exception.field || 'target field';
  const expected = toStringSafe(exception.expectedValue);
  const actual = toStringSafe(exception.actualValue);
  const mappingEvidence = mapping?.mapping_path
    ? `Mapped via ${mapping.mapping_path}.`
    : 'No active mapping trace available.';

  if (hint === 'required_presence') {
    return normalizeRootCauseProbabilities([
      {
        cause: 'Source value is null/blank before transformation',
        probability: 0.5,
        evidence: [
          `Validation flagged missing value for ${field}.`,
          `Observed value: ${actual || '(empty)'}.`,
          mappingEvidence,
        ],
      },
      {
        cause: 'Mapping path does not populate this required target field',
        probability: 0.3,
        evidence: [
          'Mandatory field failed required presence validation.',
          mappingEvidence,
          'Template mapping likely points to wrong ERP column or missing transform.',
        ],
      },
      {
        cause: 'Upstream extract omitted the column/value',
        probability: 0.2,
        evidence: [
          'Exception appears during ingestion validation path.',
          `Rule message: ${exception.message}`,
        ],
      },
    ]);
  }

  if (hint === 'numeric_mismatch') {
    const parsedExpected = Number(expected);
    const parsedActual = Number(actual);
    const delta =
      Number.isFinite(parsedExpected) && Number.isFinite(parsedActual)
        ? roundTo(parsedActual - parsedExpected, 6)
        : undefined;

    return normalizeRootCauseProbabilities([
      {
        cause: 'Source arithmetic does not reconcile with rule formula',
        probability: 0.45,
        evidence: [
          `Expected: ${expected || 'n/a'}; actual: ${actual || 'n/a'}.`,
          delta !== undefined ? `Delta: ${delta}.` : 'Delta could not be computed from values.',
          `Rule message: ${exception.message}`,
        ],
      },
      {
        cause: 'Rounding/precision configuration mismatch',
        probability: 0.3,
        evidence: [
          'Numeric mismatch checks are sensitive to rounding strategy.',
          'Potential 2-decimal vs source precision inconsistency.',
        ],
      },
      {
        cause: 'Transformation altered numeric scale or sign',
        probability: 0.25,
        evidence: [mappingEvidence, 'Transformation chain can modify magnitude/sign.'],
      },
    ]);
  }

  if (hint === 'date_format') {
    return normalizeRootCauseProbabilities([
      {
        cause: 'Date not normalized to required ISO format',
        probability: 0.55,
        evidence: [
          `Field ${field} failed date-format validation.`,
          `Observed: ${actual || '(empty)'}.`,
        ],
      },
      {
        cause: 'Source date locale conflicts with parser assumptions',
        probability: 0.25,
        evidence: [
          'Date parse issues typically occur with DD/MM vs YYYY-MM-DD source formats.',
          mappingEvidence,
        ],
      },
      {
        cause: 'Transformation for date_parse is missing or misconfigured',
        probability: 0.2,
        evidence: [mappingEvidence, 'No deterministic conversion step confirmed in evidence.'],
      },
    ]);
  }

  if (hint === 'buyer_trn_format') {
    return normalizeRootCauseProbabilities([
      {
        cause: 'TRN format does not match expected 15-digit UAE pattern',
        probability: 0.6,
        evidence: [
          `Observed TRN: ${actual || '(empty)'}.`,
          `Expected pattern: ${expected || '15-digit number'}.`,
        ],
      },
      {
        cause: 'Non-digit characters or spacing introduced during extraction',
        probability: 0.25,
        evidence: ['TRN validation commonly fails due to separators, spaces, or masked values.'],
      },
      {
        cause: 'Incorrect source field mapped to TRN target',
        probability: 0.15,
        evidence: [mappingEvidence, 'Mapped source may be non-TRN identifier.'],
      },
    ]);
  }

  return normalizeRootCauseProbabilities([
    {
      cause: 'Source data value conflicts with active rule condition',
      probability: 0.5,
      evidence: [`Rule message: ${exception.message}`, `Field: ${field || '(not provided)'}`],
    },
    {
      cause: 'Mapping/transformation path not aligned with target semantics',
      probability: 0.3,
      evidence: [mappingEvidence],
    },
    {
      cause: 'Master-data quality issue upstream',
      probability: 0.2,
      evidence: ['Exception occurred at validation stage with unresolved data quality signal.'],
    },
  ]);
}

function getRuleReferences(exception: Exception) {
  const builtin = checksRegistry.find((check) => check.id === exception.checkId);
  if (builtin) {
    return [
      {
        ruleCode: builtin.id,
        ruleName: builtin.name,
        severity: builtin.severity,
      },
    ];
  }

  const uc1 = UAE_UC1_CHECK_PACK.find((check) => check.check_id === exception.checkId);
  if (uc1) {
    return [
      {
        ruleCode: uc1.check_id,
        ruleName: uc1.check_name,
        severity: uc1.severity,
        specRef: uc1.mof_rule_reference,
      },
    ];
  }

  return [
    {
      ruleCode: exception.checkId,
      ruleName: exception.checkName,
      severity: exception.severity,
    },
  ];
}

function findPintFieldMetadata(fieldName?: string): Record<string, unknown> | null {
  if (!fieldName) return null;
  const field = getPintFieldById(fieldName);
  if (!field) return null;

  let codelistMatch: string | undefined;
  if (field.allowedValues?.length) {
    codelistMatch = 'inline_allowed_values';
  } else if (field.id.includes('currency')) {
    codelistMatch = 'ISO4217';
  } else if (field.id.includes('country')) {
    codelistMatch = 'ISO3166';
  } else if (field.id.includes('tax_category')) {
    codelistMatch = 'Aligned-TaxCategoryCodes';
  }

  const codelistValues =
    codelistMatch && codelistMatch !== 'inline_allowed_values'
      ? (PINT_AE_CODELISTS as Record<string, { ids: string[] }>)[codelistMatch]?.ids || []
      : field.allowedValues || [];

  return {
    targetFieldId: field.id,
    ibtReference: field.ibtReference,
    dataType: field.dataType,
    cardinality: field.isMandatory ? '1..1' : '0..1',
    codeList: codelistMatch,
    codeListSample: codelistValues.slice(0, 10),
  };
}

function ownerHintFromSeverity(severity: Exception['severity']): string {
  if (severity === 'Critical') return 'Client Finance + Client IT';
  if (severity === 'High') return 'Client IT';
  if (severity === 'Medium') return 'Client Finance';
  return 'ASP Ops';
}

function fixChecklistForException(
  exception: Exception,
  rootCauses: ExplanationRootCause[],
  mapping: MappingContext | null
): ExplanationFixStep[] {
  const dataset = exception.datasetType || 'AR';
  const field = exception.field || '';
  const mappingLink = field
    ? `/mapping?dataset=${encodeURIComponent(dataset)}&field=${encodeURIComponent(field)}`
    : '/mapping';
  const invoiceLink = exception.invoiceId ? `/invoice/${encodeURIComponent(exception.invoiceId)}` : undefined;

  const topCause = rootCauses[0]?.cause || 'Data and mapping mismatch';
  const base: ExplanationFixStep[] = [
    {
      step: `Verify source record for ${field || 'the affected field'} and confirm expected business value.`,
      ownerHint: 'Client Finance',
      linkToUI: invoiceLink,
    },
    {
      step: 'Review mapping path and transformation chain for this field to ensure correct source binding.',
      ownerHint: 'Client IT',
      linkToUI: mappingLink,
    },
    {
      step: `Apply correction based on root cause: ${topCause}. Re-run checks to confirm closure.`,
      ownerHint: ownerHintFromSeverity(exception.severity),
      linkToUI: '/run',
    },
  ];

  if (mapping?.sample_source_value) {
    base.unshift({
      step: `Compare mapped sample source value "${mapping.sample_source_value}" with expected target semantics.`,
      ownerHint: 'Client IT',
      linkToUI: mappingLink,
    });
  }

  return base;
}

function deriveImpact(exception: Exception): string {
  if (exception.severity === 'Critical') {
    return 'High operational risk: this issue can block readiness and trigger exchange/rejection failures until corrected.';
  }
  if (exception.severity === 'High') {
    return 'Material compliance risk: this issue can cause downstream validation failures and rework.';
  }
  if (exception.severity === 'Medium') {
    return 'Moderate risk: quality/performance impact likely, with potential audit friction if repeated.';
  }
  return 'Low risk: issue is unlikely to block flow alone but should be corrected to prevent accumulation.';
}

function deriveConfidence(exception: Exception, mapping: MappingContext | null, hint: string): number {
  let score = 0.6;
  if (exception.expectedValue !== undefined && exception.actualValue !== undefined) score += 0.12;
  if (exception.field) score += 0.08;
  if (mapping?.mapping_path) score += 0.1;
  if (hint !== 'generic_validation') score += 0.05;
  if (exception.severity === 'Critical') score += 0.03;
  return roundTo(clamp01(score), 3);
}

async function tryFetchCachedExplanation(exception: Exception): Promise<ValidationExplanation | null> {
  try {
    const query = (supabase as any)
      .from(CACHE_TABLE)
      .select('*')
      .eq('exception_id', exception.id)
      .order('created_at', { ascending: false })
      .limit(1);
    const { data, error } = await query.maybeSingle();
    if (error || !data) return null;

    const sourceContext = (data.source_context as Record<string, unknown>) || {};
    const packFromContext = sourceContext.explanation_pack as ExplanationPack | undefined;
    if (!packFromContext) return null;

    return {
      id: data.id,
      exceptionId: data.exception_id,
      checkId: data.check_id,
      datasetType: data.dataset_type,
      fieldName: data.field_name,
      explanation: data.explanation || packFromContext.summary,
      recommendedFix: data.recommended_fix || packFromContext.fixChecklist?.[0]?.step || '',
      promptVersion: data.prompt_version || undefined,
      sourceContext,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      explanationPack: {
        ...packFromContext,
        engine: {
          ...packFromContext.engine,
          source: 'cache',
        },
      },
    };
  } catch {
    return null;
  }
}

async function tryPersistExplanation(
  exception: Exception,
  explanation: ValidationExplanation,
  promptVersion: string
): Promise<void> {
  try {
    await (supabase as any).from(CACHE_TABLE).insert({
      exception_id: exception.id,
      check_id: exception.checkId,
      dataset_type: exception.datasetType || 'AR',
      field_name: exception.field || null,
      explanation: explanation.explanation,
      recommended_fix: explanation.recommendedFix,
      prompt_version: promptVersion,
      source_context: {
        ...(explanation.sourceContext || {}),
        explanation_pack: explanation.explanationPack,
      },
    });
  } catch {
    // Intentionally ignore persistence failures for backward compatibility.
  }
}

async function tryAssistWithEdgeFunction(params: {
  exception: Exception;
  pack: ExplanationPack;
  promptVersion: string;
}): Promise<ExplanationPack | null> {
  try {
    const { data, error } = await supabase.functions.invoke('validation-explain', {
      body: {
        mode: 'assist',
        prompt_version: params.promptVersion,
        exception: params.exception,
        explanation_pack: params.pack,
      },
    });
    if (error || !data) return null;

    const assisted = (data.explanation_pack || data.explanationPack) as ExplanationPack | undefined;
    if (!assisted) return null;

    return {
      ...assisted,
      engine: {
        ...assisted.engine,
        source: 'assist',
        version: 'assist_v1',
        promptVersion: params.promptVersion,
      },
    };
  } catch {
    return null;
  }
}

export class SupabaseMappingContextProvider implements MappingContextProvider {
  async getMappingContext(params: {
    datasetType?: ValidationExplanation['datasetType'];
    fieldName?: string;
    exception: Exception;
  }): Promise<MappingContext | null> {
    const fieldName = params.fieldName;
    if (!fieldName) return null;

    try {
      const templates = await fetchActiveTemplates();
      for (const template of templates) {
        const match = template.mappings.find(
          (mapping) =>
            mapping.targetField?.id === fieldName ||
            mapping.erpColumn === fieldName ||
            mapping.targetField?.ibtReference === fieldName
        );
        if (!match) continue;

        return {
          mapping_path: `${template.templateName} -> ${match.erpColumn} -> ${match.targetField.id}`,
          sample_source_value: match.sampleValues?.[0],
          dataset_type: params.datasetType,
          field_name: fieldName,
        };
      }
    } catch {
      return null;
    }
    return null;
  }
}

export class NullMappingContextProvider implements MappingContextProvider {
  async getMappingContext(): Promise<MappingContext | null> {
    return null;
  }
}

const defaultMappingProvider: MappingContextProvider = new SupabaseMappingContextProvider();

export async function buildHeuristicExplanation(
  exception: Exception,
  options?: {
    promptVersion?: string;
    mappingProvider?: MappingContextProvider;
  }
): Promise<ValidationExplanation> {
  const promptVersion = options?.promptVersion || DEFAULT_PROMPT_VERSION;
  const mappingProvider = options?.mappingProvider || defaultMappingProvider;
  const hint = ruleHintForException(exception);

  const mappingContext = await mappingProvider.getMappingContext({
    datasetType: exception.datasetType,
    fieldName: exception.field,
    exception,
  });

  const likelyRootCauses = buildRootCauses(exception, hint, mappingContext);
  const ruleReferences = getRuleReferences(exception);
  const fixChecklist = fixChecklistForException(exception, likelyRootCauses, mappingContext);
  const pintMetadata = findPintFieldMetadata(exception.field);

  const summary = `${exception.checkName} failed for ${
    exception.invoiceNumber || exception.invoiceId || 'the selected record'
  }. The failure is evidence-based and traceable to source, mapping, or rule semantics.`;

  const whyItFailed = [
    `Rule message: ${exception.message}`,
    exception.field
      ? `Field under validation: ${exception.field}`
      : 'Field is not explicitly provided by this exception.',
    `Observed value: ${toStringSafe(exception.actualValue) || '(not provided)'}`,
    `Expected value/rule: ${toStringSafe(exception.expectedValue) || '(not provided)'}`,
  ];

  const pack: ExplanationPack = {
    summary,
    whyItFailed,
    likelyRootCauses,
    impact: deriveImpact(exception),
    fixChecklist,
    ruleReferences,
    confidence: deriveConfidence(exception, mappingContext, hint),
    engine: {
      source: 'heuristic',
      version: 'heuristic_v1',
      promptVersion,
      heuristicRuleHint: hint,
    },
    evidenceSnapshot: {
      invoice: exception.invoiceNumber || exception.invoiceId,
      field: exception.field,
      expected: exception.expectedValue,
      actual: exception.actualValue,
      delta:
        Number.isFinite(Number(exception.expectedValue)) && Number.isFinite(Number(exception.actualValue))
          ? roundTo(Number(exception.actualValue) - Number(exception.expectedValue), 6)
          : undefined,
      mapping: mappingContext || undefined,
      rawMessage: exception.message,
      pintMetadata: pintMetadata || undefined,
    },
  };

  return {
    exceptionId: exception.id,
    checkId: exception.checkId,
    datasetType: exception.datasetType,
    fieldName: exception.field,
    explanation: pack.summary,
    recommendedFix: pack.fixChecklist[0]?.step || 'Review source data and mapping, then re-run validation.',
    promptVersion,
    sourceContext: {
      explanation_pack: pack,
      mapping_context: mappingContext || null,
      rule_hint: hint,
      evidence_basis: ['expected', 'actual', 'message', 'field', 'check_metadata', 'mapping_metadata', 'pint_metadata'],
    },
    explanationPack: pack,
  };
}

export async function generateValidationExplanation(
  input: GenerateValidationExplanationInput,
  options?: {
    mappingProvider?: MappingContextProvider;
  }
): Promise<ValidationExplanation> {
  const mode: ValidationExplainMode = input.mode || 'heuristic_only';
  const promptVersion = input.promptVersion || DEFAULT_PROMPT_VERSION;

  if (!input.regenerate) {
    const cached = await tryFetchCachedExplanation(input.exception);
    if (cached) return cached;
  }

  const heuristic = await buildHeuristicExplanation(input.exception, {
    promptVersion,
    mappingProvider: options?.mappingProvider,
  });

  let finalExplanation = heuristic;
  if (mode === 'assist' && heuristic.explanationPack) {
    const assistedPack = await tryAssistWithEdgeFunction({
      exception: input.exception,
      pack: heuristic.explanationPack,
      promptVersion,
    });

    if (assistedPack) {
      finalExplanation = {
        ...heuristic,
        explanation: assistedPack.summary,
        recommendedFix: assistedPack.fixChecklist[0]?.step || heuristic.recommendedFix,
        sourceContext: {
          ...(heuristic.sourceContext || {}),
          explanation_pack: assistedPack,
        },
        explanationPack: assistedPack,
      };
    }
  }

  await tryPersistExplanation(input.exception, finalExplanation, promptVersion);
  return finalExplanation;
}

export const __testables = {
  ruleHintForException,
  normalizeRootCauseProbabilities,
  buildRootCauses,
};

