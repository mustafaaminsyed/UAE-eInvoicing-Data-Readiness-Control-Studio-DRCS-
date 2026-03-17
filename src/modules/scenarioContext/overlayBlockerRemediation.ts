import { getDRRegistry, getDREntry, isDRIngestible } from '@/lib/registry/drRegistry';
import { getRegistryFieldByDR } from '@/lib/registry/specRegistry';
import { getDRRuleTraceability } from '@/lib/registry/specRegistry';
import { getValidationDRTargets, getValidationIdsForDR } from '@/lib/registry/validationToDRMap';
import { getRuleTraceability } from '@/lib/rules/ruleTraceability';
import { getControlsForDR } from '@/lib/registry/controlsRegistry';
import { buildOverlayCutoverPacket, OVERLAY_CUTOVER_RULE_IDS } from '@/modules/scenarioContext/overlayCutoverPlan';

export const OVERLAY_BLOCKED_TARGETS = [
  'BTAE-14',
  'IBG-14',
  'IBG-13',
  'IBT-075',
  'IBT-077',
  'IBT-079',
  'IBT-080',
] as const;

export type OverlayBlockedTargetId = (typeof OVERLAY_BLOCKED_TARGETS)[number];
export type RemediationRiskLevel = 'medium' | 'high' | 'very_high';
export type RemediationNeed =
  | 'authoritative_applicability'
  | 'full_runtime_enforcement'
  | 'traceability_explainability_parity';

export interface BlockerLayerStatus {
  registry: 'complete' | 'incomplete';
  parser: 'complete' | 'incomplete';
  canonicalModel: 'complete' | 'incomplete';
  ingestionPath: 'complete' | 'incomplete';
  traceabilitySupport: 'complete' | 'incomplete';
  ruleToDRLinkage: 'complete' | 'incomplete';
}

export interface OverlayBlockedTargetAssessment {
  target: OverlayBlockedTargetId;
  currentGap: string;
  impactOnOverlayRules: string[];
  layerStatus: BlockerLayerStatus;
  requiredCodeDataModelChanges: string[];
  riskLevel: RemediationRiskLevel;
  suggestedImplementationOrder: number;
  neededFor: RemediationNeed[];
}

export interface OverlayBlockerRemediationMatrix {
  targets: OverlayBlockedTargetAssessment[];
  minimumRemediationSetForCutoverEligibility: string[];
  remediationByNeed: Record<RemediationNeed, string[]>;
}

const TRACEABILITY_DR_IDS = new Set(
  getRuleTraceability().flatMap((entry) => entry.referenced_dr_ids)
);

export function buildOverlayBlockerRemediationMatrix(): OverlayBlockerRemediationMatrix {
  const targets = OVERLAY_BLOCKED_TARGETS.map(assessBlockedTarget);
  const unresolvedTargets = targets.filter((target) =>
    Object.values(target.layerStatus).some((status) => status === 'incomplete')
  );

  return {
    targets,
    minimumRemediationSetForCutoverEligibility:
      unresolvedTargets.length === 0
        ? [
            'The seven overlay plumbing targets are now bridged through registry, parser, canonical model, validation linkage, and runtime-derived traceability support.',
            'Overlay enforcement can move from applicability-only shadow evidence to full cutover readiness once the overlay family packet shows zero unresolved potential regressions and receives policy approval for any expected-improvement differences.',
            'Authoritative rule execution, UI behavior, and exception-analysis behavior should still wait for an explicit overlay cutover approval.',
          ]
        : [
            'For applicability-only cutover eligibility, blocked target remediation is not the primary gate because overlay applicability derives from BTUAE-02; policy approval and rule registration remain separate prerequisites outside this matrix.',
            'For any overlay family cutover that aims to execute the rule bodies, add DR registry/spec bridge entries for all blocked targets first.',
            'Then add canonical model fields, parser support, and validation-to-DR linkage for BTAE-14, IBG-14, IBG-13, IBT-075, IBT-077, IBT-079, and IBT-080.',
            'Only after those bridges exist should traceability/explainability consumers be updated to render the same overlay provenance and linked DR coverage authoritatively.',
          ],
    remediationByNeed: {
      authoritative_applicability:
        unresolvedTargets.length === 0
          ? [
              'No blocked target remains for authoritative overlay applicability; applicability continues to derive from BTUAE-02 and ScenarioContext.',
            ]
          : [
              'No blocked target in this matrix is strictly required to decide overlay applicability; BTUAE-02 and ScenarioContext transaction flags already cover that part.',
              'Applicability-only readiness still needs separate policy approval and rule registration, but those are outside the blocked-target set.',
            ],
      full_runtime_enforcement:
        unresolvedTargets.length === 0
          ? [
              'No blocked target remains for full runtime enforcement plumbing; remaining readiness questions are policy approval and overlay cutover discipline, not field ingestion.',
            ]
          : [
              'Add DR registry/spec bridge entries for all seven blocked targets.',
              'Add canonical fields and parser/template support for principal ID, invoicing period, and delivery information.',
              'Add explicit validation-to-DR linkage once those fields are ingestible.',
            ],
      traceability_explainability_parity:
        unresolvedTargets.length === 0
          ? [
              'No blocked target remains for runtime-derived traceability plumbing; the new targets are now explainable through the same registry-to-rule path as authoritative checks.',
            ]
          : [
              'Expose the newly bridged targets through the DR registry and traceability matrix so they appear as ingestible and linked.',
              'Ensure overlay explainability can show the same ScenarioContext provenance and referenced DRs that the runtime will rely on.',
            ],
    },
  };
}

