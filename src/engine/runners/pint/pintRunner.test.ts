import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchEnabledPintAEChecks, seedUC1CheckPack } from '@/lib/api/pintAEApi';
import { runAllPintAEChecks } from '@/lib/checks/pintAECheckRunner';
import { defaultPintRunner } from '@/engine/runners/pint';
import { DataContext } from '@/types/compliance';

vi.mock('@/lib/api/pintAEApi', () => ({
  fetchEnabledPintAEChecks: vi.fn(),
  seedUC1CheckPack: vi.fn(),
}));

vi.mock('@/lib/checks/pintAECheckRunner', () => ({
  runAllPintAEChecks: vi.fn(),
}));

describe('defaultPintRunner', () => {
  const dataContext: DataContext = {
    buyers: [],
    headers: [],
    lines: [],
    buyerMap: new Map(),
    headerMap: new Map(),
    linesByInvoice: new Map(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('proxies check-pack seeding without behavior changes', async () => {
    vi.mocked(seedUC1CheckPack).mockResolvedValue({ success: true, message: 'ok' });

    const result = await defaultPintRunner.seedCheckPack(false);

    expect(seedUC1CheckPack).toHaveBeenCalledTimes(1);
    expect(seedUC1CheckPack).toHaveBeenCalledWith(false);
    expect(result).toEqual({ success: true, message: 'ok' });
  });

  it('fetches enabled checks then runs legacy PINT execution unchanged', async () => {
    const checks = [
      {
        check_id: 'UAE-UC1-CHK-001',
        check_name: 'Invoice Number Present',
        scope: 'Header' as const,
        rule_type: 'Presence' as const,
        severity: 'Critical' as const,
        pint_reference_terms: ['IBT-001'],
        owner_team_default: 'Client Finance' as const,
        is_enabled: true,
        parameters: { field: 'invoice_number' },
      },
    ];
    const exceptions = [
      {
        id: 'pint-1',
        timestamp: '2026-03-11T01:00:00.000Z',
        check_id: 'UAE-UC1-CHK-001',
        check_name: 'Invoice Number Present',
        severity: 'Critical' as const,
        pint_reference_terms: ['IBT-001'],
        message: 'Missing invoice number',
        root_cause_category: 'Unclassified' as const,
        owner_team: 'Client Finance' as const,
        sla_target_hours: 4,
        case_status: 'Open' as const,
      },
    ];

    vi.mocked(fetchEnabledPintAEChecks).mockResolvedValue(checks);
    vi.mocked(runAllPintAEChecks).mockReturnValue(exceptions);

    const output = await defaultPintRunner.run({ dataContext });

    expect(fetchEnabledPintAEChecks).toHaveBeenCalledTimes(1);
    expect(runAllPintAEChecks).toHaveBeenCalledTimes(1);
    expect(runAllPintAEChecks).toHaveBeenCalledWith(checks, dataContext);
    expect(output).toEqual({ checks, exceptions });

    const fetchOrder = vi.mocked(fetchEnabledPintAEChecks).mock.invocationCallOrder[0];
    const runOrder = vi.mocked(runAllPintAEChecks).mock.invocationCallOrder[0];
    expect(fetchOrder).toBeLessThan(runOrder);
  });
});
