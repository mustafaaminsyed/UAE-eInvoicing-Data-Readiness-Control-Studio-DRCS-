// =============================================================================
// Evidence Pack Exporter — Generates a streamlined report front matter plus detailed XLSX appendices
// Part 4 + Part 7 (consistency validation before export)
// =============================================================================

import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { EvidencePackData } from './evidenceDataBuilder';
import { runConsistencyChecks, ConsistencyReport } from '@/lib/coverage/consistencyValidator';
import { buildEvidenceSummary } from './evidenceSummary';
import { buildStreamlinedEvidenceReport } from './streamlinedEvidenceReport';

export interface ExportValidationResult {
  valid: boolean;
  report: ConsistencyReport;
}

export interface EntityEvidencePackExport {
  entityKey: string;
  entityLabel: string;
  evidence: EvidencePackData;
}

/** Part 7: Validate consistency before export */
function buildPackSpecificConsistencyReport(data: EvidencePackData): ConsistencyReport {
  const issues: ConsistencyReport['issues'] = [];
  let passed = 0;

  if (!data.overview.assessmentRunId || !data.overview.executionTimestamp) {
    issues.push({
      level: 'error',
      category: 'Evidence Pack Integrity',
      message: 'Evidence pack is missing required run provenance metadata.',
      affected_ids: [data.overview.assessmentRunId || 'missing-run-id'],
    });
  } else {
    passed++;
  }

  if (data.overview.counts.totalDRs !== data.drCoverage.length) {
    issues.push({
      level: 'error',
      category: 'Evidence Pack Integrity',
      message: 'Overview DR totals do not match the exported DR coverage rows.',
      affected_ids: ['overview.totalDRs', 'drCoverage'],
    });
  } else {
    passed++;
  }

  if (
    data.overview.counts.mandatoryDRs !==
    data.drCoverage.filter((row) => row.mandatory).length
  ) {
    issues.push({
      level: 'error',
      category: 'Evidence Pack Integrity',
      message: 'Overview mandatory DR totals do not match the exported DR coverage rows.',
      affected_ids: ['overview.mandatoryDRs', 'drCoverage'],
    });
  } else {
    passed++;
  }

  if (
    data.overview.counts.openExceptions !==
    data.exceptions.filter((row) => row.case_status.toLowerCase() === 'open').length
  ) {
    issues.push({
      level: 'error',
      category: 'Evidence Pack Integrity',
      message: 'Overview open exception totals do not match the exported exception records.',
      affected_ids: ['overview.openExceptions', 'exceptions'],
    });
  } else {
    passed++;
  }

  if (data.traceabilityRows.length !== data.drCoverage.length) {
    issues.push({
      level: 'error',
      category: 'Evidence Pack Integrity',
      message: 'Traceability export rows do not align to the DR coverage matrix.',
      affected_ids: ['traceabilityRows', 'drCoverage'],
    });
  } else {
    passed++;
  }

  if (data.ruleExecution.length === 0) {
    issues.push({
      level: 'warning',
      category: 'Evidence Pack Completeness',
      message: 'Evidence pack contains no rule execution rows.',
      affected_ids: ['ruleExecution'],
    });
  } else {
    passed++;
  }

  return {
    issues,
    passed,
    failed: issues.length,
    timestamp: new Date().toISOString(),
  };
}

export function validateBeforeExport(data?: EvidencePackData): ExportValidationResult {
  const report = data ? buildPackSpecificConsistencyReport(data) : runConsistencyChecks();
  const hasErrors = report.issues.some(i => i.level === 'error');
  return { valid: !hasErrors, report };
}

function createWorkbook(data: Record<string, any>[], sheetName: string): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return wb;
}

function workbookToBuffer(wb: XLSX.WorkBook): Uint8Array {
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as Uint8Array;
}

function sanitizeZipSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'entity';
}

