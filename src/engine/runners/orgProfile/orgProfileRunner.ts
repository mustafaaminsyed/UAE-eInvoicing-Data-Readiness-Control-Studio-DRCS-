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
    const exceptions = buildOrganizationProfileExceptions(organizationProfile, {
      direction,
      headers,
      buyerMap,
      uploadSessionId,
      uploadManifestId,
      mappingProfileId,
      rulesetVersion,
    });
    return {
      exceptions,
      telemetry: [
        {
          rule_id: 'org_profile_our_entity_alignment',
          execution_count: headers.length,
          failure_count: exceptions.length,
          execution_source: 'runtime',
        },
      ],
    };
  },
};
