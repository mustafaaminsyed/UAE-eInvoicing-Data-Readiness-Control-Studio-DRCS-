import { OrgProfileRunner } from '@/engine/contracts';
import { buildOrganizationProfileExceptions } from '@/lib/validation/rulesetRouter';

export const defaultOrgProfileRunner: OrgProfileRunner = {
  run({
    organizationProfile,
    direction,
    headers,
    buyerMap,
    uploadSessionId,
    uploadManifestId,
    mappingProfileId,
    rulesetVersion,
  }) {
    return {
      exceptions: buildOrganizationProfileExceptions(organizationProfile, {
        direction,
        headers,
        buyerMap,
        uploadSessionId,
        uploadManifestId,
        mappingProfileId,
        rulesetVersion,
      }),
    };
  },
};
