import { Severity } from '@/types/compliance';
import { DatasetRunScope, DatasetType } from '@/types/datasets';
import { Direction } from '@/types/direction';

export type ValidationLayer = 'core' | 'pint_ae' | 'mof_readiness' | 'custom';
export type FindingKind = 'exception' | 'readiness' | 'coverage';
export type CheckSource = 'built_in' | 'pint_ae' | 'mof' | 'custom';

export interface CheckDefinition {
  checkId: string;
  checkName: string;
  layer: ValidationLayer;
  source: CheckSource;
  enabled: boolean;
  severity?: Severity;
  checkVersion?: string;
  rulesetVersion?: string;
  references?: string[];
  metadata?: Record<string, unknown>;
}

export interface RunnerInput<TData = unknown> {
  runId?: string;
  startedAt?: string;
  datasetScope?: DatasetRunScope;
  datasetType?: DatasetType;
  checks: CheckDefinition[];
  data: TData;
  metadata?: Record<string, unknown>;
}

export interface Finding {
  findingId: string;
  runId?: string;
  timestamp?: string;
  layer: ValidationLayer;
  kind: FindingKind;
  checkId: string;
  checkName: string;
  severity: Severity;
  message: string;
  datasetType?: DatasetType;
  direction?: Direction;
  invoiceId?: string;
  invoiceNumber?: string;
  sellerTrn?: string;
  buyerId?: string;
  lineId?: string;
  lineNumber?: number;
  field?: string;
  expectedValue?: string | number;
  observedValue?: string | number;
  references?: string[];
  metadata?: Record<string, unknown>;
}

export interface LayerResult {
  layer: ValidationLayer;
  findings: Finding[];
  totals: {
    findings: number;
    bySeverity: Record<Severity, number>;
  };
  metadata?: Record<string, unknown>;
}

export interface RunArtifact {
  runId?: string;
  startedAt: string;
  endedAt?: string;
  scope?: DatasetRunScope;
  layerResults: LayerResult[];
  findings: Finding[];
  metadata?: Record<string, unknown>;
}
