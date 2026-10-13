import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CircleAlert,
  CircleDashed,
  Database,
  FileCheck2,
  FileSearch,
  ReceiptText,
  ShieldAlert,
  ShieldCheck,
  Sigma,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { StatsCard } from '@/components/StatsCard';
import { SeverityBadge } from '@/components/SeverityBadge';
import { ReadinessMethodologyTooltip } from '@/components/shared/ReadinessMethodologyTooltip';
import { TopBlockerActionList } from '@/components/shared/TopBlockerActionList';
import { WorkflowNavigator, buildWorkflowItems } from '@/components/shared/WorkflowNavigator';
import { EXECUTIVE_KPI_LABELS } from '@/constants/dashboardLabels';
import { useCompliance } from '@/context/ComplianceContext';
import {
  buildDashboardSnapshot,
  describeReadiness,
  formatNumber,
  formatPercent,
  getRunModeBadge,
  progressTone,
  readinessBand,
} from '@/lib/dashboard';
import type { DashboardSnapshot, DatasetScope, ExceptionBreakdownItem, ScoreInput } from '@/lib/dashboard';
import {
  WORKFLOW_OUTLINE_BADGE_CLASS,
  WORKFLOW_UTILITY_BADGE_CLASS,
} from '@/lib/workflowShellStyles';
import type { Severity } from '@/types/compliance';


interface MetricCard {
  title: string;
  value: string | number;
  subtitle: string;
  icon: ReactNode;
  variant: 'default' | 'success' | 'warning' | 'danger';
  helpContent: ReactNode;
  scopeAbsent?: boolean;
  scopeAbsentTooltip?: string;
}

interface CoverageMetric {
  title: string;
  value: string;
  subtitle: string;
  progress: number;
  tone: 'success' | 'warning' | 'danger';
  helpContent: ReactNode;
  supportingPoints: string[];
}


