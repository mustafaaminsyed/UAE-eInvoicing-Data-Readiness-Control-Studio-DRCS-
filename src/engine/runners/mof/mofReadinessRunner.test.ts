import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computeMoFCoverage } from '@/lib/coverage/mofCoverageEngine';
import { defaultMoFReadinessRunner } from '@/engine/runners/mof';
import { MoFCoverageResult } from '@/lib/coverage/mofCoverageEngine';

vi.mock('@/lib/coverage/mofCoverageEngine', () => ({
  computeMoFCoverage: vi.fn(),
}));

const coverageFixture: MoFCoverageResult = {
  sourceSchema: 'UAE_eInvoice_MoF_Source_Schema_v1',
  sourceVersion: '1.0.0',
  documentType: 'tax_invoice',
  totalFields: 51,
  mandatoryFields: 51,
  coveredMandatory: 45,
  mandatoryNotInTemplate: 4,
  mandatoryNotIngestible: 1,
  mandatoryNoBridge: 1,
  mandatoryCoveragePct: 88.24,
  mappableMandatoryFields: 50,
  mappableCoveredMandatory: 45,
  mappableMandatoryCoveragePct: 90,
  rows: [],
};

describe('defaultMoFReadinessRunner', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns pass-through disabled output when pre-gate is disabled', () => {
    const result = defaultMoFReadinessRunner.evaluate({
      enabled: false,
      documentType: 'tax_invoice',
      threshold: 100,
      strictNoBridge: false,
      mappedColumns: { buyers: [], headers: [], lines: [] },
    });

    expect(computeMoFCoverage).not.toHaveBeenCalled();
    expect(result).toEqual({
      enabled: false,
      passed: true,
      reasons: [],
      coverage: null,
    });
  });

  it('preserves existing threshold and no-bridge failure messages', () => {
    vi.mocked(computeMoFCoverage).mockReturnValue({
      ...coverageFixture,
      documentType: 'commercial_xml',
      mappableMandatoryCoveragePct: 87.4,
      mandatoryNoBridge: 2,
    });

    const result = defaultMoFReadinessRunner.evaluate({
      enabled: true,
      documentType: 'commercial_xml',
      threshold: 95,
      strictNoBridge: true,
      mappedColumns: { buyers: [], headers: ['invoice_number'], lines: [] },
    });

    expect(computeMoFCoverage).toHaveBeenCalledTimes(1);
    expect(computeMoFCoverage).toHaveBeenCalledWith('commercial_xml', {
      buyers: [],
      headers: ['invoice_number'],
      lines: [],
    });
    expect(result.enabled).toBe(true);
    expect(result.passed).toBe(false);
    expect(result.reasons).toEqual([
      'MoF mandatory baseline (commercial_xml) mappable coverage is 87% (required: 95%).',
      'MoF mandatory baseline (commercial_xml) has 2 field(s) without approved source-to-template bridge policy.',
    ]);
  });

  it('passes when coverage meets threshold and strict no-bridge gate is disabled', () => {
    vi.mocked(computeMoFCoverage).mockReturnValue({
      ...coverageFixture,
      mappableMandatoryCoveragePct: 100,
      mandatoryNoBridge: 3,
    });

    const result = defaultMoFReadinessRunner.evaluate({
      enabled: true,
      documentType: 'tax_invoice',
      threshold: 100,
      strictNoBridge: false,
      mappedColumns: { buyers: [], headers: [], lines: [] },
    });

    expect(result.passed).toBe(true);
    expect(result.reasons).toEqual([]);
    expect(result.coverage?.mappableMandatoryCoveragePct).toBe(100);
  });
});
