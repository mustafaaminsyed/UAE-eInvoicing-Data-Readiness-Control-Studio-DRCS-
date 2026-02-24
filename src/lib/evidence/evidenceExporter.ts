// =============================================================================
// Evidence Pack Exporter — Generates ZIP with 6 XLSX files
// Part 4 + Part 7 (consistency validation before export)
// =============================================================================

import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { EvidencePackData } from './evidenceDataBuilder';
import { runConsistencyChecks, ConsistencyReport } from '@/lib/coverage/consistencyValidator';

export interface ExportValidationResult {
  valid: boolean;
  report: ConsistencyReport;
}

/** Part 7: Validate consistency before export */
export function validateBeforeExport(): ExportValidationResult {
  const report = runConsistencyChecks();
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

export async function generateEvidencePackZip(data: EvidencePackData): Promise<Blob> {
  const zip = new JSZip();

  // 01_scope_summary.xlsx
  const scopeRows = [
    {
      field: 'Assessment Run ID',
      value: data.overview.assessmentRunId,
    },
    { field: 'Execution Timestamp', value: data.overview.executionTimestamp },
    { field: 'Scope', value: data.overview.scope },
    { field: 'PINT-AE Version', value: data.overview.specVersion },
    { field: 'UAE DR Version', value: data.overview.drVersion },
    { field: 'Dataset / Client', value: data.overview.datasetName },
    { field: 'Total Invoices', value: data.overview.counts.totalInvoices },
    { field: 'Total Buyers', value: data.overview.counts.totalBuyers },
    { field: 'Total Lines', value: data.overview.counts.totalLines },
    { field: 'Total DRs', value: data.overview.counts.totalDRs },
    { field: 'Mandatory DRs', value: data.overview.counts.mandatoryDRs },
    { field: 'Covered DRs', value: data.overview.counts.coveredDRs },
    { field: 'DRs with No Rules', value: data.overview.counts.drsNoRules },
    { field: 'DRs with No Controls', value: data.overview.counts.drsNoControls },
    { field: 'Open Exceptions', value: data.overview.counts.openExceptions },
  ];
  zip.file('01_scope_summary.xlsx', workbookToBuffer(createWorkbook(scopeRows, 'Scope Summary')));

  // 02_dr_coverage.xlsx
  const drRows = data.drCoverage.map(r => ({
    'DR ID': r.dr_id,
    'Business Term': r.business_term,
    'Mandatory': r.mandatory ? 'Yes' : 'No',
    'Template': r.template,
    'Column Names': r.column_names,
    'ASP Derived': r.asp_derived ? 'Yes' : 'No',
    'Rule Count': r.rule_count,
    'Control Count': r.control_count,
    'Population %': r.population_percentage !== null ? Number(r.population_percentage.toFixed(1)) : '',
    'Coverage Status': r.coverage_status,
  }));
  zip.file('02_dr_coverage.xlsx', workbookToBuffer(createWorkbook(drRows, 'DR Coverage')));

  // 03_rule_execution.xlsx
  const ruleRows = data.ruleExecution.map(r => ({
    'Rule ID': r.rule_id,
    'Rule Name': r.rule_name,
    'Severity': r.severity,
    'Linked DR IDs': r.linked_dr_ids,
    'Execution Count': r.execution_count,
    'Failure Count': r.failure_count,
    'Execution Count Source': r.execution_source,
  }));
  zip.file('03_rule_execution.xlsx', workbookToBuffer(createWorkbook(ruleRows, 'Rule Execution')));

  // 04_exceptions_and_cases.xlsx
  const excRows = data.exceptions.map(e => ({
    'Exception ID': e.exception_id,
    'DR ID': e.dr_id,
    'Rule ID': e.rule_id,
    'Record Reference': e.record_reference,
    'Severity': e.severity,
    'Message': e.message,
    'Exception Status': e.exception_status,
    'Case ID': e.case_id,
    'Case Status': e.case_status,
  }));
  zip.file('04_exceptions_and_cases.xlsx', workbookToBuffer(createWorkbook(
    excRows.length > 0 ? excRows : [{ 'Exception ID': '', 'DR ID': '', 'Rule ID': '', 'Record Reference': '', 'Severity': '', 'Message': 'No exceptions', 'Exception Status': '', 'Case ID': '', 'Case Status': '' }],
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
  zip.file('05_controls_mapping.xlsx', workbookToBuffer(createWorkbook(ctrlRows, 'Controls')));

  // 06_population_quality.xlsx
  const popRows = data.populationQuality.map(p => ({
    'DR ID': p.dr_id,
    'Business Term': p.business_term,
    'Mandatory': p.mandatory ? 'Yes' : 'No',
    'Population %': p.population_percentage !== null ? Number(p.population_percentage.toFixed(1)) : 'N/A',
    'Threshold': p.threshold,
    'Pass/Fail': p.pass_fail,
  }));
  zip.file('06_population_quality.xlsx', workbookToBuffer(createWorkbook(popRows, 'Population Quality')));

  return zip.generateAsync({ type: 'blob' });
}

export async function generateEvidencePackPdf(data: EvidencePackData): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
  const ov = data.overview;
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
  doc.text('Assessment Summary', marginX, 106);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const summaryRows = [
    ['Run ID', ov.assessmentRunId],
    ['Execution Time', new Date(ov.executionTimestamp).toLocaleString()],
    ['Scope', ov.scope],
    ['Dataset', ov.datasetName || '-'],
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

  const kpiY = (doc as any).lastAutoTable.finalY + 18;
  sectionTitle('Coverage KPIs', kpiY);
  autoTable(doc, {
    startY: kpiY + 8,
    head: [['Metric', 'Value']],
    body: [
      ['Total DRs', String(ov.counts.totalDRs)],
      ['Mandatory DRs', String(ov.counts.mandatoryDRs)],
      ['Covered DRs', String(ov.counts.coveredDRs)],
      ['DRs With No Rules', String(ov.counts.drsNoRules)],
      ['DRs With No Controls', String(ov.counts.drsNoControls)],
      ['Open Exceptions', String(ov.counts.openExceptions)],
    ],
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [236, 243, 252], textColor: [24, 40, 72] },
    margin: { left: marginX, right: marginX },
  });

  doc.addPage();
  sectionTitle('DR Coverage Matrix', 50);
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
  sectionTitle('Rules and Exceptions', 50);
  autoTable(doc, {
    startY: 62,
    head: [['Rule ID', 'Rule Name', 'Severity', 'Executions', 'Failures']],
    body: data.ruleExecution.map((r) => [
      r.rule_id,
      r.rule_name,
      r.severity,
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
    head: [['Exception ID', 'DR ID', 'Rule ID', 'Severity', 'Status']],
    body: data.exceptions.slice(0, 100).map((e) => [
      e.exception_id.slice(0, 8),
      e.dr_id,
      e.rule_id,
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
