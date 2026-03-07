function readFlag(raw: string | undefined, fallback: boolean): boolean {
  if (typeof raw !== "string") return fallback;
  return raw.toLowerCase() === "true";
}

function readNumber(raw: string | undefined, fallback: number): number {
  if (typeof raw !== "string") return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function readDocumentType(raw: string | undefined, fallback: "tax_invoice" | "commercial_xml") {
  if (raw === "tax_invoice" || raw === "commercial_xml") return raw;
  return fallback;
}

export const FEATURE_FLAGS = {
  casesMenu: readFlag(import.meta.env.VITE_ENABLE_CASES, false),
  scenarioLens: readFlag(import.meta.env.VITE_ENABLE_SCENARIO_LENS, true),
  scenarioLensMockData: readFlag(import.meta.env.VITE_ENABLE_SCENARIO_LENS_MOCK_DATA, false),
  scenarioApplicabilityColumn: readFlag(
    import.meta.env.VITE_ENABLE_SCENARIO_APPLICABILITY_COLUMN,
    false
  ),
  mofMandatoryPreGateEnabled: readFlag(import.meta.env.VITE_ENABLE_MOF_MANDATORY_PRE_GATE, false),
  mofMandatoryPreGateDocumentType: readDocumentType(
    import.meta.env.VITE_MOF_MANDATORY_PRE_GATE_DOCUMENT_TYPE,
    "tax_invoice"
  ),
  mofMandatoryPreGateThreshold: readNumber(import.meta.env.VITE_MOF_MANDATORY_PRE_GATE_THRESHOLD, 100),
  mofMandatoryPreGateStrictNoBridge: readFlag(import.meta.env.VITE_ENABLE_MOF_STRICT_NO_BRIDGE_GATE, false),
} as const;
