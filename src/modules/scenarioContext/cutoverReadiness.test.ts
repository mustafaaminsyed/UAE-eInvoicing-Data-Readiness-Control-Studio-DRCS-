import { describe, expect, it } from "vitest";

import UAE_UC1_CHECK_PACK from "@/lib/checks/uaeUC1CheckPack";
import {
  buildCutoverReadinessReport,
  getBlockedGeneratedRuleTargets,
} from "@/modules/scenarioContext/cutoverReadiness";

describe("cutover readiness", () => {
  it("produces a structured impact report by rule family", () => {
    const report = buildCutoverReadinessReport();
    const families = new Map(report.familyImpact.map((family) => [family.family, family]));

    expect(report.corpus.length).toBeGreaterThan(10);
    expect(families.get("document_family")?.counts.expected_improvement).toBeGreaterThanOrEqual(1);
    expect(families.get("transaction_flag")?.counts.policy_decision_needed).toBeGreaterThanOrEqual(1);
    expect(families.get("credit_note_specialized")?.counts.blocked_by_ingestion_gap).toBeGreaterThanOrEqual(1);
  });

  it("identifies generated-rule targets blocked by registry or ingestibility gaps", () => {
    const blockedTargets = getBlockedGeneratedRuleTargets();

    expect(blockedTargets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          drId: "BTAE-01",
          blockerType: "missing_registry",
        }),
        expect.objectContaining({
          drId: "BTAE-03",
          blockerType: "missing_registry",
        }),
      ])
    );
    expect(blockedTargets.some((target) => target.drId === 'BTAE-14')).toBe(false);
    expect(blockedTargets.some((target) => target.drId === 'IBG-14')).toBe(false);
  });

  it("orders phased cutover recommendations from safest to riskiest", () => {
    const report = buildCutoverReadinessReport();

    expect(report.phasedCutover.map((phase) => phase.family)).toEqual([
      "document_family",
      "vat_treatment",
      "overlay",
      "transaction_flag",
      "credit_note_specialized",
    ]);
    expect(report.phasedCutover[0]?.readiness).toBe("safest");
    expect(report.phasedCutover[4]?.readiness).toBe("riskiest");
  });

  it("keeps authoritative runtime behavior unchanged in this readiness pass", () => {
    const report = buildCutoverReadinessReport();

    expect(UAE_UC1_CHECK_PACK).toHaveLength(54);
    expect(report.cutoverGates.map((gate) => gate.gateId)).toEqual(
      expect.arrayContaining([
        "gate-shadow-regression",
        "gate-authoritative-narrowing-approval",
        "gate-ingestion-coverage",
        "gate-traceability-parity",
      ])
    );
  });
});
