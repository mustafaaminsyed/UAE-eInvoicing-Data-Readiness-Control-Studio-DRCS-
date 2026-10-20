import { describe, expect, it } from 'vitest';

import {
  READINESS_METHODOLOGY_VERSION,
  decideReadiness,
  type ConfirmedScoreProvenance,
  type ReadinessBlockerEvidence,
  type ReadinessDecisionInput,
} from './readinessDecision';

function scoreProvenance(overrides: Partial<ConfirmedScoreProvenance> = {}): ConfirmedScoreProvenance {
  return {
    resolution: 'confirmed',
    runId: 'run-ar-1',
    direction: 'AR',
    datasetId: 'dataset-ar-1',
    uploadSessionId: 'upload-session-1',
    uploadManifestId: 'upload-manifest-1',
    rulesetId: 'uae-pint-ae',
    rulesetVersion: '1.0.4',
    methodologyVersion: READINESS_METHODOLOGY_VERSION,
    ...overrides,
  };
}

function input(overrides: Partial<ReadinessDecisionInput> = {}): ReadinessDecisionInput {
  return {
    direction: 'AR',
    datasetId: 'dataset-ar-1',
    uploadSessionId: 'upload-session-1',
    uploadManifestId: 'upload-manifest-1',
    hasSourceData: true,
    requiredCollections: { headers: true, buyers: true, lines: true },
    run: {
      runId: 'run-ar-1',
      direction: 'AR',
      datasetId: 'dataset-ar-1',
      uploadSessionId: 'upload-session-1',
      uploadManifestId: 'upload-manifest-1',
      rulesetId: 'uae-pint-ae',
      rulesetVersion: '1.0.4',
      completed: true,
      qualification: 'decision_ready',
    },
    execution: {
      expectedControls: 'confirmed',
      hasUnevaluatedApplicableOutcomes: false,
      hasUndeterminedApplicability: false,
    },
    score: {
      value: 95,
      inputs: 'calculable',
      provisionalEligible: false,
      provenance: scoreProvenance(),
    },
    blockers: [],
    ...overrides,
  };
}

function blocker(overrides: Partial<ReadinessBlockerEvidence> = {}): ReadinessBlockerEvidence {
  return {
    controlId: 'CONTROL-1',
    runId: 'run-ar-1',
    direction: 'AR',
    datasetId: 'dataset-ar-1',
    uploadSessionId: 'upload-session-1',
    uploadManifestId: 'upload-manifest-1',
    controlClass: 'regulatory',
    severity: 'Critical',
    qualification: 'confirmed',
    failureConfirmed: true,
    eligibleInDiagnosticRun: false,
    execution: {
      resolution: 'confirmed',
      executionId: 'execution-1',
      rulesetId: 'uae-pint-ae',
      rulesetVersion: '1.0.4',
    },
    ...overrides,
  };
}

