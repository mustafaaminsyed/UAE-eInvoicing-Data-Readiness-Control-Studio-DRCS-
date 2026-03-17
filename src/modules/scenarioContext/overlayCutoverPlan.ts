import { getValidationDRTargets, type ValidationDRTarget } from '@/lib/registry/validationToDRMap';
import {
  buildCutoverReadinessReport,
  getBlockedGeneratedRuleTargets,
  type BlockedTargetReadiness,
  type CutoverImpactCategory,
} from '@/modules/scenarioContext/cutoverReadiness';
import {
  buildRuleApplicabilityComparisons,
  getShadowApplicabilityDefinitions,
  type RuleApplicabilityComparisonRow,
} from '@/modules/scenarioContext/shadowApplicability';
import {
  getCutoverRegressionCorpus,
  type RegressionCorpusEntry,
} from '@/modules/scenarioContext/regressionCorpus';

export const OVERLAY_CUTOVER_RULE_IDS = [
  'IBR-137-AE',
  'IBR-138-AE',
  'IBR-152-AE',
] as const;

export interface OverlayRuleProposal {
  ruleId: string;
  title: string;
  linkedDrIds: string[];
  legacyPathType: RuleApplicabilityComparisonRow['legacyPathType'];
  scenarioAttributesUsed: RuleApplicabilityComparisonRow['scenarioAttributesUsed'];
}

export interface OverlayDifferenceRow {
  entryId: string;
  description: string;
  source: RegressionCorpusEntry['source'];
  ruleId: string;
  title: string;
  classification: Exclude<CutoverImpactCategory, 'blocked_by_ingestion_gap'>;
  differenceStatus: RuleApplicabilityComparisonRow['differenceStatus'];
  legacyApplicability: RuleApplicabilityComparisonRow['legacyApplicability'];
  shadowApplicability: RuleApplicabilityComparisonRow['shadowApplicability'];
  legacyPathType: RuleApplicabilityComparisonRow['legacyPathType'];
  linkedDrIds: string[];
  divergenceReason: string | null;
  scenarioAttributesUsed: RuleApplicabilityComparisonRow['scenarioAttributesUsed'];
  scenarioEvidence: RuleApplicabilityComparisonRow['scenarioEvidence'];
}

export interface OverlayRuleBlockedDependency {
  ruleId: string;
  blockedTargets: BlockedTargetReadiness[];
  unblockedTargets: ValidationDRTarget[];
}

export interface OverlayCutoverPacket {
  ruleProposals: OverlayRuleProposal[];
  corpusSize: number;
  differenceRows: OverlayDifferenceRow[];
  summary: {
    totalComparisons: number;
    unchanged: number;
    expectedImprovement: number;
    potentialRegression: number;
    policyDecisionNeeded: number;
  };
  blockedDependencyReview: OverlayRuleBlockedDependency[];
  traceabilityImpactNotes: string[];
  exceptionAnalysisImpactNotes: string[];
  approvalNotes: string[];
}

const OVERLAY_RULE_ID_SET = new Set<string>(OVERLAY_CUTOVER_RULE_IDS);

