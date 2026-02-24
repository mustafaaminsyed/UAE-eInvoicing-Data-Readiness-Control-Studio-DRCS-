import { describe, expect, it } from "vitest";
import { classifyInvoice } from "@/modules/scenarioLens/classifyInvoice";

describe("classifyInvoice", () => {
  it("classifies a standard invoice using tax category signals", () => {
    const result = classifyInvoice({
      header: {
        invoice_type: "380",
        seller_country: "AE",
        tax_category_code: "S",
        tax_category_rate: 5,
      },
      lines: [],
      buyer: { buyer_country: "AE" },
    });

    expect(result.documentType).toBe("Standard Invoice");
    expect(result.vatTreatments).toContain("Standard-rated");
    expect(result.businessScenarios).toContain("None");
    expect(result.confidence).toBeGreaterThanOrEqual(20);
  });

  it("classifies credit note and reverse charge from explicit indicators", () => {
    const result = classifyInvoice({
      header: {
        invoice_type: "381",
        reverse_charge: true,
        seller_country: "AE",
      },
      lines: [{ tax_category_code: "RCM" }],
      buyer: { buyer_country: "AE" },
    });

    expect(result.documentType).toBe("Credit Note");
    expect(result.vatTreatments).toContain("Reverse charge");
  });

  it("classifies export when buyer country is outside AE", () => {
    const result = classifyInvoice({
      header: {
        invoice_type: "380",
        seller_country: "AE",
      },
      lines: [{ tax_category_code: "Z" }],
      buyer: { buyer_country: "SA" },
    });

    expect(result.vatTreatments).toContain("Export");
    expect(result.vatTreatments).toContain("Zero-rated");
  });

  it("keeps VAT treatments empty when no tax signals are available", () => {
    const result = classifyInvoice({
      header: {
        invoice_type: "380",
        seller_country: "AE",
      },
      lines: [],
      buyer: { buyer_country: "AE" },
    });

    expect(result.vatTreatments).toHaveLength(0);
    expect(result.businessScenarios).toEqual(["None"]);
  });
});
