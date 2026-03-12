import { describe, expect, it } from 'vitest';
import { getControlsForRule } from '@/lib/registry/controlsRegistry';

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
});
