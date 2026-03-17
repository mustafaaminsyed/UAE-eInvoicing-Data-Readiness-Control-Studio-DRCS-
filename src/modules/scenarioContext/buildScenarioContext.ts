import type { Buyer, InvoiceHeader, InvoiceLine } from "@/types/compliance";
import type { ScenarioInvoiceInput } from "@/modules/scenarioLens/types";
import { decodeTransactionTypeCode } from "@/modules/scenarioContext/transactionTypeCode";
import type {
  InvoiceScenarioContextRecord,
  ScenarioContext,
  ScenarioDocumentClass,
  ScenarioDocumentVariant,
  ScenarioEvidence,
  ScenarioOverlay,
  ScenarioTransactionFlag,
  ScenarioVatTreatment,
} from "@/types/scenarioContext";

const AE_COUNTRY = "AE";

export function buildScenarioContext(input: ScenarioInvoiceInput): ScenarioContext {
  const header = input.header ?? {};
  const lines = input.lines ?? [];
  const buyer = input.buyer ?? {};
  const transactionTypeCode = decodeTransactionTypeCode(
    readFirstText(header, ["transaction_type_code", "transactionTypeCode"])
  );

  const invoiceTypeText = readFirstText(header, [
    "invoice_type",
    "invoiceType",
    "document_type",
    "documentType",
    "invoice_type_code",
  ]);
  const documentTypeText = readFirstText(header, [
    "document_type",
    "documentType",
    "mof_document_type",
    "mofDocumentType",
  ]);
  const profileText = readFirstText(header, ["spec_id", "business_process", "profile_id", "profileId"]);
  const selfBillingFieldValue = readKnownValue(header, ["self_billing", "is_self_billing", "selfBilling"]);
  const profileEvidenceField = readFirstText(header, ["spec_id", "business_process", "profile_id", "profileId"]);

  const explicitCreditSignal =
    isCreditIndicator(invoiceTypeText) ||
    readBooleanSignal(header, ["is_credit_note", "credit_note", "creditNote"]);
  const selfBillingSignal =
    readBooleanSignal(header, ["self_billing", "is_self_billing", "selfBilling"]) ||
    includesAny(profileText, ["self", "selfbilling", "self-billing"]);
  const taxSignals = collectTaxSignals(header, lines);
  const outOfScopeSignal =
    taxSignals.codes.some((code) => isOutOfScopeCode(code)) ||
    readBooleanSignal(header, ["is_out_of_scope", "out_of_scope", "commercial_only"]);
  const reverseChargeSignal =
    readBooleanSignal(header, ["reverse_charge", "is_reverse_charge", "rcm"]) ||
    taxSignals.codes.some((code) => isReverseChargeCode(code));

  const sellerCountry = normalizeCountry(readFirstText(header, ["seller_country", "sellerCountry"]));
  const buyerCountry = normalizeCountry(
    readFirstText(buyer, ["buyer_country", "buyerCountry"]) ||
      readFirstText(header, ["buyer_country", "buyerCountry", "ship_to_country"])
  );

  const exportSignal =
    transactionTypeCode.activeFlags.includes("exports") ||
    Boolean(
      (sellerCountry && buyerCountry && sellerCountry === AE_COUNTRY && buyerCountry !== AE_COUNTRY) ||
        readBooleanSignal(header, ["is_export", "export_sale"])
    );

  const commercialSignal =
    isCommercialDocumentType(documentTypeText) ||
    isCommercialInvoiceType(invoiceTypeText) ||
    outOfScopeSignal;

  const documentClass = deriveDocumentClass({
    commercialSignal,
    documentTypeText,
    invoiceTypeText,
    outOfScopeSignal,
  });
  const documentVariant = deriveDocumentVariant({
    selfBillingSignal,
    explicitCreditSignal,
    commercialSignal,
  });

  const transactionFlagsEvidence = transactionTypeCode.activeDefinitions.flatMap((definition) => definition.evidence);
  const vatTreatmentState = createCollectionState<ScenarioVatTreatment>();
  const overlayState = createCollectionState<ScenarioOverlay>();

  if (exportSignal) {
    vatTreatmentState.add(
      "export",
      buildEvidence(
        exportSignal && transactionTypeCode.activeFlags.includes("exports") ? "transaction_type_code" : "derived",
        transactionTypeCode.activeFlags.includes("exports") ? "transaction_type_code" : "buyer_country",
        transactionTypeCode.activeFlags.includes("exports")
          ? transactionTypeCode.normalized
          : `${sellerCountry || "?"}->${buyerCountry || "?"}`,
        transactionTypeCode.activeFlags.includes("exports")
          ? "Export flag derived from transaction_type_code."
          : "Export derived from seller/buyer country context."
      )
    );
  }

  if (reverseChargeSignal) {
    vatTreatmentState.add(
      "reverse_charge",
      buildEvidence("header", "reverse_charge", readKnownValue(header, ["reverse_charge", "is_reverse_charge", "rcm"]), "Reverse-charge indicator detected.")
    );
  }

  if (outOfScopeSignal) {
    vatTreatmentState.add(
      "out_of_scope",
      buildEvidence("header", "tax_category_code", readKnownValue(header, ["tax_category_code", "taxCategoryCode", "vat_category"]), "Out-of-scope tax signal detected.")
    );
  }

  transactionTypeCode.activeFlags.forEach((flag) => {
    if (flag === "free_trade_zone") {
      vatTreatmentState.add("free_trade_zone", evidenceFromDecodedFlag(transactionTypeCode, flag));
    }
    if (flag === "deemed_supply") {
      vatTreatmentState.add("deemed_supply", evidenceFromDecodedFlag(transactionTypeCode, flag));
    }
    if (flag === "margin_scheme") {
      vatTreatmentState.add("margin_scheme", evidenceFromDecodedFlag(transactionTypeCode, flag));
    }
    if (flag === "summary_invoice") {
      overlayState.add("summary_invoice", evidenceFromDecodedFlag(transactionTypeCode, flag));
    }
    if (flag === "disclosed_agent_billing") {
      overlayState.add("disclosed_agent_billing", evidenceFromDecodedFlag(transactionTypeCode, flag));
    }
    if (flag === "ecommerce_supplies") {
      overlayState.add("ecommerce_supplies", evidenceFromDecodedFlag(transactionTypeCode, flag));
    }
  });

  if (taxSignals.codes.some((code) => isStandardCode(code)) || taxSignals.rates.some((rate) => rate > 0)) {
    vatTreatmentState.add(
      "standard_rated",
      buildEvidence("header", "tax_category_code", firstOrNull(taxSignals.codes), "Standard-rated tax signal detected.")
    );
  }
  if (taxSignals.codes.some((code) => isZeroCode(code))) {
    vatTreatmentState.add(
      "zero_rated",
      buildEvidence("header", "tax_category_code", firstOrNull(taxSignals.codes), "Zero-rated tax signal detected.")
    );
  }
  if (taxSignals.codes.some((code) => isExemptCode(code))) {
    vatTreatmentState.add(
      "exempt",
      buildEvidence("header", "tax_category_code", firstOrNull(taxSignals.codes), "Exempt tax signal detected.")
    );
  }

  if (readBooleanSignal(header, ["is_continuous_supply", "continuous_supply", "billing_frequency"])) {
    overlayState.add(
      "continuous_supply",
      buildEvidence(
        "header",
        "continuous_supply",
        readKnownValue(header, ["is_continuous_supply", "continuous_supply", "billing_frequency"]),
        "Continuous-supply indicator detected."
      )
    );
  }

  if (
    !overlayState.has("summary_invoice") &&
    readBooleanSignal(header, ["is_summary_invoice", "summary_invoice", "consolidated_invoice"])
  ) {
    overlayState.add(
      "summary_invoice",
      buildEvidence(
        "header",
        "summary_invoice",
        readKnownValue(header, ["is_summary_invoice", "summary_invoice", "consolidated_invoice"]),
        "Summary-invoice indicator detected."
      )
    );
  }

  if (
    !overlayState.has("disclosed_agent_billing") &&
    readBooleanSignal(header, ["is_disclosed_agent", "disclosed_agent", "agent_disclosed"])
  ) {
    overlayState.add(
      "disclosed_agent_billing",
      buildEvidence(
        "header",
        "disclosed_agent",
        readKnownValue(header, ["is_disclosed_agent", "disclosed_agent", "agent_disclosed"]),
        "Disclosed-agent indicator detected."
      )
    );
  }

  if (!overlayState.has("ecommerce_supplies") && readBooleanSignal(header, ["is_ecommerce", "ecommerce", "is_marketplace"])) {
    overlayState.add(
      "ecommerce_supplies",
      buildEvidence(
        "header",
        "ecommerce",
        readKnownValue(header, ["is_ecommerce", "ecommerce", "is_marketplace"]),
        "E-commerce indicator detected."
      )
    );
  }

  return {
    version: "shadow-v1",
    authoritative: false,
    documentClass: {
      value: documentClass,
      authoritative: false,
      evidence: buildDocumentClassEvidence(documentClass, documentTypeText, invoiceTypeText, outOfScopeSignal),
    },
    documentVariant: {
      value: documentVariant,
      authoritative: false,
      evidence: buildDocumentVariantEvidence(
        documentVariant,
        selfBillingSignal,
        explicitCreditSignal,
        selfBillingFieldValue,
        profileEvidenceField,
        invoiceTypeText
      ),
    },
    transactionFlags: {
      value: transactionTypeCode.activeFlags,
      authoritative: false,
      evidence: transactionFlagsEvidence,
    },
    vatTreatments: {
      value: vatTreatmentState.values(),
      authoritative: false,
      evidence: vatTreatmentState.evidence(),
    },
    overlays: {
      value: overlayState.values(),
      authoritative: false,
      evidence: overlayState.evidence(),
    },
    transactionTypeCode,
  };
}

