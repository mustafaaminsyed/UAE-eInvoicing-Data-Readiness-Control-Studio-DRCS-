import { RuleExecution } from '@/types/executionLedger';

export interface RecordedDRCounts { pass: number; fail: number; exceptions: number }

export function recordedCountsByDR(executions: RuleExecution[]): Map<string, RecordedDRCounts> {
  const counts = new Map<string, RecordedDRCounts>();
  for (const execution of executions) {
    for (const dr of new Set(execution.check.pint_reference_terms || [])) {
      const current = counts.get(dr) || { pass: 0, fail: 0, exceptions: 0 };
      current.pass += execution.passed;
      current.fail += execution.failed;
      current.exceptions += execution.exceptionCount;
      counts.set(dr, current);
    }
  }
  return counts;
}
