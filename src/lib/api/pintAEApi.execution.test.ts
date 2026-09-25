import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchEnabledPintAEChecks } from './pintAEApi';
const mocks = vi.hoisted(() => ({ order: vi.fn(), configured: true, fallback: false }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ order: mocks.order }) }) }) } }));
vi.mock('./supabaseEnv', () => ({ getSupabaseEnvStatus: () => ({ configured: mocks.configured, issues: [] }), shouldUseLocalDevFallback: () => mocks.fallback }));

describe('execution ruleset loading', () => {
  beforeEach(() => { mocks.configured = true; mocks.fallback = false; mocks.order.mockReset(); });
  it('rejects a database error', async () => {
    mocks.order.mockResolvedValue({ data: null, error: { message: 'connection failed' } });
    await expect(fetchEnabledPintAEChecks({ forExecution: true })).rejects.toThrow(/connection failed/);
  });
  it('rejects a successful but empty result', async () => {
    mocks.order.mockResolvedValue({ data: [], error: null });
    await expect(fetchEnabledPintAEChecks({ forExecution: true })).rejects.toThrow(/enabled/i);
  });
  it('propagates transport failures to execution callers', async () => {
    mocks.order.mockRejectedValue(new Error('Network unavailable'));
    await expect(fetchEnabledPintAEChecks({ forExecution: true })).rejects.toThrow('Network unavailable');
  });
  it('rejects missing configuration without explicit fallback', async () => {
    mocks.configured = false;
    await expect(fetchEnabledPintAEChecks({ forExecution: true })).rejects.toThrow(/configured/i);
  });
  it('retains explicitly enabled local fallback', async () => {
    mocks.configured = false; mocks.fallback = true;
    expect(await fetchEnabledPintAEChecks({ forExecution: true })).toHaveLength(35);
    expect(mocks.order).not.toHaveBeenCalled();
  });
  it('keeps diagnostic reads compatible', async () => {
    mocks.order.mockResolvedValue({ data: [], error: null });
    expect(await fetchEnabledPintAEChecks()).toEqual([]);
  });
});
