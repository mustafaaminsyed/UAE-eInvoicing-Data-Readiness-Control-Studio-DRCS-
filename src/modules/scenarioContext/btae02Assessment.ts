import { decodeTransactionTypeCode, TRANSACTION_TYPE_FLAG_DEFINITIONS } from "@/modules/scenarioContext/transactionTypeCode";
import type { DecodedTransactionTypeCode, ScenarioTransactionFlag } from "@/types/scenarioContext";

export type Btae02ConsistencyStatus =
  | "not_evaluated"
  | "declared_only"
  | "corroborated"
  | "possible_missing_flag"
  | "conflict"
  | "insufficient_evidence";

export type Btae02EvidenceKind = "independent" | "dependency" | "heuristic" | "declaration_derived";
export type Btae02EvidenceStrength = "strong" | "supporting" | "weak" | "ambiguous";
export type Btae02DependencyStatus = "not_evaluated" | "satisfied" | "failed" | "not_applicable";

export interface Btae02SourceEvidence {
  sourceField: string;
  sourceValue: string | number | boolean | null;
  kind: Btae02EvidenceKind;
  strength: Btae02EvidenceStrength;
  derived: boolean;
  canonicalField?: string;
  mappingPath?: string;
  sourceSystem?: string;
  reason?: string;
}

export interface Btae02DependencyResult {
  status: Btae02DependencyStatus;
  ruleId?: string;
  requiredFields?: string[];
  observedFields?: string[];
  missingFields?: string[];
  reason?: string;
}

export interface Btae02PositionAssessment {
  position: number;
  flag: ScenarioTransactionFlag;
  active: boolean;
  evidence: Btae02SourceEvidence[];
  dependency: Btae02DependencyResult;
}

export interface Btae02Assessment {
  declaration: {
    raw: string;
    valid: boolean;
    activeFlags: ScenarioTransactionFlag[];
    decoded: DecodedTransactionTypeCode;
    positions: Btae02PositionAssessment[];
  };
  consistency: Btae02ConsistencyStatus;
  dependencyState: Btae02DependencyStatus;
}

export function buildBtae02Assessment(raw: unknown): Btae02Assessment {
  const decoded = decodeTransactionTypeCode(raw);
  const activeFlags = decoded.activeFlags;

  return {
    declaration: {
      raw: decoded.raw,
      valid: decoded.valid,
      activeFlags,
      decoded,
      positions: TRANSACTION_TYPE_FLAG_DEFINITIONS.map((definition) => ({
          position: definition.bitPosition,
          flag: definition.flag,
          active: activeFlags.includes(definition.flag),
          evidence: [],
          dependency: { status: "not_evaluated" },
        })),
    },
    consistency: "not_evaluated",
    dependencyState: "not_evaluated",
  };
}
