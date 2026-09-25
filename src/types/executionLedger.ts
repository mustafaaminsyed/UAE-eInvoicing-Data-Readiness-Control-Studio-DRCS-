import { DatasetType } from './datasets';
import { PintAECheck } from './pintAE';

export type ExecutionStatus = 'pass' | 'fail' | 'not_applicable' | 'not_evaluated' | 'error';

/** Actual record outcomes, aggregated during one rule invocation. Not regulatory certification. */
export interface RuleExecution {
  check: PintAECheck;
  datasetType: DatasetType;
  evaluatedAt: string;
  engineVersion: 'uc1-execution-v1' | 'uc1-execution-v2' | 'uc1-execution-v3';
  status: ExecutionStatus;
  candidateCount: number;
  passed: number;
  failed: number;
  notApplicable: number;
  notEvaluated: number;
  errors: number;
  exceptionCount: number;
  reason?: string;
}

export interface ExecutionSnapshot {
  runId: string;
  timestamp: string;
  datasetType: DatasetType;
  executions: RuleExecution[];
}
