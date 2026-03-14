import { describe, expect, it } from 'vitest';
import { getControlsForRule } from '@/lib/registry/controlsRegistry';
import { getRuleTraceability } from '@/lib/rules/ruleTraceability';

describe('controlsRegistry UC1 gap-closure linkage', () => {
  it('links new commercial buyer identity checks to controls', () => {
    expect(getControlsForRule('UAE-UC1-CHK-036').length).toBeGreaterThan(0);
    expect(getControlsForRule('UAE-UC1-CHK-037').length).toBeGreaterThan(0);
  });

  it('links new line-level gap checks to controls', () => {
    expect(getControlsForRule('UAE-UC1-CHK-035').length).toBeGreaterThan(0);
    expect(getControlsForRule('UAE-UC1-CHK-038').length).toBeGreaterThan(0);
    expect(getControlsForRule('UAE-UC1-CHK-039').length).toBeGreaterThan(0);
    expect(getControlsForRule('UAE-UC1-CHK-040').length).toBeGreaterThan(0);
  });

  it('links first-wave codelist checks to controls', () => {
    expect(getControlsForRule('UAE-UC1-CHK-041').length).toBeGreaterThan(0);
    expect(getControlsForRule('UAE-UC1-CHK-042').length).toBeGreaterThan(0);
    expect(getControlsForRule('UAE-UC1-CHK-043').length).toBeGreaterThan(0);
    expect(getControlsForRule('UAE-UC1-CHK-044').length).toBeGreaterThan(0);
    expect(getControlsForRule('UAE-UC1-CHK-045').length).toBeGreaterThan(0);
    expect(getControlsForRule('UAE-UC1-CHK-046').length).toBeGreaterThan(0);
    expect(getControlsForRule('UAE-UC1-CHK-047').length).toBeGreaterThan(0);
    expect(getControlsForRule('UAE-UC1-CHK-048').length).toBeGreaterThan(0);
  });

  it('links VAT dependency and semantic checks to explicit controls', () => {
    expect(getControlsForRule('UAE-UC1-CHK-049').length).toBeGreaterThan(0);
    expect(getControlsForRule('UAE-UC1-CHK-050').length).toBeGreaterThan(0);
    expect(getControlsForRule('UAE-UC1-CHK-051').length).toBeGreaterThan(0);
    expect(getControlsForRule('UAE-UC1-CHK-052').length).toBeGreaterThan(0);
    expect(getControlsForRule('UAE-UC1-CHK-053').length).toBeGreaterThan(0);
    expect(getControlsForRule('UAE-UC1-CHK-054').length).toBeGreaterThan(0);
  });

  it('governs every executable UAE rule that has authoritative DR linkage', () => {
    const uncoveredRules = getRuleTraceability()
      .filter((rule) => rule.affected_dr_ids.length > 0)
      .filter((rule) => getControlsForRule(rule.rule_id).length === 0)
      .map((rule) => rule.rule_id);

    expect(uncoveredRules).toEqual([]);
  });
});