function executiveDecisionRows(data: EvidencePackData) {
  const report = buildStreamlinedEvidenceReport(data);

  return [
    { field: 'Readiness Verdict', value: report.verdict },
    { field: 'Evidence Confidence', value: report.evidenceConfidence },
    { field: 'Recommended Decision', value: report.recommendedDecision },
    { field: 'Residual Risk', value: report.residualRisk },
    { field: 'Summary', value: report.summaryText },
    ...report.topMetrics.map((metric) => ({
      field: metric.label,
      value: `${metric.value} | ${metric.helper}`,
    })),
    { field: 'Included Scope', value: report.includedScopeNote },
    { field: 'Excluded Scope', value: report.excludedScopeNote },
  ];
}

function exceptionMitigationRows(data: EvidencePackData) {
  const report = buildStreamlinedEvidenceReport(data);
  return report.blockers.map((blocker) => ({
    Exception: blocker.title,
    Severity: blocker.severity,
    Impact: blocker.impact,
    Mitigation: blocker.mitigation,
    Owner: blocker.owner,
    Status: blocker.status,
    'Residual Risk': blocker.residualRisk,
    'Decision Impact': blocker.decisionImpact,
  }));
}

function domainReadinessRows(data: EvidencePackData) {
  const report = buildStreamlinedEvidenceReport(data);
  return report.domainReadiness
    .filter((domain) => domain.inScope)
    .map((domain) => ({
      Domain: domain.domain,
      Status: domain.status,
      Confidence: domain.confidence,
      'Main Exception': domain.mainException,
      'Mitigation Status': domain.mitigationStatus,
      'Residual Risk': domain.residualRisk,
    }));
}

