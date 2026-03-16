import { runPintAECheckWithTelemetry } from '@/lib/checks/pintAECheckRunner';
import { UAE_UC1_CHECK_PACK } from '@/lib/checks/uaeUC1CheckPack';
import {
  getDRCoverageMaturity,
  getValidationDRTargets,
  type ValidationDRTarget,
} from '@/lib/registry/validationToDRMap';
import {
  getCutoverRegressionCorpus,
  type RegressionCorpusEntry,
} from '@/modules/scenarioContext/regressionCorpus';
import {
  buildRuleApplicabilityComparisons,
  type RuleApplicabilityComparisonRow,
} from '@/modules/scenarioContext/shadowApplicability';
import type { Buyer, DataContext, InvoiceHeader, InvoiceLine } from '@/types/compliance';
import type { PintAECheck, PintAEException } from '@/types/pintAE';

export const VAT_TREATMENT_CUTOVER_RULE_IDS = [
  'UAE-UC1-CHK-049',
  'UAE-UC1-CHK-050',
  'UAE-UC1-CHK-051',
  'UAE-UC1-CHK-052',
] as const;

export const VAT_TREATMENT_APPLICABILITY_FLAG = 'VITE_VAT_TREATMENT_APPLICABILITY_MODE';
export const VAT_TREATMENT_APPLICABILITY_SCENARIO_MODE = 'scenario_context';
export const VAT_TREATMENT_APPLICABILITY_LEGACY_MODE = 'legacy';

export interface VatTreatmentRuleProposal {
  ruleId: string;
  title: string;
  linkedDrIds: string[];
  legacyApplicabilityInputs: string[];
  shadowApplicabilityAttributes: string[];
}

export interface VatTreatmentCorpusResult {
  entryId: string;
  description: string;
  source: RegressionCorpusEntry['source'];
  rows: RuleApplicabilityComparisonRow[];
}

export interface VatTreatmentDrCoverageImpact {
  ruleId: string;
  linkedDrCoverage: Array<
    ValidationDRTarget & {
      coverageMaturity: ReturnType<typeof getDRCoverageMaturity>;
    }
  >;
}

export interface VatTreatmentRuntimeComparisonRow {
  entryId: string;
  description: string;
  source: RegressionCorpusEntry['source'];
  ruleId: string;
  title: string;
  legacyExecutionCount: number;
  scenarioExecutionCount: number;
  legacyFailureCount: number;
  scenarioFailureCount: number;
  authoritativeOutputDifference: boolean;
  differenceClassification: 'runtime_parity' | 'justified_improvement' | 'potential_regression';
  justification: string;
}

export interface VatTreatmentRuntimeComparisonReport {
  corpusSize: number;
  rows: VatTreatmentRuntimeComparisonRow[];
  summary: {
    totalComparisons: number;
    parityCount: number;
    justifiedImprovementCount: number;
    potentialRegressionCount: number;
    authoritativeOutputDifferenceCount: number;
  };
  rollback: {
    flag: string;
    legacyValue: typeof VAT_TREATMENT_APPLICABILITY_LEGACY_MODE;
    scenarioValue: typeof VAT_TREATMENT_APPLICABILITY_SCENARIO_MODE;
    defaultValue: typeof VAT_TREATMENT_APPLICABILITY_LEGACY_MODE;
  };
}

export interface VatTreatmentCutoverPacket {
  ruleProposals: VatTreatmentRuleProposal[];
  corpusResults: VatTreatmentCorpusResult[];
  summary: {
    corpusSize: number;
    totalComparisons: number;
    alignedCount: number;
    bothNotApplicableCount: number;
    divergentCount: number;
    expectedImprovementCount: number;
    potentialRegressionCount: number;
  };
  unresolvedPotentialRegressions: RuleApplicabilityComparisonRow[];
  blockedDependencies: string[];
  drCoverageImpact: VatTreatmentDrCoverageImpact[];
  traceabilityImpactNotes: string[];
  exceptionAnalysisImpactNotes: string[];
  semanticSensitivityNotes: string[];
  runtimeComparison: VatTreatmentRuntimeComparisonReport;
}

const VAT_TREATMENT_RULE_ID_SET = new Set<string>(VAT_TREATMENT_CUTOVER_RULE_IDS);
const CHECKS_BY_ID = new Map(UAE_UC1_CHECK_PACK.map((check) => [check.check_id, check]));

