import { describe, expect, it } from 'vitest';

import { computeTraceabilityMatrix } from '@/lib/coverage/conformanceEngine';
import { BTUAE_02_ENFORCEMENT_SCOPE } from '@/lib/coverage/enforcementScope';

describe('conformanceEngine BTUAE-02 coverage scope', () => {
  it('retains direct coverage while exposing partial enforcement scope', () => {
    const result = computeTraceabilityMatrix([]);
    const row = result.rows.find((entry) => entry.dr_id === 'BTUAE-02');

    expect(row).toBeDefined();
    expect(row?.coverageStatus).toBe('COVERED');
    expect(row?.ruleIds).toEqual(expect.arrayContaining(['UAE-UC1-CHK-059', 'UAE-UC1-CHK-060']));
    expect(BTUAE_02_ENFORCEMENT_SCOPE.dimensions.dependency.status).toBe('partial');
    expect(BTUAE_02_ENFORCEMENT_SCOPE.dimensions.semantic_consistency.status).toBe('not_evaluated');
  });
});