function appendEvidencePackFiles(zip: JSZip, data: EvidencePackData, prefix = ''): void {
  const summary = buildEvidenceSummary(data);

  zip.file(
    `${prefix}00_executive_decision.xlsx`,
    workbookToBuffer(createWorkbook(executiveDecisionRows(data), 'Executive Decision'))
  );
  const groupedExceptions = exceptionMitigationRows(data);
  zip.file(
    `${prefix}00a_exceptions_and_mitigations.xlsx`,
    workbookToBuffer(
      createWorkbook(
        groupedExceptions.length > 0
          ? groupedExceptions
          : [{ Exception: 'No grouped exception themes', Severity: '', Impact: '', Mitigation: '', Owner: '', Status: '', 'Residual Risk': '', 'Decision Impact': '' }],
        'Exceptions & Mitigations'
      )
    )
  );
  zip.file(
    `${prefix}00b_domain_readiness.xlsx`,
    workbookToBuffer(createWorkbook(domainReadinessRows(data), 'Domain Readiness'))
  );

  // 01_scope_summary.xlsx
  const scopeRows = [
    {
      field: 'Assessment Run ID',
      value: data.overview.assessmentRunId,
    },
    { field: 'Execution Timestamp', value: data.overview.executionTimestamp },
    {
      field: 'Evidence Source Mode',
      value:
        data.overview.sourceMode === 'persisted_snapshot'
          ? 'Persisted snapshot'
          : 'Current in-memory run',
    },
    { field: 'Scope', value: data.overview.scope },
    { field: 'PINT-AE Version', value: data.overview.specVersion },
    { field: 'UAE DR Version', value: data.overview.drVersion },
    { field: 'Dataset / Client', value: data.overview.datasetName },
    {
      field: 'Entity Scope',
      value:
        data.overview.entityScopeStatus === 'single_entity'
          ? 'Single entity'
          : data.overview.entityScopeStatus === 'multi_entity'
            ? 'Multi-entity'
            : 'Unknown',
    },
    { field: 'Legal Entity Count', value: data.overview.legalEntityCount },
    {
      field: 'Legal Entities',
      value: data.overview.legalEntityLabels.length > 0
        ? data.overview.legalEntityLabels.join('; ')
        : 'Unknown',
    },
    { field: 'Total Invoices', value: data.overview.counts.totalInvoices },
    { field: 'Total Buyers', value: data.overview.counts.totalBuyers },
    { field: 'Total Lines', value: data.overview.counts.totalLines },
    { field: 'Total DRs', value: data.overview.counts.totalDRs },
    { field: 'Mandatory DRs', value: data.overview.counts.mandatoryDRs },
    { field: 'Covered DRs', value: data.overview.counts.coveredDRs },
    { field: 'DRs with No Rules', value: data.overview.counts.drsNoRules },
    { field: 'DRs with No Controls', value: data.overview.counts.drsNoControls },
    { field: 'Open Exceptions', value: data.overview.counts.openExceptions },
    { field: 'Overall Status', value: summary.overallStatus },
    { field: 'Top Failure Class', value: summary.topFailureClass },
    { field: 'Execution Count Note', value: summary.executionCountNote },
    ...summary.mainIssues.map((issue, index) => ({
      field: `Main Issue ${index + 1}`,
      value: issue,
    })),
  ];
  zip.file(`${prefix}01_scope_summary.xlsx`, workbookToBuffer(createWorkbook(scopeRows, 'Scope Summary')));

  // 02_dr_coverage.xlsx
  const drRows = data.drCoverage.map(r => ({
    'DR ID': r.dr_id,
    'Business Term': r.business_term,
    'Mandatory': r.mandatory ? 'Yes' : 'No',
    'Template': r.template,
    'Column Names': r.column_names,
    'ASP Derived': r.asp_derived ? 'Yes' : 'No',
    'System Default Allowed': r.system_default_allowed ? 'Yes' : 'No',
    'Rule Count': r.rule_count,
    'Control Count': r.control_count,
    'Population %': r.population_percentage !== null ? Number(r.population_percentage.toFixed(1)) : '',
    'Coverage Status': r.coverage_status,
  }));
  zip.file(`${prefix}02_dr_coverage.xlsx`, workbookToBuffer(createWorkbook(drRows, 'DR Coverage')));

  // 03_rule_execution.xlsx
  const ruleRows = data.ruleExecution.map(r => ({
    'Rule ID': r.rule_id,
    'Rule Name': r.rule_name,
    'Severity': r.severity,
    'Rule Type': r.rule_type,
    'Execution Layer': r.execution_layer,
    'Failure Class': r.failure_class,
    'Linked DR IDs': r.linked_dr_ids,
    'Execution Count': r.execution_count,
    'Failure Count': r.failure_count,
    'Execution Count Source': r.execution_source,
  }));
  zip.file(`${prefix}03_rule_execution.xlsx`, workbookToBuffer(createWorkbook(ruleRows, 'Rule Execution')));

  // 04_exceptions_and_cases.xlsx
  const excRows = data.exceptions.map(e => ({
    'Exception ID': e.exception_id,
    'DR ID': e.dr_id,
    'Rule ID': e.rule_id,
    'Rule Type': e.rule_type,
    'Execution Layer': e.execution_layer,
    'Failure Class': e.failure_class,
    'Record Reference': e.record_reference,
    'Severity': e.severity,
    'Message': e.message,
    'Exception Status': e.exception_status,
    'Case ID': e.case_id,
    'Case Status': e.case_status,
  }));
  zip.file(`${prefix}04_exceptions_and_cases.xlsx`, workbookToBuffer(createWorkbook(
    excRows.length > 0 ? excRows : [{ 'Exception ID': '', 'DR ID': '', 'Rule ID': '', 'Rule Type': '', 'Execution Layer': '', 'Failure Class': '', 'Record Reference': '', 'Severity': '', 'Message': 'No exceptions', 'Exception Status': '', 'Case ID': '', 'Case Status': '' }],
    'Exceptions'
  )));

  // 05_controls_mapping.xlsx
  const ctrlRows = data.controlsCoverage.map(c => ({
    'Control ID': c.control_id,
    'Control Name': c.control_name,
    'Control Type': c.control_type,
    'Covered Rule IDs': c.covered_rule_ids,
    'Covered DR IDs': c.covered_dr_ids,
    'Linked Exceptions': c.linked_exception_count,
  }));
  zip.file(`${prefix}05_controls_mapping.xlsx`, workbookToBuffer(createWorkbook(ctrlRows, 'Controls')));

  // 06_population_quality.xlsx
  const popRows = data.populationQuality.map(p => ({
    'DR ID': p.dr_id,
    'Business Term': p.business_term,
    'Mandatory': p.mandatory ? 'Yes' : 'No',
    'Population %': p.population_percentage !== null ? Number(p.population_percentage.toFixed(1)) : 'N/A',
    'Threshold': p.threshold,
    'Pass/Fail': p.pass_fail,
  }));
  zip.file(`${prefix}06_population_quality.xlsx`, workbookToBuffer(createWorkbook(popRows, 'Population Quality')));

  // 07_traceability_matrix.xlsx
  const traceabilityRows = data.traceabilityRows.map((row) => ({
    'DR ID': row.dr_id,
    'Business Term': row.business_term,
    Mandatory: row.mandatory ? 'Yes' : 'No',
    'VAT Law Status': row.vatLawStatus,
    'New PINT Field': row.isNewPintField ? 'Yes' : 'No',
    Template: row.dataset_file ?? '',
    'Internal Columns': row.internal_columns.join('; '),
    'In Template': row.inTemplate ? 'Yes' : 'No',
    Ingestible: row.ingestible ? 'Yes' : 'No',
    'Population %': row.populationPct !== null ? Number(row.populationPct.toFixed(1)) : '',
    'Direct Rule IDs': row.ruleIds.join('; '),
    'Direct Rule Names': row.ruleNames.join('; '),
    'Indirect Rule IDs': row.indirectRuleIds.join('; '),
    'Indirect Rule Names': row.indirectRuleNames.join('; '),
    'Control IDs': row.controlIds.join('; '),
    'Control Names': row.controlNames.join('; '),
    'Coverage Status': row.coverageStatus,
    'Last Run Pass Rate %': row.lastRunPassRate !== null ? Number(row.lastRunPassRate.toFixed(1)) : '',
    Category: row.category,
    'Data Responsibility': row.dataResponsibility,
    'System Default Allowed': row.systemDefaultAllowed ? 'Yes' : 'No',
    'Exception Count': row.exceptionCount,
  }));
  zip.file(
    `${prefix}07_traceability_matrix.xlsx`,
    workbookToBuffer(createWorkbook(traceabilityRows, 'Traceability Matrix'))
  );
}

