import type {
  ScenarioBusinessScenario,
  ScenarioClassification,
  ScenarioInvoiceInput,
  ScenarioVatTreatment,
} from "@/modules/scenarioLens/types";

const AE_COUNTRY = "AE";

export function classifyInvoice(input: ScenarioInvoiceInput): ScenarioClassification {
  const reasons: string[] = [];

  const header = input.header ?? {};
  const lines = input.lines ?? [];
  const buyer = input.buyer ?? {};

  const invoiceTypeText = readFirstText(header, [
    "invoice_type",
    "invoiceType",
    "document_type",
    "documentType",
    "invoice_type_code",
  ]);

  const profileText = readFirstText(header, ["spec_id", "business_process", "profile_id", "profileId"]);

  const explicitCreditSignal = isCreditIndicator(invoiceTypeText) || readBooleanSignal(header, [
    "is_credit_note",
    "credit_note",
    "creditNote",
  ]);
  const hasNegativeTotalSignal = hasNegativeAmount(header);

  const selfBillingSignal =
    readBooleanSignal(header, ["self_billing", "is_self_billing", "selfBilling"]) ||
    includesAny(profileText, ["self", "selfbilling", "self-billing"]);

  const taxSignals = collectTaxSignals(header, lines);
  const outOfScopeSignal =
    taxSignals.codes.some((code) => isOutOfScopeCode(code)) ||
    readBooleanSignal(header, ["is_out_of_scope", "out_of_scope", "commercial_only"]);

  const reverseChargeSignal =
    readBooleanSignal(header, ["reverse_charge", "is_reverse_charge", "rcm"]) ||
    taxSignals.codes.some((code) => includesAny(code, ["rc", "rcm", "reverse"]));

  const sellerCountry = normalizeCountry(readFirstText(header, ["seller_country", "sellerCountry"]));
  const buyerCountry = normalizeCountry(
    readFirstText(buyer, ["buyer_country", "buyerCountry"]) ||
      readFirstText(header, ["buyer_country", "buyerCountry", "ship_to_country"])
  );
  const exportSignal = Boolean(
    (sellerCountry && buyerCountry && sellerCountry === AE_COUNTRY && buyerCountry !== AE_COUNTRY) ||
      readBooleanSignal(header, ["is_export", "export_sale"])
  );

  const freeZoneSignal =
    readBooleanSignal(header, ["is_free_zone", "free_zone"]) ||
    includesAny(readFirstText(header, ["transaction_type_code", "transactionTypeCode"]), ["free", "fz"]);
  const deemedSupplySignal = readBooleanSignal(header, ["is_deemed_supply", "deemed_supply"]);
  const marginSchemeSignal = readBooleanSignal(header, ["is_margin_scheme", "margin_scheme"]);

  const disclosedAgentSignal = readBooleanSignal(header, [
    "is_disclosed_agent",
    "disclosed_agent",
    "agent_disclosed",
  ]);
  const continuousSupplySignal = readBooleanSignal(header, [
    "is_continuous_supply",
    "continuous_supply",
    "billing_frequency",
  ]);
  const summaryInvoiceSignal = readBooleanSignal(header, [
    "is_summary_invoice",
    "summary_invoice",
    "consolidated_invoice",
  ]);
  const ecommerceSignal = readBooleanSignal(header, ["is_ecommerce", "ecommerce", "is_marketplace"]);

  const isCreditNote = explicitCreditSignal || (hasNegativeTotalSignal && explicitCreditSignal);

  let documentType: ScenarioClassification["documentType"] = "Standard Invoice";
  if (selfBillingSignal) {
    documentType = isCreditNote ? "Self-billing Credit Note" : "Self-billing Invoice";
    reasons.push("Self-billing indicator detected.");
  } else if (outOfScopeSignal) {
    documentType = "Commercial/Out-of-scope";
    reasons.push("Out-of-scope tax signal detected.");
  } else if (isCreditNote) {
    documentType = "Credit Note";
    reasons.push("Credit-note signal detected.");
  } else {
    reasons.push("Defaulted to standard invoice type.");
  }

  const vatTreatments = new Set<ScenarioVatTreatment>();
  if (exportSignal) {
    vatTreatments.add("Export");
    reasons.push(`Export signal from country context (${sellerCountry || "?"} -> ${buyerCountry || "?"}).`);
  }
  if (reverseChargeSignal) {
    vatTreatments.add("Reverse charge");
    reasons.push("Reverse-charge signal detected.");
  }
  if (outOfScopeSignal) {
    vatTreatments.add("Out-of-scope");
  }
  if (freeZoneSignal) vatTreatments.add("Free Zone");
  if (deemedSupplySignal) vatTreatments.add("Deemed supply");
  if (marginSchemeSignal) vatTreatments.add("Margin scheme");

  if (taxSignals.codes.some((code) => isStandardCode(code)) || taxSignals.rates.some((rate) => rate > 0)) {
    vatTreatments.add("Standard-rated");
  }
  if (taxSignals.codes.some((code) => isZeroCode(code))) {
    vatTreatments.add("Zero-rated");
  }
  if (taxSignals.codes.some((code) => isExemptCode(code))) {
    vatTreatments.add("Exempt");
  }

  const businessScenarios = new Set<ScenarioBusinessScenario>();
  if (disclosedAgentSignal) {
    businessScenarios.add("Disclosed agent");
    reasons.push("Disclosed-agent indicator detected.");
  }
  if (continuousSupplySignal) {
    businessScenarios.add("Continuous supply");
    reasons.push("Continuous-supply indicator detected.");
  }
  if (summaryInvoiceSignal) {
    businessScenarios.add("Summary invoice");
    reasons.push("Summary-invoice indicator detected.");
  }
  if (ecommerceSignal) {
    businessScenarios.add("E-commerce");
    reasons.push("E-commerce indicator detected.");
  }
  if (businessScenarios.size === 0) {
    businessScenarios.add("None");
  }

  const confidence = computeConfidenceScore({
    explicitCreditSignal,
    selfBillingSignal,
    reverseChargeSignal,
    outOfScopeSignal,
    exportSignal,
    hasTaxSignals: taxSignals.codes.length > 0 || taxSignals.rates.length > 0,
    hasBusinessSignals:
      disclosedAgentSignal || continuousSupplySignal || summaryInvoiceSignal || ecommerceSignal,
  });

  return {
    documentType,
    vatTreatments: Array.from(vatTreatments),
    businessScenarios: Array.from(businessScenarios),
    confidence,
    reasons,
  };
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

  return { codes: dedupe(codes.map(normalizeText).filter(Boolean)), rates: dedupe(rates) };
}

