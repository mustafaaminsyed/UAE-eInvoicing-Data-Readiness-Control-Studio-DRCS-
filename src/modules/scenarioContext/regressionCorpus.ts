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
  const buyers = parseCSV(buyersCsv);
  const headers = parseCSV(headersCsv);
  const lines = parseCSV(linesCsv);

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
