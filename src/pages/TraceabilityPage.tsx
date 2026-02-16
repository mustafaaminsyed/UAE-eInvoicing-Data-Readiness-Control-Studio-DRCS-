import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, AlertTriangle, CheckCircle2, XCircle, Shield,
  Database, Info, Download, Lock, FileWarning
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useCompliance } from '@/context/ComplianceContext';
import { computeTraceabilityMatrix, TraceabilityRow, GapsSummary, CoverageStatus } from '@/lib/coverage/conformanceEngine';
import { computeAllDatasetPopulations } from '@/lib/coverage/populationCoverage';
import { CONFORMANCE_CONFIG } from '@/config/conformance';
import { DrillDownDialog } from '@/components/traceability/DrillDownDialog';
import { exportTraceabilityReport } from '@/lib/coverage/regulatoryExport';
import { runConsistencyChecks, ConsistencyReport } from '@/lib/coverage/consistencyValidator';

type FilterType = 'all' | 'mandatory' | 'pint-new' | 'pint-legacy' | 'unmapped' | 'not-ingestible' | 'low-population' | 'no-rules' | 'no-controls' | 'covered';

function CoverageStatusBadge({ status }: { status: CoverageStatus }) {
  const config: Record<CoverageStatus, { label: string; cls: string }> = {
    COVERED: { label: 'Covered', cls: 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border-[hsl(var(--success))]/20' },
    NO_CONTROL: { label: 'No Control', cls: 'bg-accent/10 text-accent-foreground border-accent/20' },
    NO_RULE: { label: 'No Rule', cls: 'bg-destructive/10 text-destructive border-destructive/20' },
    NOT_IN_TEMPLATE: { label: 'Not in Template', cls: 'bg-muted text-muted-foreground border-muted-foreground/20' },
  };
  const c = config[status];
  return <Badge variant="outline" className={cn('text-xs', c.cls)}>{c.label}</Badge>;
}

function GapsPanel({ gaps, specVersion }: { gaps: GapsSummary; specVersion: string }) {
  const cards = [
    {
      label: 'Not in Templates',
      value: gaps.mandatoryNotInTemplate,
      total: gaps.mandatoryDRs,
      icon: XCircle,
      color: gaps.mandatoryNotInTemplate > 0 ? 'text-destructive' : 'text-[hsl(var(--success))]',
      bg: gaps.mandatoryNotInTemplate > 0 ? 'bg-destructive/10' : 'bg-[hsl(var(--success))]/10',
    },
    {
      label: 'No Rules',
      value: gaps.drsWithNoRules,
      total: gaps.totalDRs,
      icon: Database,
      color: gaps.drsWithNoRules > 0 ? 'text-accent-foreground' : 'text-[hsl(var(--success))]',
      bg: gaps.drsWithNoRules > 0 ? 'bg-accent/10' : 'bg-[hsl(var(--success))]/10',
    },
    {
      label: 'No Controls',
      value: gaps.drsWithNoControls,
      total: gaps.totalDRs,
      icon: Lock,
      color: gaps.drsWithNoControls > 0 ? 'text-accent-foreground' : 'text-[hsl(var(--success))]',
      bg: gaps.drsWithNoControls > 0 ? 'bg-accent/10' : 'bg-[hsl(var(--success))]/10',
    },
    {
      label: 'Fully Covered',
      value: gaps.drsCovered,
      total: gaps.totalDRs,
      icon: CheckCircle2,
      color: 'text-[hsl(var(--success))]',
      bg: 'bg-[hsl(var(--success))]/10',
    },
    {
      label: 'Total DRs',
      value: gaps.totalDRs,
      total: null,
      icon: Shield,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Coverage Gaps</h2>
        <Badge variant="outline" className="text-xs">{specVersion}</Badge>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {cards.map(card => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="border">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn('p-1.5 rounded-lg', card.bg)}>
                    <Icon className={cn('w-4 h-4', card.color)} />
                  </div>
                  <span className="text-xs text-muted-foreground">{card.label}</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className={cn('text-2xl font-bold', card.color)}>{card.value}</span>
                  {card.total !== null && (
                    <span className="text-sm text-muted-foreground">/ {card.total}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function DatasetBadge({ dataset }: { dataset: string | null }) {
  if (!dataset) return <span className="text-xs text-muted-foreground">-</span>;
  const colors: Record<string, string> = {
    buyers: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    headers: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
    lines: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  };
  return (
    <Badge variant="outline" className={cn('text-xs', colors[dataset] || '')}>
      {dataset}
    </Badge>
  );
}

export default function TraceabilityPage() {
  const { buyers, headers, lines, isDataLoaded, pintAEExceptions } = useCompliance();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [drillDownRow, setDrillDownRow] = useState<TraceabilityRow | null>(null);
  const [showConsistency, setShowConsistency] = useState(false);

  const consistencyReport = useMemo(() => runConsistencyChecks(), []);

  const populations = useMemo(() => {
    if (!isDataLoaded) return [];
    const buyerRows = buyers.map(b => b as unknown as Record<string, string>);
    const headerRows = headers.map(h => {
      const row: Record<string, string> = {};
      for (const [k, v] of Object.entries(h)) {
        row[k] = v !== undefined && v !== null ? String(v) : '';
      }
      return row;
    });
    const lineRows = lines.map(l => {
      const row: Record<string, string> = {};
      for (const [k, v] of Object.entries(l)) {
        row[k] = v !== undefined && v !== null ? String(v) : '';
      }
      return row;
    });
    return computeAllDatasetPopulations({ buyers: buyerRows, headers: headerRows, lines: lineRows });
  }, [isDataLoaded, buyers, headers, lines]);

  const exceptionCountsByDR = useMemo(() => {
    const map = new Map<string, { pass: number; fail: number }>();
    for (const exc of pintAEExceptions) {
      const drIds = exc.pint_reference_terms ?? [];
      for (const drId of drIds) {
        if (!map.has(drId)) map.set(drId, { pass: 0, fail: 0 });
        map.get(drId)!.fail++;
      }
    }
    return map;
  }, [pintAEExceptions]);

  const { rows, gaps, specVersion } = useMemo(
    () => computeTraceabilityMatrix(populations, exceptionCountsByDR),
    [populations, exceptionCountsByDR]
  );

  const rowNumberByDrId = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((row, idx) => map.set(row.dr_id, idx + 1));
    return map;
  }, [rows]);

  const filteredRows = useMemo(() => {
    let result = rows;
    if (filter === 'mandatory') result = result.filter(r => r.mandatory);
    else if (filter === 'pint-new') result = result.filter(r => r.isNewPintField);
    else if (filter === 'pint-legacy') result = result.filter(r => !r.isNewPintField);
    else if (filter === 'unmapped') result = result.filter(r => !r.inTemplate);
    else if (filter === 'not-ingestible') result = result.filter(r => r.mandatory && r.inTemplate && !r.ingestible);
    else if (filter === 'low-population') result = result.filter(r => r.populationPct !== null && r.populationPct < CONFORMANCE_CONFIG.populationWarningThreshold);
    else if (filter === 'no-rules') result = result.filter(r => r.ruleIds.length === 0);
    else if (filter === 'no-controls') result = result.filter(r => r.controlIds.length === 0);
    else if (filter === 'covered') result = result.filter(r => r.coverageStatus === 'COVERED');

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        r.dr_id.toLowerCase().includes(q) ||
        r.business_term.toLowerCase().includes(q) ||
        r.internal_columns.some(c => c.toLowerCase().includes(q)) ||
        r.category.toLowerCase().includes(q)
      );
    }
    return result;
  }, [rows, filter, search]);

  const filters: { key: FilterType; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: rows.length },
    { key: 'mandatory', label: 'Mandatory', count: rows.filter(r => r.mandatory).length },
    { key: 'pint-new', label: 'PINT New', count: rows.filter(r => r.isNewPintField).length },
    { key: 'pint-legacy', label: 'PINT Legacy', count: rows.filter(r => !r.isNewPintField).length },
    { key: 'covered', label: 'Covered', count: rows.filter(r => r.coverageStatus === 'COVERED').length },
    { key: 'unmapped', label: 'Not in Template', count: rows.filter(r => !r.inTemplate).length },
    { key: 'no-rules', label: 'No Rules', count: rows.filter(r => r.ruleIds.length === 0).length },
    { key: 'no-controls', label: 'No Controls', count: rows.filter(r => r.controlIds.length === 0).length },
    { key: 'low-population', label: 'Low Pop.', count: rows.filter(r => r.populationPct !== null && r.populationPct < CONFORMANCE_CONFIG.populationWarningThreshold).length },
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="container py-8 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary/10 rounded-2xl mb-3">
            <Shield className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-1">DR Coverage & Traceability</h1>
          <p className="text-muted-foreground text-sm max-w-2xl mx-auto">
            Full regulatory traceability: UAE DR {'->'} templates {'->'} validation rules {'->'} controls {'->'} exceptions
          </p>
        </div>

        {/* Gaps Panel */}
        <div className="mb-6 animate-slide-up">
          <GapsPanel gaps={gaps} specVersion={specVersion} />
        </div>

        {/* Consistency Report Banner */}
        {consistencyReport.failed > 0 && (
          <div className="flex items-center justify-between gap-2 text-sm bg-destructive/5 rounded-lg p-4 border border-destructive/20 mb-6">
            <div className="flex items-center gap-2">
              <FileWarning className="w-4 h-4 text-destructive" />
              <span className="text-destructive font-medium">
                {consistencyReport.failed} consistency issue{consistencyReport.failed > 1 ? 's' : ''} detected
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowConsistency(!showConsistency)} className="text-xs">
              {showConsistency ? 'Hide' : 'Show Details'}
            </Button>
          </div>
        )}
        {showConsistency && consistencyReport.issues.length > 0 && (
          <div className="mb-6 space-y-2">
            {consistencyReport.issues.map((issue, i) => (
              <div key={i} className={cn('text-xs p-3 rounded-lg border', issue.level === 'error' ? 'bg-destructive/5 border-destructive/20' : 'bg-accent/5 border-accent/20')}>
                <p className="font-medium">[{issue.category}] {issue.message}</p>
                <p className="text-muted-foreground mt-1">{issue.affected_ids.slice(0, 5).join(', ')}{issue.affected_ids.length > 5 ? ` +${issue.affected_ids.length - 5} more` : ''}</p>
              </div>
            ))}
          </div>
        )}

        {/* Data status */}
        {!isDataLoaded && (
          <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-lg p-4 border mb-6">
            <Info className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              Upload data on the{' '}
              <Link to="/upload" className="text-primary underline">Upload page</Link>
              {' '}to see population coverage metrics.
            </span>
          </div>
        )}

        {/* Filters, Search & Export */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
          <div className="flex items-center gap-1 flex-wrap">
            {filters.map(f => (
              <Button
                key={f.key}
                variant={filter === f.key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(f.key)}
                className="text-xs gap-1"
              >
                {f.label}
                <Badge variant="secondary" className="text-xs ml-1 px-1.5">{f.count}</Badge>
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={() => exportTraceabilityReport(rows)} className="text-xs gap-1">
              <Download className="w-3 h-3" />
              Export Report
            </Button>
            <div className="relative max-w-xs">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search DR ID, term, column..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-card rounded-xl border shadow-sm overflow-hidden animate-slide-up">
          <div className="overflow-x-auto border-b bg-card">
            <table className="w-full min-w-[1180px] text-sm">
              <thead>
                <tr className="border-b bg-card">
                  <th className="h-12 px-4 text-center align-middle text-xs font-medium text-muted-foreground w-12">#</th>
                  <th className="h-12 px-4 text-left align-middle text-xs font-medium text-muted-foreground w-24">DR ID</th>
                  <th className="h-12 px-4 text-left align-middle text-xs font-medium text-muted-foreground">Business Term</th>
                  <th className="h-12 px-4 text-center align-middle text-xs font-medium text-muted-foreground w-20">Mandatory</th>
                  <th className="h-12 px-4 text-center align-middle text-xs font-medium text-muted-foreground w-24">PINT Delta</th>
                  <th className="h-12 px-4 text-left align-middle text-xs font-medium text-muted-foreground w-20">Template</th>
                  <th className="h-12 px-4 text-left align-middle text-xs font-medium text-muted-foreground">Column(s)</th>
                  <th className="h-12 px-4 text-center align-middle text-xs font-medium text-muted-foreground w-20">In Tmpl</th>
                  <th className="h-12 px-4 text-center align-middle text-xs font-medium text-muted-foreground w-20">Ingestible</th>
                  <th className="h-12 px-4 text-center align-middle text-xs font-medium text-muted-foreground w-16">Pop.</th>
                  <th className="h-12 px-4 text-center align-middle text-xs font-medium text-muted-foreground w-16">Rules</th>
                  <th className="h-12 px-4 text-center align-middle text-xs font-medium text-muted-foreground w-16">Controls</th>
                  <th className="h-12 px-4 text-center align-middle text-xs font-medium text-muted-foreground w-24">Coverage</th>
                </tr>
              </thead>
            </table>
          </div>

          <div className="max-h-[68vh] overflow-auto">
            <table className="w-full min-w-[1180px] text-sm">
              <tbody className="[&_tr:last-child]:border-0">
                {filteredRows.map(row => (
                  <tr
                    key={row.dr_id}
                    className="border-b transition-colors hover:bg-muted/30 cursor-pointer"
                    onClick={() => setDrillDownRow(row)}
                  >
                    <td className="p-4 text-center align-middle text-xs text-muted-foreground w-12">{rowNumberByDrId.get(row.dr_id) ?? '-'}</td>
                    <td className="p-4 align-middle font-mono text-xs font-medium text-primary w-24">{row.dr_id}</td>
                    <td className="p-4 align-middle text-sm">{row.business_term}</td>
                    <td className="p-4 align-middle text-center w-20">
                      {row.mandatory ? (
                        <Badge className="text-xs bg-destructive/10 text-destructive border-destructive/20" variant="outline">Req</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">Opt</Badge>
                      )}
                    </td>
                    <td className="p-4 align-middle text-center w-24">
                      {row.isNewPintField ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFilter('pint-new');
                          }}
                          className="inline-flex"
                        >
                          <Badge variant="outline" className={cn('text-xs border-blue-500/30 text-blue-600 cursor-pointer', filter === 'pint-new' && 'bg-blue-500/10')}>
                            New
                          </Badge>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFilter('pint-legacy');
                          }}
                          className="inline-flex"
                        >
                          <Badge variant="outline" className={cn('text-xs text-muted-foreground cursor-pointer', filter === 'pint-legacy' && 'bg-muted')}>
                            Legacy
                          </Badge>
                        </button>
                      )}
                    </td>
                    <td className="p-4 align-middle w-20"><DatasetBadge dataset={row.dataset_file} /></td>
                    <td className="p-4 align-middle">
                      {row.internal_columns.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {row.internal_columns.map(col => (
                            <code key={col} className="text-xs bg-muted px-1.5 py-0.5 rounded">{col}</code>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">ASP-derived</span>
                      )}
                    </td>
                    <td className="p-4 align-middle text-center w-20">
                      {row.inTemplate ? (
                        <CheckCircle2 className="w-4 h-4 text-[hsl(var(--success))] mx-auto" />
                      ) : (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <XCircle className="w-4 h-4 text-muted-foreground mx-auto" />
                            </TooltipTrigger>
                            <TooltipContent className="text-xs">
                              {row.dataResponsibility.includes('ASP') ? 'ASP-derived field' : 'Not in input template'}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </td>
                    <td className="p-4 align-middle text-center w-20">
                      {row.ingestible ? (
                        <CheckCircle2 className="w-4 h-4 text-[hsl(var(--success))] mx-auto" />
                      ) : row.inTemplate ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <AlertTriangle className="w-4 h-4 text-destructive mx-auto" />
                            </TooltipTrigger>
                            <TooltipContent className="text-xs">
                              Column exists in template but parser/types don't handle it yet
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-4 align-middle text-center w-16">
                      {row.populationPct !== null ? (
                        <span className={cn(
                          'text-xs font-medium',
                          row.populationPct >= 99 ? 'text-[hsl(var(--success))]' :
                          row.populationPct >= 80 ? 'text-accent-foreground' : 'text-destructive'
                        )}>
                          {row.populationPct.toFixed(0)}%
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-4 align-middle text-center w-16">
                      {row.ruleIds.length > 0 ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="secondary" className="text-xs">{row.ruleIds.length}</Badge>
                            </TooltipTrigger>
                            <TooltipContent className="text-xs max-w-xs">
                              {row.ruleNames.join(', ')}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-xs text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="p-4 align-middle text-center w-16">
                      {row.controlIds.length > 0 ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge variant="secondary" className="text-xs">{row.controlIds.length}</Badge>
                            </TooltipTrigger>
                            <TooltipContent className="text-xs max-w-xs">
                              {row.controlNames.join(', ')}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-xs text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="p-4 align-middle text-center w-24">
                      <CoverageStatusBadge status={row.coverageStatus} />
                    </td>
                  </tr>
                ))}
                {filteredRows.length === 0 && (
                  <tr className="border-b">
                    <td colSpan={13} className="p-4 align-middle text-center text-muted-foreground py-12">
                      No matching DRs found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-4 text-xs text-muted-foreground text-center">
          Showing {filteredRows.length} of {rows.length} data requirements | 
          Population threshold: {CONFORMANCE_CONFIG.populationWarningThreshold}% | 
          Consistency: {consistencyReport.passed} passed, {consistencyReport.failed} issues
        </div>
      </div>

      {/* Drill-down Dialog */}
      <DrillDownDialog
        row={drillDownRow}
        exceptions={pintAEExceptions}
        open={!!drillDownRow}
        onOpenChange={(open) => { if (!open) setDrillDownRow(null); }}
      />
    </div>
  );
}
