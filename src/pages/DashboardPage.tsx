import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, BarChart3, Check, ChevronRight, CircleDot, Database, FileCheck2, FileUp, ListChecks, Play, RefreshCw, ShieldAlert, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCompliance } from '@/context/ComplianceContext';
import { fetchMappingTemplates } from '@/lib/api/mappingApi';
import { getUploadAuditLogs } from '@/lib/uploadAudit';
import type { MappingTemplate } from '@/types/fieldMapping';
import { computeDashboardCoverageMetrics } from '@/lib/dashboard/coverageMetrics';
import { buildDashboardSnapshot, formatNumber, formatPercent, getRunModeBadge } from '@/lib/dashboard';
import type { DashboardSnapshot, DatasetScope } from '@/lib/dashboard';
import { cn } from '@/lib/utils';
import '@/components/dashboard/control-centre.css';
import '@/components/dashboard/coverage-metrics.css';

const domainRows = (s: DashboardSnapshot) => [
  { label: 'Mandatory fields', value: s.mandatoryCompleteness, detail: `${formatPercent(s.headerCompleteness)} header · ${formatPercent(s.lineCompleteness)} lines`, route: '/mapping' },
  { label: 'Header & buyer data', value: Math.round((s.headerCompleteness + s.buyerCompleteness) / 2), detail: `${formatPercent(s.headerCompleteness)} header · ${formatPercent(s.buyerCompleteness)} buyer`, route: '/exceptions' },
  { label: 'Conditional requirements', value: s.conditionalCompleteness, detail: 'Applicable-field completeness', route: '/traceability' },
  { label: 'Regulatory rule coverage', value: s.pintRuleCoverage, detail: `${formatNumber(s.currencyMismatchCount)} currency mismatches`, route: '/validation' },
  { label: 'Line-level data', value: s.lineCompleteness, detail: `${formatPercent(s.nullFieldRate)} overall null-field rate`, route: '/mapping' },
  { label: 'Credit-note controls', value: s.creditNoteCount ? s.creditNoteCoverage : null, detail: 'No credit notes in scope', notInScope: !s.creditNoteCount, route: '/validation' },
];
const toneFor = (value: number) => value >= 90 ? 'good' : value >= 75 ? 'watch' : 'risk';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { isChecksRun, isDataLoaded, isRunning, runSummary, runChecks, activeDatasetType, setActiveDatasetType, activeMappingProfileByDirection, lastChecksRunDatasetType, lastChecksRunAt, getDashboardStats, checkResults, exceptions, buyers, headers, lines, validationExecutions } = useCompliance();
  const [mappingTemplate, setMappingTemplate] = useState<MappingTemplate | null>(null);
  const activeMappingProfile = activeMappingProfileByDirection?.[activeDatasetType] ?? null;

  useEffect(() => {
    let cancelled = false;
    setMappingTemplate(null);
    if (!activeMappingProfile) return () => { cancelled = true; };

    void fetchMappingTemplates(activeDatasetType).then((templates) => {
      if (cancelled) return;
      setMappingTemplate(
        templates.find((template) => template.id === activeMappingProfile.id && template.version === activeMappingProfile.version) ?? null
      );
    });

    return () => { cancelled = true; };
  }, [activeDatasetType, activeMappingProfile?.id, activeMappingProfile?.version]);

  const latestUploadAudit = useMemo(
    () => getUploadAuditLogs().find((entry) => (entry.datasetType ?? 'AR') === activeDatasetType),
    [activeDatasetType, isDataLoaded, lastChecksRunAt]
  );
  const uploadedColumnCount = latestUploadAudit
    ? latestUploadAudit.datasets
        .filter((dataset) => dataset.dataset !== 'adjustments')
        .reduce((total, dataset) => total + dataset.columnCount, 0)
    : null;
  const hasCompletedRun = isChecksRun && lastChecksRunDatasetType === activeDatasetType;
  const coverageMetrics = useMemo(() => computeDashboardCoverageMetrics({
    direction: activeDatasetType,
    mappingTemplate,
    uploadColumnCount: uploadedColumnCount,
    buyers,
    headers,
    lines,
    hasCompletedRun,
    validationExecutions: validationExecutions ?? [],
  }), [activeDatasetType, buyers, hasCompletedRun, headers, lines, mappingTemplate, uploadedColumnCount, validationExecutions]);
  const stats = getDashboardStats();
  const snapshot = useMemo(() => buildDashboardSnapshot({ dataset: activeDatasetType, isChecksRun, isDataLoaded, stats, checkResults, exceptions, buyers, headers, lines, validationExecutions }), [activeDatasetType, buyers, checkResults, exceptions, headers, isChecksRun, isDataLoaded, lines, stats, validationExecutions]);
  const runModeBadge = getRunModeBadge(runSummary);
  const runModeLabel = runModeBadge?.label === 'Live' ? 'Portfolio view' : (runModeBadge?.label ?? 'Portfolio view');
  const readiness = snapshot.goLiveReadiness ?? 0;
  const emptyState = !snapshot.hasLiveSignals || !isChecksRun || !isDataLoaded;
  const domains = domainRows(snapshot);
  const topIssues = snapshot.blockingIssues.slice(0, 6);
  const severityRows = [
    { label: 'Critical', count: snapshot.exceptionsBySeverity.Critical, tone: 'critical' },
    { label: 'High', count: snapshot.exceptionsBySeverity.High, tone: 'high' },
    { label: 'Medium', count: snapshot.exceptionsBySeverity.Medium, tone: 'medium' },
    { label: 'Low', count: snapshot.exceptionsBySeverity.Low, tone: 'low' },
  ];
  const hasCriticalBlockers = !emptyState && snapshot.criticalIssues > 0;
  const workflow = [
    { number: 1, title: 'Ingest', detail: emptyState ? 'Not assessed' : `${formatNumber(snapshot.totalInvoices)} records`, route: '/upload', complete: isDataLoaded },
    { number: 2, title: 'Align', detail: emptyState ? 'Not assessed' : `${formatPercent(snapshot.mandatoryCompleteness)} fields covered`, route: '/mapping', complete: snapshot.mandatoryCompleteness >= 90 },
    { number: 3, title: 'Validate', detail: emptyState ? 'Not evaluated' : `${formatNumber(snapshot.executedRuleOutcomes)} outcomes`, route: '/run', complete: isChecksRun, active: isRunning },
    { number: 4, title: 'Control', detail: emptyState ? 'Not assessed' : `${formatNumber(snapshot.exceptionsTotal)} open exceptions`, route: '/exceptions', complete: isChecksRun && snapshot.criticalIssues === 0 },
  ];

  return <div className="control-centre" data-testid="control-centre-dashboard">
    <section className="cc-hero">
      <div><p className="cc-kicker">Executive command centre</p><h2>UAE e-Invoicing Readiness</h2><div className="cc-meta"><span>{activeDatasetType === 'AR' ? 'Accounts receivable' : 'Accounts payable'}</span><span>{runModeLabel}</span><span>{formatNumber(snapshot.totalInvoices)} invoices analysed</span></div></div>
      <div className="cc-hero-actions"><div className="cc-scope-switch" aria-label="Portfolio scope">{(['AR', 'AP'] as DatasetScope[]).map(scope => <button key={scope} type="button" className={cn(activeDatasetType === scope && 'is-active')} onClick={() => setActiveDatasetType(scope)}>{scope}</button>)}</div><Button variant="outline" className="cc-outline-button" onClick={() => navigate('/upload')}><RefreshCw className="h-4 w-4" /> Refresh data</Button><Button className="cc-primary-button" disabled={!isDataLoaded || isRunning} onClick={() => void runChecks()}><Play className="h-4 w-4" /> {isRunning ? 'Running checks…' : 'Run checks'}</Button></div>
    </section>

    <section className="cc-kpi-grid" aria-label="Executive readiness metrics">
      <article className="cc-kpi cc-kpi-readiness"><div className="cc-ring" style={{ '--score': `${Math.max(0, Math.min(100, readiness)) * 3.6}deg` } as React.CSSProperties}><div><strong>{emptyState ? '—' : formatPercent(snapshot.goLiveReadiness)}</strong><span>overall</span></div></div><div><span className="cc-label">DRCS readiness score</span><strong>{emptyState ? 'Awaiting data' : (snapshot.goLiveReadiness === null ? 'Awaiting data' : snapshot.goLiveReadiness >= 90 ? 'Ready' : snapshot.goLiveReadiness >= 75 ? 'Watch' : 'Blocked')}</strong><small>{emptyState ? 'Assessment pending' : 'Weighted control posture'}</small></div></article>
      <KpiCard icon={<FileCheck2 />} label="Mandatory field supply" value={emptyState ? 'Pending' : formatPercent(snapshot.mandatoryCompleteness)} detail={emptyState ? 'Awaiting source coverage' : `${formatPercent(snapshot.headerCompleteness)} header · ${formatPercent(snapshot.lineCompleteness)} lines`} tone="good" />
      <KpiCard icon={<ShieldAlert />} label="Blocking exposure" value={emptyState ? 'Not assessed' : formatNumber(snapshot.criticalIssues)} detail={emptyState ? 'No blocker count yet' : `${formatNumber(snapshot.criticalBlockerDocumentCount)} invoices affected`} tone="risk" />
      <KpiCard icon={<ListChecks />} label="Regulatory evaluation coverage" value={emptyState ? 'Pending' : formatPercent(snapshot.evaluationCoverage)} detail={emptyState ? 'Validation not started' : `${formatNumber(snapshot.executedRuleOutcomes)} outcomes`} tone="watch" />
      <KpiCard icon={<Database />} label="Invoices analysed" value={emptyState ? 'No source data' : formatNumber(snapshot.totalInvoices)} detail={emptyState ? 'Awaiting upload' : `${formatNumber(snapshot.submissionReadyCount)} submission-ready`} tone="info" />
    </section>

    <section className="cc-coverage-grid" aria-label="Source mapping and review metrics">
      <CoverageMetricCard
        label="Mapped source fields"
        value={coverageMetrics.mappedSourceFields === null
          ? `—/${coverageMetrics.totalSourceFields ?? '—'}`
          : `${coverageMetrics.mappedSourceFields}/${coverageMetrics.totalSourceFields ?? '—'}`}
        detail={mappingTemplate
          ? `${coverageMetrics.directMappedSourceFields} direct · ${coverageMetrics.transformedMappedSourceFields} transformed · ${coverageMetrics.uncertainMappedSourceFields} uncertain`
          : activeMappingProfile ? 'Active mapping profile unavailable' : 'Select an active mapping profile'}
      />
      <CoverageMetricCard
        label="Fully supplied targets"
        value={coverageMetrics.fullySuppliedTargets === null
          ? `—/${coverageMetrics.totalTargets}`
          : `${coverageMetrics.fullySuppliedTargets}/${coverageMetrics.totalTargets}`}
        detail="MoF Tax Invoice crosswalk · all source fields mapped"
      />
      <CoverageMetricCard
        label="Source checks matched"
        value={coverageMetrics.matchedChecks === null
          ? '—'
          : `${coverageMetrics.matchedChecks}/${coverageMetrics.totalChecks}`}
        detail={coverageMetrics.matchedChecks === null
          ? 'Run validation to assess source checks'
          : `${coverageMetrics.sourceGaps} gaps · ${coverageMetrics.ambiguousChecks} applicability undetermined`}
      />
      <CoverageMetricCard
        label="Documents reviewed"
        value={coverageMetrics.documentsReviewed === null ? '—' : formatNumber(coverageMetrics.documentsReviewed)}
        detail={coverageMetrics.documentsReviewed === null
          ? 'Awaiting a completed validation run'
          : `${coverageMetrics.invoicesReviewed} invoices · ${coverageMetrics.creditNotesReviewed} credit notes${coverageMetrics.otherDocumentsReviewed ? ` · ${coverageMetrics.otherDocumentsReviewed} other` : ''}`}
      />
    </section>

    <section className={cn('cc-alert', emptyState && 'is-neutral', !emptyState && !hasCriticalBlockers && 'is-clear')} role={hasCriticalBlockers ? 'alert' : 'status'}>
      {hasCriticalBlockers ? <AlertTriangle className="h-6 w-6" /> : emptyState ? <CircleDot className="h-6 w-6" /> : <Check className="h-6 w-6" />}
      <div>
        <strong>{emptyState
          ? 'Current assessment state is not yet populated.'
          : hasCriticalBlockers
            ? `${formatNumber(snapshot.criticalIssues)} critical blockers need attention`
            : 'No critical blockers detected in the latest assessment.'}</strong>
        <span>{emptyState
          ? 'Upload source data and run validation to generate live readiness, blocker and evaluation signals.'
          : hasCriticalBlockers
            ? 'Review the affected invoices and resolve the highest-severity findings before submission.'
            : `${formatNumber(snapshot.exceptionsTotal)} total findings remain available for review.`}</span>
      </div>
      {hasCriticalBlockers ? <Button onClick={() => navigate('/exceptions')}>Review blockers <ArrowRight className="h-4 w-4" /></Button> : null}
    </section>

    <section className="cc-main-grid">
      <Panel title="Readiness by control domain" action="View all" onAction={() => navigate('/controls')}><div className="cc-domain-list">{domains.map(domain => {
        const notInScope = !emptyState && 'notInScope' in domain && domain.notInScope;
        const value = domain.value ?? 0;
        const neutralDomain = emptyState || notInScope || Number.isNaN(value);
        const trackWidth = neutralDomain ? '0%' : `${Math.max(2, value)}%`;
        const displayValue = emptyState ? 'Not assessed' : notInScope ? 'Not in scope' : neutralDomain ? 'Not assessed' : formatPercent(value);
        const displayMeta = emptyState ? (isDataLoaded ? 'Awaiting validation' : 'Awaiting source data') : domain.detail;
        return <button key={domain.label} type="button" className="cc-domain-row" onClick={() => navigate(domain.route)}><span>{domain.label}</span><div className="cc-domain-track"><i className={neutralDomain ? 'is-neutral' : `is-${toneFor(value)}`} style={{ width: trackWidth }} /></div><strong>{displayValue}</strong><small>{displayMeta}</small></button>;
      })}</div></Panel>
      <Panel title="Priority findings" action="View all" onAction={() => navigate('/exceptions')}>{emptyState ? <p className="cc-panel-empty">No live findings are available until validation has run.</p> : topIssues.length ? <div className="cc-issue-list">{topIssues.map(issue => <button key={issue.key} type="button" className="cc-issue-row" onClick={() => navigate(`/exceptions?check=${encodeURIComponent(issue.key)}`)}><span className={`cc-severity is-${issue.severity.toLowerCase()}`}>{issue.severity}</span><span className="cc-issue-name"><strong>{issue.label}</strong><small>{issue.key}</small></span><span className="cc-affected">{issue.hasInvoiceCoverage ? issue.affectedInvoices : issue.count}<small>affected</small></span><ChevronRight className="h-4 w-4" /></button>)}</div> : <p className="cc-panel-empty">No open exception clusters are currently surfaced for this live portfolio view.</p>}</Panel>
    </section>

    <section className="cc-workflow" aria-label="Readiness workflow">{workflow.map((step, index) => <button key={step.title} type="button" className={cn('cc-workflow-step', step.complete && 'is-complete', step.active && 'is-active')} onClick={() => navigate(step.route)}><span className="cc-step-number">{step.complete ? <Check className="h-4 w-4" /> : step.number}</span><span><strong>{step.number}. {step.title}</strong><small>{step.detail}</small></span>{index < workflow.length - 1 ? <i /> : null}</button>)}</section>

    <section className="cc-bottom-grid">
      <Panel title="Assessment snapshot" action="Evidence" onAction={() => navigate('/evidence-pack')}><div className="cc-signal-grid"><Signal label="Assessment status" value={emptyState ? 'Not evaluated' : 'Portfolio view'} /><Signal label="Source records" value={emptyState ? 'Unavailable' : formatNumber(snapshot.totalInvoices)} /><Signal label="Validation coverage" value={emptyState ? 'Not evaluated' : formatPercent(snapshot.evaluationCoverage)} /><Signal label="Last run" value={emptyState ? 'Awaiting data' : runModeLabel} /></div></Panel>
      <Panel title="Exceptions by severity" action="Exceptions" onAction={() => navigate('/exceptions')}>
        {emptyState || snapshot.exceptionsTotal === 0
          ? <p className="cc-panel-empty">{emptyState ? 'Run validation to build a severity profile.' : 'No exceptions were recorded in the latest assessment.'}</p>
          : <div className="cc-severity-breakdown" aria-label="Exceptions by severity">{severityRows.map((item) => <div className="cc-severity-breakdown-row" key={item.label}><span>{item.label}</span><div className="cc-severity-breakdown-track"><i className={`is-${item.tone}`} style={{ width: `${snapshot.exceptionsTotal ? (item.count / snapshot.exceptionsTotal) * 100 : 0}%` }} /></div><strong>{formatNumber(item.count)}</strong></div>)}</div>}
      </Panel>
      <Panel title="Quick actions"><div className="cc-quick-actions"><QuickAction icon={<FileUp />} label="Upload invoice dataset" detail="CSV, XML or zipped files" onClick={() => navigate('/upload')} /><QuickAction icon={<SlidersHorizontal />} label="Manage field mappings" detail="Review unresolved mappings" onClick={() => navigate('/mapping')} /><QuickAction icon={<Play />} label="Run validation checks" detail="Execute current control pack" onClick={() => navigate('/run')} /><QuickAction icon={<CircleDot />} label="View open exceptions" detail="Investigate and resolve" onClick={() => navigate('/exceptions')} /><QuickAction icon={<BarChart3 />} label="Generate evidence report" detail="Export audit-ready evidence" onClick={() => navigate('/evidence-pack')} /></div></Panel>
    </section>
  </div>;
}

