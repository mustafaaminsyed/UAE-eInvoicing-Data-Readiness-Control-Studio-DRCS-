import { describe, expect, it } from 'vitest';

import {
  getAffectedDRIdsForRule,
  getDRsWithoutRules,
  getRulesForDR,
} from '@/lib/rules/ruleTraceability';

describe('canonical rule traceability', () => {
  it('publishes canonical identifiers from legacy validation mappings', () => {
    expect(getAffectedDRIdsForRule('UAE-UC1-CHK-059')).toContain('BTAE-02');
    expect(getAffectedDRIdsForRule('UAE-UC1-CHK-059')).not.toContain('BTUAE-02');
  });

  it('accepts both legacy and canonical identifiers at lookup boundaries', () => {
    expect(getRulesForDR('BTUAE-02').map((rule) => rule.rule_id)).toEqual(
      expect.arrayContaining(['UAE-UC1-CHK-059', 'UAE-UC1-CHK-060'])
    );
    expect(getRulesForDR('BTAE-02').map((rule) => rule.rule_id)).toEqual(
      expect.arrayContaining(['UAE-UC1-CHK-059', 'UAE-UC1-CHK-060'])
    );
    expect(getDRsWithoutRules(['BTUAE-02', 'BTAE-02'])).toEqual([]);
  });
});
