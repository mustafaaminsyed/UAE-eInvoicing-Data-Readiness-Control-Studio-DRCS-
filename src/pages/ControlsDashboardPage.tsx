import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  RefreshCw,
  Award,
  FilterX,
  Shield,
  ShieldAlert,
  FileCheck,
  Layers3,
  Info,
  Activity,
  FolderOpen,
  Hash,
  TriangleAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatsCard } from '@/components/StatsCard';
import ComplianceRadar from '@/components/dashboard/ComplianceRadar';
import EntityRiskMatrixHeatmap from '@/components/dashboard/EntityRiskMatrixHeatmap';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { fetchCheckRuns, fetchLatestEntityScores } from '@/lib/api/checksApi';
import { fetchClientHealthScores, getRejectionAnalytics, getSLAMetrics } from '@/lib/api/casesApi';
import { CheckRun, EntityScore } from '@/types/customChecks';
import { ClientHealth, SLAMetrics } from '@/types/cases';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useCompliance } from '@/context/ComplianceContext';
import { computeTraceabilityMatrix } from '@/lib/coverage/conformanceEngine';
import { computeMoFCoverage } from '@/lib/coverage/mofCoverageEngine';
import UAE_UC1_CHECK_PACK from '@/lib/checks/uaeUC1CheckPack';
import { PINT_AE_CODELIST_GOVERNANCE_COUNTS, countRuntimeCodelistDomains } from '@/lib/pintAE/codelistGovernanceSummary';
import { ComplianceRadarAxisKey, buildComplianceRadarResult } from '@/lib/analytics/complianceRadar';
import {
  applyEntityRiskMatrixFilters,
  buildEntityRiskMatrixResult,
} from '@/lib/analytics/entityRiskMatrix';
import type { EntityRiskMatrixFilters, EntityRiskMatrixFocus } from '@/types/entityRiskMatrix';

type InsightMode = 'none' | 'quality' | 'repeat' | 'critical' | 'dr_coverage' | 'mof_coverage';
const TOP_RISK_SELLER_POOL_SIZE = 50;

function getScoreColor(score: number): string {
  if (score >= 90) return 'text-success';
  if (score >= 70) return 'text-severity-medium';
  if (score >= 50) return 'text-severity-high';
  return 'text-severity-critical';
}

function getScoreBgColor(score: number): string {
  if (score >= 90) return 'bg-success';
  if (score >= 70) return 'bg-severity-medium';
  if (score >= 50) return 'bg-severity-high';
  return 'bg-severity-critical';
}

