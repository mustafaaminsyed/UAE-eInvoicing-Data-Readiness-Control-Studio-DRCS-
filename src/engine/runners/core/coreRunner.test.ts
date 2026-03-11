import { describe, expect, it, vi } from 'vitest';
import { runAllChecks } from '@/lib/checks/checksRegistry';
import { defaultCoreRunner } from '@/engine/runners/core';
import { DataContext } from '@/types/compliance';

vi.mock('@/lib/checks/checksRegistry', () => ({
  runAllChecks: vi.fn(),
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

    vi.mocked(runAllChecks).mockReturnValue(expected);

    const output = defaultCoreRunner.run({ dataContext });

    expect(runAllChecks).toHaveBeenCalledTimes(1);
    expect(runAllChecks).toHaveBeenCalledWith(dataContext);
    expect(output.checkResults).toEqual(expected);
  });
});
