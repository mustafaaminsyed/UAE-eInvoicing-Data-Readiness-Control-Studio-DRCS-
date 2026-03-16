import type { ScenarioInvoiceInput } from "@/modules/scenarioLens/types";
import type {
  ScenarioDocumentClass,
  ScenarioDocumentVariant,
  ScenarioOverlay,
  ScenarioTransactionFlag,
  ScenarioVatTreatment,
} from "@/types/scenarioContext";

export interface ScenarioParityFixture {
  id: string;
  description: string;
  input: ScenarioInvoiceInput;
  expectedContext: {
    documentClass: ScenarioDocumentClass;
    documentVariant: ScenarioDocumentVariant;
    transactionFlags: ScenarioTransactionFlag[];
    vatTreatments: ScenarioVatTreatment[];
    overlays: ScenarioOverlay[];
  };
}

export const SCENARIO_PARITY_FIXTURES: ScenarioParityFixture[] = [
  {
    id: "tax-export-zero-rated",
    description: "tax invoice + export + zero-rated",
    input: {
      header: {
        invoice_type: "380",
        seller_country: "AE",
        transaction_type_code: "00000001",
        tax_category_code: "Z",
      },
      lines: [],
      buyer: { buyer_country: "SA" },
    },
    expectedContext: {
      documentClass: "tax_invoice",
      documentVariant: "standard",
      transactionFlags: ["exports"],
      vatTreatments: ["export", "zero_rated"],
      overlays: [],
    },
  },
  {
    id: "tax-free-zone-reverse-charge",
    description: "tax invoice + free trade zone + reverse charge",
    input: {
      header: {
        invoice_type: "380",
        seller_country: "AE",
        transaction_type_code: "10000000",
        reverse_charge: true,
      },
      lines: [{ tax_category_code: "RCM" }],
      buyer: { buyer_country: "AE" },
    },
    expectedContext: {
      documentClass: "tax_invoice",
      documentVariant: "standard",
      transactionFlags: ["free_trade_zone"],
      vatTreatments: ["reverse_charge", "free_trade_zone"],
      overlays: [],
    },
  },
  {
    id: "free-zone-flag-only",
    description: "free zone via transaction_type_code only",
    input: {
      header: {
        invoice_type: "380",
        seller_country: "AE",
        transaction_type_code: "10000000",
        tax_category_code: "S",
        tax_category_rate: 5,
      },
      lines: [],
      buyer: { buyer_country: "AE" },
    },
    expectedContext: {
      documentClass: "tax_invoice",
      documentVariant: "standard",
      transactionFlags: ["free_trade_zone"],
      vatTreatments: ["free_trade_zone", "standard_rated"],
      overlays: [],
    },
  },
  {
    id: "tax-disclosed-agent-summary",
    description: "tax invoice + disclosed agent billing + summary invoice",
    input: {
      header: {
        invoice_type: "380",
        seller_country: "AE",
        transaction_type_code: "00010100",
        tax_category_code: "S",
        tax_category_rate: 5,
      },
      lines: [],
      buyer: { buyer_country: "AE" },
    },
    expectedContext: {
      documentClass: "tax_invoice",
      documentVariant: "standard",
      transactionFlags: ["summary_invoice", "disclosed_agent_billing"],
      vatTreatments: ["standard_rated"],
      overlays: ["summary_invoice", "disclosed_agent_billing"],
    },
  },
  {
    id: "deemed-supply-amount-due",
    description: "deemed supply via transaction_type_code with amount due",
    input: {
      header: {
        invoice_type: "380",
        seller_country: "AE",
        transaction_type_code: "01000000",
        amount_due: 100,
        tax_category_code: "S",
        tax_category_rate: 5,
      },
      lines: [],
      buyer: { buyer_country: "AE" },
    },
    expectedContext: {
      documentClass: "tax_invoice",
      documentVariant: "standard",
      transactionFlags: ["deemed_supply"],
      vatTreatments: ["deemed_supply", "standard_rated"],
      overlays: [],
    },
  },
  {
    id: "margin-scheme-flag-only",
    description: "margin scheme via transaction_type_code only",
    input: {
      header: {
        invoice_type: "380",
        seller_country: "AE",
        transaction_type_code: "00100000",
        tax_category_code: "S",
        tax_category_rate: 5,
      },
      lines: [],
      buyer: { buyer_country: "AE" },
    },
    expectedContext: {
      documentClass: "tax_invoice",
      documentVariant: "standard",
      transactionFlags: ["margin_scheme"],
      vatTreatments: ["margin_scheme", "standard_rated"],
      overlays: [],
    },
  },
  {
    id: "commercial-export",
    description: "commercial invoice + export",
    input: {
      header: {
        invoice_type: "388",
        document_type: "COMMERCIAL",
        seller_country: "AE",
        transaction_type_code: "00000001",
        tax_category_code: "Z",
      },
      lines: [],
      buyer: { buyer_country: "GB" },
    },
    expectedContext: {
      documentClass: "commercial_invoice",
      documentVariant: "commercial_invoice",
      transactionFlags: ["exports"],
      vatTreatments: ["export", "zero_rated"],
      overlays: [],
    },
  },
  {
    id: "self-billing-invoice",
    description: "self-billing variant",
    input: {
      header: {
        invoice_type: "380",
        seller_country: "AE",
        self_billing: true,
        tax_category_code: "S",
        tax_category_rate: 5,
      },
      lines: [],
      buyer: { buyer_country: "AE" },
    },
    expectedContext: {
      documentClass: "tax_invoice",
      documentVariant: "self_billing",
      transactionFlags: [],
      vatTreatments: ["standard_rated"],
      overlays: [],
    },
  },
  {
    id: "self-billing-profile-invoice",
    description: "self-billing invoice via profile fields only",
    input: {
      header: {
        invoice_type: "380",
        seller_country: "AE",
        spec_id: "urn:peppol:pint:selfbilling-1@ae-1#1.0",
        business_process: "urn:peppol:bis:selfbilling",
        tax_category_code: "S",
        tax_category_rate: 5,
      },
      lines: [],
      buyer: { buyer_country: "AE" },
    },
    expectedContext: {
      documentClass: "tax_invoice",
      documentVariant: "self_billing",
      transactionFlags: [],
      vatTreatments: ["standard_rated"],
      overlays: [],
    },
  },
  {
    id: "self-billing-credit-note",
    description: "self-billing credit note variant",
    input: {
      header: {
        invoice_type: "381",
        seller_country: "AE",
        self_billing: true,
        tax_category_code: "S",
        tax_category_rate: 5,
      },
      lines: [],
      buyer: { buyer_country: "AE" },
    },
    expectedContext: {
      documentClass: "tax_invoice",
      documentVariant: "self_billing_credit_note",
      transactionFlags: [],
      vatTreatments: ["standard_rated"],
      overlays: [],
    },
  },
  {
    id: "self-billing-profile-credit-note",
    description: "self-billing credit note via profile fields only",
    input: {
      header: {
        invoice_type: "381",
        seller_country: "AE",
        spec_id: "urn:peppol:pint:selfbilling-1@ae-1#1.0",
        business_process: "urn:peppol:bis:selfbilling",
        tax_category_code: "S",
        tax_category_rate: 5,
      },
      lines: [],
      buyer: { buyer_country: "AE" },
    },
    expectedContext: {
      documentClass: "tax_invoice",
      documentVariant: "self_billing_credit_note",
      transactionFlags: [],
      vatTreatments: ["standard_rated"],
      overlays: [],
    },
  },
  {
    id: "credit-note-export",
    description: "credit note variant + export",
    input: {
      header: {
        invoice_type: "381",
        seller_country: "AE",
        transaction_type_code: "00000001",
        tax_category_code: "Z",
      },
      lines: [],
      buyer: { buyer_country: "US" },
    },
    expectedContext: {
      documentClass: "tax_invoice",
      documentVariant: "credit_note",
      transactionFlags: ["exports"],
      vatTreatments: ["export", "zero_rated"],
      overlays: [],
    },
  },
  {
    id: "credit-note-summary-flag",
    description: "credit note with summary invoice transaction flag",
    input: {
      header: {
        invoice_type: "381",
        seller_country: "AE",
        transaction_type_code: "00010000",
        tax_category_code: "S",
        tax_category_rate: 5,
      },
      lines: [],
      buyer: { buyer_country: "AE" },
    },
    expectedContext: {
      documentClass: "tax_invoice",
      documentVariant: "credit_note",
      transactionFlags: ["summary_invoice"],
      vatTreatments: ["standard_rated"],
      overlays: ["summary_invoice"],
    },
  },
];
