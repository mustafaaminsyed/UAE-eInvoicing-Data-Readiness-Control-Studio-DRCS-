import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DashboardPage from '@/pages/DashboardPage';

const mockComplianceState = {
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
  buyers: [],
  headers: [{ invoice_id: 'inv-1', direction: 'AR' }],
  lines: [],
};

const resetMockComplianceState = () => {
  Object.assign(mockComplianceState, {
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
    buyers: [],
    headers: [{ invoice_id: 'inv-1', direction: 'AR' }],
    lines: [],
  });
};

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

vi.mock('@/components/SeverityBadge', () => ({
  SeverityBadge: ({ severity }: { severity: string }) => <span>{severity}</span>,
}));

vi.mock('@/components/dashboard/PipelineProgress', () => ({
  PipelineProgress: () => <div>Pipeline</div>,
}));

vi.mock('@/context/ComplianceContext', () => ({
  useCompliance: () => mockComplianceState,
}));

describe('DashboardPage executive surface', () => {
  beforeEach(() => {
    resetMockComplianceState();
  });

  it('renders KPI cards, stage progression, and recurring issues from compliance signals', () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Total Invoices')).toBeInTheDocument();
    expect(screen.getByText('Readiness Score')).toBeInTheDocument();
    expect(screen.getAllByText('Passed').length).toBeGreaterThan(0);
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Critical Issues')).toBeInTheDocument();

    expect(screen.getByText('Stage progression')).toBeInTheDocument();
    expect(screen.getByText('Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Control posture by stage')).toBeInTheDocument();
    expect(screen.getByText('Top recurring issues')).toBeInTheDocument();
    expect(screen.getByText('Derived preview signal across the core readiness themes in the current dashboard scope.')).toBeInTheDocument();

    expect(screen.getByText('Seller Name Present')).toBeInTheDocument();
    expect(screen.getByText('Buyer TRN Pattern Valid')).toBeInTheDocument();
  });

  it('keeps KPI cards live-truthful when no live signals exist', () => {
    Object.assign(mockComplianceState, {
      isChecksRun: false,
      isDataLoaded: false,
      getDashboardStats: () => ({
        totalInvoices: 0,
        totalExceptions: 0,
        exceptionsBySeverity: { Critical: 0, High: 0, Medium: 0, Low: 0 },
        topFailingChecks: [],
        passRate: 0,
      }),
      checkResults: [],
      exceptions: [],
      headers: [],
      buyers: [],
      lines: [],
    });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('Awaiting live dataset scope')).toBeInTheDocument();
    expect(screen.getByText('Awaiting live validation signals')).toBeInTheDocument();
  });

  it('does not fall back to preview recurring issues when live signals exist but no exceptions are present', () => {
    Object.assign(mockComplianceState, {
      isChecksRun: true,
      isDataLoaded: true,
      getDashboardStats: () => ({
        totalInvoices: 3,
        totalExceptions: 0,
        exceptionsBySeverity: { Critical: 0, High: 0, Medium: 0, Low: 0 },
        topFailingChecks: [],
        passRate: 100,
      }),
      checkResults: [
        {
          checkId: 'UAE-UC1-CHK-012',
          checkName: 'Seller Name Present',
          passed: 3,
          failed: 0,
          severity: 'Critical',
        },
      ],
      exceptions: [],
      headers: [{ invoice_id: 'inv-1', direction: 'AR' }],
      buyers: [],
      lines: [],
    });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(screen.getByText('No recurring issues are currently surfaced in this live portfolio scope.')).toBeInTheDocument();
    expect(screen.queryByText('Seller name completeness')).not.toBeInTheDocument();
  });
});
