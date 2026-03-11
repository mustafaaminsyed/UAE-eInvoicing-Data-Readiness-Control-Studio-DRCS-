import { MoFReadinessRunner, MoFReadinessRunnerInput, MoFReadinessRunnerOutput } from '@/engine/contracts';
import { computeMoFCoverage } from '@/lib/coverage/mofCoverageEngine';

export function evaluateMoFReadiness(input: MoFReadinessRunnerInput): MoFReadinessRunnerOutput {
  if (!input.enabled) {
    return {
      enabled: false,
      passed: true,
      reasons: [],
      coverage: null,
    };
  }

  const coverage = computeMoFCoverage(input.documentType, input.mappedColumns);
  const reasons: string[] = [];

  if (coverage.mappableMandatoryCoveragePct < input.threshold) {
    reasons.push(
      `MoF mandatory baseline (${coverage.documentType}) mappable coverage is ${coverage.mappableMandatoryCoveragePct.toFixed(
        0
      )}% (required: ${input.threshold}%).`
    );
  }

  if (input.strictNoBridge && coverage.mandatoryNoBridge > 0) {
    reasons.push(
      `MoF mandatory baseline (${coverage.documentType}) has ${coverage.mandatoryNoBridge} field(s) without approved source-to-template bridge policy.`
    );
  }

  return {
    enabled: true,
    passed: reasons.length === 0,
    reasons,
    coverage,
  };
}

export const defaultMoFReadinessRunner: MoFReadinessRunner = {
  evaluate: evaluateMoFReadiness,
};
