import JSZip from 'jszip';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { EvidencePackData } from './evidenceDataBuilder';
import {
  generateEvidencePackZip,
  generateEvidencePackZipByEntity,
  validateBeforeExport,
} from './evidenceExporter';

function buildEvidencePackData(): EvidencePackData {
  return {
    overview: {
      assessmentRunId: 'run-1',
      executionTimestamp: '2026-03-29T00:00:00.000Z',
      scope: 'B2B UC1',
      specVersion: 'PINT-AE 2025-Q2',
      drVersion: 'UAE DR v1.0.1',
      datasetName: 'Test Dataset',
      sourceMode: 'current_in_memory_run',
      entityScopeStatus: 'single_entity',
      legalEntityCount: 1,
      legalEntityLabels: ['Dariba Test LLC'],
      counts: {
        totalInvoices: 1,
        totalBuyers: 1,
        totalLines: 1,
        totalDRs: 1,
        mandatoryDRs: 1,
        coveredDRs: 1,
        drsNoRules: 0,
        drsNoControls: 0,
        openExceptions: 0,
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
        execution_source: 'runtime',
      },
    ],
    exceptions: [],
    controlsCoverage: [
      {
        control_id: 'CTRL-001',
        control_name: 'Invoice header completeness',
        control_type: 'automated',
        covered_rule_ids: 'UAE-UC1-CHK-001',
        covered_dr_ids: 'IBT-001',
        linked_exception_count: 0,
      },
    ],
    populationQuality: [
      {
        dr_id: 'IBT-001',
        business_term: 'Invoice number',
        mandatory: true,
        population_percentage: 100,
        threshold: 99,
        pass_fail: 'Pass',
      },
    ],
    traceabilityRows: [
      {
        dr_id: 'IBT-001',
        business_term: 'Invoice number',
        mandatory: true,
        vatLawStatus: 'Legacy',
        isNewPintField: false,
        dataset_file: 'headers',
        internal_columns: ['invoice_number'],
        inTemplate: true,
        ingestible: true,
        populationPct: 100,
        ruleIds: ['UAE-UC1-CHK-001'],
        ruleNames: ['Invoice Number Present'],
        indirectRuleIds: [],
        indirectRuleNames: [],
        controlIds: ['CTRL-001'],
        controlNames: ['Invoice header completeness'],
        coverageStatus: 'COVERED',
        lastRunPassRate: 100,
        category: 'Invoice details',
        dataResponsibility: 'Client',
        systemDefaultAllowed: false,
        exceptionCount: 0,
      },
    ],
  };
}

describe('generateEvidencePackZip', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('includes a dedicated traceability workbook in the exported zip', async () => {
    const fileSpy = vi.spyOn(JSZip.prototype, 'file');
    vi.spyOn(JSZip.prototype, 'generateAsync').mockResolvedValue(new Blob());

    await generateEvidencePackZip(buildEvidencePackData());

    expect(
      fileSpy.mock.calls.some(
        ([filename, payload]) =>
          filename === '07_traceability_matrix.xlsx' &&
          (payload instanceof Uint8Array || payload instanceof ArrayBuffer)
      )
    ).toBe(true);
  });

  it('includes source-mode and entity-scope metadata in the manifest workbook', async () => {
    const fileSpy = vi.spyOn(JSZip.prototype, 'file');
    vi.spyOn(JSZip.prototype, 'generateAsync').mockResolvedValue(new Blob());

    await generateEvidencePackZip(buildEvidencePackData());

    expect(
      fileSpy.mock.calls.some(([filename]) => filename === '01_scope_summary.xlsx')
    ).toBe(true);
  });
});

describe('generateEvidencePackZipByEntity', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a manifest and entity-scoped workbooks for per-entity exports', async () => {
    const fileSpy = vi.spyOn(JSZip.prototype, 'file');
    vi.spyOn(JSZip.prototype, 'generateAsync').mockResolvedValue(new Blob());

    await generateEvidencePackZipByEntity([
      {
        entityKey: '123456789012345',
        entityLabel: 'Dariba Test LLC',
        evidence: buildEvidencePackData(),
      },
      {
        entityKey: '987654321098765',
        entityLabel: 'Second Entity LLC',
        evidence: {
          ...buildEvidencePackData(),
          overview: {
            ...buildEvidencePackData().overview,
            assessmentRunId: 'run-2',
            datasetName: 'Second Entity LLC',
            legalEntityLabels: ['Second Entity LLC'],
          },
        },
      },
    ]);

    expect(
      fileSpy.mock.calls.some(([filename]) => filename === '00_export_scope_manifest.xlsx')
    ).toBe(true);
    expect(
      fileSpy.mock.calls.some(([filename]) => String(filename).includes('01_dariba_test_llc/01_scope_summary.xlsx'))
    ).toBe(true);
    expect(
      fileSpy.mock.calls.some(([filename]) => String(filename).includes('02_second_entity_llc/07_traceability_matrix.xlsx'))
    ).toBe(true);
  });
});

describe('validateBeforeExport', () => {
  it('treats a consistent evidence pack as exportable', () => {
    const result = validateBeforeExport(buildEvidencePackData());

    expect(result.valid).toBe(true);
    expect(result.report.issues).toEqual([]);
  });

  it('blocks export when overview totals do not match the selected pack rows', () => {
    const inconsistentPack = buildEvidencePackData();
    inconsistentPack.overview.counts.totalDRs = 2;

    const result = validateBeforeExport(inconsistentPack);

    expect(result.valid).toBe(false);
    expect(
      result.report.issues.some(
        (issue) =>
          issue.level === 'error' &&
          issue.message === 'Overview DR totals do not match the exported DR coverage rows.'
      )
    ).toBe(true);
  });
});
