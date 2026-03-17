import UAE_UC1_CHECK_PACK from "@/lib/checks/uaeUC1CheckPack";
import { getValidationDRTargets } from "@/lib/registry/validationToDRMap";
import { classifyInvoice } from "@/modules/scenarioLens/classifyInvoice";
import type {
  ScenarioBusinessScenario,
  ScenarioClassification,
  ScenarioDocumentType,
  ScenarioInvoiceInput,
  ScenarioVatTreatment as LegacyScenarioVatTreatment,
} from "@/modules/scenarioLens/types";
import { buildScenarioContext } from "@/modules/scenarioContext/buildScenarioContext";
import type { ScenarioParityFixture } from "@/modules/scenarioContext/fixtures";
import type { PintAECheck } from "@/types/pintAE";
import type {
  ScenarioContext,
  ScenarioDocumentVariant,
  ScenarioEvidence,
  ScenarioTransactionFlag,
} from "@/types/scenarioContext";

export type ApplicabilityState = "applicable" | "not_applicable" | "not_modeled";
export type ApplicabilityRuleFamily =
  | "document_family"
  | "vat_treatment"
  | "transaction_flag"
  | "overlay"
  | "credit_note_specialized";
export type DifferenceStatus =
  | "aligned"
  | "both_not_applicable"
  | "shadow_only_applicable"
  | "legacy_only_applicable";
export type DivergenceReviewCategory =
  | "none"
  | "expected_improvement"
  | "potential_regression"
  | "policy_review";
export type LegacyApplicabilityPath = "explicit" | "heuristic" | "not_modeled";
export type ScenarioContextAttribute =
  | "documentClass"
  | "documentVariant"
  | "transactionFlags"
  | "vatTreatments"
  | "overlays";

export interface ApplicabilityEvaluation {
  state: ApplicabilityState;
  reason: string;
  attributesUsed: ScenarioContextAttribute[];
}

export interface ShadowApplicabilityDefinition {
  ruleId: string;
  title: string;
  family: ApplicabilityRuleFamily;
  source: "runtime_check" | "shadow_only";
  linkedDrIds: string[];
  legacy: {
    kind: LegacyApplicabilityPath;
    evaluate?: (context: ScenarioContext, input: ScenarioInvoiceInput) => ApplicabilityEvaluation;
  };
  shadowEvaluation: (context: ScenarioContext, input: ScenarioInvoiceInput) => ApplicabilityEvaluation;
  shadowOnlyCategory?: Exclude<DivergenceReviewCategory, "none">;
  legacyOnlyCategory?: Exclude<DivergenceReviewCategory, "none">;
}

export interface RuleApplicabilityComparisonRow {
  ruleId: string;
  title: string;
  family: ApplicabilityRuleFamily;
  source: "runtime_check" | "shadow_only";
  legacyApplicability: ApplicabilityState;
  shadowApplicability: ApplicabilityState;
  legacyPathType: LegacyApplicabilityPath;
  legacyReason: string;
  shadowReason: string;
  differenceStatus: DifferenceStatus;
  reviewCategory: DivergenceReviewCategory;
  divergenceReason: string | null;
  linkedDrIds: string[];
  scenarioAttributesUsed: ScenarioContextAttribute[];
  scenarioEvidence: ScenarioEvidence[];
}

export interface RuleApplicabilityComparisonReport {
  fixtureId: string;
  description: string;
  rows: RuleApplicabilityComparisonRow[];
  summary: {
    totalRules: number;
    divergentRules: number;
    expectedImprovementCount: number;
    potentialRegressionCount: number;
    policyReviewCount: number;
  };
}

const CHECKS_BY_ID = new Map(UAE_UC1_CHECK_PACK.map((check) => [check.check_id, check]));

