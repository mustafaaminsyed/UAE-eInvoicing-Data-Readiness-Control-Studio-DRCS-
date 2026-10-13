import type { useCompliance } from '@/context/ComplianceContext';
import { computeDashboardMetrics } from '@/hooks/useDashboardMetrics';

import {
  MANDATORY_BUYER_FIELDS,
  MANDATORY_HEADER_FIELDS,
  MANDATORY_LINE_FIELDS,
  computeCompleteness,
  computeConditionalCoverage,
  computeCreditNoteCoverage,
  computeCurrencyMismatchCount,
  computeDuplicateInvoiceRatio,
  computeNullFieldRate,
  toRecords,
} from './dataQuality';
import { buildBlockingIssues, computeInvalidCodelistCount, deriveExceptionThemes } from './exceptions';
import { average, clampScore, weightedAverage } from './scoring';
import type {
  DashboardCheckResult,
  DashboardException,
  DashboardSnapshot,
  DatasetScope,
  ScoreInput,
} from './types';

export function buildFallbackSnapshot(dataset: DatasetScope): DashboardSnapshot {
  const previewReadiness = dataset === 'AR' ? 91 : 87;
  return {
    hasLiveSignals: true,
    modeLabel: 'Preview portfolio snapshot',
    totalInvoices: dataset === 'AR' ? 1284 : 964,
    submissionReadyCount: dataset === 'AR' ? 1186 : 833,
    submissionReadyRate: dataset === 'AR' ? 92.4 : 86.4,
    rulePassRate: dataset === 'AR' ? 93.1 : 88.2,
    totalRuleOutcomes: dataset === 'AR' ? 4380 : 3264,
    criticalBlockerDocumentCount: dataset === 'AR' ? 7 : 9,
    avgCriticalBlockersPerDocument: dataset === 'AR' ? 3 : 3,
    acceptedInvoices: dataset === 'AR' ? 1186 : 833,
    successRate: dataset === 'AR' ? 92.4 : 86.4,
    passRate: dataset === 'AR' ? 93.1 : 88.2,
    criticalBlockerOutcomes: dataset === 'AR' ? 21 : 27,
    criticalIssues: dataset === 'AR' ? 7 : 9,
    complianceReadiness: previewReadiness,
    goLiveReadiness: previewReadiness - 3,
    mandatoryCompleteness: 94,
    conditionalCompleteness: 86,
    conditionalFieldDocumentCount: 37,
    nullFieldRate: 3.8,
    duplicateInvoiceRatio: 0.9,
    invalidCodelistCount: 12,
    currencyMismatchCount: 4,
    ibtMandatoryCoverage: 94,
    pintRuleCoverage: dataset === 'AR' ? 93 : 88,
    creditNoteCoverage: 81,
    creditNoteCount: 23,
    creditNoteReasonCoverage: 87,
    creditNoteReferenceCoverage: 76,
    headerCompleteness: 96,
    buyerCompleteness: 92,
    lineCompleteness: 94,
    executedRuleOutcomes: dataset === 'AR' ? 4380 : 3264,
    regulatoryRegisteredControls: 63,
    regulatoryApplicableControls: dataset === 'AR' ? 63 : 0,
    regulatoryEvaluatedControls: dataset === 'AR' ? 63 : 0,
    regulatoryNotApplicableControls: dataset === 'AP' ? 63 : 0,
    regulatoryNotEvaluatedControls: 0,
    supplementaryControls: 10,
    evaluationCoverage: dataset === 'AR' ? 100 : null,
    exceptionsTotal: dataset === 'AR' ? 46 : 53,
    exceptionsBySeverity: { Critical: dataset === 'AR' ? 7 : 9, High: 19, Medium: 14, Low: 6 },
    blockingIssues: [
      {
        key: 'UAE-UC1-CHK-012',
        label: 'Seller identity completeness',
        count: 18,
        affectedInvoices: 18,
        hasInvoiceCoverage: true,
        severity: 'Critical',
        description: 'Seller registration and naming fields still create the largest readiness drag.',
      },
      {
        key: 'UAE-UC1-CHK-018',
        label: 'Buyer TRN pattern',
        count: 13,
        affectedInvoices: 13,
        hasInvoiceCoverage: true,
        severity: 'High',
        description: 'Counterparty TRN formatting remains inconsistent across repeat records.',
      },
      {
        key: 'UAE-UC1-CHK-031',
        label: 'VAT amount reconciliation',
        count: 9,
        affectedInvoices: 9,
        hasInvoiceCoverage: true,
        severity: 'High',
        description: 'Totals and tax derivation diverge on manually adjusted documents.',
      },
    ],
    exceptionThemes: [
      { title: 'Master data breaks', value: '21', subtitle: 'Counterparty and registration-quality issues' },
      { title: 'Tax / currency issues', value: '15', subtitle: 'VAT, codelist, and currency-control exceptions' },
      { title: 'Document structure issues', value: '10', subtitle: 'Invoice-shape, mandatory-field, and sequencing issues' },
    ],
  };
}

