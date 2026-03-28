import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileCheck2,
  FileText,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { PipelineProgress, type PipelineState, type PipelineStep } from '@/components/dashboard/PipelineProgress';
import { StatsCard } from '@/components/StatsCard';
import { SeverityBadge } from '@/components/SeverityBadge';
import { useCompliance } from '@/context/ComplianceContext';

type DatasetScope = 'AR' | 'AP';

interface ExecutiveMetric {
  title: string;
  value: string | number;
  subtitle: string;
  icon: JSX.Element;
  variant: 'default' | 'success' | 'warning' | 'danger';
}

interface FunnelStage {
  id: string;
  label: string;
  count: number;
  share: number;
  note: string;
}

interface HeatmapCell {
  score: number;
  label: string;
}

interface HeatmapRow {
  label: string;
  cells: HeatmapCell[];
}

interface RecurringIssue {
  checkId: string;
  name: string;
  count: number;
  severity: string;
  detail: string;
}

interface ReadinessDriver {
  label: string;
  score: number;
  hint: string;
}

interface ExecutiveSnapshot {
  totalInvoices: number;
  readinessScore: number;
  passed: number;
  failed: number;
  criticalIssues: number;
  modeLabel: string;
  recurringIssues: RecurringIssue[];
  funnelStages: FunnelStage[];
  heatmapColumns: string[];
  heatmapRows: HeatmapRow[];
  readinessDrivers: ReadinessDriver[];
}

interface ExecutiveKpiSnapshot {
  totalInvoices: number;
  readinessScore: number | null;
  passed: number;
  failed: number;
  criticalIssues: number;
  modeLabel: string;
}

interface CoverageScores {
  header: number;
  supplier: number;
  buyer: number;
  tax: number;
  lines: number;
  average: number;
}

const numberFormatter = new Intl.NumberFormat('en-US');

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (valid.length === 0) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function computeCoverage(records: Record<string, unknown>[], fields: string[]) {
  if (records.length === 0 || fields.length === 0) return 0;

  let present = 0;
  records.forEach((record) => {
    fields.forEach((field) => {
      const value = record[field];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        present += 1;
      }
    });
  });

  return (present / (records.length * fields.length)) * 100;
}

function getHeatClasses(score: number) {
  if (score >= 90) return 'border-success/25 bg-success/12 text-success';
  if (score >= 75) return 'border-primary/20 bg-primary/10 text-primary';
  if (score >= 60) return 'border-severity-medium/25 bg-severity-medium/12 text-severity-medium';
  return 'border-severity-critical/25 bg-severity-critical/12 text-severity-critical';
}

function getScoreNarrative(score: number) {
  if (score >= 90) return 'Strong';
  if (score >= 75) return 'Stable';
  if (score >= 60) return 'Watch';
  return 'At risk';
}

function formatNumber(value: number) {
  return numberFormatter.format(Math.max(0, Math.round(value)));
}