export function buildVatTreatmentCutoverPacket(): VatTreatmentCutoverPacket {
  const corpus = getCutoverRegressionCorpus();
  const corpusResults = buildVatTreatmentCorpusResults(corpus);
  const allRows = corpusResults.flatMap((result) => result.rows);

  return {
    ruleProposals: VAT_TREATMENT_CUTOVER_RULE_IDS.map(buildRuleProposal),
    corpusResults,
    summary: {
      corpusSize: corpus.length,
      totalComparisons: allRows.length,
      alignedCount: allRows.filter((row) => row.differenceStatus === 'aligned').length,
      bothNotApplicableCount: allRows.filter((row) => row.differenceStatus === 'both_not_applicable').length,
      divergentCount: allRows.filter(
        (row) => row.differenceStatus === 'shadow_only_applicable' || row.differenceStatus === 'legacy_only_applicable'
      ).length,
      expectedImprovementCount: allRows.filter((row) => row.reviewCategory === 'expected_improvement').length,
      potentialRegressionCount: allRows.filter((row) => row.reviewCategory === 'potential_regression').length,
    },
    unresolvedPotentialRegressions: allRows.filter((row) => row.reviewCategory === 'potential_regression'),
    blockedDependencies: [],
    drCoverageImpact: VAT_TREATMENT_CUTOVER_RULE_IDS.map((ruleId) => ({
      ruleId,
      linkedDrCoverage: getValidationDRTargets(ruleId, { includeReferenceOnly: true }).map((target) => ({
        ...target,
        coverageMaturity: getDRCoverageMaturity(target.dr_id),
      })),
    })),
    traceabilityImpactNotes: [
      'No traceability consumer changes in this pass; existing traceability pages and applicability explanations remain on the legacy path.',
      'The vat-treatment cutover only adds a feature-flagged runtime applicability filter for four existing rules.',
      'Linked DR coverage remains unchanged because no new vat-treatment rule IDs or DR mappings are introduced.',
    ],
    exceptionAnalysisImpactNotes: [
      'Exception-analysis behavior remains unchanged while the flag is left at the default legacy value.',
      'When the flag is enabled, only applicability gating for the four existing vat-treatment rules can change; exception IDs, messages, ownership, and routing remain the same.',
      'The cutover preserves the existing per-line validation logic after applicability is admitted, so no new exception forms are introduced.',
    ],
    semanticSensitivityNotes: [
      'Vat-treatment applicability is more semantically sensitive than document-family because a false negative can suppress tax-treatment enforcement on exempt or reverse-charge invoices.',
      'Future flag enablement should require mixed-treatment invoice regression coverage and explicit sign-off that ScenarioContext tax-treatment derivation matches line/header tax signals.',
    ],
    runtimeComparison: buildVatTreatmentRuntimeComparisonReport(corpus),
  };
}

export function buildVatTreatmentRuntimeComparisonReport(
  corpus: RegressionCorpusEntry[] = getCutoverRegressionCorpus()
): VatTreatmentRuntimeComparisonReport {
  const shadowResults = new Map(
    buildVatTreatmentCorpusResults(corpus)
      .flatMap((result) => result.rows.map((row) => [`${result.entryId}:${row.ruleId}`, row] as const))
  );

  const rows = corpus.flatMap((entry) => {
    const data = toDataContext(entry);
    return VAT_TREATMENT_CUTOVER_RULE_IDS.map((ruleId) => {
      const check = requireCheck(ruleId);
      const legacy = runPintAECheckWithTelemetry(check, data, {
        vatTreatmentApplicabilityMode: VAT_TREATMENT_APPLICABILITY_LEGACY_MODE,
      });
      const scenario = runPintAECheckWithTelemetry(check, data, {
        vatTreatmentApplicabilityMode: VAT_TREATMENT_APPLICABILITY_SCENARIO_MODE,
      });
      const shadowRow = shadowResults.get(`${entry.id}:${ruleId}`);

      return buildRuntimeComparisonRow(entry, check, legacy, scenario, shadowRow);
    });
  });

  return {
    corpusSize: corpus.length,
    rows,
    summary: {
      totalComparisons: rows.length,
      parityCount: rows.filter((row) => row.differenceClassification === 'runtime_parity').length,
      justifiedImprovementCount: rows.filter((row) => row.differenceClassification === 'justified_improvement').length,
      potentialRegressionCount: rows.filter((row) => row.differenceClassification === 'potential_regression').length,
      authoritativeOutputDifferenceCount: rows.filter((row) => row.authoritativeOutputDifference).length,
    },
    rollback: {
      flag: VAT_TREATMENT_APPLICABILITY_FLAG,
      legacyValue: VAT_TREATMENT_APPLICABILITY_LEGACY_MODE,
      scenarioValue: VAT_TREATMENT_APPLICABILITY_SCENARIO_MODE,
      defaultValue: VAT_TREATMENT_APPLICABILITY_LEGACY_MODE,
    },
  };
}

function buildVatTreatmentCorpusResults(corpus: RegressionCorpusEntry[]): VatTreatmentCorpusResult[] {
  const reports = buildRuleApplicabilityComparisons(corpus.map(toParityLikeFixture));
  return reports.map((report) => ({
    entryId: report.fixtureId,
    description: report.description,
    source: requireCorpusEntry(corpus, report.fixtureId).source,
    rows: report.rows.filter((row) => VAT_TREATMENT_RULE_ID_SET.has(row.ruleId)),
  }));
}

