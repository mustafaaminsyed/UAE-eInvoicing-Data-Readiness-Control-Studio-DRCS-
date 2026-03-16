import { describe, expect, it } from "vitest";

import {
  TRANSACTION_TYPE_FLAG_DEFINITIONS,
  decodeTransactionTypeCode,
  getTransactionTypeFlagDefinition,
} from "@/modules/scenarioContext/transactionTypeCode";

describe("decodeTransactionTypeCode", () => {
  it("decodes binary combinations into normalized flags", () => {
    const decoded = decodeTransactionTypeCode("00010101");

    expect(decoded.valid).toBe(true);
    expect(decoded.format).toBe("binary");
    expect(decoded.activeFlags).toEqual(["summary_invoice", "disclosed_agent_billing", "exports"]);
  });

  it("decodes mask-style inputs into observable single-flag outputs", () => {
    const decoded = decodeTransactionTypeCode("XXXXX1XX");

    expect(decoded.valid).toBe(true);
    expect(decoded.format).toBe("mask");
    expect(decoded.activeFlags).toEqual(["disclosed_agent_billing"]);
  });

  it("keeps the unnamed fifth mask observable without inventing semantics", () => {
    const decoded = decodeTransactionTypeCode("00001000");

    expect(decoded.activeFlags).toEqual(["reserved_policy_flag"]);
    expect(getTransactionTypeFlagDefinition("reserved_policy_flag")?.mask).toBe("XXXX1XXX");
  });

  it("rejects unsupported transaction_type_code formats", () => {
    const decoded = decodeTransactionTypeCode("EXPORT");

    expect(decoded.valid).toBe(false);
    expect(decoded.format).toBe("invalid");
    expect(decoded.issues[0]).toContain("8-character");
  });

  it("keeps the bitmask contract explicit and complete", () => {
    expect(TRANSACTION_TYPE_FLAG_DEFINITIONS).toHaveLength(8);
    expect(TRANSACTION_TYPE_FLAG_DEFINITIONS.map((definition) => definition.bitPosition)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
  });
});
