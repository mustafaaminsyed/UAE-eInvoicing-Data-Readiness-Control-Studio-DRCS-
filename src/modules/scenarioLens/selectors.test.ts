import { describe, expect, it } from "vitest";
import {
  buildScenarioLensInvoices,
  computeDistribution,
  computeScenarioCoverage,
  confidenceToBand,
  filterInvoicesByScenario,
} from "@/modules/scenarioLens/selectors";
import type { Buyer, InvoiceHeader, InvoiceLine } from "@/types/compliance";

const headers: InvoiceHeader[] = [
  {
    invoice_id: "INV-1",
    invoice_number: "SI-1",
    issue_date: "2026-01-01",
    seller_trn: "100000000001",
    buyer_id: "B-1",
    currency: "AED",
    seller_country: "AE",
    invoice_type: "380",
    tax_category_code: "S",
    tax_category_rate: 5,
  },
  {
    invoice_id: "INV-2",
    invoice_number: "CN-1",
    issue_date: "2026-01-02",
    seller_trn: "100000000001",
    buyer_id: "B-2",
    currency: "AED",
    seller_country: "AE",
    invoice_type: "381",
    tax_category_code: "Z",
    tax_category_rate: 0,
  },
];

const lines: InvoiceLine[] = [
  {
    line_id: "L-1",
    invoice_id: "INV-1",
    line_number: 1,
    quantity: 1,
    unit_price: 100,
    line_total_excl_vat: 100,
    vat_rate: 5,
    vat_amount: 5,
    tax_category_code: "S",
  },
  {
    line_id: "L-2",
    invoice_id: "INV-2",
    line_number: 1,
    quantity: 1,
    unit_price: -10,
    line_total_excl_vat: -10,
    vat_rate: 0,
    vat_amount: 0,
    tax_category_code: "Z",
  },
];

const buyers: Buyer[] = [
  { buyer_id: "B-1", buyer_name: "Local Buyer", buyer_country: "AE" },
  { buyer_id: "B-2", buyer_name: "Export Buyer", buyer_country: "SA" },
];

describe("scenario lens selectors", () => {
  it("builds and filters invoices by scenario filters", () => {
    const invoices = buildScenarioLensInvoices(headers, lines, buyers);
    const filtered = filterInvoicesByScenario(invoices, {
      documentType: "Credit Note",
      vatTreatment: "All",
      businessScenario: "All",
      confidence: "All",
    });

    expect(invoices).toHaveLength(2);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].invoiceId).toBe("INV-2");
  });

  it("computes scenario coverage and distribution", () => {
    const invoices = buildScenarioLensInvoices(headers, lines, buyers);
    const coverage = computeScenarioCoverage(invoices);
    const distribution = computeDistribution(invoices, "documentType");

    expect(coverage.invoicesInSelection).toBe(2);
    expect(coverage.documentTypesPresent).toBeGreaterThanOrEqual(2);
    expect(distribution[0].count).toBeGreaterThan(0);
    expect(distribution[0].percentage).toBeGreaterThan(0);
  });

  it("maps confidence values to confidence bands", () => {
    expect(confidenceToBand(80)).toBe("High");
    expect(confidenceToBand(60)).toBe("Medium");
    expect(confidenceToBand(20)).toBe("Low");
    expect(confidenceToBand(undefined)).toBeNull();
  });
});
