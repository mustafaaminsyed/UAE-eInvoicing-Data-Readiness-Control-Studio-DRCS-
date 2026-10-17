import { describe, expect, it } from 'vitest';

import { COVERAGE_DIMENSIONS, COVERAGE_STATUS_LABELS } from '@/lib/coverage/coverageSemantics';

describe('coverage semantics', () => {
  it('keeps source supply, runtime implementation, and unsupported evaluation distinct', () => {
    expect(COVERAGE_DIMENSIONS.source.label).toBe('MoF source coverage');
    expect(COVERAGE_DIMENSIONS.runtime.label).toBe('Runtime control coverage');
    expect(COVERAGE_DIMENSIONS.unsupported.label).toBe('Not evaluated by DCS');
  });

  it('does not describe a missing runtime rule as a regulatory applicability finding', () => {
    expect(COVERAGE_STATUS_LABELS.NO_RULE).toBe('Not evaluated by DCS');
    expect(COVERAGE_DIMENSIONS.unsupported.description).toContain('Applicability is not inferred');
  });
});
