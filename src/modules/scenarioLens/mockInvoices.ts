import type { Buyer, InvoiceHeader, InvoiceLine } from "@/types/compliance";
import { buildScenarioLensInvoices } from "@/modules/scenarioLens/selectors";
import type { ScenarioLensInvoice } from "@/modules/scenarioLens/types";

const MOCK_HEADERS: InvoiceHeader[] = [
  {
    invoice_id: "MOCK-INV-001",
    invoice_number: "SI-001",
    issue_date: "2026-02-01",
    seller_trn: "100000000000001",
    buyer_id: "MOCK-BUYER-001",
    currency: "AED",
    invoice_type: "380",
    seller_country: "AE",
    total_excl_vat: 1000,
    vat_total: 50,
    total_incl_vat: 1050,
    tax_category_code: "S",
    tax_category_rate: 5,
  },
  {
    invoice_id: "MOCK-INV-002",
    invoice_number: "CN-001",
    issue_date: "2026-02-02",
    seller_trn: "100000000000001",
    buyer_id: "MOCK-BUYER-002",
    currency: "AED",
    invoice_type: "381",
    seller_country: "AE",
    total_excl_vat: -200,
    vat_total: -10,
    total_incl_vat: -210,
    tax_category_code: "S",
    tax_category_rate: 5,
  },
  {
    invoice_id: "MOCK-INV-003",
    invoice_number: "EXP-001",
    issue_date: "2026-02-03",
    seller_trn: "100000000000001",
    buyer_id: "MOCK-BUYER-003",
    currency: "USD",
    invoice_type: "380",
    seller_country: "AE",
    fx_rate: 3.67,
    total_excl_vat: 500,
    vat_total: 0,
    total_incl_vat: 500,
    tax_category_code: "Z",
    tax_category_rate: 0,
  },
];

const MOCK_LINES: InvoiceLine[] = [
  {
    line_id: "MOCK-LINE-001",
    invoice_id: "MOCK-INV-001",
    line_number: 1,
    quantity: 1,
    unit_price: 1000,
    line_total_excl_vat: 1000,
    vat_rate: 5,
    vat_amount: 50,
    tax_category_code: "S",
  },
  {
    line_id: "MOCK-LINE-002",
    invoice_id: "MOCK-INV-002",
    line_number: 1,
    quantity: 1,
    unit_price: -200,
    line_total_excl_vat: -200,
    vat_rate: 5,
    vat_amount: -10,
    tax_category_code: "S",
  },
  {
    line_id: "MOCK-LINE-003",
    invoice_id: "MOCK-INV-003",
    line_number: 1,
    quantity: 1,
    unit_price: 500,
    line_total_excl_vat: 500,
    vat_rate: 0,
    vat_amount: 0,
    tax_category_code: "Z",
  },
];

const MOCK_BUYERS: Buyer[] = [
  { buyer_id: "MOCK-BUYER-001", buyer_name: "Local Buyer LLC", buyer_country: "AE", buyer_trn: "100000000000010" },
  { buyer_id: "MOCK-BUYER-002", buyer_name: "Credit Buyer LLC", buyer_country: "AE", buyer_trn: "100000000000011" },
  { buyer_id: "MOCK-BUYER-003", buyer_name: "Export Buyer Ltd", buyer_country: "SA", buyer_trn: "100000000000012" },
];

export function getScenarioLensMockInvoices(): ScenarioLensInvoice[] {
  return buildScenarioLensInvoices(MOCK_HEADERS, MOCK_LINES, MOCK_BUYERS);
}
