import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runAllChecks } from '@/lib/checks/checksRegistry';
import { runAllPintAEChecks } from '@/lib/checks/pintAECheckRunner';
import {
  calculateClientScores,
  fetchEnabledPintAEChecks,
  generateRunSummary,
  saveClientRiskScores,
  saveExceptions,
  saveRunSummary,
} from '@/lib/api/pintAEApi';
import { saveCheckRun, saveEntityScores } from '@/lib/api/checksApi';
import { ParsedData } from '@/types/compliance';
import { PintAEException, RunSummary } from '@/types/pintAE';
import { planRunChecks, runChecksPipeline } from '@/services/runChecksService';

vi.mock('@/lib/checks/checksRegistry', () => ({
  runAllChecks: vi.fn(),
}));

vi.mock('@/lib/checks/pintAECheckRunner', () => ({
  runAllPintAEChecks: vi.fn(),
}));

vi.mock('@/lib/api/pintAEApi', () => ({
  fetchEnabledPintAEChecks: vi.fn(),
  saveExceptions: vi.fn(),
  saveRunSummary: vi.fn(),
  saveClientRiskScores: vi.fn(),
  calculateClientScores: vi.fn(),
  generateRunSummary: vi.fn(),
}));

vi.mock('@/lib/api/checksApi', () => ({
  saveCheckRun: vi.fn(),
  saveEntityScores: vi.fn(),
}));

/*
Example artifacts shape (ok):
{
  kind: 'ok',
  mergedCheckResults: [],
  allExceptions: [],
  allPintAEExceptions: [],
  runSummary: undefined,
  runLog: [{ name: 'fetch_enabled_pint_checks', startedAt: '...', endedAt: '...', durationMs: 0 }]
}

Example artifacts shape (persist_failed):
{
  kind: 'persist_failed',
  persistencePhase: 'saveExceptions',
  persistenceError: Error('...'),
  mergedCheckResults: [],
  allExceptions: [],
  allPintAEExceptions: [],
  runSummary: undefined,
  runLog: [{ name: 'persist_save_check_run', startedAt: '...', endedAt: '...', durationMs: 1 }]
}
*/

