import type { Direction } from '@/types/direction';
import type { ValidationControlClass } from '@/types/validationExecution';

export const READINESS_METHODOLOGY_VERSION = 'drcs-readiness-decision-v1' as const;

export type AssessmentCompleteness = 'not_assessed' | 'assessing' | 'partial' | 'complete';
export type ObservedReadiness = 'undetermined' | 'ready' | 'watch' | 'blocked';
export type ScoreState = 'unavailable' | 'provisional' | 'final';

export type ReadinessEligibilityReason =
  | 'no_source_data'
  | 'missing_qualifying_run'
  | 'run_not_completed'
  | 'diagnostic_only_run'
  | 'incomplete_expected_control_evidence'
  | 'unresolved_expected_control_evidence'
  | 'unevaluated_applicable_outcomes'
  | 'undetermined_applicability'
  | 'missing_required_source_collections'
  | 'missing_dataset_identity'
  | 'missing_score_inputs'
  | 'unresolved_score_inputs'
  | 'invalid_score'
  | 'missing_score_provenance'
  | 'unresolved_score_provenance'
  | 'mismatched_score_provenance'
  | 'stale_run_direction'
  | 'stale_run_dataset';

export type EvidenceResolution = 'confirmed' | 'incomplete' | 'unresolved';
export type ScoreInputResolution = 'calculable' | 'missing' | 'unresolved';
export type BlockerQualification = 'confirmed' | 'not_qualified' | 'unresolved';

interface DatasetEvidenceIdentity {
  direction: Direction;
  datasetId?: string;
  uploadSessionId?: string;
  uploadManifestId?: string;
}

export interface ReadinessRunIdentity extends DatasetEvidenceIdentity {
  runId: string;
  rulesetId: string;
  rulesetVersion: string;
  completed: boolean;
  qualification: 'decision_ready' | 'diagnostic_only';
}

export interface RequiredCollectionEvidence {
  headers: boolean;
  buyers: boolean;
  lines: boolean;
}

export interface AssessmentExecutionEvidence {
  expectedControls: EvidenceResolution;
  hasUnevaluatedApplicableOutcomes: boolean;
  hasUndeterminedApplicability: boolean;
}

export interface ConfirmedScoreProvenance extends DatasetEvidenceIdentity {
  resolution: 'confirmed';
  runId: string;
  rulesetId: string;
  rulesetVersion: string;
  methodologyVersion: string;
}

export interface UnresolvedScoreProvenance {
  resolution: 'unresolved';
}

export interface ReadinessScoreEvidence {
  value: number | null;
  inputs: ScoreInputResolution;
  /** Must be explicitly granted by the score-producing adapter for an incomplete assessment. */
  provisionalEligible: boolean;
  provenance: ConfirmedScoreProvenance | UnresolvedScoreProvenance | null;
}

export type BlockerExecutionProvenance =
  | {
      resolution: 'confirmed';
      executionId: string;
      rulesetId: string;
      rulesetVersion: string;
    }
  | {
      resolution: 'unresolved';
      executionId?: string;
    };

export interface ReadinessBlockerEvidence extends DatasetEvidenceIdentity {
  controlId: string;
  runId: string;
  controlClass: ValidationControlClass;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  qualification: BlockerQualification;
  failureConfirmed: boolean;
  /** Diagnostic findings block only when governance explicitly permits it. */
  eligibleInDiagnosticRun: boolean;
  execution: BlockerExecutionProvenance;
}

export interface ReadinessDecisionInput extends DatasetEvidenceIdentity {
  hasSourceData: boolean;
  requiredCollections: RequiredCollectionEvidence;
  run: ReadinessRunIdentity | null;
  execution: AssessmentExecutionEvidence;
  score: ReadinessScoreEvidence;
  blockers: ReadinessBlockerEvidence[];
}

export interface ReadinessDecision {
  methodologyVersion: typeof READINESS_METHODOLOGY_VERSION;
  assessmentCompleteness: AssessmentCompleteness;
  observedReadiness: ObservedReadiness;
  scoreState: ScoreState;
  score: number | null;
  qualifyingBlockerControlIds: string[];
  unresolvedBlockerControlIds: string[];
  eligibilityReasons: ReadinessEligibilityReason[];
}

function hasDatasetIdentity(identity: Pick<DatasetEvidenceIdentity, 'datasetId' | 'uploadSessionId' | 'uploadManifestId'>) {
  return Boolean(identity.datasetId || identity.uploadSessionId || identity.uploadManifestId);
}

function matchesDatasetEvidence(evidence: DatasetEvidenceIdentity, current: DatasetEvidenceIdentity) {
  if (evidence.direction !== current.direction) return false;
  if (!hasDatasetIdentity(evidence) || !hasDatasetIdentity(current)) return false;
  if (current.datasetId !== undefined && evidence.datasetId !== current.datasetId) return false;
  if (current.uploadSessionId !== undefined && evidence.uploadSessionId !== current.uploadSessionId) return false;
  if (current.uploadManifestId !== undefined && evidence.uploadManifestId !== current.uploadManifestId) return false;
  return true;
}

function hasRequiredCollections(collections: RequiredCollectionEvidence) {
  return collections.headers && collections.buyers && collections.lines;
}

function isValidScore(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value >= 0 && value <= 100;
}

function scoreProvenanceMatches(
  provenance: ConfirmedScoreProvenance,
  input: ReadinessDecisionInput,
  run: ReadinessRunIdentity
) {
  return (
    matchesDatasetEvidence(provenance, input) &&
    provenance.runId === run.runId &&
    provenance.rulesetId === run.rulesetId &&
    provenance.rulesetVersion === run.rulesetVersion &&
    provenance.methodologyVersion === READINESS_METHODOLOGY_VERSION
  );
}

