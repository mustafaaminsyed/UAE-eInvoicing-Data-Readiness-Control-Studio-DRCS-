import { computeAllDatasetPopulations } from '@/lib/coverage/populationCoverage';
import { CheckRun } from '@/types/customChecks';
import { Buyer, InvoiceHeader, InvoiceLine } from '@/types/compliance';
import {
  CheckRunResultsSummary,
  EvidenceRuleExecutionTelemetryRow,
  EvidenceRunSnapshot,
} from '@/types/evidence';

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
