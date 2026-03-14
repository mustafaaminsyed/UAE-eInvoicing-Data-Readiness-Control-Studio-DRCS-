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
  activeMappingProfileByDirection: { AR: { id: 'tpl-1', version: 1 }, AP: null },
  setActiveMappingProfileForDirection,
};

const enabledChecks = [
  {
    check_id: 'UAE-UC1-CHK-006',
    check_name: 'Currency codelist',
    description: 'Checks currency code membership.',
    scope: 'Header',
    rule_type: 'dynamic_codelist',
    execution_layer: 'codelist',
    severity: 'High',
    pint_reference_terms: ['IBT-005'],
    owner_team_default: 'ASP Ops',
    is_enabled: true,
    parameters: { codelist: 'ISO4217', field: 'currency' },
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
  fetchActiveTemplates: vi.fn(async () => [
    {
      id: 'tpl-1',
      templateName: 'Legacy Alias Template',
      documentType: 'UC1 Standard Tax Invoice',
      version: 1,
      isActive: true,
      mappings: [
        {
          id: 'm-1',
          erpColumn: 'seller_endpoint',
          erpColumnIndex: 0,
          targetField: {
            id: 'seller_endpoint',
            name: 'Seller Electronic Address',
            description: 'Legacy seller endpoint id',
            ibtReference: 'IBT-034',
            category: 'seller',
            isMandatory: true,
            dataType: 'string',
          },
          confidence: 1,
          isConfirmed: true,
          transformations: [],
          sampleValues: ['0088:123456789'],
        },
        {
          id: 'm-2',
          erpColumn: 'seller_street',
          erpColumnIndex: 1,
          targetField: {
            id: 'seller_street',
            name: 'Seller Street',
            description: 'Legacy seller street id',
            ibtReference: 'IBT-035',
            category: 'seller',
            isMandatory: true,
            dataType: 'string',
          },
          confidence: 1,
          isConfirmed: true,
          transformations: [],
          sampleValues: ['Dubai'],
        },
      ],
    },
  ]),
}));

vi.mock('@/lib/pintAE/specCatalog', () => ({
  getPintAeSpecMetadata: () => ({ schematronRules: 556, codelists: 22 }),
}));

vi.mock('@/lib/coverage/conformanceEngine', () => ({
  checkRunReadiness: () => ({ canRun: true, reasons: [] }),
}));

vi.mock('@/lib/api/supabaseEnv', () => ({
  getSupabaseEnvStatus: () => ({ configured: true, issues: [] }),
  shouldUseLocalDevFallback: () => false,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(async () => ({ error: null })),
    })),
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

describe('RunChecksPage mapping coverage alignment', () => {
  it('counts legacy template field ids toward canonical mandatory coverage', async () => {
    render(
      <MemoryRouter>
        <RunChecksPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Mandatory Coverage')).toBeInTheDocument();
      expect(screen.getByText(/2\/\d+ mandatory fields mapped/i)).toBeInTheDocument();
    });
  });
});
