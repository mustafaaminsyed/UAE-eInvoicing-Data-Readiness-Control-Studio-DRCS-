import { describe, expect, it } from 'vitest';

import {
  canonicalizePintTermId,
  classifyRegistryResponsibility,
  getCompatiblePintTermIds,
  getLegacyPintTermAliases,
  getResponsibilityProfile,
  pintTermIdsEqual,
} from '@/lib/registry/pintTermGovernance';

describe('PINT term governance', () => {
  it.each([
    ['BTUAE-02', 'BTAE-02'],
    ['BTUAE-08', 'BTAE-08'],
    ['BTUAE-15', 'BTAE-15'],
    ['BTAE-03', 'BTAE-03'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(canonicalizePintTermId(input)).toBe(expected);
  });

  it('supports legacy identifiers without making them canonical', () => {
    expect(getLegacyPintTermAliases('BTAE-02')).toEqual(['BTUAE-02']);
    expect(pintTermIdsEqual('BTUAE-02', 'BTAE-02')).toBe(true);
    expect(getCompatiblePintTermIds('BTUAE-02')).toEqual(['BTAE-02', 'BTUAE-02']);
  });

  it('classifies BTAE-07 as an ASP-generated output rather than taxpayer source data', () => {
    expect(getResponsibilityProfile('BTAE-07')).toEqual({
      termId: 'BTAE-07',
      responsibility: 'asp_generated',
      rationale: 'The UAE e-invoicing guidance assigns invoice UUID generation to the ASP.',
      sourceRequired: false,
    });
  });

  it('normalizes legacy registry responsibility strings', () => {
    expect(classifyRegistryResponsibility('ERP (Corner 1)')).toBe('taxpayer_source');
    expect(classifyRegistryResponsibility('ASP (Corner 2)')).toBe('asp_generated');
    expect(classifyRegistryResponsibility('ERP (Corner 1)', { derived: true })).toBe('dcs_derived');
    expect(classifyRegistryResponsibility('ASP (Corner 2)', { fixedConfiguration: true })).toBe('fixed_configuration');
  });
});

