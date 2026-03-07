import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Calendar,
  RefreshCw,
  Award,
  XCircle,
  FilterX,
  Shield,
  FileCheck,
  Layers3,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { StatsCard } from '@/components/StatsCard';
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
import { fetchClientHealthScores, getRejectionAnalytics } from '@/lib/api/casesApi';
import { CheckRun, EntityScore } from '@/types/customChecks';
import { ClientHealth } from '@/types/cases';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { computeTraceabilityMatrix } from '@/lib/coverage/conformanceEngine';
import { computeMoFCoverage } from '@/lib/coverage/mofCoverageEngine';

type InsightMode = 'none' | 'quality' | 'rejections' | 'repeat' | 'critical' | 'volume' | 'dr_coverage' | 'mof_coverage';

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
  const { toast } = useToast();
  const [checkRuns, setCheckRuns] = useState<CheckRun[]>([]);
  const [clientHealth, setClientHealth] = useState<ClientHealth[]>([]);
  const [topRiskSellers, setTopRiskSellers] = useState<EntityScore[]>([]);
  const [rejectionAnalytics, setRejectionAnalytics] = useState({ totalRejections: 0, repeatRate: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('all');
  const [insightMode, setInsightMode] = useState<InsightMode>('none');

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
      const [runs, health, sellers, rejections] = await Promise.all([
        fetchCheckRuns(20),
        fetchClientHealthScores(),
        fetchLatestEntityScores('seller', 10),
        getRejectionAnalytics(),
      ]);
      setCheckRuns(runs);
      setClientHealth(health);
      setTopRiskSellers(sellers);
      setRejectionAnalytics(rejections);
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

  const trendData = filteredRuns.map((run) => ({
    date: new Date(run.run_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    passRate: run.pass_rate,
    exceptions: run.total_exceptions,
    critical: run.critical_count,
    nonCritical: Math.max(0, run.total_exceptions - run.critical_count),
  }));

  const latestRun = filteredRuns.length > 0 ? filteredRuns[filteredRuns.length - 1] : undefined;
  const previousRun = filteredRuns.length > 1 ? filteredRuns[filteredRuns.length - 2] : undefined;
  const passRateTrend = latestRun && previousRun ? latestRun.pass_rate - previousRun.pass_rate : 0;

  const avgHealthScore =
    clientHealth.length > 0 ? clientHealth.reduce((sum, c) => sum + c.score, 0) / clientHealth.length : null;
  const latestPassRate = latestRun?.pass_rate ?? null;
  const periodRunCount = filteredRuns.length;
  const avgPassRatePeriod = periodRunCount > 0
    ? filteredRuns.reduce((sum, r) => sum + r.pass_rate, 0) / periodRunCount
    : null;
  const exceptionsPerInvoice = latestRun && latestRun.total_invoices > 0
    ? latestRun.total_exceptions / latestRun.total_invoices
    : null;
  const criticalDensity = latestRun && latestRun.total_invoices > 0
    ? (latestRun.critical_count / latestRun.total_invoices) * 100
    : null;

  const formatPct = (value: number | null, digits = 1) => (value === null ? 'N/A' : `${value.toFixed(digits)}%`);
  const formatNum = (value: number | null, digits = 1) => (value === null ? 'N/A' : value.toFixed(digits));

  const readinessScore = useMemo(() => {
    const normalizedPassRate = latestPassRate ?? 0;
    const normalizedDrCoverage = drCoverageSummary.percent;
    const normalizedMoFCoverage = mofMandatoryCoveragePct ?? 0;
    const normalizedCriticalRisk = criticalDensity === null ? 100 : Math.max(0, 100 - Math.min(criticalDensity * 4, 100));
    return (
      normalizedPassRate * 0.4 +
      normalizedDrCoverage * 0.25 +
      normalizedMoFCoverage * 0.25 +
      normalizedCriticalRisk * 0.1
    );
  }, [latestPassRate, drCoverageSummary.percent, mofMandatoryCoveragePct, criticalDensity]);

  const readinessBand = useMemo(() => {
    if (readinessScore >= 90) return { label: 'Controlled', color: 'text-success', hint: 'Strong readiness posture' };
    if (readinessScore >= 75) return { label: 'Watch', color: 'text-severity-medium', hint: 'Monitor and remediate key gaps' };
    if (readinessScore >= 60) return { label: 'Exposed', color: 'text-severity-high', hint: 'Material risk is building' };
    return { label: 'Critical', color: 'text-severity-critical', hint: 'Immediate remediation required' };
  }, [readinessScore]);

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
    if (insightMode === 'rejections' || insightMode === 'repeat') {
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
    rejections: 'Rejection Risk',
    repeat: 'Repeat Failure Risk',
    critical: 'Critical Exceptions',
    volume: 'Run Volume',
    dr_coverage: 'DR Coverage',
    mof_coverage: 'MoF Mandatory Coverage',
  };
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

        <div className="mb-8 rounded-2xl border border-white/70 surface-glass p-5 animate-slide-up">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Compliance readiness band</p>
              <div className="mt-1 flex items-end gap-2">
                <p className="text-3xl font-bold text-foreground">{readinessScore.toFixed(1)}%</p>
                <p className={cn('text-sm font-semibold pb-1', readinessBand.color)}>{readinessBand.label}</p>
              </div>
              <p className="text-sm text-muted-foreground">{readinessBand.hint}</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Info className="h-4 w-4" />
              <span>Thresholds: Critical &lt;60 | Exposed 60-74 | Watch 75-89 | Controlled 90+</span>
            </div>
          </div>
          <div className="mt-4">
            <div className="relative h-3 overflow-hidden rounded-full bg-muted">
              <div className="grid h-full grid-cols-4">
                <div className="bg-severity-critical/70" />
                <div className="bg-severity-high/70" />
                <div className="bg-severity-medium/70" />
                <div className="bg-success/70" />
              </div>
              <span
                className="pointer-events-none absolute top-[-2px] h-7 w-[2px] rounded bg-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.18)]"
                style={{ left: `calc(${Math.min(Math.max(readinessScore, 0), 100)}% - 1px)` }}
                aria-hidden="true"
              />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
              <div className="rounded-md border border-severity-critical/40 bg-severity-critical-bg/60 px-2 py-1 text-severity-critical">Critical (&lt;60)</div>
              <div className="rounded-md border border-severity-high/40 bg-severity-high-bg/60 px-2 py-1 text-severity-high">Exposed (60-74)</div>
              <div className="rounded-md border border-severity-medium/40 bg-severity-medium-bg/60 px-2 py-1 text-severity-medium">Watch (75-89)</div>
              <div className="rounded-md border border-success/40 bg-success-bg/60 px-2 py-1 text-success">Controlled (90+)</div>
            </div>
            <div className="mt-2">
              <Progress value={readinessScore} className="h-2" />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Readiness score combines latest check pass rate, PINT-AE DR coverage, MoF mandatory coverage, and critical exception pressure.
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Weighting: pass rate 40% | PINT-AE DR coverage 25% | MoF mandatory coverage 25% | critical pressure 10%.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8 animate-slide-up">
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
            helpText="Percentage of validation checks that passed in the most recent run in the selected time range."
            onClick={() => setInsightMode('quality')}
            isActive={insightMode === 'quality'}
            icon={<FileCheck className="w-5 h-5" />}
            variant={latestPassRate === null ? 'default' : latestPassRate >= 90 ? 'success' : latestPassRate >= 70 ? 'warning' : 'danger'}
          />
          <StatsCard
            title="PINT-AE DR Coverage"
            value={`${drCoverageSummary.percent.toFixed(1)}%`}
            subtitle={`${drCoverageSummary.covered} of ${drCoverageSummary.total} DRs have rule+control linkage`}
            helpText="PINT-AE coverage across mapped data requirements. A DR is counted when linked to at least one validation rule and one control."
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
            helpText="Mandatory-field coverage using the MoF source-truth layer across tax_invoice and commercial_xml document types."
            onClick={() => setInsightMode('mof_coverage')}
            isActive={insightMode === 'mof_coverage'}
            icon={<Layers3 className="w-5 h-5" />}
            variant={mofMandatoryCoveragePct === null ? 'default' : mofMandatoryCoveragePct >= 90 ? 'success' : mofMandatoryCoveragePct >= 75 ? 'warning' : 'danger'}
          />
          <StatsCard
            title="Critical Exception Pressure"
            value={formatPct(criticalDensity)}
            subtitle={criticalDensity === null ? 'No latest run data' : 'Critical exceptions per 100 invoices'}
            helpText="Critical exception rate normalized by invoice volume, so risk can be compared across periods."
            onClick={() => setInsightMode('critical')}
            isActive={insightMode === 'critical'}
            icon={<AlertTriangle className="w-5 h-5" />}
            variant={criticalDensity === null ? 'default' : criticalDensity > 10 ? 'danger' : criticalDensity > 3 ? 'warning' : 'success'}
          />
          <StatsCard
            title="Repeat Rejection Risk"
            value={`${rejectionAnalytics.repeatRate.toFixed(1)}%`}
            subtitle={`${rejectionAnalytics.totalRejections} rejected records in selected analytics scope`}
            helpText="How often rejected issues reoccur. Higher values indicate unresolved root causes."
            onClick={() => setInsightMode('repeat')}
            isActive={insightMode === 'repeat'}
            icon={<RefreshCw className="w-5 h-5" />}
            variant={rejectionAnalytics.repeatRate > 20 ? 'danger' : rejectionAnalytics.repeatRate > 10 ? 'warning' : 'success'}
          />
          <StatsCard
            title="Run Quality Signal"
            value={avgHealthScore === null ? 'N/A' : avgHealthScore.toFixed(0)}
            subtitle={avgHealthScore === null ? 'No client score data yet' : `${periodRunCount} runs | Avg pass ${formatPct(avgPassRatePeriod)}`}
            helpText="Composite quality signal blending client health trend and recent run performance."
            onClick={() => setInsightMode('quality')}
            isActive={insightMode === 'quality'}
            icon={<Award className="w-5 h-5" />}
            variant={avgHealthScore === null ? 'default' : avgHealthScore >= 80 ? 'success' : avgHealthScore >= 60 ? 'warning' : 'danger'}
          />
        </div>

        {insightMode !== 'none' && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 animate-fade-in">
            <p className="text-sm text-foreground">
              Insight focus: <span className="font-semibold">{insightLabel[insightMode]}</span>. Charts and leaderboards are filtered for this view.
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
                {insightMode === 'rejections' || insightMode === 'repeat' ? 'Clients With Rejections' : insightMode === 'quality' ? 'Lowest Health Clients' : 'Client Health Leaderboard'}
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