const SHADOW_APPLICABILITY_DEFINITIONS: ShadowApplicabilityDefinition[] = [
  createRuntimeDefinition("UAE-UC1-CHK-036", "document_family", ["documentClass"], (context) => {
    return context.documentClass.value === "commercial_invoice"
      ? applicable("ScenarioContext classified the invoice as commercial.", ["documentClass"])
      : notApplicable("ScenarioContext did not classify the invoice as commercial.", ["documentClass"]);
  }),
  createRuntimeDefinition("UAE-UC1-CHK-037", "document_family", ["documentClass"], (context) => {
    return context.documentClass.value === "commercial_invoice"
      ? applicable("ScenarioContext classified the invoice as commercial.", ["documentClass"])
      : notApplicable("ScenarioContext did not classify the invoice as commercial.", ["documentClass"]);
  }),
  createRuntimeDefinition("UAE-UC1-CHK-045", "document_family", ["documentVariant"], (context) => {
    return isCreditNoteVariant(context.documentVariant.value)
      ? notApplicable("ScenarioContext classified the invoice as a credit-note variant.", ["documentVariant"])
      : applicable("ScenarioContext classified the invoice as an invoice-context document.", ["documentVariant"]);
  }),
  createRuntimeDefinition("UAE-UC1-CHK-046", "document_family", ["documentVariant"], (context) => {
    return isCreditNoteVariant(context.documentVariant.value)
      ? applicable("ScenarioContext classified the invoice as a credit-note variant.", ["documentVariant"])
      : notApplicable("ScenarioContext did not classify the invoice as a credit-note variant.", ["documentVariant"]);
  }),
  createRuntimeDefinition("UAE-UC1-CHK-049", "vat_treatment", ["vatTreatments"], (context) => {
    return context.vatTreatments.value.includes("exempt")
      ? applicable("ScenarioContext derived an exempt VAT treatment.", ["vatTreatments"])
      : notApplicable("ScenarioContext did not derive an exempt VAT treatment.", ["vatTreatments"]);
  }),
  createRuntimeDefinition("UAE-UC1-CHK-050", "vat_treatment", ["vatTreatments"], (context) => {
    return context.vatTreatments.value.includes("exempt")
      ? applicable("ScenarioContext derived an exempt VAT treatment.", ["vatTreatments"])
      : notApplicable("ScenarioContext did not derive an exempt VAT treatment.", ["vatTreatments"]);
  }),
  createRuntimeDefinition("UAE-UC1-CHK-051", "vat_treatment", ["vatTreatments"], (context) => {
    return context.vatTreatments.value.includes("reverse_charge")
      ? applicable("ScenarioContext derived a reverse-charge VAT treatment.", ["vatTreatments"])
      : notApplicable("ScenarioContext did not derive a reverse-charge VAT treatment.", ["vatTreatments"]);
  }),
  createRuntimeDefinition("UAE-UC1-CHK-052", "vat_treatment", ["vatTreatments"], (context) => {
    return context.vatTreatments.value.includes("reverse_charge")
      ? applicable("ScenarioContext derived a reverse-charge VAT treatment.", ["vatTreatments"])
      : notApplicable("ScenarioContext did not derive a reverse-charge VAT treatment.", ["vatTreatments"]);
  }),
  {
    ruleId: "IBR-007-AE",
    title: "Free Trade Zone Beneficiary ID Requirement",
    family: "transaction_flag",
    source: "shadow_only",
    linkedDrIds: ["BTUAE-02", "BTAE-01"],
    legacy: {
      kind: "heuristic",
      evaluate: (context, input) =>
        evaluateLegacyVatTreatmentHeuristic(
          context,
          input,
          "Free Zone",
          "Legacy scenario lens inferred a Free Zone treatment."
        ),
    },
    shadowEvaluation: (context) =>
      evaluateShadowTransactionFlag(
        context,
        "free_trade_zone",
        "Free trade zone transaction flag is active.",
        ["transactionFlags", "vatTreatments"]
      ),
    shadowOnlyCategory: "expected_improvement",
  },
  {
    ruleId: "IBR-116-AE",
    title: "Margin Scheme VAT Category Constraint",
    family: "transaction_flag",
    source: "shadow_only",
    linkedDrIds: ["BTUAE-02", "IBT-151"],
    legacy: {
      kind: "heuristic",
      evaluate: (context, input) =>
        evaluateLegacyVatTreatmentHeuristic(
          context,
          input,
          "Margin scheme",
          "Legacy scenario lens inferred a Margin scheme treatment."
        ),
    },
    shadowEvaluation: (context) =>
      evaluateShadowTransactionFlag(
        context,
        "margin_scheme",
        "Margin-scheme transaction flag is active.",
        ["transactionFlags", "vatTreatments"]
      ),
    shadowOnlyCategory: "expected_improvement",
  },
  {
    ruleId: "IBR-127-AE",
    title: "Payment Due Date Requirement With Deemed Supply Exception",
    family: "transaction_flag",
    source: "shadow_only",
    linkedDrIds: ["IBT-009", "IBT-115", "BTUAE-02"],
    legacy: {
      kind: "explicit",
      evaluate: (_context, input) => evaluateLegacyCheckApplicability("UAE-UC1-CHK-009", input),
    },
    shadowEvaluation: (context, input) => {
      const amountDue = readNumber(input.header ?? {}, ["amount_due", "amountDue"]);
      if (amountDue === null || amountDue <= 0) {
        return notApplicable("Amount due is not greater than zero.", ["documentVariant", "transactionFlags"]);
      }
      if (isCreditNoteVariant(context.documentVariant.value)) {
        return notApplicable("Credit-note variants are excluded by the generated UAE rule.", ["documentVariant"]);
      }
      if (context.transactionFlags.value.includes("deemed_supply")) {
        return notApplicable("Deemed-supply transaction flag is excluded by the generated UAE rule.", ["transactionFlags"]);
      }
      return applicable(
        "Amount due is greater than zero and no generated-rule exception applies.",
        ["documentVariant", "transactionFlags"]
      );
    },
    legacyOnlyCategory: "expected_improvement",
  },
  {
    ruleId: "IBR-137-AE",
    title: "Disclosed Agent Principal ID Requirement",
    family: "overlay",
    source: "shadow_only",
    linkedDrIds: ["BTUAE-02", "BTAE-14"],
    legacy: {
      kind: "heuristic",
      evaluate: (context, input) =>
        evaluateLegacyBusinessScenarioHeuristic(
          context,
          input,
          "Disclosed agent",
          "Legacy scenario lens inferred a Disclosed agent business scenario."
        ),
    },
    shadowEvaluation: (context) =>
      evaluateShadowTransactionFlag(
        context,
        "disclosed_agent_billing",
        "Disclosed-agent billing flag is active.",
        ["transactionFlags", "overlays"]
      ),
    shadowOnlyCategory: "expected_improvement",
  },
  {
    ruleId: "IBR-138-AE",
    title: "Summary Invoice Invoicing Period Requirement",
    family: "overlay",
    source: "shadow_only",
    linkedDrIds: ["BTUAE-02", "IBG-14"],
    legacy: {
      kind: "heuristic",
      evaluate: (context, input) =>
        evaluateLegacyBusinessScenarioHeuristic(
          context,
          input,
          "Summary invoice",
          "Legacy scenario lens inferred a Summary invoice business scenario."
        ),
    },
    shadowEvaluation: (context) =>
      evaluateShadowTransactionFlag(
        context,
        "summary_invoice",
        "Summary-invoice flag is active.",
        ["transactionFlags", "overlays"]
      ),
    shadowOnlyCategory: "expected_improvement",
  },
  {
    ruleId: "IBR-152-AE",
    title: "Export Delivery Information Requirement",
    family: "overlay",
    source: "shadow_only",
    linkedDrIds: ["BTUAE-02", "IBG-13", "IBT-075", "IBT-077", "IBT-079", "IBT-080"],
    legacy: {
      kind: "heuristic",
      evaluate: (context, input) =>
        evaluateLegacyVatTreatmentHeuristic(
          context,
          input,
          "Export",
          "Legacy scenario lens inferred an Export treatment."
        ),
    },
    shadowEvaluation: (context) =>
      evaluateShadowTransactionFlag(
        context,
        "exports",
        "Export transaction flag is active.",
        ["transactionFlags", "vatTreatments"]
      ),
    shadowOnlyCategory: "expected_improvement",
  },
  {
    ruleId: "IBR-151-AE",
    title: "Commercial Or Credit Note VAT Category Constraint",
    family: "document_family",
    source: "shadow_only",
    linkedDrIds: ["IBT-003", "IBT-151"],
    legacy: {
      kind: "heuristic",
      evaluate: (context, input) =>
        evaluateLegacyDocumentTypeHeuristic(
          context,
          input,
          ["Commercial/Out-of-scope", "Credit Note", "Self-billing Credit Note"],
          "Legacy scenario lens inferred a commercial or credit-note document family."
        ),
    },
    shadowEvaluation: (context) => {
      const applicableNow =
        context.documentClass.value === "commercial_invoice" || isCreditNoteVariant(context.documentVariant.value);
      return applicableNow
        ? applicable(
            "ScenarioContext classified the invoice as commercial or as a credit-note variant.",
            ["documentClass", "documentVariant"]
          )
        : notApplicable(
            "ScenarioContext did not classify the invoice as commercial or credit-note related.",
            ["documentClass", "documentVariant"]
          );
    },
    shadowOnlyCategory: "expected_improvement",
  },
  {
    ruleId: "IBR-055-AE",
    title: "Credit Note Preceding Invoice Reference Requirement",
    family: "credit_note_specialized",
    source: "shadow_only",
    linkedDrIds: ["IBT-003", "IBG-03", "BTAE-03"],
    legacy: {
      kind: "heuristic",
      evaluate: (context, input) =>
        evaluateLegacyDocumentTypeHeuristic(
          context,
          input,
          ["Credit Note", "Self-billing Credit Note"],
          "Legacy scenario lens inferred a credit-note document type."
        ),
    },
    shadowEvaluation: (context) => {
      return isCreditNoteVariant(context.documentVariant.value)
        ? applicable("ScenarioContext classified the invoice as a credit-note variant.", ["documentVariant"])
        : notApplicable("ScenarioContext did not classify the invoice as a credit-note variant.", ["documentVariant"]);
    },
    shadowOnlyCategory: "expected_improvement",
  },
  {
    ruleId: "IBR-158-AE",
    title: "Credit Note Reason Code Requirement",
    family: "credit_note_specialized",
    source: "shadow_only",
    linkedDrIds: ["IBT-003", "BTAE-03"],
    legacy: {
      kind: "heuristic",
      evaluate: (context, input) =>
        evaluateLegacyDocumentTypeHeuristic(
          context,
          input,
          ["Credit Note", "Self-billing Credit Note"],
          "Legacy scenario lens inferred a credit-note document type."
        ),
    },
    shadowEvaluation: (context) => {
      return isCreditNoteVariant(context.documentVariant.value)
        ? applicable("ScenarioContext classified the invoice as a credit-note variant.", ["documentVariant"])
        : notApplicable("ScenarioContext did not classify the invoice as a credit-note variant.", ["documentVariant"]);
    },
    shadowOnlyCategory: "expected_improvement",
  },
];

