import { describe, expect, it } from "vitest";

import {
  getCutoverRegressionCorpus,
  REGRESSION_EXCEPTION_CASES,
} from "@/modules/scenarioContext/regressionCorpus";
import { SCENARIO_PARITY_FIXTURES } from "@/modules/scenarioContext/fixtures";

describe("cutover regression corpus", () => {
  it("extends beyond the representative fixture set", () => {
    const corpus = getCutoverRegressionCorpus();

    expect(corpus.length).toBeGreaterThan(SCENARIO_PARITY_FIXTURES.length);
    expect(corpus.some((entry) => entry.source === "sample_csv")).toBe(true);
    expect(corpus.some((entry) => entry.source === "exception_case")).toBe(true);
  });

  it("keeps the seeded exception cases available for commercial and invalid combinations", () => {
    expect(REGRESSION_EXCEPTION_CASES.map((entry) => entry.id)).toEqual(
      expect.arrayContaining([
        "exception-commercial-credit-note",
        "exception-out-of-scope-summary-conflict",
        "exception-negative-standard-invoice",
        "exception-disclosed-agent-credit-note",
      ])
    );
  });
});