function WorkspaceOnboarding({ dataset, isDataLoaded, isRunning, invoiceCount, mappedCoverage, onDatasetChange, onUpload, onMap, onValidate }: {
  dataset: DatasetScope;
  isDataLoaded: boolean;
  isRunning: boolean;
  invoiceCount: number;
  mappedCoverage: number;
  onDatasetChange: (dataset: DatasetScope) => void;
  onUpload: () => void;
  onMap: () => void;
  onValidate: () => void;
}) {
  const steps = [
    { number: '01', title: 'Ingest', status: isDataLoaded ? 'Source data supplied' : 'Awaiting source data', icon: <Database />, complete: isDataLoaded, action: onUpload },
    { number: '02', title: 'Align', status: isDataLoaded ? 'Ready for mapping review' : 'Not started', icon: <SlidersHorizontal />, complete: false, action: onMap },
    { number: '03', title: 'Validate', status: 'Not evaluated', icon: <FileCheck2 />, complete: false, action: onValidate },
    { number: '04', title: 'Control', status: 'No blocking exposure assessed', icon: <ShieldAlert />, complete: false, action: () => undefined },
  ];

  return <div className="control-centre cc-onboarding" data-testid="control-centre-onboarding">
    <section className="cc-onboarding-head">
      <div><p className="cc-kicker">DRCS Control Centre</p><h2>UAE e-Invoicing Readiness</h2><p>{dataset} / {dataset === 'AR' ? 'Outbound' : 'Inbound'} · UAE / PINT-AE</p></div>
      <div className="cc-onboarding-head-actions"><div className="cc-scope-switch" aria-label="Portfolio scope">{(['AR', 'AP'] as DatasetScope[]).map(scope => <button key={scope} type="button" className={cn(dataset === scope && 'is-active')} onClick={() => onDatasetChange(scope)}>{scope}</button>)}</div><span className="cc-status-pill">{isDataLoaded ? 'Not evaluated' : 'Not assessed'}</span></div>
    </section>

    <section className="cc-start-panel">
      <span className="cc-start-icon"><Database /></span>
      <div><h3>{isDataLoaded ? 'Source data received' : 'Start your readiness assessment'}</h3><p>{isDataLoaded ? `${formatNumber(invoiceCount)} invoice records are available. Review source alignment before running regulatory validation.` : 'Upload invoice source data to begin source review, mapping readiness and PINT-AE validation.'}</p></div>
      <Button className="cc-primary-button cc-onboarding-primary" onClick={isDataLoaded ? onMap : onUpload}>{isDataLoaded ? 'Review source mapping' : 'Upload source data'} <ArrowRight className="h-4 w-4" /></Button>
    </section>

    <section className="cc-prerequisites" aria-label="Assessment prerequisites">
      <span><Check className={cn(isDataLoaded && 'is-ready')} /> Source supplied <strong>{isDataLoaded ? formatNumber(invoiceCount) : 'Required'}</strong></span>
      <span><Check /> Mapping readiness <strong>{isDataLoaded ? 'Review required' : 'Pending source'}</strong></span>
      <span><Check /> Regulatory evaluation <strong>Not evaluated</strong></span>
      <span><Check /> Blocking exposure <strong>Not assessed</strong></span>
    </section>

    <section className="cc-onboarding-journey" aria-label="Ingest Align Validate Control journey">
      {steps.map((step, index) => <button key={step.title} type="button" onClick={step.action} disabled={step.title === 'Validate' ? !isDataLoaded || isRunning : step.title === 'Control'} className={cn(step.complete && 'is-complete')}>
        <div className="cc-journey-top"><span>{step.number}</span>{step.icon}</div><strong>{step.title}</strong><small>{step.title === 'Align' && isDataLoaded ? `${formatPercent(mappedCoverage)} source-field presence · review mappings` : step.status}</small>{index < steps.length - 1 ? <i /> : null}
      </button>)}
    </section>

    {isDataLoaded ? <section className="cc-next-action"><div><strong>Validation has not run for this dataset</strong><span>Regulatory conformance, failures and blocking exposure will remain Not evaluated until a completed validation run exists.</span></div><Button className="cc-primary-button" disabled={isRunning} onClick={onValidate}><Play className="h-4 w-4" /> {isRunning ? 'Running checks…' : 'Run validation checks'}</Button></section> : null}
  </div>;
}

function KpiCard({ icon, label, value, detail, tone }: { icon: React.ReactNode; label: string; value: string; detail: string; tone: string }) { return <article className={`cc-kpi cc-kpi-${tone}`}><span className="cc-kpi-icon">{icon}</span><div><span className="cc-label">{label}</span><strong>{value}</strong><small>{detail}</small></div></article>; }
function CoverageMetricCard({ label, value, detail }: { label: string; value: string; detail: string }) { return <article className="cc-coverage-card"><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>; }
function Panel({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children: React.ReactNode }) { return <article className="cc-panel"><header><h3>{title}</h3>{action ? <button type="button" onClick={onAction}>{action} <ArrowRight className="h-3.5 w-3.5" /></button> : null}</header>{children}</article>; }
function Signal({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
function QuickAction({ icon, label, detail, onClick }: { icon: React.ReactNode; label: string; detail: string; onClick: () => void }) { return <button type="button" onClick={onClick}><span>{icon}</span><span><strong>{label}</strong><small>{detail}</small></span><ChevronRight className="h-4 w-4" /></button>; }
