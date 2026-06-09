import { computeAllDatasetPopulations } from '@/lib/coverage/populationCoverage';
import { CheckRun } from '@/types/customChecks';
import { Buyer, InvoiceHeader, InvoiceLine } from '@/types/compliance';
import {
  CheckRunResultsSummary,
  EvidenceRuleExecutionTelemetryRow,
  EvidenceRunSnapshot,
} from '@/types/evidence';

function deriveSnapshotEntityScope(headers: InvoiceHeader[]): Pick<
  EvidenceRunSnapshot,
  'entity_scope_status' | 'legal_entity_count' | 'legal_entity_labels'
> {
  const entityMap = new Map<string, string>();

  for (const header of headers) {
    const entityKey = header.seller_trn || header.seller_legal_reg_id || header.seller_name;
    if (!entityKey) continue;

    const entityLabel =
      header.seller_name ||
      header.seller_trn ||
      header.seller_legal_reg_id ||
      entityKey;

    if (!entityMap.has(entityKey)) {
      entityMap.set(entityKey, entityLabel);
    }
  }

  const legalEntityLabels = Array.from(entityMap.values()).slice(0, 5);
  const legalEntityCount = entityMap.size;

  return {
    entity_scope_status:
      legalEntityCount === 0 ? 'unknown' : legalEntityCount === 1 ? 'single_entity' : 'multi_entity',
    legal_entity_count: legalEntityCount,
    legal_entity_labels: legalEntityLabels,
  };
}

function toRawRows(rows: Record<string, unknown>[]): Record<string, string>[] {
  return rows.map((item) => {
    const row: Record<string, string> = {};
    for (const [key, value] of Object.entries(item)) {
      row[key] = value != null ? String(value) : '';
    }
    return row;
  });
}

export function buildEvidenceRunSnapshot(
  buyers: Buyer[],
  headers: InvoiceHeader[],
  lines: InvoiceLine[],
): EvidenceRunSnapshot {
  return {
    version: 1,
    captured_at: new Date().toISOString(),
    dataset_name: headers[0]?.seller_name ?? headers[0]?.seller_trn ?? 'Unknown',
    ...deriveSnapshotEntityScope(headers),
    counts: {
      totalInvoices: headers.length,
      totalBuyers: buyers.length,
      totalLines: lines.length,
    },
    populations: computeAllDatasetPopulations({
      buyers: toRawRows(buyers as unknown as Record<string, unknown>[]),
      headers: toRawRows(headers as unknown as Record<string, unknown>[]),
      lines: toRawRows(lines as unknown as Record<string, unknown>[]),
    }),
  };
}

function isEvidenceRunSnapshot(value: unknown): value is EvidenceRunSnapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<EvidenceRunSnapshot>;
  return (
    candidate.version === 1 &&
    typeof candidate.dataset_name === 'string' &&
    !!candidate.counts &&
    typeof candidate.counts.totalInvoices === 'number' &&
    typeof candidate.counts.totalBuyers === 'number' &&
    typeof candidate.counts.totalLines === 'number' &&
    (candidate.entity_scope_status === undefined ||
      candidate.entity_scope_status === 'single_entity' ||
      candidate.entity_scope_status === 'multi_entity' ||
      candidate.entity_scope_status === 'unknown') &&
    (candidate.legal_entity_count === undefined || typeof candidate.legal_entity_count === 'number') &&
    (candidate.legal_entity_labels === undefined || Array.isArray(candidate.legal_entity_labels)) &&
    Array.isArray(candidate.populations)
  );
}

export function getEvidenceRunSnapshot(run: CheckRun | null | undefined): EvidenceRunSnapshot | null {
  const resultsSummary = run?.results_summary as CheckRunResultsSummary | undefined;
  const candidate =
    resultsSummary?.evidenceSnapshot ||
    (resultsSummary?.evidence_snapshot as EvidenceRunSnapshot | undefined);
  return isEvidenceRunSnapshot(candidate) ? candidate : null;
}

function isEvidenceRuleExecutionTelemetryRowArray(
  value: unknown
): value is EvidenceRuleExecutionTelemetryRow[] {
  return (
    Array.isArray(value) &&
    value.every(
      (row) =>
        row &&
        typeof row === 'object' &&
        typeof (row as EvidenceRuleExecutionTelemetryRow).rule_id === 'string' &&
        typeof (row as EvidenceRuleExecutionTelemetryRow).execution_count === 'number' &&
        typeof (row as EvidenceRuleExecutionTelemetryRow).failure_count === 'number' &&
        (row as EvidenceRuleExecutionTelemetryRow).execution_source === 'runtime'
    )
  );
}

export function getEvidenceRuleExecutionTelemetry(
  run: CheckRun | null | undefined
): EvidenceRuleExecutionTelemetryRow[] {
  const resultsSummary = run?.results_summary as CheckRunResultsSummary | undefined;
  const candidate =
    resultsSummary?.evidenceRuleExecutionTelemetry ||
    (resultsSummary?.evidence_rule_execution_telemetry as EvidenceRuleExecutionTelemetryRow[] | undefined);
  return isEvidenceRuleExecutionTelemetryRowArray(candidate) ? candidate : [];
}
