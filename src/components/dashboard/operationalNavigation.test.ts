import { describe, expect, it } from 'vitest';
import {
  getVisibleOperationalNavigation,
  isNavigationRestricted,
  OPERATIONAL_NAVIGATION,
} from '@/components/dashboard/operationalNavigation';

const registeredStaticOperationalRoutes = [
  '/dashboard',
  '/submissions',
  '/data-twin',
  '/validation',
  '/exceptions',
  '/evidence',
  '/analytics',
  '/settings',
  '/upload',
  '/run',
  '/check-builder',
  '/check-registry',
  '/upload-audit',
  '/ap-explorer',
  '/controls',
  '/cases',
  '/rejections',
  '/mapping',
  '/evidence-pack',
  '/traceability',
].sort();

describe('operational navigation registry', () => {
  it('preserves every registered static operational route', () => {
    expect(OPERATIONAL_NAVIGATION.map((item) => item.path).sort()).toEqual(registeredStaticOperationalRoutes);
  });

  it('keeps Cases feature-gated without hiding Rejections or AP Explorer', () => {
    const disabledPaths = getVisibleOperationalNavigation(false).map((item) => item.path);
    const enabledPaths = getVisibleOperationalNavigation(true).map((item) => item.path);

    expect(disabledPaths).not.toContain('/cases');
    expect(enabledPaths).toContain('/cases');
    expect(disabledPaths).toEqual(expect.arrayContaining(['/rejections', '/ap-explorer']));
  });

  it('preserves data and completed-run navigation restrictions', () => {
    expect(isNavigationRestricted('/run', false, false)).toBe(true);
    expect(isNavigationRestricted('/run', true, false)).toBe(false);
    expect(isNavigationRestricted('/dashboard', true, false)).toBe(true);
    expect(isNavigationRestricted('/exceptions', true, false)).toBe(true);
    expect(isNavigationRestricted('/dashboard', true, true)).toBe(false);
    expect(isNavigationRestricted('/exceptions', true, true)).toBe(false);
    expect(isNavigationRestricted('/traceability', false, false)).toBe(false);
  });
});
