import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CircleAlert,
  CircleDashed,
  Database,
  FileCheck2,
  FileSearch,
  ReceiptText,
  ShieldAlert,
  ShieldCheck,
  Sigma,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { StatsCard } from '@/components/StatsCard';
import { SeverityBadge } from '@/components/SeverityBadge';
import { useCompliance } from '@/context/ComplianceContext';
import type { Severity } from '@/types/compliance';

type DatasetScope = 'AR' | 'AP';

type DashboardRecord = Record<string, unknown>;

interface DashboardException {
  id: string;
  checkId: string;
  checkName: string;
  severity: Severity;
  datasetType?: string;
  direction?: string;
  message: string;
}

interface DashboardCheckResult {
  checkId: string;
  checkName: string;
  passed: number;
  failed: number;
  severity: Severity;
  datasetType?: string;
  direction?: string;
}

interface MetricCard {
  title: string;
  value: string | number;
  subtitle: string;
  icon: ReactNode;
  variant: 'default' | 'success' | 'warning' | 'danger';
  helpContent: ReactNode;
}

interface CoverageMetric {
  title: string;
  value: string;
  subtitle: string;
  progress: number;
  tone: 'success' | 'warning' | 'danger';
  helpContent: ReactNode;
  supportingPoints: string[];
}

interface ExceptionBreakdownItem {
  key: string;
  label: string;
  count: number;
  severity: Severity;
  description: string;
}

interface ExceptionTheme {
  title: string;
  value: string;
  subtitle: string;
}

interface DashboardSnapshot {
  hasLiveSignals: boolean;
  modeLabel: string;
  totalInvoices: number;
  acceptedInvoices: number;
  successRate: number;
  passRate: number;
  criticalIssues: number;
  complianceReadiness: number | null;
  goLiveReadiness: number | null;
  mandatoryCompleteness: number;
  conditionalCompleteness: number;
  nullFieldRate: number;
  duplicateInvoiceRatio: number;
  invalidCodelistCount: number;
  currencyMismatchCount: number;
  ibtMandatoryCoverage: number;
  pintRuleCoverage: number;
  creditNoteCoverage: number;
  creditNoteCount: number;
  creditNoteReasonCoverage: number;
  creditNoteReferenceCoverage: number;
  headerCompleteness: number;
  buyerCompleteness: number;
  lineCompleteness: number;
  executedRuleOutcomes: number;
  exceptionsTotal: number;
  exceptionsBySeverity: Record<Severity, number>;
  blockingIssues: ExceptionBreakdownItem[];
  exceptionThemes: ExceptionTheme[];
}

interface ScoreInput {
  label: string;
  score: number;
  weight: number;
  summary: string;
}

const numberFormatter = new Intl.NumberFormat('en-US');

const MANDATORY_HEADER_FIELDS = ['invoice_id', 'invoice_number', 'issue_date', 'invoice_type', 'currency', 'buyer_id'];
const MANDATORY_BUYER_FIELDS = ['buyer_id', 'buyer_name', 'buyer_country'];
const MANDATORY_LINE_FIELDS = ['line_id', 'line_number', 'description', 'quantity', 'unit_price', 'line_total_excl_vat'];

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (valid.length === 0) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function weightedAverage(values: ScoreInput[]) {
  const totalWeight = values.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight === 0) return 0;
  return values.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight;
}

function formatNumber(value: number) {
  return numberFormatter.format(Math.max(0, Math.round(value)));
}

function toRecords(input: unknown): DashboardRecord[] {
  return Array.isArray(input) ? (input as DashboardRecord[]) : [];
}

function presentValue(value: unknown) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function computeCompleteness(records: DashboardRecord[], fields: string[]) {
  if (records.length === 0 || fields.length === 0) return 0;
  let present = 0;
  records.forEach((record) => {
    fields.forEach((field) => {
      if (presentValue(record[field])) present += 1;
    });
  });
  return (present / (records.length * fields.length)) * 100;
}

function computeNullFieldRate(groups: Array<{ records: DashboardRecord[]; fields: string[] }>) {
  let totalSlots = 0;
  let emptySlots = 0;

  groups.forEach(({ records, fields }) => {
    records.forEach((record) => {
      fields.forEach((field) => {
        totalSlots += 1;
        if (!presentValue(record[field])) emptySlots += 1;
      });
    });
  });

  if (totalSlots === 0) return 0;
  return (emptySlots / totalSlots) * 100;
}

function computeConditionalCompleteness(headers: DashboardRecord[], buyers: DashboardRecord[]) {
  const requirements: Array<{ present: boolean; expected: number }> = [];

  headers.forEach((header) => {
    const amountDue = Number(header.amount_due ?? 0);
    const currency = String(header.currency ?? '').trim().toUpperCase();
    const invoiceType = String(header.invoice_type ?? '').trim();
    const creditReason = String(header.credit_note_reason_code ?? '').trim().toUpperCase();

    if (amountDue > 0) {
      requirements.push({ present: presentValue(header.payment_due_date), expected: 1 });
    }

    if (currency && currency !== 'AED') {
      requirements.push({ present: presentValue(header.fx_rate), expected: 1 });
      requirements.push({ present: String(header.tax_currency ?? '').trim().toUpperCase() === 'AED', expected: 1 });
    }

    if (invoiceType === '381') {
      requirements.push({ present: presentValue(header.credit_note_reason_code), expected: 1 });
      if (creditReason !== 'VD') {
        requirements.push({ present: presentValue(header.preceding_invoice_reference), expected: 1 });
      }
    }
  });

  buyers.forEach((buyer) => {
    if (presentValue(buyer.buyer_name)) {
      requirements.push({ present: presentValue(buyer.buyer_trn), expected: 1 });
    }
  });

  const totalExpected = requirements.reduce((sum, item) => sum + item.expected, 0);
  const presentExpected = requirements.filter((item) => item.present).length;

  if (totalExpected === 0) return 100;
  return (presentExpected / totalExpected) * 100;
}

