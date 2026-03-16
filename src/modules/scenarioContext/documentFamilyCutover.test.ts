import { describe, expect, it } from 'vitest';

import {
  buildDocumentFamilyCutoverPacket,
  buildDocumentFamilyRuntimeComparisonReport,
  DOCUMENT_FAMILY_APPLICABILITY_FLAG,
  DOCUMENT_FAMILY_APPLICABILITY_LEGACY_MODE,
  DOCUMENT_FAMILY_APPLICABILITY_SCENARIO_MODE,
  DOCUMENT_FAMILY_CUTOVER_RULE_IDS,
} from '@/modules/scenarioContext/documentFamilyCutover';

describe('document-family authoritative cutover packet', () => {
  it('enumerates the exact first-family cutover rules and shows zero unresolved regressions', () => {
    const packet = buildDocumentFamilyCutoverPacket();

    expect(packet.ruleProposals.map((rule) => rule.ruleId)).toEqual([...DOCUMENT_FAMILY_CUTOVER_RULE_IDS]);
    expect(packet.summary.corpusSize).toBeGreaterThan(10);
    expect(packet.summary.totalComparisons).toBe(packet.summary.corpusSize * DOCUMENT_FAMILY_CUTOVER_RULE_IDS.length);
    expect(packet.unresolvedPotentialRegressions).toHaveLength(0);
    expect(packet.blockedDependencies).toHaveLength(0);
  });

  it('reports linked DR coverage without blocked ingestion dependencies for the cutover family', () => {
    const packet = buildDocumentFamilyCutoverPacket();
    const coverageByRule = new Map(packet.drCoverageImpact.map((item) => [item.ruleId, item.linkedDrCoverage]));

    expect(coverageByRule.get('UAE-UC1-CHK-036')).toEqual([
      expect.objectContaining({
        dr_id: 'IBT-048',
        mapping_type: 'partial',
        coverageMaturity: 'runtime_enforced',
      }),
    ]);
    expect(coverageByRule.get('UAE-UC1-CHK-037')).toEqual([
      expect.objectContaining({
        dr_id: 'BTUAE-15',
        mapping_type: 'reference_only',
        coverageMaturity: 'reference_only',
      }),
    ]);
    expect(coverageByRule.get('UAE-UC1-CHK-045')).toEqual([
      expect.objectContaining({
        dr_id: 'IBT-003',
        mapping_type: 'exact',
        coverageMaturity: 'runtime_enforced',
      }),
    ]);
    expect(coverageByRule.get('UAE-UC1-CHK-046')).toEqual([
      expect.objectContaining({
        dr_id: 'IBT-003',
        mapping_type: 'exact',
        coverageMaturity: 'runtime_enforced',
      }),
    ]);
  });

  it('keeps runtime outputs in parity across the broader regression corpus and stays rollback-ready', () => {
    const report = buildDocumentFamilyRuntimeComparisonReport();

    expect(report.summary.potentialRegressionCount).toBe(0);
    expect(report.summary.authoritativeOutputDifferenceCount).toBe(0);
    expect(report.rollback).toEqual({
      flag: DOCUMENT_FAMILY_APPLICABILITY_FLAG,
      legacyValue: DOCUMENT_FAMILY_APPLICABILITY_LEGACY_MODE,
      scenarioValue: DOCUMENT_FAMILY_APPLICABILITY_SCENARIO_MODE,
      defaultValue: DOCUMENT_FAMILY_APPLICABILITY_LEGACY_MODE,
    });
  });

  it('keeps traceability and exception-analysis behavior unchanged in this pass', () => {
    const packet = buildDocumentFamilyCutoverPacket();

    expect(packet.traceabilityImpactNotes.join(' ')).toContain('No traceability consumer changes');
    expect(packet.exceptionAnalysisImpactNotes.join(' ')).toContain('Exception-analysis behavior remains unchanged');
  });
});
