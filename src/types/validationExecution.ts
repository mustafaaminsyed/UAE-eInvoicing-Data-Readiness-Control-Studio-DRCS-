import type { Direction } from './direction';

export type ValidationControlClass =
  | 'regulatory'
  | 'supplementary_data_readiness'
  | 'custom'
  | 'organization_profile';

export type ValidationLayer = 'pint_ae' | 'core' | 'custom' | 'org_profile';
export type ValidationApplicabilityStatus = 'applicable' | 'not_applicable' | 'undetermined';
export type ValidationEvaluationStatus = 'evaluated' | 'not_evaluated';
export type ValidationOutcomeStatus = 'pass' | 'fail' | 'not_applicable' | 'not_evaluated';

/** Aggregate, auditable execution evidence for one registered control in one run. */
export interface ValidationExecutionEvidence {
  ruleId: string;
  ruleName: string;
  controlClass: ValidationControlClass;
  layer: ValidationLayer;
  direction: Direction;
  registered: true;
  candidateCount: number;
  applicableCount: number;
  notApplicableCount: number;
  evaluatedCount: number;
  passedCount: number;
  failedCount: number;
  notEvaluatedCount: number;
  applicability: ValidationApplicabilityStatus;
  evaluation: ValidationEvaluationStatus;
  outcome: ValidationOutcomeStatus;
  applicabilityReason?: string;
  rulesetVersion?: string;
  executionSource: 'runtime' | 'legacy_adapter';
}

export interface ValidationMetricSummary {
  registeredControls: number;
  applicableControls: number;
  evaluatedControls: number;
  passedControls: number;
  failedControls: number;
  notApplicableControls: number;
  notEvaluatedControls: number;
  applicableOutcomes: number;
  evaluatedOutcomes: number;
  passedOutcomes: number;
  failedOutcomes: number;
  notApplicableOutcomes: number;
  notEvaluatedOutcomes: number;
  rulePassRate: number | null;
  evaluationCoverage: number | null;
}

export function summarizeValidationExecutions(
  executions: ValidationExecutionEvidence[]
): ValidationMetricSummary {
  const applicableOutcomes = executions.reduce((sum, item) => sum + item.applicableCount, 0);
  const evaluatedOutcomes = executions.reduce((sum, item) => sum + item.evaluatedCount, 0);
  const passedOutcomes = executions.reduce((sum, item) => sum + item.passedCount, 0);
  const failedOutcomes = executions.reduce((sum, item) => sum + item.failedCount, 0);

  return {
    registeredControls: executions.length,
    applicableControls: executions.filter((item) => item.applicability === 'applicable').length,
    evaluatedControls: executions.filter((item) => item.evaluation === 'evaluated').length,
    passedControls: executions.filter((item) => item.outcome === 'pass').length,
    failedControls: executions.filter((item) => item.outcome === 'fail').length,
    notApplicableControls: executions.filter((item) => item.outcome === 'not_applicable').length,
    notEvaluatedControls: executions.filter((item) => item.outcome === 'not_evaluated').length,
    applicableOutcomes,
    evaluatedOutcomes,
    passedOutcomes,
    failedOutcomes,
    notApplicableOutcomes: executions.reduce((sum, item) => sum + item.notApplicableCount, 0),
    notEvaluatedOutcomes: executions.reduce((sum, item) => sum + item.notEvaluatedCount, 0),
    rulePassRate: evaluatedOutcomes > 0 ? (passedOutcomes / evaluatedOutcomes) * 100 : null,
    evaluationCoverage: applicableOutcomes > 0 ? (evaluatedOutcomes / applicableOutcomes) * 100 : null,
  };
}
