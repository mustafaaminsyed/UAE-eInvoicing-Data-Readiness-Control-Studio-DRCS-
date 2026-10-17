import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DashboardPage from '@/pages/DashboardPage';

const mockComplianceState = {
  isChecksRun: true,
  isDataLoaded: true,
  isRunning: false,
  runChecks: vi.fn(),
  runSummary: {
    run_id: 'run-1',
    run_mode: 'diagnostic_mapping',
    readiness_qualification: 'diagnostic_only',
    mapping_coverage_percent: 82,
    total_invoices_tested: 3,
    total_exceptions: 4,
    pass_rate_percent: 66.7,
    exceptions_by_severity: { Critical: 1, High: 3, Medium: 0, Low: 0 },
    top_10_failing_checks: [],
    top_10_clients_by_risk: [],
  },
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
      runChecks: vi.fn(),
      runSummary: {
        run_id: 'run-1',
        run_mode: 'diagnostic_mapping',
        readiness_qualification: 'diagnostic_only',
        mapping_coverage_percent: 82,
        total_invoices_tested: 3,
        total_exceptions: 4,
        pass_rate_percent: 66.7,
        exceptions_by_severity: { Critical: 1, High: 3, Medium: 0, Low: 0 },
        top_10_failing_checks: [],
        top_10_clients_by_risk: [],
      },
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

    expect(screen.getByText('Executive command centre')).toBeInTheDocument();
    expect(screen.getByText('UAE e-Invoicing Readiness')).toBeInTheDocument();
    expect(screen.getAllByText('Diagnostic run').length).toBeGreaterThan(0);
    expect(screen.getByText('DRCS readiness score')).toBeInTheDocument();
    expect(screen.getByText('Mandatory field supply')).toBeInTheDocument();
    expect(screen.getByText('Blocking exposure')).toBeInTheDocument();
    expect(screen.getByText('Regulatory evaluation coverage')).toBeInTheDocument();
    expect(screen.getByText('Source-field mapping')).toBeInTheDocument();
    expect(screen.getByText('MoF targets fully supplied')).toBeInTheDocument();
    expect(screen.getByText('Runtime checks matched')).toBeInTheDocument();
    expect(screen.getByText('Documents reviewed')).toBeInTheDocument();
    expect(screen.getByText('Readiness by control domain')).toBeInTheDocument();
    expect(screen.getByText('Priority findings')).toBeInTheDocument();
    expect(screen.getByText('Assessment snapshot')).toBeInTheDocument();
    expect(screen.getByText('Exceptions by severity')).toBeInTheDocument();
    expect(screen.getByText('Quick actions')).toBeInTheDocument();

    expect(screen.getAllByText('Seller Name Present').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Buyer TRN Pattern Valid').length).toBeGreaterThan(0);
  });

  it('keeps the executive dashboard visible with empty-state placeholders when no data exists', () => {
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

    expect(screen.getByText('Readiness by control domain')).toBeInTheDocument();
    expect(screen.getByText('Priority findings')).toBeInTheDocument();
    expect(screen.getByText('Quick actions')).toBeInTheDocument();
    expect(screen.getByText('Current assessment state is not yet populated.')).toBeInTheDocument();
    expect(screen.getAllByText('Not assessed').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Not evaluated').length).toBeGreaterThan(0);
    expect(screen.queryByText('Start your readiness assessment')).not.toBeInTheDocument();
  });

  it('keeps uploaded but unvalidated data explicitly not evaluated', () => {
    Object.assign(mockComplianceState, {
      isChecksRun: false,
      isDataLoaded: true,
      headers: [{ invoice_id: 'inv-1', direction: 'AR' }],
      buyers: [],
      lines: [],
      checkResults: [],
      exceptions: [],
    });

    render(<MemoryRouter><DashboardPage /></MemoryRouter>);

    expect(screen.getByText('Current assessment state is not yet populated.')).toBeInTheDocument();
    expect(screen.getAllByText('Not evaluated').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /run validation checks/i })).toBeEnabled();
    expect(screen.queryByText('Start your readiness assessment')).not.toBeInTheDocument();
    expect(screen.getByText('Priority findings')).toBeInTheDocument();
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
    expect(screen.getByText('No critical blockers detected in the latest assessment.').closest('section')).toHaveClass('is-clear');
    expect(screen.getByText('No exceptions were recorded in the latest assessment.')).toBeInTheDocument();
    expect(screen.queryByText('Seller name completeness')).not.toBeInTheDocument();
  });
});