function buildFallbackSnapshot(dataset: DatasetScope): ExecutiveSnapshot {
  const totalInvoices = dataset === 'AR' ? 1284 : 964;
  const readinessScore = dataset === 'AR' ? 92 : 88;
  const passed = dataset === 'AR' ? 3486 : 2694;
  const failed = dataset === 'AR' ? 112 : 94;
  const criticalIssues = dataset === 'AR' ? 7 : 9;

  return {
    totalInvoices,
    readinessScore,
    passed,
    failed,
    criticalIssues,
    modeLabel: 'Preview metrics',
    recurringIssues: [
      {
        checkId: 'UAE-UC1-CHK-012',
        name: 'Seller name completeness',
        count: 28,
        severity: 'Critical',
        detail: 'Counterparty master data still drives the majority of avoidable validation failures.',
      },
      {
        checkId: 'UAE-UC1-CHK-018',
        name: 'Buyer TRN pattern',
        count: 19,
        severity: 'High',
        detail: 'Inbound datasets still contain malformed buyer registration values across repeat suppliers.',
      },
      {
        checkId: 'UAE-UC1-CHK-027',
        name: 'VAT reconciliation drift',
        count: 14,
        severity: 'High',
        detail: 'Tax calculation mismatches cluster around manually adjusted commercial invoices.',
      },
      {
        checkId: 'UAE-UC1-CHK-047',
        name: 'Payment due date policy',
        count: 11,
        severity: 'Medium',
        detail: 'Term-related failures appear mainly on invoices generated from legacy ERP templates.',
      },
    ],
    funnelStages: [
      { id: 'ingest', label: 'Ingested', count: totalInvoices, share: 100, note: 'Datasets received' },
      { id: 'mapped', label: 'Mapped', count: Math.round(totalInvoices * 0.96), share: 96, note: 'Schema aligned' },
      { id: 'validated', label: 'Validated', count: Math.round(totalInvoices * 0.92), share: 92, note: 'Rules executed' },
      { id: 'passed', label: 'Passed', count: Math.round(totalInvoices * 0.88), share: 88, note: 'Submission ready' },
      { id: 'evidence', label: 'Evidence', count: Math.round(totalInvoices * 0.84), share: 84, note: 'Audit-ready output' },
    ],
    heatmapColumns: ['Capture', 'Mapping', 'Validation', 'Evidence'],
    heatmapRows: [
      {
        label: 'Dataset controls',
        cells: [
          { score: 95, label: 'Strong' },
          { score: 91, label: 'Strong' },
          { score: 86, label: 'Stable' },
          { score: 82, label: 'Stable' },
        ],
      },
      {
        label: 'Counterparty controls',
        cells: [
          { score: 84, label: 'Stable' },
          { score: 81, label: 'Stable' },
          { score: 69, label: 'Watch' },
          { score: 74, label: 'Watch' },
        ],
      },
      {
        label: 'Tax controls',
        cells: [
          { score: 79, label: 'Stable' },
          { score: 76, label: 'Stable' },
          { score: 64, label: 'Watch' },
          { score: 71, label: 'Watch' },
        ],
      },
      {
        label: 'Workflow controls',
        cells: [
          { score: 88, label: 'Stable' },
          { score: 83, label: 'Stable' },
          { score: 78, label: 'Stable' },
          { score: 73, label: 'Watch' },
        ],
      },
    ],
    readinessDrivers: [
      { label: 'Header completeness', score: 94, hint: 'Core document identity and numbering fields.' },
      { label: 'Counterparty quality', score: 78, hint: 'Master data remains the primary source of recurring breaks.' },
      { label: 'Tax fidelity', score: 72, hint: 'Calculation logic is stable, but manual overrides still surface.' },
      { label: 'Operational readiness', score: 88, hint: 'Workflow execution is stable enough for demo and review.' },
    ],
  };
}

function buildExecutiveKpiSnapshot(input: {
  dataset: DatasetScope;
  isChecksRun: boolean;
  isDataLoaded: boolean;
  stats: ReturnType<ReturnType<typeof useCompliance>['getDashboardStats']>;
  checkResults: ReturnType<typeof useCompliance>['checkResults'];
  exceptions: ReturnType<typeof useCompliance>['exceptions'];
  headers: ReturnType<typeof useCompliance>['headers'];
}): ExecutiveKpiSnapshot {
  const { dataset, isChecksRun, isDataLoaded, stats, checkResults, exceptions, headers } = input;

  const scopedExceptions = exceptions.filter(
    (exception) => (exception.datasetType || exception.direction || dataset) === dataset
  );
  const scopedCheckResults = checkResults.filter(
    (result) =>
      (((result as { datasetType?: string; direction?: string }).datasetType ||
        (result as { datasetType?: string; direction?: string }).direction ||
        dataset) === dataset)
  );

  const hasLiveSignals =
    isDataLoaded ||
    isChecksRun ||
    stats.totalInvoices > 0 ||
    scopedExceptions.length > 0 ||
    scopedCheckResults.length > 0;

  if (!hasLiveSignals) {
    return {
      totalInvoices: 0,
      readinessScore: null,
      passed: 0,
      failed: 0,
      criticalIssues: 0,
      modeLabel: 'No live data loaded',
    };
  }

  return {
    totalInvoices: stats.totalInvoices || headers.length,
    readinessScore: null,
    passed: scopedCheckResults.reduce((sum, result) => sum + result.passed, 0),
    failed: scopedCheckResults.reduce((sum, result) => sum + result.failed, 0),
    criticalIssues:
      stats.exceptionsBySeverity.Critical ||
      scopedExceptions.filter((exception) => exception.severity === 'Critical').length,
    modeLabel: isChecksRun ? 'Live portfolio snapshot' : 'Live data loaded',
  };
}

