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
  [key: string]: unknown;
}
