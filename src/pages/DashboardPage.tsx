import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp,
  ArrowRight,
  Clock,
  Briefcase,
  XCircle,
  Search,
  Download,
  Save,
  Trash2,
  SlidersHorizontal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  Cell
} from 'recharts';
import { getLifecycleMetrics, getSLAMetrics } from '@/lib/api/casesApi';
import { LifecycleMetrics, SLAMetrics, InvoiceStatus } from '@/types/cases';
import { Severity } from '@/types/compliance';
import { Direction } from '@/types/direction';


const SEVERITY_COLORS = {
  Critical: 'hsl(0, 84%, 60%)',
  High: 'hsl(25, 95%, 53%)',
  Medium: 'hsl(45, 93%, 47%)',
  Low: 'hsl(217, 91%, 60%)',
};

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  'Received': '#6b7280',
  'Pre-Validated': '#3b82f6',
  'Held': '#f59e0b',
  'Submitted': '#06b6d4',
  'Acknowledged': '#8b5cf6',
  'Accepted': '#22c55e',
  'Rejected': '#ef4444',
  'Resolved': '#10b981',
  'Resubmitted': '#f97316',
  'Closed': '#4b5563',
};

type ResultsColumnKey = 'checkName' | 'severity' | 'passed' | 'failed' | 'passRate' | 'drilldown';

type ResultsViewConfig = {
  search: string;
  severityFilter: Severity | 'all';
  sort: 'failed_desc' | 'failed_asc' | 'pass_desc' | 'pass_asc';
  visibleColumns: Record<ResultsColumnKey, boolean>;
};

type ResultsSavedView = {
  id: string;
  name: string;
  config: ResultsViewConfig;
};

const RESULTS_SAVED_VIEWS_KEY = 'results_saved_views_v1';
const defaultResultsColumns: Record<ResultsColumnKey, boolean> = {
  checkName: true,
  severity: true,
  passed: true,
  failed: true,
  passRate: true,
  drilldown: true,
};

