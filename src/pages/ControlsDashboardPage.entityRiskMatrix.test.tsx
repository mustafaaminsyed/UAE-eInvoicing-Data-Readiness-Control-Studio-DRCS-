import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ControlsDashboardPage from '@/pages/ControlsDashboardPage';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/lib/api/checksApi', () => ({
  fetchCheckRuns: vi.fn(async () => [
    {
      id: 'run-1',
      run_date: new Date(Date.UTC(2026, 2, 13)).toISOString(),
      dataset_type: 'AR',
      total_invoices: 10,
      total_exceptions: 2,
      critical_count: 1,
      high_count: 1,
      medium_count: 0,
      low_count: 0,
      pass_rate: 90,
      results_summary: {},
    },
  ]),
  fetchLatestEntityScores: vi.fn(async () => [
    {
      id: 'seller-a',
      run_id: 'run-1',
      entity_type: 'seller',
      entity_id: 'TRN-001',
      entity_name: 'Seller A',
      score: 70,
      total_exceptions: 2,
      critical_count: 1,
      high_count: 1,
      medium_count: 0,
      low_count: 0,
      created_at: '2026-03-13T00:00:00.000Z',
    },
  ]),
}));

vi.mock('@/lib/api/casesApi', () => ({
  fetchClientHealthScores: vi.fn(async () => []),
  getRejectionAnalytics: vi.fn(async () => ({ totalRejections: 0, repeatRate: 0 })),
  getSLAMetrics: vi.fn(async () => ({
    averageResolutionHours: {},
    breachPercentage: 0,
    totalCases: 0,
    breachedCases: 0,
    openCases: 0,
    resolvedCases: 0,
  })),
}));

vi.mock('@/lib/coverage/conformanceEngine', () => ({
  computeTraceabilityMatrix: vi.fn(() => ({
    rows: [],
    gaps: {
      mandatoryNotInTemplate: 0,
      mandatoryNotIngestible: 0,
      mandatoryUnmapped: 0,
      mandatoryLowPopulation: 0,
      drsWithNoRules: 0,
      drsWithNoControls: 0,
      drsCovered: 40,
      totalDRs: 50,
      mandatoryDRs: 25,
      populationThreshold: 80,
    },
    specVersion: 'test',
  })),
}));

vi.mock('@/lib/coverage/mofCoverageEngine', () => ({
  computeMoFCoverage: vi.fn(() => ({
    mandatoryCoveragePct: 90,
    coveredMandatory: 9,
    mandatoryFields: 10,
  })),
}));

vi.mock('@/components/dashboard/ComplianceRadar', () => ({
  default: () => <div>Radar Stub</div>,
}));

vi.mock('@/components/dashboard/EntityRiskMatrixHeatmap', () => ({
  default: ({
    onCellClick,
  }: {
    onCellClick: (focus: {
      entityId: string;
      entityName: string;
      dimension: 'tax_logic_integrity';
      drillDownMode: 'precise';
    }) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onCellClick({
          entityId: 'TRN-001',
          entityName: 'Seller A',
          dimension: 'tax_logic_integrity',
          drillDownMode: 'precise',
        })
      }
    >
      Heatmap Stub
    </button>
  ),
}));

vi.mock('@/components/StatsCard', () => ({
  StatsCard: ({
    title,
    value,
  }: {
    title: string;
    value: string | number;
  }) => (
    <div>
      <p>{title}</p>
      <p>{value}</p>
    </div>
  ),
}));

vi.mock('recharts', () => {
  const Stub = () => <div />;
  return {
    ResponsiveContainer: Stub,
    LineChart: Stub,
    Line: Stub,
    XAxis: Stub,
    YAxis: Stub,
    CartesianGrid: Stub,
    Tooltip: Stub,
    BarChart: Stub,
    Bar: Stub,
  };
});

vi.mock('@/context/ComplianceContext', () => ({
  useCompliance: () => ({
    activeDatasetType: 'AR',
    direction: 'AR',
    exceptions: [],
    headers: [],
    checkResults: [],
  }),
}));

describe('ControlsDashboardPage entity risk matrix drill-down', () => {
  it('routes heatmap clicks into Exceptions with seller and dimension context', async () => {
    render(<ControlsDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Heatmap Stub')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Heatmap Stub'));

    expect(mockNavigate).toHaveBeenCalledWith(
      '/exceptions?dataset=AR&seller=TRN-001&dimension=tax_logic_integrity&context=entity-risk-matrix&precision=precise'
    );
  });
});
