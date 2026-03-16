export type ScenarioDocumentClass = "tax_invoice" | "commercial_invoice" | "unknown";

export type ScenarioDocumentVariant =
  | "standard"
  | "credit_note"
  | "self_billing"
  | "self_billing_credit_note"
  | "commercial_invoice"
  | "commercial_credit_note"
  | "unknown";

export type ScenarioTransactionFlag =
  | "free_trade_zone"
  | "deemed_supply"
  | "margin_scheme"
  | "summary_invoice"
  | "reserved_policy_flag"
  | "disclosed_agent_billing"
  | "ecommerce_supplies"
  | "exports";

export type ScenarioVatTreatment =
  | "standard_rated"
  | "zero_rated"
  | "exempt"
  | "out_of_scope"
  | "reverse_charge"
  | "export"
  | "free_trade_zone"
  | "deemed_supply"
  | "margin_scheme";

export type ScenarioOverlay =
  | "disclosed_agent_billing"
  | "continuous_supply"
  | "summary_invoice"
  | "ecommerce_supplies";

export type ScenarioEvidenceSource = "header" | "line" | "buyer" | "transaction_type_code" | "derived";

export interface ScenarioEvidence {
  source: ScenarioEvidenceSource;
  field: string;
  value: string | number | boolean | null;
  note: string;
}

export interface ScenarioDerivedValue<T> {
  value: T;
  authoritative: false;
  evidence: ScenarioEvidence[];
}

export interface TransactionTypeFlagDefinition {
  bitPosition: number;
  mask: string;
  flag: ScenarioTransactionFlag;
  label: string;
  note: string;
}

export interface DecodedTransactionTypeFlag {
  bitPosition: number;
  mask: string;
  flag: ScenarioTransactionFlag;
  label: string;
  note: string;
  evidence: ScenarioEvidence[];
}

export interface DecodedTransactionTypeCode {
  raw: string;
  normalized: string;
  format: "binary" | "mask" | "invalid" | "missing";
  valid: boolean;
  activeFlags: ScenarioTransactionFlag[];
  activeDefinitions: DecodedTransactionTypeFlag[];
  issues: string[];
  evidence: ScenarioEvidence[];
}

export interface ScenarioContext {
  version: "shadow-v1";
  authoritative: false;
  documentClass: ScenarioDerivedValue<ScenarioDocumentClass>;
  documentVariant: ScenarioDerivedValue<ScenarioDocumentVariant>;
  transactionFlags: ScenarioDerivedValue<ScenarioTransactionFlag[]>;
  vatTreatments: ScenarioDerivedValue<ScenarioVatTreatment[]>;
  overlays: ScenarioDerivedValue<ScenarioOverlay[]>;
  transactionTypeCode: DecodedTransactionTypeCode;
}

export interface InvoiceScenarioContextRecord {
  invoiceId: string;
  invoiceNumber?: string;
  scenarioContext: ScenarioContext;
}
