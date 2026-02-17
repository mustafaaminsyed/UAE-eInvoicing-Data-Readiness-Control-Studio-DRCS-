import type {
  ScenarioBusinessScenario,
  ScenarioBusinessScenarioFilter,
  ScenarioDocumentType,
  ScenarioDocumentTypeFilter,
  ScenarioLensFilters,
  ScenarioVatTreatment,
  ScenarioVatTreatmentFilter,
} from "@/modules/scenarioLens/types";

export type ScenarioApplicabilityStatus = "Always" | "Conditional" | "N/A";

export interface ScenarioApplicabilityRule {
  documentTypes?: ScenarioDocumentType[];
  vatTreatments?: ScenarioVatTreatment[];
  businessScenarios?: ScenarioBusinessScenario[];
  notes: string;
}

export const DR_SCENARIO_APPLICABILITY: Record<string, ScenarioApplicabilityRule> = {
  "IBT-001": { notes: "Invoice number is required in all scenarios." },
  "IBT-002": { notes: "Issue date is required in all scenarios." },
  "IBT-003": {
    documentTypes: ["Credit Note", "Self-billing Credit Note", "Standard Invoice", "Self-billing Invoice"],
    notes: "Invoice type code applies to taxable invoice and credit note documents.",
  },
  "IBT-005": { notes: "Document currency applies in all invoicing scenarios." },
  "IBT-007": {
    vatTreatments: ["Export", "Reverse charge"],
    notes: "FX rate mainly applies to cross-border and non-base-currency treatments.",
  },
  "IBT-031": { notes: "Seller TRN is generally always applicable for UAE VAT taxpayers." },
  "IBT-048": {
    vatTreatments: ["Standard-rated", "Reverse charge", "Zero-rated"],
    notes: "Buyer TRN relevance increases for taxable and reverse-charge scenarios.",
  },
  "IBT-109": { notes: "Invoice net total applies in all monetary documents." },
  "IBT-110": {
    vatTreatments: ["Standard-rated", "Zero-rated", "Exempt", "Reverse charge", "Export"],
    notes: "VAT total is relevant when tax treatment is within scope.",
  },
  "IBT-112": { notes: "Invoice gross total is generally always applicable." },
  "IBT-115": {
    businessScenarios: ["Continuous supply", "Summary invoice", "E-commerce"],
    notes: "Amount due is especially relevant for recurring and aggregated billing scenarios.",
  },
  "IBT-119": {
    vatTreatments: ["Standard-rated", "Zero-rated", "Exempt", "Reverse charge"],
    notes: "Tax rate applies when a tax category is declared.",
  },
  "IBT-024": {
    documentTypes: ["Standard Invoice", "Credit Note", "Self-billing Invoice", "Self-billing Credit Note"],
    notes: "Specification identifier applies for in-scope structured invoice exchanges.",
  },
  "BTUAE-02": {
    documentTypes: ["Standard Invoice", "Credit Note", "Self-billing Invoice", "Self-billing Credit Note"],
    notes: "UAE transaction type code is conditional on in-scope tax documents.",
  },
};

export function getScenarioApplicabilityForDR(
  drId: string,
  filters: ScenarioLensFilters
): { status: ScenarioApplicabilityStatus; notes: string } {
  const rule = DR_SCENARIO_APPLICABILITY[drId];
  if (!rule) {
    return { status: "Always", notes: "No scenario condition mapped for this DR." };
  }

  if (!hasConditions(rule)) {
    return { status: "Always", notes: rule.notes };
  }

  const matchesDocumentType = matchesFilter(rule.documentTypes, filters.documentType);
  const matchesVatTreatment = matchesFilter(rule.vatTreatments, filters.vatTreatment);
  const matchesBusinessScenario = matchesFilter(rule.businessScenarios, filters.businessScenario);

  return {
    status: matchesDocumentType && matchesVatTreatment && matchesBusinessScenario ? "Conditional" : "N/A",
    notes: rule.notes,
  };
}

function hasConditions(rule: ScenarioApplicabilityRule): boolean {
  return Boolean(
    (rule.documentTypes && rule.documentTypes.length > 0) ||
      (rule.vatTreatments && rule.vatTreatments.length > 0) ||
      (rule.businessScenarios && rule.businessScenarios.length > 0)
  );
}

function matchesFilter<T extends string>(
  allowed: T[] | undefined,
  selected: string
): boolean {
  if (!allowed || allowed.length === 0) return true;
  if (selected === "All") return true;
  return allowed.includes(selected as T);
}

export function getScenarioApplicabilityBadgeClass(status: ScenarioApplicabilityStatus): string {
  if (status === "Always") return "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border-[hsl(var(--success))]/20";
  if (status === "Conditional") return "bg-primary/10 text-primary border-primary/20";
  return "bg-muted text-muted-foreground border-muted-foreground/20";
}