export default function ControlsDashboardPage() {
  const NON_BLOCKING_FAILURE_THRESHOLD = 10;
  const navigate = useNavigate();
  const { toast } = useToast();
  const { activeDatasetType, direction, exceptions, headers, checkResults } = useCompliance();
  const [checkRuns, setCheckRuns] = useState<CheckRun[]>([]);
  const [clientHealth, setClientHealth] = useState<ClientHealth[]>([]);
  const [topRiskSellers, setTopRiskSellers] = useState<EntityScore[]>([]);
  const [rejectionAnalytics, setRejectionAnalytics] = useState({ totalRejections: 0, repeatRate: 0 });
  const [slaMetrics, setSlaMetrics] = useState<SLAMetrics>({
    averageResolutionHours: {},
    breachPercentage: 0,
    totalCases: 0,
    breachedCases: 0,
    openCases: 0,
    resolvedCases: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('all');
  const [insightMode, setInsightMode] = useState<InsightMode>('none');
  const [entityRiskFilters, setEntityRiskFilters] = useState<EntityRiskMatrixFilters>({
    search: '',
    sortBy: 'lowest_score',
    rowLimit: 25,
    elevatedRiskOnly: false,
  });

  const drCoverageSummary = useMemo(() => {
    const { gaps } = computeTraceabilityMatrix([]);
    const total = gaps.totalDRs;
    const covered = gaps.drsCovered;
    const percent = total > 0 ? (covered / total) * 100 : 0;
    return { total, covered, percent };
  }, []);

  const mofTaxCoverage = useMemo(() => {
    try {
      return computeMoFCoverage('tax_invoice');
    } catch {
      return null;
    }
  }, []);
  const mofCommercialCoverage = useMemo(() => {
    try {
      return computeMoFCoverage('commercial_xml');
    } catch {
      return null;
    }
  }, []);
  const mofMandatoryCoveragePct = useMemo(
    () => {
      if (!mofTaxCoverage || !mofCommercialCoverage) return null;
      return (mofTaxCoverage.mandatoryCoveragePct + mofCommercialCoverage.mandatoryCoveragePct) / 2;
    },
    [mofTaxCoverage, mofCommercialCoverage]
  );

  const loadData = useCallback(async (manualRefresh = false) => {
    if (manualRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const [runs, health, sellers, rejections, sla] = await Promise.all([
        fetchCheckRuns(),
        fetchClientHealthScores(),
        fetchLatestEntityScores('seller', TOP_RISK_SELLER_POOL_SIZE),
        getRejectionAnalytics(),
        getSLAMetrics(),
      ]);
      setCheckRuns(runs);
      setClientHealth(health);
      setTopRiskSellers(sellers);
      setRejectionAnalytics(rejections);
      setSlaMetrics(sla);
    } catch {
      toast({
        title: 'Failed to load controls data',
        description: 'Please refresh and try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredRuns = checkRuns
    .filter((run) => {
      if (timeRange === 'all') return true;
      const runDate = new Date(run.run_date);
      const now = new Date();
      const daysAgo = timeRange === '7d' ? 7 : 30;
      const cutoff = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      return runDate >= cutoff;
    })
    .reverse();

  const latestRun = filteredRuns.length > 0 ? filteredRuns[filteredRuns.length - 1] : undefined;
  const previousRun = filteredRuns.length > 1 ? filteredRuns[filteredRuns.length - 2] : undefined;
  const passRateTrend = latestRun && previousRun ? latestRun.pass_rate - previousRun.pass_rate : 0;
  const periodRunCount = filteredRuns.length;
  const scopedRuntimeExceptions = useMemo(
    () =>
      exceptions.filter(
        (exception) => (exception.datasetType || exception.direction || activeDatasetType || direction) === (activeDatasetType || direction)
      ),
    [activeDatasetType, direction, exceptions]
  );
  const scopedRuntimeCheckResults = useMemo(
    () =>
      checkResults.filter(
        (result) => (((result.datasetType || result.direction || activeDatasetType || direction) === (activeDatasetType || direction)))
      ),
    [activeDatasetType, checkResults, direction]
  );

  const periodTotals = useMemo(() => {
    return filteredRuns.reduce(
      (acc, run) => {
        acc.invoices += run.total_invoices;
        acc.exceptions += run.total_exceptions;
        acc.critical += run.critical_count;
        return acc;
      },
      { invoices: 0, exceptions: 0, critical: 0 }
    );
  }, [filteredRuns]);

  const avgHealthScore =
    clientHealth.length > 0 ? clientHealth.reduce((sum, c) => sum + c.score, 0) / clientHealth.length : null;
  const latestPassRate = latestRun?.pass_rate ?? null;
  const avgPassRatePeriod = periodRunCount > 0
    ? filteredRuns.reduce((sum, r) => sum + r.pass_rate, 0) / periodRunCount
    : null;
  const exceptionsPer100Invoices = periodTotals.invoices > 0
    ? (periodTotals.exceptions / periodTotals.invoices) * 100
    : null;
  const criticalShare = periodTotals.exceptions > 0
    ? (periodTotals.critical / periodTotals.exceptions) * 100
    : null;
  const criticalDensity = latestRun && latestRun.total_invoices > 0
    ? (latestRun.critical_count / latestRun.total_invoices) * 100
    : null;
  const runtimeCodelistDomains = useMemo(
    () => countRuntimeCodelistDomains(UAE_UC1_CHECK_PACK.filter((check) => check.is_enabled)),
    []
  );
  const runSampleSubtitle = timeRange === 'all' ? 'All recorded runs' : 'Runs within selected period';
  const radarProfile = useMemo(
    () =>
      buildComplianceRadarResult({
        mandatoryCoveragePct: mofMandatoryCoveragePct,
        drCoveragePct: drCoverageSummary.percent,
        latestPassRatePct: latestPassRate,
        avgPassRatePct: avgPassRatePeriod,
        exceptionIntensityPer100: exceptionsPer100Invoices,
        criticalSharePct: criticalShare,
        latestCriticalPressurePct: criticalDensity,
        repeatRejectionRatePct: rejectionAnalytics.repeatRate,
        avgHealthScore,
        slaBreachRatePct: slaMetrics.breachPercentage,
        runtimeCodelistChecks: runtimeCodelistDomains,
        governedCodedDomains: PINT_AE_CODELIST_GOVERNANCE_COUNTS.governedCodedDomains,
      }),
    [
      avgHealthScore,
      avgPassRatePeriod,
      criticalDensity,
      criticalShare,
      drCoverageSummary.percent,
      exceptionsPer100Invoices,
      latestPassRate,
      mofMandatoryCoveragePct,
      rejectionAnalytics.repeatRate,
      runtimeCodelistDomains,
      slaMetrics.breachPercentage,
    ]
  );
  const entityRiskMatrix = useMemo(
    () =>
      buildEntityRiskMatrixResult({
        portfolio: {
          dimensions: radarProfile.dimensions,
        },
        entities: {
          sellers: topRiskSellers,
          clientHealth,
        },
        operational: {
          exceptions,
          headers,
        },
      }),
    [clientHealth, exceptions, headers, radarProfile.dimensions, topRiskSellers]
  );
  const visibleEntityRiskRows = useMemo(
    () => applyEntityRiskMatrixFilters(entityRiskMatrix.rows, entityRiskFilters),
    [entityRiskFilters, entityRiskMatrix.rows]
  );

  const formatPct = (value: number | null, digits = 1) => (value === null ? 'N/A' : `${value.toFixed(digits)}%`);
  const formatHours = (value: number | null) => (value === null ? 'N/A' : `${value.toFixed(1)}h`);
  const formatCount = (value: number) => value.toLocaleString('en-US');
  const totalInvoicesInScope = headers.length > 0 ? headers.length : latestRun?.total_invoices ?? 0;
  const liveCriticalBlockerInvoiceIds = new Set(
    scopedRuntimeExceptions
      .filter((exception) => exception.severity === 'Critical' && exception.invoiceId)
      .map((exception) => exception.invoiceId as string)
  );
  const liveCriticalBlockers =
    liveCriticalBlockerInvoiceIds.size > 0
      ? liveCriticalBlockerInvoiceIds.size
      : scopedRuntimeExceptions.filter((exception) => exception.severity === 'Critical').length;
  const criticalBlockers = headers.length > 0 || scopedRuntimeExceptions.length > 0
    ? liveCriticalBlockers
    : latestRun?.critical_count ?? 0;
  const submissionReadyInvoices = Math.max(totalInvoicesInScope - criticalBlockers, 0);
  const currentReadinessScore = totalInvoicesInScope > 0 ? (submissionReadyInvoices / totalInvoicesInScope) * 100 : 0;
  const previousRunReadiness = previousRun && previousRun.total_invoices > 0
    ? ((previousRun.total_invoices - previousRun.critical_count) / previousRun.total_invoices) * 100
    : null;
  const readinessTrend = previousRunReadiness === null ? null : currentReadinessScore - previousRunReadiness;
  const livePassedOutcomes = scopedRuntimeCheckResults.reduce((sum, result) => sum + result.passed, 0);
  const liveFailedOutcomes = scopedRuntimeCheckResults.reduce((sum, result) => sum + result.failed, 0);
  const liveNonBlockingFailures = Math.max(
    liveFailedOutcomes - scopedRuntimeExceptions.filter((exception) => exception.severity === 'Critical').length,
    0
  );
  const passedOutcomes =
    scopedRuntimeCheckResults.length > 0
      ? livePassedOutcomes
      : Math.max((latestRun?.total_invoices ?? 0) - (latestRun?.total_exceptions ?? 0), 0);
  const failedOutcomes =
    scopedRuntimeCheckResults.length > 0
      ? liveNonBlockingFailures
      : Math.max((latestRun?.total_exceptions ?? 0) - (latestRun?.critical_count ?? 0), 0);
  const controlStudioStatus = criticalBlockers > 0
    ? 'AT RISK'
    : failedOutcomes > NON_BLOCKING_FAILURE_THRESHOLD
    ? 'DEGRADED'
    : 'READY';
  const controlStudioStatusVariant =
    controlStudioStatus === 'AT RISK' ? 'danger' : controlStudioStatus === 'DEGRADED' ? 'warning' : 'success';
  const controlStudioMetrics = [
    {
      title: 'Readiness Status Score',
      value: `${currentReadinessScore.toFixed(1)}%`,
      subtitle:
        totalInvoicesInScope > 0
          ? `${submissionReadyInvoices.toLocaleString('en-US')} of ${totalInvoicesInScope.toLocaleString('en-US')} invoices submission-ready`
          : 'No invoices currently in scope',
      helpText: 'Share of invoices currently treated as submission-ready based on invoice-level critical blocker presence.',
      icon: <Shield className="w-5 h-5" />,
      variant: currentReadinessScore >= 90 ? 'success' : currentReadinessScore >= 75 ? 'warning' : 'danger' as const,
    },
    {
      title: 'Trend Indicator',
      value: readinessTrend === null ? 'N/A' : `${readinessTrend > 0 ? '+' : ''}${readinessTrend.toFixed(1)} pts`,
      subtitle: previousRunReadiness === null ? 'No previous run baseline' : 'Movement since previous run',
      helpText: 'Current readiness score minus the previous recorded run readiness baseline.',
      icon: <Activity className="w-5 h-5" />,
      variant: readinessTrend === null ? 'default' : readinessTrend >= 0 ? 'success' : 'warning' as const,
    },
    {
      title: 'Passed',
      value: formatCount(passedOutcomes),
      subtitle:
        scopedRuntimeCheckResults.length > 0
          ? 'Validation outcomes passing'
          : 'Latest run pass proxy',
      helpText: 'Uses current in-memory check outcomes when available; otherwise falls back to the latest recorded run summary.',
      icon: <CheckCircle2 className="w-5 h-5" />,
      variant: 'success' as const,
    },
    {
      title: 'Failed',
      value: formatCount(failedOutcomes),
      subtitle:
        scopedRuntimeCheckResults.length > 0
          ? 'Non-blocking validation outcomes'
          : 'Latest run non-blocking proxy',
      helpText: `Non-critical failures only. Status degrades when this exceeds ${NON_BLOCKING_FAILURE_THRESHOLD}.`,
      icon: <TriangleAlert className="w-5 h-5" />,
      variant: failedOutcomes > NON_BLOCKING_FAILURE_THRESHOLD ? 'warning' as const : 'default' as const,
    },
    {
      title: 'Critical Blockers',
      value: formatCount(criticalBlockers),
      subtitle: 'Invoices that cannot be submitted',
      helpText: 'Current runtime proxy uses invoice-linked Critical exceptions as submission blockers.',
      icon: <ShieldAlert className="w-5 h-5" />,
      variant: criticalBlockers > 0 ? 'danger' as const : 'success' as const,
    },
    {
      title: 'Status',
      value: controlStudioStatus,
      subtitle:
        controlStudioStatus === 'AT RISK'
          ? 'Critical blockers present'
          : controlStudioStatus === 'DEGRADED'
          ? `Non-blocking failures exceed ${NON_BLOCKING_FAILURE_THRESHOLD}`
          : 'No blocker threshold breached',
      helpText: 'AT RISK if any critical blockers exist; otherwise DEGRADED when non-blocking failures exceed threshold; else READY.',
      icon: <FileCheck className="w-5 h-5" />,
      variant: controlStudioStatusVariant,
    },
  ];

  const focusRuns = insightMode === 'quality'
    ? filteredRuns.filter((run) => run.pass_rate < 90)
    : filteredRuns;

  const focusTrendData = focusRuns.map((run) => ({
    date: new Date(run.run_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    passRate: run.pass_rate,
    exceptions: run.total_exceptions,
    critical: run.critical_count,
    nonCritical: Math.max(0, run.total_exceptions - run.critical_count),
  }));

  const visibleClientHealth = (() => {
    if (insightMode === 'repeat') {
      return [...clientHealth]
        .filter((c) => c.total_rejections > 0)
        .sort((a, b) => b.total_rejections - a.total_rejections)
        .slice(0, 10);
    }
    if (insightMode === 'quality') {
      return [...clientHealth].sort((a, b) => a.score - b.score).slice(0, 10);
    }
    return [...clientHealth].sort((a, b) => b.score - a.score).slice(0, 10);
  })();

  const visibleRiskSellers = (() => {
    if (insightMode === 'critical') {
      return [...topRiskSellers].filter((s) => s.critical_count > 0).sort((a, b) => b.critical_count - a.critical_count).slice(0, 10);
    }
    if (insightMode === 'quality') {
      return [...topRiskSellers].filter((s) => s.score < 90).sort((a, b) => a.score - b.score).slice(0, 10);
    }
    return topRiskSellers.slice(0, 10);
  })();

  const insightLabel: Record<InsightMode, string> = {
    none: 'None',
    quality: 'Quality Risk',
    repeat: 'Repeat Failure Risk',
    critical: 'Critical Exceptions',
    dr_coverage: 'DR Coverage',
    mof_coverage: 'MoF Mandatory Coverage',
  };
  const handleRadarDimensionClick = useCallback((axis: ComplianceRadarAxisKey) => {
    if (axis === 'mandatory_coverage') {
      setInsightMode('mof_coverage');
      return;
    }
    if (axis === 'pint_structure_readiness') {
      setInsightMode('dr_coverage');
      return;
    }
    if (axis === 'exception_control_health' || axis === 'tax_logic_integrity') {
      setInsightMode('critical');
      return;
    }
    setInsightMode('quality');
  }, []);
  const handleEntityRiskCellClick = useCallback(
    (focus: EntityRiskMatrixFocus) => {
      const params = new URLSearchParams();
      params.set('dataset', activeDatasetType || direction);
      params.set('seller', focus.entityId);
      params.set('dimension', focus.dimension);
      params.set('context', 'entity-risk-matrix');
      params.set('precision', focus.drillDownMode);
      navigate(`/exceptions?${params.toString()}`);
    },
    [activeDatasetType, direction, navigate]
  );
  const chartAnimationSeed = `${timeRange}-${insightMode}-${focusTrendData.length}`;

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-muted-foreground animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading controls data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="container max-w-7xl py-8 md:py-10">
        <div className="flex items-center justify-between mb-8 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <BarChart3 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Controls Dashboard</h1>
              <p className="text-muted-foreground">Readiness scoring, conformance coverage, and operational risk intelligence</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Select value={timeRange} onValueChange={(v) => setTimeRange(v as '7d' | '30d' | 'all')}>
              <SelectTrigger className="w-32">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => loadData(true)} className="gap-2" disabled={isRefreshing}>
              <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </div>

        <div className="mb-8 animate-slide-up">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Control Studio Panel</h2>
              <p className="text-sm text-muted-foreground">
                Immediate runtime view of submission readiness, blocker pressure, and validation movement.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Info className="h-4 w-4" />
              <span>Operational KPIs first; analytic diagnostics remain below.</span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4">
            {controlStudioMetrics.map((metric) => (
              <StatsCard
                key={metric.title}
                title={metric.title}
                value={metric.value}
                subtitle={metric.subtitle}
                helpText={metric.helpText}
                icon={metric.icon}
                variant={metric.variant}
              />
            ))}
          </div>
        </div>

        <div className="mb-8 animate-slide-up">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-foreground">Runtime Operations (Selected Period)</h2>
            <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
              Scope: Time filter applies
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <StatsCard
              title="Runs Executed"
              value={formatCount(periodRunCount)}
              subtitle={runSampleSubtitle}
              helpText="Number of check runs completed in the selected time window."
              icon={<Hash className="w-5 h-5" />}
            />
            <StatsCard
              title="Invoices Processed"
              value={formatCount(periodTotals.invoices)}
              subtitle="Total invoices across selected runs"
              helpText="Total invoice volume processed by the validation engine for the selected period."
              icon={<Activity className="w-5 h-5" />}
            />
            <StatsCard
              title="Latest Conformance Pass Rate"
              value={formatPct(latestPassRate)}
              subtitle={
                latestPassRate === null
                  ? 'No run in selected period'
                  : passRateTrend !== 0
                    ? `${passRateTrend > 0 ? '+' : ''}${passRateTrend.toFixed(1)}% vs previous run`
                    : 'No movement vs previous run'
              }
              helpText="Pass rate of the most recent run in the selected period."
              onClick={() => setInsightMode('quality')}
              isActive={insightMode === 'quality'}
              icon={<FileCheck className="w-5 h-5" />}
              variant={latestPassRate === null ? 'default' : latestPassRate >= 90 ? 'success' : latestPassRate >= 70 ? 'warning' : 'danger'}
            />
            <StatsCard
              title="Average Pass Rate (Period)"
              value={formatPct(avgPassRatePeriod)}
              subtitle={`${formatCount(periodRunCount)} runs included`}
              helpText="Average pass rate across all runs in the selected period."
              onClick={() => setInsightMode('quality')}
              isActive={insightMode === 'quality'}
              icon={<Award className="w-5 h-5" />}
              variant={avgPassRatePeriod === null ? 'default' : avgPassRatePeriod >= 90 ? 'success' : avgPassRatePeriod >= 70 ? 'warning' : 'danger'}
            />
            <StatsCard
              title="Exception Intensity"
              value={exceptionsPer100Invoices === null ? 'N/A' : `${exceptionsPer100Invoices.toFixed(1)}`}
              subtitle={exceptionsPer100Invoices === null ? 'No invoice volume in period' : 'Exceptions per 100 invoices'}
              helpText="Normalized exception load to compare quality across different invoice volumes."
              icon={<BarChart3 className="w-5 h-5" />}
              variant={exceptionsPer100Invoices === null ? 'default' : exceptionsPer100Invoices > 25 ? 'danger' : exceptionsPer100Invoices > 10 ? 'warning' : 'success'}
            />
            <StatsCard
              title="Critical Share"
              value={formatPct(criticalShare)}
              subtitle={criticalShare === null ? 'No exceptions in period' : `${formatCount(periodTotals.critical)} critical exceptions`}
              helpText="Critical exceptions as a percentage of all exceptions in the selected period."
              onClick={() => setInsightMode('critical')}
              isActive={insightMode === 'critical'}
              icon={<AlertTriangle className="w-5 h-5" />}
              variant={criticalShare === null ? 'default' : criticalShare > 30 ? 'danger' : criticalShare > 15 ? 'warning' : 'success'}
            />
          </div>
        </div>

        <div className="mb-8">
          <ComplianceRadar
            result={radarProfile}
            title="Readiness Dimensions"
            onDimensionClick={handleRadarDimensionClick}
          />
        </div>

        <div className="mb-8">
          <EntityRiskMatrixHeatmap
            result={entityRiskMatrix}
            rows={visibleEntityRiskRows}
            filters={entityRiskFilters}
            onFiltersChange={setEntityRiskFilters}
            onCellClick={handleEntityRiskCellClick}
          />
        </div>

        <div className="mb-8 animate-slide-up">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-foreground">Coverage Governance (Registry Scope)</h2>
            <span className="rounded-full border border-muted-foreground/30 bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
              Scope: Source model coverage
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <StatsCard
              title="PINT-AE DR Coverage"
              value={`${drCoverageSummary.percent.toFixed(1)}%`}
              subtitle={`${drCoverageSummary.covered} of ${drCoverageSummary.total} DRs have rule+control linkage`}
              helpText="Registry-level coverage across PINT-AE data requirements. This is governance scope, not period runtime performance."
              onClick={() => setInsightMode('dr_coverage')}
              isActive={insightMode === 'dr_coverage'}
              icon={<Shield className="w-5 h-5" />}
              variant={drCoverageSummary.percent >= 90 ? 'success' : drCoverageSummary.percent >= 75 ? 'warning' : 'danger'}
            />
            <StatsCard
              title="MoF Mandatory Coverage"
              value={mofMandatoryCoveragePct === null ? 'N/A' : `${mofMandatoryCoveragePct.toFixed(1)}%`}
              subtitle={
                mofTaxCoverage && mofCommercialCoverage
                  ? `Tax ${mofTaxCoverage.coveredMandatory}/${mofTaxCoverage.mandatoryFields} | Commercial ${mofCommercialCoverage.coveredMandatory}/${mofCommercialCoverage.mandatoryFields}`
                  : 'MoF source coverage unavailable in current runtime'
              }
              helpText="Mandatory-field source coverage using the MoF crosswalk for both tax and commercial document types."
              onClick={() => setInsightMode('mof_coverage')}
              isActive={insightMode === 'mof_coverage'}
              icon={<Layers3 className="w-5 h-5" />}
              variant={mofMandatoryCoveragePct === null ? 'default' : mofMandatoryCoveragePct >= 90 ? 'success' : mofMandatoryCoveragePct >= 75 ? 'warning' : 'danger'}
            />
          </div>
        </div>

        <div className="mb-8 animate-slide-up">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-foreground">Operational Risk Snapshot</h2>
            <span className="rounded-full border border-secondary/40 bg-secondary/20 px-3 py-1 text-xs text-muted-foreground">
              Scope: Latest operational records
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <StatsCard
              title="Repeat Rejection Risk"
              value={`${rejectionAnalytics.repeatRate.toFixed(1)}%`}
              subtitle={`${formatCount(rejectionAnalytics.totalRejections)} total rejection records`}
              helpText="Global repeat rejection rate from rejection logs. High values suggest unresolved root causes."
              onClick={() => setInsightMode('repeat')}
              isActive={insightMode === 'repeat'}
              icon={<RefreshCw className="w-5 h-5" />}
              variant={rejectionAnalytics.repeatRate > 20 ? 'danger' : rejectionAnalytics.repeatRate > 10 ? 'warning' : 'success'}
            />
            <StatsCard
              title="Open Cases"
              value={formatCount(slaMetrics.openCases)}
              subtitle={`${formatCount(slaMetrics.resolvedCases)} resolved cases`}
              helpText="Current remediation workload from open exception cases."
              icon={<FolderOpen className="w-5 h-5" />}
              variant={slaMetrics.openCases > 30 ? 'danger' : slaMetrics.openCases > 10 ? 'warning' : 'success'}
            />
            <StatsCard
              title="Latest Critical Pressure"
              value={formatPct(criticalDensity)}
              subtitle={criticalDensity === null ? 'No latest run data' : 'Critical exceptions per 100 invoices (latest run)'}
              helpText="Critical exception pressure from the most recent run, normalized by invoice volume."
              onClick={() => setInsightMode('critical')}
              isActive={insightMode === 'critical'}
              icon={<AlertTriangle className="w-5 h-5" />}
              variant={criticalDensity === null ? 'default' : criticalDensity > 10 ? 'danger' : criticalDensity > 3 ? 'warning' : 'success'}
            />
          </div>
        </div>

        {insightMode !== 'none' && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 animate-fade-in">
            <p className="text-sm text-foreground">
              Insight focus: <span className="font-semibold">{insightLabel[insightMode]}</span>. Leaderboards and relevant charts are narrowed for this view.
            </p>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setInsightMode('none')}>
              <FilterX className="w-4 h-4" />
              Clear Focus
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 animate-slide-up">
          <div className="surface-glass rounded-2xl border border-white/70 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Pass Rate Trend</h2>
            {focusTrendData.length > 1 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart key={chartAnimationSeed} data={focusTrendData} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="passRateLineGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.35} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value: number) => [`${value.toFixed(1)}%`, 'Pass Rate']}
                      contentStyle={{ borderRadius: 12, borderColor: 'hsl(var(--border))', background: 'hsl(var(--background))' }}
                      cursor={{ stroke: 'hsl(var(--primary))', strokeOpacity: 0.2 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="passRate"
                      stroke="url(#passRateLineGradient)"
                      strokeWidth={3}
                      dot={{ r: 3, strokeWidth: 2, fill: 'hsl(var(--background))' }}
                      activeDot={{ r: 6, strokeWidth: 2, fill: 'hsl(142, 71%, 45%)' }}
                      isAnimationActive
                      animationDuration={900}
                      animationEasing="ease-out"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">Run multiple checks to see trends</div>
            )}
          </div>

          <div className="surface-glass rounded-2xl border border-white/70 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Exceptions Over Time</h2>
            {focusTrendData.length > 1 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart key={`${chartAnimationSeed}-bar`} data={focusTrendData} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="criticalBarGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.95} />
                        <stop offset="100%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.55} />
                      </linearGradient>
                      <linearGradient id="nonCriticalBarGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(217, 91%, 40%)" stopOpacity={0.95} />
                        <stop offset="100%" stopColor="hsl(217, 91%, 40%)" stopOpacity={0.55} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, borderColor: 'hsl(var(--border))', background: 'hsl(var(--background))' }}
                      cursor={{ fill: 'hsl(var(--primary))', fillOpacity: 0.08 }}
                    />
                    <Bar
                      dataKey="critical"
                      fill="url(#criticalBarGradient)"
                      name="Critical"
                      stackId="stack"
                      radius={[6, 6, 0, 0]}
                      isAnimationActive
                      animationDuration={850}
                      animationEasing="ease-out"
                    />
                    {insightMode !== 'critical' && (
                      <Bar
                        dataKey="nonCritical"
                        fill="url(#nonCriticalBarGradient)"
                        name="Non-Critical"
                        stackId="stack"
                        radius={[6, 6, 0, 0]}
                        isAnimationActive
                        animationDuration={1000}
                        animationEasing="ease-out"
                      />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">Run multiple checks to see trends</div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-slide-up">
          <div className="surface-glass rounded-2xl border border-white/70 shadow-sm">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Award className="w-5 h-5 text-primary" />
                {insightMode === 'repeat' ? 'Clients With Rejections' : insightMode === 'quality' ? 'Lowest Health Clients' : 'Client Health Leaderboard'}
              </h2>
            </div>
            <div className="divide-y">
              {visibleClientHealth.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">No client health data yet</div>
              ) : (
                visibleClientHealth.map((client, idx) => (
                  <div key={client.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                          idx === 0
                            ? 'bg-yellow-100 text-yellow-700'
                            : idx === 1
                              ? 'bg-gray-100 text-gray-700'
                              : idx === 2
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {idx + 1}
                      </span>
                      <div>
                        <p className="font-medium text-foreground">{client.client_name || client.seller_trn}</p>
                        <p className="text-xs text-muted-foreground">{client.total_invoices} invoices | {client.total_rejections} rejections</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-20 h-2 rounded-full bg-muted overflow-hidden">
                        <div className={cn('h-full rounded-full', getScoreBgColor(client.score))} style={{ width: `${client.score}%` }} />
                      </div>
                      <span className={cn('font-bold text-lg w-10 text-right', getScoreColor(client.score))}>{client.score.toFixed(0)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="surface-glass rounded-2xl border border-white/70 shadow-sm">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-severity-high" />
                {insightMode === 'critical' ? 'Critical Risk Sellers' : insightMode === 'quality' ? 'Low Pass-Quality Sellers' : 'Highest Risk Sellers'}
              </h2>
            </div>
            <div className="divide-y">
              {visibleRiskSellers.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">No risk data available</div>
              ) : (
                visibleRiskSellers.map((seller) => (
                  <div key={seller.id} className="p-4 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{seller.entity_name || seller.entity_id}</p>
                      <p className="text-xs text-muted-foreground">{seller.critical_count} critical | {seller.high_count} high | {seller.total_exceptions} total</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
                        <div className={cn('h-full rounded-full', getScoreBgColor(seller.score))} style={{ width: `${seller.score}%` }} />
                      </div>
                      <span className={cn('font-bold text-lg', getScoreColor(seller.score))}>{seller.score.toFixed(0)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
