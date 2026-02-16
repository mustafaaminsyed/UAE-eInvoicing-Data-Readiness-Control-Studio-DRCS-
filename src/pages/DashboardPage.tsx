import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp,
  ArrowRight,
  Clock,
  Briefcase,
  XCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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

export default function DashboardPage() {
  const navigate = useNavigate();
  const { isChecksRun, getDashboardStats, checkResults } = useCompliance();
  const [lifecycleMetrics, setLifecycleMetrics] = useState<LifecycleMetrics | null>(null);
  const [slaMetrics, setSlaMetrics] = useState<SLAMetrics | null>(null);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    const [lifecycle, sla] = await Promise.all([
      getLifecycleMetrics(),
      getSLAMetrics(),
    ]);
    setLifecycleMetrics(lifecycle);
    setSlaMetrics(sla);
  };

  if (!isChecksRun) {
    navigate('/');
    return null;
  }

  const stats = getDashboardStats();
  
  const severityData = Object.entries(stats.exceptionsBySeverity)
    .filter(([_, count]) => count > 0)
    .map(([severity, count]) => ({
      name: severity,
      value: count,
      color: SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS],
    }));

  const checkData = checkResults
    .filter(r => r.failed > 0)
    .sort((a, b) => b.failed - a.failed)
    .slice(0, 6)
    .map(r => ({
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
          {checkData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={checkData} layout="vertical" margin={{ left: 0, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value, name, props) => [value, props.payload.fullName]} />
                  <Bar dataKey="exceptions" fill="hsl(217, 91%, 40%)" radius={[0, 4, 4, 0]} />
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
                      <td className="p-4"><SeverityBadge severity={result.severity} /></td>
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
    </div>
  );
}


