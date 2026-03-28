import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import ControlsDashboardPage from '@/pages/ControlsDashboardPage';

vi.mock('@/lib/api/checksApi', () => ({
  fetchCheckRuns: vi.fn(async () =>
    Array.from({ length: 25 }, (_, index) => ({
      id: `run-${index + 1}`,
      run_date: new Date(Date.UTC(2026, 2, 1 + index)).toISOString(),
      dataset_type: 'AR',
      total_invoices: 10,
      total_exceptions: index % 3,
      critical_count: index % 2,
      high_count: 0,
      medium_count: 0,
      low_count: 0,
      pass_rate: 95,
      results_summary: {},
    })),
  ),
  fetchLatestEntityScores: vi.fn(async () => []),
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

vi.mock('@/components/StatsCard', () => ({
  StatsCard: ({
    title,
    value,
    subtitle,
  }: {
    title: string;
    value: string | number;
    subtitle?: string;
  }) => (
    <div>
      <p>{title}</p>
      <p>{value}</p>
      {subtitle ? <p>{subtitle}</p> : null}
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

function expectStatsCard(title: string, value: string, subtitle: string) {
  const titleNode = screen.getByText(title);
  let card = titleNode.parentElement as HTMLElement | null;
  while (card && !within(card).queryByText(value)) {
    card = card.parentElement as HTMLElement | null;
  }
  expect(card).toBeTruthy();
  expect(within(card as HTMLElement).getByText(value)).toBeInTheDocument();
  expect(within(card as HTMLElement).getByText(subtitle)).toBeInTheDocument();
}

describe('ControlsDashboardPage all-time run history', () => {
  it('uses the full run history for the default all-time view', async () => {
    render(
      <MemoryRouter>
        <ControlsDashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Controls Dashboard')).toBeInTheDocument();
      expectStatsCard('Runs Executed', '25', 'All recorded runs');
      expect(screen.getByText('Control Studio Panel')).toBeInTheDocument();
      expect(screen.getByText('Readiness Status Score')).toBeInTheDocument();
      expect(screen.getByText('Trend Indicator')).toBeInTheDocument();
      expect(screen.getByText('Critical Blockers')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.queryByText('SLA Breach Rate')).not.toBeInTheDocument();
      expect(screen.queryByText('Average Resolution Time')).not.toBeInTheDocument();
      expect(screen.queryByText('Client Health Signal')).not.toBeInTheDocument();
    });
  });
});
