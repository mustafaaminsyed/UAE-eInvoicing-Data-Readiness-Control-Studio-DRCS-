function readFlag(raw: string | undefined, fallback: boolean): boolean {
  if (typeof raw !== "string") return fallback;
  return raw.toLowerCase() === "true";
}

export const FEATURE_FLAGS = {
  casesMenu: readFlag(import.meta.env.VITE_ENABLE_CASES, false),
  scenarioLens: readFlag(import.meta.env.VITE_ENABLE_SCENARIO_LENS, true),
  scenarioLensMockData: readFlag(import.meta.env.VITE_ENABLE_SCENARIO_LENS_MOCK_DATA, false),
  scenarioApplicabilityColumn: readFlag(
    import.meta.env.VITE_ENABLE_SCENARIO_APPLICABILITY_COLUMN,
    false
  ),
} as const;
