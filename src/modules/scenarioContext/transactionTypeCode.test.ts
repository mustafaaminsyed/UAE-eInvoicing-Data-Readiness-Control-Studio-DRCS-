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

  it("accepts all-binary values including no special transaction type", () => {
    for (const value of ["00000000", "00000001", "00000010", "00000100", "00001000", "00010000", "00100000", "01000000", "10000000", "11111111"]) {
      expect(decodeTransactionTypeCode(value).valid).toBe(true);
    }
    expect(decodeTransactionTypeCode("00000000").activeFlags).toEqual([]);
  });

  it("decodes position five as continuous supply", () => {
    const decoded = decodeTransactionTypeCode("00001000");

    expect(decoded.activeFlags).toEqual(["continuous_supply"]);
    expect(getTransactionTypeFlagDefinition("continuous_supply")?.mask).toBe("XXXX1XXX");
  });

  it("rejects unsupported transaction_type_code formats", () => {
    for (const value of ["XXXXXXX1", "XXXXX1XX", "XXXX1XXX", "XXXXXXXX", "0000000", "000000000", "0000000X", "ABC00000", ""]) {
      const decoded = decodeTransactionTypeCode(value);
      expect(decoded.valid).toBe(false);
      expect(decoded.format).not.toBe("binary");
    }
    expect(decodeTransactionTypeCode("EXPORT").issues[0]).toContain("8-character");
  });

  it("keeps the bitmask contract explicit and complete", () => {
    expect(TRANSACTION_TYPE_FLAG_DEFINITIONS).toHaveLength(8);
    expect(TRANSACTION_TYPE_FLAG_DEFINITIONS.map((definition) => definition.bitPosition)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
  });
});
