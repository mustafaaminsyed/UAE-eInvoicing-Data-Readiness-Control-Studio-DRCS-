import { classifyInvoice } from "@/modules/scenarioLens/classifyInvoice";
import type {
  ScenarioBusinessScenario,
  ScenarioClassification,
  ScenarioDocumentType,
  ScenarioVatTreatment as LegacyScenarioVatTreatment,
} from "@/modules/scenarioLens/types";
import { buildScenarioContext } from "@/modules/scenarioContext/buildScenarioContext";
import type { ScenarioParityFixture } from "@/modules/scenarioContext/fixtures";
import type {
  ScenarioContext,
  ScenarioOverlay,
  ScenarioVatTreatment,
} from "@/types/scenarioContext";

export interface ScenarioParityProjection {
  documentType: ScenarioDocumentType;
  vatTreatments: LegacyScenarioVatTreatment[];
  businessScenarios: ScenarioBusinessScenario[];
}

export interface ScenarioParityResult {
  fixtureId: string;
  description: string;
  legacy: ScenarioClassification;
  shadowProjection: ScenarioParityProjection;
  scenarioContext: ScenarioContext;
  divergences: string[];
}

export interface ScenarioParityReport {
  results: ScenarioParityResult[];
  fixtureCount: number;
  divergentFixtureCount: number;
}

export function projectScenarioContextToLegacy(context: ScenarioContext): ScenarioParityProjection {
  const documentType = projectDocumentType(context);
  const vatTreatments = context.vatTreatments.value
    .map(projectVatTreatment)
    .filter((value): value is LegacyScenarioVatTreatment => Boolean(value));
  const businessScenarios = context.overlays.value
    .map(projectBusinessScenario)
    .filter((value): value is ScenarioBusinessScenario => Boolean(value));

  return {
    documentType,
    vatTreatments: dedupe(vatTreatments),
    businessScenarios: businessScenarios.length > 0 ? dedupe(businessScenarios) : ["None"],
  };
}

export function buildScenarioParityResult(fixture: ScenarioParityFixture): ScenarioParityResult {
  const legacy = classifyInvoice(fixture.input);
  const scenarioContext = buildScenarioContext(fixture.input);
  const shadowProjection = projectScenarioContextToLegacy(scenarioContext);

  return {
    fixtureId: fixture.id,
    description: fixture.description,
    legacy,
    shadowProjection,
    scenarioContext,
    divergences: collectDivergences(legacy, shadowProjection),
  };
}

export function buildScenarioParityReport(fixtures: ScenarioParityFixture[]): ScenarioParityReport {
  const results = fixtures.map(buildScenarioParityResult);
  return {
    results,
    fixtureCount: results.length,
    divergentFixtureCount: results.filter((result) => result.divergences.length > 0).length,
  };
}

function projectDocumentType(context: ScenarioContext): ScenarioDocumentType {
  switch (context.documentVariant.value) {
    case "self_billing_credit_note":
      return "Self-billing Credit Note";
    case "self_billing":
      return "Self-billing Invoice";
    default:
      break;
  }

  if (context.documentClass.value === "commercial_invoice") {
    return "Commercial/Out-of-scope";
  }

  if (
    context.documentVariant.value === "credit_note" ||
    context.documentVariant.value === "commercial_credit_note"
  ) {
    return "Credit Note";
  }

  return "Standard Invoice";
}

function projectVatTreatment(value: ScenarioVatTreatment): LegacyScenarioVatTreatment | null {
  switch (value) {
    case "standard_rated":
      return "Standard-rated";
    case "zero_rated":
      return "Zero-rated";
    case "exempt":
      return "Exempt";
    case "out_of_scope":
      return "Out-of-scope";
    case "reverse_charge":
      return "Reverse charge";
    case "export":
      return "Export";
    case "free_trade_zone":
      return "Free Zone";
    case "deemed_supply":
      return "Deemed supply";
    case "margin_scheme":
      return "Margin scheme";
    default:
      return null;
  }
}

function projectBusinessScenario(value: ScenarioOverlay): ScenarioBusinessScenario | null {
  switch (value) {
    case "disclosed_agent_billing":
      return "Disclosed agent";
    case "continuous_supply":
      return "Continuous supply";
    case "summary_invoice":
      return "Summary invoice";
    case "ecommerce_supplies":
      return "E-commerce";
    default:
      return null;
  }
}

function collectDivergences(
  legacy: ScenarioClassification,
  shadowProjection: ScenarioParityProjection
): string[] {
  const divergences: string[] = [];

  if (legacy.documentType !== shadowProjection.documentType) {
    divergences.push(
      `documentType mismatch: legacy=${legacy.documentType} shadow=${shadowProjection.documentType}`
    );
  }

  const legacyVat = sortStrings(legacy.vatTreatments);
  const shadowVat = sortStrings(shadowProjection.vatTreatments);
  if (!equalArrays(legacyVat, shadowVat)) {
    divergences.push(`vatTreatments mismatch: legacy=${legacyVat.join(",")} shadow=${shadowVat.join(",")}`);
  }

  const legacyBusiness = sortStrings(legacy.businessScenarios);
  const shadowBusiness = sortStrings(shadowProjection.businessScenarios);
  if (!equalArrays(legacyBusiness, shadowBusiness)) {
    divergences.push(
      `businessScenarios mismatch: legacy=${legacyBusiness.join(",")} shadow=${shadowBusiness.join(",")}`
    );
  }

  return divergences;
}

function sortStrings(values: string[]): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function equalArrays(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function dedupe<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}
