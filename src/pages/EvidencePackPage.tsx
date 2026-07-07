import { useMemo, useState, useCallback, useEffect } from 'react';
import {
  FileDown, Shield, BarChart3, Scale, Bug, Database,
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
import {
  buildEvidencePackData,
  EvidencePackData,
  resolveEvidenceEntityIdentity,
} from '@/lib/evidence/evidenceDataBuilder';
import {
  validateBeforeExport,
  generateEvidencePackZip,
  generateEvidencePackZipByEntity,
  generateEvidencePackPdf,
  downloadBlob,
} from '@/lib/evidence/evidenceExporter';
import { buildEvidenceSummary } from '@/lib/evidence/evidenceSummary';
import { getEvidenceRuleExecutionTelemetry, getEvidenceRunSnapshot } from '@/lib/evidence/evidenceRunSnapshot';
import {
  buildStreamlinedEvidenceReport,
  StreamlinedBlocker,
  StreamlinedDomainReadiness,
} from '@/lib/evidence/streamlinedEvidenceReport';
import { fetchCheckRuns } from '@/lib/api/checksApi';
import { fetchExceptionsByRun } from '@/lib/api/pintAEApi';
import { CheckRun } from '@/types/customChecks';
import { CONFORMANCE_CONFIG } from '@/config/conformance';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { SeverityBadge } from '@/components/SeverityBadge';

const ruleTypeDisplayLabels: Record<string, string> = {
  dynamic_codelist: 'Dynamic Codelist',
  fixed_literal: 'Fixed Literal',
  enumeration: 'Enumeration',
  dependency_rule: 'Dependency Rule',
  structural_rule: 'Structural Rule',
};

const executionLayerDisplayLabels: Record<string, string> = {
  schema: 'Schema',
  codelist: 'Codelist',
  national_rule: 'National Rule',
  dependency_rule: 'Dependency',
  semantic_rule: 'Semantic',
};

const failureClassDisplayLabels: Record<string, string> = {
  codelist_failure: 'Codelist Failure',
  fixed_rule_failure: 'Fixed Rule Failure',
  enumeration_failure: 'Enumeration Failure',
  dependency_failure: 'Dependency Failure',
  semantic_failure: 'Semantic Failure',
  structural_failure: 'Structural Failure',
};

function formatRuleTypeLabel(value: string): string {
  return ruleTypeDisplayLabels[value] ?? value.replace(/_/g, ' ');
}

function formatExecutionLayerLabel(value: string): string {
  return executionLayerDisplayLabels[value] ?? value.replace(/_/g, ' ');
}

function formatFailureClassLabel(value: string): string {
  return failureClassDisplayLabels[value] ?? value.replace(/_/g, ' ');
}

export default function EvidencePackPage() {
  const { buyers, headers, lines, pintAEExceptions, isChecksRun, runSummary, lastPintRuleTelemetry } = useCompliance();
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState('exceptions');
  const [runs, setRuns] = useState<CheckRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [selectedRunDate, setSelectedRunDate] = useState<string | null>(null);
  const [selectedRunExceptions, setSelectedRunExceptions] = useState(pintAEExceptions);
  const [exportFormat, setExportFormat] = useState<'excel' | 'pdf'>('excel');
  const [exportScope, setExportScope] = useState<'consolidated' | 'per_entity'>('consolidated');
  const [search, setSearch] = useState('');
  const [drQuickFilter, setDrQuickFilter] = useState<'all' | 'mandatory' | 'gaps' | 'asp'>('all');
  const [ruleQuickFilter, setRuleQuickFilter] = useState<'all' | 'failing' | 'critical' | 'high_impact'>('all');
  const [ruleLayerFilter, setRuleLayerFilter] = useState<string>('all');
  const [ruleFailureClassFilter, setRuleFailureClassFilter] = useState<string>('all');
  const [exceptionQuickFilter, setExceptionQuickFilter] = useState<'all' | 'open' | 'critical' | 'with_case'>('all');
  const [exceptionLayerFilter, setExceptionLayerFilter] = useState<string>('all');
  const [exceptionFailureClassFilter, setExceptionFailureClassFilter] = useState<string>('all');
  const [controlQuickFilter, setControlQuickFilter] = useState<'all' | 'with_exceptions' | 'automated' | 'manual'>('all');
  const [populationQuickFilter, setPopulationQuickFilter] = useState<'all' | 'fail' | 'na' | 'mandatory_fail'>('all');

  useEffect(() => {
    fetchCheckRuns(25).then((data) => setRuns(data));
  }, []);

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) ?? null,
    [runs, selectedRunId]
  );

  const selectedRunSnapshot = useMemo(
    () => getEvidenceRunSnapshot(selectedRun),
    [selectedRun]
  );
  const selectedRunTelemetry = useMemo(
    () => getEvidenceRuleExecutionTelemetry(selectedRun),
    [selectedRun]
  );

  useEffect(() => {
    const fallbackRunId = runSummary?.run_id || '';
    const initial = fallbackRunId || runs[0]?.id || '';
    if (!selectedRunId && initial) {
      setSelectedRunId(initial);
    }
  }, [runSummary?.run_id, runs, selectedRunId]);

  useEffect(() => {
    if (!selectedRunId) return;
    setSelectedRunDate(selectedRun?.run_date ?? null);

    if (runSummary?.run_id && selectedRunId === runSummary.run_id) {
      setSelectedRunExceptions(pintAEExceptions);
      return;
    }

    fetchExceptionsByRun(selectedRunId).then((excs) => setSelectedRunExceptions(excs));
  }, [selectedRunId, selectedRun, runSummary?.run_id, pintAEExceptions]);

  const runId = selectedRunId || runSummary?.run_id || `run-${Date.now()}`;
  const runTimestamp = selectedRunDate || new Date().toISOString();
  const isCurrentContextRun = Boolean(runSummary?.run_id && selectedRunId === runSummary.run_id);
  const isHistoricalRun = Boolean(selectedRunId && !isCurrentContextRun);
  const canUseHistoricalSnapshot = Boolean(isHistoricalRun && selectedRunSnapshot);
  const isHistoricalSnapshotMissing = Boolean(isHistoricalRun && !selectedRunSnapshot);
  const canBuildEvidence = (isChecksRun && isCurrentContextRun) || canUseHistoricalSnapshot;
  const showLegacyRunSummary = false;

  // Build populations from raw data for evidence
  const populations = useMemo(() => {
    if (canUseHistoricalSnapshot && selectedRunSnapshot) {
      return selectedRunSnapshot.populations;
    }
    if (!(isChecksRun && isCurrentContextRun)) return [];
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
  }, [buyers, headers, lines, isChecksRun, isCurrentContextRun, canUseHistoricalSnapshot, selectedRunSnapshot]);

  const evidence: EvidencePackData | null = useMemo(() => {
    if (!canBuildEvidence) return null;
    return buildEvidencePackData(
      runId,
      runTimestamp,
      canUseHistoricalSnapshot ? [] : buyers,
      canUseHistoricalSnapshot ? [] : headers,
      canUseHistoricalSnapshot ? [] : lines,
      selectedRunExceptions,
      populations,
      selectedRunSnapshot
        ? {
            datasetName: selectedRunSnapshot.dataset_name,
            totalInvoices: selectedRunSnapshot.counts.totalInvoices,
            totalBuyers: selectedRunSnapshot.counts.totalBuyers,
            totalLines: selectedRunSnapshot.counts.totalLines,
            sourceMode: canUseHistoricalSnapshot ? 'persisted_snapshot' : 'current_in_memory_run',
            entityScopeStatus: selectedRunSnapshot.entity_scope_status,
            legalEntityCount: selectedRunSnapshot.legal_entity_count,
            legalEntityLabels: selectedRunSnapshot.legal_entity_labels,
            executionTelemetry: canUseHistoricalSnapshot ? selectedRunTelemetry : lastPintRuleTelemetry,
          }
        : {
            sourceMode: canUseHistoricalSnapshot ? 'persisted_snapshot' : 'current_in_memory_run',
            executionTelemetry: lastPintRuleTelemetry,
          }
    );
  }, [
    canBuildEvidence,
    runId,
    runTimestamp,
    canUseHistoricalSnapshot,
    buyers,
    headers,
    lines,
    selectedRunExceptions,
    populations,
    selectedRunSnapshot,
    selectedRunTelemetry,
    lastPintRuleTelemetry,
  ]);

  const streamlinedReport = useMemo(
    () => (evidence ? buildStreamlinedEvidenceReport(evidence) : null),
    [evidence]
  );
  const evidenceSummary = useMemo(
    () => (evidence ? buildEvidenceSummary(evidence) : null),
    [evidence]
  );

  const entityScopedPacks = useMemo(() => {
    if (!isCurrentContextRun || headers.length === 0) return [];

    const groups = new Map<
      string,
      {
        entityLabel: string;
        headers: typeof headers;
      }
    >();

    headers.forEach((header) => {
      const identity = resolveEvidenceEntityIdentity(header);
      if (!identity) return;
      const existing = groups.get(identity.key);
      if (existing) {
        existing.headers.push(header);
        return;
      }
      groups.set(identity.key, { entityLabel: identity.label, headers: [header] });
    });

    if (groups.size <= 1) return [];

    return Array.from(groups.entries()).map(([entityKey, group]) => {
      const invoiceIds = new Set(group.headers.map((header) => header.invoice_id));
      const buyerIds = new Set(group.headers.map((header) => header.buyer_id));
      const entityBuyers = buyers.filter((buyer) => buyerIds.has(buyer.buyer_id));
      const entityLines = lines.filter((line) => invoiceIds.has(line.invoice_id));
      const entityExceptions = selectedRunExceptions.filter((exception) =>
        (exception.seller_trn && exception.seller_trn === entityKey) ||
        (exception.invoice_id && invoiceIds.has(exception.invoice_id)) ||
        (exception.buyer_id && buyerIds.has(exception.buyer_id))
      );

      const toRawRows = (rows: Record<string, unknown>[]) =>
        rows.map((item) => {
          const row: Record<string, string> = {};
          for (const [key, value] of Object.entries(item)) {
            row[key] = value != null ? String(value) : '';
          }
          return row;
        });

      const entityPopulations = computeAllDatasetPopulations({
        buyers: toRawRows(entityBuyers as unknown as Record<string, unknown>[]),
        headers: toRawRows(group.headers as unknown as Record<string, unknown>[]),
        lines: toRawRows(entityLines as unknown as Record<string, unknown>[]),
      });

      return {
        entityKey,
        entityLabel: group.entityLabel,
        evidence: buildEvidencePackData(
          `${runId}-${entityKey}`,
          runTimestamp,
          entityBuyers,
          group.headers,
          entityLines,
          entityExceptions,
          entityPopulations,
          {
            datasetName: group.entityLabel,
            sourceMode: 'current_in_memory_run',
            entityScopeStatus: 'single_entity',
            legalEntityCount: 1,
            legalEntityLabels: [group.entityLabel],
          }
        ),
      };
    });
  }, [buyers, headers, isCurrentContextRun, lines, runId, runTimestamp, selectedRunExceptions]);

  const canExportPerEntity =
    exportFormat === 'excel' &&
    isCurrentContextRun &&
    ovSafeEntityScopeStatus(evidence) === 'multi_entity' &&
    entityScopedPacks.length > 1;

  useEffect(() => {
    if (!canExportPerEntity && exportScope !== 'consolidated') {
      setExportScope('consolidated');
    }
  }, [canExportPerEntity, exportScope]);

  const handleExport = useCallback(async () => {
    if (!evidence) return;
    setExporting(true);
    try {
      if (exportFormat === 'pdf') {
        const validation = validateBeforeExport(evidence);
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
        const blob = await generateEvidencePackPdf(evidence);
        downloadBlob(blob, `Evidence_Pack_${runId}.pdf`);
        toast({ title: 'Evidence Pack Downloaded', description: 'PDF report generated successfully.' });
      } else if (exportScope === 'per_entity' && canExportPerEntity) {
        const invalidPacks = entityScopedPacks.filter((pack) => !validateBeforeExport(pack.evidence).valid);
        if (invalidPacks.length > 0) {
          toast({
            title: 'Export Blocked',
            description: 'One or more entity-scoped packs failed integrity validation.',
            variant: 'destructive',
          });
          setExporting(false);
          return;
        }

        const blob = await generateEvidencePackZipByEntity(entityScopedPacks);
        downloadBlob(blob, `Evidence_Pack_${runId}_per_entity.zip`);
        toast({
          title: 'Evidence Pack Downloaded',
          description: 'Per-legal-entity Excel ZIP generated successfully.',
        });
      } else {
        const validation = validateBeforeExport(evidence);
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
        const blob = await generateEvidencePackZip(evidence);
        downloadBlob(blob, `Evidence_Pack_${runId}.zip`);
        toast({ title: 'Evidence Pack Downloaded', description: 'Excel ZIP generated successfully.' });
      }
    } catch (err) {
      toast({ title: 'Export Failed', description: String(err), variant: 'destructive' });
    }
    setExporting(false);
  }, [canExportPerEntity, entityScopedPacks, evidence, exportFormat, exportScope, runId, toast]);

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
        return filtered.filter((r) => r.asp_derived || r.system_default_allowed);
      default:
        return filtered;
    }
  }, [q, evidence, drQuickFilter]);
  const ruleRows = useMemo(() => {
    if (!evidence) return [];
    let filtered = evidence.ruleExecution.filter((r) =>
      r.rule_id.toLowerCase().includes(q) ||
      r.rule_name.toLowerCase().includes(q) ||
      r.linked_dr_ids.toLowerCase().includes(q)
    );
    if (ruleLayerFilter !== 'all') {
      filtered = filtered.filter((r) => r.execution_layer === ruleLayerFilter);
    }
    if (ruleFailureClassFilter !== 'all') {
      filtered = filtered.filter((r) => r.failure_class === ruleFailureClassFilter);
    }
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
  }, [q, evidence, ruleQuickFilter, ruleLayerFilter, ruleFailureClassFilter]);
  const exceptionRows = useMemo(() => {
    if (!evidence) return [];
    let filtered = evidence.exceptions.filter((e) =>
      e.exception_id.toLowerCase().includes(q) ||
      e.dr_id.toLowerCase().includes(q) ||
      e.rule_id.toLowerCase().includes(q) ||
      e.message.toLowerCase().includes(q)
    );
    if (exceptionLayerFilter !== 'all') {
      filtered = filtered.filter((e) => e.execution_layer === exceptionLayerFilter);
    }
    if (exceptionFailureClassFilter !== 'all') {
      filtered = filtered.filter((e) => e.failure_class === exceptionFailureClassFilter);
    }
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
  }, [q, evidence, exceptionQuickFilter, exceptionLayerFilter, exceptionFailureClassFilter]);
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

  if (!evidence) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-background">
        <div className="container py-12 max-w-5xl">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-4">
              <FileDown className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Evidence Pack</h1>
            {isHistoricalSnapshotMissing ? (
              <>
                <p className="text-muted-foreground mb-4">
                  This historical run does not have a persisted evidence snapshot, so DRCS cannot produce a defensible export without mixing old exceptions and current in-memory data.
                </p>
                <Badge variant="destructive">Historical export blocked until a run snapshot exists</Badge>
              </>
            ) : (
              <>
                <p className="text-muted-foreground mb-6">
                  Run compliance checks first to generate the evidence pack.
                </p>
                <Badge variant="secondary">Upload data {'->'} Run Checks {'->'} Generate Evidence</Badge>
              </>
            )}
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
            {exportFormat === 'excel' ? (
              <Select value={exportScope} onValueChange={(v) => setExportScope(v as 'consolidated' | 'per_entity')}>
                <SelectTrigger className="w-[190px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="consolidated">Consolidated pack</SelectItem>
                  {canExportPerEntity ? (
                    <SelectItem value="per_entity">Per legal entity</SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
            ) : null}
            <Button onClick={handleExport} disabled={exporting} className="gap-2">
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Generate {exportFormat === 'pdf' ? 'PDF Report' : 'Evidence Pack'}
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium text-foreground">
              {canUseHistoricalSnapshot
                ? 'This evidence pack is being reconstructed from the persisted snapshot captured for the selected run.'
                : 'This evidence pack is being generated from the current in-memory run context.'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Historical runs no longer fall back to current loaded data for population and supporting evidence context.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-xs">
                Source: {ov.sourceMode === 'persisted_snapshot' ? 'Persisted snapshot' : 'Current in-memory run'}
              </Badge>
              <Badge variant="outline" className="text-xs">
                Entity scope:{' '}
                {ov.entityScopeStatus === 'single_entity'
                  ? 'Single entity'
                  : ov.entityScopeStatus === 'multi_entity'
                    ? 'Multi-entity'
                    : 'Unknown'}
              </Badge>
              {ov.legalEntityCount > 0 ? (
                <Badge variant="outline" className="text-xs">
                  Legal entities: {ov.legalEntityCount}
                </Badge>
              ) : null}
              {ov.legalEntityLabels.length > 0 ? (
                <Badge variant="secondary" className="text-xs">
                  {ov.legalEntityLabels.join(' | ')}
                </Badge>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {exportFormat === 'excel' && canExportPerEntity ? (
          <Card>
            <CardContent className="p-4">
              <p className="text-sm font-medium text-foreground">Export Scope</p>
              <p className="text-xs text-muted-foreground mt-1">
                Current mode: {exportScope === 'per_entity' ? 'per-legal-entity pack' : 'consolidated pack'}. Entity attribution is complete enough for the current in-memory dataset, so Excel export can be split by legal entity.
              </p>
            </CardContent>
          </Card>
        ) : (ov.entityScopeStatus === 'multi_entity' || ov.entityScopeStatus === 'unknown') && (
          <Card>
            <CardContent className="p-4">
              <p className="text-sm font-medium text-foreground">Export Scope</p>
              <p className="text-xs text-muted-foreground mt-1">
                Current mode: consolidated pack. Per-legal-entity export will be enabled only after entity attribution is complete for the selected evidence context.
              </p>
            </CardContent>
          </Card>
        )}

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
                    {canUseHistoricalSnapshot
                      ? 'Selected run uses persisted evidence snapshot and archived exception context'
                      : 'Selected run has archived exceptions but no persisted evidence snapshot'}
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
                <Button size="sm" variant={drQuickFilter === 'asp' ? 'secondary' : 'outline'} onClick={() => setDrQuickFilter('asp')}>System/ASP Derived</Button>
              </div>
            )}
            {activeTab === 'rules' && (
              <div className="mb-4 flex flex-wrap items-end gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Rules Quick Filters:</span>
                  <Button size="sm" variant={ruleQuickFilter === 'all' ? 'secondary' : 'outline'} onClick={() => setRuleQuickFilter('all')}>All</Button>
                  <Button size="sm" variant={ruleQuickFilter === 'failing' ? 'secondary' : 'outline'} onClick={() => setRuleQuickFilter('failing')}>Failing</Button>
                  <Button size="sm" variant={ruleQuickFilter === 'critical' ? 'secondary' : 'outline'} onClick={() => setRuleQuickFilter('critical')}>Critical</Button>
                  <Button size="sm" variant={ruleQuickFilter === 'high_impact' ? 'secondary' : 'outline'} onClick={() => setRuleQuickFilter('high_impact')}>High Impact (&gt;=10 fails)</Button>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Layer</p>
                  <Select value={ruleLayerFilter} onValueChange={setRuleLayerFilter}>
                    <SelectTrigger className="w-[160px] h-9">
                      <SelectValue placeholder="All layers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All layers</SelectItem>
                      <SelectItem value="schema">Schema</SelectItem>
                      <SelectItem value="codelist">Codelist</SelectItem>
                      <SelectItem value="national_rule">National Rule</SelectItem>
                      <SelectItem value="dependency_rule">Dependency</SelectItem>
                      <SelectItem value="semantic_rule">Semantic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Failure Class</p>
                  <Select value={ruleFailureClassFilter} onValueChange={setRuleFailureClassFilter}>
                    <SelectTrigger className="w-[190px] h-9">
                      <SelectValue placeholder="All failure classes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All failure classes</SelectItem>
                      <SelectItem value="codelist_failure">Codelist Failure</SelectItem>
                      <SelectItem value="fixed_rule_failure">Fixed Rule Failure</SelectItem>
                      <SelectItem value="enumeration_failure">Enumeration Failure</SelectItem>
                      <SelectItem value="dependency_failure">Dependency Failure</SelectItem>
                      <SelectItem value="semantic_failure">Semantic Failure</SelectItem>
                      <SelectItem value="structural_failure">Structural Failure</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            {activeTab === 'exceptions' && (
              <div className="mb-4 flex flex-wrap items-end gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Exceptions Quick Filters:</span>
                  <Button size="sm" variant={exceptionQuickFilter === 'all' ? 'secondary' : 'outline'} onClick={() => setExceptionQuickFilter('all')}>All</Button>
                  <Button size="sm" variant={exceptionQuickFilter === 'open' ? 'secondary' : 'outline'} onClick={() => setExceptionQuickFilter('open')}>Open</Button>
                  <Button size="sm" variant={exceptionQuickFilter === 'critical' ? 'secondary' : 'outline'} onClick={() => setExceptionQuickFilter('critical')}>Critical</Button>
                  <Button size="sm" variant={exceptionQuickFilter === 'with_case' ? 'secondary' : 'outline'} onClick={() => setExceptionQuickFilter('with_case')}>Linked to Case</Button>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Layer</p>
                  <Select value={exceptionLayerFilter} onValueChange={setExceptionLayerFilter}>
                    <SelectTrigger className="w-[160px] h-9">
                      <SelectValue placeholder="All layers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All layers</SelectItem>
                      <SelectItem value="schema">Schema</SelectItem>
                      <SelectItem value="codelist">Codelist</SelectItem>
                      <SelectItem value="national_rule">National Rule</SelectItem>
                      <SelectItem value="dependency_rule">Dependency</SelectItem>
                      <SelectItem value="semantic_rule">Semantic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Failure Class</p>
                  <Select value={exceptionFailureClassFilter} onValueChange={setExceptionFailureClassFilter}>
                    <SelectTrigger className="w-[190px] h-9">
                      <SelectValue placeholder="All failure classes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All failure classes</SelectItem>
                      <SelectItem value="codelist_failure">Codelist Failure</SelectItem>
                      <SelectItem value="fixed_rule_failure">Fixed Rule Failure</SelectItem>
                      <SelectItem value="enumeration_failure">Enumeration Failure</SelectItem>
                      <SelectItem value="dependency_failure">Dependency Failure</SelectItem>
                      <SelectItem value="semantic_failure">Semantic Failure</SelectItem>
                      <SelectItem value="structural_failure">Structural Failure</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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

        {streamlinedReport && (
          <Card>
            <CardContent className="p-4 md:p-5 space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">Executive decision</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-3xl">{streamlinedReport.summaryText}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={verdictBadgeClassName(streamlinedReport.verdict)}>
                    {streamlinedReport.verdict}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    Evidence confidence: {streamlinedReport.evidenceConfidence}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    Recommended decision: {streamlinedReport.recommendedDecision}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 xl:grid-cols-6 gap-3">
                {streamlinedReport.topMetrics.map((metric) => (
                  <div key={metric.label} className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{metric.label}</p>
                    <p className={cn('mt-1 text-lg font-semibold', metricToneClassName(metric.tone))}>{metric.value}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{metric.helper}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
                <div className="rounded-lg border bg-muted/20 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">Top blockers</p>
                    <Badge variant="outline" className="text-xs">
                      Residual risk: {streamlinedReport.residualRisk}
                    </Badge>
                  </div>
                  <div className="mt-3 space-y-3">
                    {streamlinedReport.blockers.slice(0, 3).map((blocker) => (
                      <BlockerCallout key={`${blocker.title}-${blocker.severity}`} blocker={blocker} />
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Mitigations in place</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Keep the main body focused on the actions that reduce onboarding risk. Full detail remains in the appendices below.
                    </p>
                  </div>
                  <ul className="space-y-2 text-xs text-muted-foreground">
                    {streamlinedReport.mitigationSnapshot.map((mitigation) => (
                      <li key={mitigation} className="rounded-md border bg-background/80 px-3 py-2">
                        {mitigation}
                      </li>
                    ))}
                  </ul>
                  <div className="rounded-md border bg-background/80 p-3">
                    <p className="text-xs font-medium text-foreground">Scope boundary</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{streamlinedReport.includedScopeNote}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{streamlinedReport.excludedScopeNote}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {showLegacyRunSummary && streamlinedReport && (
          <Card>
            <CardContent className="p-4 md:p-5 space-y-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">Run Summary</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Use this page for a quick checkpoint. The full audit detail remains in the downloadable PDF or Excel ZIP.
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={cn('text-xs', {
                    'border-[hsl(var(--success))]/30 text-[hsl(var(--success))]': evidenceSummary.overallTone === 'controlled',
                    'border-accent/30 text-accent-foreground': evidenceSummary.overallTone === 'attention',
                    'border-destructive/30 text-destructive': evidenceSummary.overallTone === 'critical',
                  })}
                >
                  {evidenceSummary.overallStatus}
                </Badge>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {evidenceSummary.summaryCards.map((card) => (
                  <div key={card.label} className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{card.label}</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">{card.value}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{card.helper}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs font-medium text-foreground">Main issues</p>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {evidenceSummary.mainIssues.map((issue) => (
                    <li key={issue}>• {issue}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs font-medium text-foreground">Download guidance</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Detailed DR coverage, full rule execution, exception inventories, and control mappings are intended to be consumed from the downloadable evidence files.
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">{evidenceSummary.executionCountNote}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {streamlinedReport && (
          <>
            <Card>
              <CardContent className="p-4 md:p-5 space-y-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Exceptions and mitigations</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      This page is intentionally limited to the most material grouped exception themes. Use the appendix tabs below for the full register.
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Top {Math.min(streamlinedReport.blockers.length, 5)} grouped themes
                  </Badge>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Exception</TableHead>
                        <TableHead className="text-xs">Severity</TableHead>
                        <TableHead className="text-xs">Impact</TableHead>
                        <TableHead className="text-xs">Mitigation</TableHead>
                        <TableHead className="text-xs">Owner</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Residual Risk</TableHead>
                        <TableHead className="text-xs">Decision Impact</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {streamlinedReport.blockers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                            No grouped exception themes were recorded for this run.
                          </TableCell>
                        </TableRow>
                      ) : (
                        streamlinedReport.blockers.map((blocker) => (
                          <TableRow key={`${blocker.title}-${blocker.severity}`}>
                            <TableCell className="text-xs font-medium">{blocker.title}</TableCell>
                            <TableCell className="text-xs"><SeverityBadge severity={blocker.severity as any} /></TableCell>
                            <TableCell className="max-w-[220px] text-xs text-muted-foreground">{blocker.impact}</TableCell>
                            <TableCell className="max-w-[220px] text-xs text-muted-foreground">{blocker.mitigation}</TableCell>
                            <TableCell className="text-xs">{blocker.owner}</TableCell>
                            <TableCell className="text-xs">{blocker.status}</TableCell>
                            <TableCell className="text-xs">{blocker.residualRisk}</TableCell>
                            <TableCell className="text-xs">{blocker.decisionImpact}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 md:p-5 space-y-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Domain readiness</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Keep this view short. It should tell reviewers whether the risk is isolated or systemic before they move into the technical appendices.
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {streamlinedReport.appendixNote}
                  </Badge>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  {streamlinedReport.domainReadiness
                    .filter((domain) => domain.inScope)
                    .map((domain) => (
                      <DomainReadinessCard key={domain.domain} domain={domain} />
                    ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-semibold text-foreground">Appendix detail</p>
                <p className="text-xs text-muted-foreground mt-1">
                  The tabs below preserve the current DR coverage, rule execution, exception, control, and population evidence as the technical appendix for audit and client handover.
                </p>
              </CardContent>
            </Card>
          </>
        )}

        {/* Tabs */}
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-semibold text-foreground">Detailed preview</p>
            <p className="text-xs text-muted-foreground mt-1">
              The tabs below are an on-screen preview of the evidence package. For handover, audit, or client review, use the downloadable report.
            </p>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="dr-coverage" className="gap-1 text-xs"><Shield className="w-3 h-3" /> DR Coverage</TabsTrigger>
            <TabsTrigger value="rules" className="gap-1 text-xs"><Scale className="w-3 h-3" /> Rules</TabsTrigger>
            <TabsTrigger value="exceptions" className="gap-1 text-xs"><Bug className="w-3 h-3" /> Exceptions</TabsTrigger>
            <TabsTrigger value="controls" className="gap-1 text-xs"><BarChart3 className="w-3 h-3" /> Controls</TabsTrigger>
            <TabsTrigger value="population" className="gap-1 text-xs"><Database className="w-3 h-3" /> Population</TabsTrigger>
          </TabsList>

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
                            <TableCell className="text-xs">
                              {r.system_default_allowed ? (
                                <Badge variant="outline" className="text-xs">System Default</Badge>
                              ) : r.asp_derived ? (
                                <Badge variant="outline" className="text-xs">ASP Derived</Badge>
                              ) : (
                                r.template
                              )}
                            </TableCell>
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
                <CardDescription>{ruleRows.length} validation rules with taxonomy and execution-layer classification</CardDescription>
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
                          <TableHead className="text-xs">Type</TableHead>
                          <TableHead className="text-xs">Layer</TableHead>
                          <TableHead className="text-xs">Failure Class</TableHead>
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
                              <TableCell className="text-xs">{formatRuleTypeLabel(r.rule_type)}</TableCell>
                              <TableCell className="text-xs">{formatExecutionLayerLabel(r.execution_layer)}</TableCell>
                              <TableCell className="text-xs">{formatFailureClassLabel(r.failure_class)}</TableCell>
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
                          <TableHead className="text-xs">Type</TableHead>
                          <TableHead className="text-xs">Layer</TableHead>
                          <TableHead className="text-xs">Failure Class</TableHead>
                          <TableHead className="text-xs">Record Ref</TableHead>
                          <TableHead className="text-xs">Severity</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs">Case ID</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {exceptionRows.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={10} className="text-center text-sm text-muted-foreground py-8">
                              No exceptions for this run.
                            </TableCell>
                          </TableRow>
                        ) : exceptionRows.slice(0, 200).map(e => (
                          <TableRow key={e.exception_id}>
                            <TableCell className="text-xs font-mono truncate max-w-[100px]">{e.exception_id.slice(0, 8)}</TableCell>
                            <TableCell className="text-xs font-mono">{e.dr_id}</TableCell>
                            <TableCell className="text-xs font-mono">{e.rule_id}</TableCell>
                            <TableCell className="text-xs">{e.rule_type ? formatRuleTypeLabel(e.rule_type) : '-'}</TableCell>
                            <TableCell className="text-xs">{e.execution_layer ? formatExecutionLayerLabel(e.execution_layer) : '-'}</TableCell>
                            <TableCell className="text-xs">{e.failure_class ? formatFailureClassLabel(e.failure_class) : '-'}</TableCell>
                            <TableCell className="text-xs font-mono truncate max-w-[100px]">{e.record_reference}</TableCell>
                            <TableCell className="text-xs"><SeverityBadge severity={e.severity as any} /></TableCell>
                            <TableCell className="text-xs">{e.exception_status}</TableCell>
                            <TableCell className="text-xs font-mono">{e.case_id || '-'}</TableCell>
                          </TableRow>
                        ))}
                        {exceptionRows.length > 200 && (
                          <TableRow>
                            <TableCell colSpan={10} className="text-center text-xs text-muted-foreground py-2">
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

function ovSafeEntityScopeStatus(evidence: EvidencePackData | null): EvidencePackData['overview']['entityScopeStatus'] {
  return evidence?.overview.entityScopeStatus ?? 'unknown';
}

function CoverageStatusBadge({ status }: { status: string }) {
  const config: Record<string, { className: string; label: string }> = {
    COVERED: { className: 'border-[hsl(var(--success))]/30 text-[hsl(var(--success))]', label: 'Covered' },
    INDIRECT_RULE: { className: 'border-primary/30 text-primary', label: 'Indirect Rule' },
    NO_CONTROL: { className: 'border-accent/30 text-accent-foreground', label: 'No Control' },
    NO_RULE: { className: 'border-destructive/30 text-destructive', label: 'No Rule' },
    NOT_IN_TEMPLATE: { className: 'border-muted text-muted-foreground', label: 'Not in Template' },
  };
  const c = config[status] ?? config.NOT_IN_TEMPLATE;
  return <Badge variant="outline" className={cn('text-xs', c.className)}>{c.label}</Badge>;
}

function verdictBadgeClassName(verdict: string): string {
  return cn('text-xs', {
    'border-[hsl(var(--success))]/30 text-[hsl(var(--success))]': verdict === 'Ready',
    'border-accent/30 text-accent-foreground': verdict === 'Conditionally Ready',
    'border-destructive/30 text-destructive': verdict === 'Not Ready' || verdict === 'Insufficient Evidence',
  });
}

function metricToneClassName(tone: 'good' | 'warning' | 'critical' | 'neutral'): string {
  switch (tone) {
    case 'good':
      return 'text-[hsl(var(--success))]';
    case 'warning':
      return 'text-accent-foreground';
    case 'critical':
      return 'text-destructive';
    default:
      return 'text-foreground';
  }
}

function BlockerCallout({ blocker }: { blocker: StreamlinedBlocker }) {
  return (
    <div className="rounded-md border bg-background/80 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium text-foreground">{blocker.title}</p>
        <SeverityBadge severity={blocker.severity as any} />
        <Badge variant="outline" className="text-[11px]">
          {blocker.decisionImpact}
        </Badge>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{blocker.impact}</p>
      <p className="mt-2 text-xs text-foreground">
        <span className="font-medium">Mitigation:</span> {blocker.mitigation}
      </p>
      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
        <span>Owner: {blocker.owner}</span>
        <span>Status: {blocker.status}</span>
        <span>Residual risk: {blocker.residualRisk}</span>
      </div>
    </div>
  );
}

function DomainReadinessCard({ domain }: { domain: StreamlinedDomainReadiness }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{domain.domain}</p>
        <Badge variant="outline" className={verdictBadgeClassName(domain.status)}>
          {domain.status}
        </Badge>
      </div>
      <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
        <Badge variant="outline" className="text-[11px]">
          Confidence: {domain.confidence}
        </Badge>
        <Badge variant="outline" className="text-[11px]">
          Residual risk: {domain.residualRisk}
        </Badge>
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Main exception</p>
        <p className="mt-1 text-xs text-foreground">{domain.mainException}</p>
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Mitigation status</p>
        <p className="mt-1 text-xs text-muted-foreground">{domain.mitigationStatus}</p>
      </div>
    </div>
  );
}