export function buildScenarioContextRecord(
  header: InvoiceHeader,
  lines: InvoiceLine[],
  buyer?: Buyer | null
): InvoiceScenarioContextRecord {
  return {
    invoiceId: header.invoice_id,
    invoiceNumber: header.invoice_number,
    scenarioContext: buildScenarioContext({
      header,
      lines,
      buyer: buyer ?? null,
    }),
  };
}

export function buildScenarioContextRecords(
  headers: InvoiceHeader[],
  lines: InvoiceLine[],
  buyers: Buyer[]
): InvoiceScenarioContextRecord[] {
  const linesByInvoice = new Map<string, InvoiceLine[]>();
  lines.forEach((line) => {
    const invoiceLines = linesByInvoice.get(line.invoice_id) ?? [];
    invoiceLines.push(line);
    linesByInvoice.set(line.invoice_id, invoiceLines);
  });
  const buyerMap = new Map<string, Buyer>(buyers.map((buyer) => [buyer.buyer_id, buyer]));

  return headers.map((header) => {
    return buildScenarioContextRecord(header, linesByInvoice.get(header.invoice_id) ?? [], buyerMap.get(header.buyer_id));
  });
}

function deriveDocumentClass(input: {
  commercialSignal: boolean;
  documentTypeText: string;
  invoiceTypeText: string;
  outOfScopeSignal: boolean;
}): ScenarioDocumentClass {
  if (input.commercialSignal) return "commercial_invoice";
  if (input.documentTypeText || input.invoiceTypeText || input.outOfScopeSignal) return "tax_invoice";
  return "unknown";
}

