import { describe, expect, it } from 'vitest';

import { checkRunReadiness } from '@/lib/coverage/conformanceEngine';

describe('checkRunReadiness', () => {
  it('allows diagnostic runs when partial mapping coverage exists under a selected mapping profile', () => {
    const readiness = checkRunReadiness(true, 42, null, { allowPartialMapping: true });

    expect(readiness.canRun).toBe(true);
    expect(readiness.reasons).toHaveLength(0);
  });

  it('still blocks when mapping coverage is zero even in diagnostic mode', () => {
    const readiness = checkRunReadiness(true, 0, null, { allowPartialMapping: true });

    expect(readiness.canRun).toBe(false);
    expect(readiness.reasons[0]?.message).toMatch(/Mandatory DR mapping coverage is 0%/);
  });
});