export function getShadowApplicabilityDefinitions(): ShadowApplicabilityDefinition[] {
  return SHADOW_APPLICABILITY_DEFINITIONS;
}

export function buildRuleApplicabilityComparison(
  fixture: ScenarioParityFixture
): RuleApplicabilityComparisonReport {
  const context = buildScenarioContext(fixture.input);
  const rows = SHADOW_APPLICABILITY_DEFINITIONS.map((definition) => {
    const legacyEvaluation = definition.legacy.evaluate
      ? definition.legacy.evaluate(context, fixture.input)
      : notModeled("No legacy applicability model exists for this rule.", []);
    const shadowEvaluation = definition.shadowEvaluation(context, fixture.input);

    return buildComparisonRow(definition, context, legacyEvaluation, shadowEvaluation);
  });

  return {
    fixtureId: fixture.id,
    description: fixture.description,
    rows,
    summary: {
      totalRules: rows.length,
      divergentRules: rows.filter((row) => row.differenceStatus !== "aligned" && row.differenceStatus !== "both_not_applicable").length,
      expectedImprovementCount: rows.filter((row) => row.reviewCategory === "expected_improvement").length,
      potentialRegressionCount: rows.filter((row) => row.reviewCategory === "potential_regression").length,
      policyReviewCount: rows.filter((row) => row.reviewCategory === "policy_review").length,
    },
  };
}