function assessBlockedTarget(target: OverlayBlockedTargetId): OverlayBlockedTargetAssessment {
  const registryField = getRegistryFieldByDR(target);
  const drEntry = getDREntry(target);
  const validationIds = getValidationIdsForDR(target, { includeReferenceOnly: true });
  const traceability = getDRRuleTraceability(target);
  const controls = getControlsForDR(target);
  const packet = buildOverlayCutoverPacket();
  const impactOnOverlayRules = packet.blockedDependencyReview
    .filter((entry) => entry.blockedTargets.some((blocked) => blocked.drId === target))
    .map((entry) => entry.ruleId);

  const registryComplete = Boolean(registryField && drEntry);
  const parserComplete = Boolean(
    drEntry &&
      drEntry.dataset_file &&
      drEntry.internal_column_names.length > 0 &&
      isDRIngestible(drEntry)
  );
  const canonicalModelComplete = parserComplete;
  const ingestionPathComplete = parserComplete;
  const ruleToDRLinkageComplete = validationIds.length > 0;
  const traceabilitySupportComplete =
    registryComplete &&
    ruleToDRLinkageComplete &&
    TRACEABILITY_DR_IDS.has(target) &&
    (traceability?.linkedCheckIds.length ?? 0) > 0;

  return {
    target,
    currentGap: describeCurrentGap(target, {
      registryComplete,
      parserComplete,
      canonicalModelComplete,
      ingestionPathComplete,
      traceabilitySupportComplete,
      ruleToDRLinkageComplete,
    }),
    impactOnOverlayRules,
    layerStatus: {
      registry: registryComplete ? 'complete' : 'incomplete',
      parser: parserComplete ? 'complete' : 'incomplete',
      canonicalModel: canonicalModelComplete ? 'complete' : 'incomplete',
      ingestionPath: ingestionPathComplete ? 'complete' : 'incomplete',
      traceabilitySupport: traceabilitySupportComplete ? 'complete' : 'incomplete',
      ruleToDRLinkage: ruleToDRLinkageComplete ? 'complete' : 'incomplete',
    },
    requiredCodeDataModelChanges: buildRequiredChanges(target),
    riskLevel: getRiskLevel(target),
    suggestedImplementationOrder: getImplementationOrder(target),
    neededFor: getRemediationNeedsFromLayerStatus({
      registry: registryComplete ? 'complete' : 'incomplete',
      parser: parserComplete ? 'complete' : 'incomplete',
      canonicalModel: canonicalModelComplete ? 'complete' : 'incomplete',
      ingestionPath: ingestionPathComplete ? 'complete' : 'incomplete',
      traceabilitySupport: traceabilitySupportComplete ? 'complete' : 'incomplete',
      ruleToDRLinkage: ruleToDRLinkageComplete ? 'complete' : 'incomplete',
    }),
  };
}

function describeCurrentGap(
  target: OverlayBlockedTargetId,
  status: {
    registryComplete: boolean;
    parserComplete: boolean;
    canonicalModelComplete: boolean;
    ingestionPathComplete: boolean;
    traceabilitySupportComplete: boolean;
    ruleToDRLinkageComplete: boolean;
  }
): string {
  if (!status.registryComplete) {
    return `${target} is missing from the DR registry/spec bridge, so parser, canonical-model, ingestion, traceability, and validation linkage cannot attach to it authoritatively.`;
  }
  if (!status.parserComplete || !status.canonicalModelComplete || !status.ingestionPathComplete) {
    return `${target} exists in the registry but is not fully parseable/typed, so it cannot participate in authoritative ingestion or runtime enforcement.`;
  }
  if (!status.ruleToDRLinkageComplete) {
    return `${target} is ingestible but not yet linked through validation-to-DR mapping for overlay enforcement.`;
  }
  if (!status.traceabilitySupportComplete) {
    return `${target} is linked for execution but not yet surfaced consistently through traceability/explainability consumers.`;
  }
  return `${target} is fully bridged.`;
}

