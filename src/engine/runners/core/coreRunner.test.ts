import { describe, expect, it, vi } from 'vitest';
import { runAllChecksWithTelemetry } from '@/lib/checks/checksRegistry';
import { defaultCoreRunner } from '@/engine/runners/core';
import { DataContext } from '@/types/compliance';

vi.mock('@/lib/checks/checksRegistry', () => ({
  runAllChecksWithTelemetry: vi.fn(),
}));

describe('defaultCoreRunner', () => {
  it('wraps built-in check execution without changing output', () => {
    const dataContext: DataContext = {
      buyers: [],
      headers: [],
      lines: [],
      buyerMap: new Map(),
      headerMap: new Map(),
      linesByInvoice: new Map(),
    };
    const expected = [
      {
        checkId: 'missing_mandatory_fields',
        checkName: 'Missing Mandatory Header Fields',
        severity: 'Critical' as const,
        passed: 0,
        failed: 1,
        exceptions: [],
      },
    ];

    const telemetry = [
      {
        rule_id: 'missing_mandatory_fields',
        execution_count: 0,
        failure_count: 1,
        execution_source: 'runtime' as const,
      },
    ];

    const executionEvidence = [];
    vi.mocked(runAllChecksWithTelemetry).mockReturnValue({ checkResults: expected, telemetry, executionEvidence });

    const output = defaultCoreRunner.run({ dataContext, direction: 'AR' });

    expect(runAllChecksWithTelemetry).toHaveBeenCalledTimes(1);
    expect(runAllChecksWithTelemetry).toHaveBeenCalledWith(dataContext, 'AR');
    expect(output.checkResults).toEqual(expected);
    expect(output.telemetry).toEqual(telemetry);
    expect(output.executionEvidence).toEqual(executionEvidence);
  });
});
