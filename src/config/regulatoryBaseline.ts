import baseline from '../../specs/uae/regulatory-baseline-1.0.4.json';
import { SEMANTIC_CROSSWALK_VERSION } from '@/lib/registry/semanticCrosswalk';
import { RULESET_VERSION } from '@/lib/validation/rulesetRouter';
import type { RegulatoryBaselineIdentity } from '@/types/evidence';

export const UAE_REGULATORY_BASELINE = {
  ...baseline,
  drcsRuleset: { ...baseline.drcsRuleset, version: RULESET_VERSION },
  crosswalk: { ...baseline.crosswalk, version: SEMANTIC_CROSSWALK_VERSION },
} as const;

export const REGULATORY_BASELINE_LABEL =
  `${baseline.pintAEBilling.name} ${baseline.pintAEBilling.version}`;

export const DRCS_RULESET_LABEL =
  `${UAE_REGULATORY_BASELINE.drcsRuleset.name} ${UAE_REGULATORY_BASELINE.drcsRuleset.version}`;

export type UaeRegulatoryBaseline = typeof UAE_REGULATORY_BASELINE;

export function getCurrentRegulatoryBaselineIdentity(): RegulatoryBaselineIdentity {
  return {
    baselineId: UAE_REGULATORY_BASELINE.baselineId,
    pintAEBillingVersion: UAE_REGULATORY_BASELINE.pintAEBilling.version,
    pintAESelfBillingVersion: UAE_REGULATORY_BASELINE.pintAESelfBilling.version,
    uaeTddVersion: UAE_REGULATORY_BASELINE.uaeTDD.version,
    pintGeneralVersion: UAE_REGULATORY_BASELINE.pintGeneral.version,
    pdkVersion: UAE_REGULATORY_BASELINE.pintAEBilling.pdkVersion,
    drcsRulesetVersion: UAE_REGULATORY_BASELINE.drcsRuleset.version,
    crosswalkVersion: UAE_REGULATORY_BASELINE.crosswalk.version,
    billingResourceHash: UAE_REGULATORY_BASELINE.pintAEBilling.artifactHash,
    selfBillingResourceHash: UAE_REGULATORY_BASELINE.pintAESelfBilling.artifactHash,
    tddResourceHash: UAE_REGULATORY_BASELINE.uaeTDD.artifactHash,
    executableParityStatus: 'outstanding',
  };
}