function buildRequiredChanges(target: OverlayBlockedTargetId): string[] {
  switch (target) {
    case 'BTAE-14':
      return [
        'Add a DR registry/spec bridge entry for BTAE-14 in the authoritative registry layer.',
        'Add a typed canonical field for principal identifier on the header and expose it in mapping templates.',
        'Update csvParser and parser-known column sets to ingest the new principal identifier field.',
        'Add validation-to-DR mappings for overlay rules that depend on BTAE-14.',
        'Extend traceability consumers so BTAE-14 can appear as linked and ingestible, not just referenced from generated rules.',
      ];
    case 'IBG-14':
      return [
        'Add a DR registry/spec bridge entry for IBG-14 and define its group-to-column decomposition.',
        'Introduce canonical model fields for invoicing-period start/end or equivalent grouped representation.',
        'Update csvParser and templates to ingest invoicing-period columns from headers.',
        'Add validation-to-DR mappings that connect summary-invoice overlay rules to IBG-14.',
        'Teach traceability/explainability views to render grouped IBG-14 support rather than a missing DR.',
      ];
    case 'IBG-13':
      return [
        'Add a DR registry/spec bridge entry for IBG-13 as a delivery-information group.',
        'Define canonical grouping for delivery address fields and connect it to underlying deliver-to columns.',
        'Update traceability to understand grouped delivery information rather than only leaf IBT fields.',
        'Add validation-to-DR mappings for export-related overlay rules that cite IBG-13.',
      ];
    case 'IBT-075':
      return [
        'Add a DR registry/spec bridge entry for deliver-to address line 1.',
        'Add a canonical header field for deliver-to address line 1 and include it in templates.',
        'Update csvParser and parser-known columns to ingest the field.',
        'Connect export-related overlay rules to IBT-075 in validation-to-DR mapping and traceability.',
      ];
    case 'IBT-077':
      return [
        'Add a DR registry/spec bridge entry for deliver-to city.',
        'Add a canonical header field for deliver-to city and include it in templates.',
        'Update csvParser and parser-known columns to ingest the field.',
        'Connect export-related overlay rules to IBT-077 in validation-to-DR mapping and traceability.',
      ];
    case 'IBT-079':
      return [
        'Add a DR registry/spec bridge entry for deliver-to country subdivision.',
        'Add a canonical header field for deliver-to subdivision and include it in templates.',
        'Update csvParser and parser-known columns to ingest the field.',
        'Connect export-related overlay rules to IBT-079 in validation-to-DR mapping and traceability.',
      ];
    case 'IBT-080':
      return [
        'Add a DR registry/spec bridge entry for deliver-to country code.',
        'Add a canonical header field for deliver-to country and include it in templates.',
        'Update csvParser and parser-known columns to ingest the field.',
        'Connect export-related overlay rules to IBT-080 in validation-to-DR mapping and traceability.',
      ];
  }
}

function getRiskLevel(target: OverlayBlockedTargetId): RemediationRiskLevel {
  if (target === 'BTAE-14' || target === 'IBG-14' || target === 'IBG-13') {
    return 'very_high';
  }
  if (target === 'IBT-079' || target === 'IBT-080') {
    return 'high';
  }
  return 'medium';
}

function getImplementationOrder(target: OverlayBlockedTargetId): number {
  switch (target) {
    case 'BTAE-14':
      return 1;
    case 'IBG-14':
      return 2;
    case 'IBG-13':
      return 3;
    case 'IBT-075':
      return 4;
    case 'IBT-077':
      return 5;
    case 'IBT-080':
      return 6;
    case 'IBT-079':
      return 7;
  }
}

function getRemediationNeedsFromLayerStatus(layerStatus: BlockerLayerStatus): RemediationNeed[] {
  const hasUnresolvedLayer = Object.values(layerStatus).some((status) => status === 'incomplete');
  if (!hasUnresolvedLayer) {
    return [];
  }
  return ['full_runtime_enforcement', 'traceability_explainability_parity'];
}

export function getMinimumOverlayRemediationSetForCutoverEligibility(): string[] {
  return buildOverlayBlockerRemediationMatrix().minimumRemediationSetForCutoverEligibility;
}

export function getOverlayBlockerAssessmentsByNeed(need: RemediationNeed): OverlayBlockedTargetAssessment[] {
  return buildOverlayBlockerRemediationMatrix().targets.filter((target) => target.neededFor.includes(need));
}

export function getOverlayRegistryCoverageSnapshot() {
  const registry = getDRRegistry();
  return {
    totalRegistryEntries: registry.length,
    blockedTargetsPresentInRegistry: OVERLAY_BLOCKED_TARGETS.filter((target) => Boolean(getDREntry(target))),
  };
}