export function buildRuleApplicabilityComparisons(
  fixtures: ScenarioParityFixture[]
): RuleApplicabilityComparisonReport[] {
  return fixtures.map(buildRuleApplicabilityComparison);
}

function createRuntimeDefinition(
  ruleId: string,
  family: ApplicabilityRuleFamily,
  _attributesUsed: ScenarioContextAttribute[],
  shadowEvaluation: (context: ScenarioContext, input: ScenarioInvoiceInput) => ApplicabilityEvaluation
): ShadowApplicabilityDefinition {
  const check = requireCheck(ruleId);
  return {
    ruleId,
    title: check.check_name,
    family,
    source: "runtime_check",
    linkedDrIds: getValidationDRTargets(ruleId, { includeReferenceOnly: true }).map((target) => target.dr_id),
    legacy: {
      kind: "explicit",
      evaluate: (_context, input) => evaluateLegacyCheckApplicability(ruleId, input),
    },
    shadowEvaluation,
    shadowOnlyCategory: "expected_improvement",
    legacyOnlyCategory: "potential_regression",
  };
}

function requireCheck(ruleId: string): PintAECheck {
  const check = CHECKS_BY_ID.get(ruleId);
  if (!check) {
    throw new Error(`Missing check definition for ${ruleId}`);
  }
  return check;
}