function deriveDocumentVariant(input: {
  selfBillingSignal: boolean;
  explicitCreditSignal: boolean;
  commercialSignal: boolean;
}): ScenarioDocumentVariant {
  if (input.selfBillingSignal) {
    return input.explicitCreditSignal ? "self_billing_credit_note" : "self_billing";
  }
  if (input.commercialSignal) {
    return input.explicitCreditSignal ? "commercial_credit_note" : "commercial_invoice";
  }
  if (input.explicitCreditSignal) {
    return "credit_note";
  }
  return "standard";
}

function buildDocumentClassEvidence(
  documentClass: ScenarioDocumentClass,
  documentTypeText: string,
  invoiceTypeText: string,
  outOfScopeSignal: boolean
): ScenarioEvidence[] {
  if (documentClass === "commercial_invoice") {
    return [
      buildEvidence(
        documentTypeText ? "header" : invoiceTypeText ? "header" : "derived",
        documentTypeText ? "document_type" : invoiceTypeText ? "invoice_type" : "tax_category_code",
        documentTypeText || invoiceTypeText || String(outOfScopeSignal),
        "Commercial class derived from explicit document type, invoice type, or out-of-scope signal."
      )[0],
    ];
  }
  if (documentClass === "tax_invoice") {
    return [
      buildEvidence(
        invoiceTypeText ? "header" : "derived",
        invoiceTypeText ? "invoice_type" : "document_type",
        invoiceTypeText || documentTypeText || null,
        "Tax class used as the default non-commercial document family."
      )[0],
    ];
  }
  return [buildEvidence("derived", "document_class", null, "No document-class evidence was available.")[0]];
}