function buildExecutiveSnapshot(input: {
  dataset: DatasetScope;
  isChecksRun: boolean;
  isDataLoaded: boolean;
  stats: ReturnType<ReturnType<typeof useCompliance>['getDashboardStats']>;
  checkResults: ReturnType<typeof useCompliance>['checkResults'];
  exceptions: ReturnType<typeof useCompliance>['exceptions'];
  headers: ReturnType<typeof useCompliance>['headers'];
  buyers: ReturnType<typeof useCompliance>['buyers'];
  lines: ReturnType<typeof useCompliance>['lines'];
}): ExecutiveSnapshot {
  const { dataset, isChecksRun, isDataLoaded, stats, checkResults, exceptions, headers, buyers, lines } = input;

  const scopedExceptions = exceptions.filter(
    (exception) => (exception.datasetType || exception.direction || dataset) === dataset
  );
  const scopedCheckResults = checkResults.filter(
    (result) =>
      (((result as { datasetType?: string; direction?: string }).datasetType ||
        (result as { datasetType?: string; direction?: string }).direction ||
        dataset) === dataset)
  );

  const coverageScores: CoverageScores = {
    header: computeCoverage(headers as unknown as Record<string, unknown>[], [
      'invoice_id',
      'invoice_number',
      'issue_date',
      'currency',
      'invoice_type',
    ]),
    supplier: computeCoverage(headers as unknown as Record<string, unknown>[], [
      'seller_trn',
      'seller_name',
      'seller_country',
      'seller_address',
    ]),
    buyer: computeCoverage(buyers as unknown as Record<string, unknown>[], [
      'buyer_id',
      'buyer_name',
      'buyer_country',
      'buyer_trn',
    ]),
    tax: average([
      computeCoverage(headers as unknown as Record<string, unknown>[], [
        'total_excl_vat',
        'vat_total',
        'total_incl_vat',
        'tax_category_code',
      ]),
      computeCoverage(lines as unknown as Record<string, unknown>[], [
        'vat_rate',
        'vat_amount',
        'tax_category_code',
      ]),
    ]),
    lines: computeCoverage(lines as unknown as Record<string, unknown>[], [
      'line_id',
      'line_number',
      'quantity',
      'unit_price',
      'line_total_excl_vat',
    ]),
    average: 0,
  };
  coverageScores.average = average([
    coverageScores.header,
    coverageScores.supplier,
    coverageScores.buyer,
    coverageScores.tax,
    coverageScores.lines,
  ]);

  const hasLiveSignals =
    isDataLoaded ||
    isChecksRun ||
    stats.totalInvoices > 0 ||
    scopedExceptions.length > 0 ||
    scopedCheckResults.length > 0;

  if (!hasLiveSignals) {
    return buildFallbackSnapshot(dataset);
  }

  const fallback = buildFallbackSnapshot(dataset);
  const totalInvoices = stats.totalInvoices || headers.length || fallback.totalInvoices;
  const passed = scopedCheckResults.reduce((sum, result) => sum + result.passed, 0);
  const failed = scopedCheckResults.reduce((sum, result) => sum + result.failed, 0);
  const criticalIssues =
    stats.exceptionsBySeverity.Critical ||
    scopedExceptions.filter((exception) => exception.severity === 'Critical').length;

  const readinessScore = clampScore(
    average([
      stats.passRate || 0,
      coverageScores.average,
      Math.max(0, 100 - Math.min(criticalIssues, 20) * 4),
    ])
  );

  const mappedCount = Math.round(totalInvoices * (coverageScores.average / 100));
  const validatedCount = isChecksRun ? totalInvoices : Math.round(mappedCount * 0.88);
  const passedInvoices = Math.round(validatedCount * (Math.max(stats.passRate, 1) / 100));
  const evidenceReadyCount = Math.max(
    Math.round(passedInvoices - Math.min(criticalIssues, Math.round(totalInvoices * 0.08))),
    0
  );

  const issueRank: Record<string, number> = {
    Critical: 4,
    High: 3,
    Medium: 2,
    Low: 1,
  };

  const groupedIssues = new Map<string, RecurringIssue>();
  scopedExceptions.forEach((exception) => {
    const existing = groupedIssues.get(exception.checkId);
    if (!existing) {
      groupedIssues.set(exception.checkId, {
        checkId: exception.checkId,
        name: exception.checkName,
        count: 1,
        severity: exception.severity,
        detail: exception.message,
      });
      return;
    }

    existing.count += 1;
    if ((issueRank[exception.severity] ?? 0) > (issueRank[existing.severity] ?? 0)) {
      existing.severity = exception.severity;
    }
  });

  const recurringIssues = Array.from(groupedIssues.values())
    .sort((left, right) => right.count - left.count)
    .slice(0, 5);

  const workflowScore = clampScore(
    average([readinessScore, Math.max(0, 100 - Math.min(failed, 200) / 2), isChecksRun ? 88 : 62])
  );
  const evidenceScore = clampScore(average([readinessScore, workflowScore, coverageScores.header]));
  const partyScore = average([coverageScores.supplier, coverageScores.buyer]);

  return {
    totalInvoices,
    readinessScore,
    passed,
    failed,
    criticalIssues,
    modeLabel: isChecksRun ? 'Live portfolio snapshot' : 'Preview metrics',
    recurringIssues,
    funnelStages: [
      { id: 'ingest', label: 'Ingested', count: totalInvoices, share: 100, note: 'Datasets received' },
      { id: 'mapped', label: 'Mapped', count: mappedCount, share: totalInvoices ? (mappedCount / totalInvoices) * 100 : 0, note: 'Schema aligned' },
      { id: 'validated', label: 'Validated', count: validatedCount, share: totalInvoices ? (validatedCount / totalInvoices) * 100 : 0, note: 'Rules executed' },
      { id: 'passed', label: 'Passed', count: passedInvoices, share: totalInvoices ? (passedInvoices / totalInvoices) * 100 : 0, note: 'Submission ready' },
      { id: 'evidence', label: 'Evidence', count: evidenceReadyCount, share: totalInvoices ? (evidenceReadyCount / totalInvoices) * 100 : 0, note: 'Audit-ready output' },
    ],
    heatmapColumns: ['Capture', 'Mapping', 'Validation', 'Evidence'],
    heatmapRows: [
      {
        label: 'Dataset controls',
        cells: [
          { score: clampScore(coverageScores.header), label: getScoreNarrative(coverageScores.header) },
          { score: clampScore(coverageScores.lines), label: getScoreNarrative(coverageScores.lines) },
          { score: clampScore(readinessScore - 4), label: getScoreNarrative(readinessScore - 4) },
          { score: clampScore(evidenceScore - 6), label: getScoreNarrative(evidenceScore - 6) },
        ],
      },
      {
        label: 'Counterparty controls',
        cells: [
          { score: clampScore(partyScore), label: getScoreNarrative(partyScore) },
          { score: clampScore(partyScore - 3), label: getScoreNarrative(partyScore - 3) },
          { score: clampScore(readinessScore - Math.min(criticalIssues, 10) * 2), label: getScoreNarrative(readinessScore - Math.min(criticalIssues, 10) * 2) },
          { score: clampScore(evidenceScore - 8), label: getScoreNarrative(evidenceScore - 8) },
        ],
      },
      {
        label: 'Tax controls',
        cells: [
          { score: clampScore(coverageScores.tax), label: getScoreNarrative(coverageScores.tax) },
          { score: clampScore(coverageScores.tax - 2), label: getScoreNarrative(coverageScores.tax - 2) },
          { score: clampScore(readinessScore - Math.min(failed, 120) / 6), label: getScoreNarrative(readinessScore - Math.min(failed, 120) / 6) },
          { score: clampScore(evidenceScore - 5), label: getScoreNarrative(evidenceScore - 5) },
        ],
      },
      {
        label: 'Workflow controls',
        cells: [
          { score: clampScore(isDataLoaded ? 88 : 52), label: getScoreNarrative(isDataLoaded ? 88 : 52) },
          { score: clampScore(isDataLoaded ? 84 : 48), label: getScoreNarrative(isDataLoaded ? 84 : 48) },
          { score: workflowScore, label: getScoreNarrative(workflowScore) },
          { score: evidenceScore, label: getScoreNarrative(evidenceScore) },
        ],
      },
    ],
    readinessDrivers: [
      { label: 'Header completeness', score: clampScore(coverageScores.header), hint: 'Core document identity and numbering fields.' },
      { label: 'Counterparty quality', score: clampScore(partyScore), hint: 'Supplier and buyer readiness across governed fields.' },
      { label: 'Tax fidelity', score: clampScore(coverageScores.tax), hint: 'Tax basis, rates, and totals carried across header and line scope.' },
      { label: 'Workflow stability', score: workflowScore, hint: 'Execution readiness across validation, resolution, and evidence stages.' },
    ],
  };
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

  const kpiSnapshot = useMemo(
    () =>
      buildExecutiveKpiSnapshot({
        dataset: activeDatasetType,
        isChecksRun,
        isDataLoaded,
        stats,
        checkResults,
        exceptions,
        headers,
      }),
    [activeDatasetType, checkResults, exceptions, headers, isChecksRun, isDataLoaded, stats]
  );

  const snapshot = useMemo(
    () =>
      buildExecutiveSnapshot({
        dataset: activeDatasetType,
        isChecksRun,
        isDataLoaded,
        stats,
        checkResults,
        exceptions,
        headers,
        buyers,
        lines,
      }),
    [activeDatasetType, buyers, checkResults, exceptions, headers, isChecksRun, isDataLoaded, lines, stats]
  );

  const pipelineSteps: PipelineStep[] = useMemo(() => {
    const exceptionState: PipelineState = !isChecksRun ? 'pending' : snapshot.criticalIssues > 0 ? 'active' : 'complete';
    const evidenceState: PipelineState = !isChecksRun ? 'blocked' : snapshot.criticalIssues > 0 ? 'pending' : 'active';

    return [
      { id: 'ingest', label: 'Ingest', state: isDataLoaded ? 'complete' : 'active' },
      { id: 'mapping', label: 'Map', state: isDataLoaded ? 'complete' : 'pending' },
      { id: 'validate', label: 'Validate', state: isChecksRun ? 'complete' : isDataLoaded ? 'active' : 'blocked' },
      { id: 'exceptions', label: 'Exceptions', state: exceptionState },
      { id: 'evidence', label: 'Evidence', state: evidenceState },
    ];
  }, [isChecksRun, isDataLoaded, snapshot.criticalIssues]);

  const metrics: ExecutiveMetric[] = [
    {
      title: 'Total Invoices',
      value: formatNumber(kpiSnapshot.totalInvoices),
      subtitle:
        kpiSnapshot.totalInvoices > 0
          ? activeDatasetType === 'AR'
            ? 'Outbound portfolio in scope'
            : 'Inbound portfolio in scope'
          : 'Awaiting live dataset scope',
      icon: <FileText className="h-5 w-5" />,
      variant: 'default',
    },
    {
      title: 'Readiness Score',
      value: kpiSnapshot.readinessScore === null ? '—' : `${snapshot.readinessScore}%`,
      subtitle:
        kpiSnapshot.readinessScore === null
          ? 'Awaiting live validation signals'
          : `${snapshot.modeLabel} · derived estimate`,
      icon: <Sparkles className="h-5 w-5" />,
      variant:
        kpiSnapshot.readinessScore === null
          ? 'default'
          : snapshot.readinessScore >= 90
          ? 'success'
          : snapshot.readinessScore >= 75
          ? 'warning'
          : 'danger',
    },
    {
      title: 'Passed',
      value: formatNumber(kpiSnapshot.passed),
      subtitle: 'Validation outcomes passing',
      icon: <CheckCircle2 className="h-5 w-5" />,
      variant: 'success',
    },
    {
      title: 'Failed',
      value: formatNumber(kpiSnapshot.failed),
      subtitle: 'Validation outcomes requiring action',
      icon: <TriangleAlert className="h-5 w-5" />,
      variant: kpiSnapshot.failed > 0 ? 'warning' : 'default',
    },
    {
      title: 'Critical Issues',
      value: formatNumber(kpiSnapshot.criticalIssues),
      subtitle: 'Immediate blockers in current view',
      icon: <ShieldAlert className="h-5 w-5" />,
      variant: kpiSnapshot.criticalIssues > 0 ? 'danger' : 'success',
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
              {isRunning ? 'Validation running' : snapshot.criticalIssues > 0 ? 'Attention required' : 'Executive ready'}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => navigate('/run')}>
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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map((metric) => (
          <StatsCard
            key={metric.title}
            title={metric.title}
            value={metric.value}
            subtitle={metric.subtitle}
            icon={metric.icon}
            variant={metric.variant}
            className="rounded-[24px] border-border/70 bg-card/94 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.22)]"
          />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <div className="surface-glass rounded-[28px] border border-border/70 p-5 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.24)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Validation funnel</p>
              <h2 className="mt-1 text-xl font-semibold text-foreground">Stage progression</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                A derived preview of how portfolio volume may move from intake into submission-ready output.
              </p>
            </div>
            <div className="rounded-2xl border border-primary/15 bg-primary/8 px-4 py-3 text-right">
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Current readiness</p>
              <p className="mt-1 text-2xl font-bold text-primary">{snapshot.readinessScore}%</p>
            </div>
          </div>

          <div className="mt-4">
            <PipelineProgress steps={pipelineSteps} />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-5">
            {snapshot.funnelStages.map((stage) => (
              <div
                key={stage.id}
                className="rounded-2xl border border-border/70 bg-background/75 p-4 shadow-[0_10px_20px_-18px_rgba(15,23,42,0.18)]"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{stage.label}</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{formatNumber(stage.count)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{stage.note}</p>
                <Progress value={stage.share} className="mt-3 h-2.5 rounded-full bg-muted/80" />
                <p className="mt-2 text-xs font-medium text-muted-foreground">{stage.share.toFixed(0)}% of portfolio</p>
              </div>
            ))}
          </div>
        </div>

        <div className="surface-glass rounded-[28px] border border-border/70 p-5 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.24)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Control heatmap</p>
              <h2 className="mt-1 text-xl font-semibold text-foreground">Control posture by stage</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Derived preview signal across the core readiness themes in the current dashboard scope.
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/75 p-3">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-border/70 bg-background/70">
            <div className="grid grid-cols-[1.15fr_repeat(4,minmax(0,1fr))] border-b border-border/70 bg-muted/35 px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <div>Control area</div>
              {snapshot.heatmapColumns.map((column) => (
                <div key={column} className="text-center">
                  {column}
                </div>
              ))}
            </div>

            <div className="divide-y divide-border/60">
              {snapshot.heatmapRows.map((row) => (
                <div
                  key={row.label}
                  className="grid grid-cols-[1.15fr_repeat(4,minmax(0,1fr))] items-center gap-2 px-3 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{row.label}</p>
                  </div>
                  {row.cells.map((cell, index) => (
                    <div key={`${row.label}-${index}`} className="flex justify-center">
                      <div
                        className={`w-full rounded-xl border px-2 py-2 text-center shadow-[0_8px_18px_-18px_rgba(15,23,42,0.2)] ${getHeatClasses(
                          cell.score
                        )}`}
                      >
                        <p className="text-sm font-semibold">{cell.score}</p>
                        <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] opacity-80">{cell.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="surface-glass rounded-[28px] border border-border/70 p-5 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.24)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Recurring issues</p>
              <h2 className="mt-1 text-xl font-semibold text-foreground">Top recurring issues</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Most frequent validation breaks surfacing across the selected portfolio view.
              </p>
            </div>
            <Button variant="outline" className="rounded-full" onClick={() => navigate('/exceptions')}>
              Open queue
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-4 space-y-3">
            {snapshot.recurringIssues.length > 0 ? (
              snapshot.recurringIssues.map((issue, index) => (
                <div
                  key={issue.checkId}
                  className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background/75 p-4 shadow-[0_10px_20px_-18px_rgba(15,23,42,0.18)] md:flex-row md:items-start md:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-border/70 bg-background px-2 text-[11px] font-semibold text-muted-foreground">
                        {index + 1}
                      </span>
                      <p className="text-sm font-semibold text-foreground">{issue.name}</p>
                      <SeverityBadge severity={issue.severity} />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{issue.detail}</p>
                  </div>
                  <div className="shrink-0 rounded-2xl border border-border/70 bg-card/90 px-4 py-3 text-right">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Occurrences</p>
                    <p className="mt-1 text-2xl font-semibold text-foreground">{issue.count}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-border/70 bg-background/75 p-4 text-sm text-muted-foreground shadow-[0_10px_20px_-18px_rgba(15,23,42,0.18)]">
                No recurring issues are currently surfaced in this live portfolio scope.
              </div>
            )}
          </div>
        </div>

        <div className="surface-glass rounded-[28px] border border-border/70 p-5 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.24)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Readiness drivers</p>
              <h2 className="mt-1 text-xl font-semibold text-foreground">Portfolio signal mix</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Derived executive-level breakdown of the signals currently influencing readiness.
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/75 p-3">
              <FileCheck2 className="h-5 w-5 text-primary" />
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {snapshot.readinessDrivers.map((driver) => (
              <div key={driver.label} className="rounded-2xl border border-border/70 bg-background/75 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{driver.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{driver.hint}</p>
                  </div>
                  <p className="text-lg font-semibold text-foreground">{driver.score}%</p>
                </div>
                <Progress value={driver.score} className="mt-3 h-2.5 rounded-full bg-muted/80" />
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-primary/15 bg-primary/8 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-semibold text-foreground">Executive note</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Green now signals portfolio momentum, while the dashboard keeps the heaviest visual focus on recurring
                  breaks and derived conversion indicators through the validation funnel.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