function evaluateLegacyCheckApplicability(
  ruleId: string,
  input: ScenarioInvoiceInput
): ApplicabilityEvaluation {
  const check = requireCheck(ruleId);
  const params = check.parameters ?? {};
  const reasons: string[] = [];

  if (typeof params.apply_when_document_type === "string") {
    const commercialApplicable = matchesLegacyCommercialApplicability(input, params);
    reasons.push(
      commercialApplicable
        ? "Legacy apply_when_document_type matched a commercial document."
        : "Legacy apply_when_document_type did not match a commercial document."
    );
    if (!commercialApplicable) {
      return notApplicable(reasons.join(" "), []);
    }
  }

  if (typeof params.document_context === "string") {
    const contextApplicable = matchesLegacyDocumentContext(input, params.document_context);
    reasons.push(
      contextApplicable
        ? `Legacy document_context=${params.document_context} matched the current invoice type.`
        : `Legacy document_context=${params.document_context} did not match the current invoice type.`
    );
    if (!contextApplicable) {
      return notApplicable(reasons.join(" "), []);
    }
  }

  const conditions = Array.isArray(params.when) ? params.when : [];
  if (conditions.length > 0) {
    const whenApplicable = matchesLegacyWhenConditions(check, input, conditions);
    reasons.push(
      whenApplicable
        ? "Legacy conditional when-clause matched at least one scoped record."
        : "Legacy conditional when-clause did not match any scoped record."
    );
    if (!whenApplicable) {
      return notApplicable(reasons.join(" "), []);
    }
  }

  return applicable(reasons.length > 0 ? reasons.join(" ") : "Legacy runtime always evaluates this rule.", []);
}

function matchesLegacyCommercialApplicability(
  input: ScenarioInvoiceInput,
  params: Record<string, unknown>
): boolean {
  const header = input.header ?? {};
  const explicitDocumentType = [
    header.document_type,
    header.documentType,
    header.mof_document_type,
    header.mofDocumentType,
  ]
    .map(normalizeToken)
    .find((value) => value.length > 0);

  if (explicitDocumentType === "COMMERCIAL" || explicitDocumentType === "COMMERCIAL_XML") {
    return true;
  }

  const commercialInvoiceTypes = Array.isArray(params.commercial_invoice_types)
    ? params.commercial_invoice_types.map(normalizeToken)
    : [];
  if (commercialInvoiceTypes.length === 0) return false;

  return commercialInvoiceTypes.includes(normalizeToken(header.invoice_type));
}

