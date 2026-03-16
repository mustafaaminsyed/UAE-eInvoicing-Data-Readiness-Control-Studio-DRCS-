import type {
  DecodedTransactionTypeCode,
  DecodedTransactionTypeFlag,
  ScenarioEvidence,
  ScenarioTransactionFlag,
  TransactionTypeFlagDefinition,
} from "@/types/scenarioContext";

export const TRANSACTION_TYPE_FLAG_DEFINITIONS: readonly TransactionTypeFlagDefinition[] = [
  {
    bitPosition: 1,
    mask: "1XXXXXXX",
    flag: "free_trade_zone",
    label: "Free trade zone",
    note: "Defined by the generated PINT-AE schematron resources.",
  },
  {
    bitPosition: 2,
    mask: "X1XXXXXX",
    flag: "deemed_supply",
    label: "Deemed supply",
    note: "Defined by the generated PINT-AE schematron resources.",
  },
  {
    bitPosition: 3,
    mask: "XX1XXXXX",
    flag: "margin_scheme",
    label: "Margin scheme",
    note: "Defined by the generated PINT-AE schematron resources.",
  },
  {
    bitPosition: 4,
    mask: "XXX1XXXX",
    flag: "summary_invoice",
    label: "Summary invoice",
    note: "Defined by the generated PINT-AE schematron resources.",
  },
  {
    bitPosition: 5,
    mask: "XXXX1XXX",
    flag: "reserved_policy_flag",
    label: "Reserved policy flag",
    note: "The repo contains the mask but no named semantic yet, so this remains observable only.",
  },
  {
    bitPosition: 6,
    mask: "XXXXX1XX",
    flag: "disclosed_agent_billing",
    label: "Disclosed Agent billing",
    note: "Defined by the generated PINT-AE schematron resources.",
  },
  {
    bitPosition: 7,
    mask: "XXXXXX1X",
    flag: "ecommerce_supplies",
    label: "E-commerce supplies",
    note: "Defined by the generated PINT-AE schematron resources.",
  },
  {
    bitPosition: 8,
    mask: "XXXXXXX1",
    flag: "exports",
    label: "Exports",
    note: "Defined by the generated PINT-AE schematron resources.",
  },
] as const;

const BINARY_PATTERN = /^[01]{8}$/;
const MASK_PATTERN = /^[1X]{8}$/;

export function decodeTransactionTypeCode(raw: unknown): DecodedTransactionTypeCode {
  const normalized = typeof raw === "string" ? raw.trim().toUpperCase() : "";

  if (!normalized) {
    return {
      raw: "",
      normalized: "",
      format: "missing",
      valid: false,
      activeFlags: [],
      activeDefinitions: [],
      issues: [],
      evidence: [],
    };
  }

  if (BINARY_PATTERN.test(normalized)) {
    const activeDefinitions = TRANSACTION_TYPE_FLAG_DEFINITIONS.filter((definition) => {
      return normalized.charAt(definition.bitPosition - 1) === "1";
    }).map((definition) => buildDecodedFlag(definition, raw, normalized));

    return {
      raw: String(raw),
      normalized,
      format: "binary",
      valid: true,
      activeFlags: activeDefinitions.map((definition) => definition.flag),
      activeDefinitions,
      issues: [],
      evidence: buildEvidence("transaction_type_code", raw, normalized, "Decoded binary transaction_type_code."),
    };
  }

  if (MASK_PATTERN.test(normalized)) {
    const activeDefinitions = TRANSACTION_TYPE_FLAG_DEFINITIONS.filter((definition) => {
      return normalized.charAt(definition.bitPosition - 1) === "1";
    }).map((definition) => buildDecodedFlag(definition, raw, normalized));

    return {
      raw: String(raw),
      normalized,
      format: "mask",
      valid: activeDefinitions.length > 0,
      activeFlags: activeDefinitions.map((definition) => definition.flag),
      activeDefinitions,
      issues: activeDefinitions.length > 0 ? [] : ["Mask input did not activate any known transaction flag."],
      evidence: buildEvidence(
        "transaction_type_code",
        raw,
        normalized,
        "Decoded mask-style transaction_type_code into observable flags."
      ),
    };
  }

  return {
    raw: String(raw),
    normalized,
    format: "invalid",
    valid: false,
    activeFlags: [],
    activeDefinitions: [],
    issues: ["transaction_type_code must be an 8-character binary or mask token."],
    evidence: buildEvidence(
      "transaction_type_code",
      raw,
      normalized,
      "Observed invalid transaction_type_code format; no flags decoded."
    ),
  };
}

export function getTransactionTypeFlagDefinition(
  flag: ScenarioTransactionFlag
): TransactionTypeFlagDefinition | undefined {
  return TRANSACTION_TYPE_FLAG_DEFINITIONS.find((definition) => definition.flag === flag);
}

function buildDecodedFlag(
  definition: TransactionTypeFlagDefinition,
  raw: unknown,
  normalized: string
): DecodedTransactionTypeFlag {
  return {
    ...definition,
    evidence: buildEvidence(
      "transaction_type_code",
      raw,
      normalized,
      `Activated ${definition.label} from transaction_type_code bit ${definition.bitPosition}.`
    ),
  };
}

function buildEvidence(
  field: string,
  raw: unknown,
  normalized: string,
  note: string
): ScenarioEvidence[] {
  return [
    {
      source: "transaction_type_code",
      field,
      value: typeof raw === "string" ? raw : normalized || null,
      note,
    },
  ];
}
