import { parseCSV } from "@/lib/csvParser";
import {
  buyersNegativeSample,
  buyersSample,
  headersNegativeSample,
  headersSample,
  linesNegativeSample,
  linesSample,
} from "@/lib/sampleData";
import type { ScenarioInvoiceInput } from "@/modules/scenarioLens/types";
import { SCENARIO_PARITY_FIXTURES } from "@/modules/scenarioContext/fixtures";
import type { Buyer, InvoiceHeader, InvoiceLine } from "@/types/compliance";

export type RegressionCorpusSource = "representative_fixture" | "sample_csv" | "exception_case";

export interface RegressionCorpusEntry {
  id: string;
  description: string;
  source: RegressionCorpusSource;
  input: ScenarioInvoiceInput;
}

export const REGRESSION_EXCEPTION_CASES: RegressionCorpusEntry[] = [
  {
    id: "exception-commercial-credit-note",
    description: "commercial credit note variant",
    source: "exception_case",
    input: {
      header: {
        invoice_type: "381",
        document_type: "COMMERCIAL",
        seller_country: "AE",
        tax_category_code: "Z",
        transaction_type_code: "00000001",
      },
      lines: [],
      buyer: { buyer_country: "GB" },
    },
  },
  {
    id: "exception-out-of-scope-summary-conflict",
    description: "out-of-scope with summary-invoice transaction flag",
    source: "exception_case",
    input: {
      header: {
        invoice_type: "388",
        document_type: "COMMERCIAL",
        seller_country: "AE",
        transaction_type_code: "00010000",
        tax_category_code: "O",
      },
      lines: [],
      buyer: { buyer_country: "AE" },
    },
  },
  {
    id: "exception-negative-standard-invoice",
    description: "negative totals without credit note type",
    source: "exception_case",
    input: {
      header: {
        invoice_type: "380",
        seller_country: "AE",
        total_excl_vat: -100,
        vat_total: -5,
        total_incl_vat: -105,
        tax_category_code: "S",
        tax_category_rate: 5,
      },
      lines: [
        {
          invoice_id: "NEG-STD-1",
          line_id: "NEG-STD-L1",
          line_number: 1,
          quantity: 1,
          unit_price: -100,
          line_total_excl_vat: -100,
          vat_rate: 5,
          vat_amount: -5,
          tax_category_code: "S",
        },
      ],
      buyer: { buyer_country: "AE" },
    },
  },
  {
    id: "exception-disclosed-agent-credit-note",
    description: "credit note with disclosed-agent transaction flag",
    source: "exception_case",
    input: {
      header: {
        invoice_type: "381",
        seller_country: "AE",
        transaction_type_code: "00000100",
        tax_category_code: "S",
        tax_category_rate: 5,
      },
      lines: [],
      buyer: { buyer_country: "AE" },
    },
  },
];

export function getCutoverRegressionCorpus(): RegressionCorpusEntry[] {
  return [
    ...SCENARIO_PARITY_FIXTURES.map((fixture) => ({
      id: `fixture-${fixture.id}`,
      description: fixture.description,
      source: "representative_fixture" as const,
      input: fixture.input,
    })),
    ...buildSampleCorpusEntries("positive", buyersSample, headersSample, linesSample),
    ...buildSampleCorpusEntries("negative", buyersNegativeSample, headersNegativeSample, linesNegativeSample),
    ...REGRESSION_EXCEPTION_CASES,
  ];
}

function buildSampleCorpusEntries(
  scenario: "positive" | "negative",
  buyersCsv: string,
  headersCsv: string,
  linesCsv: string
): RegressionCorpusEntry[] {
  const buyers = parseCSV(buyersCsv).map(normalizeBuyerRecord);
  const headers = parseCSV(headersCsv).map(normalizeHeaderRecord);
  const lines = parseCSV(linesCsv).map(normalizeLineRecord);

  return headers.map((header) => {
    const invoiceId = header.invoice_id || "unknown";
    return {
      id: `sample-${scenario}-${invoiceId}`,
      description: `shipped ${scenario} sample invoice ${invoiceId}`,
      source: "sample_csv",
      input: {
        header,
        lines: lines.filter((line) => line.invoice_id === invoiceId),
        buyer: buyers.find((buyer) => buyer.buyer_id === header.buyer_id) ?? null,
      },
    };
  });
}