export default function DashboardPage() {
  const navigate = useNavigate();
  const {
    isChecksRun,
    isDataLoaded,
    isRunning,
    runSummary,
    activeDatasetType,
    setActiveDatasetType,
    getDashboardStats,
    checkResults,
    exceptions,
    buyers,
    headers,
    lines,
    validationExecutions,
  } = useCompliance();

  const stats = getDashboardStats();

  const snapshot = useMemo(
    () =>
      buildDashboardSnapshot({
        dataset: activeDatasetType,
        isChecksRun,
        isDataLoaded,
        stats,
        checkResults,
        exceptions,
        buyers,
        headers,
        lines,
        validationExecutions,
      }),
    [activeDatasetType, buyers, checkResults, exceptions, headers, isChecksRun, isDataLoaded, lines, stats, validationExecutions]
  );

  const readinessInputs = useMemo<ScoreInput[]>(() => {
    if (!snapshot.hasLiveSignals || snapshot.complianceReadiness === null) return [];

    return [
      {
        label: 'Mandatory data',
        score: snapshot.mandatoryCompleteness,
        weight: 0.35,
        summary: 'Header, buyer, and line mandatory field presence.',
      },
      {
        label: 'Conditional data',
        score: snapshot.conditionalCompleteness,
        weight: 0.15,
        summary: 'Scenario-driven dependencies including FX and credit notes.',
      },
      {
        label: 'Rule conformance',
        score: snapshot.pintRuleCoverage,
        weight: 0.3,
        summary: 'Executed PINT-AE rule outcomes for the active scope.',
      },
      {
        label: 'Critical blockers',
        score: Math.max(0, 100 - Math.min(snapshot.criticalIssues, 10) * 10),
        weight: 0.2,
        summary: 'Critical issues depress readiness fastest.',
      },
    ];
  }, [snapshot]);

  const goLiveBand = readinessBand(snapshot.goLiveReadiness);
  const runModeBadge = getRunModeBadge(runSummary);
  const readinessNarrative = describeReadiness(snapshot.goLiveReadiness, snapshot.criticalIssues);
  const conditionalFieldScopeAbsent = snapshot.conditionalFieldDocumentCount === 0;
  const blockerChipCaption =
    snapshot.criticalBlockerDocumentCount > 0
      ? `${formatNumber(snapshot.criticalBlockerDocumentCount)} affected invoice${
          snapshot.criticalBlockerDocumentCount === 1 ? '' : 's'
        } · ${snapshot.avgCriticalBlockersPerDocument.toFixed(1)} outcomes per affected invoice`
      : 'No active critical blocker exposure in the selected scope';
  const criticalBlockingActions = useMemo(
    () =>
      snapshot.blockingIssues
        .filter((issue) => issue.severity === 'Critical')
        .slice(0, 3)
        .map((issue, index) => ({
          rank: index + 1,
          label: issue.label,
          severity: 'critical' as const,
          count: issue.hasInvoiceCoverage ? issue.affectedInvoices : issue.count,
          summaryCount: issue.count,
          countLabel: issue.hasInvoiceCoverage ? 'invoices' : 'outcomes',
          ruleId: issue.key,
        })),
    [snapshot.blockingIssues]
  );
  const universalCriticalCoverage =
    criticalBlockingActions.length > 0 &&
    snapshot.totalInvoices > 0 &&
    criticalBlockingActions.every(
      (issue) => issue.countLabel === 'invoices' && issue.count >= snapshot.totalInvoices
    );
  const remediationPanelTitle = universalCriticalCoverage
    ? `Fix ${criticalBlockingActions.length} check${criticalBlockingActions.length === 1 ? '' : 's'} failing on every invoice`
    : `Prioritise ${criticalBlockingActions.length} recurring blocker check${criticalBlockingActions.length === 1 ? '' : 's'}`;
  const remediationPanelSubtitle = universalCriticalCoverage
    ? 'These checks fail across the full active invoice population. Resolving them removes the largest concentration of critical blocker pressure.'
    : 'These checks drive the largest share of critical blocker pressure in the current portfolio and are the fastest route to a cleaner readiness signal.';

  const supportExecutiveMetrics: MetricCard[] = [
    {
      title: 'Compliance Readiness',
      value: formatPercent(snapshot.complianceReadiness),
      subtitle:
        snapshot.complianceReadiness === null
          ? 'Awaiting live validation signals'
          : `${snapshot.modeLabel} - weighted data and rule readiness`,
      icon: <ShieldCheck className="h-5 w-5" />,
      variant: snapshot.complianceReadiness === null ? 'default' : progressTone(snapshot.complianceReadiness),
      helpContent: (
        <MetricHelpContent
          summary="A weighted control score showing whether the current data set is structurally and regulatorily ready to be validated with confidence."
          formula="35% mandatory completeness + 15% conditional completeness + 30% PINT-AE conformance + 20% blocker pressure."
          threshold="Target 90%+ for a stable go-live posture."
          sourceFields="InvoiceHeader, Buyer, and InvoiceLine fields plus validation outcomes."
        />
      ),
    },
    {
      title: EXECUTIVE_KPI_LABELS.submissionReadyInvoices.title,
      value: `${formatNumber(snapshot.acceptedInvoices)}/${formatNumber(snapshot.totalInvoices)}`,
      subtitle: EXECUTIVE_KPI_LABELS.submissionReadyInvoices.subtitle,
      icon: <BadgeCheck className="h-5 w-5" />,
      variant: snapshot.successRate >= 90 ? 'success' : snapshot.successRate >= 75 ? 'warning' : 'danger',
      helpContent: (
        <MetricHelpContent
          summary={EXECUTIVE_KPI_LABELS.submissionReadyInvoices.helpSummary}
          formula="Accepted invoice count divided by total invoices in scope."
          threshold="Investigate below 95% for production-readiness discussions."
          sourceFields="Derived from current rule pass outcomes and invoice totals."
        />
      ),
    },
    {
      title: EXECUTIVE_KPI_LABELS.rulePassRate.title,
      value: formatPercent(snapshot.pintRuleCoverage),
      subtitle:
        snapshot.executedRuleOutcomes > 0
          ? `${formatNumber(snapshot.executedRuleOutcomes)} evaluated regulatory outcomes · ${formatPercent(snapshot.evaluationCoverage ?? 0)} evaluation coverage`
          : `${formatNumber(snapshot.regulatoryRegisteredControls)} registered regulatory controls · none evaluated`,
      icon: <FileCheck2 className="h-5 w-5" />,
      variant: progressTone(snapshot.pintRuleCoverage),
      helpContent: (
        <MetricHelpContent
          summary={EXECUTIVE_KPI_LABELS.rulePassRate.helpSummary}
          formula="Passed rule outcomes divided by all executed rule outcomes."
          threshold="Target 98%+ before treating the portfolio as regulator-ready."
          sourceFields={`PINT-AE regulatory execution evidence only. ${snapshot.supplementaryControls} supplementary controls are reported separately.`}
        />
      ),
    },
    {
      title: 'Critical blocker outcomes',
      value: formatNumber(snapshot.criticalBlockerOutcomes),
      subtitle:
        snapshot.criticalBlockerDocumentCount > 0
          ? `${formatNumber(snapshot.criticalBlockerDocumentCount)} invoice${snapshot.criticalBlockerDocumentCount === 1 ? '' : 's'} affected in current scope`
          : 'No critical blockers currently linked to this scope',
      icon: <ShieldAlert className="h-5 w-5" />,
      variant: snapshot.criticalBlockerOutcomes > 0 ? 'danger' : 'success',
      helpContent: (
        <MetricHelpContent
          summary="Critical validation outcomes that are most likely to stop, delay, or materially weaken a submission."
          formula="Count of Critical failed rule outcomes, plus the distinct invoice population they affect."
          threshold="The target state is zero open critical blockers."
          sourceFields="Validation outcomes and exception queue records linked to the active invoice scope."
        />
      ),
    },
  ];

  const dataQualityMetrics: MetricCard[] = [
    {
      title: 'Mandatory Field Completeness',
      value: formatPercent(snapshot.mandatoryCompleteness),
      subtitle: 'Coverage across core header, party, and invoice-line requirements',
      icon: <Database className="h-5 w-5" />,
      variant: progressTone(snapshot.mandatoryCompleteness),
      helpContent: (
        <MetricHelpContent
          summary="How fully the uploaded source data populates mandatory terms needed to build compliant UAE/PINT-AE invoices."
          formula="Average completeness across mandatory header, buyer, and line fields."
          threshold="Below 95% usually signals upstream extraction or master-data gaps."
          sourceFields="InvoiceHeader, Buyer, and InvoiceLine mandatory fields."
        />
      ),
    },
    {
      title: 'Conditional Field Completeness',
      value: formatPercent(snapshot.conditionalCompleteness),
      subtitle: 'FX, payment, and credit-note-only dependencies in scope',
      icon: <FileSearch className="h-5 w-5" />,
      variant: progressTone(snapshot.conditionalCompleteness),
      scopeAbsent: conditionalFieldScopeAbsent,
      scopeAbsentTooltip:
        'Conditional fields (FX rates, payment means, credit-note references) are only validated when the relevant document type is present. No qualifying documents are in the current portfolio.',
      helpContent: (
        <MetricHelpContent
          summary="Measures fields that become mandatory only in specific invoice scenarios."
          formula="Satisfied conditional requirements divided by all triggered conditional requirements."
          threshold="A sharp drop usually points to FX invoices, credit notes, or missing payment terms."
          sourceFields="Triggered fields such as fx_rate, tax_currency, payment_due_date, and credit-note references."
        />
      ),
    },
    {
      title: 'Null Field Rate',
      value: formatPercent(snapshot.nullFieldRate, 1),
      subtitle: 'Lower is better across governed quality fields',
      icon: <CircleAlert className="h-5 w-5" />,
      variant: snapshot.nullFieldRate <= 2 ? 'success' : snapshot.nullFieldRate <= 5 ? 'warning' : 'danger',
      helpContent: (
        <MetricHelpContent
          summary="A defect-rate lens showing how much governed data is still blank."
          formula="Empty governed field slots divided by all governed field slots evaluated."
          threshold="Target below 2% for a well-controlled invoice portfolio."
          sourceFields="Mandatory and scenario-sensitive fields across headers, buyers, and lines."
        />
      ),
    },
    {
      title: 'Duplicate Invoice Ratio',
      value: formatPercent(snapshot.duplicateInvoiceRatio, 1),
      subtitle: 'Duplicate invoice-number incidence in the active scope',
      icon: <ReceiptText className="h-5 w-5" />,
      variant: snapshot.duplicateInvoiceRatio <= 1 ? 'success' : snapshot.duplicateInvoiceRatio <= 3 ? 'warning' : 'danger',
      helpContent: (
        <MetricHelpContent
          summary="Shows whether invoice identifiers are stable enough for deterministic reporting and traceability."
          formula="Duplicate invoice records divided by total invoice headers in scope."
          threshold="Target below 1%, with zero preferred for final submission sets."
          sourceFields="invoice_number and invoice_id across the uploaded invoice header set."
        />
      ),
    },
    {
      title: 'Invalid Codelist',
      value: formatNumber(snapshot.invalidCodelistCount),
      subtitle: 'Open codelist and enumerated-value exceptions',
      icon: <AlertTriangle className="h-5 w-5" />,
      variant: snapshot.invalidCodelistCount === 0 ? 'success' : snapshot.invalidCodelistCount <= 5 ? 'warning' : 'danger',
      helpContent: (
        <MetricHelpContent
          summary="Counts open exceptions tied to ISO, UNCL, or other enumerated-value obligations."
          formula="Number of open exceptions matching codelist-oriented checks or messages."
          threshold="The target state is zero because codelist defects are avoidable data governance errors."
          sourceFields="Exception messages and check identifiers related to codelist validation."
        />
      ),
    },
    {
      title: 'Currency Mismatches',
      value: formatNumber(snapshot.currencyMismatchCount),
      subtitle: 'Tax currency and FX logic conflicts in invoice data',
      icon: <Sigma className="h-5 w-5" />,
      variant: snapshot.currencyMismatchCount === 0 ? 'success' : snapshot.currencyMismatchCount <= 3 ? 'warning' : 'danger',
      helpContent: (
        <MetricHelpContent
          summary="Flags invoices where currency, tax currency, or FX-rate behavior does not align with UAE expectations."
          formula="Count of headers with mismatched currency/tax_currency logic or missing positive fx_rate."
          threshold="The target state is zero for controlled foreign-currency invoice flows."
          sourceFields="currency, tax_currency, and fx_rate fields on invoice headers."
        />
      ),
    },
  ];

  const uaeCoverageMetrics: CoverageMetric[] = [
    {
      title: 'IBT Mandatory Fields',
      value: formatPercent(snapshot.ibtMandatoryCoverage),
      subtitle: 'Business-term coverage across the invoice structure expected in the uploaded scope',
      progress: snapshot.ibtMandatoryCoverage,
      tone: progressTone(snapshot.ibtMandatoryCoverage),
      supportingPoints: [
        `Header completeness ${formatPercent(snapshot.headerCompleteness)}`,
        `Buyer completeness ${formatPercent(snapshot.buyerCompleteness)}`,
        `Line completeness ${formatPercent(snapshot.lineCompleteness)}`,
      ],
      helpContent: (
        <MetricHelpContent
          summary="Measures whether the source data can populate the mandatory invoice business terms required by the UAE PINT-AE structure."
          formula="Average completeness across mandatory invoice header, buyer, and invoice-line term groups."
          threshold="Below 95% indicates structural source-data gaps before rule execution even begins."
          sourceFields="Mandatory IBT-aligned fields mapped from InvoiceHeader, Buyer, and InvoiceLine."
        />
      ),
    },
    {
      title: 'PINT-AE Rules',
      value: formatPercent(snapshot.pintRuleCoverage),
      subtitle: 'Executed rule coverage and pass performance for the active dashboard scope',
      progress: snapshot.pintRuleCoverage,
      tone: progressTone(snapshot.pintRuleCoverage),
      supportingPoints: [
        `${formatNumber(snapshot.executedRuleOutcomes)} rule outcomes executed`,
        `${formatPercent(snapshot.passRate)} pass rate in current scope`,
        `${formatNumber(snapshot.criticalIssues)} critical issues still blocking`,
      ],
      helpContent: (
        <MetricHelpContent
          summary="A regulator-facing view of current PINT-AE business rule performance."
          formula="Passed executed rule outcomes divided by all executed rule outcomes."
          threshold="Target 98%+ with no critical blocker concentration."
          sourceFields="Current validation run outcomes filtered to the active dataset direction."
        />
      ),
    },
    {
      title: 'Credit-Note Scenarios',
      value: snapshot.creditNoteCount === 0 ? 'Not in scope' : formatPercent(snapshot.creditNoteCoverage),
      subtitle:
        snapshot.creditNoteCount === 0
          ? 'No 381 credit-note documents are currently represented in the selected portfolio.'
          : `${formatNumber(snapshot.creditNoteCount)} credit-note document(s) evaluated`,
      progress: snapshot.creditNoteCount === 0 ? 0 : snapshot.creditNoteCoverage,
      tone: snapshot.creditNoteCount === 0 ? 'warning' : progressTone(snapshot.creditNoteCoverage),
      supportingPoints:
        snapshot.creditNoteCount === 0
          ? ['Upload a 381 population to validate scenario readiness explicitly.']
          : [
              `Reason-code completeness ${formatPercent(snapshot.creditNoteReasonCoverage)}`,
              `Reason-text completeness ${formatPercent(snapshot.creditNoteReasonTextCoverage)}`,
              `Preceding reference completeness ${formatPercent(snapshot.creditNoteReferenceCoverage)}`,
              `Preceding issue-date completeness ${formatPercent(snapshot.creditNoteIssueDateCoverage)}`,
              `Overall scenario coverage ${formatPercent(snapshot.creditNoteCoverage)}`,
            ],
      helpContent: (
        <MetricHelpContent
          summary="Shows whether credit-note-specific fields needed for UAE/PINT-AE 381 flows are actually present and usable."
          formula="Credit-note scenarios meeting reason-code, reason-text, and required preceding invoice group obligations divided by all credit-note invoices."
          threshold="Do not treat missing credit-note scope as a pass; it only means the scenario has not yet been proven."
          sourceFields="invoice_type, credit_note_reason_code, credit_note_reason_text, preceding_invoice_reference, and preceding_invoice_issue_date on invoice headers."
        />
      ),
    },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <section className="surface-glass rounded-[var(--surface-radius-lg)] border border-border/70 p-4 md:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="inline-flex rounded-2xl border border-border/70 bg-background/90 p-1 shadow-sm">
              <Button
                size="sm"
                variant={activeDatasetType === 'AR' ? 'default' : 'ghost'}
                onClick={() => setActiveDatasetType('AR')}
                className="h-9 rounded-xl px-3.5 text-[12px] font-semibold"
              >
                AR / Outbound
              </Button>
              <Button
                size="sm"
                variant={activeDatasetType === 'AP' ? 'default' : 'ghost'}
                onClick={() => setActiveDatasetType('AP')}
                className="h-9 rounded-xl px-3.5 text-[12px] font-semibold"
              >
                AP / Inbound
              </Button>
              </div>
              <Badge variant="outline" className={WORKFLOW_OUTLINE_BADGE_CLASS}>
                {snapshot.modeLabel}
              </Badge>
              <Badge
                variant="outline"
                className={
                  isRunning
                    ? `${WORKFLOW_UTILITY_BADGE_CLASS} border-primary/25 bg-primary/10 text-primary`
                    : snapshot.criticalIssues > 0
                      ? `${WORKFLOW_UTILITY_BADGE_CLASS} border-severity-medium/25 bg-severity-medium/10 text-severity-medium`
                      : `${WORKFLOW_UTILITY_BADGE_CLASS} border-success/25 bg-success/10 text-success`
                }
              >
                {isRunning ? 'Validation running' : snapshot.criticalIssues > 0 ? 'Executive attention required' : 'Executive ready'}
              </Badge>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <ContextChip
                label="Current scope"
                value={activeDatasetType === 'AR' ? 'AR / Outbound' : 'AP / Inbound'}
                caption={snapshot.modeLabel}
              />
              <ContextChip
                label="Invoices in scope"
                value={formatNumber(snapshot.totalInvoices)}
                caption="Header population under active dashboard review"
              />
              <ContextChip
                label="Rule outcomes"
                value={formatNumber(snapshot.executedRuleOutcomes)}
                caption="Executed validation outcomes in the selected direction"
              />
              <ContextChip
                label="Critical blocker exposure"
                value={formatNumber(snapshot.criticalBlockerOutcomes)}
                caption={blockerChipCaption}
                tone={snapshot.criticalBlockerOutcomes > 0 ? 'danger' : 'success'}
              />
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 xl:w-auto xl:min-w-[280px] xl:max-w-[320px]">
            <div className="rounded-[var(--surface-radius-md)] border border-border/70 bg-background/82 p-4 shadow-[var(--surface-shadow)]">
              <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Executive focus
              </p>
              <p className="mt-2 text-base font-semibold text-foreground">
                {snapshot.criticalIssues > 0 ? 'Resolve blocker concentration before production readiness.' : 'Maintain current conformance posture and monitor reruns.'}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Use validation for rule-level detail and exceptions for targeted remediation on the checks driving the largest portfolio impact.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="rounded-full" onClick={() => navigate('/validation')}>
                Open Validation
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button size="sm" className="rounded-full" onClick={() => navigate('/exceptions')}>
                Review Exceptions
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <WorkflowNavigator
          current="dashboard"
          fallbackPath="/run"
          className="mt-4"
          helperText="Move between readiness, remediation, controls, traceability, and evidence views without losing workflow context."
          items={buildWorkflowItems(['dashboard', 'exceptions', 'controls', 'traceability', 'evidence'])}
        />
      </section>

      <DashboardSection
        eyebrow="Executive compliance KPIs"
        title="Executive compliance view"
        description="A leadership-level summary of readiness, conformance, blocking issues, and deployment confidence for the active invoice portfolio."
      >
        {snapshot.hasLiveSignals ? (
          <div className="space-y-4">
            <Card className="overflow-hidden rounded-[var(--surface-radius-lg)] border-border/70 bg-card/95 shadow-[var(--surface-shadow-strong)]">
              <CardContent className="p-6">
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          goLiveBand.tone === 'success'
                            ? 'border-success/25 bg-success/10 text-success'
                            : goLiveBand.tone === 'warning'
                              ? 'border-severity-medium/25 bg-severity-medium/10 text-severity-medium'
                              : goLiveBand.tone === 'danger'
                                ? 'border-severity-critical/25 bg-severity-critical/10 text-severity-critical'
                                : 'border-border/70 bg-background/75 text-muted-foreground'
                        }
                      >
                        {goLiveBand.label}
                      </Badge>
                      {runModeBadge ? (
                        <Badge variant="outline" className={runModeBadge.toneClass}>
                          {runModeBadge.label}
                        </Badge>
                      ) : null}
                      <MetricTooltip
                        title="Go-Live Readiness"
                        content={
                          <MetricHelpContent
                            summary="Primary executive readiness signal estimating whether the current portfolio can move toward controlled production use."
                            formula="40% compliance score + 15% null-rate quality + 10% duplicate control + 10% currency alignment + 15% blocker containment + 10% credit-note readiness."
                            threshold="90%+ indicates strong readiness; 75% to 89% warrants controlled remediation; below 75% remains blocked."
                            sourceFields="Blended from quality KPIs, validation results, exception pressure, and scenario coverage."
                          />
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Go-Live Readiness
                      </p>
                      <ReadinessMethodologyTooltip type="go-live" dimensions={readinessInputs}>
                        <h3 className="cursor-help text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                          {formatPercent(snapshot.goLiveReadiness)}
                        </h3>
                      </ReadinessMethodologyTooltip>
                      <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                        {readinessNarrative}
                      </p>
                      {runModeBadge ? (
                        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                          {runModeBadge.detail}
                        </p>
                      ) : null}
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      {readinessInputs.map((input) => (
                        <div key={input.label} className="rounded-[var(--surface-radius-md)] border border-border/70 bg-background/82 p-4 shadow-[var(--surface-shadow)]">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium text-foreground">{input.label}</p>
                            <Badge variant="outline" className="border-border/70 bg-background/80 text-[11px] text-muted-foreground">
                              {Math.round(input.weight * 100)}%
                            </Badge>
                          </div>
                          <p className="mt-3 text-2xl font-semibold text-foreground">{formatPercent(input.score)}</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">{input.summary}</p>
                        </div>
                      ))}
                    </div>
                  </div>

			                  <div className="space-y-4">
			                    <div className="rounded-[var(--surface-radius-md)] border border-border/70 bg-background/82 p-4 shadow-[var(--surface-shadow)]">
			                      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
			                        Recommended next action
			                      </p>
		                      {criticalBlockingActions.length > 0 ? (
		                        <div className="mt-3 space-y-4">
		                          <div>
		                            <p className="text-base font-semibold text-foreground">{remediationPanelTitle}</p>
		                            <p className="mt-1 text-sm leading-6 text-muted-foreground">
		                              {remediationPanelSubtitle}
		                            </p>
		                          </div>
		                          <TopBlockerActionList
		                            blockers={criticalBlockingActions}
		                            totalCriticalOutcomes={snapshot.criticalBlockerOutcomes}
		                            summaryUnitLabel="critical blocker outcomes"
		                            summaryDenominatorLabel="total critical blocker outcomes"
		                            onBlockerClick={(ruleId) =>
		                              navigate(
		                                `/exceptions?dataset=${encodeURIComponent(activeDatasetType)}&ruleId=${encodeURIComponent(ruleId)}&sort=count_desc`
		                              )
		                            }
		                          />
		                        </div>
		                      ) : (
		                        <div className="mt-3 space-y-3">
		                          <p className="text-base font-semibold text-foreground">No recurring critical blocker pattern detected</p>
		                          <p className="text-sm leading-6 text-muted-foreground">
		                            The current scope does not expose a dominant cluster of critical blockers, so validation detail is
		                            the best next review surface.
		                          </p>
		                          <Button variant="outline" className="w-full rounded-full" onClick={() => navigate('/validation')}>
		                            Open validation
		                            <ArrowRight className="h-4 w-4" />
		                          </Button>
		                        </div>
		                      )}
		                    </div>

		                    <div className="rounded-[var(--surface-radius-md)] border border-border/70 bg-background/82 p-4 shadow-[var(--surface-shadow)]">
		                      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
		                        Portfolio Scope
		                      </p>
	                      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
	                        <div>
	                          <p className="text-xs text-muted-foreground">Invoices in scope</p>
	                          <p className="text-xl font-semibold text-foreground">{formatNumber(snapshot.totalInvoices)}</p>
	                        </div>
	                        <div>
	                          <p className="text-xs text-muted-foreground">Validation outcomes</p>
	                          <p className="text-xl font-semibold text-foreground">{formatNumber(snapshot.executedRuleOutcomes)}</p>
	                        </div>
	                        <div>
	                          <p className="text-xs text-muted-foreground">Critical blocker invoices</p>
	                          <p className="text-xl font-semibold text-foreground">
	                            {formatNumber(snapshot.criticalBlockerDocumentCount)}
	                          </p>
	                        </div>
	                        <div>
	                          <p className="text-xs text-muted-foreground">Readiness band</p>
	                          <p className="text-xl font-semibold text-foreground">{goLiveBand.label}</p>
	                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5">
                  <Progress
                    value={snapshot.goLiveReadiness ?? 0}
                    className={
                      goLiveBand.tone === 'success'
                        ? 'h-2.5'
                        : goLiveBand.tone === 'warning'
                          ? 'h-2.5 [&>div]:bg-severity-medium'
                          : 'h-2.5 [&>div]:bg-severity-critical'
                    }
                  />
                </div>
              </CardContent>
            </Card>

	            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
	              {supportExecutiveMetrics.map((metric) => (
	                <StatsCard
                  key={metric.title}
                  title={metric.title}
                  value={metric.value}
                  subtitle={metric.subtitle}
                  icon={metric.icon}
                  variant={metric.variant}
                  helpContent={metric.helpContent}
                  scopeAbsent={metric.scopeAbsent}
                  scopeAbsentTooltip={metric.scopeAbsentTooltip}
	                  className="rounded-[var(--surface-radius-lg)] border-border/70 bg-card/94 shadow-[var(--surface-shadow)]"
	                />
	              ))}
	            </div>
          </div>
        ) : (
          <DashboardEmptyState
            title="No validated invoice portfolio is in scope yet"
            description="Load invoice data first, then run the validation workflow to populate readiness scores, success rates, and UAE coverage widgets."
            primaryAction={{ label: 'Upload dataset', onClick: () => navigate('/upload') }}
            secondaryAction={{ label: 'Open submissions workspace', onClick: () => navigate('/submissions') }}
          />
        )}
      </DashboardSection>

      <DashboardSection
        eyebrow="Data quality KPIs"
        title="Source-data quality and integrity"
        description="Profile mandatory and conditional completeness, structural defects, and quality leakage that will undermine submission readiness."
      >
        {snapshot.hasLiveSignals ? (
	          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
	            {dataQualityMetrics.map((metric) => (
	              <StatsCard
                key={metric.title}
                title={metric.title}
                value={metric.value}
                subtitle={metric.subtitle}
                icon={metric.icon}
                variant={metric.variant}
                helpContent={metric.helpContent}
	                className="rounded-[var(--surface-radius-lg)] border-border/70 bg-card/94 shadow-[var(--surface-shadow)]"
	              />
	            ))}
          </div>
        ) : (
          <DashboardEmptyState
            title="Data quality KPIs appear after dataset intake"
            description="Once invoice data is loaded and checks have run, this section will quantify completeness, null leakage, duplicate ratios, and other operational data defects."
          />
        )}
      </DashboardSection>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <DashboardSection
          eyebrow="UAE-specific compliance coverage"
          title="Coverage against UAE and PINT-AE obligations"
          description="Track the most important UAE e-invoicing coverage lenses separately so readiness discussions stay grounded in regulator-facing concepts."
        >
          {snapshot.hasLiveSignals ? (
            <div className="grid gap-4 md:grid-cols-3">
              {uaeCoverageMetrics.map((metric) => (
                <CoverageWidget key={metric.title} metric={metric} />
              ))}
            </div>
          ) : (
            <DashboardEmptyState
              title="UAE coverage widgets are waiting for validated documents"
              description="The IBT, PINT-AE, and credit-note widgets are only meaningful after invoice scope is loaded and validation has classified the portfolio."
            />
          )}
        </DashboardSection>

        <DashboardSection
          eyebrow="Exceptions"
          title="Exception breakdown and remediation focus"
          description="Move beyond a simple queue count by showing severity posture, recurring blockers, and where remediation effort is clustering."
        >
          {snapshot.hasLiveSignals ? (
	            <div className="space-y-4">
		              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
		                {(Object.entries(snapshot.exceptionsBySeverity) as Array<[Severity, number]>).map(([severity, count]) => (
	                  <div
	                    key={severity}
	                    className="rounded-[var(--surface-radius-md)] border border-border/70 bg-background/82 p-4 shadow-[var(--surface-shadow)]"
	                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{severity}</p>
                        <p className="mt-2 text-2xl font-semibold text-foreground">{formatNumber(count)}</p>
                      </div>
                      <SeverityBadge severity={severity} />
                    </div>
	                  </div>
	                ))}
	              </div>
	              <SeverityContextNote />

		              <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
	                <div className="rounded-[var(--surface-radius-md)] border border-border/70 bg-background/82 p-4 shadow-[var(--surface-shadow)]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Top blocking issues</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Ranked by recurring occurrence in the current dashboard scope.
                      </p>
                    </div>
	                    <Badge variant="outline" className="border-border/70 bg-background/80 text-muted-foreground">
	                      {formatNumber(snapshot.exceptionsTotal)} open exceptions
	                    </Badge>
                  </div>

                  <div className="mt-4 space-y-3">
                    {snapshot.blockingIssues.length > 0 ? (
	                      snapshot.blockingIssues.map((issue, index) => (
	                        <div key={issue.key} className="rounded-[var(--surface-radius-md)] border border-border/70 bg-card/92 p-4 shadow-[var(--surface-shadow)]">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-border/70 bg-background px-2 text-[11px] font-semibold text-muted-foreground">
                              {index + 1}
                            </span>
                            <p className="text-sm font-semibold text-foreground">{issue.label}</p>
                            <SeverityBadge severity={issue.severity} />
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-3">
                            <p className="text-sm leading-6 text-muted-foreground">{issue.description}</p>
	                            <div className="shrink-0 rounded-xl border border-border/70 bg-background/96 px-3 py-2 text-right">
                              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                                {issue.hasInvoiceCoverage ? 'Invoices' : 'Outcomes'}
                              </p>
                              <p className="text-lg font-semibold text-foreground">
                                {issue.hasInvoiceCoverage ? issue.affectedInvoices : issue.count}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
	                      <div className="rounded-[var(--surface-radius-md)] border border-border/70 bg-card/92 p-4 text-sm text-muted-foreground">
	                        No open exception clusters are currently surfaced for this live portfolio view.
	                      </div>
                    )}
                  </div>
                </div>

	                  <div className="space-y-4">
	                    {snapshot.exceptionThemes.map((theme) => (
	                      <div
	                        key={theme.title}
	                      className="rounded-[var(--surface-radius-md)] border border-border/70 bg-background/82 p-4 shadow-[var(--surface-shadow)]"
	                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{theme.title}</p>
                      <p className="mt-2 text-2xl font-semibold text-foreground">{theme.value}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{theme.subtitle}</p>
                    </div>
                  ))}

	                  <div className="rounded-[var(--surface-radius-md)] border border-primary/15 bg-primary/8 p-4 shadow-[var(--surface-shadow)]">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-primary" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">Operational interpretation</p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                          Use the severity mix to prioritise blocking fixes, and use the clustered issue list to focus remediation on the few checks driving most portfolio disruption.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <DashboardEmptyState
              title="Exceptions will appear after checks run"
              description="The exception board becomes active once validation findings exist for the current portfolio."
            />
          )}
        </DashboardSection>
      </section>
    </div>
  );
}

function DashboardSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="surface-glass rounded-[var(--surface-radius-lg)] border border-border/70 p-5 md:p-6">
      <div className="mb-5">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</p>
        <h2 className="mt-1.5 text-[1.35rem] font-semibold tracking-tight text-foreground md:text-[1.45rem]">{title}</h2>
        <p className="mt-1.5 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function SeverityContextNote() {
  return (
    <Collapsible>
      <div className="rounded-[var(--surface-radius-md)] border border-border/70 bg-background/78 px-4 py-3 shadow-[var(--surface-shadow)]">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="text-left text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Why is the severity distribution skewed? ↓
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <p className="text-sm leading-6 text-muted-foreground">
            Severity reflects PINT-AE mandatory field classification. Checks on buyer TRN, seller TRN, issue date
            format, and line-item presence are classified Critical because FTA rejection is automatic on these fields.
            The absence of Low exceptions means no advisory checks are currently failing - structural and identity
            checks dominate this portfolio.
          </p>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function ContextChip({
  label,
  value,
  caption,
  tone = 'default',
}: {
  label: string;
  value: string;
  caption?: string;
  tone?: 'default' | 'success' | 'danger';
}) {
  return (
    <div
      className={
        tone === 'danger'
          ? 'rounded-[var(--surface-radius-md)] border border-severity-critical/15 bg-severity-critical/5 px-4 py-3 shadow-[var(--surface-shadow)]'
          : tone === 'success'
            ? 'rounded-[var(--surface-radius-md)] border border-success/15 bg-success/5 px-4 py-3 shadow-[var(--surface-shadow)]'
            : 'rounded-[var(--surface-radius-md)] border border-border/70 bg-background/82 px-4 py-3 shadow-[var(--surface-shadow)]'
      }
    >
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-base font-semibold text-foreground">{value}</p>
      {caption ? <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{caption}</p> : null}
    </div>
  );
}

function DashboardEmptyState({
  title,
  description,
  primaryAction,
  secondaryAction,
}: {
  title: string;
  description: string;
  primaryAction?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
}) {
  return (
    <div className="rounded-[var(--surface-radius-lg)] border border-dashed border-border/80 bg-background/78 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-[var(--surface-radius-md)] border border-border/70 bg-background p-3 shadow-[var(--surface-shadow)]">
            <CircleDashed className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
        </div>
        {(primaryAction || secondaryAction) && (
          <div className="flex flex-wrap gap-2">
            {secondaryAction ? (
              <Button variant="outline" className="rounded-full" onClick={secondaryAction.onClick}>
                {secondaryAction.label}
              </Button>
            ) : null}
            {primaryAction ? (
              <Button className="rounded-full" onClick={primaryAction.onClick}>
                {primaryAction.label}
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function CoverageWidget({ metric }: { metric: CoverageMetric }) {
  const badgeLabel = metric.tone === 'success' ? 'Healthy' : metric.tone === 'warning' ? 'Watch' : 'Attention';

  return (
    <Card className="rounded-[var(--surface-radius-lg)] border-border/70 bg-card/94 shadow-[var(--surface-shadow)]">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Badge variant="outline" className="mb-3 border-border/70 bg-background/80 text-[12px] font-medium text-muted-foreground">
              {badgeLabel}
            </Badge>
            <CardTitle className="text-base">{metric.title}</CardTitle>
            <CardDescription className="mt-1">{metric.subtitle}</CardDescription>
          </div>
          <MetricTooltip title={metric.title} content={metric.helpContent} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-3xl font-bold text-foreground">{metric.value}</div>
        <Progress
          value={metric.progress}
          className={
            metric.tone === 'success'
              ? 'h-2.5'
              : metric.tone === 'warning'
                ? 'h-2.5 [&>div]:bg-severity-medium'
                : 'h-2.5 [&>div]:bg-severity-critical'
          }
        />
        <div className="space-y-2">
          {metric.supportingPoints.map((point) => (
            <div key={point} className="rounded-xl border border-border/70 bg-background/82 px-3 py-2 text-sm leading-6 text-muted-foreground">
              {point}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function MetricHelpContent({
  summary,
  formula,
  threshold,
  sourceFields,
}: {
  summary: string;
  formula: string;
  threshold: string;
  sourceFields: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm leading-6 text-popover-foreground">{summary}</p>
      <div className="space-y-2 text-xs leading-5 text-muted-foreground">
        <p>
          <span className="font-semibold text-popover-foreground">Formula:</span> {formula}
        </p>
        <p>
          <span className="font-semibold text-popover-foreground">Threshold:</span> {threshold}
        </p>
        <p>
          <span className="font-semibold text-popover-foreground">Source:</span> {sourceFields}
        </p>
      </div>
    </div>
  );
}

function MetricTooltip({ title, content }: { title: string; content: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`About ${title}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/70 bg-background/70 text-muted-foreground transition-colors hover:text-foreground"
        >
          <CircleAlert className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-[340px]">
        {content}
      </TooltipContent>
    </Tooltip>
  );
}


