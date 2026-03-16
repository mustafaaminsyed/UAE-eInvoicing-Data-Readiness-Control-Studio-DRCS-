import { describe, expect, it } from 'vitest';

import UAE_UC1_CHECK_PACK from '@/lib/checks/uaeUC1CheckPack';
import { OVERLAY_RUNTIME_RULE_IDS } from '@/lib/checks/overlayRuntimeChecks';
import {
  buildOverlayRuntimeCutoverReport,
  OVERLAY_APPLICABILITY_FLAG,
  OVERLAY_APPLICABILITY_LEGACY_MODE,
  OVERLAY_APPLICABILITY_SCENARIO_MODE,
} from '@/modules/scenarioContext/overlayRuntimeCutover';

describe('overlay runtime cutover report', () => {
  it('shows zero potential regressions and only approved expected-improvement rows as runtime differences', () => {
    const report = buildOverlayRuntimeCutoverReport();

    expect(report.summary.potentialRegressionCount).toBe(0);
    expect(report.observedDifferenceRows).toEqual(report.approvedExpectedImprovementRows);
  });

  it('confirms there are no blocked dependencies for the authoritative overlay runtime path', () => {
    const report = buildOverlayRuntimeCutoverReport();

    expect(report.blockedDependenciesRemaining).toEqual([]);
  });

  it('confirms there is no collateral impact outside the overlay family', () => {
    const report = buildOverlayRuntimeCutoverReport();

    expect(report.collateralImpact.changedRows).toEqual([]);
    expect(report.collateralImpact.totalComparisons).toBeGreaterThan(0);
  });

  it('keeps the overlay runtime family isolated from the main authoritative check pack', () => {
    const runtimeRuleIds = new Set(UAE_UC1_CHECK_PACK.map((check) => check.check_id));

    OVERLAY_RUNTIME_RULE_IDS.forEach((ruleId) => {
      expect(runtimeRuleIds.has(ruleId)).toBe(false);
    });
    expect(UAE_UC1_CHECK_PACK).toHaveLength(54);
  });

  it('publishes rollback metadata for the overlay applicability switch', () => {
    const report = buildOverlayRuntimeCutoverReport();

    expect(report.rollback.flag).toBe(OVERLAY_APPLICABILITY_FLAG);
    expect(report.rollback.defaultValue).toBe(OVERLAY_APPLICABILITY_LEGACY_MODE);
    expect(report.rollback.legacyValue).toBe(OVERLAY_APPLICABILITY_LEGACY_MODE);
    expect(report.rollback.scenarioValue).toBe(OVERLAY_APPLICABILITY_SCENARIO_MODE);
  });
});
