import { getDREntry, isDRIngestible } from "@/lib/registry/drRegistry";
import {
  buildRuleApplicabilityComparisons,
  getShadowApplicabilityDefinitions,
  type ApplicabilityRuleFamily,
  type DifferenceStatus,
  type LegacyApplicabilityPath,
  type RuleApplicabilityComparisonReport,
  type RuleApplicabilityComparisonRow,
} from "@/modules/scenarioContext/shadowApplicability";
import {
  getCutoverRegressionCorpus,
  type RegressionCorpusEntry,
} from "@/modules/scenarioContext/regressionCorpus";

export type CutoverImpactCategory =
  | "unchanged"
  | "expected_improvement"
  | "potential_regression"
  | "policy_decision_needed"
  | "blocked_by_ingestion_gap";

export interface BlockedTargetReadiness {
  drId: string;
  affectedRuleIds: string[];
  blockerType: "missing_registry" | "not_ingestible";
  reason: string;
  requiredChanges: string[];
}

export interface RuleCutoverImpact {
  ruleId: string;
  title: string;
  family: ApplicabilityRuleFamily;
  source: "runtime_check" | "shadow_only";
  category: CutoverImpactCategory;
  legacyPathTypes: LegacyApplicabilityPath[];
  differenceStatuses: DifferenceStatus[];
  linkedDrIds: string[];
  blockedTargets: string[];
}

export interface RuleFamilyImpactSummary {
  family: ApplicabilityRuleFamily;
  counts: Record<CutoverImpactCategory, number>;
  rulesByCategory: Record<CutoverImpactCategory, string[]>;
}

export interface CutoverPhaseRecommendation {
  order: number;
  family: ApplicabilityRuleFamily;
  readiness: "safest" | "safer" | "moderate" | "high_risk" | "riskiest";
  rationale: string;
}

export interface CutoverGate {
  gateId: string;
  description: string;
  acceptanceCriteria: string[];
}

export interface CutoverReadinessReport {
  corpus: RegressionCorpusEntry[];
  comparisons: RuleApplicabilityComparisonReport[];
  ruleImpacts: RuleCutoverImpact[];
  familyImpact: RuleFamilyImpactSummary[];
  blockedTargets: BlockedTargetReadiness[];
  phasedCutover: CutoverPhaseRecommendation[];
  cutoverGates: CutoverGate[];
}

const CUTOVER_IMPACT_CATEGORIES: CutoverImpactCategory[] = [
  "unchanged",
  "expected_improvement",
  "potential_regression",
  "policy_decision_needed",
  "blocked_by_ingestion_gap",
];

export function buildCutoverReadinessReport(): CutoverReadinessReport {
  const corpus = getCutoverRegressionCorpus();
  const comparisons = buildRuleApplicabilityComparisons(corpus.map(toParityLikeFixture));
  const blockedTargets = getBlockedGeneratedRuleTargets();
  const ruleImpacts = buildRuleCutoverImpacts(comparisons, blockedTargets);
  const familyImpact = buildFamilyImpactSummary(ruleImpacts);

  return {
    corpus,
    comparisons,
    ruleImpacts,
    familyImpact,
    blockedTargets,
    phasedCutover: buildPhasedCutoverRecommendations(ruleImpacts),
    cutoverGates: buildCutoverGates(blockedTargets),
  };
}

export function getBlockedGeneratedRuleTargets(): BlockedTargetReadiness[] {
  const shadowOnlyDefinitions = getShadowApplicabilityDefinitions().filter(
    (definition) => definition.source === "shadow_only"
  );
  const blockedMap = new Map<string, BlockedTargetReadiness>();

  shadowOnlyDefinitions.forEach((definition) => {
    definition.linkedDrIds.forEach((drId) => {
      const entry = getDREntry(drId);
      const blocker = getBlockedTarget(drId, definition.ruleId, entry);
      if (!blocker) return;

      const existing = blockedMap.get(drId);
      if (existing) {
        existing.affectedRuleIds = Array.from(new Set([...existing.affectedRuleIds, definition.ruleId]));
        return;
      }
      blockedMap.set(drId, blocker);
    });
  });

  return Array.from(blockedMap.values()).sort((left, right) => left.drId.localeCompare(right.drId));
}

