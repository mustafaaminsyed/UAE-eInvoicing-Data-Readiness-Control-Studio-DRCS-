import { OVERLAY_RUNTIME_CHECKS, OVERLAY_RUNTIME_RULE_IDS } from '@/lib/checks/overlayRuntimeChecks';
import { runPintAECheckWithTelemetry } from '@/lib/checks/pintAECheckRunner';
import UAE_UC1_CHECK_PACK from '@/lib/checks/uaeUC1CheckPack';
import { buildOverlayAuthoritativeCutoverPacket } from '@/modules/scenarioContext/overlayAuthoritativeCutoverPacket';
import { getCutoverRegressionCorpus, type RegressionCorpusEntry } from '@/modules/scenarioContext/regressionCorpus';
import type { Buyer, DataContext, InvoiceHeader, InvoiceLine } from '@/types/compliance';
import type { PintAECheck, PintAEException } from '@/types/pintAE';

export const OVERLAY_APPLICABILITY_FLAG = 'VITE_OVERLAY_APPLICABILITY_MODE';
export const OVERLAY_APPLICABILITY_LEGACY_MODE = 'legacy';
export const OVERLAY_APPLICABILITY_SCENARIO_MODE = 'scenario_context';

export interface OverlayRuntimeComparisonRow {
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
  differenceClassification: 'runtime_parity' | 'approved_expected_improvement' | 'potential_regression';
  justification: string;
}

export interface OverlayCollateralImpact {
  totalComparisons: number;
  changedRows: Array<{
    entryId: string;
    ruleId: string;
  }>;
}

export interface OverlayRuntimeCutoverReport {
  rows: OverlayRuntimeComparisonRow[];
  summary: {
    corpusSize: number;
    totalComparisons: number;
    parityCount: number;
    approvedExpectedImprovementCount: number;
    potentialRegressionCount: number;
    authoritativeOutputDifferenceCount: number;
  };
  approvedExpectedImprovementRows: string[];
  observedDifferenceRows: string[];
  blockedDependenciesRemaining: string[];
  collateralImpact: OverlayCollateralImpact;
  rollback: {
    flag: typeof OVERLAY_APPLICABILITY_FLAG;
    defaultValue: typeof OVERLAY_APPLICABILITY_LEGACY_MODE;
    legacyValue: typeof OVERLAY_APPLICABILITY_LEGACY_MODE;
    scenarioValue: typeof OVERLAY_APPLICABILITY_SCENARIO_MODE;
  };
}

export function buildOverlayRuntimeCutoverReport(
  corpus: RegressionCorpusEntry[] = getCutoverRegressionCorpus()
): OverlayRuntimeCutoverReport {
  const packet = buildOverlayAuthoritativeCutoverPacket();
  const approvedExpectedImprovementRows = packet.rulePackets.flatMap((rule) =>
    rule.expectedImprovementDetails.map((detail) => `${detail.entryId}:${rule.ruleId}`)
  );
  const approvedExpectedImprovementSet = new Set(approvedExpectedImprovementRows);

  const rows = corpus.flatMap((entry) => {
    const data = toDataContext(entry);
    return OVERLAY_RUNTIME_CHECKS.map((check) => {
      const legacy = runPintAECheckWithTelemetry(check, data, {
        overlayApplicabilityMode: OVERLAY_APPLICABILITY_LEGACY_MODE,
      });
      const scenario = runPintAECheckWithTelemetry(check, data, {
        overlayApplicabilityMode: OVERLAY_APPLICABILITY_SCENARIO_MODE,
      });

      return buildRuntimeComparisonRow(entry, check, legacy, scenario, approvedExpectedImprovementSet);
    });
  });

  const observedDifferenceRows = rows
    .filter((row) => row.differenceClassification !== 'runtime_parity')
    .map((row) => `${row.entryId}:${row.ruleId}`);

  return {
    rows,
    summary: {
      corpusSize: corpus.length,
      totalComparisons: rows.length,
      parityCount: rows.filter((row) => row.differenceClassification === 'runtime_parity').length,
      approvedExpectedImprovementCount: rows.filter(
        (row) => row.differenceClassification === 'approved_expected_improvement'
      ).length,
      potentialRegressionCount: rows.filter((row) => row.differenceClassification === 'potential_regression').length,
      authoritativeOutputDifferenceCount: rows.filter((row) => row.authoritativeOutputDifference).length,
    },
    approvedExpectedImprovementRows: approvedExpectedImprovementRows.sort(),
    observedDifferenceRows: observedDifferenceRows.sort(),
    blockedDependenciesRemaining: packet.rulePackets.flatMap((rule) => rule.blockedDependenciesRemaining),
    collateralImpact: buildCollateralImpact(corpus),
    rollback: {
      flag: OVERLAY_APPLICABILITY_FLAG,
      defaultValue: OVERLAY_APPLICABILITY_LEGACY_MODE,
      legacyValue: OVERLAY_APPLICABILITY_LEGACY_MODE,
      scenarioValue: OVERLAY_APPLICABILITY_SCENARIO_MODE,
    },
  };
}

