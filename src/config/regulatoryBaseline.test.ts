import { describe, expect, it } from 'vitest';

import {
  getCurrentRegulatoryBaselineIdentity,
  UAE_REGULATORY_BASELINE,
} from '@/config/regulatoryBaseline';
import { RULESET_VERSION } from '@/lib/validation/rulesetRouter';
import { SEMANTIC_CROSSWALK_VERSION } from '@/lib/registry/semanticCrosswalk';
import {
  PINT_AE_BILLING_SCHEMATRON_RULES,
} from '@/lib/pintAE/generated/schematronRules';
import { PINT_AE_SELF_BILLING_SCHEMATRON_RULES } from '@/lib/pintAE/generated/selfBillingSchematronRules';
import { UAE_TDD_SCHEMATRON_RULES } from '@/lib/pintAE/generated/tddSchematronRules';
import { PINT_AE_CODELISTS } from '@/lib/pintAE/generated/codelists';
import { PINT_AE_SPEC_METADATA } from '@/lib/pintAE/generated/metadata';
import { buildEvidencePackData } from '@/lib/evidence/evidenceDataBuilder';
import { isCodeInCodelist } from '@/lib/pintAE/specCatalog';

describe('UAE regulatory baseline foundation', () => {
  it('resolves each external and internal version independently', () => {
    expect(UAE_REGULATORY_BASELINE.pintAEBilling.version).toBe('1.0.4');
    expect(UAE_REGULATORY_BASELINE.pintAESelfBilling.version).toBe('1.0.4');
    expect(UAE_REGULATORY_BASELINE.uaeTDD.version).toBe('1.0.4');
    expect(UAE_REGULATORY_BASELINE.pintGeneral.version).toBe('1.1.3');
    expect(UAE_REGULATORY_BASELINE.pintAEBilling.pdkVersion).toBe('1.4.4');
    expect(UAE_REGULATORY_BASELINE.drcsRuleset.version).toBe(RULESET_VERSION);
    expect(UAE_REGULATORY_BASELINE.crosswalk.version).toBe(SEMANTIC_CROSSWALK_VERSION);
    expect(RULESET_VERSION).not.toBe(UAE_REGULATORY_BASELINE.pintAEBilling.version);
  });

  it('keeps Billing, Self-Billing, and TDD resources distinguishable and traceable', () => {
    expect(PINT_AE_BILLING_SCHEMATRON_RULES.length).toBeGreaterThan(0);
    expect(PINT_AE_SELF_BILLING_SCHEMATRON_RULES.length).toBeGreaterThan(0);
    expect(UAE_TDD_SCHEMATRON_RULES.length).toBeGreaterThan(0);
    expect(new Set(PINT_AE_BILLING_SCHEMATRON_RULES.map((rule) => rule.profile))).toEqual(new Set(['billing']));
    expect(new Set(PINT_AE_SELF_BILLING_SCHEMATRON_RULES.map((rule) => rule.profile))).toEqual(new Set(['self-billing']));
    expect(new Set(UAE_TDD_SCHEMATRON_RULES.map((rule) => rule.profile))).toEqual(new Set(['tdd']));
    expect(PINT_AE_SPEC_METADATA.resourceSets.billing.artifactHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(PINT_AE_SPEC_METADATA.resourceSets.selfBilling.artifactHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(PINT_AE_SPEC_METADATA.resourceSets.tdd.artifactHash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('contains IBR-SR-63 and excludes obsolete IBR-164-AE from current Billing resources', () => {
    const ids = new Set(PINT_AE_BILLING_SCHEMATRON_RULES.map((rule) => rule.id.toUpperCase()));
    expect(ids.has('IBR-SR-63')).toBe(true);
    expect(ids.has('IBR-164-AE')).toBe(false);
    const transactionTypeRule = PINT_AE_BILLING_SCHEMATRON_RULES.find(
      (rule) => rule.id.toUpperCase() === 'IBR-154-AE',
    );
    const fxRule = PINT_AE_BILLING_SCHEMATRON_RULES.find(
      (rule) => rule.id.toUpperCase() === 'IBR-159-AE',
    );
    expect(transactionTypeRule?.test).toContain('^[01]{8}$');
    expect(fxRule?.test).toContain('cac:TaxExchangeRate/cbc:CalculationRate');
  });

  it('contains the current known code-list deltas', () => {
    expect(PINT_AE_CODELISTS.ISO4217.ids).toContain('CNH');
    expect(PINT_AE_CODELISTS.ISO4217.ids).not.toContain('CUC');
    expect(PINT_AE_CODELISTS.ICD.ids).toEqual(expect.arrayContaining(['0241', '0242', '0243', '0244']));
    expect(PINT_AE_CODELISTS.eas.ids).toContain('0244');
    expect(PINT_AE_CODELISTS.ISO3166.names.BS).toBe('Bahamas (The)');
    expect(PINT_AE_CODELISTS.transactiontype.ids.every((code) => code.length === 8)).toBe(true);
    expect(isCodeInCodelist('ISO4217', 'CNH')).toBe(true);
    expect(isCodeInCodelist('ISO4217', 'CUC')).toBe(false);
  });

  it('records non-conflated version identity for new evidence', () => {
    const identity = getCurrentRegulatoryBaselineIdentity();
    expect(identity.pintAEBillingVersion).toBe('1.0.4');
    expect(identity.drcsRulesetVersion).toBe(RULESET_VERSION);
    expect(identity.crosswalkVersion).toBe(SEMANTIC_CROSSWALK_VERSION);
    expect(identity.executableParityStatus).toBe('outstanding');
  });

  it('does not silently relabel historical evidence without normalized version identity', () => {
    const evidence = buildEvidencePackData('legacy-run', '2025-06-01T00:00:00Z', [], [], [], [], [], {
      sourceMode: 'persisted_snapshot',
    });
    expect(evidence.overview.regulatoryBaseline).toBeUndefined();
    expect(evidence.overview.specVersion).toContain('Legacy run');
    expect(evidence.overview.drVersion).toContain('Legacy run');
  });
});
