import { describe, expect, it } from 'vitest';
import { getRulesForDR } from '@/lib/rules/ruleTraceability';
import { getDRCoverageMaturity, getValidationDRTargets } from '@/lib/registry/validationToDRMap';
import { BTUAE_02_ENFORCEMENT_SCOPE } from '@/lib/coverage/enforcementScope';

describe('validation-to-DR mapping model', () => {
  it('derives invoice type coverage from explicit mappings only', () => {
    expect(getRulesForDR('IBT-003').map((rule) => rule.rule_id)).toEqual(
      expect.arrayContaining(['UAE-UC1-CHK-004', 'UAE-UC1-CHK-045', 'UAE-UC1-CHK-046'])
    );
  });

  it('keeps exact runtime mapping distinct from semantic enforcement completeness', () => {
    expect(getValidationDRTargets('UAE-UC1-CHK-004', { includeReferenceOnly: true })).toEqual([
      expect.objectContaining({ dr_id: 'IBT-003', mapping_type: 'exact' }),
    ]);
    expect(getDRCoverageMaturity('BTUAE-02')).toBe('runtime_enforced');
    expect(BTUAE_02_ENFORCEMENT_SCOPE.dimensions.dependency.status).toBe('partial');
    expect(BTUAE_02_ENFORCEMENT_SCOPE.dimensions.semantic_consistency.status).toBe('not_evaluated');
  });

  it('keeps scheme identifier DRs out of executable coverage until a dedicated validator exists', () => {
    expect(getDRCoverageMaturity('IBT-034-1')).toBe('reference_only');
    expect(getRulesForDR('IBT-034-1')).toHaveLength(0);
  });

  it('registers new VAT dependency and semantic validations as runtime-enforced partial coverage', () => {
    expect(getValidationDRTargets('UAE-UC1-CHK-049')).toEqual([
      expect.objectContaining({ dr_id: 'IBT-151', mapping_type: 'partial' }),
    ]);
    expect(getValidationDRTargets('UAE-UC1-CHK-053')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ dr_id: 'IBT-151', mapping_type: 'partial' }),
        expect.objectContaining({ dr_id: 'IBT-152', mapping_type: 'partial' }),
        expect.objectContaining({ dr_id: 'BTUAE-08', mapping_type: 'exact' }),
      ])
    );
    expect(getValidationDRTargets('UAE-UC1-CHK-054')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ dr_id: 'IBT-118', mapping_type: 'partial' }),
        expect.objectContaining({ dr_id: 'IBT-119', mapping_type: 'partial' }),
      ])
    );
  });
});