function buildRuntimeComparisonRow(
  entry: RegressionCorpusEntry,
  check: PintAECheck,
  legacy: ReturnType<typeof runPintAECheckWithTelemetry>,
  scenario: ReturnType<typeof runPintAECheckWithTelemetry>,
  approvedExpectedImprovementSet: Set<string>
): OverlayRuntimeComparisonRow {
  const rowKey = `${entry.id}:${check.check_id}`;
  const legacyOutput = normalizeExceptions(legacy.exceptions);
  const scenarioOutput = normalizeExceptions(scenario.exceptions);
  const authoritativeOutputDifference = JSON.stringify(legacyOutput) !== JSON.stringify(scenarioOutput);
  const executionDifference = legacy.telemetry.execution_count !== scenario.telemetry.execution_count;

  if (!authoritativeOutputDifference && !executionDifference) {
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
      authoritativeOutputDifference: false,
      differenceClassification: 'runtime_parity',
      justification: 'Legacy and ScenarioContext-driven overlay execution are identical for this corpus row.',
    };
  }

  if (approvedExpectedImprovementSet.has(rowKey)) {
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
      differenceClassification: 'approved_expected_improvement',
      justification:
        'ScenarioContext-driven overlay applicability changes this runtime row in a way that was explicitly approved in the overlay cutover packet.',
    };
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
    differenceClassification: 'potential_regression',
    justification:
      'Overlay runtime behavior changed outside the approved expected-improvement set and requires rollback or investigation.',
  };
}

function buildCollateralImpact(corpus: RegressionCorpusEntry[]): OverlayCollateralImpact {
  const changedRows = corpus.flatMap((entry) => {
    const data = toDataContext(entry);
    return UAE_UC1_CHECK_PACK.flatMap((check) => {
      const legacy = runPintAECheckWithTelemetry(check, data, {
        overlayApplicabilityMode: OVERLAY_APPLICABILITY_LEGACY_MODE,
      });
      const scenario = runPintAECheckWithTelemetry(check, data, {
        overlayApplicabilityMode: OVERLAY_APPLICABILITY_SCENARIO_MODE,
      });
      const outputChanged =
        JSON.stringify(normalizeExceptions(legacy.exceptions)) !== JSON.stringify(normalizeExceptions(scenario.exceptions));
      const executionChanged = legacy.telemetry.execution_count !== scenario.telemetry.execution_count;

      if (!outputChanged && !executionChanged) {
        return [];
      }

      return [
        {
          entryId: entry.id,
          ruleId: check.check_id,
        },
      ];
    });
  });

  return {
    totalComparisons: corpus.length * UAE_UC1_CHECK_PACK.length,
    changedRows,
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

export { OVERLAY_RUNTIME_RULE_IDS };
