import { Severity, Exception } from '@/types/compliance';
import { DatasetType } from '@/types/datasets';

export interface ExplanationEngineMeta {
  source: 'cache' | 'heuristic' | 'assist';
  version: 'heuristic_v1' | 'assist_v1';
  promptVersion?: string;
  heuristicRuleHint?: string;
}

export interface ExplanationRootCause {
  cause: string;
  probability: number; // 0..1, normalized across all causes
  evidence: string[];
}

export interface ExplanationFixStep {
  step: string;
  ownerHint: string;
  linkToUI?: string;
}

export interface ExplanationRuleReference {
  ruleCode: string;
  ruleName?: string;
  severity: Severity;
  specRef?: string;
}

export interface ExplanationEvidenceSnapshot {
  invoice?: string;
  field?: string;
  expected?: string | number;
  actual?: string | number;
  delta?: number | string;
  mapping?: Record<string, unknown>;
  rawMessage?: string;
  [key: string]: unknown;
}

export interface ExplanationPack {
  summary: string;
  whyItFailed: string[];
  likelyRootCauses: ExplanationRootCause[];
  impact: string;
  fixChecklist: ExplanationFixStep[];
  ruleReferences: ExplanationRuleReference[];
  confidence: number; // 0..1
  engine: ExplanationEngineMeta;
  evidenceSnapshot: ExplanationEvidenceSnapshot;
}

export interface ValidationExplanation {
  id?: string;
  exceptionId?: string;
  checkId?: string;
  datasetType?: DatasetType;
  fieldName?: string;
  explanation: string; // backward-compatible flat summary
  recommendedFix: string; // backward-compatible top recommendation
  promptVersion?: string;
  sourceContext?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  explanationPack?: ExplanationPack;
}

export type ValidationExplainMode = 'heuristic_only' | 'assist';

export interface GenerateValidationExplanationInput {
  exception: Exception;
  datasetType?: DatasetType;
  mode?: ValidationExplainMode;
  regenerate?: boolean;
  promptVersion?: string;
}

export interface MappingContext {
  mapping_path: string;
  sample_source_value?: string;
  dataset_type?: DatasetType;
  field_name?: string;
}

export interface MappingContextProvider {
  getMappingContext(params: {
    datasetType?: DatasetType;
    fieldName?: string;
    exception: Exception;
  }): Promise<MappingContext | null>;
}