describe('decideReadiness', () => {
  it('returns not assessed, undetermined, and unavailable without source data', () => {
    const result = decideReadiness(input({ hasSourceData: false, run: null }));
    expect(result).toMatchObject({ assessmentCompleteness: 'not_assessed', observedReadiness: 'undetermined', scoreState: 'unavailable', score: null });
    expect(result.eligibilityReasons).toEqual(expect.arrayContaining(['no_source_data', 'missing_qualifying_run']));
  });

  it('returns assessing when data exists without a completed current run', () => {
    expect(decideReadiness(input({ run: null }))).toMatchObject({ assessmentCompleteness: 'assessing', observedReadiness: 'undetermined', scoreState: 'unavailable' });
    expect(decideReadiness(input({ run: { ...input().run!, completed: false } })).eligibilityReasons).toContain('run_not_completed');
  });

  it('keeps diagnostic-only evidence partial and requires explicit provisional eligibility', () => {
    const run = { ...input().run!, qualification: 'diagnostic_only' as const };
    expect(decideReadiness(input({ run })).scoreState).toBe('unavailable');
    expect(decideReadiness(input({ run, score: { ...input().score, value: 86, provisionalEligible: true } }))).toMatchObject({
      assessmentCompleteness: 'partial', observedReadiness: 'undetermined', scoreState: 'provisional', score: 86,
    });
  });

  it.each([
    ['incomplete', 'incomplete_expected_control_evidence'],
    ['unresolved', 'unresolved_expected_control_evidence'],
  ] as const)('keeps %s expected-control evidence partial', (expectedControls, reason) => {
    const result = decideReadiness(input({
      execution: { ...input().execution, expectedControls },
      score: { ...input().score, provisionalEligible: true },
    }));
    expect(result).toMatchObject({ assessmentCompleteness: 'partial', observedReadiness: 'undetermined', scoreState: 'provisional' });
    expect(result.eligibilityReasons).toContain(reason);
  });

  it.each([
    [{ hasUnevaluatedApplicableOutcomes: true }, 'unevaluated_applicable_outcomes'],
    [{ hasUndeterminedApplicability: true }, 'undetermined_applicability'],
  ])('keeps incomplete execution outcomes partial', (executionOverride, reason) => {
    const result = decideReadiness(input({
      execution: { ...input().execution, ...executionOverride },
      score: { ...input().score, provisionalEligible: true },
    }));
    expect(result).toMatchObject({ assessmentCompleteness: 'partial', observedReadiness: 'undetermined', scoreState: 'provisional' });
    expect(result.eligibilityReasons).toContain(reason);
  });

  it('prevents missing collections from producing a Final score', () => {
    const result = decideReadiness(input({ requiredCollections: { headers: true, buyers: false, lines: true } }));
    expect(result).toMatchObject({ assessmentCompleteness: 'partial', scoreState: 'unavailable', score: null });
    expect(result.eligibilityReasons).toContain('missing_required_source_collections');
  });

  it('keeps unresolved score inputs unavailable', () => {
    const result = decideReadiness(input({ score: { ...input().score, inputs: 'unresolved' } }));
    expect(result).toMatchObject({ assessmentCompleteness: 'complete', observedReadiness: 'undetermined', scoreState: 'unavailable', score: null });
    expect(result.eligibilityReasons).toContain('unresolved_score_inputs');
  });

  it.each([
    ['wrong run', { runId: 'run-old' }],
    ['wrong direction', { direction: 'AP' as const }],
    ['wrong dataset', { datasetId: 'dataset-old' }],
    ['wrong upload session', { uploadSessionId: 'upload-session-old' }],
    ['wrong upload manifest', { uploadManifestId: 'upload-manifest-old' }],
    ['wrong methodology', { methodologyVersion: 'drcs-readiness-decision-old' }],
    ['wrong ruleset', { rulesetId: 'other-ruleset' }],
    ['wrong ruleset version', { rulesetVersion: '0.9.0' }],
  ] as const)('rejects score provenance with %s', (_label, provenanceOverride) => {
    const result = decideReadiness(input({ score: { ...input().score, provenance: scoreProvenance(provenanceOverride) } }));
    expect(result).toMatchObject({ scoreState: 'unavailable', score: null, observedReadiness: 'undetermined' });
    expect(result.eligibilityReasons).toContain('mismatched_score_provenance');
  });

  it.each([
    [null, 'missing_score_provenance'],
    [{ resolution: 'unresolved' } as const, 'unresolved_score_provenance'],
  ])('rejects absent or unresolved score provenance', (provenance, reason) => {
    const result = decideReadiness(input({ score: { ...input().score, provenance } }));
    expect(result).toMatchObject({ scoreState: 'unavailable', score: null, observedReadiness: 'undetermined' });
    expect(result.eligibilityReasons).toContain(reason);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -0.01, 100.01])(
    'rejects invalid score %s instead of clamping it',
    (value) => {
      const result = decideReadiness(input({ score: { ...input().score, value } }));
      expect(result).toMatchObject({ scoreState: 'unavailable', score: null, observedReadiness: 'undetermined' });
      expect(result.eligibilityReasons).toContain('invalid_score');
    }
  );

  it('lets a confirmed qualifying blocker override readiness without manufacturing a score', () => {
    expect(decideReadiness(input({ blockers: [blocker()] }))).toMatchObject({ observedReadiness: 'blocked', scoreState: 'final', score: 95 });
    const noScore = decideReadiness(input({
      execution: { ...input().execution, hasUnevaluatedApplicableOutcomes: true },
      score: { ...input().score, value: null, inputs: 'missing', provisionalEligible: false },
      blockers: [blocker()],
    }));
    expect(noScore).toMatchObject({ assessmentCompleteness: 'partial', observedReadiness: 'blocked', scoreState: 'unavailable', score: null });
  });

  it.each([
    ['wrong run', { runId: 'run-old' }],
    ['wrong direction', { direction: 'AP' as const }],
    ['wrong dataset', { datasetId: 'dataset-old' }],
    ['wrong upload identity', { uploadSessionId: 'upload-session-old' }],
  ] as const)('ignores a blocker from the %s', (_label, blockerOverride) => {
    const result = decideReadiness(input({ blockers: [blocker(blockerOverride)] }));
    expect(result.observedReadiness).toBe('ready');
    expect(result.qualifyingBlockerControlIds).toEqual([]);
  });

  it.each([
    ['wrong ruleset', { rulesetId: 'other-ruleset' }],
    ['wrong ruleset version', { rulesetVersion: '0.9.0' }],
  ] as const)('does not qualify blocker execution with %s', (_label, executionOverride) => {
    const result = decideReadiness(input({ blockers: [blocker({
      execution: { ...blocker().execution, ...executionOverride } as ReadinessBlockerEvidence['execution'],
    })] }));
    expect(result.observedReadiness).toBe('ready');
    expect(result.qualifyingBlockerControlIds).toEqual([]);
  });

  it('reports unresolved blocker qualification and execution provenance', () => {
    const result = decideReadiness(input({ blockers: [
      blocker({ controlId: 'QUALIFICATION', qualification: 'unresolved' }),
      blocker({ controlId: 'EXECUTION', execution: { resolution: 'unresolved' } }),
    ] }));
    expect(result.observedReadiness).toBe('ready');
    expect(result.unresolvedBlockerControlIds).toEqual(['QUALIFICATION', 'EXECUTION']);
  });

  it('does not infer blocker qualification from Critical severity', () => {
    const result = decideReadiness(input({ blockers: [blocker({ qualification: 'not_qualified' })] }));
    expect(result.observedReadiness).toBe('ready');
    expect(result.qualifyingBlockerControlIds).toEqual([]);
  });

  it('allows an explicitly eligible diagnostic blocker to force Blocked', () => {
    const run = { ...input().run!, qualification: 'diagnostic_only' as const };
    const result = decideReadiness(input({
      run,
      score: { ...input().score, provisionalEligible: true },
      blockers: [blocker({ eligibleInDiagnosticRun: true })],
    }));
    expect(result).toMatchObject({ assessmentCompleteness: 'partial', observedReadiness: 'blocked', scoreState: 'provisional' });
  });

  it('does not allow stale blockers to block an assessment with no source data', () => {
    const result = decideReadiness(input({ hasSourceData: false, blockers: [blocker()] }));
    expect(result).toMatchObject({ assessmentCompleteness: 'not_assessed', observedReadiness: 'undetermined', scoreState: 'unavailable' });
  });

  it('rejects run evidence from another direction, dataset, or missing current identity', () => {
    expect(decideReadiness(input({ run: { ...input().run!, direction: 'AP' } })).eligibilityReasons).toContain('stale_run_direction');
    expect(decideReadiness(input({ run: { ...input().run!, datasetId: 'dataset-old' } })).eligibilityReasons).toContain('stale_run_dataset');
    const noIdentity = decideReadiness(input({ datasetId: undefined, uploadSessionId: undefined, uploadManifestId: undefined }));
    expect(noIdentity).toMatchObject({ assessmentCompleteness: 'assessing', scoreState: 'unavailable' });
    expect(noIdentity.eligibilityReasons).toContain('missing_dataset_identity');
  });

  it.each([
    [90, 'ready'],
    [89.99, 'watch'],
    [75, 'watch'],
    [74.99, 'blocked'],
  ] as const)('applies final score threshold %s as %s', (value, observedReadiness) => {
    expect(decideReadiness(input({ score: { ...input().score, value } }))).toMatchObject({
      assessmentCompleteness: 'complete', scoreState: 'final', observedReadiness,
    });
  });

  it('returns the explicit methodology version', () => {
    expect(decideReadiness(input()).methodologyVersion).toBe(READINESS_METHODOLOGY_VERSION);
  });
});
