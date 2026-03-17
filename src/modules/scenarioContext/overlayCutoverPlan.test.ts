import { describe, expect, it } from 'vitest';

import UAE_UC1_CHECK_PACK from '@/lib/checks/uaeUC1CheckPack';
import {
  buildOverlayCutoverPacket,
  buildOverlayFamilyImpactSummary,
  OVERLAY_CUTOVER_RULE_IDS,
} from '@/modules/scenarioContext/overlayCutoverPlan';

describe('overlay-family authoritative cutover plan', () => {
  it('enumerates the exact proposed overlay rules and classifies corpus-wide differences', () => {
    const packet = buildOverlayCutoverPacket();

    expect(packet.ruleProposals.map((rule) => rule.ruleId)).toEqual([...OVERLAY_CUTOVER_RULE_IDS]);
    expect(packet.corpusSize).toBeGreaterThan(10);
    expect(packet.summary.totalComparisons).toBe(packet.corpusSize * OVERLAY_CUTOVER_RULE_IDS.length);
    expect(packet.summary.potentialRegression).toBe(0);
    expect(packet.summary.expectedImprovement).toBeGreaterThan(0);
  });

  it('keeps blocked dependency review explicit and clears it once plumbing is complete', () => {
    const packet = buildOverlayCutoverPacket();

    packet.blockedDependencyReview.forEach((entry) => {
      expect(entry.blockedTargets).toHaveLength(0);
    });
  });

  it('surfaces heuristic legacy pathing and provenance-rich shadow evidence for overlay differences', () => {
    const packet = buildOverlayCutoverPacket();
    const divergentRow = packet.differenceRows.find((row) => row.classification === 'expected_improvement');

    expect(divergentRow).toBeDefined();
    expect(divergentRow?.legacyPathType).toBe('heuristic');
    expect(divergentRow?.scenarioAttributesUsed.length).toBeGreaterThan(0);
    expect(divergentRow?.scenarioEvidence.length).toBeGreaterThan(0);
  });

  it('remains a plan-only pass with no authoritative runtime cutover', () => {
    const packet = buildOverlayCutoverPacket();
    const familyImpact = buildOverlayFamilyImpactSummary();
    const runtimeRuleIds = new Set(UAE_UC1_CHECK_PACK.map((check) => check.check_id));

    OVERLAY_CUTOVER_RULE_IDS.forEach((ruleId) => {
      expect(runtimeRuleIds.has(ruleId)).toBe(false);
    });
    expect(UAE_UC1_CHECK_PACK).toHaveLength(54);
    expect(familyImpact?.counts.blocked_by_ingestion_gap).toBe(0);
    expect(packet.traceabilityImpactNotes.join(' ')).toContain('No traceability behavior changes');
    expect(packet.exceptionAnalysisImpactNotes.join(' ')).toContain('No exception-analysis behavior changes');
    expect(packet.approvalNotes.join(' ')).toContain('justified authoritative differences');
  });
});
