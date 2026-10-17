import { describe, expect, it } from 'vitest';

import { computeTraceabilityMatrix } from '@/lib/coverage/conformanceEngine';
import { BTAE_02_ENFORCEMENT_SCOPE } from '@/lib/coverage/enforcementScope';

describe('conformanceEngine BTAE-02 coverage scope', () => {
  it('retains direct coverage while exposing partial enforcement scope', () => {
    const result = computeTraceabilityMatrix([]);
    const row = result.rows.find((entry) => entry.dr_id === 'BTAE-02');

    expect(row).toBeDefined();
    expect(row?.coverageStatus).toBe('COVERED');
    expect(row?.ruleIds).toEqual(expect.arrayContaining(['UAE-UC1-CHK-059', 'UAE-UC1-CHK-060']));
    expect(BTAE_02_ENFORCEMENT_SCOPE.dimensions.dependency.status).toBe('partial');
    expect(BTAE_02_ENFORCEMENT_SCOPE.dimensions.semantic_consistency.status).toBe('not_evaluated');
  });

  it('aggregates historical legacy exceptions into the canonical row', () => {
    const result = computeTraceabilityMatrix([], new Map([
      ['BTUAE-02', { pass: 3, fail: 1 }],
      ['BTAE-02', { pass: 2, fail: 0 }],
    ]));
    const row = result.rows.find((entry) => entry.dr_id === 'BTAE-02');

    expect(row?.exceptionCount).toBe(1);
    expect(row?.lastRunPassRate).toBeCloseTo(83.333, 2);
  });
});
