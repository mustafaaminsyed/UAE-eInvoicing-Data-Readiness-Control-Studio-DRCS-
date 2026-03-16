import { describe, expect, it } from "vitest";

import { SCENARIO_PARITY_FIXTURES } from "@/modules/scenarioContext/fixtures";
import {
  buildScenarioParityReport,
  buildScenarioParityResult,
} from "@/modules/scenarioContext/parity";

describe("scenario shadow parity", () => {
  it("reports no divergence for legacy-aligned export and self-billing fixtures", () => {
    const alignedIds = [
      "tax-export-zero-rated",
      "self-billing-invoice",
      "self-billing-profile-invoice",
      "self-billing-credit-note",
      "self-billing-profile-credit-note",
      "credit-note-export",
    ];
    const alignedResults = SCENARIO_PARITY_FIXTURES.filter((fixture) => alignedIds.includes(fixture.id)).map(
      buildScenarioParityResult
    );

    alignedResults.forEach((result) => {
      expect(result.divergences).toHaveLength(0);
    });
  });

  it("surfaces expected divergences where the shadow model is richer than legacy heuristics", () => {
    const freeZoneResult = buildScenarioParityResult(
      SCENARIO_PARITY_FIXTURES.find((fixture) => fixture.id === "tax-free-zone-reverse-charge")!
    );
    const freeZoneOnlyResult = buildScenarioParityResult(
      SCENARIO_PARITY_FIXTURES.find((fixture) => fixture.id === "free-zone-flag-only")!
    );
    const agentSummaryResult = buildScenarioParityResult(
      SCENARIO_PARITY_FIXTURES.find((fixture) => fixture.id === "tax-disclosed-agent-summary")!
    );
    const deemedSupplyResult = buildScenarioParityResult(
      SCENARIO_PARITY_FIXTURES.find((fixture) => fixture.id === "deemed-supply-amount-due")!
    );
    const marginSchemeResult = buildScenarioParityResult(
      SCENARIO_PARITY_FIXTURES.find((fixture) => fixture.id === "margin-scheme-flag-only")!
    );
    const commercialResult = buildScenarioParityResult(
      SCENARIO_PARITY_FIXTURES.find((fixture) => fixture.id === "commercial-export")!
    );
    const creditNoteSummaryResult = buildScenarioParityResult(
      SCENARIO_PARITY_FIXTURES.find((fixture) => fixture.id === "credit-note-summary-flag")!
    );

    expect(freeZoneResult.divergences).toContain(
      "vatTreatments mismatch: legacy=Reverse charge shadow=Free Zone,Reverse charge"
    );
    expect(freeZoneOnlyResult.divergences).toContain(
      "vatTreatments mismatch: legacy=Standard-rated shadow=Free Zone,Standard-rated"
    );
    expect(agentSummaryResult.divergences).toContain(
      "businessScenarios mismatch: legacy=None shadow=Disclosed agent,Summary invoice"
    );
    expect(deemedSupplyResult.divergences).toContain(
      "vatTreatments mismatch: legacy=Standard-rated shadow=Deemed supply,Standard-rated"
    );
    expect(marginSchemeResult.divergences).toContain(
      "vatTreatments mismatch: legacy=Standard-rated shadow=Margin scheme,Standard-rated"
    );
    expect(commercialResult.divergences).toContain(
      "documentType mismatch: legacy=Standard Invoice shadow=Commercial/Out-of-scope"
    );
    expect(creditNoteSummaryResult.divergences).toContain(
      "businessScenarios mismatch: legacy=None shadow=Summary invoice"
    );
  });

  it("builds a report with divergent fixture counts", () => {
    const report = buildScenarioParityReport(SCENARIO_PARITY_FIXTURES);

    expect(report.fixtureCount).toBe(SCENARIO_PARITY_FIXTURES.length);
    expect(report.divergentFixtureCount).toBe(7);
  });
});
