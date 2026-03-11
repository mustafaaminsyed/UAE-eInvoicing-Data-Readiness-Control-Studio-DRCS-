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
});
