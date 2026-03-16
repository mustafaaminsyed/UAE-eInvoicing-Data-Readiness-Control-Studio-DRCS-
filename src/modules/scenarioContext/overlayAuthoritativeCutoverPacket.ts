import { PINT_AE_SCHEMATRON_RULES } from '@/lib/pintAE/generated/schematronRules';
import {
  getDRCoverageMaturity,
  getValidationDRTargets,
  type ValidationDRTarget,
} from '@/lib/registry/validationToDRMap';
import {
  buildOverlayCutoverPacket,
  OVERLAY_CUTOVER_RULE_IDS,
  type OverlayDifferenceRow,
} from '@/modules/scenarioContext/overlayCutoverPlan';

export const OVERLAY_APPLICABILITY_FLAG = 'VITE_OVERLAY_APPLICABILITY_MODE';
export const OVERLAY_APPLICABILITY_SCENARIO_MODE = 'scenario_context';
export const OVERLAY_APPLICABILITY_LEGACY_MODE = 'legacy';

export interface OverlayGeneratedRuleIntent {
  ruleId: string;
  message: string;
  references: string[];
  documentType: string;
  sourceFile: string;
}

export interface OverlayExpectedImprovementDetail {
  entryId: string;
  description: string;
  source: OverlayDifferenceRow['source'];
  legacyPathType: OverlayDifferenceRow['legacyPathType'];
  scenarioContextEvidence: OverlayDifferenceRow['scenarioEvidence'];
  provenanceSummary: string[];
  linkedDrCoverage: Array<
    ValidationDRTarget & {
      coverageMaturity: ReturnType<typeof getDRCoverageMaturity>;
    }
  >;
  generatedRuleIntent: OverlayGeneratedRuleIntent;
  whyPreferable: string;
}

export interface OverlayRuleApprovalPacket {
  ruleId: string;
  title: string;
  linkedDrIds: string[];
  corpusResults: {
    unchanged: OverlayDifferenceRow[];
    expectedImprovement: OverlayDifferenceRow[];
    potentialRegression: OverlayDifferenceRow[];
  };
  linkedDrCoverage: Array<
    ValidationDRTarget & {
      coverageMaturity: ReturnType<typeof getDRCoverageMaturity>;
    }
  >;
  generatedRuleIntent: OverlayGeneratedRuleIntent;
  expectedImprovementDetails: OverlayExpectedImprovementDetail[];
  blockedDependenciesRemaining: string[];
}

export interface OverlayRuntimeCutoverDesign {
  flag: string;
  defaultMode: typeof OVERLAY_APPLICABILITY_LEGACY_MODE;
  proposedScenarioMode: typeof OVERLAY_APPLICABILITY_SCENARIO_MODE;
  eligibleRuleIds: string[];
  isolationBoundary: string;
  runtimeBehaviorIfEnabled: string;
  rollback: {
    action: string;
    expectedEffect: string;
  };
  guardrails: string[];
}

export interface OverlayAuthoritativeCutoverPacket {
  rulePackets: OverlayRuleApprovalPacket[];
  corpusSummary: {
    totalComparisons: number;
    unchanged: number;
    expectedImprovement: number;
    potentialRegression: number;
  };
  zeroBlockedDependencies: boolean;
  traceabilityImpactNotes: string[];
  exceptionAnalysisImpactNotes: string[];
  runtimeCutoverDesign: OverlayRuntimeCutoverDesign;
}

const GENERATED_RULE_BY_ID = new Map(
  PINT_AE_SCHEMATRON_RULES.map((rule) => [String(rule.id).toUpperCase(), rule])
);

export function buildOverlayAuthoritativeCutoverPacket(): OverlayAuthoritativeCutoverPacket {
  const packet = buildOverlayCutoverPacket();
  const rulePackets = OVERLAY_CUTOVER_RULE_IDS.map((ruleId) => buildRuleApprovalPacket(ruleId, packet.differenceRows, packet));

  return {
    rulePackets,
    corpusSummary: {
      totalComparisons: packet.summary.totalComparisons,
      unchanged: packet.summary.unchanged,
      expectedImprovement: packet.summary.expectedImprovement,
      potentialRegression: packet.summary.potentialRegression,
    },
    zeroBlockedDependencies: packet.blockedDependencyReview.every((entry) => entry.blockedTargets.length === 0),
    traceabilityImpactNotes: [
      'No traceability behavior changes are proposed in this pass; the approval packet only documents evidence for a future family-isolated overlay cutover.',
      ...packet.traceabilityImpactNotes,
    ],
    exceptionAnalysisImpactNotes: [
      'No exception-analysis behavior changes are proposed in this pass; overlay execution remains non-authoritative.',
      ...packet.exceptionAnalysisImpactNotes,
    ],
    runtimeCutoverDesign: buildRuntimeCutoverDesign(),
  };
}