function normalizeBuyerRecord(record: Record<string, string>): Buyer {
  return {
    buyer_id: record.buyer_id || record.supplier_id || '',
    buyer_name: record.buyer_name || record.supplier_name || '',
    buyer_trn: record.buyer_trn || record.supplier_trn || undefined,
    buyer_address: record.buyer_address || record.supplier_address || undefined,
    buyer_country: record.buyer_country || record.supplier_country || undefined,
    buyer_city: record.buyer_city || record.supplier_city || undefined,
    buyer_subdivision: record.buyer_subdivision || record.supplier_subdivision || undefined,
    buyer_electronic_address:
      record.buyer_electronic_address || record.supplier_electronic_address || undefined,
  };
}

function normalizeHeaderRecord(record: Record<string, string>): InvoiceHeader {
  return {
    invoice_id: record.invoice_id || '',
    invoice_number: record.invoice_number || '',
    issue_date: record.issue_date || '',
    invoice_type: record.invoice_type || '',
    seller_trn: record.seller_trn || '',
    seller_name: record.seller_name || undefined,
    seller_address: record.seller_address || undefined,
    seller_city: record.seller_city || undefined,
    seller_country: record.seller_country || undefined,
    seller_subdivision: record.seller_subdivision || undefined,
    seller_electronic_address: record.seller_electronic_address || undefined,
    seller_legal_reg_id: record.seller_legal_reg_id || undefined,
    seller_legal_reg_id_type: record.seller_legal_reg_id_type || undefined,
    buyer_id: record.buyer_id || record.supplier_id || '',
    currency: record.currency || '',
    transaction_type_code: record.transaction_type_code || undefined,
    principal_id: record.principal_id || undefined,
    invoicing_period_start_date: record.invoicing_period_start_date || undefined,
    invoicing_period_end_date: record.invoicing_period_end_date || undefined,
    deliver_to_address_line_1: record.deliver_to_address_line_1 || undefined,
    deliver_to_city: record.deliver_to_city || undefined,
    deliver_to_country_subdivision: record.deliver_to_country_subdivision || undefined,
    deliver_to_country_code: record.deliver_to_country_code || undefined,
    payment_due_date: record.payment_due_date || undefined,
    payment_means_code: record.payment_means_code || undefined,
    fx_rate: toNumber(record.fx_rate),
    total_excl_vat: toNumber(record.total_excl_vat),
    vat_total: toNumber(record.vat_total),
    total_incl_vat: toNumber(record.total_incl_vat),
    amount_due: toNumber(record.amount_due),
    tax_category_code: record.tax_category_code || undefined,
    tax_category_rate: toNumber(record.tax_category_rate),
  };
}

function normalizeLineRecord(record: Record<string, string>): InvoiceLine {
  return {
    line_id: record.line_id || '',
    invoice_id: record.invoice_id || '',
    line_number: toNumber(record.line_number) ?? 0,
    description: record.description || undefined,
    quantity: toNumber(record.quantity) ?? 0,
    unit_of_measure: record.unit_of_measure || undefined,
    unit_price: toNumber(record.unit_price) ?? 0,
    line_discount: toNumber(record.line_discount),
    line_total_excl_vat: toNumber(record.line_total_excl_vat) ?? 0,
    vat_rate: toNumber(record.vat_rate) ?? 0,
    vat_amount: toNumber(record.vat_amount) ?? 0,
    tax_category_code: record.tax_category_code || undefined,
  };
}

function toNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}