function matchesLegacyDocumentContext(
  input: ScenarioInvoiceInput,
  documentContext: string
): boolean {
  const normalizedContext = normalizeToken(documentContext || "both");
  if (!normalizedContext || normalizedContext === "BOTH") return true;

  const invoiceType = normalizeToken(input.header?.invoice_type);
  if (normalizedContext === "CREDIT_NOTE") {
    return isLegacyCreditNoteInvoiceType(invoiceType);
  }
  if (normalizedContext === "INVOICE") {
    return !invoiceType || !isLegacyCreditNoteInvoiceType(invoiceType);
  }
  return true;
}

function isLegacyCreditNoteInvoiceType(value: string): boolean {
  return value.startsWith("381") || value.includes("CREDIT");
}

function matchesLegacyWhenConditions(
  check: PintAECheck,
  input: ScenarioInvoiceInput,
  conditions: Array<Record<string, unknown>>
): boolean {
  const candidates = getLegacyApplicabilityCandidates(check, input);
  return candidates.some((candidate) => {
    return conditions.every((condition) => conditionMatches(candidate, condition));
  });
}

function getLegacyApplicabilityCandidates(
  check: PintAECheck,
  input: ScenarioInvoiceInput
): Array<Record<string, unknown>> {
  if (check.scope === "Lines") {
    return input.lines.length > 0 ? input.lines : [];
  }
  if (check.scope === "Party") {
    return input.buyer ? [input.buyer] : [];
  }
  return [input.header];
}

function conditionMatches(
  record: Record<string, unknown>,
  condition: Record<string, unknown>
): boolean {
  const field = typeof condition.field === "string" ? condition.field : "";
  if (!field) return false;
  const value = normalizeToken(record[field]);

  if (Array.isArray(condition.in) && condition.in.length > 0) {
    return condition.in.map(normalizeToken).includes(value);
  }
  if (condition.equals !== undefined) {
    return value === normalizeToken(condition.equals);
  }
  return value.length > 0;
}

function evaluateLegacyVatTreatmentHeuristic(
  _context: ScenarioContext,
  input: ScenarioInvoiceInput,
  treatment: LegacyScenarioVatTreatment,
  successReason: string
): ApplicabilityEvaluation {
  const classification = classifyInvoice(input);
  return classification.vatTreatments.includes(treatment)
    ? applicable(successReason, [])
    : notApplicable(`Legacy scenario lens did not infer ${treatment}.`, []);
}

function evaluateLegacyBusinessScenarioHeuristic(
  _context: ScenarioContext,
  input: ScenarioInvoiceInput,
  scenario: ScenarioBusinessScenario,
  successReason: string
): ApplicabilityEvaluation {
  const classification = classifyInvoice(input);
  return classification.businessScenarios.includes(scenario)
    ? applicable(successReason, [])
    : notApplicable(`Legacy scenario lens did not infer ${scenario}.`, []);
}

function evaluateLegacyDocumentTypeHeuristic(
  _context: ScenarioContext,
  input: ScenarioInvoiceInput,
  documentTypes: ScenarioDocumentType[],
  successReason: string
): ApplicabilityEvaluation {
  const classification = classifyInvoice(input);
  return documentTypes.includes(classification.documentType)
    ? applicable(successReason, [])
    : notApplicable(`Legacy scenario lens classified the document as ${classification.documentType}.`, []);
}

function buildComparisonRow(
  definition: ShadowApplicabilityDefinition,
  context: ScenarioContext,
  legacyEvaluation: ApplicabilityEvaluation,
  shadowEvaluation: ApplicabilityEvaluation
): RuleApplicabilityComparisonRow {
  const differenceStatus = deriveDifferenceStatus(legacyEvaluation.state, shadowEvaluation.state);
  const reviewCategory = deriveReviewCategory(
    definition,
    legacyEvaluation.state,
    shadowEvaluation.state,
    differenceStatus
  );
  const scenarioAttributesUsed = dedupe(shadowEvaluation.attributesUsed);
  const scenarioEvidence = collectScenarioEvidence(context, scenarioAttributesUsed);
  const divergenceReason =
    differenceStatus === "aligned" || differenceStatus === "both_not_applicable"
      ? null
      : `legacy: ${legacyEvaluation.reason} shadow: ${shadowEvaluation.reason}`;

  return {
    ruleId: definition.ruleId,
    title: definition.title,
    family: definition.family,
    source: definition.source,
    legacyApplicability: legacyEvaluation.state,
    shadowApplicability: shadowEvaluation.state,
    legacyPathType: definition.legacy.kind,
    legacyReason: legacyEvaluation.reason,
    shadowReason: shadowEvaluation.reason,
    differenceStatus,
    reviewCategory,
    divergenceReason,
    linkedDrIds: definition.linkedDrIds,
    scenarioAttributesUsed,
    scenarioEvidence,
  };
}

