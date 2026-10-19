import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import RunChecksPage from '@/pages/RunChecksPage';
import { UAE_UC1_CHECK_PACK } from '@/lib/checks/uaeUC1CheckPack';

const navigate = vi.fn();
const setActiveMappingProfileForDirection = vi.fn();

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

let runChecksDeferred = deferred<void>();
const runChecks = vi.fn(() => runChecksDeferred.promise);

const complianceState = {
  direction: 'AR' as 'AR' | 'AP',
  buyers: [{ buyer_id: 'B-1', buyer_name: 'Acme LLC' }],
  headers: [
    {
      invoice_id: 'INV-1',
      invoice_number: 'INV-1',
      issue_date: '2026-03-14',
      seller_trn: '100000000000003',
      currency: 'AED',
    },
  ],
  lines: [{ line_id: 'LINE-1', invoice_id: 'INV-1', line_number: 1 }],
  isDataLoaded: true,
  isChecksRun: false,
  isRunning: false,
  runChecks,
  exceptions: [],
  lastChecksRunAt: null as string | null,
  lastChecksRunDatasetType: null,
  activeMappingProfileByDirection: { AR: null, AP: null },
  setActiveMappingProfileForDirection,
};

const enabledChecks = [
  {
    check_id: 'UAE-UC1-CHK-004',
    check_name: 'Invoice type presence',
    description: 'Checks invoice type field presence.',
    scope: 'Header',
    rule_type: 'structural_rule',
    execution_layer: 'schema',
    severity: 'High',
    pint_reference_terms: ['IBT-003'],
    owner_team_default: 'ASP Ops',
    is_enabled: true,
    parameters: { field: 'invoice_type' },
    applicability: { directions: ['AR', 'AP'] },
  },
];

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

vi.mock('@/context/ComplianceContext', () => ({
  useCompliance: () => complianceState,
}));

vi.mock('@/lib/api/pintAEApi', () => ({
  fetchEnabledPintAEChecks: vi.fn(async () => enabledChecks),
  getChecksDiagnostics: vi.fn(async () => ({
    totalChecks: UAE_UC1_CHECK_PACK.length,
    enabledChecks: 1,
    uc1ChecksPresent: true,
    uc1CheckCount: UAE_UC1_CHECK_PACK.length,
    dataSource: 'hardcoded',
    configured: false,
    configurationIssues: ['fallback'],
  })),
  seedUC1CheckPack: vi.fn(async () => ({ success: true, message: 'seeded' })),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/lib/api/mappingApi', () => ({
  fetchActiveTemplates: vi.fn(async () => []),
}));

vi.mock('@/lib/pintAE/specCatalog', () => ({
  getPintAeSpecMetadata: () => ({ schematronRules: 556, codelists: 22 }),
}));

vi.mock('@/lib/coverage/conformanceEngine', () => ({
  checkRunReadiness: () => ({ canRun: true, reasons: [] }),
}));

vi.mock('@/lib/api/supabaseEnv', () => ({
  getSupabaseEnvStatus: () => ({ configured: false, issues: ['missing env'] }),
  isLocalDevFallbackEnabled: () => true,
  shouldUseLocalDevFallback: () => true,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('@/components/run/LastRunContextBanner', () => ({
  LastRunContextBanner: () => <div data-testid="last-run-banner" />,
}));

vi.mock('@/config/features', () => ({
  FEATURE_FLAGS: {
    mofMandatoryPreGateEnabled: false,
    mofMandatoryPreGateDocumentType: 'tax_invoice',
    mofMandatoryPreGateThreshold: 100,
    mofMandatoryPreGateStrictNoBridge: false,
  },
}));

vi.mock('@/engine/runners/mof', () => ({
  defaultMoFReadinessRunner: {
    evaluate: () => ({ enabled: false, passed: true, reasons: [] }),
  },
}));

describe('RunChecksPage processing feedback', () => {
  beforeEach(() => {
    navigate.mockReset();
    setActiveMappingProfileForDirection.mockReset();
    runChecks.mockClear();
    runChecksDeferred = deferred<void>();
    complianceState.isChecksRun = false;
    complianceState.lastChecksRunAt = null;
    complianceState.direction = 'AR';
  });

  it('shows elapsed validation feedback while checks are running', async () => {
    render(
      <MemoryRouter>
        <RunChecksPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Validation Control Centre' })).toBeInTheDocument();
    expect(screen.getByText('Ready to validate')).toBeInTheDocument();
    expect(screen.getByText('Registered')).toBeInTheDocument();
    expect(screen.getByText('Applicable')).toBeInTheDocument();
    expect(screen.getByText('Executable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand included controls' })).toHaveAttribute('aria-expanded', 'false');

    const runButton = screen.getByRole('button', { name: /Run Validation Checks \(1\)/i });
    fireEvent.click(runButton);

    await waitFor(() => {
      expect(runChecks).toHaveBeenCalledTimes(1);
    }, { timeout: 3000 });

    expect(runButton).toBeDisabled();
    fireEvent.click(runButton);
    expect(runChecks).toHaveBeenCalledTimes(1);

    const statusBanner = screen.getByRole('status');
    expect(screen.getByText('Validation run in progress')).toBeInTheDocument();
    expect(screen.getByText(/Processing 1 invoices across 1 active checks\./)).toBeInTheDocument();
    expect(statusBanner).toHaveTextContent('Elapsed time:');

    runChecksDeferred.resolve();

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/dashboard');
    }, { timeout: 3000 });
  });

  it('shows completed actions without changing the results route', async () => {
    complianceState.isChecksRun = true;
    complianceState.lastChecksRunAt = '2026-10-19T00:00:00.000Z';

    render(
      <MemoryRouter>
        <RunChecksPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Validation completed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Re-run Checks' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View Results' }));
    expect(navigate).toHaveBeenCalledWith('/dashboard');
  });

  it('preserves AP direction and its applicable execution count', async () => {
    complianceState.direction = 'AP';

    render(
      <MemoryRouter>
        <RunChecksPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Direction: AP')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run Validation Checks (1)' })).toBeEnabled();
  });

  it('restores the execution action after a failed run', async () => {
    runChecks.mockImplementationOnce(async () => { throw new Error('run failed'); });

    render(
      <MemoryRouter>
        <RunChecksPage />
      </MemoryRouter>
    );

    const runButton = await screen.findByRole('button', { name: /Run Validation Checks \(1\)/i });
    fireEvent.click(runButton);

    await waitFor(() => expect(runButton).toBeEnabled());
    expect(navigate).not.toHaveBeenCalledWith('/dashboard');
  });
});