describe('runChecksService', () => {
  const mockedRunAllChecks = vi.mocked(runAllChecks);
  const mockedRunAllPintAEChecks = vi.mocked(runAllPintAEChecks);
  const mockedFetchEnabledPintAEChecks = vi.mocked(fetchEnabledPintAEChecks);
  const mockedSaveExceptions = vi.mocked(saveExceptions);
  const mockedSaveRunSummary = vi.mocked(saveRunSummary);
  const mockedSaveClientRiskScores = vi.mocked(saveClientRiskScores);
  const mockedCalculateClientScores = vi.mocked(calculateClientScores);
  const mockedGenerateRunSummary = vi.mocked(generateRunSummary);
  const mockedSaveCheckRun = vi.mocked(saveCheckRun);
  const mockedSaveEntityScores = vi.mocked(saveEntityScores);

  const baseData: ParsedData = {
    buyers: [
      {
        buyer_id: 'B-1',
        buyer_name: 'Buyer One',
      },
    ],
    headers: [
      {
        invoice_id: 'INV-1',
        invoice_number: 'A-1001',
        issue_date: '2026-02-01',
        seller_trn: '123456789012345',
        buyer_id: 'B-1',
        currency: 'AED',
      },
    ],
    lines: [],
  };

  beforeEach(() => {
    vi.resetAllMocks();

    mockedFetchEnabledPintAEChecks.mockResolvedValue([]);
    mockedRunAllChecks.mockReturnValue([]);
    mockedRunAllPintAEChecks.mockReturnValue([]);
    mockedSaveCheckRun.mockResolvedValue(null);
    mockedSaveExceptions.mockResolvedValue(undefined);
    mockedSaveClientRiskScores.mockResolvedValue(undefined);
    mockedSaveRunSummary.mockResolvedValue(undefined);
    mockedSaveEntityScores.mockResolvedValue(undefined);
    mockedCalculateClientScores.mockReturnValue([]);
    mockedGenerateRunSummary.mockReturnValue({
      run_id: 'run-1',
      total_invoices_tested: 0,
      total_exceptions: 0,
      pass_rate_percent: 100,
      exceptions_by_severity: { Critical: 0, High: 0, Medium: 0, Low: 0 },
      top_10_failing_checks: [],
      top_10_clients_by_risk: [],
    } satisfies RunSummary);
  });

  it('planRunChecks returns empty runnable sets and stable order', () => {
    const noneRunnable = planRunChecks({
      options: { scope: 'ALL' },
      activeDatasetType: 'AR',
      hasDatasetLoaded: () => false,
    });

    expect(noneRunnable.scope).toBe('ALL');
    expect(noneRunnable.datasetTypesRan).toEqual([]);

    const allRunnable = planRunChecks({
      options: { scope: 'ALL' },
      activeDatasetType: 'AR',
      hasDatasetLoaded: () => true,
    });

    expect(allRunnable.datasetTypesRan).toEqual(['AR', 'AP']);
  });

  it('returns kind=persist_failed when persistence throws and marks phase', async () => {
    mockedSaveCheckRun.mockResolvedValue('run-1');
    const persistError = new Error('saveExceptions failed');
    mockedSaveExceptions.mockRejectedValue(persistError);

    const artifacts = await runChecksPipeline({
      plan: { scope: 'AR', datasetTypesRan: ['AR'] },
      getDataForDataset: () => baseData,
    });

    expect(artifacts.kind).toBe('persist_failed');
    if (artifacts.kind === 'persist_failed') {
      expect(artifacts.persistenceError).toBe(persistError);
      expect(artifacts.persistencePhase).toBe('saveExceptions');
    }
    expect(artifacts.mergedCheckResults).toEqual([]);
    expect(artifacts.allExceptions).toEqual([]);
    expect(artifacts.allPintAEExceptions).toEqual([]);
    expect(artifacts.runLog?.some((step) => step.name === 'persist_save_check_run')).toBe(true);
  });

  it('maps PintAE exceptions to legacy exception shape identically', async () => {
    const pintException: PintAEException = {
      id: 'pex-1',
      timestamp: '2026-03-05T00:00:00.000Z',
      check_id: 'UAE-UC1-CHK-001',
      check_name: 'Invoice Number Present',
      severity: 'Critical',
      scope: 'Header',
      rule_type: 'structural_rule',
      execution_layer: 'schema',
      use_case: 'UC1 Standard Tax Invoice',
      pint_reference_terms: ['IBT-001'],
      invoice_id: 'INV-1',
      invoice_number: 'A-1001',
      seller_trn: '123456789012345',
      buyer_id: 'B-1',
      field_name: 'invoice_number',
      observed_value: '(empty)',
      expected_value_or_rule: 'Required value',
      message: 'Invoice A-1001 missing invoice number',
      root_cause_category: 'Unclassified',
      owner_team: 'Client Finance',
      sla_target_hours: 4,
      case_status: 'Open',
    };

    mockedRunAllPintAEChecks.mockReturnValue([pintException]);

    const artifacts = await runChecksPipeline({
      plan: { scope: 'AR', datasetTypesRan: ['AR'] },
      getDataForDataset: () => baseData,
    });

    expect(artifacts.kind).toBe('ok');
    expect(artifacts.allPintAEExceptions).toHaveLength(1);
    expect(artifacts.allPintAEExceptions[0].dataset_type).toBe('AR');

    expect(artifacts.allExceptions).toHaveLength(1);
    expect(artifacts.allExceptions[0]).toMatchObject({
      id: 'pex-1',
      checkId: 'UAE-UC1-CHK-001',
      checkName: 'Invoice Number Present',
      severity: 'Critical',
      message: 'Invoice A-1001 missing invoice number',
      datasetType: 'AR',
      invoiceId: 'INV-1',
      invoiceNumber: 'A-1001',
      sellerTrn: '123456789012345',
      buyerId: 'B-1',
      field: 'invoice_number',
      expectedValue: 'Required value',
      actualValue: '(empty)',
    });
  });
});
