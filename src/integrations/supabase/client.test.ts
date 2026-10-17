import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn((url: string, key: string) => {
    if (!url) throw new Error('supabaseUrl is required.');
    if (!key) throw new Error('supabaseKey is required.');
    return { url, key };
  }),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

describe('Supabase client startup configuration', () => {
  beforeEach(() => {
    vi.resetModules();
    createClientMock.mockClear();
  });

  it.each([
    ['', '', 'https://drcs-unconfigured.invalid', 'drcs-unconfigured-publishable-key'],
    ['', 'valid-publishable-key', 'https://drcs-unconfigured.invalid', 'valid-publishable-key'],
    ['https://valid-project.supabase.co', '', 'https://valid-project.supabase.co', 'drcs-unconfigured-publishable-key'],
  ])('does not throw during startup when configuration is incomplete', async (url, key, expectedUrl, expectedKey) => {
    vi.stubEnv('VITE_SUPABASE_URL', url);
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', key);

    await expect(import('./client')).resolves.toBeDefined();
    expect(createClientMock).toHaveBeenCalledWith(
      expectedUrl,
      expectedKey,
      expect.any(Object),
    );
  });

  it('preserves configured Supabase credentials', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://valid-project.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'valid-publishable-key');

    await import('./client');

    expect(createClientMock).toHaveBeenCalledWith(
      'https://valid-project.supabase.co',
      'valid-publishable-key',
      expect.any(Object),
    );
  });
});
