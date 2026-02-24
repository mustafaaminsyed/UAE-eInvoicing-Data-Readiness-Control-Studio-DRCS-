import { useMemo, useState, useCallback, useEffect } from 'react';
import {
  FileDown, Shield, CheckCircle2, AlertTriangle, XCircle,
  FileSpreadsheet, BarChart3, Scale, Bug, Layers, Database,
  Download, Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useCompliance } from '@/context/ComplianceContext';
import { computeAllDatasetPopulations } from '@/lib/coverage/populationCoverage';
import { buildEvidencePackData, EvidencePackData } from '@/lib/evidence/evidenceDataBuilder';
import { validateBeforeExport, generateEvidencePackZip, generateEvidencePackPdf, downloadBlob } from '@/lib/evidence/evidenceExporter';
import { fetchCheckRuns } from '@/lib/api/checksApi';
import { fetchExceptionsByRun } from '@/lib/api/pintAEApi';
import { CheckRun } from '@/types/customChecks';
import { CONFORMANCE_CONFIG } from '@/config/conformance';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { SeverityBadge } from '@/components/SeverityBadge';

export default function EvidencePackPage() {
  const { buyers, headers, lines, pintAEExceptions, isChecksRun, runSummary } = useCompliance();
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [runs, setRuns] = useState<CheckRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [selectedRunDate, setSelectedRunDate] = useState<string | null>(null);
  const [selectedRunExceptions, setSelectedRunExceptions] = useState(pintAEExceptions);
  const [exportFormat, setExportFormat] = useState<'excel' | 'pdf'>('excel');
  const [search, setSearch] = useState('');
  const [drQuickFilter, setDrQuickFilter] = useState<'all' | 'mandatory' | 'gaps' | 'asp'>('all');
  const [ruleQuickFilter, setRuleQuickFilter] = useState<'all' | 'failing' | 'critical' | 'high_impact'>('all');
  const [exceptionQuickFilter, setExceptionQuickFilter] = useState<'all' | 'open' | 'critical' | 'with_case'>('all');
  const [controlQuickFilter, setControlQuickFilter] = useState<'all' | 'with_exceptions' | 'automated' | 'manual'>('all');
  const [populationQuickFilter, setPopulationQuickFilter] = useState<'all' | 'fail' | 'na' | 'mandatory_fail'>('all');

  useEffect(() => {
    fetchCheckRuns(25).then((data) => setRuns(data));
  }, []);

  useEffect(() => {
    const fallbackRunId = runSummary?.run_id || '';
    const initial = fallbackRunId || runs[0]?.id || '';
    if (!selectedRunId && initial) {
      setSelectedRunId(initial);
    }
  }, [runSummary?.run_id, runs, selectedRunId]);

  useEffect(() => {
    if (!selectedRunId) return;
    const selected = runs.find((r) => r.id === selectedRunId);
    setSelectedRunDate(selected?.run_date ?? null);

    if (runSummary?.run_id && selectedRunId === runSummary.run_id) {
      setSelectedRunExceptions(pintAEExceptions);
      return;
    }

    fetchExceptionsByRun(selectedRunId).then((excs) => setSelectedRunExceptions(excs));
  }, [selectedRunId, runs, runSummary?.run_id, pintAEExceptions]);

  const runId = selectedRunId || runSummary?.run_id || `run-${Date.now()}`;
  const runTimestamp = selectedRunDate || new Date().toISOString();
  const isCurrentContextRun = runSummary?.run_id && selectedRunId === runSummary.run_id;

  // Build populations from raw data for evidence
  const populations = useMemo(() => {
    if (!isChecksRun) return [];
    // We need raw row data for population; approximate from typed data
    const toRaw = (arr: Record<string, any>[]) =>
      arr.map(item => {
        const row: Record<string, string> = {};
        for (const [k, v] of Object.entries(item)) {
          row[k] = v != null ? String(v) : '';
        }
        return row;
      });
    return computeAllDatasetPopulations({
      buyers: toRaw(buyers),
      headers: toRaw(headers),
      lines: toRaw(lines),
    });
  }, [buyers, headers, lines, isChecksRun]);

  const evidence: EvidencePackData | null = useMemo(() => {
    if (!isChecksRun) return null;
    return buildEvidencePackData(
      runId, runTimestamp, buyers, headers, lines, selectedRunExceptions, populations
    );
  }, [isChecksRun, runId, runTimestamp, buyers, headers, lines, selectedRunExceptions, populations]);

  const handleExport = useCallback(async () => {
    if (!evidence) return;
    setExporting(true);
    try {
      const validation = validateBeforeExport();
      if (!validation.valid) {
        const errorMsgs = validation.report.issues
          .filter(i => i.level === 'error')
          .map(i => i.message)
          .join('; ');
        toast({
          title: 'Export Blocked',
          description: `Consistency errors found: ${errorMsgs}`,
          variant: 'destructive',
        });
        setExporting(false);
        return;
      }
      if (exportFormat === 'pdf') {
        const blob = await generateEvidencePackPdf(evidence);
        downloadBlob(blob, `Evidence_Pack_${runId}.pdf`);
        toast({ title: 'Evidence Pack Downloaded', description: 'PDF report generated successfully.' });
      } else {
        const blob = await generateEvidencePackZip(evidence);
        downloadBlob(blob, `Evidence_Pack_${runId}.zip`);
        toast({ title: 'Evidence Pack Downloaded', description: 'Excel ZIP generated successfully.' });
      }
    } catch (err) {
      toast({ title: 'Export Failed', description: String(err), variant: 'destructive' });
    }
    setExporting(false);
  }, [evidence, runId, toast, exportFormat]);

  const q = search.trim().toLowerCase();
  const drCoverageRows = useMemo(() => {
    if (!evidence) return [];
    const filtered = evidence.drCoverage.filter((r) =>
      r.dr_id.toLowerCase().includes(q) ||
      r.business_term.toLowerCase().includes(q) ||
      r.column_names.toLowerCase().includes(q)
    );
    switch (drQuickFilter) {
      case 'mandatory':
        return filtered.filter((r) => r.mandatory);
      case 'gaps':
        return filtered.filter((r) => r.coverage_status === 'NO_RULE' || r.coverage_status === 'NO_CONTROL');
      case 'asp':
        return filtered.filter((r) => r.asp_derived);
      default:
        return filtered;
    }
  }, [q, evidence, drQuickFilter]);
  const ruleRows = useMemo(() => {
    if (!evidence) return [];
    const filtered = evidence.ruleExecution.filter((r) =>
      r.rule_id.toLowerCase().includes(q) ||
      r.rule_name.toLowerCase().includes(q) ||
      r.linked_dr_ids.toLowerCase().includes(q)
    );
    switch (ruleQuickFilter) {
      case 'failing':
        return filtered.filter((r) => r.failure_count > 0);
      case 'critical':
        return filtered.filter((r) => r.severity.toLowerCase() === 'critical');
      case 'high_impact':
        return filtered.filter((r) => r.failure_count >= 10);
      default:
        return filtered;
    }
  }, [q, evidence, ruleQuickFilter]);
  const exceptionRows = useMemo(() => {
    if (!evidence) return [];
    const filtered = evidence.exceptions.filter((e) =>
      e.exception_id.toLowerCase().includes(q) ||
      e.dr_id.toLowerCase().includes(q) ||
      e.rule_id.toLowerCase().includes(q) ||
      e.message.toLowerCase().includes(q)
    );
    switch (exceptionQuickFilter) {
      case 'open':
        return filtered.filter((e) => e.exception_status.toLowerCase() === 'open');
      case 'critical':
        return filtered.filter((e) => e.severity.toLowerCase() === 'critical');
      case 'with_case':
        return filtered.filter((e) => Boolean(e.case_id));
      default:
        return filtered;
    }
  }, [q, evidence, exceptionQuickFilter]);
  const controlRows = useMemo(() => {
    if (!evidence) return [];
    const filtered = evidence.controlsCoverage.filter((c) =>
      c.control_id.toLowerCase().includes(q) ||
      c.control_name.toLowerCase().includes(q) ||
      c.covered_dr_ids.toLowerCase().includes(q)
    );
    switch (controlQuickFilter) {
      case 'with_exceptions':
        return filtered.filter((c) => c.linked_exception_count > 0);
      case 'automated':
        return filtered.filter((c) => c.control_type.toLowerCase() === 'automated');
      case 'manual':
        return filtered.filter((c) => c.control_type.toLowerCase() === 'manual');
      default:
        return filtered;
    }
  }, [q, evidence, controlQuickFilter]);
  const populationRows = useMemo(() => {
    if (!evidence) return [];
    const filtered = evidence.populationQuality.filter((p) =>
      p.dr_id.toLowerCase().includes(q) ||
      p.business_term.toLowerCase().includes(q)
    );
    switch (populationQuickFilter) {
      case 'fail':
        return filtered.filter((p) => p.pass_fail === 'Fail');
      case 'na':
        return filtered.filter((p) => p.pass_fail === 'N/A');
      case 'mandatory_fail':
        return filtered.filter((p) => p.mandatory && p.pass_fail === 'Fail');
      default:
        return filtered;
    }
  }, [q, evidence, populationQuickFilter]);

  if (!isChecksRun || !evidence) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-background">
        <div className="container py-12 max-w-5xl">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-4">
              <FileDown className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Evidence Pack</h1>
            <p className="text-muted-foreground mb-6">
              Run compliance checks first to generate the evidence pack.
            </p>
            <Badge variant="secondary">Upload data {'->'} Run Checks {'->'} Generate Evidence</Badge>
          </div>
        </div>
      </div>
    );
  }

  const ov = evidence.overview;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="container py-8 max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              Evidence Pack
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Regulator-ready audit artifact | {ov.specVersion} | {ov.drVersion}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as 'excel' | 'pdf')}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="excel">Excel ZIP</SelectItem>
                <SelectItem value="pdf">PDF Report</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleExport} disabled={exporting} className="gap-2">
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Generate {exportFormat === 'pdf' ? 'PDF Report' : 'Evidence Pack'}
            </Button>
          </div>
        </div>

        {/* Run Selector / Info Bar */}
        <Card>
          <CardContent className="p-4">
            <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Assessment Run</p>
                <Select value={selectedRunId} onValueChange={setSelectedRunId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select run" />
                  </SelectTrigger>
                  <SelectContent>
                    {runs.map((run) => (
                      <SelectItem key={run.id} value={run.id}>
                        {run.id.slice(0, 12)} | {new Date(run.run_date).toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Table Search</p>
                <Input
                  placeholder="Search current tab records..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                {!isCurrentContextRun && (
                  <Badge variant="outline" className="text-xs">
                    Selected run uses archived exceptions with current loaded dataset snapshot
                  </Badge>
                )}
              </div>
            </div>
            {activeTab === 'dr-coverage' && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">DR Quick Filters:</span>
                <Button size="sm" variant={drQuickFilter === 'all' ? 'secondary' : 'outline'} onClick={() => setDrQuickFilter('all')}>All</Button>
                <Button size="sm" variant={drQuickFilter === 'mandatory' ? 'secondary' : 'outline'} onClick={() => setDrQuickFilter('mandatory')}>Mandatory</Button>
                <Button size="sm" variant={drQuickFilter === 'gaps' ? 'secondary' : 'outline'} onClick={() => setDrQuickFilter('gaps')}>Gaps (No Rule/Control)</Button>
                <Button size="sm" variant={drQuickFilter === 'asp' ? 'secondary' : 'outline'} onClick={() => setDrQuickFilter('asp')}>ASP Derived</Button>
              </div>
            )}
            {activeTab === 'rules' && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Rules Quick Filters:</span>
                <Button size="sm" variant={ruleQuickFilter === 'all' ? 'secondary' : 'outline'} onClick={() => setRuleQuickFilter('all')}>All</Button>
                <Button size="sm" variant={ruleQuickFilter === 'failing' ? 'secondary' : 'outline'} onClick={() => setRuleQuickFilter('failing')}>Failing</Button>
                <Button size="sm" variant={ruleQuickFilter === 'critical' ? 'secondary' : 'outline'} onClick={() => setRuleQuickFilter('critical')}>Critical</Button>
                <Button size="sm" variant={ruleQuickFilter === 'high_impact' ? 'secondary' : 'outline'} onClick={() => setRuleQuickFilter('high_impact')}>High Impact (&gt;=10 fails)</Button>
              </div>
            )}
            {activeTab === 'exceptions' && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Exceptions Quick Filters:</span>
                <Button size="sm" variant={exceptionQuickFilter === 'all' ? 'secondary' : 'outline'} onClick={() => setExceptionQuickFilter('all')}>All</Button>
                <Button size="sm" variant={exceptionQuickFilter === 'open' ? 'secondary' : 'outline'} onClick={() => setExceptionQuickFilter('open')}>Open</Button>
                <Button size="sm" variant={exceptionQuickFilter === 'critical' ? 'secondary' : 'outline'} onClick={() => setExceptionQuickFilter('critical')}>Critical</Button>
                <Button size="sm" variant={exceptionQuickFilter === 'with_case' ? 'secondary' : 'outline'} onClick={() => setExceptionQuickFilter('with_case')}>Linked to Case</Button>
              </div>
            )}
            {activeTab === 'controls' && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Controls Quick Filters:</span>
                <Button size="sm" variant={controlQuickFilter === 'all' ? 'secondary' : 'outline'} onClick={() => setControlQuickFilter('all')}>All</Button>
                <Button size="sm" variant={controlQuickFilter === 'with_exceptions' ? 'secondary' : 'outline'} onClick={() => setControlQuickFilter('with_exceptions')}>With Exceptions</Button>
                <Button size="sm" variant={controlQuickFilter === 'automated' ? 'secondary' : 'outline'} onClick={() => setControlQuickFilter('automated')}>Automated</Button>
                <Button size="sm" variant={controlQuickFilter === 'manual' ? 'secondary' : 'outline'} onClick={() => setControlQuickFilter('manual')}>Manual</Button>
              </div>
            )}
            {activeTab === 'population' && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Population Quick Filters:</span>
                <Button size="sm" variant={populationQuickFilter === 'all' ? 'secondary' : 'outline'} onClick={() => setPopulationQuickFilter('all')}>All</Button>
                <Button size="sm" variant={populationQuickFilter === 'fail' ? 'secondary' : 'outline'} onClick={() => setPopulationQuickFilter('fail')}>Failing</Button>
                <Button size="sm" variant={populationQuickFilter === 'mandatory_fail' ? 'secondary' : 'outline'} onClick={() => setPopulationQuickFilter('mandatory_fail')}>Mandatory Failing</Button>
                <Button size="sm" variant={populationQuickFilter === 'na' ? 'secondary' : 'outline'} onClick={() => setPopulationQuickFilter('na')}>N/A (ASP or unavailable)</Button>
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Run ID</p>
                <p className="text-sm font-mono font-medium text-foreground truncate">{ov.assessmentRunId.slice(0, 12)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Timestamp</p>
                <p className="text-sm font-medium text-foreground">{new Date(ov.executionTimestamp).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Invoices</p>
                <p className="text-lg font-bold text-foreground">{ov.counts.totalInvoices}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Buyers</p>
                <p className="text-lg font-bold text-foreground">{ov.counts.totalBuyers}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Lines</p>
                <p className="text-lg font-bold text-foreground">{ov.counts.totalLines}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Scope</p>
                <p className="text-sm font-medium text-foreground">B2B Tax Invoice</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="overview" className="gap-1 text-xs"><Layers className="w-3 h-3" /> Overview</TabsTrigger>
            <TabsTrigger value="dr-coverage" className="gap-1 text-xs"><Shield className="w-3 h-3" /> DR Coverage</TabsTrigger>
            <TabsTrigger value="rules" className="gap-1 text-xs"><Scale className="w-3 h-3" /> Rules</TabsTrigger>
            <TabsTrigger value="exceptions" className="gap-1 text-xs"><Bug className="w-3 h-3" /> Exceptions</TabsTrigger>
            <TabsTrigger value="controls" className="gap-1 text-xs"><BarChart3 className="w-3 h-3" /> Controls</TabsTrigger>
            <TabsTrigger value="population" className="gap-1 text-xs"><Database className="w-3 h-3" /> Population</TabsTrigger>
          </TabsList>

          {/* Tab A: Overview */}
          <TabsContent value="overview">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total DRs', value: ov.counts.totalDRs, icon: FileSpreadsheet },
                { label: 'Mandatory DRs', value: ov.counts.mandatoryDRs, icon: Shield },
                { label: 'Covered DRs', value: ov.counts.coveredDRs, icon: CheckCircle2, color: 'text-[hsl(var(--success))]' },
                { label: 'No Rules', value: ov.counts.drsNoRules, icon: AlertTriangle, color: ov.counts.drsNoRules > 0 ? 'text-accent-foreground' : undefined },
                { label: 'No Controls', value: ov.counts.drsNoControls, icon: XCircle, color: ov.counts.drsNoControls > 0 ? 'text-destructive' : undefined },
                { label: 'Open Exceptions', value: ov.counts.openExceptions, icon: Bug, color: ov.counts.openExceptions > 0 ? 'text-destructive' : undefined },
                { label: 'Dataset', value: ov.datasetName || '-', icon: Database },
                { label: 'Scope', value: 'B2B UC1', icon: Layers },
              ].map(({ label, value, icon: Icon, color }) => (
                <Card key={label}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <Icon className={cn('w-5 h-5', color ?? 'text-muted-foreground')} />
                    <div>
                      <p className={cn('text-lg font-bold', color ?? 'text-foreground')}>{value}</p>
                      <p className="text-xs text-muted-foreground">{label}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Tab B: DR Coverage */}
          <TabsContent value="dr-coverage">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">DR Coverage Matrix</CardTitle>
                <CardDescription>{drCoverageRows.length} data requirements</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                  <div className="overflow-x-auto">
                    <Table className="min-w-max">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">DR ID</TableHead>
                          <TableHead className="text-xs">Business Term</TableHead>
                          <TableHead className="text-xs">Mandatory</TableHead>
                          <TableHead className="text-xs">Template</TableHead>
                          <TableHead className="text-xs">Columns</TableHead>
                          <TableHead className="text-xs text-right">Rules</TableHead>
                          <TableHead className="text-xs text-right">Controls</TableHead>
                          <TableHead className="text-xs text-right">Pop %</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {drCoverageRows.map(r => (
                          <TableRow key={r.dr_id}>
                            <TableCell className="text-xs font-mono">{r.dr_id}</TableCell>
                            <TableCell className="text-xs max-w-[200px] truncate">{r.business_term}</TableCell>
                            <TableCell className="text-xs">{r.mandatory ? 'Yes' : 'No'}</TableCell>
                            <TableCell className="text-xs">{r.asp_derived ? <Badge variant="outline" className="text-xs">ASP</Badge> : r.template}</TableCell>
                            <TableCell className="text-xs font-mono max-w-[150px] truncate">{r.column_names || '-'}</TableCell>
                            <TableCell className="text-xs text-right">{r.rule_count}</TableCell>
                            <TableCell className="text-xs text-right">{r.control_count}</TableCell>
                            <TableCell className="text-xs text-right">{r.population_percentage !== null ? `${r.population_percentage.toFixed(0)}%` : '-'}</TableCell>
                            <TableCell className="text-xs">
                              <CoverageStatusBadge status={r.coverage_status} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab C: Rules */}
          <TabsContent value="rules">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Rules Execution</CardTitle>
                <CardDescription>{ruleRows.length} validation rules (execution counts estimated by scope)</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                  <div className="overflow-x-auto">
                    <Table className="min-w-max">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Rule ID</TableHead>
                          <TableHead className="text-xs">Rule Name</TableHead>
                          <TableHead className="text-xs">Severity</TableHead>
                          <TableHead className="text-xs">Linked DRs</TableHead>
                          <TableHead className="text-xs text-right">Executions</TableHead>
                          <TableHead className="text-xs text-right">Failures</TableHead>
                          <TableHead className="text-xs">Source</TableHead>
                          <TableHead className="text-xs text-right">Pass Rate</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ruleRows.map(r => {
                          const passRate = r.execution_count > 0
                            ? ((r.execution_count - r.failure_count) / r.execution_count * 100)
                            : 100;
                          return (
                            <TableRow key={r.rule_id}>
                              <TableCell className="text-xs font-mono">{r.rule_id}</TableCell>
                              <TableCell className="text-xs max-w-[200px] truncate">{r.rule_name}</TableCell>
                              <TableCell className="text-xs"><SeverityBadge severity={r.severity as any} /></TableCell>
                              <TableCell className="text-xs font-mono max-w-[200px] truncate">{r.linked_dr_ids}</TableCell>
                              <TableCell className="text-xs text-right">{r.execution_count}</TableCell>
                              <TableCell className="text-xs text-right font-medium">{r.failure_count}</TableCell>
                              <TableCell className="text-xs capitalize">{r.execution_source}</TableCell>
                              <TableCell className={cn('text-xs text-right font-medium', passRate < 100 ? 'text-destructive' : 'text-[hsl(var(--success))]')}>
                                {passRate.toFixed(1)}%
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab D: Exceptions */}
          <TabsContent value="exceptions">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Exceptions & Cases</CardTitle>
                <CardDescription>{exceptionRows.length} exception records</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                  <div className="overflow-x-auto">
                    <Table className="min-w-max">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Exception ID</TableHead>
                          <TableHead className="text-xs">DR ID</TableHead>
                          <TableHead className="text-xs">Rule ID</TableHead>
                          <TableHead className="text-xs">Record Ref</TableHead>
                          <TableHead className="text-xs">Severity</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs">Case ID</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {exceptionRows.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                              No exceptions for this run.
                            </TableCell>
                          </TableRow>
                        ) : exceptionRows.slice(0, 200).map(e => (
                          <TableRow key={e.exception_id}>
                            <TableCell className="text-xs font-mono truncate max-w-[100px]">{e.exception_id.slice(0, 8)}</TableCell>
                            <TableCell className="text-xs font-mono">{e.dr_id}</TableCell>
                            <TableCell className="text-xs font-mono">{e.rule_id}</TableCell>
                            <TableCell className="text-xs font-mono truncate max-w-[100px]">{e.record_reference}</TableCell>
                            <TableCell className="text-xs"><SeverityBadge severity={e.severity as any} /></TableCell>
                            <TableCell className="text-xs">{e.exception_status}</TableCell>
                            <TableCell className="text-xs font-mono">{e.case_id || '-'}</TableCell>
                          </TableRow>
                        ))}
                        {exceptionRows.length > 200 && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-2">
                              Showing 200 of {exceptionRows.length} exceptions. Full list available in export.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab E: Controls */}
          <TabsContent value="controls">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Controls Coverage</CardTitle>
                <CardDescription>{controlRows.length} controls</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                  <div className="overflow-x-auto">
                    <Table className="min-w-max">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Control ID</TableHead>
                          <TableHead className="text-xs">Name</TableHead>
                          <TableHead className="text-xs">Type</TableHead>
                          <TableHead className="text-xs">Covered Rules</TableHead>
                          <TableHead className="text-xs">Covered DRs</TableHead>
                          <TableHead className="text-xs text-right">Exceptions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {controlRows.map(c => (
                          <TableRow key={c.control_id}>
                            <TableCell className="text-xs font-mono">{c.control_id}</TableCell>
                            <TableCell className="text-xs max-w-[200px] truncate">{c.control_name}</TableCell>
                            <TableCell className="text-xs">
                              <Badge variant="outline" className="text-xs capitalize">{c.control_type}</Badge>
                            </TableCell>
                            <TableCell className="text-xs font-mono max-w-[200px] truncate">{c.covered_rule_ids}</TableCell>
                            <TableCell className="text-xs font-mono max-w-[200px] truncate">{c.covered_dr_ids}</TableCell>
                            <TableCell className="text-xs text-right font-medium">{c.linked_exception_count}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab F: Population */}
          <TabsContent value="population">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Data Quality & Population</CardTitle>
                <CardDescription>Threshold: {CONFORMANCE_CONFIG.populationWarningThreshold}%</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                  <div className="overflow-x-auto">
                    <Table className="min-w-max">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">DR ID</TableHead>
                          <TableHead className="text-xs">Business Term</TableHead>
                          <TableHead className="text-xs">Mandatory</TableHead>
                          <TableHead className="text-xs text-right">Population %</TableHead>
                          <TableHead className="text-xs text-right">Threshold</TableHead>
                          <TableHead className="text-xs">Pass/Fail</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {populationRows.map(p => (
                          <TableRow key={p.dr_id}>
                            <TableCell className="text-xs font-mono">{p.dr_id}</TableCell>
                            <TableCell className="text-xs max-w-[200px] truncate">{p.business_term}</TableCell>
                            <TableCell className="text-xs">{p.mandatory ? 'Yes' : 'No'}</TableCell>
                            <TableCell className="text-xs text-right">
                              {p.population_percentage !== null ? `${p.population_percentage.toFixed(1)}%` : 'N/A'}
                            </TableCell>
                            <TableCell className="text-xs text-right">{p.threshold}%</TableCell>
                            <TableCell className="text-xs">
                              <Badge
                                variant="outline"
                                className={cn('text-xs', {
                                  'border-[hsl(var(--success))]/30 text-[hsl(var(--success))]': p.pass_fail === 'Pass',
                                  'border-destructive/30 text-destructive': p.pass_fail === 'Fail',
                                  'border-muted text-muted-foreground': p.pass_fail === 'N/A',
                                })}
                              >
                                {p.pass_fail}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function CoverageStatusBadge({ status }: { status: string }) {
  const config: Record<string, { className: string; label: string }> = {
    COVERED: { className: 'border-[hsl(var(--success))]/30 text-[hsl(var(--success))]', label: 'Covered' },
    NO_CONTROL: { className: 'border-accent/30 text-accent-foreground', label: 'No Control' },
    NO_RULE: { className: 'border-destructive/30 text-destructive', label: 'No Rule' },
    NOT_IN_TEMPLATE: { className: 'border-muted text-muted-foreground', label: 'Not in Template' },
  };
  const c = config[status] ?? config.NOT_IN_TEMPLATE;
  return <Badge variant="outline" className={cn('text-xs', c.className)}>{c.label}</Badge>;
}
