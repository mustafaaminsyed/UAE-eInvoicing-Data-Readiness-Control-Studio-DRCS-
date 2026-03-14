import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import DashboardPage from '@/pages/DashboardPage';

vi.mock('@/lib/api/casesApi', () => ({
  getLifecycleMetrics: vi.fn(async () => null),
  getSLAMetrics: vi.fn(async () => null),
}));

vi.mock('@/lib/api/checksApi', () => ({
  fetchCheckRuns: vi.fn(async () => []),
}));

vi.mock('@/lib/uploadAudit', () => ({
  getUploadAuditLogs: vi.fn(() => []),
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

vi.mock('@/components/SeverityBadge', () => ({
  SeverityBadge: ({ severity }: { severity: string }) => <span>{severity}</span>,
}));

vi.mock('@/components/dashboard/PipelineProgress', () => ({
  PipelineProgress: () => <div>Pipeline</div>,
}));

vi.mock('recharts', () => {
  const Stub = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Stub,
    PieChart: Stub,
    Pie: Stub,
    Cell: Stub,
    Tooltip: Stub,
    BarChart: Stub,
    Bar: Stub,
    XAxis: Stub,
    YAxis: Stub,
    CartesianGrid: Stub,
  };
});

vi.mock('@/context/ComplianceContext', () => ({
  useCompliance: () => ({
    isChecksRun: true,
    isDataLoaded: true,
    isRunning: false,
    activeDatasetType: 'AR',
    setActiveDatasetType: vi.fn(),
    getDashboardStats: () => ({
      totalInvoices: 3,
      totalExceptions: 4,
      exceptionsBySeverity: { Critical: 1, High: 3, Medium: 0, Low: 0 },
      topFailingChecks: [],
      passRate: 66.7,
    }),
    checkResults: [
      {
        checkId: 'UAE-UC1-CHK-012',
        checkName: 'Seller Name Present',
        passed: 2,
        failed: 1,
        severity: 'Critical',
      },
    ],
    exceptions: [
      {
        id: 'exc-1',
        checkId: 'UAE-UC1-CHK-012',
        checkName: 'Seller Name Present',
        severity: 'Critical',
        datasetType: 'AR',
        direction: 'AR',
        message: 'Missing seller name',
      },
      {
        id: 'exc-2',
        checkId: 'UAE-UC1-CHK-012',
        checkName: 'Seller Name Present',
        severity: 'Critical',
        datasetType: 'AR',
        direction: 'AR',
        message: 'Missing seller name',
      },
      {
        id: 'exc-3',
        checkId: 'UAE-UC1-CHK-012',
        checkName: 'Seller Name Present',
        severity: 'High',
        datasetType: 'AR',
        direction: 'AR',
        message: 'Missing seller name',
      },
      {
        id: 'exc-4',
        checkId: 'UAE-UC1-CHK-018',
        checkName: 'Buyer TRN Pattern Valid',
        severity: 'High',
        datasetType: 'AR',
        direction: 'AR',
        message: 'Invalid buyer TRN',
      },
    ],
    runSummary: null,
    buyers: [],
    headers: [{ invoice_id: 'inv-1', direction: 'AR' }],
    lines: [],
    direction: 'AR',
  }),
}));

describe('DashboardPage exception preview', () => {
  it('derives preview counts from normalized exception rows', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Validation Results Preview')).toBeInTheDocument();
    expect(screen.getByText('Total Exceptions')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();

    const previewSection = screen.getByText('Validation Results Preview').closest('div.rounded-xl');
    expect(previewSection).toBeTruthy();

    const sellerNameRow = within(previewSection as HTMLElement)
      .getByText('Seller Name Present')
      .closest('div.rounded-lg');
    expect(sellerNameRow).toBeTruthy();
    expect(within(sellerNameRow as HTMLElement).getByText('3')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Buyer TRN Pattern Valid')).toBeInTheDocument();
    });
  });
});