function blockerExecutionMatches(blocker: ReadinessBlockerEvidence, run: ReadinessRunIdentity) {
  return (
    blocker.execution.resolution === 'confirmed' &&
    blocker.execution.executionId.trim() !== '' &&
    blocker.execution.rulesetId === run.rulesetId &&
    blocker.execution.rulesetVersion === run.rulesetVersion
  );
}

export function decideReadiness(input: ReadinessDecisionInput): ReadinessDecision {
  const reasons = new Set<ReadinessEligibilityReason>();
  const run = input.run;

  if (!input.hasSourceData) reasons.add('no_source_data');
  if (input.hasSourceData && !hasDatasetIdentity(input)) reasons.add('missing_dataset_identity');
  if (!run) reasons.add('missing_qualifying_run');
  if (run && !run.completed) reasons.add('run_not_completed');
  if (run && run.direction !== input.direction) reasons.add('stale_run_direction');
  if (run && run.direction === input.direction && !matchesDatasetEvidence(run, input)) reasons.add('stale_run_dataset');
  if (!hasRequiredCollections(input.requiredCollections)) reasons.add('missing_required_source_collections');
  if (run?.qualification === 'diagnostic_only') reasons.add('diagnostic_only_run');
  if (input.execution.expectedControls === 'incomplete') reasons.add('incomplete_expected_control_evidence');
  if (input.execution.expectedControls === 'unresolved') reasons.add('unresolved_expected_control_evidence');
  if (input.execution.hasUnevaluatedApplicableOutcomes) reasons.add('unevaluated_applicable_outcomes');
  if (input.execution.hasUndeterminedApplicability) reasons.add('undetermined_applicability');
  if (input.score.inputs === 'missing') reasons.add('missing_score_inputs');
  if (input.score.inputs === 'unresolved') reasons.add('unresolved_score_inputs');
  if (input.score.value !== null && !isValidScore(input.score.value)) reasons.add('invalid_score');
  if (input.score.provenance === null) reasons.add('missing_score_provenance');
  if (input.score.provenance?.resolution === 'unresolved') reasons.add('unresolved_score_provenance');

  const runMatches = Boolean(run && hasDatasetIdentity(input) && matchesDatasetEvidence(run, input));
  const completedMatchingRun = Boolean(runMatches && run?.completed);
  const assessmentComplete = Boolean(
    input.hasSourceData &&
      completedMatchingRun &&
      run?.qualification === 'decision_ready' &&
      hasRequiredCollections(input.requiredCollections) &&
      input.execution.expectedControls === 'confirmed' &&
      !input.execution.hasUnevaluatedApplicableOutcomes &&
      !input.execution.hasUndeterminedApplicability
  );

  let assessmentCompleteness: AssessmentCompleteness;
  if (!input.hasSourceData) assessmentCompleteness = 'not_assessed';
  else if (!completedMatchingRun) assessmentCompleteness = 'assessing';
  else assessmentCompleteness = assessmentComplete ? 'complete' : 'partial';

  const scoreProvenanceConfirmed = input.score.provenance?.resolution === 'confirmed';
  const scoreMatches = Boolean(
    run && scoreProvenanceConfirmed && scoreProvenanceMatches(input.score.provenance as ConfirmedScoreProvenance, input, run)
  );
  if (scoreProvenanceConfirmed && !scoreMatches) reasons.add('mismatched_score_provenance');

  const scoreEligible = input.score.inputs === 'calculable' && isValidScore(input.score.value) && scoreMatches;
  let scoreState: ScoreState = 'unavailable';
  if (assessmentCompleteness === 'complete' && scoreEligible) scoreState = 'final';
  else if (assessmentCompleteness === 'partial' && scoreEligible && input.score.provisionalEligible) {
    scoreState = 'provisional';
  }

  const currentBlockers = input.blockers.filter(
    (blocker) =>
      input.hasSourceData &&
      completedMatchingRun &&
      blocker.runId === run?.runId &&
      matchesDatasetEvidence(blocker, input)
  );
  const unresolvedBlockers = currentBlockers.filter(
    (blocker) => blocker.qualification === 'unresolved' || blocker.execution.resolution === 'unresolved'
  );
  const qualifyingBlockers = currentBlockers.filter(
    (blocker) =>
      blocker.qualification === 'confirmed' &&
      blocker.failureConfirmed &&
      run !== null &&
      blockerExecutionMatches(blocker, run) &&
      (run.qualification === 'decision_ready' || blocker.eligibleInDiagnosticRun)
  );

  let observedReadiness: ObservedReadiness = 'undetermined';
  if (qualifyingBlockers.length > 0) observedReadiness = 'blocked';
  else if (assessmentCompleteness === 'complete' && scoreState === 'final' && input.score.value !== null) {
    observedReadiness = input.score.value >= 90 ? 'ready' : input.score.value >= 75 ? 'watch' : 'blocked';
  }

  return {
    methodologyVersion: READINESS_METHODOLOGY_VERSION,
    assessmentCompleteness,
    observedReadiness,
    scoreState,
    score: scoreState === 'unavailable' ? null : input.score.value,
    qualifyingBlockerControlIds: qualifyingBlockers.map((blocker) => blocker.controlId),
    unresolvedBlockerControlIds: unresolvedBlockers.map((blocker) => blocker.controlId),
    eligibilityReasons: [...reasons],
  };
}
