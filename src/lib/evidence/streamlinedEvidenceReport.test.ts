import { describe, expect, it } from 'vitest';

import type { EvidencePackData } from './evidenceDataBuilder';
import { buildStreamlinedEvidenceReport } from './streamlinedEvidenceReport';

function buildEvidencePackData(): EvidencePackData {
  return {
    overview: {
      assessmentRunId: 'run-1',
      executionTimestamp: '2026-03-29T00:00:00.000Z',
      scope: 'B2B UC1',
      specVersion: 'PINT-AE 2025-Q2',
      drVersion: 'UAE DR v1.0.1',
      datasetName: 'Test Dataset',
      sourceMode: 'persisted_snapshot',
      entityScopeStatus: 'single_entity',
      legalEntityCount: 1,
      legalEntityLabels: ['Dariba Test LLC'],
      counts: {
        totalInvoices: 1,
        totalBuyers: 1,
        totalLines: 1,
        totalDRs: 2,
        mandatoryDRs: 2,
        coveredDRs: 1,
        drsNoRules: 1,
        drsNoControls: 0,
        openExceptions: 1,
      },
    },
    drCoverage: [
      {
        dr_id: 'IBT-001',
        business_term: 'Invoice number',
        mandatory: true,
        template: 'headers',
        column_names: 'invoice_number',
        rule_count: 1,
        control_count: 1,
        population_percentage: 100,
        coverage_status: 'COVERED',
        asp_derived: false,
        system_default_allowed: false,
      },
      {
        dr_id: 'IBT-047',
        business_term: 'Buyer TRN',
        mandatory: true,
        template: 'buyers',
        column_names: 'buyer_trn',
        rule_count: 0,
        control_count: 0,
        population_percentage: 40,
        coverage_status: 'NO_RULE',
        asp_derived: false,
        system_default_allowed: false,
      },
    ],
    ruleExecution: [
      {
        rule_id: 'UAE-UC1-CHK-001',
        rule_name: 'Invoice Number Present',
        severity: 'Critical',
        rule_type: 'structural_rule',
        execution_layer: 'schema',
        failure_class: 'structural_failure',
        linked_dr_ids: 'IBT-001',
        execution_count: 1,
        failure_count: 0,
        execution_source: 'estimated',
      },
    ],
    exceptions: [
      {
        exception_id: 'exc-1',
        dr_id: 'IBT-047',
        rule_id: 'UAE-UC1-CHK-018',
        check_name: 'Buyer TRN format',
        rule_type: 'structural_rule',
        execution_layer: 'schema',
        failure_class: 'structural_failure',
        record_reference: 'INV-001',
        severity: 'High',
        message: 'Buyer TRN missing on the invoice.',
        suggested_fix: 'Enrich the buyer master data and rerun validation.',
        root_cause_category: 'Missing Master Data',
        owner_team: 'Client Finance',
        exception_status: 'Open',
        case_id: 'CASE-1',
        case_status: 'Open',
      },
    ],
    controlsCoverage: [],
    populationQuality: [
      {
        dr_id: 'IBT-001',
        business_term: 'Invoice number',
        mandatory: true,
        population_percentage: 100,
        threshold: 99,
        pass_fail: 'Pass',
      },
      {
        dr_id: 'IBT-047',
        business_term: 'Buyer TRN',
        mandatory: true,
        population_percentage: 40,
        threshold: 99,
        pass_fail: 'Fail',
      },
    ],
    traceabilityRows: [],
  };
}

describe('buildStreamlinedEvidenceReport', () => {
  it('builds an exception-led report model with decision and domain summaries', () => {
    const report = buildStreamlinedEvidenceReport(buildEvidencePackData());

    expect(report.verdict).toBe('Not Ready');
    expect(report.evidenceConfidence).toBe('Low');
    expect(report.recommendedDecision).toBe('Do not proceed');
    expect(report.blockers[0]).toMatchObject({
      title: 'Buyer TRN format',
      owner: 'Client Finance',
      status: 'Open',
    });
    expect(report.domainReadiness.map((domain) => domain.domain)).toContain('Data readiness');
    expect(report.topMetrics.some((metric) => metric.label === 'Critical blockers')).toBe(true);
  });
});
