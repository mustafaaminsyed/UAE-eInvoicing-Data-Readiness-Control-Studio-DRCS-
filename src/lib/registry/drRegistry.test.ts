import { describe, it, expect } from 'vitest';
import { getDREntry } from '@/lib/registry/drRegistry';

describe('DR registry ownership classification', () => {
  it('marks IBT-023 and IBT-024 as system-default-allowed (not generic ASP-derived)', () => {
    const profile = getDREntry('IBT-023');
    const spec = getDREntry('IBT-024');

    expect(profile).toBeDefined();
    expect(spec).toBeDefined();
    expect(profile?.system_default_allowed).toBe(true);
    expect(spec?.system_default_allowed).toBe(true);
    expect(profile?.asp_derived).toBe(false);
    expect(spec?.asp_derived).toBe(false);
  });

  it('keeps true ASP-derived technical fields as asp_derived', () => {
    const sellerScheme = getDREntry('IBT-031-1');
    expect(sellerScheme).toBeDefined();
    expect(sellerScheme?.asp_derived).toBe(true);
    expect(sellerScheme?.system_default_allowed).toBe(false);
  });
});