function exportResultsCsv(rows: Array<{ checkId: string; checkName: string; severity: Severity; passed: number; failed: number }>) {
  const csv = [
    ['Check ID', 'Check Name', 'Severity', 'Passed', 'Failed', 'Pass Rate'].join(','),
    ...rows.map((row) => {
      const total = row.passed + row.failed;
      const passRate = total > 0 ? ((row.passed / total) * 100).toFixed(1) : '100.0';
      return [`"${row.checkId}"`, `"${row.checkName.replace(/"/g, '""')}"`, row.severity, row.passed, row.failed, `${passRate}%`].join(',');
    }),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `check_results_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { isChecksRun, getDashboardStats, checkResults, direction } = useCompliance();
  const [lifecycleMetrics, setLifecycleMetrics] = useState<LifecycleMetrics | null>(null);
  const [slaMetrics, setSlaMetrics] = useState<SLAMetrics | null>(null);
  const [resultsSearch, setResultsSearch] = useState('');
  const [resultsSeverityFilter, setResultsSeverityFilter] = useState<Severity | 'all'>('all');
  const [resultsSort, setResultsSort] = useState<'failed_desc' | 'failed_asc' | 'pass_desc' | 'pass_asc'>('failed_desc');
  const [visibleResultsColumns, setVisibleResultsColumns] = useState<Record<ResultsColumnKey, boolean>>(defaultResultsColumns);
  const [resultsSavedViews, setResultsSavedViews] = useState<ResultsSavedView[]>([]);
  const [selectedResultsViewId, setSelectedResultsViewId] = useState<string>('none');
  const [directionFilter, setDirectionFilter] = useState<Direction | 'all'>(direction);

  useEffect(() => {
    loadMetrics();
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem(RESULTS_SAVED_VIEWS_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as ResultsSavedView[];
      if (Array.isArray(parsed)) setResultsSavedViews(parsed);
    } catch {
      // Ignore malformed saved views
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(RESULTS_SAVED_VIEWS_KEY, JSON.stringify(resultsSavedViews));
  }, [resultsSavedViews]);

  useEffect(() => {
    setDirectionFilter((current) => (current === 'all' ? current : direction));
  }, [direction]);

  useEffect(() => {
    if (!isChecksRun) {
      navigate('/');
    }
  }, [isChecksRun, navigate]);

  const loadMetrics = async () => {
    const [lifecycle, sla] = await Promise.all([
      getLifecycleMetrics(),
      getSLAMetrics(),
    ]);
    setLifecycleMetrics(lifecycle);
    setSlaMetrics(sla);
  };

  const stats = getDashboardStats(directionFilter);
  
  const severityData = Object.entries(stats.exceptionsBySeverity)
    .filter(([_, count]) => count > 0)
    .map(([severity, count]) => ({
      name: severity,
      value: count,
      color: SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS],
    }));

  const directionScopedChecks = checkResults.filter(
    (result) => directionFilter === 'all' || (result.direction || direction) === directionFilter,
  );

  const checkData = directionScopedChecks
    .filter(r => r.failed > 0)
    .sort((a, b) => b.failed - a.failed)
    .slice(0, 6)
    .map(r => ({
      name: r.checkName.substring(0, 20),
      fullName: r.checkName,
      checkId: r.checkId,
      exceptions: r.failed,
      severity: r.severity,
    }));

  const filteredAndSortedResults = useMemo(() => {
    const filtered = directionScopedChecks.filter((result) => {
      const matchesSearch =
        !resultsSearch ||
        result.checkName.toLowerCase().includes(resultsSearch.toLowerCase()) ||
        result.checkId.toLowerCase().includes(resultsSearch.toLowerCase());
      const matchesSeverity = resultsSeverityFilter === 'all' || result.severity === resultsSeverityFilter;
      return matchesSearch && matchesSeverity;
    });

    return filtered.sort((a, b) => {
      const totalA = a.passed + a.failed;
      const totalB = b.passed + b.failed;
      const passA = totalA > 0 ? (a.passed / totalA) * 100 : 100;
      const passB = totalB > 0 ? (b.passed / totalB) * 100 : 100;
      if (resultsSort === 'failed_desc') return b.failed - a.failed;
      if (resultsSort === 'failed_asc') return a.failed - b.failed;
      if (resultsSort === 'pass_desc') return passB - passA;
      return passA - passB;
    });
  }, [directionScopedChecks, resultsSearch, resultsSeverityFilter, resultsSort]);

  const lifecycleData = lifecycleMetrics 
    ? Object.entries(lifecycleMetrics.statusCounts)
        .filter(([_, count]) => count > 0)
        .map(([status, count]) => ({
          name: status,
          value: count,
          color: STATUS_COLORS[status as InvoiceStatus],
        }))
    : [];

  const applyResultsView = (config: ResultsViewConfig) => {
    setResultsSearch(config.search);
    setResultsSeverityFilter(config.severityFilter);
    setResultsSort(config.sort);
    setVisibleResultsColumns(config.visibleColumns);
  };

  const handleSaveResultsView = () => {
    const name = window.prompt('Results view name');
    if (!name) return;
    const config: ResultsViewConfig = {
      search: resultsSearch,
      severityFilter: resultsSeverityFilter,
      sort: resultsSort,
      visibleColumns: visibleResultsColumns,
    };
    const view: ResultsSavedView = {
      id: `results_view_${Date.now()}`,
      name,
      config,
    };
    setResultsSavedViews((prev) => [view, ...prev]);
    setSelectedResultsViewId(view.id);
  };

  const handleDeleteResultsView = () => {
    if (selectedResultsViewId === 'none') return;
    setResultsSavedViews((prev) => prev.filter((view) => view.id !== selectedResultsViewId));
    setSelectedResultsViewId('none');
  };

  if (!isChecksRun) return null;

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="container max-w-7xl py-8 md:py-10">
        <div className="flex items-center justify-between mb-8 animate-fade-in">
          <div>
            <h1 className="font-display text-3xl font-semibold text-foreground">
              Operations Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">
              Compliance checks, lifecycle status & SLA summary
            </p>
            <div className="mt-3">
              <Select value={directionFilter} onValueChange={(value) => setDirectionFilter(value as Direction | 'all')}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Direction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Directions</SelectItem>
                  <SelectItem value="AR">Outbound (AR)</SelectItem>
                  <SelectItem value="AP">Inbound (AP)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={() => navigate('/exceptions')} className="gap-2">
            View All Exceptions
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-slide-up">
          <StatsCard
            title="Total Invoices"
            value={stats.totalInvoices}
            icon={<FileText className="w-5 h-5" />}
            variant="default"
          />
          <StatsCard
            title="Total Exceptions"
            value={stats.totalExceptions}
            icon={<AlertTriangle className="w-5 h-5" />}
            variant={stats.totalExceptions > 0 ? 'danger' : 'success'}
            onClick={() => navigate('/exceptions')}
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
            icon={<AlertTriangle className="w-5 h-5" />}
            variant={stats.exceptionsBySeverity.Critical > 0 ? 'danger' : 'success'}
            onClick={() => navigate('/exceptions?severity=Critical')}
          />
        </div>

        {/* SLA & Case Summary */}
        {slaMetrics && slaMetrics.totalCases > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 animate-slide-up">
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

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 animate-slide-up">
          {/* Severity Distribution */}
          <div className="surface-glass rounded-2xl border border-white/70 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Exceptions by Severity
            </h2>
            <p className="mb-3 text-xs text-muted-foreground">Click a segment to drill down into filtered exceptions.</p>
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
                      onClick={(entry) => navigate(`/exceptions?severity=${encodeURIComponent(entry.name)}`)}
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
              <div className="h-64 flex items-center justify-center">
                <div className="text-center">
                  <CheckCircle className="w-12 h-12 text-success mx-auto mb-2" />
                  <p className="text-muted-foreground">No exceptions found!</p>
                </div>
              </div>
            )}
          </div>

          {/* Lifecycle Status */}
          <div className="surface-glass rounded-2xl border border-white/70 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Invoice Lifecycle Status
            </h2>
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
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No lifecycle data yet
              </div>
            )}
          </div>
        </div>

        {/* Top Failing Checks */}
        <div className="surface-glass rounded-2xl border border-white/70 shadow-sm p-6 mb-8 animate-slide-up">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Top Failing Checks
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">Click a bar to open exceptions for that check.</p>
          {checkData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={checkData} layout="vertical" margin={{ left: 0, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value, name, props) => [value, props.payload.fullName]} />
                  <Bar
                    dataKey="exceptions"
                    fill="hsl(217, 91%, 40%)"
                    radius={[0, 4, 4, 0]}
                    onClick={(entry) => navigate(`/exceptions?checkId=${encodeURIComponent(entry.checkId)}`)}
                    className="cursor-pointer"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center">
              <div className="text-center">
                <CheckCircle className="w-12 h-12 text-success mx-auto mb-2" />
                <p className="text-muted-foreground">All checks passed!</p>
              </div>
            </div>
          )}
        </div>

        {/* Check Results Table */}
        <div className="surface-glass rounded-2xl border border-white/70 shadow-sm animate-slide-up">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold text-foreground">
              All Check Results
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {filteredAndSortedResults.length} of {directionScopedChecks.length} checks shown
            </p>
            <div className="mt-4 flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={resultsSearch}
                  onChange={(event) => setResultsSearch(event.target.value)}
                  placeholder="Search by check name or ID..."
                  className="pl-10"
                />
              </div>
              <Select value={resultsSeverityFilter} onValueChange={(value) => setResultsSeverityFilter(value as Severity | 'all')}>
                <SelectTrigger className="w-full md:w-44">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="Critical">Critical</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                </SelectContent>
              </Select>
              <Select value={resultsSort} onValueChange={(value) => setResultsSort(value as typeof resultsSort)}>
                <SelectTrigger className="w-full md:w-52">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="failed_desc">Most Failed First</SelectItem>
                  <SelectItem value="failed_asc">Least Failed First</SelectItem>
                  <SelectItem value="pass_desc">Highest Pass Rate</SelectItem>
                  <SelectItem value="pass_asc">Lowest Pass Rate</SelectItem>
                </SelectContent>
              </Select>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <SlidersHorizontal className="h-4 w-4" />
                    Columns
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel>Visible Columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem checked={visibleResultsColumns.checkName} onCheckedChange={(checked) => setVisibleResultsColumns((prev) => ({ ...prev, checkName: Boolean(checked) }))}>
                    Check Name
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={visibleResultsColumns.severity} onCheckedChange={(checked) => setVisibleResultsColumns((prev) => ({ ...prev, severity: Boolean(checked) }))}>
                    Severity
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={visibleResultsColumns.passed} onCheckedChange={(checked) => setVisibleResultsColumns((prev) => ({ ...prev, passed: Boolean(checked) }))}>
                    Passed
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={visibleResultsColumns.failed} onCheckedChange={(checked) => setVisibleResultsColumns((prev) => ({ ...prev, failed: Boolean(checked) }))}>
                    Failed
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={visibleResultsColumns.passRate} onCheckedChange={(checked) => setVisibleResultsColumns((prev) => ({ ...prev, passRate: Boolean(checked) }))}>
                    Pass Rate
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={visibleResultsColumns.drilldown} onCheckedChange={(checked) => setVisibleResultsColumns((prev) => ({ ...prev, drilldown: Boolean(checked) }))}>
                    Drill-down
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
              <Select
                value={selectedResultsViewId}
                onValueChange={(value) => {
                  setSelectedResultsViewId(value);
                  if (value === 'none') return;
                  const view = resultsSavedViews.find((item) => item.id === value);
                  if (view) applyResultsView(view.config);
                }}
              >
                <SelectTrigger className="w-full md:w-64">
                  <SelectValue placeholder="Saved views" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No saved view</SelectItem>
                  {resultsSavedViews.map((view) => (
                    <SelectItem key={view.id} value={view.id}>
                      {view.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" className="gap-2" onClick={handleSaveResultsView}>
                <Save className="h-4 w-4" />
                Save View
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={handleDeleteResultsView}
                disabled={selectedResultsViewId === 'none'}
              >
                <Trash2 className="h-4 w-4" />
                Delete View
              </Button>
              <Button
                variant="outline"
                className="gap-2 md:ml-auto"
                onClick={() =>
                  exportResultsCsv(
                    filteredAndSortedResults.map((result) => ({
                      checkId: result.checkId,
                      checkName: result.checkName,
                      severity: result.severity,
                      passed: result.passed,
                      failed: result.failed,
                    })),
                  )
                }
              >
                <Download className="h-4 w-4" />
                Export Filtered
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/30">
                  {visibleResultsColumns.checkName && <th className="text-left p-4 text-sm font-medium text-muted-foreground">Check Name</th>}
                  {visibleResultsColumns.severity && <th className="text-left p-4 text-sm font-medium text-muted-foreground">Severity</th>}
                  {visibleResultsColumns.passed && <th className="text-right p-4 text-sm font-medium text-muted-foreground">Passed</th>}
                  {visibleResultsColumns.failed && <th className="text-right p-4 text-sm font-medium text-muted-foreground">Failed</th>}
                  {visibleResultsColumns.passRate && <th className="text-right p-4 text-sm font-medium text-muted-foreground">Pass Rate</th>}
                  {visibleResultsColumns.drilldown && <th className="text-right p-4 text-sm font-medium text-muted-foreground">Drill-down</th>}
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedResults.map((result) => {
                  const total = result.passed + result.failed;
                  const passRate = total > 0 ? (result.passed / total) * 100 : 100;
                  
                  return (
                    <tr key={result.checkId} className="border-b hover:bg-muted/20 transition-colors">
                      {visibleResultsColumns.checkName && <td className="p-4 font-medium text-foreground">{result.checkName}</td>}
                      {visibleResultsColumns.severity && <td className="p-4"><SeverityBadge severity={result.severity} /></td>}
                      {visibleResultsColumns.passed && <td className="p-4 text-right text-success font-medium">{result.passed}</td>}
                      {visibleResultsColumns.failed && <td className="p-4 text-right text-severity-critical font-medium">{result.failed}</td>}
                      {visibleResultsColumns.passRate && (
                        <td className="p-4 text-right">
                          <span className={passRate >= 90 ? 'text-success' : passRate >= 70 ? 'text-severity-medium' : 'text-severity-critical'}>
                            {passRate.toFixed(1)}%
                          </span>
                        </td>
                      )}
                      {visibleResultsColumns.drilldown && (
                        <td className="p-4 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/exceptions?checkId=${encodeURIComponent(result.checkId)}`)}
                          >
                            View Exceptions
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {filteredAndSortedResults.length === 0 && (
                  <tr>
                    <td colSpan={Math.max(1, Object.values(visibleResultsColumns).filter(Boolean).length)} className="p-8 text-center text-muted-foreground">
                      No check results match your filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}



