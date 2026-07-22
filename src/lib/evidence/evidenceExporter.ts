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
import daribaLogo from '@/assets/Daribatech_Logo_White_Transparent.png';

export interface ExportValidationResult {
  valid: boolean;
  report: ConsistencyReport;
}

export interface EntityEvidencePackExport {
  entityKey: string;
  entityLabel: string;
  evidence: EvidencePackData;
}

let cachedLogoDataUrl: string | null = null;

async function assetUrlToDataUrl(url: string): Promise<string | null> {
  if (cachedLogoDataUrl) return cachedLogoDataUrl;

  try {
    const response = await fetch(url);
    const blob = await response.blob();

    cachedLogoDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    return cachedLogoDataUrl;
  } catch {
    return null;
  }
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
  const runModeLabel =
    data.overview.runMode === 'diagnostic_mapping'
      ? 'Diagnostic mapping run'
      : data.overview.runMode === 'governed_mapping'
        ? 'Governed mapping run'
        : data.overview.runMode === 'raw_template'
          ? 'Raw template run'
          : 'Not recorded';
  const readinessQualificationLabel =
    data.overview.readinessQualification === 'diagnostic_only'
      ? 'Diagnostic assessment'
      : data.overview.readinessQualification === 'decision_ready'
        ? 'Decision-ready assessment'
        : 'Not recorded';

  return [
    { field: 'Run classification', value: `${readinessQualificationLabel} | ${runModeLabel}` },
    {
      field: 'Source-to-canonical mapping coverage',
      value:
        data.overview.mappingCoveragePercent !== null && data.overview.mappingCoveragePercent !== undefined
          ? `${Math.round(data.overview.mappingCoveragePercent)}%`
          : 'Not recorded',
    },
    { field: 'Readiness Verdict', value: report.verdictLabel },
    { field: 'Assessment Confidence', value: report.evidenceConfidenceLabel },
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

function scopeAndMethodologyRows(data: EvidencePackData) {
  const report = buildStreamlinedEvidenceReport(data);
  return [
    ...report.scopeSummary.map((item) => ({
      section: 'Assessment scope',
      title: item.label,
      detail: item.value,
      notes: item.helper ?? '',
    })),
    ...report.methodology.map((item) => ({
      section: 'Methodology',
      title: item.title,
      detail: item.detail,
      notes: '',
    })),
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

function remediationPriorityRows(data: EvidencePackData) {
  const report = buildStreamlinedEvidenceReport(data);
  return report.remediationPriorities.map((action) => ({
    Priority: action.priority,
    Action: action.title,
    'Affected Area': action.affectedArea,
    Rationale: action.rationale,
    'Recommended Fix': action.action,
    Owner: action.owner,
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

function templateFindingRows(data: EvidencePackData) {
  const report = buildStreamlinedEvidenceReport(data);
  return report.templateSummaries.map((summary) => ({
    Template: summary.label,
    'Records In Scope': summary.recordsInScope,
    'Mandatory Field Failures': summary.mandatoryFieldFailures,
    'Low Population Fields': summary.lowPopulationFields,
    'Structural Gaps': summary.structuralGaps,
    'Key Finding': summary.keyFinding,
  }));
}

function appendEvidencePackFiles(zip: JSZip, data: EvidencePackData, prefix = ''): void {
  const summary = buildEvidenceSummary(data);

  zip.file(
    `${prefix}00_executive_verdict.xlsx`,
    workbookToBuffer(createWorkbook(executiveDecisionRows(data), 'Executive Verdict'))
  );
  const groupedExceptions = exceptionMitigationRows(data);
  zip.file(
    `${prefix}00a_scope_and_methodology.xlsx`,
    workbookToBuffer(createWorkbook(scopeAndMethodologyRows(data), 'Scope & Methodology'))
  );
  zip.file(
    `${prefix}00b_priority_actions.xlsx`,
    workbookToBuffer(
      createWorkbook(
        remediationPriorityRows(data).length > 0
          ? remediationPriorityRows(data)
          : [{ Priority: '', Action: 'No remediation actions recorded', 'Affected Area': '', Rationale: '', 'Recommended Fix': '', Owner: '' }],
        'Priority Actions',
      )
    )
  );
  zip.file(
    `${prefix}00c_template_findings.xlsx`,
    workbookToBuffer(createWorkbook(templateFindingRows(data), 'Template Findings'))
  );
  zip.file(
    `${prefix}00d_exceptions_and_mitigations.xlsx`,
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
    `${prefix}00e_domain_readiness.xlsx`,
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
      field: 'Run Classification',
      value:
        data.overview.readinessQualification === 'diagnostic_only'
          ? 'Diagnostic assessment'
          : data.overview.readinessQualification === 'decision_ready'
            ? 'Decision-ready assessment'
            : 'Not recorded',
    },
    {
      field: 'Run Mode',
      value:
        data.overview.runMode === 'diagnostic_mapping'
          ? 'Diagnostic mapping run'
          : data.overview.runMode === 'governed_mapping'
            ? 'Governed mapping run'
            : data.overview.runMode === 'raw_template'
              ? 'Raw template run'
              : 'Not recorded',
    },
    {
      field: 'Source-to-Canonical Mapping Coverage',
      value:
        data.overview.mappingCoveragePercent !== null && data.overview.mappingCoveragePercent !== undefined
          ? `${Math.round(data.overview.mappingCoveragePercent)}%`
          : 'Not recorded',
    },
    {
      field: 'Evidence Source',
      value:
        data.overview.sourceMode === 'persisted_snapshot'
          ? 'Saved assessment snapshot'
          : 'Current assessment run',
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
    { field: 'Total Data Requirements', value: data.overview.counts.totalDRs },
    { field: 'Mandatory Data Requirements', value: data.overview.counts.mandatoryDRs },
    { field: 'Covered Data Requirements', value: data.overview.counts.coveredDRs },
    { field: 'Data Requirements With No Rules', value: data.overview.counts.drsNoRules },
    { field: 'Data Requirements With No Controls', value: data.overview.counts.drsNoControls },
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
    'Data Requirement ID': r.dr_id,
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
  zip.file(`${prefix}02_dr_coverage.xlsx`, workbookToBuffer(createWorkbook(drRows, 'Data Requirement Coverage')));

  // 03_rule_execution.xlsx
  const ruleRows = data.ruleExecution.map(r => ({
    'Rule ID': r.rule_id,
    'Rule Name': r.rule_name,
    'Severity': r.severity,
    'Rule Type': r.rule_type,
    'Execution Layer': r.execution_layer,
    'Failure Class': r.failure_class,
    'Linked Data Requirement IDs': r.linked_dr_ids,
    'Execution Count': r.execution_count,
    'Failure Count': r.failure_count,
    'Execution Count Source': r.execution_source,
  }));
  zip.file(`${prefix}03_rule_execution.xlsx`, workbookToBuffer(createWorkbook(ruleRows, 'Rule Execution')));

  // 04_exceptions_and_cases.xlsx
  const excRows = data.exceptions.map(e => ({
    'Exception ID': e.exception_id,
    'Data Requirement ID': e.dr_id,
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
    excRows.length > 0 ? excRows : [{ 'Exception ID': '', 'Data Requirement ID': '', 'Rule ID': '', 'Rule Type': '', 'Execution Layer': '', 'Failure Class': '', 'Record Reference': '', 'Severity': '', 'Message': 'No exceptions', 'Exception Status': '', 'Case ID': '', 'Case Status': '' }],
    'Exceptions'
  )));

  // 05_controls_mapping.xlsx
  const ctrlRows = data.controlsCoverage.map(c => ({
    'Control ID': c.control_id,
    'Control Name': c.control_name,
    'Control Type': c.control_type,
    'Covered Rule IDs': c.covered_rule_ids,
    'Covered Data Requirement IDs': c.covered_dr_ids,
    'Linked Exceptions': c.linked_exception_count,
  }));
  zip.file(`${prefix}05_controls_mapping.xlsx`, workbookToBuffer(createWorkbook(ctrlRows, 'Controls')));

  // 06_population_quality.xlsx
  const popRows = data.populationQuality.map(p => ({
    'Data Requirement ID': p.dr_id,
    'Business Term': p.business_term,
    'Mandatory': p.mandatory ? 'Yes' : 'No',
    'Population %': p.population_percentage !== null ? Number(p.population_percentage.toFixed(1)) : 'N/A',
    'Threshold': p.threshold,
    'Pass/Fail': p.pass_fail,
  }));
  zip.file(`${prefix}06_population_quality.xlsx`, workbookToBuffer(createWorkbook(popRows, 'Population Quality')));

  // 07_traceability_matrix.xlsx
  const traceabilityRows = data.traceabilityRows.map((row) => ({
    'Data Requirement ID': row.dr_id,
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
    'Run Classification':
      pack.evidence.overview.readinessQualification === 'diagnostic_only'
        ? 'Diagnostic assessment'
        : pack.evidence.overview.readinessQualification === 'decision_ready'
          ? 'Decision-ready assessment'
          : 'Not recorded',
    'Run Mode':
      pack.evidence.overview.runMode === 'diagnostic_mapping'
        ? 'Diagnostic mapping run'
        : pack.evidence.overview.runMode === 'governed_mapping'
          ? 'Governed mapping run'
          : pack.evidence.overview.runMode === 'raw_template'
            ? 'Raw template run'
            : 'Not recorded',
    'Invoices': pack.evidence.overview.counts.totalInvoices,
    'Buyers': pack.evidence.overview.counts.totalBuyers,
    'Lines': pack.evidence.overview.counts.totalLines,
    'Open Exceptions': pack.evidence.overview.counts.openExceptions,
    'Covered Data Requirements': pack.evidence.overview.counts.coveredDRs,
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
  const logoDataUrl = await assetUrlToDataUrl(daribaLogo);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 40;
  const brandDark: [number, number, number] = [7, 83, 71];
  const brandDarkAlt: [number, number, number] = [11, 70, 61];
  const brandAccent: [number, number, number] = [198, 245, 173];
  const brandLine: [number, number, number] = [133, 172, 162];
  const panelTint: [number, number, number] = [237, 246, 241];
  const textColor: [number, number, number] = [34, 52, 46];
  const mutedTextColor: [number, number, number] = [88, 107, 100];
  const white: [number, number, number] = [255, 255, 255];

  const tableHeadStyles = { fillColor: brandDark, textColor: white };
  const tableBodyStyles = { fontSize: 8.5, cellPadding: 5, overflow: 'linebreak' as const, textColor };

  const evidenceLogoAspectRatio = 430 / 124;
  const addLogo = (x: number, y: number, width: number) => {
    if (!logoDataUrl) return;
    const height = width / evidenceLogoAspectRatio;
    doc.addImage(logoDataUrl, 'PNG', x, y, width, height);
  };

  const drawCoverBackground = () => {
    doc.setFillColor(...brandDark);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    doc.setDrawColor(...brandLine);
    doc.setLineWidth(1.2);
    doc.circle(pageWidth + 70, pageHeight / 2, 255, 'S');

    doc.setFillColor(23, 101, 87);
    doc.circle(pageWidth - 95, 250, 110, 'F');
    doc.setFillColor(26, 95, 82);
    doc.circle(pageWidth - 160, 215, 42, 'F');
    doc.setFillColor(20, 92, 78);
    doc.circle(280, 385, 120, 'F');
  };

  const drawPageChrome = (pageTitle?: string) => {
    doc.setFillColor(...brandDark);
    doc.rect(0, 0, pageWidth, 54, 'F');
    doc.setDrawColor(...brandAccent);
    doc.setLineWidth(0.8);
    doc.line(marginX, 55, pageWidth - marginX, 55);
    if (pageTitle) {
      doc.setTextColor(...white);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(pageTitle, marginX, 33);
    }
    if (logoDataUrl) {
      addLogo(pageWidth - marginX - 96, 13, 96);
    }
  };

  const sectionTitle = (title: string, topY: number, chromeTitle?: string) => {
    const boxHeight = 28;
    const tableStartOffset = 14;
    let boxY = topY;

    if (boxY + boxHeight + 72 > pageHeight - 42) {
      doc.addPage();
      drawPageChrome(chromeTitle);
      boxY = 76;
    }

    doc.setFillColor(...panelTint);
    doc.roundedRect(marginX, boxY, 220, boxHeight, 8, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...brandDarkAlt);
    doc.text(title, marginX + 12, boxY + 19);
    return boxY + boxHeight + tableStartOffset;
  };
  const runModeLabel =
    ov.runMode === 'diagnostic_mapping'
      ? 'Diagnostic mapping run'
      : ov.runMode === 'governed_mapping'
        ? 'Governed mapping run'
        : ov.runMode === 'raw_template'
          ? 'Raw template run'
          : 'Not recorded';
  const readinessQualificationLabel =
    ov.readinessQualification === 'diagnostic_only'
      ? 'Diagnostic assessment'
      : ov.readinessQualification === 'decision_ready'
        ? 'Decision-ready assessment'
        : 'Not recorded';

  drawCoverBackground();
  doc.setTextColor(...white);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(18);
  doc.text('Evidence Pack', marginX, 330);
  doc.setTextColor(...brandAccent);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(42);
  doc.text('UAE eInvoicing', marginX, 392);
  doc.text('Readiness Report', marginX, 438);
  doc.setTextColor(...white);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  const subtitle = [
    `${ov.datasetName || 'Client portfolio'} | Generated by Daribatech DCS`,
    `${readinessQualificationLabel} | ${runModeLabel}`,
    `${ov.specVersion} | ${ov.drVersion}`,
  ];
  doc.text(subtitle, marginX, 486, { lineHeightFactor: 1.5 });

  doc.setFillColor(244, 249, 246);
  doc.roundedRect(marginX, 535, 245, 96, 16, 16, 'F');
  doc.setTextColor(...brandDark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Assessment snapshot', marginX + 18, 560);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(
    [
      `Invoices in scope: ${ov.counts.totalInvoices}`,
      `Open exceptions: ${ov.counts.openExceptions}`,
      `Overall readiness: ${report.verdictLabel}`,
    ],
    marginX + 18,
    584,
    { lineHeightFactor: 1.55 },
  );

  if (logoDataUrl) {
    addLogo(marginX, pageHeight - 104, 180);
  }

  doc.setTextColor(...brandAccent);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Prepared for client review and implementation governance', marginX, pageHeight - 34);

  doc.addPage();
  drawPageChrome('Executive Summary');

  doc.setTextColor(...textColor);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('1. Executive Verdict', marginX, 92);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const summaryRows = [
    ['Run ID', ov.assessmentRunId],
    ['Execution Time', new Date(ov.executionTimestamp).toLocaleString()],
    ['Run classification', readinessQualificationLabel],
    ['Run mode', runModeLabel],
    ['Source-to-canonical mapping coverage', ov.mappingCoveragePercent !== null && ov.mappingCoveragePercent !== undefined ? `${Math.round(ov.mappingCoveragePercent)}%` : 'Not recorded'],
    ['Evidence Source', ov.sourceMode === 'persisted_snapshot' ? 'Saved assessment snapshot' : 'Current assessment run'],
    ['Scope', ov.scope],
    ['Dataset', ov.datasetName || '-'],
    ['Entity Scope', ov.entityScopeStatus === 'single_entity' ? 'Single entity' : ov.entityScopeStatus === 'multi_entity' ? 'Multi-entity' : 'Unknown'],
    ['Legal Entities', ov.legalEntityCount > 0 ? String(ov.legalEntityCount) : 'Unknown'],
    ['Invoices', String(ov.counts.totalInvoices)],
    ['Buyers', String(ov.counts.totalBuyers)],
    ['Lines', String(ov.counts.totalLines)],
  ];
  autoTable(doc, {
    startY: 104,
    head: [['Field', 'Value']],
    body: summaryRows,
    theme: 'grid',
    styles: { ...tableBodyStyles, fontSize: 9 },
    headStyles: tableHeadStyles,
    alternateRowStyles: { fillColor: [248, 251, 249] },
    margin: { left: marginX, right: marginX },
  });

  const executiveTableY = sectionTitle('2. Decision Summary', (doc as any).lastAutoTable.finalY + 20, 'Executive Summary');
  autoTable(doc, {
    startY: executiveTableY,
    head: [['Metric', 'Value']],
    body: [
      ['Readiness verdict', report.verdictLabel],
      ['Assessment confidence', report.evidenceConfidenceLabel],
      ['Recommended decision', report.recommendedDecision],
      ['Residual risk', report.residualRisk],
    ],
    theme: 'striped',
    styles: { ...tableBodyStyles, fontSize: 9 },
    headStyles: tableHeadStyles,
    margin: { left: marginX, right: marginX },
  });

  const scopeTableY = sectionTitle('3. Scope Of Assessment', (doc as any).lastAutoTable.finalY + 20, 'Executive Summary');
  const reportScope = buildStreamlinedEvidenceReport(data);
  autoTable(doc, {
    startY: scopeTableY,
    head: [['Scope item', 'Detail']],
    body: reportScope.scopeSummary.map((item) => [item.label, `${item.value}${item.helper ? ` | ${item.helper}` : ''}`]),
    theme: 'striped',
    styles: { ...tableBodyStyles, fontSize: 9 },
    headStyles: tableHeadStyles,
    margin: { left: marginX, right: marginX },
  });

  const findingsTableY = sectionTitle('4. Priority Blockers', (doc as any).lastAutoTable.finalY + 20, 'Executive Summary');
  autoTable(doc, {
    startY: findingsTableY,
    head: [['Exception', 'Severity', 'Mitigation', 'Decision Impact']],
    body: report.blockers.slice(0, 3).map((blocker) => [
      blocker.title,
      blocker.severity,
      blocker.mitigation,
      blocker.decisionImpact,
    ]),
    theme: 'grid',
    styles: { ...tableBodyStyles, fontSize: 9 },
    headStyles: tableHeadStyles,
    margin: { left: marginX, right: marginX },
  });

  const kpiTableY = sectionTitle('5. Readiness Highlights', (doc as any).lastAutoTable.finalY + 20, 'Executive Summary');
  autoTable(doc, {
    startY: kpiTableY,
    head: [['Metric', 'Value']],
    body: report.topMetrics.map((metric) => [metric.label, `${metric.value} | ${metric.helper}`]),
    theme: 'striped',
    styles: { ...tableBodyStyles, fontSize: 9 },
    headStyles: tableHeadStyles,
    margin: { left: marginX, right: marginX },
  });

  doc.addPage();
  drawPageChrome('Remediation And Findings');
  const remediationTableY = sectionTitle('6. Priority Remediation Actions', 76, 'Remediation And Findings');
  autoTable(doc, {
    startY: remediationTableY,
    head: [['Priority', 'Action', 'Affected Area', 'Recommended Fix', 'Owner']],
    body: report.remediationPriorities.map((action) => [
      action.priority,
      action.title,
      action.affectedArea,
      action.action,
      action.owner,
    ]),
    theme: 'grid',
    styles: tableBodyStyles,
    headStyles: tableHeadStyles,
    margin: { left: marginX, right: marginX },
    columnStyles: { 2: { cellWidth: 100 }, 3: { cellWidth: 170 } },
  });

  const templateTableY = sectionTitle('7. Template Findings Summary', (doc as any).lastAutoTable.finalY + 20, 'Remediation And Findings');
  autoTable(doc, {
    startY: templateTableY,
    head: [['Template', 'Scope', 'Mandatory Fails', 'Structural Gaps', 'Key Finding']],
    body: report.templateSummaries.map((summary) => [
      summary.label,
      String(summary.recordsInScope),
      String(summary.mandatoryFieldFailures),
      String(summary.structuralGaps),
      summary.keyFinding,
    ]),
    theme: 'grid',
    styles: tableBodyStyles,
    headStyles: tableHeadStyles,
    margin: { left: marginX, right: marginX },
    columnStyles: { 4: { cellWidth: 190 } },
  });

  doc.addPage();
  drawPageChrome('Exception Themes');
  const exceptionTableY = sectionTitle('8. Exceptions And Mitigations', 76, 'Exception Themes');
  autoTable(doc, {
    startY: exceptionTableY,
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
    styles: tableBodyStyles,
    headStyles: tableHeadStyles,
    margin: { left: marginX, right: marginX },
    columnStyles: { 2: { cellWidth: 110 }, 3: { cellWidth: 140 } },
  });

  doc.addPage();
  drawPageChrome('Domain Summary');
  const domainTableY = sectionTitle('Domain Readiness', 76, 'Domain Summary');
  autoTable(doc, {
    startY: domainTableY,
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
    styles: tableBodyStyles,
    headStyles: tableHeadStyles,
    margin: { left: marginX, right: marginX },
    columnStyles: { 3: { cellWidth: 180 }, 4: { cellWidth: 150 } },
  });

  const notesTableY = sectionTitle('Scope Boundary', (doc as any).lastAutoTable.finalY + 20, 'Domain Summary');
  autoTable(doc, {
    startY: notesTableY,
    head: [['Field', 'Value']],
    body: [
      ['Included scope', report.includedScopeNote],
      ['Excluded scope', report.excludedScopeNote],
      ['Appendix guidance', report.appendixNote],
    ],
    theme: 'grid',
    styles: tableBodyStyles,
    headStyles: tableHeadStyles,
    margin: { left: marginX, right: marginX },
  });

  doc.addPage();
  drawPageChrome('Technical Appendix');
  const appendixATableY = sectionTitle('Appendix A: Data Requirement Coverage Matrix', 76, 'Technical Appendix');
  autoTable(doc, {
    startY: appendixATableY,
    head: [['Data Requirement ID', 'Term', 'Mandatory', 'Template', 'Rules', 'Controls', 'Pop %', 'Status']],
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
    styles: tableBodyStyles,
    headStyles: tableHeadStyles,
    margin: { left: marginX, right: marginX },
    columnStyles: { 1: { cellWidth: 140 } },
  });

  doc.addPage();
  drawPageChrome('Technical Appendix');
  const appendixBTableY = sectionTitle('Appendix B: Rules and Exceptions', 76, 'Technical Appendix');
  autoTable(doc, {
    startY: appendixBTableY,
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
    styles: tableBodyStyles,
    headStyles: tableHeadStyles,
    margin: { left: marginX, right: marginX },
    columnStyles: { 1: { cellWidth: 220 } },
  });

  const topExceptionsTableY = sectionTitle('Top Exceptions (first 100)', (doc as any).lastAutoTable.finalY + 20, 'Technical Appendix');
  autoTable(doc, {
    startY: topExceptionsTableY,
    head: [['Exception ID', 'Data Requirement ID', 'Rule ID', 'Type', 'Layer', 'Severity', 'Status']],
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
    styles: tableBodyStyles,
    headStyles: tableHeadStyles,
    margin: { left: marginX, right: marginX },
  });

  doc.addPage();
  drawPageChrome('Technical Appendix');
  const controlsTableY = sectionTitle('Controls and Population Quality', 76, 'Technical Appendix');
  autoTable(doc, {
    startY: controlsTableY,
    head: [['Control ID', 'Control Name', 'Type', 'Linked Exceptions']],
    body: data.controlsCoverage.map((c) => [
      c.control_id,
      c.control_name,
      c.control_type,
      String(c.linked_exception_count),
    ]),
    theme: 'striped',
    styles: tableBodyStyles,
    headStyles: tableHeadStyles,
    margin: { left: marginX, right: marginX },
    columnStyles: { 1: { cellWidth: 250 } },
  });

  const populationQualityTableY = sectionTitle('Population Quality', (doc as any).lastAutoTable.finalY + 20, 'Technical Appendix');
  autoTable(doc, {
    startY: populationQualityTableY,
    head: [['Data Requirement ID', 'Business Term', 'Mandatory', 'Population %', 'Threshold', 'Pass/Fail']],
    body: data.populationQuality.map((p) => [
      p.dr_id,
      p.business_term,
      p.mandatory ? 'Yes' : 'No',
      p.population_percentage === null ? 'N/A' : `${p.population_percentage.toFixed(1)}%`,
      `${p.threshold}%`,
      p.pass_fail,
    ]),
    theme: 'grid',
    styles: tableBodyStyles,
    headStyles: tableHeadStyles,
    margin: { left: marginX, right: marginX },
    columnStyles: { 1: { cellWidth: 180 } },
  });

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...mutedTextColor);
    doc.setDrawColor(...brandLine);
    doc.setLineWidth(0.6);
    doc.line(marginX, doc.internal.pageSize.getHeight() - 28, pageWidth - marginX, doc.internal.pageSize.getHeight() - 28);
    if (page !== 1 && logoDataUrl) {
      addLogo(marginX, doc.internal.pageSize.getHeight() - 24, 52);
    }
    doc.text(`Daribatech DCS Evidence Pack`, page === 1 ? marginX : marginX + 62, doc.internal.pageSize.getHeight() - 14);
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - marginX - 56, doc.internal.pageSize.getHeight() - 14);
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
