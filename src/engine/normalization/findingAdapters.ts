import { Finding, ValidationLayer } from '@/engine/contracts';
import { MoFCoverageResult, MoFCoverageRow } from '@/lib/coverage/mofCoverageEngine';
import { Exception, Severity } from '@/types/compliance';
import { PintAEException } from '@/types/pintAE';

const MANDATORY_STATUSES = new Set(['NOT_IN_TEMPLATE', 'NOT_INGESTIBLE', 'NO_BRIDGE']);

function inferLegacyLayer(exception: Exception): ValidationLayer {
  if (exception.checkId.startsWith('UAE-UC1-CHK-')) return 'pint_ae';
  if (exception.checkId.startsWith('org_profile_')) return 'custom';
  return 'core';
}

function buildLegacyReferences(exception: Exception): string[] {
  const refs: string[] = [];
  if (exception.ruleId) refs.push(`RULE:${exception.ruleId}`);
  if (exception.mappingProfileId) refs.push(`MAPPING:${exception.mappingProfileId}`);
  return refs;
}

export function mapLegacyExceptionToFinding(
  exception: Exception,
  options?: {
    runId?: string;
    layer?: ValidationLayer;
    kind?: Finding['kind'];
  }
): Finding {
  return {
    findingId: exception.id,
    runId: options?.runId || exception.validationRunId,
    layer: options?.layer || inferLegacyLayer(exception),
    kind: options?.kind || 'exception',
    checkId: exception.checkId,
    checkName: exception.checkName,
    severity: exception.severity,
    message: exception.message,
    datasetType: exception.datasetType,
    direction: exception.direction,
    invoiceId: exception.invoiceId,
    invoiceNumber: exception.invoiceNumber,
    sellerTrn: exception.sellerTrn,
    buyerId: exception.buyerId,
    lineId: exception.lineId,
    lineNumber: exception.lineNumber,
    field: exception.field,
    expectedValue: exception.expectedValue,
    observedValue: exception.actualValue,
    references: buildLegacyReferences(exception),
    metadata: {
      status: exception.status,
      reasonCode: exception.reasonCode,
      uploadSessionId: exception.uploadSessionId,
      uploadManifestId: exception.uploadManifestId,
      rulesetVersion: exception.rulesetVersion,
    },
  };
}

export function mapLegacyExceptionsToFindings(
  exceptions: Exception[],
  options?: {
    runId?: string;
    layer?: ValidationLayer;
    kind?: Finding['kind'];
  }
): Finding[] {
  return exceptions.map((exception) => mapLegacyExceptionToFinding(exception, options));
}

export function mapPintExceptionToFinding(
  exception: PintAEException,
  options?: {
    runId?: string;
    kind?: Finding['kind'];
  }
): Finding {
  return {
    findingId: exception.id,
    runId: options?.runId || exception.run_id,
    timestamp: exception.timestamp,
    layer: 'pint_ae',
    kind: options?.kind || 'exception',
    checkId: exception.check_id,
    checkName: exception.check_name,
    severity: exception.severity,
    message: exception.message,
    datasetType: exception.dataset_type,
    invoiceId: exception.invoice_id,
    invoiceNumber: exception.invoice_number,
    sellerTrn: exception.seller_trn,
    buyerId: exception.buyer_id,
    lineId: exception.line_id,
    field: exception.field_name,
    expectedValue: exception.expected_value_or_rule,
    observedValue: exception.observed_value,
    references: exception.pint_reference_terms || [],
    metadata: {
      scope: exception.scope,
      ruleType: exception.rule_type,
      useCase: exception.use_case,
      suggestedFix: exception.suggested_fix,
      rootCauseCategory: exception.root_cause_category,
      ownerTeam: exception.owner_team,
      slaTargetHours: exception.sla_target_hours,
      caseStatus: exception.case_status,
      caseId: exception.case_id,
    },
  };
}

export function mapPintExceptionsToFindings(
  exceptions: PintAEException[],
  options?: {
    runId?: string;
    kind?: Finding['kind'];
  }
): Finding[] {
  return exceptions.map((exception) => mapPintExceptionToFinding(exception, options));
}

function mofSeverity(row: MoFCoverageRow): Severity {
  if (MANDATORY_STATUSES.has(row.status) && row.mandatory) return 'Critical';
  if (MANDATORY_STATUSES.has(row.status)) return 'High';
  return 'Low';
}

function mofMessage(row: MoFCoverageRow): string {
  if (row.status === 'NOT_IN_TEMPLATE') {
    return `MoF field ${row.fieldId} "${row.fieldName}" is not mapped in template columns.`;
  }
  if (row.status === 'NOT_INGESTIBLE') {
    return `MoF field ${row.fieldId} "${row.fieldName}" is mapped but not ingestible by parser.`;
  }
  if (row.status === 'NO_BRIDGE') {
    return `MoF field ${row.fieldId} "${row.fieldName}" has no approved source-to-template bridge.`;
  }
  return `MoF field ${row.fieldId} "${row.fieldName}" is covered.`;
}

export function mapMoFReadinessOutputToFindings(
  result: MoFCoverageResult,
  options?: {
    includeCovered?: boolean;
    runId?: string;
    kind?: Finding['kind'];
  }
): Finding[] {
  const includeCovered = options?.includeCovered ?? false;
  const rows = includeCovered
    ? result.rows
    : result.rows.filter((row) => row.status !== 'COVERED');

  return rows.map((row) => {
    const references = [`MOF_FIELD:${row.fieldId}`, `SECTION:${row.sectionId}`];
    if (row.columns.length > 0) {
      references.push(...row.columns.map((column) => `COLUMN:${column}`));
    }

    return {
      findingId: `mof-${result.documentType}-${row.fieldId}-${row.status.toLowerCase()}`,
      runId: options?.runId,
      layer: 'mof_readiness',
      kind: options?.kind || 'readiness',
      checkId: `MOF-${result.documentType}-FIELD-${row.fieldId}`,
      checkName: 'MoF Mandatory Field Readiness',
      severity: mofSeverity(row),
      message: mofMessage(row),
      field: row.fieldName,
      expectedValue: row.columns.length > 0 ? row.columns.join(', ') : 'bridge required',
      observedValue: row.status,
      references,
      metadata: {
        sourceSchema: result.sourceSchema,
        sourceVersion: result.sourceVersion,
        documentType: result.documentType,
        fieldId: row.fieldId,
        sectionId: row.sectionId,
        mandatory: row.mandatory,
        sourceStatus: row.sourceStatus,
        status: row.status,
        dataset: row.dataset,
        columns: row.columns,
      },
    };
  });
}
