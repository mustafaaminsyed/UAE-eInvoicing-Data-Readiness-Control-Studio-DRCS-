import { useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Briefcase,
  CheckCircle,
  Clock,
  FileText,
  TrendingUp,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCompliance } from '@/context/ComplianceContext';
import { StatsCard } from '@/components/StatsCard';
import { SeverityBadge } from '@/components/SeverityBadge';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { getLifecycleMetrics, getSLAMetrics } from '@/lib/api/casesApi';
import { fetchCheckRuns } from '@/lib/api/checksApi';
import { getUploadAuditLogs } from '@/lib/uploadAudit';
import { LifecycleMetrics, SLAMetrics, InvoiceStatus } from '@/types/cases';
import { CheckRun } from '@/types/customChecks';
import { PipelineProgress, PipelineStep, PipelineState } from '@/components/dashboard/PipelineProgress';

const SEVERITY_COLORS = {
  Critical: 'hsl(0, 84%, 60%)',
  High: 'hsl(25, 95%, 53%)',
  Medium: 'hsl(45, 93%, 47%)',
  Low: 'hsl(217, 91%, 60%)',
};

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  Received: '#6b7280',
  'Pre-Validated': '#3b82f6',
  Held: '#f59e0b',
  Submitted: '#06b6d4',
  Acknowledged: '#8b5cf6',
  Accepted: '#22c55e',
  Rejected: '#ef4444',
  Resolved: '#10b981',
  Resubmitted: '#f97316',
  Closed: '#4b5563',
};

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
    runSummary,
    buyers,
    headers,
    lines,
  } = useCompliance();

  const [lifecycleMetrics, setLifecycleMetrics] = useState<LifecycleMetrics | null>(null);
  const [slaMetrics, setSlaMetrics] = useState<SLAMetrics | null>(null);
  const [recentRuns, setRecentRuns] = useState<CheckRun[]>([]);

  useEffect(() => {
    loadMetrics();
  }, []);

  useEffect(() => {
    if (!isChecksRun) {
      navigate('/');
    }
  }, [isChecksRun, navigate]);

  const loadMetrics = async () => {
    const [lifecycle, sla, runs] = await Promise.allSettled([
      getLifecycleMetrics(),
      getSLAMetrics(),
      fetchCheckRuns(10),
    ]);

    if (lifecycle.status === 'fulfilled') {
      setLifecycleMetrics(lifecycle.value);
    }
    if (sla.status === 'fulfilled') {
      setSlaMetrics(sla.value);
    }
    if (runs.status === 'fulfilled') {
      setRecentRuns(runs.value);
    }
  };

  const stats = getDashboardStats();

  const severityData = Object.entries(stats.exceptionsBySeverity)
    .filter(([_, count]) => count > 0)
    .map(([severity, count]) => ({
      name: severity,
      value: count,
      color: SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS],
    }));

  const checkData = checkResults
    .filter((r) => r.failed > 0)
    .sort((a, b) => b.failed - a.failed)
    .slice(0, 6)
    .map((r) => ({
      name: r.checkName.substring(0, 20),
      fullName: r.checkName,
      exceptions: r.failed,
      severity: r.severity,
    }));

  const lifecycleData = lifecycleMetrics
    ? Object.entries(lifecycleMetrics.statusCounts)
        .filter(([_, count]) => count > 0)
        .map(([status, count]) => ({
          name: status,
          value: count,
          color: STATUS_COLORS[status as InvoiceStatus],
        }))
    : [];

  const pipelineSteps: PipelineStep[] = useMemo(() => {
    const ingest: PipelineState = isDataLoaded ? 'complete' : 'active';
    const map: PipelineState = !isDataLoaded ? 'blocked' : isChecksRun ? 'complete' : 'active';
    const validate: PipelineState = !isDataLoaded ? 'blocked' : isChecksRun ? 'complete' : 'pending';
    const control: PipelineState = isChecksRun ? 'active' : !isDataLoaded ? 'blocked' : 'pending';

    return [
      { id: 'ingest', label: 'Ingest', state: ingest },
      { id: 'map', label: 'Map', state: map },
      { id: 'validate', label: 'Validate', state: validate },
      { id: 'control', label: 'Control', state: control },
    ];
  }, [isDataLoaded, isChecksRun]);

  const categoryCoverage = useMemo(() => {
    const coverage = (records: Record<string, unknown>[], fields: string[]) => {
      if (records.length === 0 || fields.length === 0) return 0;
      let present = 0;
      records.forEach((record) => {
        fields.forEach((field) => {
          const value = record[field];
          if (value !== undefined && value !== null && String(value).trim() !== '') {
            present++;
          }
        });
      });
      return (present / (records.length * fields.length)) * 100;
    };

    const headerCoverage = coverage(headers as unknown as Record<string, unknown>[], [
      'invoice_id',
      'invoice_number',
      'issue_date',
      'currency',
      'invoice_type',
    ]);

    const supplierCoverage = coverage(headers as unknown as Record<string, unknown>[], [
      'seller_trn',
      'seller_name',
      'seller_country',
      'seller_address',
    ]);

    const buyerCoverage = coverage(buyers as unknown as Record<string, unknown>[], [
      'buyer_id',
      'buyer_name',
      'buyer_country',
      'buyer_trn',
    ]);

    const taxHeader = coverage(headers as unknown as Record<string, unknown>[], [
      'total_excl_vat',
      'vat_total',
      'total_incl_vat',
      'tax_currency',
    ]);
    const taxLine = coverage(lines as unknown as Record<string, unknown>[], [
      'vat_rate',
      'vat_amount',
      'tax_category_code',
    ]);
    const taxCoverage = (taxHeader + taxLine) / 2;

    const linesCoverage = coverage(lines as unknown as Record<string, unknown>[], [
      'line_id',
      'line_number',
      'quantity',
      'unit_price',
      'line_total_excl_vat',
    ]);

    return [
      { category: 'Header', value: headerCoverage },
      { category: 'Supplier', value: supplierCoverage },
      { category: 'Buyer', value: buyerCoverage },
      { category: 'Tax', value: taxCoverage },
      { category: 'Lines', value: linesCoverage },
    ];
  }, [buyers, headers, lines]);

  const activityFeed = useMemo(() => {
    const uploads = getUploadAuditLogs().slice(0, 10).map((entry) => ({
      id: `upload-${entry.id}`,
      createdAt: entry.createdAt,
      category: 'Data',
      label: `${entry.datasetType || 'AR'} upload (${entry.headersCount} invoices, ${entry.linesCount} lines)`,
      path: '/upload-audit',
    }));

    const runs = recentRuns.map((run) => ({
      id: `run-${run.id}`,
      createdAt: run.run_date,
      category: 'Compliance',
      label: `Validation run (${run.dataset_type || 'AR'}): ${run.total_exceptions} exceptions`,
      path: '/run',
    }));

    return [...uploads, ...runs]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);
  }, [recentRuns]);

  const systemStatus = isRunning
    ? { label: 'Checks Running', className: 'bg-primary/15 text-primary border-primary/25' }
    : isChecksRun
    ? {
        label: 'Validated',
        className: 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] border-[hsl(var(--success))]/25',
      }
    : isDataLoaded
    ? {
        label: 'Dataset Loaded',
        className: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25',
      }
    : { label: 'Awaiting Data', className: 'bg-muted text-muted-foreground border-border' };

  if (!isChecksRun) {
    return null;
  }

  return (
    <div className="space-y-6">
            <div className="rounded-xl border border-border/70 bg-card shadow-lg p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Dataset</span>
                <div className="inline-flex rounded-lg border border-border bg-background p-1">
                  <Button
                    size="sm"
                    variant={activeDatasetType === 'AR' ? 'default' : 'ghost'}
                    onClick={() => setActiveDatasetType('AR')}
                    className="h-8 text-xs"
                  >
                    AR / Outbound
                  </Button>
                  <Button
                    size="sm"
                    variant={activeDatasetType === 'AP' ? 'default' : 'ghost'}
                    onClick={() => setActiveDatasetType('AP')}
                    className="h-8 text-xs"
                  >
                    AP / Inbound
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <Badge variant="outline" className="rounded-md border-border">
                  PINT-AE UAE UC1 v1.0
                </Badge>
                <Badge variant="outline" className={systemStatus.className}>
                  {systemStatus.label}
                </Badge>
              </div>
            </div>

            <PipelineProgress steps={pipelineSteps} />

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <StatsCard
                title="Total Invoices"
                value={stats.totalInvoices}
                icon={<FileText className="w-5 h-5" />}
                variant="default"
              />
              <StatsCard
                title="Total Exceptions"
                value={stats.totalExceptions}
                icon={<Briefcase className="w-5 h-5" />}
                variant={stats.totalExceptions > 0 ? 'danger' : 'success'}
              />
              <StatsCard
                title="Pass Rate"
                value={`${stats.passRate.toFixed(1)}%`}
                icon={<TrendingUp className="w-5 h-5" />}
                variant={stats.passRate >= 90 ? 'success' : stats.passRate >= 70 ? 'warning' : 'danger'}
              />
              <StatsCard
                title="Critical Issues"
                value={stats.exceptionsBySeverity.Critical}
                icon={<Clock className="w-5 h-5" />}
                variant={stats.exceptionsBySeverity.Critical > 0 ? 'danger' : 'success'}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-xl border border-border/70 bg-card shadow-lg p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-foreground">Validation Results Preview</h2>
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => navigate('/exceptions')}>
                    Open Exceptions <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </div>
                {checkData.length > 0 ? (
                  <div className="space-y-2">
                    {checkData.slice(0, 5).map((item) => (
                      <div key={item.fullName} className="flex items-center justify-between rounded-lg border border-border/70 p-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{item.fullName}</p>
                          <div className="mt-1">
                            <SeverityBadge severity={item.severity} />
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-destructive">{item.exceptions}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/10 p-4 text-sm text-[hsl(var(--success))]">
                    No failed checks in current run.
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-border/70 bg-card shadow-lg p-5">
                <h2 className="text-sm font-semibold text-foreground mb-3">Mapping Confidence</h2>
                <div className="space-y-3">
                  {categoryCoverage.map((entry) => (
                    <div key={entry.category}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-foreground">{entry.category}</span>
                        <span className="text-muted-foreground">{entry.value.toFixed(0)}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={
                            entry.value >= 90
                              ? 'h-full bg-[hsl(var(--success))]'
                              : entry.value >= 70
                              ? 'h-full bg-amber-500'
                              : 'h-full bg-destructive'
                          }
                          style={{ width: `${Math.max(0, Math.min(100, entry.value))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="rounded-xl border border-border/70 bg-card shadow-lg p-5">
                <h2 className="text-sm font-semibold mb-3">Data</h2>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-between" onClick={() => navigate('/upload')}>
                    Ingestion Workspace <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" className="w-full justify-between" onClick={() => navigate('/upload-audit')}>
                    Upload Audit <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-border/70 bg-card shadow-lg p-5">
                <h2 className="text-sm font-semibold mb-3">Compliance</h2>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-between" onClick={() => navigate('/run')}>
                    Run Validation <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" className="w-full justify-between" onClick={() => navigate('/exceptions')}>
                    Exceptions Queue <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-border/70 bg-card shadow-lg p-5">
                <h2 className="text-sm font-semibold mb-3">Governance</h2>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-between" onClick={() => navigate('/cases')}>
                    Cases <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" className="w-full justify-between" onClick={() => navigate('/evidence-pack')}>
                    Evidence Pack <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {slaMetrics && slaMetrics.totalCases > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatsCard
                  title="Open Cases"
                  value={slaMetrics.openCases}
                  icon={<Briefcase className="w-5 h-5" />}
                  variant={slaMetrics.openCases > 0 ? 'warning' : 'success'}
                />
                <StatsCard
                  title="SLA Breached"
                  value={slaMetrics.breachedCases}
                  subtitle={`${slaMetrics.breachPercentage.toFixed(1)}% of total`}
                  icon={<Clock className="w-5 h-5" />}
                  variant={slaMetrics.breachedCases > 0 ? 'danger' : 'success'}
                />
                <StatsCard
                  title="Resolved Cases"
                  value={slaMetrics.resolvedCases}
                  icon={<CheckCircle className="w-5 h-5" />}
                  variant="success"
                />
                <StatsCard
                  title="Total Cases"
                  value={slaMetrics.totalCases}
                  icon={<Briefcase className="w-5 h-5" />}
                  variant="default"
                />
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="rounded-xl border border-border/70 bg-card shadow-lg p-5 lg:col-span-2">
                <h2 className="text-sm font-semibold text-foreground mb-4">Exceptions by Severity</h2>
                {severityData.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={severityData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {severityData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
                    No exceptions found in current run.
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-border/70 bg-card shadow-lg p-5">
                <h2 className="text-sm font-semibold text-foreground mb-4">Activity Log (Last 10)</h2>
                <div className="space-y-2 max-h-64 overflow-auto pr-1">
                  {activityFeed.length > 0 ? (
                    activityFeed.map((entry) => (
                      <button
                        key={entry.id}
                        className="w-full rounded-lg border border-border/70 p-2 text-left hover:bg-muted/40 transition-colors"
                        onClick={() => navigate(entry.path)}
                      >
                        <p className="text-xs font-semibold text-muted-foreground">{entry.category}</p>
                        <p className="text-sm">{entry.label}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                        </p>
                      </button>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No recent actions recorded.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border/70 bg-card shadow-lg p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">Invoice Lifecycle Status</h2>
              {lifecycleData.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={lifecycleData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {lifecycleData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">No lifecycle data yet.</div>
              )}
            </div>

            <div className="rounded-xl border border-border/70 bg-card shadow-lg">
              <div className="p-5 border-b border-border/70 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">All Check Results</h2>
                <div className="flex items-center gap-2">
                  {runSummary && <Badge variant="outline">Run ID: {runSummary.run_id.slice(0, 8)}...</Badge>}
                  <Button onClick={() => navigate('/exceptions')} size="sm" className="gap-1.5">
                    View All Exceptions
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Check Name</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Severity</th>
                      <th className="text-right p-4 text-sm font-medium text-muted-foreground">Passed</th>
                      <th className="text-right p-4 text-sm font-medium text-muted-foreground">Failed</th>
                      <th className="text-right p-4 text-sm font-medium text-muted-foreground">Pass Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checkResults.map((result) => {
                      const total = result.passed + result.failed;
                      const passRate = total > 0 ? (result.passed / total) * 100 : 100;

                      return (
                        <tr key={result.checkId} className="border-b hover:bg-muted/20 transition-colors">
                          <td className="p-4 font-medium text-foreground">{result.checkName}</td>
                          <td className="p-4">
                            <SeverityBadge severity={result.severity} />
                          </td>
                          <td className="p-4 text-right text-success font-medium">{result.passed}</td>
                          <td className="p-4 text-right text-severity-critical font-medium">{result.failed}</td>
                          <td className="p-4 text-right">
                            <span className={passRate >= 90 ? 'text-success' : passRate >= 70 ? 'text-severity-medium' : 'text-severity-critical'}>
                              {passRate.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
    </div>
  );
}
