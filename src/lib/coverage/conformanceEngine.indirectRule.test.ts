import { describe, expect, it } from 'vitest';

import { computeTraceabilityMatrix } from '@/lib/coverage/conformanceEngine';

describe('conformanceEngine indirect traceability', () => {
  it('marks BTUAE-02 as indirect rule coverage instead of plain no-rule', () => {
    const result = computeTraceabilityMatrix([]);
    const row = result.rows.find((entry) => entry.dr_id === 'BTUAE-02');

    expect(row).toBeDefined();
    expect(row?.coverageStatus).toBe('INDIRECT_RULE');
    expect(row?.ruleIds).toEqual([]);
    expect(row?.indirectRuleIds.length).toBeGreaterThan(0);
  });
});