function deriveDifferenceStatus(
  legacyState: ApplicabilityState,
  shadowState: ApplicabilityState
): DifferenceStatus {
  if (legacyState === shadowState) {
    return legacyState === "not_applicable" ? "both_not_applicable" : "aligned";
  }
  if (shadowState === "applicable" && legacyState !== "applicable") {
    return "shadow_only_applicable";
  }
  return "legacy_only_applicable";
}

function deriveReviewCategory(
  definition: ShadowApplicabilityDefinition,
  legacyState: ApplicabilityState,
  shadowState: ApplicabilityState,
  differenceStatus: DifferenceStatus
): DivergenceReviewCategory {
  if (differenceStatus === "aligned" || differenceStatus === "both_not_applicable") {
    return "none";
  }
  if (differenceStatus === "shadow_only_applicable") {
    return definition.shadowOnlyCategory ?? (definition.legacy.kind === "not_modeled" ? "policy_review" : "expected_improvement");
  }
  if (differenceStatus === "legacy_only_applicable") {
    return definition.legacyOnlyCategory ?? "potential_regression";
  }
  if (legacyState === shadowState) {
    return "none";
  }
  return "policy_review";
}

function evaluateShadowTransactionFlag(
  context: ScenarioContext,
  transactionFlag: ScenarioTransactionFlag,
  successReason: string,
  attributesUsed: ScenarioContextAttribute[]
): ApplicabilityEvaluation {
  return context.transactionFlags.value.includes(transactionFlag)
    ? applicable(successReason, attributesUsed)
    : notApplicable(`ScenarioContext did not derive ${transactionFlag} from transaction_type_code.`, attributesUsed);
}

function isCreditNoteVariant(documentVariant: ScenarioDocumentVariant): boolean {
  return (
    documentVariant === "credit_note" ||
    documentVariant === "commercial_credit_note" ||
    documentVariant === "self_billing_credit_note"
  );
}

function collectScenarioEvidence(
  context: ScenarioContext,
  attributes: ScenarioContextAttribute[]
): ScenarioEvidence[] {
  const evidence = attributes.flatMap((attribute) => {
    switch (attribute) {
      case "documentClass":
        return context.documentClass.evidence;
      case "documentVariant":
        return context.documentVariant.evidence;
      case "transactionFlags":
        return context.transactionFlags.evidence;
      case "vatTreatments":
        return context.vatTreatments.evidence;
      case "overlays":
        return context.overlays.evidence;
      default:
        return [];
    }
  });

  return dedupeBy(evidence, (item) => `${item.source}|${item.field}|${String(item.value)}|${item.note}`);
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

function normalizeToken(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

function applicable(reason: string, attributesUsed: ScenarioContextAttribute[]): ApplicabilityEvaluation {
  return { state: "applicable", reason, attributesUsed };
}

function notApplicable(reason: string, attributesUsed: ScenarioContextAttribute[]): ApplicabilityEvaluation {
  return { state: "not_applicable", reason, attributesUsed };
}

function notModeled(reason: string, attributesUsed: ScenarioContextAttribute[]): ApplicabilityEvaluation {
  return { state: "not_modeled", reason, attributesUsed };
}

function dedupe<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function dedupeBy<T>(values: T[], keySelector: (value: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  values.forEach((value) => {
    const key = keySelector(value);
    if (seen.has(key)) return;
    seen.add(key);
    result.push(value);
  });
  return result;
}
