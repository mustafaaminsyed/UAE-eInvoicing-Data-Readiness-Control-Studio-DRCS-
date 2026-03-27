import { afterEach, describe, expect, it, vi } from 'vitest';

import { getSupabaseEnvStatus, shouldUseLocalDevFallback } from '@/lib/api/supabaseEnv';

const defaultUrl = process.env.VITE_SUPABASE_URL || 'https://test-project.supabase.co';
const defaultKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'test-publishable-key';
const defaultFallback = process.env.VITE_ENABLE_LOCAL_DEV_FALLBACK || 'false';

describe('supabaseEnv local fallback detection', () => {
  afterEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', defaultUrl);
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', defaultKey);
    vi.stubEnv('VITE_ENABLE_LOCAL_DEV_FALLBACK', defaultFallback);
  });

  it('treats local review dummy values as placeholders so fallback can activate', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test-project.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'test-publishable-key');
    vi.stubEnv('VITE_ENABLE_LOCAL_DEV_FALLBACK', 'true');

    expect(getSupabaseEnvStatus()).toMatchObject({
      configured: false,
      issues: expect.arrayContaining([
        'VITE_SUPABASE_URL uses placeholder value',
        'VITE_SUPABASE_PUBLISHABLE_KEY uses placeholder value',
      ]),
    });
    expect(shouldUseLocalDevFallback()).toBe(true);
  });
});
