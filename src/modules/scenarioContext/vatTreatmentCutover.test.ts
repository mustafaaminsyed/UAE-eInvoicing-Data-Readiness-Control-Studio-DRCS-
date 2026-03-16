import { describe, expect, it } from 'vitest';

import {
  buildVatTreatmentCutoverPacket,
  buildVatTreatmentRuntimeComparisonReport,
  VAT_TREATMENT_APPLICABILITY_FLAG,
  VAT_TREATMENT_APPLICABILITY_LEGACY_MODE,
  VAT_TREATMENT_APPLICABILITY_SCENARIO_MODE,
  VAT_TREATMENT_CUTOVER_RULE_IDS,
} from '@/modules/scenarioContext/vatTreatmentCutover';

describe('vat-treatment authoritative cutover packet', () => {
  it('enumerates the exact second-family cutover rules and shows zero unresolved regressions', () => {
    const packet = buildVatTreatmentCutoverPacket();

    expect(packet.ruleProposals.map((rule) => rule.ruleId)).toEqual([...VAT_TREATMENT_CUTOVER_RULE_IDS]);
    expect(packet.summary.corpusSize).toBeGreaterThan(10);
    expect(packet.summary.totalComparisons).toBe(packet.summary.corpusSize * VAT_TREATMENT_CUTOVER_RULE_IDS.length);
    expect(packet.unresolvedPotentialRegressions).toHaveLength(0);
    expect(packet.blockedDependencies).toHaveLength(0);
  });

  it('reports linked DR coverage without blocked ingestion dependencies for the vat-treatment family', () => {
    const packet = buildVatTreatmentCutoverPacket();
    const coverageByRule = new Map(packet.drCoverageImpact.map((item) => [item.ruleId, item.linkedDrCoverage]));

    VAT_TREATMENT_CUTOVER_RULE_IDS.forEach((ruleId) => {
      expect(coverageByRule.get(ruleId)).toEqual([
        expect.objectContaining({
          dr_id: 'IBT-151',
          mapping_type: 'partial',
          coverageMaturity: 'runtime_enforced',
        }),
      ]);
    });
  });

  it('keeps runtime outputs in parity across the broader regression corpus and stays rollback-ready', () => {
    const report = buildVatTreatmentRuntimeComparisonReport();

    expect(report.summary.potentialRegressionCount).toBe(0);
    expect(report.summary.authoritativeOutputDifferenceCount).toBe(0);
    expect(report.rollback).toEqual({
      flag: VAT_TREATMENT_APPLICABILITY_FLAG,
      legacyValue: VAT_TREATMENT_APPLICABILITY_LEGACY_MODE,
      scenarioValue: VAT_TREATMENT_APPLICABILITY_SCENARIO_MODE,
      defaultValue: VAT_TREATMENT_APPLICABILITY_LEGACY_MODE,
    });
  });

  it('documents semantic sensitivity and keeps traceability and exception-analysis behavior unchanged in this pass', () => {
    const packet = buildVatTreatmentCutoverPacket();

    expect(packet.semanticSensitivityNotes.join(' ')).toContain('more semantically sensitive than document-family');
    expect(packet.traceabilityImpactNotes.join(' ')).toContain('No traceability consumer changes');
    expect(packet.exceptionAnalysisImpactNotes.join(' ')).toContain('Exception-analysis behavior remains unchanged');
  });
});
