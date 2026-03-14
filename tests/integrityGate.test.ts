import { describe, expect, it } from 'vitest';
import { runConsistencyChecks, runRuleIntegrityGate } from '@/lib/coverage/consistencyValidator';
import { UAE_UC1_CHECK_PACK } from '@/lib/checks/uaeUC1CheckPack';
import { VALIDATION_TO_DR_MAP } from '@/lib/registry/validationToDRMap';

describe('Rule Integrity Gate', () => {
  it('passes for the current curated validation pack and DR mapping model', () => {
    const report = runConsistencyChecks();
    const errors = report.issues.filter((issue) => issue.level === 'error');

    expect(errors).toHaveLength(0);
  });

  it('fails when a runtime-enforced DR points to a non-existent executable validation', () => {
    expect(() =>
      runRuleIntegrityGate({
        validationMap: [
          ...VALIDATION_TO_DR_MAP,
          {
            validation_id: 'UAE-UC1-CHK-999',
            dr_targets: [{ dr_id: 'IBT-001', mapping_type: 'exact', validated_fields: ['invoice_number'] }],
          },
        ],
      })
    ).toThrow(/non-existent checks/i);
  });

  it('fails when a validation maps to the wrong DR field binding', () => {
    expect(() =>
      runRuleIntegrityGate({
        validationMap: VALIDATION_TO_DR_MAP.map((entry) =>
          entry.validation_id === 'UAE-UC1-CHK-001'
            ? {
                ...entry,
                dr_targets: [{ dr_id: 'IBT-001', mapping_type: 'exact', validated_fields: ['issue_date'] }],
              }
            : entry
        ),
      })
    ).toThrow(/field binding/i);
  });

  it('fails when a rule is missing execution-layer classification', () => {
    const invalidChecks = UAE_UC1_CHECK_PACK.map((check) =>
      check.check_id === 'UAE-UC1-CHK-001'
        ? ({ ...check, execution_layer: undefined } as any)
        : check
    );

    expect(() => runRuleIntegrityGate({ checks: invalidChecks })).toThrow(/taxonomy|execution_layer/i);
  });
});