export async function generateEvidencePackZip(data: EvidencePackData): Promise<Blob> {
  const zip = new JSZip();
  appendEvidencePackFiles(zip, data);

  return zip.generateAsync({ type: 'blob' });
}

export async function generateEvidencePackZipByEntity(
  packs: EntityEvidencePackExport[]
): Promise<Blob> {
  const zip = new JSZip();

  const manifestRows = packs.map((pack) => ({
    'Entity Key': pack.entityKey,
    'Entity Label': pack.entityLabel,
    'Assessment Run ID': pack.evidence.overview.assessmentRunId,
    'Invoices': pack.evidence.overview.counts.totalInvoices,
    'Buyers': pack.evidence.overview.counts.totalBuyers,
    'Lines': pack.evidence.overview.counts.totalLines,
    'Open Exceptions': pack.evidence.overview.counts.openExceptions,
    'Covered DRs': pack.evidence.overview.counts.coveredDRs,
  }));
  zip.file(
    '00_export_scope_manifest.xlsx',
    workbookToBuffer(createWorkbook(manifestRows, 'Export Scope'))
  );

  packs.forEach((pack, index) => {
    const folderName = `${String(index + 1).padStart(2, '0')}_${sanitizeZipSegment(pack.entityLabel || pack.entityKey)}/`;
    appendEvidencePackFiles(zip, pack.evidence, folderName);
  });

  return zip.generateAsync({ type: 'blob' });
}

