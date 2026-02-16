// =============================================================================
// Regulatory Export — Part J: DR_Traceability_Report as CSV download
// =============================================================================

import { TraceabilityRow } from '@/lib/coverage/conformanceEngine';

export function exportTraceabilityReport(rows: TraceabilityRow[]): void {
  const headers = [
    'dr_id',
    'business_term',
    'mandatory',
    'template',
    'column_names',
    'in_template',
    'ingestible',
    'population_pct',
    'rule_ids',
    'control_ids',
    'open_exception_count',
    'coverage_status',
  ];

  const csvRows = rows.map(row => [
    row.dr_id,
    `"${row.business_term.replace(/"/g, '""')}"`,
    row.mandatory ? 'Yes' : 'No',
    row.dataset_file || 'asp_derived',
    `"${row.internal_columns.join('; ')}"`,
    row.inTemplate ? 'Yes' : 'No',
    row.ingestible ? 'Yes' : 'No',
    row.populationPct !== null ? row.populationPct.toFixed(1) : '',
    `"${row.ruleIds.join('; ')}"`,
    `"${row.controlIds.join('; ')}"`,
    String(row.exceptionCount),
    row.coverageStatus,
  ].join(','));

  const csv = [headers.join(','), ...csvRows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `DR_Traceability_Report_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
