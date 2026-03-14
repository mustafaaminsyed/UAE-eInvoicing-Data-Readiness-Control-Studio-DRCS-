import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import TraceabilityPage from '@/pages/TraceabilityPage';
import { computeTraceabilityMatrix } from '@/lib/coverage/conformanceEngine';

vi.mock('@/context/ComplianceContext', () => ({
  useCompliance: () => ({
    buyers: [],
    headers: [],
    lines: [],
    isDataLoaded: true,
    pintAEExceptions: [
      {
        id: 'exc-1',
        check_id: 'UAE-UC1-CHK-014',
        check_name: 'Seller endpoint present',
        severity: 'High',
        scope: 'Header',
        rule_type: 'structural_rule',
        execution_layer: 'schema',
        failure_class: 'structural_failure',
        pint_reference_terms: ['IBT-034-1'],
        message: 'Seller endpoint missing',
        timestamp: '2026-03-14T10:00:00Z',
      },
      {
        id: 'exc-2',
        check_id: 'UAE-UC1-CHK-004',
        check_name: 'Invoice type present',
        severity: 'High',
        scope: 'Header',
        rule_type: 'structural_rule',
        execution_layer: 'schema',
        failure_class: 'structural_failure',
        pint_reference_terms: ['BTUAE-02'],
        message: 'Invoice type missing',
        timestamp: '2026-03-14T10:00:01Z',
      },
    ],
  }),
}));

vi.mock('@/components/traceability/ScenarioLensPanel', () => ({
  ScenarioLensPanel: () => null,
}));

vi.mock('@/components/traceability/DrillDownDialog', () => ({
  DrillDownDialog: () => null,
}));

vi.mock('@/lib/coverage/conformanceEngine', async () => {
  const actual = await vi.importActual<typeof import('@/lib/coverage/conformanceEngine')>(
    '@/lib/coverage/conformanceEngine'
  );
  return {
    ...actual,
    computeTraceabilityMatrix: vi.fn(() => ({
      rows: [],
      gaps: {
        mandatoryNotInTemplate: 0,
        mandatoryNotIngestible: 0,
        mandatoryUnmapped: 0,
        mandatoryLowPopulation: 0,
        drsWithNoRules: 0,
        drsWithNoControls: 0,
        drsCovered: 0,
        totalDRs: 0,
        mandatoryDRs: 0,
        populationThreshold: 95,
      },
      specVersion: 'Test Spec',
    })),
  };
});

describe('TraceabilityPage DR exception attribution', () => {
  it('aggregates exception counts from authoritative validation mappings instead of pint references', async () => {
    render(
      <MemoryRouter>
        <TraceabilityPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(computeTraceabilityMatrix).toHaveBeenCalled();
    });

    const exceptionCountsByDR = vi.mocked(computeTraceabilityMatrix).mock.calls[0]?.[1];
    expect(exceptionCountsByDR).toBeInstanceOf(Map);
    expect(exceptionCountsByDR?.get('IBT-034')).toEqual({ pass: 0, fail: 1 });
    expect(exceptionCountsByDR?.get('IBT-003')).toEqual({ pass: 0, fail: 1 });
    expect(exceptionCountsByDR?.has('IBT-034-1')).toBe(false);
    expect(exceptionCountsByDR?.has('BTUAE-02')).toBe(false);
  });
});
