import { describe, expect, it } from "vitest";

import UAE_UC1_CHECK_PACK from "@/lib/checks/uaeUC1CheckPack";
import { SCENARIO_PARITY_FIXTURES } from "@/modules/scenarioContext/fixtures";
import {
  buildRuleApplicabilityComparison,
  buildRuleApplicabilityComparisons,
  getShadowApplicabilityDefinitions,
} from "@/modules/scenarioContext/shadowApplicability";

describe("shadow rule applicability", () => {
  it("keeps shadow applicability outside the authoritative runtime check pack", () => {
    const runtimeRuleIds = new Set(UAE_UC1_CHECK_PACK.map((check) => check.check_id));
    const shadowOnlyRules = getShadowApplicabilityDefinitions().filter((definition) => definition.source === "shadow_only");

    expect(UAE_UC1_CHECK_PACK).toHaveLength(54);
    shadowOnlyRules.forEach((definition) => {
      expect(runtimeRuleIds.has(definition.ruleId)).toBe(false);
    });
  });

  it("reports aligned runtime-backed applicability for the commercial export fixture", () => {
    const fixture = SCENARIO_PARITY_FIXTURES.find((candidate) => candidate.id === "commercial-export");
    expect(fixture).toBeDefined();

    const report = buildRuleApplicabilityComparison(fixture!);
    const commercialPresence = report.rows.find((row) => row.ruleId === "UAE-UC1-CHK-036");
    const invoiceContext = report.rows.find((row) => row.ruleId === "UAE-UC1-CHK-045");
    const exportShadowRule = report.rows.find((row) => row.ruleId === "IBR-152-AE");
    const commercialGeneratedRule = report.rows.find((row) => row.ruleId === "IBR-151-AE");

    expect(commercialPresence).toEqual(
      expect.objectContaining({
        legacyApplicability: "applicable",
        shadowApplicability: "applicable",
        differenceStatus: "aligned",
        reviewCategory: "none",
        legacyPathType: "explicit",
      })
    );
    expect(invoiceContext).toEqual(
      expect.objectContaining({
        legacyApplicability: "applicable",
        shadowApplicability: "applicable",
        differenceStatus: "aligned",
        reviewCategory: "none",
        legacyPathType: "explicit",
      })
    );
    expect(exportShadowRule).toEqual(
      expect.objectContaining({
        legacyApplicability: "applicable",
        shadowApplicability: "applicable",
        differenceStatus: "aligned",
        reviewCategory: "none",
        legacyPathType: "heuristic",
        linkedDrIds: ["BTUAE-02", "IBG-13", "IBT-075", "IBT-077", "IBT-079", "IBT-080"],
      })
    );
    expect(commercialGeneratedRule).toEqual(
      expect.objectContaining({
        legacyApplicability: "not_applicable",
        shadowApplicability: "applicable",
        differenceStatus: "shadow_only_applicable",
        reviewCategory: "expected_improvement",
        legacyPathType: "heuristic",
        scenarioAttributesUsed: ["documentClass", "documentVariant"],
      })
    );
  });

  it("reports evidence-rich heuristic divergences for transaction-flag-only overlays", () => {
    const fixture = SCENARIO_PARITY_FIXTURES.find((candidate) => candidate.id === "free-zone-flag-only");
    expect(fixture).toBeDefined();

    const report = buildRuleApplicabilityComparison(fixture!);
    const freeZoneRule = report.rows.find((row) => row.ruleId === "IBR-007-AE");

    expect(freeZoneRule).toEqual(
      expect.objectContaining({
        legacyApplicability: "not_applicable",
        shadowApplicability: "applicable",
        differenceStatus: "shadow_only_applicable",
        reviewCategory: "expected_improvement",
        legacyPathType: "heuristic",
        scenarioAttributesUsed: ["transactionFlags", "vatTreatments"],
        linkedDrIds: ["BTUAE-02", "BTAE-01"],
      })
    );
    expect(freeZoneRule?.scenarioEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "transaction_type_code",
          field: "transaction_type_code",
          value: "10000000",
        }),
      ])
    );
  });

  it("classifies generated-rule narrowing as expected improvement rather than runtime cutover", () => {
    const fixture = SCENARIO_PARITY_FIXTURES.find((candidate) => candidate.id === "deemed-supply-amount-due");
    expect(fixture).toBeDefined();

    const report = buildRuleApplicabilityComparison(fixture!);
    const deemedSupplyRule = report.rows.find((row) => row.ruleId === "IBR-127-AE");

    expect(deemedSupplyRule).toEqual(
      expect.objectContaining({
        legacyApplicability: "applicable",
        shadowApplicability: "not_applicable",
        differenceStatus: "legacy_only_applicable",
        reviewCategory: "expected_improvement",
        legacyPathType: "explicit",
      })
    );
  });

  it("shows no potential regression across the representative fixtures", () => {
    const reports = buildRuleApplicabilityComparisons(SCENARIO_PARITY_FIXTURES);
    const allRows = reports.flatMap((report) => report.rows);

    expect(allRows.filter((row) => row.reviewCategory === "potential_regression")).toHaveLength(0);
    expect(allRows.some((row) => row.reviewCategory === "expected_improvement")).toBe(true);
  });
});