export async function generateEvidencePackPdf(data: EvidencePackData): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
  const ov = data.overview;
  const report = buildStreamlinedEvidenceReport(data);
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 40;
  const titleColor: [number, number, number] = [16, 91, 161];
  const textColor: [number, number, number] = [38, 51, 77];

  const sectionTitle = (title: string, y: number) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...titleColor);
    doc.text(title, marginX, y);
  };

  doc.setFillColor(...titleColor);
  doc.rect(0, 0, pageWidth, 78, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('UAE eInvoicing Evidence Pack', marginX, 36);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`${ov.specVersion} | ${ov.drVersion}`, marginX, 56);

  doc.setTextColor(...textColor);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Executive Decision', marginX, 106);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const summaryRows = [
    ['Run ID', ov.assessmentRunId],
    ['Execution Time', new Date(ov.executionTimestamp).toLocaleString()],
    ['Evidence Source', ov.sourceMode === 'persisted_snapshot' ? 'Persisted snapshot' : 'Current in-memory run'],
    ['Scope', ov.scope],
    ['Dataset', ov.datasetName || '-'],
    ['Entity Scope', ov.entityScopeStatus === 'single_entity' ? 'Single entity' : ov.entityScopeStatus === 'multi_entity' ? 'Multi-entity' : 'Unknown'],
    ['Legal Entities', ov.legalEntityCount > 0 ? String(ov.legalEntityCount) : 'Unknown'],
    ['Invoices', String(ov.counts.totalInvoices)],
    ['Buyers', String(ov.counts.totalBuyers)],
    ['Lines', String(ov.counts.totalLines)],
  ];
  autoTable(doc, {
    startY: 118,
    head: [['Field', 'Value']],
    body: summaryRows,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [236, 243, 252], textColor: [24, 40, 72] },
    margin: { left: marginX, right: marginX },
  });

  const executiveY = (doc as any).lastAutoTable.finalY + 18;
  sectionTitle('Decision Summary', executiveY);
  autoTable(doc, {
    startY: executiveY + 8,
    head: [['Metric', 'Value']],
    body: [
      ['Readiness verdict', report.verdict],
      ['Evidence confidence', report.evidenceConfidence],
      ['Recommended decision', report.recommendedDecision],
      ['Residual risk', report.residualRisk],
    ],
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [236, 243, 252], textColor: [24, 40, 72] },
    margin: { left: marginX, right: marginX },
  });

  const findingsY = (doc as any).lastAutoTable.finalY + 18;
  sectionTitle('Top Blockers', findingsY);
  autoTable(doc, {
    startY: findingsY + 8,
    head: [['Exception', 'Severity', 'Mitigation', 'Decision Impact']],
    body: report.blockers.slice(0, 3).map((blocker) => [
      blocker.title,
      blocker.severity,
      blocker.mitigation,
      blocker.decisionImpact,
    ]),
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 6, overflow: 'linebreak' },
    headStyles: { fillColor: [236, 243, 252], textColor: [24, 40, 72] },
    margin: { left: marginX, right: marginX },
  });

  const kpiY = (doc as any).lastAutoTable.finalY + 18;
  sectionTitle('Headline KPIs', kpiY);
  autoTable(doc, {
    startY: kpiY + 8,
    head: [['Metric', 'Value']],
    body: report.topMetrics.map((metric) => [metric.label, `${metric.value} | ${metric.helper}`]),
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [236, 243, 252], textColor: [24, 40, 72] },
    margin: { left: marginX, right: marginX },
  });

  doc.addPage();
  sectionTitle('Exceptions And Mitigations', 50);
  autoTable(doc, {
    startY: 62,
    head: [['Exception', 'Severity', 'Impact', 'Mitigation', 'Owner', 'Status', 'Residual Risk']],
    body: report.blockers.map((blocker) => [
      blocker.title,
      blocker.severity,
      blocker.impact,
      blocker.mitigation,
      blocker.owner,
      blocker.status,
      blocker.residualRisk,
    ]),
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: [236, 243, 252], textColor: [24, 40, 72] },
    margin: { left: marginX, right: marginX },
    columnStyles: { 2: { cellWidth: 110 }, 3: { cellWidth: 140 } },
  });

  doc.addPage();
  sectionTitle('Domain Readiness', 50);
  autoTable(doc, {
    startY: 62,
    head: [['Domain', 'Status', 'Confidence', 'Main Exception', 'Mitigation Status', 'Residual Risk']],
    body: report.domainReadiness
      .filter((domain) => domain.inScope)
      .map((domain) => [
        domain.domain,
        domain.status,
        domain.confidence,
        domain.mainException,
        domain.mitigationStatus,
        domain.residualRisk,
      ]),
    theme: 'striped',
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: [236, 243, 252], textColor: [24, 40, 72] },
    margin: { left: marginX, right: marginX },
    columnStyles: { 3: { cellWidth: 180 }, 4: { cellWidth: 150 } },
  });

  const notesY = (doc as any).lastAutoTable.finalY + 18;
  sectionTitle('Scope Boundary', notesY);
  autoTable(doc, {
    startY: notesY + 8,
    head: [['Field', 'Value']],
    body: [
      ['Included scope', report.includedScopeNote],
      ['Excluded scope', report.excludedScopeNote],
      ['Appendix guidance', report.appendixNote],
    ],
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: [236, 243, 252], textColor: [24, 40, 72] },
    margin: { left: marginX, right: marginX },
  });

  doc.addPage();
  sectionTitle('Appendix A: DR Coverage Matrix', 50);
  autoTable(doc, {
    startY: 62,
    head: [['DR ID', 'Term', 'Mandatory', 'Template', 'Rules', 'Controls', 'Pop %', 'Status']],
    body: data.drCoverage.map((r) => [
      r.dr_id,
      r.business_term,
      r.mandatory ? 'Yes' : 'No',
      r.template,
      String(r.rule_count),
      String(r.control_count),
      r.population_percentage === null ? '-' : `${r.population_percentage.toFixed(0)}%`,
      r.coverage_status,
    ]),
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: [236, 243, 252], textColor: [24, 40, 72] },
    margin: { left: marginX, right: marginX },
    columnStyles: { 1: { cellWidth: 140 } },
  });

  doc.addPage();
  sectionTitle('Appendix B: Rules and Exceptions', 50);
  autoTable(doc, {
    startY: 62,
    head: [['Rule ID', 'Rule Name', 'Severity', 'Type', 'Layer', 'Executions', 'Failures']],
    body: data.ruleExecution.map((r) => [
      r.rule_id,
      r.rule_name,
      r.severity,
      r.rule_type,
      r.execution_layer,
      String(r.execution_count),
      String(r.failure_count),
    ]),
    theme: 'striped',
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: [236, 243, 252], textColor: [24, 40, 72] },
    margin: { left: marginX, right: marginX },
    columnStyles: { 1: { cellWidth: 220 } },
  });

  const afterRulesY = (doc as any).lastAutoTable.finalY + 16;
  sectionTitle('Top Exceptions (first 100)', afterRulesY);
  autoTable(doc, {
    startY: afterRulesY + 8,
    head: [['Exception ID', 'DR ID', 'Rule ID', 'Type', 'Layer', 'Severity', 'Status']],
    body: data.exceptions.slice(0, 100).map((e) => [
      e.exception_id.slice(0, 8),
      e.dr_id,
      e.rule_id,
      e.rule_type,
      e.execution_layer,
      e.severity,
      e.exception_status,
    ]),
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: [236, 243, 252], textColor: [24, 40, 72] },
    margin: { left: marginX, right: marginX },
  });

  doc.addPage();
  sectionTitle('Controls and Population Quality', 50);
  autoTable(doc, {
    startY: 62,
    head: [['Control ID', 'Control Name', 'Type', 'Linked Exceptions']],
    body: data.controlsCoverage.map((c) => [
      c.control_id,
      c.control_name,
      c.control_type,
      String(c.linked_exception_count),
    ]),
    theme: 'striped',
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: [236, 243, 252], textColor: [24, 40, 72] },
    margin: { left: marginX, right: marginX },
    columnStyles: { 1: { cellWidth: 250 } },
  });

  const afterControlsY = (doc as any).lastAutoTable.finalY + 16;
  sectionTitle('Population Quality', afterControlsY);
  autoTable(doc, {
    startY: afterControlsY + 8,
    head: [['DR ID', 'Business Term', 'Mandatory', 'Population %', 'Threshold', 'Pass/Fail']],
    body: data.populationQuality.map((p) => [
      p.dr_id,
      p.business_term,
      p.mandatory ? 'Yes' : 'No',
      p.population_percentage === null ? 'N/A' : `${p.population_percentage.toFixed(1)}%`,
      `${p.threshold}%`,
      p.pass_fail,
    ]),
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: [236, 243, 252], textColor: [24, 40, 72] },
    margin: { left: marginX, right: marginX },
    columnStyles: { 1: { cellWidth: 180 } },
  });

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(110, 122, 145);
    doc.text(`Evidence Pack Report | Page ${page} of ${pageCount}`, marginX, doc.internal.pageSize.getHeight() - 18);
  }

  return doc.output('blob');
}

export function downloadBlob(blob: Blob, filename: string): void {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
