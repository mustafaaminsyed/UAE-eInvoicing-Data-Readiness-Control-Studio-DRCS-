import { canonicalizePintTermId } from '@/lib/registry/pintTermGovernance';

export type EnforcementDimension = 'field' | 'structure' | 'dependency' | 'semantic_consistency';
export type EnforcementScopeStatus = 'enforced' | 'partial' | 'not_enforced' | 'not_evaluated' | 'not_applicable';

export interface EnforcementScopeDimension {
  status: EnforcementScopeStatus;
  ruleIds: string[];
}

export interface EnforcementScopeProfile {
  drId: string;
  dimensions: Record<EnforcementDimension, EnforcementScopeDimension>;
}

export const BTAE_02_ENFORCEMENT_SCOPE: EnforcementScopeProfile = {
  drId: 'BTAE-02',
  dimensions: {
    field: { status: 'enforced', ruleIds: ['UAE-UC1-CHK-059'] },
    structure: { status: 'enforced', ruleIds: ['UAE-UC1-CHK-060'] },
    dependency: { status: 'partial', ruleIds: ['IBR-138-AE', 'IBR-137-AE', 'IBR-152-AE'] },
    semantic_consistency: { status: 'not_evaluated', ruleIds: [] },
  },
};

/** @deprecated Use BTAE_02_ENFORCEMENT_SCOPE. */
export const BTUAE_02_ENFORCEMENT_SCOPE = BTAE_02_ENFORCEMENT_SCOPE;

export function getEnforcementScopeProfile(drId: string): EnforcementScopeProfile | undefined {
  return canonicalizePintTermId(drId) === BTAE_02_ENFORCEMENT_SCOPE.drId
    ? BTAE_02_ENFORCEMENT_SCOPE
    : undefined;
}
