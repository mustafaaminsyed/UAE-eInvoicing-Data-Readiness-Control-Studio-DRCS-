import type { Buyer, InvoiceHeader, InvoiceLine } from "@/types/compliance";

export const DOCUMENT_TYPE_OPTIONS = [
  "All",
  "Standard Invoice",
  "Credit Note",
  "Commercial/Out-of-scope",
  "Self-billing Invoice",
  "Self-billing Credit Note",
] as const;

export const VAT_TREATMENT_OPTIONS = [
  "All",
  "Standard-rated",
  "Zero-rated",
  "Exempt",
  "Out-of-scope",
  "Reverse charge",
  "Export",
  "Free Zone",
  "Deemed supply",
  "Margin scheme",
] as const;

export const BUSINESS_SCENARIO_OPTIONS = [
  "All",
  "None",
  "Disclosed agent",
  "Continuous supply",
  "Summary invoice",
  "E-commerce",
] as const;

export const CONFIDENCE_OPTIONS = ["All", "High", "Medium", "Low"] as const;

export type ScenarioDocumentType = Exclude<(typeof DOCUMENT_TYPE_OPTIONS)[number], "All">;
export type ScenarioVatTreatment = Exclude<(typeof VAT_TREATMENT_OPTIONS)[number], "All">;
export type ScenarioBusinessScenario = Exclude<(typeof BUSINESS_SCENARIO_OPTIONS)[number], "All">;
export type ScenarioConfidenceBand = Exclude<(typeof CONFIDENCE_OPTIONS)[number], "All">;

export type ScenarioDocumentTypeFilter = (typeof DOCUMENT_TYPE_OPTIONS)[number];
export type ScenarioVatTreatmentFilter = (typeof VAT_TREATMENT_OPTIONS)[number];
export type ScenarioBusinessScenarioFilter = (typeof BUSINESS_SCENARIO_OPTIONS)[number];
export type ScenarioConfidenceFilter = (typeof CONFIDENCE_OPTIONS)[number];

export interface ScenarioLensFilters {
  documentType: ScenarioDocumentTypeFilter;
  vatTreatment: ScenarioVatTreatmentFilter;
  businessScenario: ScenarioBusinessScenarioFilter;
  confidence: ScenarioConfidenceFilter;
}

export interface ScenarioHeaderExtensions {
  transactionTypeCode?: string;
  invoiceType?: string;
  document_type?: string;
  documentType?: string;
  mof_document_type?: string;
  mofDocumentType?: string;
  profile_id?: string;
  profileId?: string;
  is_credit_note?: boolean | string;
  credit_note?: boolean | string;
  creditNote?: boolean | string;
  self_billing?: boolean | string;
  is_self_billing?: boolean | string;
  selfBilling?: boolean | string;
  reverse_charge?: boolean | string;
  is_reverse_charge?: boolean | string;
  rcm?: boolean | string;
  is_out_of_scope?: boolean | string;
  out_of_scope?: boolean | string;
  commercial_only?: boolean | string;
  is_export?: boolean | string;
  export_sale?: boolean | string;
  is_continuous_supply?: boolean | string;
  continuous_supply?: boolean | string;
  billing_frequency?: boolean | string;
  is_summary_invoice?: boolean | string;
  summary_invoice?: boolean | string;
  consolidated_invoice?: boolean | string;
  is_disclosed_agent?: boolean | string;
  disclosed_agent?: boolean | string;
  agent_disclosed?: boolean | string;
  is_ecommerce?: boolean | string;
  ecommerce?: boolean | string;
  is_marketplace?: boolean | string;
  taxCategoryCode?: string;
  vat_category?: string;
  taxCategoryRate?: number | string;
  vat_rate?: number | string;
  sellerCountry?: string;
  buyer_country?: string;
  buyerCountry?: string;
  ship_to_country?: string;
}

export type ScenarioHeaderInput = Partial<InvoiceHeader> & ScenarioHeaderExtensions;
export type ScenarioBuyerInput = Partial<Buyer> & { buyerCountry?: string };
export type ScenarioLineInput = Partial<InvoiceLine> & {
  taxCategoryCode?: string;
  vat_category?: string;
  vatRate?: number | string;
};

export interface ScenarioClassification {
  documentType: ScenarioDocumentType;
  vatTreatments: ScenarioVatTreatment[];
  businessScenarios: ScenarioBusinessScenario[];
  confidence?: number;
  reasons: string[];
}

export interface ScenarioInvoiceInput {
  header: ScenarioHeaderInput;
  lines: Array<ScenarioLineInput>;
  buyer?: ScenarioBuyerInput | null;
}

export interface ScenarioLensInvoice {
  invoiceId: string;
  invoiceNumber: string;
  issueDate?: string;
  sellerTrn?: string;
  buyerId?: string;
  sellerCountry?: string;
  buyerCountry?: string;
  currency?: string;
  header: ScenarioHeaderInput;
  lines: Array<ScenarioLineInput>;
  classification: ScenarioClassification;
}

export type ScenarioDistributionDimension =
  | "documentType"
  | "vatTreatments"
  | "businessScenarios"
  | "confidence";

export interface ScenarioDistributionRow {
  key: string;
  count: number;
  percentage: number;
}

export interface ScenarioCoverageSummary {
  documentTypesPresent: number;
  vatTreatmentsPresent: number;
  businessScenariosPresent: number;
  invoicesInSelection: number;
}

export const DEFAULT_SCENARIO_FILTERS: ScenarioLensFilters = {
  documentType: "All",
  vatTreatment: "All",
  businessScenario: "All",
  confidence: "All",
};