function buildRuleApprovalPacket(
  ruleId: string,
  rows: OverlayDifferenceRow[],
  packet: ReturnType<typeof buildOverlayCutoverPacket>
): OverlayRuleApprovalPacket {
  const ruleRows = rows.filter((row) => row.ruleId === ruleId);
  const blockedDependencies = packet.blockedDependencyReview.find((entry) => entry.ruleId === ruleId)?.blockedTargets ?? [];
  const linkedDrCoverage = getValidationDRTargets(ruleId, { includeReferenceOnly: true }).map((target) => ({
    ...target,
    coverageMaturity: getDRCoverageMaturity(target.dr_id),
  }));
  const generatedRuleIntent = getGeneratedRuleIntent(ruleId);

  return {
    ruleId,
    title: ruleRows[0]?.title ?? ruleId,
    linkedDrIds: linkedDrCoverage.map((target) => target.dr_id),
    corpusResults: {
      unchanged: ruleRows.filter((row) => row.classification === 'unchanged'),
      expectedImprovement: ruleRows.filter((row) => row.classification === 'expected_improvement'),
      potentialRegression: ruleRows.filter((row) => row.classification === 'potential_regression'),
    },
    linkedDrCoverage,
    generatedRuleIntent,
    expectedImprovementDetails: ruleRows
      .filter((row) => row.classification === 'expected_improvement')
      .map((row) => buildExpectedImprovementDetail(row, linkedDrCoverage, generatedRuleIntent)),
    blockedDependenciesRemaining: blockedDependencies.map((entry) => entry.drId),
  };
}

function buildExpectedImprovementDetail(
  row: OverlayDifferenceRow,
  linkedDrCoverage: Array<
    ValidationDRTarget & {
      coverageMaturity: ReturnType<typeof getDRCoverageMaturity>;
    }
  >,
  generatedRuleIntent: OverlayGeneratedRuleIntent
): OverlayExpectedImprovementDetail {
  return {
    entryId: row.entryId,
    description: row.description,
    source: row.source,
    legacyPathType: row.legacyPathType,
    scenarioContextEvidence: row.scenarioEvidence,
    provenanceSummary: row.scenarioEvidence.map(
      (evidence) => `${evidence.source}:${evidence.field}=${String(evidence.value)}`
    ),
    linkedDrCoverage,
    generatedRuleIntent,
    whyPreferable: getExpectedImprovementRationale(row.ruleId),
  };
}

function getGeneratedRuleIntent(ruleId: string): OverlayGeneratedRuleIntent {
  const schematronRule = GENERATED_RULE_BY_ID.get(ruleId.toUpperCase());
  if (!schematronRule) {
    throw new Error(`Missing generated UAE rule intent for ${ruleId}`);
  }

  return {
    ruleId,
    message: String(schematronRule.message),
    references: Array.isArray(schematronRule.references)
      ? schematronRule.references.map((reference) => String(reference))
      : [],
    documentType: String(schematronRule.documentType ?? ''),
    sourceFile: String(schematronRule.sourceFile ?? ''),
  };
}

function getExpectedImprovementRationale(ruleId: string): string {
  switch (ruleId) {
    case 'IBR-137-AE':
      return 'The new result is preferable because disclosed-agent applicability is derived from governed transaction flags with direct provenance from BTUAE-02, rather than from a best-effort business-scenario heuristic.';
    case 'IBR-138-AE':
      return 'The new result is preferable because summary-invoice applicability should follow the invoice transaction flag directly; the heuristic legacy path can miss summary invoices when explicit booleans are absent.';
    case 'IBR-152-AE':
      return 'The new result is preferable because export delivery-information applicability is driven by the export transaction flag and its field dependencies, while the heuristic legacy path infers export indirectly from VAT treatment and can miss explicit export signaling.';
    default:
      return 'The new result is preferable because ScenarioContext uses governed scenario derivation with provenance instead of heuristic legacy inference.';
  }
}

function buildRuntimeCutoverDesign(): OverlayRuntimeCutoverDesign {
  return {
    flag: OVERLAY_APPLICABILITY_FLAG,
    defaultMode: OVERLAY_APPLICABILITY_LEGACY_MODE,
    proposedScenarioMode: OVERLAY_APPLICABILITY_SCENARIO_MODE,
    eligibleRuleIds: [...OVERLAY_CUTOVER_RULE_IDS],
    isolationBoundary:
      'Scope the cutover to overlay-family applicability only. Do not alter rule bodies, UI scenario rendering, traceability rendering, or exception attribution.',
    runtimeBehaviorIfEnabled:
      'When enabled, only IBR-137-AE, IBR-138-AE, and IBR-152-AE would use ScenarioContext-based applicability gating. All other families would continue using current behavior.',
    rollback: {
      action: `Set ${OVERLAY_APPLICABILITY_FLAG}=${OVERLAY_APPLICABILITY_LEGACY_MODE}.`,
      expectedEffect:
        'Overlay applicability reverts immediately to legacy behavior without changing rule identifiers, exception schemas, or non-overlay rule execution.',
    },
    guardrails: [
      'Keep the flag defaulted to legacy until approval is granted for all expected-improvement rows.',
      'Require zero unresolved potential regressions on the approved corpus before enablement.',
      'Enable only for the three overlay rules; do not bundle transaction-flag or credit-note rule families into the same release.',
    ],
  };
}
