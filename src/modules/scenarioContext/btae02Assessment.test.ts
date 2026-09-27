import { describe, expect, it } from "vitest";
import { buildBtae02Assessment } from "@/modules/scenarioContext/btae02Assessment";

describe("buildBtae02Assessment", () => {
  it("keeps evidence kind and provenance separate from strength", () => {
    const evidence = [
      { sourceField: "x", sourceValue: true, kind: "independent", strength: "strong", derived: false },
      { sourceField: "y", sourceValue: "", kind: "dependency", strength: "strong", derived: false },
      { sourceField: "z", sourceValue: "monthly", kind: "heuristic", strength: "weak", derived: true },
      { sourceField: "transaction_type_code", sourceValue: "00001000", kind: "declaration_derived", strength: "strong", derived: true },
    ] as const;
    expect(new Set(evidence.map((item) => item.kind))).toEqual(
      new Set(["independent", "dependency", "heuristic", "declaration_derived"]),
    );
    expect(evidence[0]).toMatchObject({ sourceField: "x", sourceValue: true, derived: false });
  });

  it("represents dependency results without changing consistency", () => {
    const statuses = ["not_evaluated", "satisfied", "failed", "not_applicable"] as const;
    expect(statuses).toHaveLength(4);
    const assessment = buildBtae02Assessment("00001000");
    expect(assessment.consistency).toBe("not_evaluated");
    expect(assessment.declaration.positions.every((position) => position.dependency.status === "not_evaluated")).toBe(true);
  });
  it.each([
    ["00000000", []],
    ["10000000", ["free_trade_zone"]],
    ["00001000", ["continuous_supply"]],
    ["00000100", ["disclosed_agent_billing"]],
    ["00000001", ["exports"]],
    ["00001001", ["continuous_supply", "exports"]],
    ["11111111", [
      "free_trade_zone", "deemed_supply", "margin_scheme", "summary_invoice",
      "continuous_supply", "disclosed_agent_billing", "ecommerce_supplies", "exports",
    ]],
  ] as const)("represents %s as a declaration", (raw, flags) => {
    const assessment = buildBtae02Assessment(raw);
    expect(assessment.declaration.valid).toBe(true);
    expect(assessment.declaration.activeFlags).toEqual(flags);
    expect(assessment.declaration.positions).toHaveLength(8);
    expect(assessment.declaration.positions.every((position) => position.evidence.length === 0)).toBe(true);
    expect(assessment.consistency).toBe("not_evaluated");
    expect(assessment.dependencyState).toBe("not_evaluated");
  });

  it("represents invalid input without fabricating evidence", () => {
    const assessment = buildBtae02Assessment("XXXX1XXX");
    expect(assessment.declaration.valid).toBe(false);
    expect(assessment.declaration.activeFlags).toEqual([]);
    expect(assessment.declaration.positions).toHaveLength(8);
    expect(assessment.declaration.positions.every((position) => !position.active && position.evidence.length === 0)).toBe(true);
  });
});
