export interface EvidenceRunColumnPopulation {
  column: string;
  totalRows: number;
  populatedCount: number;
  populationPct: number;
}

export interface EvidenceRunDatasetPopulation {
  dataset: 'buyers' | 'headers' | 'lines';
  columns: EvidenceRunColumnPopulation[];
}

export interface RegulatoryBaselineIdentity {
  baselineId: string;
  pintAEBillingVersion: string;
  pintAESelfBillingVersion: string;
  uaeTddVersion: string;
  pintGeneralVersion: string;
  pdkVersion: string;
  drcsRulesetVersion: string;
  crosswalkVersion: string;
  billingResourceHash: string;
  selfBillingResourceHash: string;
  tddResourceHash: string;
  executableParityStatus: 'outstanding' | 'verified';
}

export interface EvidenceRunSnapshot {
  version: 1;
  captured_at: string;
  dataset_name: string;
  entity_scope_status?: 'single_entity' | 'multi_entity' | 'unknown';
  legal_entity_count?: number;
  legal_entity_labels?: string[];
  counts: {
    totalInvoices: number;
    totalBuyers: number;
    totalLines: number;
  };
  populations: EvidenceRunDatasetPopulation[];
}

export interface EvidenceRuleExecutionTelemetryRow {
  rule_id: string;
  execution_count: number;
  failure_count: number;
  execution_source: 'runtime';
  direction?: Direction;
  control_class?: ValidationControlClass;
  layer?: ValidationLayer;
  candidate_count?: number;
  applicable_count?: number;
  passed_count?: number;
  not_applicable_count?: number;
  not_evaluated_count?: number;
  applicability_reason?: string;
}

export interface CheckRunResultsSummary {
  checkCount?: number;
  direction?: string;
  ruleset?: string;
  rulesetVersion?: string;
  runMode?: 'raw_template' | 'governed_mapping' | 'diagnostic_mapping';
  readinessQualification?: 'decision_ready' | 'diagnostic_only';
  mappingCoveragePercent?: number | null;
  uploadSessionId?: string | null;
  uploadManifestId?: string | null;
  mappingProfileId?: string | null;
  mappingVersion?: number | null;
  evidenceSnapshot?: EvidenceRunSnapshot;
  evidenceRuleExecutionTelemetry?: EvidenceRuleExecutionTelemetryRow[];
  validationExecutionEvidence?: ValidationExecutionEvidence[];
  metricSemanticsVersion?: 2;
  regulatoryBaseline?: RegulatoryBaselineIdentity;
  [key: string]: unknown;
}
import type { Direction } from './direction';
import type { ValidationControlClass, ValidationExecutionEvidence, ValidationLayer } from './validationExecution';