function buildDocumentVariantEvidence(
  documentVariant: ScenarioDocumentVariant,
  selfBillingSignal: boolean,
  explicitCreditSignal: boolean,
  selfBillingFieldValue: string | number | boolean | null,
  profileEvidenceField: string,
  invoiceTypeText: string
): ScenarioEvidence[] {
  if (selfBillingSignal && selfBillingFieldValue !== null) {
    return [
      buildEvidence("header", "self_billing", selfBillingFieldValue, `Document variant derived as ${documentVariant}.`)[0],
    ];
  }
  if (selfBillingSignal && profileEvidenceField) {
    return [
      buildEvidence(
        "header",
        profileEvidenceField.includes("selfbilling") ? "spec_id" : "business_process",
        profileEvidenceField,
        `Document variant derived as ${documentVariant} from self-billing profile evidence.`
      )[0],
    ];
  }
  if (explicitCreditSignal) {
    return [
      buildEvidence("header", "invoice_type", invoiceTypeText || null, `Document variant derived as ${documentVariant}.`)[0],
    ];
  }
  return [
    buildEvidence(
      "derived",
      "document_variant",
      null,
      `Document variant derived as ${documentVariant}.`
    )[0],
  ];
}

function evidenceFromDecodedFlag(
  decoded: ReturnType<typeof decodeTransactionTypeCode>,
  flag: ScenarioTransactionFlag
): ScenarioEvidence[] {
  return decoded.activeDefinitions.find((definition) => definition.flag === flag)?.evidence ?? [];
}

function collectTaxSignals(
  header: Record<string, unknown>,
  lines: Array<Record<string, unknown>>
): { codes: string[]; rates: number[] } {
  const codes: string[] = [];
  const rates: number[] = [];

  const headerCode = readFirstText(header, ["tax_category_code", "taxCategoryCode", "vat_category"]);
  if (headerCode) codes.push(headerCode);

  const headerRate = readNumber(header, ["tax_category_rate", "taxCategoryRate", "vat_rate"]);
  if (headerRate !== null) rates.push(headerRate);

  lines.forEach((line) => {
    const lineCode = readFirstText(line, ["tax_category_code", "taxCategoryCode", "vat_category"]);
    if (lineCode) codes.push(lineCode);
    const lineRate = readNumber(line, ["vat_rate", "tax_category_rate", "vatRate"]);
    if (lineRate !== null) rates.push(lineRate);
  });

  return {
    codes: dedupe(codes.map(normalizeText).filter(Boolean)),
    rates: dedupe(rates),
  };
}

function isCommercialDocumentType(value: string): boolean {
  const normalized = normalizeText(value);
  return normalized === "commercial" || normalized === "commercial_xml";
}

function isCommercialInvoiceType(value: string): boolean {
  const normalized = normalizeText(value);
  return normalized === "388" || normalized.includes("commercial");
}

function isCreditIndicator(value: string): boolean {
  return includesAny(value, ["credit note", "credit_note", "381", "cn"]);
}

function isOutOfScopeCode(code: string): boolean {
  return includesAny(code, ["out", "outside", "oos", "notax", "scope"]);
}

function isStandardCode(code: string): boolean {
  return includesAny(code, ["s", "standard", "std"]);
}

function isZeroCode(code: string): boolean {
  return includesAny(code, ["z", "zero"]);
}

function isExemptCode(code: string): boolean {
  return includesAny(code, ["e", "exempt"]);
}

function isReverseChargeCode(code: string): boolean {
  return includesAny(code, ["ae", "rc", "rcm", "reverse"]);
}

function readFirstText(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return "";
}

function readKnownValue(source: Record<string, unknown>, keys: string[]): string | number | boolean | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "boolean") return value;
  }
  return null;
}

function readBooleanSignal(source: Record<string, unknown>, keys: string[]): boolean {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value === 1;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "yes", "y", "1"].includes(normalized)) return true;
    }
  }
  return false;
}

function readNumber(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeCountry(value: string): string {
  if (!value) return "";
  const normalized = value.trim().toUpperCase();
  if (normalized === "UAE" || normalized === "ARE") return AE_COUNTRY;
  return normalized;
}

function includesAny(raw: string, terms: string[]): boolean {
  const value = normalizeText(raw);
  return value.length > 0 && terms.some((term) => value.includes(term));
}

function dedupe<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function buildEvidence(
  source: ScenarioEvidence["source"],
  field: string,
  value: string | number | boolean | null,
  note: string
): ScenarioEvidence[] {
  return [{ source, field, value, note }];
}

function firstOrNull<T>(values: T[]): T | null {
  return values[0] ?? null;
}

function createCollectionState<T extends string>() {
  const values = new Set<T>();
  const evidence: ScenarioEvidence[] = [];

  return {
    add(value: T, nextEvidence: ScenarioEvidence[]) {
      values.add(value);
      evidence.push(...nextEvidence);
    },
    has(value: T) {
      return values.has(value);
    },
    values() {
      return Array.from(values);
    },
    evidence() {
      return evidence;
    },
  };
}