function buildRuleCutoverImpacts(
  comparisons: RuleApplicabilityComparisonReport[],
  blockedTargets: BlockedTargetReadiness[]
): RuleCutoverImpact[] {
  const blockedTargetMap = new Map<string, string[]>();
  blockedTargets.forEach((target) => {
    target.affectedRuleIds.forEach((ruleId) => {
      const blocked = blockedTargetMap.get(ruleId) ?? [];
      blocked.push(target.drId);
      blockedTargetMap.set(ruleId, blocked);
    });
  });

  const rowsByRule = new Map<string, RuleApplicabilityComparisonRow[]>();
  comparisons.forEach((report) => {
    report.rows.forEach((row) => {
      const existing = rowsByRule.get(row.ruleId) ?? [];
      existing.push(row);
      rowsByRule.set(row.ruleId, existing);
    });
  });

  return Array.from(rowsByRule.entries()).map(([ruleId, rows]) => {
    const exemplar = rows[0];
    const blocked = Array.from(new Set(blockedTargetMap.get(ruleId) ?? []));
    return {
      ruleId,
      title: exemplar.title,
      family: exemplar.family,
      source: exemplar.source,
      category: deriveCutoverImpactCategory(rows, blocked),
      legacyPathTypes: Array.from(new Set(rows.map((row) => row.legacyPathType))),
      differenceStatuses: Array.from(new Set(rows.map((row) => row.differenceStatus))),
      linkedDrIds: Array.from(new Set(rows.flatMap((row) => row.linkedDrIds))),
      blockedTargets: blocked,
    };
  });
}

function deriveCutoverImpactCategory(
  rows: RuleApplicabilityComparisonRow[],
  blockedTargets: string[]
): CutoverImpactCategory {
  if (blockedTargets.length > 0) {
    return "blocked_by_ingestion_gap";
  }
  if (rows.some((row) => row.reviewCategory === "potential_regression")) {
    return "potential_regression";
  }
  if (
    rows.some(
      (row) =>
        row.differenceStatus === "legacy_only_applicable" && row.legacyPathType === "explicit"
    )
  ) {
    return "policy_decision_needed";
  }
  if (rows.some((row) => row.reviewCategory === "policy_review")) {
    return "policy_decision_needed";
  }
  if (rows.some((row) => row.reviewCategory === "expected_improvement")) {
    return "expected_improvement";
  }
  return "unchanged";
}

function buildFamilyImpactSummary(ruleImpacts: RuleCutoverImpact[]): RuleFamilyImpactSummary[] {
  const families = Array.from(new Set(ruleImpacts.map((impact) => impact.family)));

  return families.map((family) => {
    const rules = ruleImpacts.filter((impact) => impact.family === family);
    const counts = Object.fromEntries(CUTOVER_IMPACT_CATEGORIES.map((category) => [category, 0])) as Record<
      CutoverImpactCategory,
      number
    >;
    const rulesByCategory = Object.fromEntries(
      CUTOVER_IMPACT_CATEGORIES.map((category) => [category, []])
    ) as Record<CutoverImpactCategory, string[]>;

    rules.forEach((rule) => {
      counts[rule.category] += 1;
      rulesByCategory[rule.category].push(rule.ruleId);
    });

    return { family, counts, rulesByCategory };
  });
}

function buildPhasedCutoverRecommendations(
  ruleImpacts: RuleCutoverImpact[]
): CutoverPhaseRecommendation[] {
  const impactByFamily = new Map<ApplicabilityRuleFamily, RuleCutoverImpact[]>();
  ruleImpacts.forEach((impact) => {
    const existing = impactByFamily.get(impact.family) ?? [];
    existing.push(impact);
    impactByFamily.set(impact.family, existing);
  });

  return [
    {
      order: 1,
      family: "document_family",
      readiness: "safest",
      rationale: describeFamilyReadiness(impactByFamily.get("document_family") ?? []),
    },
    {
      order: 2,
      family: "vat_treatment",
      readiness: "safer",
      rationale: describeFamilyReadiness(impactByFamily.get("vat_treatment") ?? []),
    },
    {
      order: 3,
      family: "overlay",
      readiness: "moderate",
      rationale: describeFamilyReadiness(impactByFamily.get("overlay") ?? []),
    },
    {
      order: 4,
      family: "transaction_flag",
      readiness: "high_risk",
      rationale: describeFamilyReadiness(impactByFamily.get("transaction_flag") ?? []),
    },
    {
      order: 5,
      family: "credit_note_specialized",
      readiness: "riskiest",
      rationale: describeFamilyReadiness(impactByFamily.get("credit_note_specialized") ?? []),
    },
  ];
}

