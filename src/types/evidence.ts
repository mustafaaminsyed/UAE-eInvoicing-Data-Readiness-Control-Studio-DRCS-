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
  uploadSessionId?: string | null;
  uploadManifestId?: string | null;
  mappingProfileId?: string | null;
  mappingVersion?: number | null;
  evidenceSnapshot?: EvidenceRunSnapshot;
  evidenceRuleExecutionTelemetry?: EvidenceRuleExecutionTelemetryRow[];
  [key: string]: unknown;
}