function buildRuleProposal(ruleId: string): VatTreatmentRuleProposal {
  const check = requireCheck(ruleId);
  return {
    ruleId,
    title: check.check_name,
    linkedDrIds: getValidationDRTargets(ruleId, { includeReferenceOnly: true }).map((target) => target.dr_id),
    legacyApplicabilityInputs: ['tax_category_code'],
    shadowApplicabilityAttributes: ['vatTreatments'],
  };
}

function buildRuntimeComparisonRow(
  entry: RegressionCorpusEntry,
  check: PintAECheck,
  legacy: ReturnType<typeof runPintAECheckWithTelemetry>,
  scenario: ReturnType<typeof runPintAECheckWithTelemetry>,
  shadowRow?: RuleApplicabilityComparisonRow
): VatTreatmentRuntimeComparisonRow {
  const legacyOutput = normalizeExceptions(legacy.exceptions);
  const scenarioOutput = normalizeExceptions(scenario.exceptions);
  const authoritativeOutputDifference = JSON.stringify(legacyOutput) !== JSON.stringify(scenarioOutput);

  let differenceClassification: VatTreatmentRuntimeComparisonRow['differenceClassification'] = 'runtime_parity';
  let justification = 'Legacy and ScenarioContext-driven runtime outputs are identical for this rule and corpus entry.';

  if (authoritativeOutputDifference) {
    if (shadowRow?.reviewCategory === 'expected_improvement') {
      differenceClassification = 'justified_improvement';
      justification = shadowRow.divergenceReason ?? 'ScenarioContext shadow applicability narrowed or widened the rule as an expected improvement.';
    } else {
      differenceClassification = 'potential_regression';
      justification = shadowRow?.divergenceReason ?? 'Authoritative runtime output changed without a matching expected-improvement shadow disposition.';
    }
  } else if (legacy.telemetry.execution_count !== scenario.telemetry.execution_count) {
    if (shadowRow?.reviewCategory === 'expected_improvement') {
      differenceClassification = 'justified_improvement';
      justification = shadowRow.divergenceReason ?? 'Applicability execution scope changed in line with the shadow expected-improvement result.';
    } else {
      differenceClassification = 'potential_regression';
      justification = shadowRow?.divergenceReason ?? 'Execution scope changed even though exception output stayed the same.';
    }
  }

  return {
    entryId: entry.id,
    description: entry.description,
    source: entry.source,
    ruleId: check.check_id,
    title: check.check_name,
    legacyExecutionCount: legacy.telemetry.execution_count,
    scenarioExecutionCount: scenario.telemetry.execution_count,
    legacyFailureCount: legacy.telemetry.failure_count,
    scenarioFailureCount: scenario.telemetry.failure_count,
    authoritativeOutputDifference,
    differenceClassification,
    justification,
  };
}

function normalizeExceptions(exceptions: PintAEException[]) {
  return exceptions
    .map((exception) => ({
      check_id: exception.check_id,
      invoice_id: exception.invoice_id ?? null,
      buyer_id: exception.buyer_id ?? null,
      line_id: exception.line_id ?? null,
      field_name: exception.field_name ?? null,
      observed_value: exception.observed_value ?? null,
      expected_value_or_rule: exception.expected_value_or_rule ?? null,
      message: exception.message,
      severity: exception.severity,
      scope: exception.scope,
    }))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

function toDataContext(entry: RegressionCorpusEntry): DataContext {
  const header = entry.input.header as InvoiceHeader;
  const lines = (entry.input.lines ?? []) as InvoiceLine[];
  const buyer = entry.input.buyer ? (entry.input.buyer as Buyer) : null;
  const buyers = buyer ? [buyer] : [];
  const linesByInvoice = new Map<string, InvoiceLine[]>();

  lines.forEach((line) => {
    const invoiceLines = linesByInvoice.get(line.invoice_id) ?? [];
    invoiceLines.push(line);
    linesByInvoice.set(line.invoice_id, invoiceLines);
  });

  return {
    buyers,
    headers: [header],
    lines,
    buyerMap: new Map(buyers.map((candidate) => [candidate.buyer_id, candidate])),
    headerMap: new Map([[header.invoice_id, header]]),
    linesByInvoice,
  };
}

function requireCheck(ruleId: string): PintAECheck {
  const check = CHECKS_BY_ID.get(ruleId);
  if (!check) {
    throw new Error(`Missing vat-treatment cutover check definition for ${ruleId}`);
  }
  return check;
}

function requireCorpusEntry(corpus: RegressionCorpusEntry[], entryId: string): RegressionCorpusEntry {
  const entry = corpus.find((candidate) => candidate.id === entryId);
  if (!entry) {
    throw new Error(`Missing regression corpus entry ${entryId}`);
  }
  return entry;
}

function toParityLikeFixture(entry: RegressionCorpusEntry) {
  return {
    id: entry.id,
    description: entry.description,
    input: entry.input,
    expectedContext: {
      documentClass: 'unknown' as const,
      documentVariant: 'unknown' as const,
      transactionFlags: [],
      vatTreatments: [],
      overlays: [],
    },
  };
}
