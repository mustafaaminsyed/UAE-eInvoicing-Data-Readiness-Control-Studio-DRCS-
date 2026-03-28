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
});
