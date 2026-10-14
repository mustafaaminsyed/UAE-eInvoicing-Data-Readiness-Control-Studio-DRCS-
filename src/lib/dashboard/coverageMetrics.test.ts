import { describe, expect, it } from 'vitest';
import { getMoFCrosswalkRows } from '@/lib/registry/mofCrosswalkRegistry';
import type { FieldMapping, MappingTemplate } from '@/types/fieldMapping';
import type { ValidationExecutionEvidence } from '@/types/validationExecution';
import { computeDashboardCoverageMetrics } from './coverageMetrics';

function makeMapping(
  source: string,
  target: string,
  options: { confirmed?: boolean; transformed?: boolean } = {}
): FieldMapping {
  return {
    id: `${source}-${target}`,
    erpColumn: source,
    erpColumnIndex: 0,
    targetField: { id: target, name: target, description: '', ibtReference: '', category: 'header', isMandatory: true, dataType: 'string' },
    confidence: options.confirmed === false ? 65 : 100,
    isConfirmed: options.confirmed !== false,
    transformations: options.transformed ? [{ type: 'trim', config: {} }] : [],
    sampleValues: [],
  };
}

function makeTemplate(mappings: FieldMapping[]): MappingTemplate {
  return {
    templateName: 'Smoke mapping',
    description: '',
    documentType: 'UC1 Standard Tax Invoice',
    version: 1,
    isActive: true,
    mappings,
  };
}

function makeExecution(overrides: Partial<ValidationExecutionEvidence> = {}): ValidationExecutionEvidence {
  return {
    ruleId: 'RULE-1',
    ruleName: 'Rule 1',
    controlClass: 'regulatory',
    layer: 'pint_ae',
    direction: 'AR',
    registered: true,
    candidateCount: 1,
    applicableCount: 1,
    notApplicableCount: 0,
    evaluatedCount: 1,
    passedCount: 1,
    failedCount: 0,
    notEvaluatedCount: 0,
    applicability: 'applicable',
    evaluation: 'evaluated',
    outcome: 'pass',
    executionSource: 'runtime',
    ...overrides,
  };
}

describe('computeDashboardCoverageMetrics', () => {
  it('classifies distinct mapped source fields as direct, transformed, or uncertain', () => {
    const metrics = computeDashboardCoverageMetrics({
      direction: 'AR',
      mappingTemplate: makeTemplate([
        makeMapping('erp_invoice_no', 'invoice_number'),
        makeMapping('erp_issue_date', 'issue_date', { transformed: true }),
        makeMapping('erp_buyer', 'buyer_name', { confirmed: false }),
        makeMapping('erp_invoice_no', 'invoice_id'),
      ]),
      uploadColumnCount: 8,
      buyers: [],
      headers: [],
      lines: [],
      hasCompletedRun: false,
      validationExecutions: [],
    });

    expect(metrics.mappedSourceFields).toBe(3);
    expect(metrics.totalSourceFields).toBe(8);
    expect(metrics.directMappedSourceFields).toBe(1);
    expect(metrics.transformedMappedSourceFields).toBe(1);
    expect(metrics.uncertainMappedSourceFields).toBe(1);
    expect(metrics.matchedChecks).toBeNull();
    expect(metrics.documentsReviewed).toBeNull();
  });

  it('counts MoF targets only when all crosswalk source inputs are confirmed in the mapping', () => {
    const sourceFields = Array.from(new Set(getMoFCrosswalkRows('tax_invoice').flatMap((row) => row.sourceColumns)));
    const metrics = computeDashboardCoverageMetrics({
      direction: 'AR',
      mappingTemplate: makeTemplate(sourceFields.map((field) => makeMapping(field, field))),
      uploadColumnCount: sourceFields.length,
      buyers: [],
      headers: [],
      lines: [],
      hasCompletedRun: false,
      validationExecutions: [],
    });

    expect(metrics.fullySuppliedTargets).toBeGreaterThan(0);
    expect(metrics.totalTargets).toBe(51);
  });

  it('reports evaluated, gap, undetermined, and reviewed-document counts for the active completed run', () => {
    const metrics = computeDashboardCoverageMetrics({
      direction: 'AR',
      mappingTemplate: null,
      uploadColumnCount: null,
      buyers: [],
      headers: [
        { invoice_id: 'INV-1', invoice_type: '380' } as never,
        { invoice_id: 'CN-1', invoice_type: '381' } as never,
      ],
      lines: [],
      hasCompletedRun: true,
      validationExecutions: [
        makeExecution(),
        makeExecution({ ruleId: 'RULE-2', evaluation: 'not_evaluated', outcome: 'not_evaluated', evaluatedCount: 0, passedCount: 0, notEvaluatedCount: 1 }),
        makeExecution({ ruleId: 'RULE-3', applicability: 'undetermined', evaluation: 'not_evaluated', outcome: 'not_evaluated', applicableCount: 0, evaluatedCount: 0, passedCount: 0, notEvaluatedCount: 1 }),
        makeExecution({ ruleId: 'RULE-4', direction: 'AP' }),
        makeExecution({ ruleId: 'RULE-5', controlClass: 'supplementary_data_readiness' }),
      ],
    });

    expect(metrics.matchedChecks).toBe(1);
    expect(metrics.totalChecks).toBe(3);
    expect(metrics.sourceGaps).toBe(1);
    expect(metrics.ambiguousChecks).toBe(1);
    expect(metrics.documentsReviewed).toBe(2);
    expect(metrics.invoicesReviewed).toBe(1);
    expect(metrics.creditNotesReviewed).toBe(1);
  });
});
