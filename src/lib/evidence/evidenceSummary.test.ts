import { describe, expect, it } from 'vitest';

import { buildEvidenceSummary } from '@/lib/evidence/evidenceSummary';
import type { EvidencePackData } from '@/lib/evidence/evidenceDataBuilder';

function buildEvidencePackData(overrides?: Partial<EvidencePackData>): EvidencePackData {
  return {
    overview: {
      assessmentRunId: 'RUN-1',
      executionTimestamp: '2026-03-14T00:00:00.000Z',
      scope: 'B2B UC1',
      specVersion: 'PINT-AE 2025-Q2',
      drVersion: 'UAE DR v1.0.1',
      datasetName: 'Demo',
      counts: {
        totalInvoices: 10,
        totalBuyers: 2,
        totalLines: 20,
        totalDRs: 50,
        mandatoryDRs: 40,
        coveredDRs: 38,
        drsNoRules: 0,
        drsNoControls: 1,
        openExceptions: 3,
      },
    },
    drCoverage: [],
    ruleExecution: [
      {
        rule_id: 'UAE-UC1-CHK-049',
        rule_name: 'Exempt VAT Reason Code Required',
        severity: 'High',
        rule_type: 'dependency_rule',
        execution_layer: 'dependency_rule',
        failure_class: 'dependency_failure',
        linked_dr_ids: 'IBT-151',
        execution_count: 20,
        failure_count: 3,
        execution_source: 'estimated',
      },
    ],
    exceptions: [
      {
        exception_id: 'EXC-1',
        dr_id: 'IBT-151',
        rule_id: 'UAE-UC1-CHK-049',
        rule_type: 'dependency_rule',
        execution_layer: 'dependency_rule',
        failure_class: 'dependency_failure',
        record_reference: 'L-1',
        severity: 'High',
        message: 'Exempt VAT lines must include an exemption reason code or explanatory reason text',
        exception_status: 'Open',
        case_id: '',
        case_status: 'Open',
      },
      {
        exception_id: 'EXC-2',
        dr_id: 'IBT-151',
        rule_id: 'UAE-UC1-CHK-049',
        rule_type: 'dependency_rule',
        execution_layer: 'dependency_rule',
        failure_class: 'dependency_failure',
        record_reference: 'L-2',
        severity: 'Critical',
        message: 'Exempt VAT lines must include an exemption reason code or explanatory reason text',
        exception_status: 'Open',
        case_id: '',
        case_status: 'Open',
      },
    ],
    controlsCoverage: [],
    populationQuality: [],
    traceabilityRows: [],
    ...overrides,
  };
}

describe('buildEvidenceSummary', () => {
  it('surfaces top issues and estimated execution note for active failures', () => {
    const summary = buildEvidenceSummary(buildEvidencePackData());

    expect(summary.overallStatus).toBe('Immediate review');
    expect(summary.topFailureClass).toBe('Dependency failure');
    expect(summary.executionCountNote).toContain('estimated');
    expect(summary.mainIssues).toEqual(
      expect.arrayContaining([
        expect.stringContaining('critical exception'),
        expect.stringContaining('Exempt VAT Reason Code Required'),
        expect.stringContaining('Most common issue type'),
      ])
    );
  });

  it('reports controlled when no exceptions or coverage gaps remain', () => {
    const summary = buildEvidenceSummary(
      buildEvidencePackData({
        overview: {
          assessmentRunId: 'RUN-1',
          executionTimestamp: '2026-03-14T00:00:00.000Z',
          scope: 'B2B UC1',
          specVersion: 'PINT-AE 2025-Q2',
          drVersion: 'UAE DR v1.0.1',
          datasetName: 'Demo',
          counts: {
            totalInvoices: 10,
            totalBuyers: 2,
            totalLines: 20,
            totalDRs: 50,
            mandatoryDRs: 40,
            coveredDRs: 40,
            drsNoRules: 0,
            drsNoControls: 0,
            openExceptions: 0,
          },
        },
        ruleExecution: [],
        exceptions: [],
      })
    );

    expect(summary.overallStatus).toBe('Controlled');
    expect(summary.mainIssues).toEqual(['No exceptions or coverage gaps were detected in this run.']);
  });
});