function describeFamilyReadiness(ruleImpacts: RuleCutoverImpact[]): string {
  const counts = summarizeImpactCounts(ruleImpacts);
  return `unchanged=${counts.unchanged}, expected_improvement=${counts.expected_improvement}, policy_decision_needed=${counts.policy_decision_needed}, blocked=${counts.blocked_by_ingestion_gap}`;
}

function summarizeImpactCounts(
  impacts: RuleCutoverImpact[]
): Record<CutoverImpactCategory, number> {
  const counts = Object.fromEntries(CUTOVER_IMPACT_CATEGORIES.map((category) => [category, 0])) as Record<
    CutoverImpactCategory,
    number
  >;
  impacts.forEach((impact) => {
    counts[impact.category] += 1;
  });
  return counts;
}

function buildCutoverGates(blockedTargets: BlockedTargetReadiness[]): CutoverGate[] {
  return [
    {
      gateId: "gate-shadow-regression",
      description: "Broader shadow corpus must remain stable before any authoritative family cutover.",
      acceptanceCriteria: [
        "No comparison row is classified as potential_regression on the approved regression corpus.",
        "Expected-improvement and policy-decision rows are explicitly reviewed and signed off per rule family.",
      ],
    },
    {
      gateId: "gate-authoritative-narrowing-approval",
      description: "Any shadow rule that narrows an existing explicit runtime check requires policy approval before cutover.",
      acceptanceCriteria: [
        "Every legacy_only_applicable row driven by an explicit legacy path has a documented disposition.",
        "Approved narrowing rules are traced back to source generated-rule references and linked DRs.",
      ],
    },
    {
      gateId: "gate-ingestion-coverage",
      description: "Generated-rule targets blocked by ingestion or canonical-model gaps must be modeled before enforcement.",
      acceptanceCriteria: [
        `Blocked target count reduced to zero for the family being cut over. Current blocked targets: ${blockedTargets.map((target) => target.drId).join(", ") || "none"}.`,
        "Parser, typed canonical model, and DR registry all support the required fields/groups for the cutover family.",
      ],
    },
    {
      gateId: "gate-traceability-parity",
      description: "Applicability explanations must match runtime behavior before cutover.",
      acceptanceCriteria: [
        "Traceability and exception-analysis consumers can explain the same applicability decision the authoritative engine will use.",
        "ScenarioContext evidence for the cutover family is available and stable in non-shadow telemetry.",
      ],
    },
  ];
}

function getBlockedTarget(
  drId: string,
  ruleId: string,
  entry: ReturnType<typeof getDREntry>
): BlockedTargetReadiness | null {
  if (!entry) {
    return {
      drId,
      affectedRuleIds: [ruleId],
      blockerType: "missing_registry",
      reason: "No DR registry entry exists, so there is no authoritative parser/canonical-model bridge.",
      requiredChanges: [
        "Add a DR registry entry and crosswalk metadata for the target.",
        "Add typed canonical-model support and parser/template mappings for the target.",
        "Thread the target through traceability and validation mapping once authoritative.",
      ],
    };
  }

  if (!isDRIngestible(entry)) {
    return {
      drId,
      affectedRuleIds: [ruleId],
      blockerType: "not_ingestible",
      reason: "The DR exists, but its columns are not fully ingestible by the current parser/canonical model.",
      requiredChanges: [
        "Extend typed canonical-model fields for the target columns.",
        "Update csvParser and shipped templates so the target becomes ingestible.",
        "Backfill validation-to-DR coverage once the target is parseable.",
      ],
    };
  }

  return null;
}

function toParityLikeFixture(entry: RegressionCorpusEntry) {
  return {
    id: entry.id,
    description: entry.description,
    input: entry.input,
    expectedContext: {
      documentClass: "unknown" as const,
      documentVariant: "unknown" as const,
      transactionFlags: [],
      vatTreatments: [],
      overlays: [],
    },
  };
}
