import { beforeEach, describe, expect, it, vi } from 'vitest';

const fromMock = vi.fn();
const envState = {
  configured: true,
  issues: [] as string[],
  localFallbackEnabled: false,
  shouldUseFallback: false,
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: fromMock,
  },
}));

vi.mock('@/lib/api/supabaseEnv', () => ({
  getSupabaseEnvStatus: () => ({ configured: envState.configured, issues: envState.issues }),
  isLocalDevFallbackEnabled: () => envState.localFallbackEnabled,
  shouldUseLocalDevFallback: () => envState.shouldUseFallback,
}));

describe('pintAEApi legacy schema compatibility', () => {
  beforeEach(() => {
    fromMock.mockReset();
    envState.configured = true;
    envState.issues = [];
    envState.localFallbackEnabled = false;
    envState.shouldUseFallback = false;
  });

  it('seeds legacy rule_type values that satisfy the current Supabase constraint', async () => {
    let insertedRows: any[] = [];

    fromMock.mockImplementation(() => ({
      select: () => ({
        ilike: async () => ({ data: [], error: null }),
      }),
      insert: async (rows: any[]) => {
        insertedRows = rows;
        return { error: null };
      },
    }));

    const { seedUC1CheckPack } = await import('@/lib/api/pintAEApi');
    const result = await seedUC1CheckPack(false);

    expect(result.success).toBe(true);
    expect(insertedRows[0]).toMatchObject({
      check_id: 'UAE-UC1-CHK-001',
      rule_type: 'Presence',
    });
  });

  it('normalizes legacy rule_type rows back to the runtime taxonomy on read', async () => {
    fromMock.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          order: async () => ({
            data: [
              {
                id: 'row-1',
                check_id: 'UAE-UC1-CHK-001',
                check_name: 'Invoice Number Present',
                description: 'Legacy row',
                scope: 'Header',
                rule_type: 'Presence',
                severity: 'Critical',
                use_case: 'UC1',
                pint_reference_terms: ['IBT-001'],
                mof_rule_reference: 'BR-01',
                pass_condition: 'ok',
                fail_condition: 'bad',
                owner_team_default: 'Client Finance',
                suggested_fix: 'fix',
                evidence_required: 'evidence',
                is_enabled: true,
                parameters: { field: 'invoice_number' },
                created_at: '2026-03-28T00:00:00.000Z',
                updated_at: '2026-03-28T00:00:00.000Z',
              },
            ],
            error: null,
          }),
        }),
      }),
    }));

  const { fetchEnabledPintAEChecks } = await import('@/lib/api/pintAEApi');
  const [check] = await fetchEnabledPintAEChecks();

  expect(check.rule_type).toBe('structural_rule');
  expect(check.execution_layer).toBe('schema');
  });

  it('falls back to built-in checks and diagnostics when local fallback is enabled and Supabase fetches fail', async () => {
    envState.localFallbackEnabled = true;

    fromMock.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          order: async () => {
            throw new TypeError('Failed to fetch');
          },
        }),
        order: async () => {
          throw new TypeError('Failed to fetch');
        },
        then: (resolve: (value: { data: null; error: { message: string } }) => void) =>
          resolve({ data: null, error: { message: 'Failed to fetch' } }),
      }),
    }));

    const { fetchEnabledPintAEChecks, getChecksDiagnostics } = await import('@/lib/api/pintAEApi');
    const checks = await fetchEnabledPintAEChecks();
    const diagnostics = await getChecksDiagnostics();

    expect(checks.length).toBeGreaterThan(0);
    expect(diagnostics).toMatchObject({
      dataSource: 'hardcoded',
      fetchError: undefined,
      totalChecks: expect.any(Number),
      enabledChecks: expect.any(Number),
    });
  });

  it('refuses to persist an exception whose direction is not explicit', async () => {
    const insert = vi.fn();
    fromMock.mockReturnValue({ insert });
    const { saveExceptions } = await import('@/lib/api/pintAEApi');
    const result = await saveExceptions('run-1', [{
      id: 'exception-1', timestamp: '2026-10-01T00:00:00.000Z', check_id: 'UAE-UC1-CHK-001',
      check_name: 'Invoice Number Present', severity: 'Critical', pint_reference_terms: ['IBT-001'],
      message: 'missing', root_cause_category: 'Unclassified', owner_team: 'Client Finance',
      sla_target_hours: 4, case_status: 'Open',
    }]);
    expect(result).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });

  it('persists AP direction without defaulting it to AR', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockReturnValue({ insert });
    const { saveExceptions } = await import('@/lib/api/pintAEApi');
    const result = await saveExceptions('run-1', [{
      id: 'exception-1', timestamp: '2026-10-01T00:00:00.000Z', check_id: 'AP-CHECK',
      check_name: 'AP Check', severity: 'High', pint_reference_terms: [], message: 'failure',
      root_cause_category: 'Unclassified', owner_team: 'Client Finance', sla_target_hours: 24,
      case_status: 'Open', dataset_type: 'AP',
    }]);
    expect(result).toBe(true);
    expect(insert).toHaveBeenCalledWith([expect.objectContaining({ dataset_type: 'AP' })]);
  });

  it('reports persistence as unavailable without calling Supabase in local fallback mode', async () => {
    envState.configured = false;
    envState.localFallbackEnabled = true;
    envState.shouldUseFallback = true;

    const { saveExceptions, saveClientRiskScores, saveRunSummary } = await import('@/lib/api/pintAEApi');
    const exceptionResult = await saveExceptions('local-run-1', [{
      id: 'exception-1', timestamp: '2026-10-01T00:00:00.000Z', check_id: 'UAE-UC1-CHK-001',
      check_name: 'Invoice Number Present', severity: 'Critical', pint_reference_terms: ['IBT-001'],
      message: 'missing', root_cause_category: 'Unclassified', owner_team: 'Client Finance',
      sla_target_hours: 4, case_status: 'Open', dataset_type: 'AR',
    }]);
    const scoreResult = await saveClientRiskScores('local-run-1', [{
      seller_trn: '100000000000003', client_name: 'Seller LLC', risk_score: 25, health_score: 75,
      critical_count: 1, high_count: 0, medium_count: 0, low_count: 0, total_exceptions: 1,
      total_invoices: 1,
    }]);
    const summaryResult = await saveRunSummary({
      run_id: 'local-run-1', total_invoices_tested: 1, total_exceptions: 1, pass_rate_percent: 0,
      exceptions_by_severity: { Critical: 1, High: 0, Medium: 0, Low: 0 },
      top_10_failing_checks: [], top_10_clients_by_risk: [],
    });

    expect(exceptionResult).toBe(false);
    expect(scoreResult).toBe(false);
    expect(summaryResult).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('preserves Supabase persistence when configuration is valid', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    fromMock.mockReturnValue({ insert });

    const { saveExceptions, saveClientRiskScores, saveRunSummary } = await import('@/lib/api/pintAEApi');
    const exceptionResult = await saveExceptions('run-1', [{
      id: 'exception-1', timestamp: '2026-10-01T00:00:00.000Z', check_id: 'UAE-UC1-CHK-001',
      check_name: 'Invoice Number Present', severity: 'Critical', pint_reference_terms: ['IBT-001'],
      message: 'missing', root_cause_category: 'Unclassified', owner_team: 'Client Finance',
      sla_target_hours: 4, case_status: 'Open', dataset_type: 'AR',
    }]);
    const scoreResult = await saveClientRiskScores('run-1', [{
      seller_trn: '100000000000003', client_name: 'Seller LLC', risk_score: 25, health_score: 75,
      critical_count: 1, high_count: 0, medium_count: 0, low_count: 0, total_exceptions: 1,
      total_invoices: 1,
    }]);
    const summaryResult = await saveRunSummary({
      run_id: 'run-1', total_invoices_tested: 1, total_exceptions: 1, pass_rate_percent: 0,
      exceptions_by_severity: { Critical: 1, High: 0, Medium: 0, Low: 0 },
      top_10_failing_checks: [], top_10_clients_by_risk: [],
    });

    expect(exceptionResult).toBe(true);
    expect(scoreResult).toBe(true);
    expect(summaryResult).toBe(true);
    expect(fromMock).toHaveBeenCalledWith('check_exceptions');
    expect(fromMock).toHaveBeenCalledWith('client_risk_scores');
    expect(fromMock).toHaveBeenCalledWith('run_summaries');
  });
});