export function buildOverlayCutoverPacket(): OverlayCutoverPacket {
  const corpus = getCutoverRegressionCorpus();
  const comparisons = buildRuleApplicabilityComparisons(corpus.map(toParityLikeFixture));
  const blockedTargets = getBlockedGeneratedRuleTargets();
  const blockedByRule = new Map<string, BlockedTargetReadiness[]>();
  blockedTargets.forEach((target) => {
    target.affectedRuleIds.forEach((ruleId) => {
      const rows = blockedByRule.get(ruleId) ?? [];
      rows.push(target);
      blockedByRule.set(ruleId, rows);
    });
  });

  const differenceRows = comparisons.flatMap((report) =>
    report.rows
      .filter((row) => OVERLAY_RULE_ID_SET.has(row.ruleId))
      .map((row) => ({
        entryId: report.fixtureId,
        description: report.description,
        source: requireCorpusEntry(corpus, report.fixtureId).source,
        ruleId: row.ruleId,
        title: row.title,
        classification: classifyOverlayDifference(row),
        differenceStatus: row.differenceStatus,
        legacyApplicability: row.legacyApplicability,
        shadowApplicability: row.shadowApplicability,
        legacyPathType: row.legacyPathType,
        linkedDrIds: row.linkedDrIds,
        divergenceReason: row.divergenceReason,
        scenarioAttributesUsed: row.scenarioAttributesUsed,
        scenarioEvidence: row.scenarioEvidence,
      }))
  );

  return {
    ruleProposals: buildOverlayRuleProposals(comparisons),
    corpusSize: corpus.length,
    differenceRows,
    summary: {
      totalComparisons: differenceRows.length,
      unchanged: differenceRows.filter((row) => row.classification === 'unchanged').length,
      expectedImprovement: differenceRows.filter((row) => row.classification === 'expected_improvement').length,
      potentialRegression: differenceRows.filter((row) => row.classification === 'potential_regression').length,
      policyDecisionNeeded: differenceRows.filter((row) => row.classification === 'policy_decision_needed').length,
    },
    blockedDependencyReview: OVERLAY_CUTOVER_RULE_IDS.map((ruleId) => ({
      ruleId,
      blockedTargets: blockedByRule.get(ruleId) ?? [],
      unblockedTargets: getValidationDRTargets(ruleId, { includeReferenceOnly: true }).filter(
        (target) => !(blockedByRule.get(ruleId) ?? []).some((blocked) => blocked.drId === target.dr_id)
      ),
    })),
    traceabilityImpactNotes: [
      'No traceability behavior changes are proposed in this pass; overlay applicability remains a cutover-readiness packet only.',
      'Overlay provenance should be carried through unchanged from ScenarioContext evidence before any authoritative path is approved.',
    ],
    exceptionAnalysisImpactNotes: [
      'No exception-analysis behavior changes are proposed in this pass because no authoritative overlay execution path is introduced.',
      'Any future overlay cutover should preserve the current case attribution model until generated-rule targets become ingestible and explainable.',
    ],
    approvalNotes: [
      'Overlay rules are likely to produce justified authoritative differences rather than strict parity because the legacy path is heuristic and the shadow path is explicit about transaction flags.',
      'Before cutover, each expected-improvement overlay rule should receive policy approval tied to the generated-rule source, linked DRs, and regression evidence on representative overlay fixtures.',
      'No overlay rule should move to runtime authority until its blocked DR targets are ingestible and the traceability/explainability path can render the same provenance shown in this packet.',
    ],
  };
}

export function buildOverlayFamilyImpactSummary() {
  const readiness = buildCutoverReadinessReport();
  return readiness.familyImpact.find((family) => family.family === 'overlay') ?? null;
}

function buildOverlayRuleProposals(
  comparisons: ReturnType<typeof buildRuleApplicabilityComparisons>
): OverlayRuleProposal[] {
  return OVERLAY_CUTOVER_RULE_IDS.map((ruleId) => {
    const row = comparisons.flatMap((report) => report.rows).find((candidate) => candidate.ruleId === ruleId);
    const definition = getShadowApplicabilityDefinitions().find((candidate) => candidate.ruleId === ruleId);
    if (!row || !definition) {
      throw new Error(`Missing overlay applicability definition for ${ruleId}`);
    }

    return {
      ruleId,
      title: row.title,
      linkedDrIds: definition.linkedDrIds,
      legacyPathType: row.legacyPathType,
      scenarioAttributesUsed: row.scenarioAttributesUsed,
    };
  });
}

function classifyOverlayDifference(
  row: RuleApplicabilityComparisonRow
): Exclude<CutoverImpactCategory, 'blocked_by_ingestion_gap'> {
  if (row.reviewCategory === 'potential_regression') {
    return 'potential_regression';
  }
  if (row.reviewCategory === 'policy_review') {
    return 'policy_decision_needed';
  }
  if (row.reviewCategory === 'expected_improvement') {
    return 'expected_improvement';
  }
  return 'unchanged';
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
