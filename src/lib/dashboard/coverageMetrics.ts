import { getMoFCrosswalkRow } from '@/lib/registry/mofCrosswalkRegistry';
import { getMoFMandatoryFields } from '@/lib/registry/mofSpecRegistry';
import type { Direction } from '@/types/direction';
import type { MappingTemplate } from '@/types/fieldMapping';
import type { Buyer, InvoiceHeader, InvoiceLine } from '@/types/compliance';
import type { ValidationExecutionEvidence } from '@/types/validationExecution';

export interface DashboardCoverageMetricsInput {
  direction: Direction;
  mappingTemplate: MappingTemplate | null;
  uploadColumnCount: number | null;
  buyers: Buyer[];
  headers: InvoiceHeader[];
  lines: InvoiceLine[];
  hasCompletedRun: boolean;
  validationExecutions: ValidationExecutionEvidence[];
}

export interface DashboardCoverageMetrics {
  mappedSourceFields: number | null;
  totalSourceFields: number | null;
  directMappedSourceFields: number;
  transformedMappedSourceFields: number;
  uncertainMappedSourceFields: number;
  fullySuppliedTargets: number | null;
  totalTargets: number;
  matchedChecks: number | null;
  totalChecks: number;
  sourceGaps: number;
  ambiguousChecks: number;
  notApplicableChecks: number;
  documentsReviewed: number | null;
  invoicesReviewed: number;
  creditNotesReviewed: number;
  otherDocumentsReviewed: number;
}

function countMappedSources(template: MappingTemplate | null) {
  if (!template) {
    return {
      mappedSourceFields: null,
      directMappedSourceFields: 0,
      transformedMappedSourceFields: 0,
      uncertainMappedSourceFields: 0,
    };
  }

  const bySource = new Map<string, MappingTemplate['mappings']>();
  for (const mapping of template.mappings) {
    const source = mapping.erpColumn.trim();
    if (!source || !mapping.targetField?.id) continue;
    bySource.set(source, [...(bySource.get(source) ?? []), mapping]);
  }

  let direct = 0;
  let transformed = 0;
  let uncertain = 0;
  for (const mappings of bySource.values()) {
    if (mappings.some((mapping) => !mapping.isConfirmed)) {
      uncertain++;
    } else if (mappings.some((mapping) => mapping.transformations.length > 0)) {
      transformed++;
    } else {
      direct++;
    }
  }

  return {
    mappedSourceFields: bySource.size,
    directMappedSourceFields: direct,
    transformedMappedSourceFields: transformed,
    uncertainMappedSourceFields: uncertain,
  };
}

function countFullySuppliedTargets(template: MappingTemplate | null): { count: number | null; total: number } {
  const mandatoryFields = getMoFMandatoryFields('tax_invoice');
  if (!template) return { count: null, total: mandatoryFields.length };

  const confirmedTargets = new Set(
    template.mappings
      .filter((mapping) => mapping.isConfirmed && mapping.targetField?.id)
      .map((mapping) => mapping.targetField.id)
  );

  const count = mandatoryFields.filter((field) => {
    const crosswalk = getMoFCrosswalkRow('tax_invoice', field.field_id);
    return Boolean(
      crosswalk &&
      crosswalk.status !== 'missing' &&
      crosswalk.sourceColumns.length > 0 &&
      crosswalk.sourceColumns.every((sourceColumn) => confirmedTargets.has(sourceColumn))
    );
  }).length;

  return { count, total: mandatoryFields.length };
}

export function computeDashboardCoverageMetrics(
  input: DashboardCoverageMetricsInput
): DashboardCoverageMetrics {
  const sourceMetrics = countMappedSources(input.mappingTemplate);
  const targetMetrics = countFullySuppliedTargets(input.mappingTemplate);
  const executions = input.hasCompletedRun
    ? input.validationExecutions.filter(
        (execution) => execution.controlClass === 'regulatory' && execution.direction === input.direction
      )
    : [];
  const matchedExecutions = executions.filter((execution) => execution.evaluation === 'evaluated').length;
  const ambiguousChecks = executions.filter((execution) => execution.applicability === 'undetermined').length;
  const notApplicableChecks = executions.filter((execution) => execution.outcome === 'not_applicable').length;
  const sourceGaps = executions.filter(
    (execution) => execution.evaluation === 'not_evaluated' && execution.applicability !== 'undetermined'
  ).length;
  const isCreditNote = (header: InvoiceHeader) => String(header.invoice_type ?? '').trim() === '381';
  const creditNotesReviewed = input.hasCompletedRun ? input.headers.filter(isCreditNote).length : 0;
  const otherDocumentsReviewed = input.hasCompletedRun
    ? input.headers.filter((header) => !['380', '381'].includes(String(header.invoice_type ?? '').trim())).length
    : 0;
  const invoicesReviewed = input.hasCompletedRun
    ? input.headers.length - creditNotesReviewed - otherDocumentsReviewed
    : 0;

  return {
    ...sourceMetrics,
    totalSourceFields: input.uploadColumnCount,
    fullySuppliedTargets: targetMetrics.count,
    totalTargets: targetMetrics.total,
    matchedChecks: input.hasCompletedRun ? matchedExecutions : null,
    totalChecks: executions.length,
    sourceGaps,
    ambiguousChecks,
    notApplicableChecks,
    documentsReviewed: input.hasCompletedRun ? input.headers.length : null,
    invoicesReviewed,
    creditNotesReviewed,
    otherDocumentsReviewed,
  };
}
