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

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/context/ComplianceContext', () => ({
  useCompliance: () => mockComplianceState,
}));

describe('DashboardPage executive surface', () => {
  beforeEach(() => {
    resetMockComplianceState();
  });

  it('renders the redesigned KPI sections and exception breakdown from compliance signals', () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Executive compliance view')).toBeInTheDocument();
    expect(screen.getByText('Source-data quality and integrity')).toBeInTheDocument();
    expect(screen.getByText('Coverage against UAE and PINT-AE obligations')).toBeInTheDocument();
    expect(screen.getByText('Exception breakdown and remediation focus')).toBeInTheDocument();

    expect(screen.getByText('Go-Live Readiness')).toBeInTheDocument();
    expect(screen.getByText('Portfolio Scope')).toBeInTheDocument();
    expect(screen.getByText('Mandatory data')).toBeInTheDocument();
    expect(screen.getByText('Compliance Readiness')).toBeInTheDocument();
    expect(screen.getByText('Submission-ready invoices')).toBeInTheDocument();
    expect(screen.getByText('Rule pass rate')).toBeInTheDocument();
    expect(screen.getByText('Critical Blocking Issues')).toBeInTheDocument();
    expect(screen.getByText('Mandatory Field Completeness')).toBeInTheDocument();
    expect(screen.getByText('Conditional Field Completeness')).toBeInTheDocument();
    expect(screen.getByText('Currency Mismatches')).toBeInTheDocument();
    expect(screen.getByText('IBT Mandatory Fields')).toBeInTheDocument();
    expect(screen.getByText('Credit-Note Scenarios')).toBeInTheDocument();
    expect(screen.getByText('Top blocking issues')).toBeInTheDocument();
    expect(screen.getByText('Operational interpretation')).toBeInTheDocument();
    expect(screen.getByText('Fix 3 checks failing on every invoice')).toBeInTheDocument();
    expect(screen.getByText(/Why is the severity distribution skewed\? ↓/i)).toBeInTheDocument();

    expect(screen.getAllByText('Seller Name Present').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Buyer TRN Pattern Valid').length).toBeGreaterThan(0);
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

    expect(screen.getByText('No validated invoice portfolio is in scope yet')).toBeInTheDocument();
    expect(screen.getByText('Data quality KPIs appear after dataset intake')).toBeInTheDocument();
    expect(screen.getByText('UAE coverage widgets are waiting for validated documents')).toBeInTheDocument();
  });

  it('does not fall back to preview exception clusters when live signals exist but no exceptions are present', () => {
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

    expect(screen.getByText('No open exception clusters are currently surfaced for this live portfolio view.')).toBeInTheDocument();
    expect(screen.queryByText('Seller name completeness')).not.toBeInTheDocument();
  });
});
