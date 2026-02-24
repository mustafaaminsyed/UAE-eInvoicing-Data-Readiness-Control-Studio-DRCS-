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

export interface ScenarioClassification {
  documentType: ScenarioDocumentType;
  vatTreatments: ScenarioVatTreatment[];
  businessScenarios: ScenarioBusinessScenario[];
  confidence?: number;
  reasons: string[];
}

export interface ScenarioInvoiceInput {
  header: Partial<InvoiceHeader> & Record<string, unknown>;
  lines: Array<Partial<InvoiceLine> & Record<string, unknown>>;
  buyer?: (Partial<Buyer> & Record<string, unknown>) | null;
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
  header: Partial<InvoiceHeader> & Record<string, unknown>;
  lines: Array<Partial<InvoiceLine> & Record<string, unknown>>;
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