export function buildDashboardSnapshot(input: {
  dataset: DatasetScope;
  isChecksRun: boolean;
  isDataLoaded: boolean;
  stats: ReturnType<ReturnType<typeof useCompliance>['getDashboardStats']>;
  checkResults: ReturnType<typeof useCompliance>['checkResults'];
  exceptions: ReturnType<typeof useCompliance>['exceptions'];
  buyers: ReturnType<typeof useCompliance>['buyers'];
  headers: ReturnType<typeof useCompliance>['headers'];
  lines: ReturnType<typeof useCompliance>['lines'];
  validationExecutions: ReturnType<typeof useCompliance>['validationExecutions'];
}): DashboardSnapshot {
  const { dataset, isChecksRun, isDataLoaded, stats, checkResults, exceptions, buyers, headers, lines } = input;
  const validationExecutions = input.validationExecutions ?? [];

  const scopedExceptions = (exceptions as DashboardException[]).filter(
    (exception) => (exception.datasetType || exception.direction || dataset) === dataset
  );
  const scopedCheckResults = (checkResults as DashboardCheckResult[]).filter(
    (result) => (result.datasetType || result.direction || dataset) === dataset
  );

  const headerRecords = toRecords(headers);
  const buyerRecords = toRecords(buyers);
  const lineRecords = toRecords(lines);

  const hasLiveSignals =
    isDataLoaded ||
    isChecksRun ||
    stats.totalInvoices > 0 ||
    scopedExceptions.length > 0 ||
    scopedCheckResults.length > 0 ||
    headerRecords.length > 0;

  if (!hasLiveSignals) {
    return {
      ...buildFallbackSnapshot(dataset),
      hasLiveSignals: false,
      modeLabel: 'No live data loaded',
      totalInvoices: 0,
      submissionReadyCount: 0,
      submissionReadyRate: 0,
      rulePassRate: 0,
      totalRuleOutcomes: 0,
      criticalBlockerOutcomes: 0,
      criticalBlockerDocumentCount: 0,
      avgCriticalBlockersPerDocument: 0,
      acceptedInvoices: 0,
      successRate: 0,
      passRate: 0,
      criticalIssues: 0,
      complianceReadiness: null,
      goLiveReadiness: null,
      mandatoryCompleteness: 0,
      conditionalCompleteness: 0,
      conditionalFieldDocumentCount: 0,
      nullFieldRate: 0,
      duplicateInvoiceRatio: 0,
      invalidCodelistCount: 0,
      currencyMismatchCount: 0,
      ibtMandatoryCoverage: 0,
      pintRuleCoverage: 0,
      creditNoteCoverage: 0,
      creditNoteCount: 0,
      creditNoteReasonCoverage: 0,
      creditNoteReasonTextCoverage: 0,
      creditNoteReferenceCoverage: 0,
      creditNoteIssueDateCoverage: 0,
      headerCompleteness: 0,
      buyerCompleteness: 0,
      lineCompleteness: 0,
      executedRuleOutcomes: 0,
      regulatoryRegisteredControls: 0,
      regulatoryApplicableControls: 0,
      regulatoryEvaluatedControls: 0,
      regulatoryNotApplicableControls: 0,
      regulatoryNotEvaluatedControls: 0,
      supplementaryControls: 0,
      evaluationCoverage: null,
      exceptionsTotal: 0,
      exceptionsBySeverity: { Critical: 0, High: 0, Medium: 0, Low: 0 },
      blockingIssues: [],
      exceptionThemes: [
        { title: 'Master data breaks', value: '0', subtitle: 'Counterparty and registration-quality issues' },
        { title: 'Tax / currency issues', value: '0', subtitle: 'VAT, codelist, and currency-control exceptions' },
        { title: 'Document structure issues', value: '0', subtitle: 'Invoice-shape, mandatory-field, and sequencing issues' },
      ],
    };
  }

  const totalInvoices = stats.totalInvoices || headerRecords.length;
  const headerCompleteness = computeCompleteness(headerRecords, MANDATORY_HEADER_FIELDS);
  const buyerCompleteness = buyerRecords.length > 0 ? computeCompleteness(buyerRecords, MANDATORY_BUYER_FIELDS) : 100;
  const lineCompleteness = lineRecords.length > 0 ? computeCompleteness(lineRecords, MANDATORY_LINE_FIELDS) : 100;
  const mandatoryCompleteness = average([headerCompleteness, buyerCompleteness, lineCompleteness]);
  const conditionalCoverage = computeConditionalCoverage(headerRecords, buyerRecords);
  const conditionalCompleteness = conditionalCoverage.completeness;
  const nullFieldRate = computeNullFieldRate([
    {
      records: headerRecords,
      fields: [
        ...MANDATORY_HEADER_FIELDS,
        'payment_due_date',
        'credit_note_reason_code',
        'credit_note_reason_text',
        'preceding_invoice_reference',
        'preceding_invoice_issue_date',
      ],
    },
    { records: buyerRecords, fields: [...MANDATORY_BUYER_FIELDS, 'buyer_trn', 'buyer_city'] },
    { records: lineRecords, fields: [...MANDATORY_LINE_FIELDS, 'vat_rate', 'vat_amount', 'tax_category_code'] },
  ]);
  const duplicateInvoiceRatio = computeDuplicateInvoiceRatio(headerRecords);
  const currencyMismatchCount = computeCurrencyMismatchCount(headerRecords);
  const invalidCodelistCount = computeInvalidCodelistCount(scopedExceptions);
  const creditNote = computeCreditNoteCoverage(headerRecords);
  const dashboardMetrics = computeDashboardMetrics({
    totalInvoicesInScope: totalInvoices,
    checkResults: scopedCheckResults,
    exceptions: scopedExceptions,
    validationExecutions: validationExecutions.filter((item) => item.direction === dataset),
  });
  const pintRuleCoverage = dashboardMetrics.rulePassRate ?? 0;
  const acceptedInvoices = dashboardMetrics.submissionReadyCount;
  const successRate = dashboardMetrics.submissionReadyRate;
  const criticalIssues =
    stats.exceptionsBySeverity.Critical ||
    scopedExceptions.filter((exception) => exception.severity === 'Critical').length;

  const readinessInputs: ScoreInput[] = [
    {
      label: 'Mandatory data',
      score: mandatoryCompleteness,
      weight: 0.35,
      summary: 'Header, buyer, and line-level mandatory business terms.',
    },
    {
      label: 'Conditional data',
      score: conditionalCompleteness,
      weight: 0.15,
      summary: 'FX, payment, and credit-note-only dependencies.',
    },
    {
      label: 'Rule conformance',
      score: pintRuleCoverage,
      weight: 0.3,
      summary: 'Executed PINT-AE rule outcomes in the current scope.',
    },
    {
      label: 'Blocker pressure',
      score: Math.max(0, 100 - Math.min(criticalIssues, 10) * 10),
      weight: 0.2,
      summary: 'Critical issues reduce submission confidence disproportionately.',
    },
  ];

  const complianceReadiness = clampScore(weightedAverage(readinessInputs));
  const goLiveInputs: ScoreInput[] = [
    {
      label: 'Compliance score',
      score: complianceReadiness,
      weight: 0.4,
      summary: 'Weighted regulatory and data readiness baseline.',
    },
    {
      label: 'Null-rate quality',
      score: Math.max(0, 100 - nullFieldRate * 4),
      weight: 0.15,
      summary: 'High null leakage reduces evidentiary confidence.',
    },
    {
      label: 'Duplicate control',
      score: Math.max(0, 100 - duplicateInvoiceRatio * 18),
      weight: 0.1,
      summary: 'Duplicate invoice keys undermine deterministic reporting.',
    },
    {
      label: 'Currency alignment',
      score: Math.max(0, 100 - (totalInvoices > 0 ? (currencyMismatchCount / totalInvoices) * 180 : 0)),
      weight: 0.1,
      summary: 'Cross-currency documents need FX and tax currency coherence.',
    },
    {
      label: 'Blocker containment',
      score: Math.max(0, 100 - Math.min(criticalIssues, 10) * 12),
      weight: 0.15,
      summary: 'Critical blockers remain the fastest route to rejection or rework.',
    },
    {
      label: 'Credit-note readiness',
      score: creditNote.count > 0 ? creditNote.coverage : 100,
      weight: 0.1,
      summary: 'Only active when 381 credit-note scenarios are in scope.',
    },
  ];
  const goLiveReadiness = clampScore(weightedAverage(goLiveInputs));

  return {
    hasLiveSignals: true,
    modeLabel: isChecksRun ? 'Live portfolio snapshot' : 'Live data loaded',
    totalInvoices,
    submissionReadyCount: dashboardMetrics.submissionReadyCount,
    submissionReadyRate: dashboardMetrics.submissionReadyRate,
    rulePassRate: pintRuleCoverage,
    totalRuleOutcomes: dashboardMetrics.totalRuleOutcomes,
    criticalBlockerOutcomes: dashboardMetrics.criticalBlockerOutcomes,
    criticalBlockerDocumentCount: dashboardMetrics.criticalBlockerDocumentCount,
    avgCriticalBlockersPerDocument: dashboardMetrics.avgCriticalBlockersPerDocument,
    acceptedInvoices,
    successRate,
    passRate: pintRuleCoverage,
    criticalIssues,
    complianceReadiness,
    goLiveReadiness,
    mandatoryCompleteness,
    conditionalCompleteness,
    conditionalFieldDocumentCount: conditionalCoverage.qualifyingDocumentCount,
    nullFieldRate,
    duplicateInvoiceRatio,
    invalidCodelistCount,
    currencyMismatchCount,
    ibtMandatoryCoverage: mandatoryCompleteness,
    pintRuleCoverage,
    creditNoteCoverage: creditNote.coverage,
    creditNoteCount: creditNote.count,
    creditNoteReasonCoverage: creditNote.reasonCoverage,
    creditNoteReasonTextCoverage: creditNote.reasonTextCoverage,
    creditNoteReferenceCoverage: creditNote.referenceCoverage,
    creditNoteIssueDateCoverage: creditNote.issueDateCoverage,
    headerCompleteness,
    buyerCompleteness,
    lineCompleteness,
    executedRuleOutcomes: dashboardMetrics.totalRuleOutcomes,
    regulatoryRegisteredControls: dashboardMetrics.regulatory.registeredControls,
    regulatoryApplicableControls: dashboardMetrics.regulatory.applicableControls,
    regulatoryEvaluatedControls: dashboardMetrics.regulatory.evaluatedControls,
    regulatoryNotApplicableControls: dashboardMetrics.regulatory.notApplicableControls,
    regulatoryNotEvaluatedControls: dashboardMetrics.regulatory.notEvaluatedControls,
    supplementaryControls: dashboardMetrics.supplementary.registeredControls,
    evaluationCoverage: dashboardMetrics.evaluationCoverage,
    exceptionsTotal: scopedExceptions.length,
    exceptionsBySeverity: {
      Critical: scopedExceptions.filter((exception) => exception.severity === 'Critical').length,
      High: scopedExceptions.filter((exception) => exception.severity === 'High').length,
      Medium: scopedExceptions.filter((exception) => exception.severity === 'Medium').length,
      Low: scopedExceptions.filter((exception) => exception.severity === 'Low').length,
    },
    blockingIssues: buildBlockingIssues(scopedExceptions),
    exceptionThemes: deriveExceptionThemes(scopedExceptions),
  };
}
