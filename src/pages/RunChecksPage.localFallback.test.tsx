import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import RunChecksPage from '@/pages/RunChecksPage';
import { UAE_UC1_CHECK_PACK } from '@/lib/checks/uaeUC1CheckPack';

const navigate = vi.fn();
const runChecks = vi.fn();
const setActiveMappingProfileForDirection = vi.fn();

const complianceState = {
  direction: 'AR',
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
  lastChecksRunAt: null,
  lastChecksRunDatasetType: null,
  activeMappingProfileByDirection: { AR: null, AP: null },
  setActiveMappingProfileForDirection,
};

const enabledChecks = [
  {
    check_id: 'UAE-UC1-CHK-001',
    check_name: 'Invoice Number Present',
    description: 'Built-in fallback check.',
    scope: 'Header',
    rule_type: 'structural_rule',
    execution_layer: 'schema',
    severity: 'Critical',
    pint_reference_terms: ['IBT-001'],
    owner_team_default: 'Client Finance',
    is_enabled: true,
    parameters: { field: 'invoice_number' },
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
    enabledChecks: enabledChecks.length,
    uc1ChecksPresent: true,
    uc1CheckCount: UAE_UC1_CHECK_PACK.length,
    dataSource: 'hardcoded',
    configured: true,
    configurationIssues: [],
  })),
  seedUC1CheckPack: vi.fn(async () => ({ success: true, message: 'Local fallback mode active - using built-in UC1 check pack' })),
}));

vi.mock('@/lib/api/mappingApi', () => ({
  fetchActiveTemplates: vi.fn(async () => []),
}));

vi.mock('@/lib/api/supabaseEnv', () => ({
  getSupabaseEnvStatus: () => ({ configured: true, issues: [] }),
  isLocalDevFallbackEnabled: () => true,
  shouldUseLocalDevFallback: () => false,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn((table: string) => ({
      select: vi.fn(async () => ({
        error: table === 'mapping_templates' ? { message: 'TypeError: Failed to fetch' } : null,
      })),
    })),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/lib/pintAE/specCatalog', () => ({
  getPintAeSpecMetadata: () => ({ schematronRules: 556, codelists: 22 }),
}));

vi.mock('@/lib/coverage/conformanceEngine', () => ({
  checkRunReadiness: () => ({ canRun: true, reasons: [] }),
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

describe('RunChecksPage local fallback fetch resilience', () => {
  it('does not surface mapping template fetch failures when local fallback is enabled', async () => {
    render(
      <MemoryRouter>
        <RunChecksPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Checks Library (1 checks)')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText(/Mapping templates unavailable:/i)).not.toBeInTheDocument();
    });

    expect(screen.getByText(/No active mapping template found\./i)).toBeInTheDocument();
    expect(screen.getByText('Invoice Number Present')).toBeInTheDocument();
    expect(screen.getByText('Local Fallback')).toBeInTheDocument();
  });
});
