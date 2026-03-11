import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildOrganizationProfileExceptions } from '@/lib/validation/rulesetRouter';
import { defaultOrgProfileRunner } from '@/engine/runners/orgProfile';

vi.mock('@/lib/validation/rulesetRouter', () => ({
  buildOrganizationProfileExceptions: vi.fn(),
}));

describe('defaultOrgProfileRunner', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('passes through to org-profile ruleset execution unchanged', () => {
    const organizationProfile = { ourEntityTRNs: ['123456789012345'] };
    const headers = [
      {
        invoice_id: 'INV-1',
        invoice_number: 'A-1001',
        issue_date: '2026-03-11',
        seller_trn: '123456789012345',
        buyer_id: 'B-1',
        currency: 'AED',
      },
    ];
    const buyerMap = new Map([
      [
        'B-1',
        {
          buyer_id: 'B-1',
          buyer_name: 'Buyer One',
          buyer_trn: '100000000000001',
        },
      ],
    ]);
    const exceptions = [
      {
        id: 'org-1',
        checkId: 'org_profile_our_entity_alignment',
        checkName: 'Our-side TRN Alignment',
        severity: 'Critical' as const,
        message: 'TRN not aligned',
      },
    ];

    vi.mocked(buildOrganizationProfileExceptions).mockReturnValue(exceptions);

    const result = defaultOrgProfileRunner.run({
      organizationProfile,
      direction: 'AR',
      headers,
      buyerMap,
      uploadSessionId: 'upload-1',
      uploadManifestId: 'manifest-1',
      mappingProfileId: 'map-1',
      rulesetVersion: 'v1.0.0',
    });

    expect(buildOrganizationProfileExceptions).toHaveBeenCalledTimes(1);
    expect(buildOrganizationProfileExceptions).toHaveBeenCalledWith(organizationProfile, {
      direction: 'AR',
      headers,
      buyerMap,
      uploadSessionId: 'upload-1',
      uploadManifestId: 'manifest-1',
      mappingProfileId: 'map-1',
      rulesetVersion: 'v1.0.0',
    });
    expect(result).toEqual({ exceptions });
  });
});
