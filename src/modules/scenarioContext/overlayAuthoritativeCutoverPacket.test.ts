import { describe, expect, it } from 'vitest';

import UAE_UC1_CHECK_PACK from '@/lib/checks/uaeUC1CheckPack';
import {
  buildOverlayAuthoritativeCutoverPacket,
  OVERLAY_APPLICABILITY_FLAG,
  OVERLAY_APPLICABILITY_LEGACY_MODE,
  OVERLAY_APPLICABILITY_SCENARIO_MODE,
} from '@/modules/scenarioContext/overlayAuthoritativeCutoverPacket';
import { OVERLAY_CUTOVER_RULE_IDS } from '@/modules/scenarioContext/overlayCutoverPlan';

describe('overlay authoritative cutover packet', () => {
  it('builds a rule-by-rule approval packet for the three overlay rules', () => {
    const packet = buildOverlayAuthoritativeCutoverPacket();

    expect(packet.rulePackets.map((rule) => rule.ruleId)).toEqual([...OVERLAY_CUTOVER_RULE_IDS]);
    expect(packet.corpusSummary.totalComparisons).toBeGreaterThan(0);
    expect(packet.corpusSummary.expectedImprovement).toBeGreaterThan(0);
    expect(packet.corpusSummary.potentialRegression).toBe(0);
  });

  it('confirms zero blocked dependencies remain for the overlay migration candidates', () => {
    const packet = buildOverlayAuthoritativeCutoverPacket();

    expect(packet.zeroBlockedDependencies).toBe(true);
    packet.rulePackets.forEach((rule) => {
      expect(rule.blockedDependenciesRemaining).toEqual([]);
    });
  });

  it('provides evidence-rich expected-improvement details for heuristic legacy divergences', () => {
    const packet = buildOverlayAuthoritativeCutoverPacket();
    const improvementDetails = packet.rulePackets.flatMap((rule) => rule.expectedImprovementDetails);

    expect(improvementDetails.length).toBeGreaterThan(0);
    improvementDetails.forEach((detail) => {
      expect(detail.legacyPathType).toBe('heuristic');
      expect(detail.scenarioContextEvidence.length).toBeGreaterThan(0);
      expect(detail.provenanceSummary.length).toBeGreaterThan(0);
      expect(detail.linkedDrCoverage.length).toBeGreaterThan(0);
      expect(detail.generatedRuleIntent.message.length).toBeGreaterThan(0);
      expect(detail.whyPreferable.length).toBeGreaterThan(0);
    });
  });

  it('proposes a family-isolated runtime cutover design with rollback while leaving runtime disabled', () => {
    const packet = buildOverlayAuthoritativeCutoverPacket();
    const runtimeRuleIds = new Set(UAE_UC1_CHECK_PACK.map((check) => check.check_id));

    expect(packet.runtimeCutoverDesign.flag).toBe(OVERLAY_APPLICABILITY_FLAG);
    expect(packet.runtimeCutoverDesign.defaultMode).toBe(OVERLAY_APPLICABILITY_LEGACY_MODE);
    expect(packet.runtimeCutoverDesign.proposedScenarioMode).toBe(OVERLAY_APPLICABILITY_SCENARIO_MODE);
    expect(packet.runtimeCutoverDesign.eligibleRuleIds).toEqual([...OVERLAY_CUTOVER_RULE_IDS]);
    OVERLAY_CUTOVER_RULE_IDS.forEach((ruleId) => {
      expect(runtimeRuleIds.has(ruleId)).toBe(false);
    });
    expect(UAE_UC1_CHECK_PACK).toHaveLength(54);
    expect(packet.traceabilityImpactNotes.join(' ')).toContain('No traceability behavior changes');
    expect(packet.exceptionAnalysisImpactNotes.join(' ')).toContain('No exception-analysis behavior changes');
  });
});