function isCreditIndicator(value: string): boolean {
  return includesAny(value, ["credit note", "credit_note", "381", "cn"]);
}

function hasNegativeAmount(header: Record<string, unknown>): boolean {
  const candidates = [
    readNumber(header, ["total_incl_vat", "totalInclVat"]),
    readNumber(header, ["total_excl_vat", "totalExclVat"]),
    readNumber(header, ["amount_due", "amountDue"]),
  ].filter((value): value is number => value !== null);

  return candidates.some((value) => value < 0);
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

function readFirstText(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return "";
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

function computeConfidenceScore(signals: {
  explicitCreditSignal: boolean;
  selfBillingSignal: boolean;
  reverseChargeSignal: boolean;
  outOfScopeSignal: boolean;
  exportSignal: boolean;
  hasTaxSignals: boolean;
  hasBusinessSignals: boolean;
}): number | undefined {
  let score = 0;
  if (signals.explicitCreditSignal) score += 20;
  if (signals.selfBillingSignal) score += 20;
  if (signals.reverseChargeSignal || signals.outOfScopeSignal) score += 15;
  if (signals.exportSignal) score += 15;
  if (signals.hasTaxSignals) score += 20;
  if (signals.hasBusinessSignals) score += 10;

  if (score === 0) return undefined;
  return Math.min(score, 100);
}
