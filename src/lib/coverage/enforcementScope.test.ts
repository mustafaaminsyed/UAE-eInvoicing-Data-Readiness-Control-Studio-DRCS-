import { describe, expect, it } from 'vitest';
import { BTUAE_02_ENFORCEMENT_SCOPE, getEnforcementScopeProfile } from './enforcementScope';

describe('enforcement scope metadata', () => {
  it('describes only the currently established BTUAE-02 enforcement', () => {
    expect(getEnforcementScopeProfile('BTUAE-02')).toEqual(BTUAE_02_ENFORCEMENT_SCOPE);
    expect(BTUAE_02_ENFORCEMENT_SCOPE.dimensions).toEqual({
      field: { status: 'enforced', ruleIds: ['UAE-UC1-CHK-059'] },
      structure: { status: 'enforced', ruleIds: ['UAE-UC1-CHK-060'] },
      dependency: { status: 'partial', ruleIds: ['IBR-138-AE', 'IBR-137-AE', 'IBR-152-AE'] },
      semantic_consistency: { status: 'not_evaluated', ruleIds: [] },
    });
  });

  it('does not invent profiles for other DRs', () => {
    expect(getEnforcementScopeProfile('IBT-003')).toBeUndefined();
  });
});