function computeDuplicateInvoiceRatio(headers: DashboardRecord[]) {
  if (headers.length === 0) return 0;
  const counts = new Map<string, number>();
  headers.forEach((header) => {
    const key = String(header.invoice_number ?? header.invoice_id ?? '').trim();
    if (!key) return;
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  const duplicates = Array.from(counts.values()).reduce((sum, count) => sum + (count > 1 ? count - 1 : 0), 0);
  return (duplicates / headers.length) * 100;
}

function computeCurrencyMismatchCount(headers: DashboardRecord[]) {
  return headers.filter((header) => {
    const currency = String(header.currency ?? '').trim().toUpperCase();
    const taxCurrency = String(header.tax_currency ?? '').trim().toUpperCase();
    const fxRate = Number(header.fx_rate ?? 0);

    if (!currency) return false;
    if (currency === 'AED') return taxCurrency !== '' && taxCurrency !== 'AED';
    return taxCurrency !== 'AED' || !Number.isFinite(fxRate) || fxRate <= 0;
  }).length;
}

function computeCreditNoteCoverage(headers: DashboardRecord[]) {
  const creditNotes = headers.filter((header) => String(header.invoice_type ?? '').trim() === '381');
  if (creditNotes.length === 0) {
    return { count: 0, coverage: 100, reasonCoverage: 100, referenceCoverage: 100 };
  }

  let satisfied = 0;
  let reasonPresent = 0;
  let referenceRequired = 0;
  let referencePresent = 0;

  creditNotes.forEach((header) => {
    const reason = String(header.credit_note_reason_code ?? '').trim().toUpperCase();
    const hasReason = reason !== '';
    const hasReference = presentValue(header.preceding_invoice_reference);

    if (hasReason) reasonPresent += 1;
    if (reason !== 'VD') {
      referenceRequired += 1;
      if (hasReference) referencePresent += 1;
    }

    if (hasReason && (reason === 'VD' || hasReference)) satisfied += 1;
  });

  return {
    count: creditNotes.length,
    coverage: (satisfied / creditNotes.length) * 100,
    reasonCoverage: (reasonPresent / creditNotes.length) * 100,
    referenceCoverage: referenceRequired === 0 ? 100 : (referencePresent / referenceRequired) * 100,
  };
}

function computeInvalidCodelistCount(exceptions: DashboardException[]) {
  const codelistTerms = ['codelist', 'code', 'iso3166', 'uncl', 'unece', 'currency', 'payment means'];
  return exceptions.filter((exception) => {
    const haystack = `${exception.checkName} ${exception.message} ${exception.checkId}`.toLowerCase();
    return codelistTerms.some((term) => haystack.includes(term));
  }).length;
}

function deriveExceptionThemes(exceptions: DashboardException[]) {
  const masterData = exceptions.filter((exception) => {
    const text = `${exception.checkName} ${exception.message}`.toLowerCase();
    return text.includes('seller') || text.includes('buyer') || text.includes('counterparty') || text.includes('trn');
  }).length;

  const taxData = exceptions.filter((exception) => {
    const text = `${exception.checkName} ${exception.message}`.toLowerCase();
    return text.includes('vat') || text.includes('tax') || text.includes('currency');
  }).length;

  const documentShape = Math.max(exceptions.length - masterData - taxData, 0);

  return [
    {
      title: 'Master data breaks',
      value: formatNumber(masterData),
      subtitle: 'Counterparty and registration-quality issues',
    },
    {
      title: 'Tax / currency issues',
      value: formatNumber(taxData),
      subtitle: 'VAT, codelist, and currency-control exceptions',
    },
    {
      title: 'Document structure issues',
      value: formatNumber(documentShape),
      subtitle: 'Invoice-shape, mandatory-field, and sequencing issues',
    },
  ];
}

function buildBlockingIssues(exceptions: DashboardException[]) {
  const grouped = new Map<string, ExceptionBreakdownItem>();
  const severityRank: Record<Severity, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };

  exceptions.forEach((exception) => {
    const existing = grouped.get(exception.checkId);
    if (!existing) {
      grouped.set(exception.checkId, {
        key: exception.checkId,
        label: exception.checkName,
        count: 1,
        severity: exception.severity,
        description: exception.message,
      });
      return;
    }

    existing.count += 1;
    if (severityRank[exception.severity] > severityRank[existing.severity]) {
      existing.severity = exception.severity;
    }
  });

  return Array.from(grouped.values())
    .sort((left, right) => right.count - left.count)
    .slice(0, 5);
}

function buildFallbackSnapshot(dataset: DatasetScope): DashboardSnapshot {
  const previewReadiness = dataset === 'AR' ? 91 : 87;
  return {
    hasLiveSignals: true,
    modeLabel: 'Preview portfolio snapshot',
    totalInvoices: dataset === 'AR' ? 1284 : 964,
    acceptedInvoices: dataset === 'AR' ? 1186 : 833,
    successRate: dataset === 'AR' ? 92.4 : 86.4,
    passRate: dataset === 'AR' ? 93.1 : 88.2,
    criticalIssues: dataset === 'AR' ? 7 : 9,
    complianceReadiness: previewReadiness,
    goLiveReadiness: previewReadiness - 3,
    mandatoryCompleteness: 94,
    conditionalCompleteness: 86,
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
    exceptionsTotal: dataset === 'AR' ? 46 : 53,
    exceptionsBySeverity: { Critical: dataset === 'AR' ? 7 : 9, High: 19, Medium: 14, Low: 6 },
    blockingIssues: [
      {
        key: 'UAE-UC1-CHK-012',
        label: 'Seller identity completeness',
        count: 18,
        severity: 'Critical',
        description: 'Seller registration and naming fields still create the largest readiness drag.',
      },
      {
        key: 'UAE-UC1-CHK-018',
        label: 'Buyer TRN pattern',
        count: 13,
        severity: 'High',
        description: 'Counterparty TRN formatting remains inconsistent across repeat records.',
      },
      {
        key: 'UAE-UC1-CHK-031',
        label: 'VAT amount reconciliation',
        count: 9,
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

function buildDashboardSnapshot(input: {
  dataset: DatasetScope;
  isChecksRun: boolean;
  isDataLoaded: boolean;
  stats: ReturnType<ReturnType<typeof useCompliance>['getDashboardStats']>;
  checkResults: ReturnType<typeof useCompliance>['checkResults'];
  exceptions: ReturnType<typeof useCompliance>['exceptions'];
  buyers: ReturnType<typeof useCompliance>['buyers'];
  headers: ReturnType<typeof useCompliance>['headers'];
  lines: ReturnType<typeof useCompliance>['lines'];
}): DashboardSnapshot {
  const { dataset, isChecksRun, isDataLoaded, stats, checkResults, exceptions, buyers, headers, lines } = input;

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
      acceptedInvoices: 0,
      successRate: 0,
      passRate: 0,
      criticalIssues: 0,
      complianceReadiness: null,
      goLiveReadiness: null,
      mandatoryCompleteness: 0,
      conditionalCompleteness: 0,
      nullFieldRate: 0,
      duplicateInvoiceRatio: 0,
      invalidCodelistCount: 0,
      currencyMismatchCount: 0,
      ibtMandatoryCoverage: 0,
      pintRuleCoverage: 0,
      creditNoteCoverage: 0,
      creditNoteCount: 0,
      creditNoteReasonCoverage: 0,
      creditNoteReferenceCoverage: 0,
      headerCompleteness: 0,
      buyerCompleteness: 0,
      lineCompleteness: 0,
      executedRuleOutcomes: 0,
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
  const conditionalCompleteness = computeConditionalCompleteness(headerRecords, buyerRecords);
  const nullFieldRate = computeNullFieldRate([
    { records: headerRecords, fields: [...MANDATORY_HEADER_FIELDS, 'payment_due_date', 'credit_note_reason_code', 'preceding_invoice_reference'] },
    { records: buyerRecords, fields: [...MANDATORY_BUYER_FIELDS, 'buyer_trn', 'buyer_city'] },
    { records: lineRecords, fields: [...MANDATORY_LINE_FIELDS, 'vat_rate', 'vat_amount', 'tax_category_code'] },
  ]);
  const duplicateInvoiceRatio = computeDuplicateInvoiceRatio(headerRecords);
  const currencyMismatchCount = computeCurrencyMismatchCount(headerRecords);
  const invalidCodelistCount = computeInvalidCodelistCount(scopedExceptions);
  const creditNote = computeCreditNoteCoverage(headerRecords);
  const executedRuleOutcomes = scopedCheckResults.reduce((sum, result) => sum + result.passed + result.failed, 0);
  const pintRuleCoverage =
    executedRuleOutcomes > 0
      ? (scopedCheckResults.reduce((sum, result) => sum + result.passed, 0) / executedRuleOutcomes) * 100
      : Math.max(0, stats.passRate || 0);
  const acceptedInvoices = totalInvoices > 0 ? Math.round((totalInvoices * pintRuleCoverage) / 100) : 0;
  const successRate = totalInvoices > 0 ? (acceptedInvoices / totalInvoices) * 100 : 0;
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
    acceptedInvoices,
    successRate,
    passRate: pintRuleCoverage,
    criticalIssues,
    complianceReadiness,
    goLiveReadiness,
    mandatoryCompleteness,
    conditionalCompleteness,
    nullFieldRate,
    duplicateInvoiceRatio,
    invalidCodelistCount,
    currencyMismatchCount,
    ibtMandatoryCoverage: mandatoryCompleteness,
    pintRuleCoverage,
    creditNoteCoverage: creditNote.coverage,
    creditNoteCount: creditNote.count,
    creditNoteReasonCoverage: creditNote.reasonCoverage,
    creditNoteReferenceCoverage: creditNote.referenceCoverage,
    headerCompleteness,
    buyerCompleteness,
    lineCompleteness,
    executedRuleOutcomes,
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

function formatPercent(value: number | null, digits = 0) {
  if (value === null) return 'N/A';
  return `${value.toFixed(digits)}%`;
}

function progressTone(value: number) {
  if (value >= 90) return 'success';
  if (value >= 75) return 'warning';
  return 'danger';
}

function readinessBand(score: number | null) {
  if (score === null) return { label: 'Awaiting data', tone: 'default' as const };
  if (score >= 90) return { label: 'Ready', tone: 'success' as const };
  if (score >= 75) return { label: 'Watch', tone: 'warning' as const };
  return { label: 'Blocked', tone: 'danger' as const };
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const {
    isChecksRun,
    isDataLoaded,
    isRunning,
    activeDatasetType,
    setActiveDatasetType,
    getDashboardStats,
    checkResults,
    exceptions,
    buyers,
    headers,
    lines,
  } = useCompliance();

  const stats = getDashboardStats();

  const snapshot = useMemo(
    () =>
      buildDashboardSnapshot({
        dataset: activeDatasetType,
        isChecksRun,
        isDataLoaded,
        stats,
        checkResults,
        exceptions,
        buyers,
        headers,
        lines,
      }),
    [activeDatasetType, buyers, checkResults, exceptions, headers, isChecksRun, isDataLoaded, lines, stats]
  );

  const readinessInputs = useMemo<ScoreInput[]>(() => {
    if (!snapshot.hasLiveSignals || snapshot.complianceReadiness === null) return [];

    return [
      {
        label: 'Mandatory data',
        score: snapshot.mandatoryCompleteness,
        weight: 0.35,
        summary: 'Header, buyer, and line mandatory field presence.',
      },
      {
        label: 'Conditional data',
        score: snapshot.conditionalCompleteness,
        weight: 0.15,
        summary: 'Scenario-driven dependencies including FX and credit notes.',
      },
      {
        label: 'Rule conformance',
        score: snapshot.pintRuleCoverage,
        weight: 0.3,
        summary: 'Executed PINT-AE rule outcomes for the active scope.',
      },
      {
        label: 'Critical blockers',
        score: Math.max(0, 100 - Math.min(snapshot.criticalIssues, 10) * 10),
        weight: 0.2,
        summary: 'Critical issues depress readiness fastest.',
      },
    ];
  }, [snapshot]);

  const goLiveBand = readinessBand(snapshot.goLiveReadiness);

  const supportExecutiveMetrics: MetricCard[] = [
    {
      title: 'Compliance Readiness',
      value: formatPercent(snapshot.complianceReadiness),
      subtitle:
        snapshot.complianceReadiness === null
          ? 'Awaiting live validation signals'
          : `${snapshot.modeLabel} - weighted data and rule readiness`,
      icon: <ShieldCheck className="h-5 w-5" />,
      variant: snapshot.complianceReadiness === null ? 'default' : progressTone(snapshot.complianceReadiness),
      helpContent: (
        <MetricHelpContent
          summary="A weighted control score showing whether the current data set is structurally and regulatorily ready to be validated with confidence."
          formula="35% mandatory completeness + 15% conditional completeness + 30% PINT-AE conformance + 20% blocker pressure."
          threshold="Target 90%+ for a stable go-live posture."
          sourceFields="InvoiceHeader, Buyer, and InvoiceLine fields plus validation outcomes."
        />
      ),
    },
    {
      title: 'Invoice Success Rate',
      value: `${formatNumber(snapshot.acceptedInvoices)}/${formatNumber(snapshot.totalInvoices)}`,
      subtitle: `${formatPercent(snapshot.successRate, 1)} accepted/submitted in current scope`,
      icon: <BadgeCheck className="h-5 w-5" />,
      variant: snapshot.successRate >= 90 ? 'success' : snapshot.successRate >= 75 ? 'warning' : 'danger',
      helpContent: (
        <MetricHelpContent
          summary="Internal validation success ratio for invoices in the active dashboard scope."
          formula="Accepted invoice count divided by total invoices in scope."
          threshold="Investigate below 95% for production-readiness discussions."
          sourceFields="Derived from current rule pass outcomes and invoice totals."
        />
      ),
    },
    {
      title: 'PINT-AE Conformance',
      value: formatPercent(snapshot.pintRuleCoverage),
      subtitle:
        snapshot.executedRuleOutcomes > 0
          ? `${formatNumber(snapshot.executedRuleOutcomes)} rule outcomes executed`
          : 'Awaiting executed validation outcomes',
      icon: <FileCheck2 className="h-5 w-5" />,
      variant: progressTone(snapshot.pintRuleCoverage),
      helpContent: (
        <MetricHelpContent
          summary="Conformance rate across currently executed PINT-AE rule outcomes in the selected portfolio scope."
          formula="Passed rule outcomes divided by all executed rule outcomes."
          threshold="Target 98%+ before treating the portfolio as regulator-ready."
          sourceFields="Validation engine results filtered to the active dataset direction."
        />
      ),
    },
    {
      title: 'Critical Blocking Issues',
      value: formatNumber(snapshot.criticalIssues),
      subtitle: 'Immediate remediation required before reliable submission',
      icon: <ShieldAlert className="h-5 w-5" />,
      variant: snapshot.criticalIssues > 0 ? 'danger' : 'success',
      helpContent: (
        <MetricHelpContent
          summary="Critical exceptions that are most likely to stop, delay, or materially weaken a submission."
          formula="Count of open Critical severity exceptions in the active scope."
          threshold="The target state is zero open critical blockers."
          sourceFields="Exception queue records linked to validation findings."
        />
      ),
    },
  ];

  const dataQualityMetrics: MetricCard[] = [
    {
      title: 'Mandatory Field Completeness',
      value: formatPercent(snapshot.mandatoryCompleteness),
      subtitle: 'Coverage across core header, party, and invoice-line requirements',
      icon: <Database className="h-5 w-5" />,
      variant: progressTone(snapshot.mandatoryCompleteness),
      helpContent: (
        <MetricHelpContent
          summary="How fully the uploaded source data populates mandatory terms needed to build compliant UAE/PINT-AE invoices."
          formula="Average completeness across mandatory header, buyer, and line fields."
          threshold="Below 95% usually signals upstream extraction or master-data gaps."
          sourceFields="InvoiceHeader, Buyer, and InvoiceLine mandatory fields."
        />
      ),
    },
    {
      title: 'Conditional Field Completeness',
      value: formatPercent(snapshot.conditionalCompleteness),
      subtitle: 'FX, payment, and credit-note-only dependencies in scope',
      icon: <FileSearch className="h-5 w-5" />,
      variant: progressTone(snapshot.conditionalCompleteness),
      helpContent: (
        <MetricHelpContent
          summary="Measures fields that become mandatory only in specific invoice scenarios."
          formula="Satisfied conditional requirements divided by all triggered conditional requirements."
          threshold="A sharp drop usually points to FX invoices, credit notes, or missing payment terms."
          sourceFields="Triggered fields such as fx_rate, tax_currency, payment_due_date, and credit-note references."
        />
      ),
    },
    {
      title: 'Null Field Rate',
      value: formatPercent(snapshot.nullFieldRate, 1),
      subtitle: 'Lower is better across governed quality fields',
      icon: <CircleAlert className="h-5 w-5" />,
      variant: snapshot.nullFieldRate <= 2 ? 'success' : snapshot.nullFieldRate <= 5 ? 'warning' : 'danger',
      helpContent: (
        <MetricHelpContent
          summary="A defect-rate lens showing how much governed data is still blank."
          formula="Empty governed field slots divided by all governed field slots evaluated."
          threshold="Target below 2% for a well-controlled invoice portfolio."
          sourceFields="Mandatory and scenario-sensitive fields across headers, buyers, and lines."
        />
      ),
    },
    {
      title: 'Duplicate Invoice Ratio',
      value: formatPercent(snapshot.duplicateInvoiceRatio, 1),
      subtitle: 'Duplicate invoice-number incidence in the active scope',
      icon: <ReceiptText className="h-5 w-5" />,
      variant: snapshot.duplicateInvoiceRatio <= 1 ? 'success' : snapshot.duplicateInvoiceRatio <= 3 ? 'warning' : 'danger',
      helpContent: (
        <MetricHelpContent
          summary="Shows whether invoice identifiers are stable enough for deterministic reporting and traceability."
          formula="Duplicate invoice records divided by total invoice headers in scope."
          threshold="Target below 1%, with zero preferred for final submission sets."
          sourceFields="invoice_number and invoice_id across the uploaded invoice header set."
        />
      ),
    },
    {
      title: 'Invalid Codelist',
      value: formatNumber(snapshot.invalidCodelistCount),
      subtitle: 'Open codelist and enumerated-value exceptions',
      icon: <AlertTriangle className="h-5 w-5" />,
      variant: snapshot.invalidCodelistCount === 0 ? 'success' : snapshot.invalidCodelistCount <= 5 ? 'warning' : 'danger',
      helpContent: (
        <MetricHelpContent
          summary="Counts open exceptions tied to ISO, UNCL, or other enumerated-value obligations."
          formula="Number of open exceptions matching codelist-oriented checks or messages."
          threshold="The target state is zero because codelist defects are avoidable data governance errors."
          sourceFields="Exception messages and check identifiers related to codelist validation."
        />
      ),
    },
    {
      title: 'Currency Mismatches',
      value: formatNumber(snapshot.currencyMismatchCount),
      subtitle: 'Tax currency and FX logic conflicts in invoice data',
      icon: <Sigma className="h-5 w-5" />,
      variant: snapshot.currencyMismatchCount === 0 ? 'success' : snapshot.currencyMismatchCount <= 3 ? 'warning' : 'danger',
      helpContent: (
        <MetricHelpContent
          summary="Flags invoices where currency, tax currency, or FX-rate behavior does not align with UAE expectations."
          formula="Count of headers with mismatched currency/tax_currency logic or missing positive fx_rate."
          threshold="The target state is zero for controlled foreign-currency invoice flows."
          sourceFields="currency, tax_currency, and fx_rate fields on invoice headers."
        />
      ),
    },
  ];

  const uaeCoverageMetrics: CoverageMetric[] = [
    {
      title: 'IBT Mandatory Fields',
      value: formatPercent(snapshot.ibtMandatoryCoverage),
      subtitle: 'Business-term coverage across the invoice structure expected in the uploaded scope',
      progress: snapshot.ibtMandatoryCoverage,
      tone: progressTone(snapshot.ibtMandatoryCoverage),
      supportingPoints: [
        `Header completeness ${formatPercent(snapshot.headerCompleteness)}`,
        `Buyer completeness ${formatPercent(snapshot.buyerCompleteness)}`,
        `Line completeness ${formatPercent(snapshot.lineCompleteness)}`,
      ],
      helpContent: (
        <MetricHelpContent
          summary="Measures whether the source data can populate the mandatory invoice business terms required by the UAE PINT-AE structure."
          formula="Average completeness across mandatory invoice header, buyer, and invoice-line term groups."
          threshold="Below 95% indicates structural source-data gaps before rule execution even begins."
          sourceFields="Mandatory IBT-aligned fields mapped from InvoiceHeader, Buyer, and InvoiceLine."
        />
      ),
    },
    {
      title: 'PINT-AE Rules',
      value: formatPercent(snapshot.pintRuleCoverage),
      subtitle: 'Executed rule coverage and pass performance for the active dashboard scope',
      progress: snapshot.pintRuleCoverage,
      tone: progressTone(snapshot.pintRuleCoverage),
      supportingPoints: [
        `${formatNumber(snapshot.executedRuleOutcomes)} rule outcomes executed`,
        `${formatPercent(snapshot.passRate)} pass rate in current scope`,
        `${formatNumber(snapshot.criticalIssues)} critical issues still blocking`,
      ],
      helpContent: (
        <MetricHelpContent
          summary="A regulator-facing view of current PINT-AE business rule performance."
          formula="Passed executed rule outcomes divided by all executed rule outcomes."
          threshold="Target 98%+ with no critical blocker concentration."
          sourceFields="Current validation run outcomes filtered to the active dataset direction."
        />
      ),
    },
    {
      title: 'Credit-Note Scenarios',
      value: snapshot.creditNoteCount === 0 ? 'Not in scope' : formatPercent(snapshot.creditNoteCoverage),
      subtitle:
        snapshot.creditNoteCount === 0
          ? 'No 381 credit-note documents are currently represented in the selected portfolio.'
          : `${formatNumber(snapshot.creditNoteCount)} credit-note document(s) evaluated`,
      progress: snapshot.creditNoteCount === 0 ? 0 : snapshot.creditNoteCoverage,
      tone: snapshot.creditNoteCount === 0 ? 'warning' : progressTone(snapshot.creditNoteCoverage),
      supportingPoints:
        snapshot.creditNoteCount === 0
          ? ['Upload a 381 population to validate scenario readiness explicitly.']
          : [
              `Reason-code completeness ${formatPercent(snapshot.creditNoteReasonCoverage)}`,
              `Preceding reference completeness ${formatPercent(snapshot.creditNoteReferenceCoverage)}`,
              `Overall scenario coverage ${formatPercent(snapshot.creditNoteCoverage)}`,
            ],
      helpContent: (
        <MetricHelpContent
          summary="Shows whether credit-note-specific fields needed for UAE/PINT-AE 381 flows are actually present and usable."
          formula="Credit-note scenarios meeting reason-code and required preceding reference obligations divided by all credit-note invoices."
          threshold="Do not treat missing credit-note scope as a pass; it only means the scenario has not yet been proven."
          sourceFields="invoice_type, credit_note_reason_code, and preceding_invoice_reference on invoice headers."
        />
      ),
    },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <section className="surface-glass rounded-[28px] border border-border/70 p-4 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.24)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-xl border border-border/70 bg-background/80 p-1">
              <Button
                size="sm"
                variant={activeDatasetType === 'AR' ? 'default' : 'ghost'}
                onClick={() => setActiveDatasetType('AR')}
                className="h-8 rounded-lg px-3 text-xs"
              >
                AR / Outbound
              </Button>
              <Button
                size="sm"
                variant={activeDatasetType === 'AP' ? 'default' : 'ghost'}
                onClick={() => setActiveDatasetType('AP')}
                className="h-8 rounded-lg px-3 text-xs"
              >
                AP / Inbound
              </Button>
            </div>
            <Badge variant="outline" className="border-border/70 bg-background/70 text-muted-foreground">
              {snapshot.modeLabel}
            </Badge>
            <Badge
              variant="outline"
              className={
                isRunning
                  ? 'border-primary/25 bg-primary/10 text-primary'
                  : snapshot.criticalIssues > 0
                    ? 'border-severity-medium/25 bg-severity-medium/10 text-severity-medium'
                    : 'border-success/25 bg-success/10 text-success'
              }
            >
              {isRunning ? 'Validation running' : snapshot.criticalIssues > 0 ? 'Executive attention required' : 'Executive ready'}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => navigate('/validation')}>
              Open Validation
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button className="rounded-full" onClick={() => navigate('/exceptions')}>
              Review Exceptions
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      <DashboardSection
        eyebrow="Executive compliance KPIs"
        title="Executive compliance view"
        description="A leadership-level summary of readiness, conformance, blocking issues, and deployment confidence for the active invoice portfolio."
      >
        {snapshot.hasLiveSignals ? (
          <div className="space-y-4">
            <Card className="overflow-hidden rounded-[24px] border-border/70 bg-card/95 shadow-[0_18px_36px_-28px_rgba(15,23,42,0.24)]">
              <CardContent className="p-6">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="max-w-3xl space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          goLiveBand.tone === 'success'
                            ? 'border-success/25 bg-success/10 text-success'
                            : goLiveBand.tone === 'warning'
                              ? 'border-severity-medium/25 bg-severity-medium/10 text-severity-medium'
                              : goLiveBand.tone === 'danger'
                                ? 'border-severity-critical/25 bg-severity-critical/10 text-severity-critical'
                                : 'border-border/70 bg-background/75 text-muted-foreground'
                        }
                      >
                        {goLiveBand.label}
                      </Badge>
                      <MetricTooltip
                        title="Go-Live Readiness"
                        content={
                          <MetricHelpContent
                            summary="Primary executive readiness signal estimating whether the current portfolio can move toward controlled production use."
                            formula="40% compliance score + 15% null-rate quality + 10% duplicate control + 10% currency alignment + 15% blocker containment + 10% credit-note readiness."
                            threshold="90%+ indicates strong readiness; 75% to 89% warrants controlled remediation; below 75% remains blocked."
                            sourceFields="Blended from quality KPIs, validation results, exception pressure, and scenario coverage."
                          />
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Go-Live Readiness
                      </p>
                      <h3 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                        {formatPercent(snapshot.goLiveReadiness)}
                      </h3>
                      <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                        This weighted score shows whether the current data set looks safe enough to continue toward UAE e-invoicing go-live. It balances rule conformance, mandatory data quality, blocker pressure, and scenario readiness rather than relying on a single pass metric.
                      </p>
                    </div>
                  </div>

                  <div className="min-w-[240px] rounded-2xl border border-border/70 bg-background/70 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Portfolio Scope
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                      <div>
                        <p className="text-xs text-muted-foreground">Invoices in scope</p>
                        <p className="text-xl font-semibold text-foreground">{formatNumber(snapshot.totalInvoices)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Validation outcomes</p>
                        <p className="text-xl font-semibold text-foreground">{formatNumber(snapshot.executedRuleOutcomes)}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5">
                  <Progress
                    value={snapshot.goLiveReadiness ?? 0}
                    className={
                      goLiveBand.tone === 'success'
                        ? 'h-2.5'
                        : goLiveBand.tone === 'warning'
                          ? 'h-2.5 [&>div]:bg-severity-medium'
                          : 'h-2.5 [&>div]:bg-severity-critical'
                    }
                  />
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {readinessInputs.map((input) => (
                    <div key={input.label} className="rounded-2xl border border-border/70 bg-background/75 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-foreground">{input.label}</p>
                        <Badge variant="outline" className="border-border/70 bg-background/80 text-[11px] text-muted-foreground">
                          {Math.round(input.weight * 100)}%
                        </Badge>
                      </div>
                      <p className="mt-3 text-2xl font-semibold text-foreground">{formatPercent(input.score)}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{input.summary}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {supportExecutiveMetrics.map((metric) => (
                <StatsCard
                  key={metric.title}
                  title={metric.title}
                  value={metric.value}
                  subtitle={metric.subtitle}
                  icon={metric.icon}
                  variant={metric.variant}
                  helpContent={metric.helpContent}
                  className="rounded-[24px] border-border/70 bg-card/94 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.22)]"
                />
              ))}
            </div>
          </div>
        ) : (
          <DashboardEmptyState
            title="No validated invoice portfolio is in scope yet"
            description="Load invoice data first, then run the validation workflow to populate readiness scores, success rates, and UAE coverage widgets."
            primaryAction={{ label: 'Upload dataset', onClick: () => navigate('/upload') }}
            secondaryAction={{ label: 'Open submissions workspace', onClick: () => navigate('/submissions') }}
          />
        )}
      </DashboardSection>

      <DashboardSection
        eyebrow="Data quality KPIs"
        title="Source-data quality and integrity"
        description="Profile mandatory and conditional completeness, structural defects, and quality leakage that will undermine submission readiness."
      >
        {snapshot.hasLiveSignals ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            {dataQualityMetrics.map((metric) => (
              <StatsCard
                key={metric.title}
                title={metric.title}
                value={metric.value}
                subtitle={metric.subtitle}
                icon={metric.icon}
                variant={metric.variant}
                helpContent={metric.helpContent}
                className="rounded-[24px] border-border/70 bg-card/94 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.22)]"
              />
            ))}
          </div>
        ) : (
          <DashboardEmptyState
            title="Data quality KPIs appear after dataset intake"
            description="Once invoice data is loaded and checks have run, this section will quantify completeness, null leakage, duplicate ratios, and other operational data defects."
          />
        )}
      </DashboardSection>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <DashboardSection
          eyebrow="UAE-specific compliance coverage"
          title="Coverage against UAE and PINT-AE obligations"
          description="Track the most important UAE e-invoicing coverage lenses separately so readiness discussions stay grounded in regulator-facing concepts."
        >
          {snapshot.hasLiveSignals ? (
            <div className="grid gap-4 md:grid-cols-3">
              {uaeCoverageMetrics.map((metric) => (
                <CoverageWidget key={metric.title} metric={metric} />
              ))}
            </div>
          ) : (
            <DashboardEmptyState
              title="UAE coverage widgets are waiting for validated documents"
              description="The IBT, PINT-AE, and credit-note widgets are only meaningful after invoice scope is loaded and validation has classified the portfolio."
            />
          )}
        </DashboardSection>

        <DashboardSection
          eyebrow="Exceptions"
          title="Exception breakdown and remediation focus"
          description="Move beyond a simple queue count by showing severity posture, recurring blockers, and where remediation effort is clustering."
        >
          {snapshot.hasLiveSignals ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {(Object.entries(snapshot.exceptionsBySeverity) as Array<[Severity, number]>).map(([severity, count]) => (
                  <div
                    key={severity}
                    className="rounded-2xl border border-border/70 bg-background/75 p-4 shadow-[0_10px_20px_-18px_rgba(15,23,42,0.18)]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{severity}</p>
                        <p className="mt-2 text-2xl font-semibold text-foreground">{formatNumber(count)}</p>
                      </div>
                      <SeverityBadge severity={severity} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-2xl border border-border/70 bg-background/75 p-4 shadow-[0_10px_20px_-18px_rgba(15,23,42,0.18)]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Top blocking issues</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Ranked by recurring occurrence in the current dashboard scope.
                      </p>
                    </div>
                    <Badge variant="outline" className="border-border/70 bg-background/70 text-muted-foreground">
                      {formatNumber(snapshot.exceptionsTotal)} open exceptions
                    </Badge>
                  </div>

                  <div className="mt-4 space-y-3">
                    {snapshot.blockingIssues.length > 0 ? (
                      snapshot.blockingIssues.map((issue, index) => (
                        <div key={issue.key} className="rounded-2xl border border-border/70 bg-card/90 p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-border/70 bg-background px-2 text-[11px] font-semibold text-muted-foreground">
                              {index + 1}
                            </span>
                            <p className="text-sm font-semibold text-foreground">{issue.label}</p>
                            <SeverityBadge severity={issue.severity} />
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-3">
                            <p className="text-sm leading-6 text-muted-foreground">{issue.description}</p>
                            <div className="shrink-0 rounded-xl border border-border/70 bg-background px-3 py-2 text-right">
                              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Count</p>
                              <p className="text-lg font-semibold text-foreground">{issue.count}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-border/70 bg-card/90 p-4 text-sm text-muted-foreground">
                        No open exception clusters are currently surfaced for this live portfolio view.
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  {snapshot.exceptionThemes.map((theme) => (
                    <div
                      key={theme.title}
                      className="rounded-2xl border border-border/70 bg-background/75 p-4 shadow-[0_10px_20px_-18px_rgba(15,23,42,0.18)]"
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{theme.title}</p>
                      <p className="mt-2 text-2xl font-semibold text-foreground">{theme.value}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{theme.subtitle}</p>
                    </div>
                  ))}

                  <div className="rounded-2xl border border-primary/15 bg-primary/8 p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-primary" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">Operational interpretation</p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          Use the severity mix to prioritise blocking fixes, and use the clustered issue list to focus remediation on the few checks driving most portfolio disruption.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <DashboardEmptyState
              title="Exceptions will appear after checks run"
              description="The exception board becomes active once validation findings exist for the current portfolio."
            />
          )}
        </DashboardSection>
      </section>
    </div>
  );
}

function DashboardSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="surface-glass rounded-[28px] border border-border/70 p-5 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.24)]">
      <div className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{eyebrow}</p>
        <h2 className="mt-1 text-xl font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function DashboardEmptyState({
  title,
  description,
  primaryAction,
  secondaryAction,
}: {
  title: string;
  description: string;
  primaryAction?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
}) {
  return (
    <div className="rounded-[24px] border border-dashed border-border/80 bg-background/70 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl border border-border/70 bg-background p-3">
            <CircleDashed className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
        </div>
        {(primaryAction || secondaryAction) && (
          <div className="flex flex-wrap gap-2">
            {secondaryAction ? (
              <Button variant="outline" className="rounded-full" onClick={secondaryAction.onClick}>
                {secondaryAction.label}
              </Button>
            ) : null}
            {primaryAction ? (
              <Button className="rounded-full" onClick={primaryAction.onClick}>
                {primaryAction.label}
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function CoverageWidget({ metric }: { metric: CoverageMetric }) {
  return (
    <Card className="rounded-[24px] border-border/70 bg-card/94 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.22)]">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{metric.title}</CardTitle>
            <CardDescription className="mt-1">{metric.subtitle}</CardDescription>
          </div>
          <MetricTooltip title={metric.title} content={metric.helpContent} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-3xl font-bold text-foreground">{metric.value}</div>
        <Progress
          value={metric.progress}
          className={
            metric.tone === 'success'
              ? 'h-2.5'
              : metric.tone === 'warning'
                ? 'h-2.5 [&>div]:bg-severity-medium'
                : 'h-2.5 [&>div]:bg-severity-critical'
          }
        />
        <div className="space-y-2">
          {metric.supportingPoints.map((point) => (
            <div key={point} className="rounded-xl border border-border/70 bg-background/75 px-3 py-2 text-xs leading-5 text-muted-foreground">
              {point}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function MetricHelpContent({
  summary,
  formula,
  threshold,
  sourceFields,
}: {
  summary: string;
  formula: string;
  threshold: string;
  sourceFields: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm leading-6 text-popover-foreground">{summary}</p>
      <div className="space-y-2 text-xs leading-5 text-muted-foreground">
        <p>
          <span className="font-semibold text-popover-foreground">Formula:</span> {formula}
        </p>
        <p>
          <span className="font-semibold text-popover-foreground">Threshold:</span> {threshold}
        </p>
        <p>
          <span className="font-semibold text-popover-foreground">Source:</span> {sourceFields}
        </p>
      </div>
    </div>
  );
}

function MetricTooltip({ title, content }: { title: string; content: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`About ${title}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/70 bg-background/70 text-muted-foreground transition-colors hover:text-foreground"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-[340px]">
        {content}
      </TooltipContent>
    </Tooltip>
  );
}
