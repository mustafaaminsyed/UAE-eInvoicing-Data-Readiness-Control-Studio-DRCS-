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
  buyers: [{ buyer_id: '', buyer_name: 'Acme LLC' }],
  headers: [
    {
      invoice_id: 'INV-1',
      invoice_number: 'INV-1',
      issue_date: '2026-03-14',
      seller_trn: '100000000000003',
      currency: 'AED',
    },
  ],
  lines: [{ line_id: '', invoice_id: 'INV-1', line_number: 1 }],
  isDataLoaded: true,
  isChecksRun: false,
  isRunning: false,
  runChecks,
  exceptions: [],
  lastChecksRunAt: null,
  lastChecksRunDatasetType: null,
  activeMappingProfileByDirection: { AR: { id: 'tpl-1', version: 1 }, AP: null },
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
    dataSource: 'supabase',
    configured: true,
    configurationIssues: [],
  })),
  seedUC1CheckPack: vi.fn(async () => ({ success: true, message: 'seeded' })),
}));

vi.mock('@/lib/api/mappingApi', () => ({
  fetchActiveTemplates: vi.fn(async () => [
    {
      id: 'tpl-1',
      templateName: 'BB Energy Active Mapping',
      documentType: 'UC1 Standard Tax Invoice',
      version: 3,
      isActive: true,
      mappings: [
        {
          id: 'm-1',
          erpColumn: 'customer_code',
          erpColumnIndex: 0,
          targetField: {
            id: 'buyer_id',
            name: 'Buyer ID',
            description: 'Join key',
            ibtReference: 'IBT-044',
            category: 'buyer',
            isMandatory: true,
            dataType: 'string',
          },
          confidence: 1,
          isConfirmed: true,
          transformations: [],
          sampleValues: ['B-1001'],
        },
        {
          id: 'm-2',
          erpColumn: 'erp_line_reference',
          erpColumnIndex: 1,
          targetField: {
            id: 'line_id',
            name: 'Line ID',
            description: 'Line join key',
            ibtReference: 'IBT-126',
            category: 'line',
            isMandatory: true,
            dataType: 'string',
          },
          confidence: 1,
          isConfirmed: true,
          transformations: [],
          sampleValues: ['LN-1'],
        },
      ],
    },
  ]),
}));

vi.mock('@/lib/api/supabaseEnv', () => ({
  getSupabaseEnvStatus: () => ({ configured: true, issues: [] }),
  isLocalDevFallbackEnabled: () => false,
  shouldUseLocalDevFallback: () => false,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(async () => ({ error: null, count: 1 })),
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

describe('RunChecksPage diagnostic mode', () => {
  it('allows a diagnostic run when a mapping profile exists but mandatory coverage is partial', async () => {
    render(
      <MemoryRouter>
        <RunChecksPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Diagnostic run mode is enabled')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText(/Cannot run checks - conformance gate failed/i)).not.toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Run All Checks/i })).toBeEnabled();
  });
});
