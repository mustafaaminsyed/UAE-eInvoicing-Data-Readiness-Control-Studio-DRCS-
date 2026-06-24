import type { EvidencePackData, ExceptionRow } from './evidenceDataBuilder';

export type StreamlinedVerdict =
  | 'Ready'
  | 'Conditionally Ready'
  | 'Not Ready'
  | 'Insufficient Evidence';

export type EvidenceConfidence = 'High' | 'Medium' | 'Low' | 'Unavailable';
export type ResidualRisk = 'High' | 'Medium' | 'Low';
export type DecisionRecommendation = 'Proceed' | 'Proceed with conditions' | 'Do not proceed';

export interface StreamlinedMetricItem {
  label: string;
  value: string;
  helper: string;
  tone: 'good' | 'warning' | 'critical' | 'neutral';
}

export interface StreamlinedBlocker {
  title: string;
  severity: string;
  impact: string;
  mitigation: string;
  owner: string;
  status: string;
  residualRisk: ResidualRisk;
  decisionImpact: string;
}

export interface StreamlinedDomainReadiness {
  domain: 'Data readiness' | 'Mapping readiness' | 'UAE conformance' | 'Credit note readiness';
  status: StreamlinedVerdict;
  confidence: EvidenceConfidence;
  mainException: string;
  mitigationStatus: string;
  residualRisk: ResidualRisk;
  inScope: boolean;
}

export interface StreamlinedEvidenceReport {
  verdict: StreamlinedVerdict;
  evidenceConfidence: EvidenceConfidence;
  recommendedDecision: DecisionRecommendation;
  residualRisk: ResidualRisk;
  summaryText: string;
  topMetrics: StreamlinedMetricItem[];
  blockers: StreamlinedBlocker[];
  mitigationSnapshot: string[];
  domainReadiness: StreamlinedDomainReadiness[];
  includedScopeNote: string;
  excludedScopeNote: string;
  appendixNote: string;
}

type ExceptionGroup = {
  title: string;
  severity: string;
  count: number;
  impact: string;
  mitigation: string;
  owner: string;
  status: string;
  residualRisk: ResidualRisk;
  decisionImpact: string;
};

const SEVERITY_RANK: Record<string, number> = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

function pickHighestSeverity(left: string, right: string): string {
  return (SEVERITY_RANK[left] ?? 0) >= (SEVERITY_RANK[right] ?? 0) ? left : right;
}

function deriveEvidenceConfidence(data: EvidencePackData): EvidenceConfidence {
  const hasEstimatedRuleCounts = data.ruleExecution.some((row) => row.execution_source === 'estimated');

  if (data.overview.counts.totalDRs === 0) return 'Unavailable';
  if (data.overview.sourceMode === 'current_in_memory_run' && !hasEstimatedRuleCounts) return 'High';
  if (data.overview.sourceMode === 'persisted_snapshot' && !hasEstimatedRuleCounts) return 'Medium';
  return 'Low';
}

function deriveVerdict(data: EvidencePackData, criticalOpen: number): StreamlinedVerdict {
  if (data.overview.counts.totalDRs === 0) return 'Insufficient Evidence';
  if (criticalOpen > 0 || data.overview.counts.drsNoRules > 0) return 'Not Ready';
  if (data.overview.counts.openExceptions > 0 || data.overview.counts.drsNoControls > 0) {
    return 'Conditionally Ready';
  }
  return 'Ready';
}

function deriveRecommendedDecision(verdict: StreamlinedVerdict): DecisionRecommendation {
  if (verdict === 'Ready') return 'Proceed';
  if (verdict === 'Conditionally Ready') return 'Proceed with conditions';
  return 'Do not proceed';
}

function deriveResidualRisk(verdict: StreamlinedVerdict): ResidualRisk {
  if (verdict === 'Not Ready' || verdict === 'Insufficient Evidence') return 'High';
  if (verdict === 'Conditionally Ready') return 'Medium';
  return 'Low';
}

function fallbackMitigation(exception: ExceptionRow): string {
  if (exception.suggested_fix) return exception.suggested_fix;

  switch (exception.root_cause_category) {
    case 'Missing Master Data':
      return 'Enrich the missing master data source, rerun the checks, and confirm the gap is closed.';
    case 'System Integration Issue':
      return 'Review the source-to-target mapping or interface logic and rerun the affected records.';
    case 'Calculation Error':
      return 'Reconcile the source calculation logic and revalidate the impacted invoices.';
    case 'Format Non-Compliance':
      return 'Standardise the source field formatting and rerun the validation cycle.';
    case 'Business Rule Violation':
      return 'Review the upstream business-rule population logic and correct the affected records.';
    case 'Buyer Data Issue':
      return 'Obtain corrected buyer data and rerun the validation set before onboarding sign-off.';
    default:
      return 'Investigate the exception group, agree the corrective action, and rerun the validation cycle.';
  }
}

function groupExceptions(data: EvidencePackData): ExceptionGroup[] {
  const groups = new Map<
    string,
    {
      title: string;
      severity: string;
      count: number;
      impacts: Set<string>;
      mitigation: string;
      owner: string;
      status: string;
    }
  >();

  data.exceptions.forEach((exception) => {
    const key = `${exception.rule_id}::${exception.root_cause_category ?? 'Unclassified'}`;
    const existing = groups.get(key);
    const impact = exception.message || 'Validation exception requires remediation.';

    if (existing) {
      existing.count += 1;
      existing.severity = pickHighestSeverity(existing.severity, exception.severity);
      existing.impacts.add(impact);
      if (existing.mitigation === 'No mitigation recorded.' && fallbackMitigation(exception)) {
        existing.mitigation = fallbackMitigation(exception);
      }
      if (!existing.owner && exception.owner_team) {
        existing.owner = exception.owner_team;
      }
      if (existing.status !== 'Open' && exception.case_status) {
        existing.status = exception.case_status;
      }
      return;
    }

    groups.set(key, {
      title: exception.check_name || exception.rule_id,
      severity: exception.severity,
      count: 1,
      impacts: new Set([impact]),
      mitigation: fallbackMitigation(exception) || 'No mitigation recorded.',
      owner: exception.owner_team || 'Unassigned',
      status: exception.case_status || 'Open',
    });
  });

  return Array.from(groups.values())
    .map((group) => {
      const decisionImpact =
        group.severity === 'Critical'
          ? 'Blocks onboarding'
          : group.severity === 'High'
            ? 'Proceed with conditions'
            : 'Monitor only';

      return {
        title: group.title,
        severity: group.severity,
        count: group.count,
        impact: `${group.count} exception(s). ${Array.from(group.impacts)[0]}`,
        mitigation: group.mitigation,
        owner: group.owner || 'Unassigned',
        status: group.status || 'Open',
        residualRisk:
          group.severity === 'Critical' ? 'High' : group.severity === 'High' ? 'Medium' : 'Low',
        decisionImpact,
      };
    })
    .sort((left, right) => {
      const severityDelta = (SEVERITY_RANK[right.severity] ?? 0) - (SEVERITY_RANK[left.severity] ?? 0);
      if (severityDelta !== 0) return severityDelta;
      return right.count - left.count;
    });
}

function buildTopMetrics(
  data: EvidencePackData,
  verdict: StreamlinedVerdict,
  criticalOpen: number,
  groupedExceptions: ExceptionGroup[]
): StreamlinedMetricItem[] {
  const highOpen = data.exceptions.filter(
    (exception) => exception.severity === 'High' && exception.exception_status.toLowerCase() === 'open'
  ).length;
  const closedOrResolved = data.exceptions.filter((exception) =>
    ['closed', 'resolved'].includes(exception.case_status.toLowerCase())
  ).length;
  const mitigatedPct =
    data.exceptions.length > 0 ? Math.round((closedOrResolved / data.exceptions.length) * 100) : 100;

  return [
    {
      label: 'Readiness verdict',
      value: verdict,
      helper: 'Decision state for this evidence pack.',
      tone: verdict === 'Ready' ? 'good' : verdict === 'Conditionally Ready' ? 'warning' : 'critical',
    },
    {
      label: 'Critical blockers',
      value: String(criticalOpen),
      helper: 'Open critical exceptions that block onboarding.',
      tone: criticalOpen > 0 ? 'critical' : 'good',
    },
    {
      label: 'High issues',
      value: String(highOpen),
      helper: 'Open high-severity issues that may require conditions before proceeding.',
      tone: highOpen > 0 ? 'warning' : 'good',
    },
    {
      label: 'Mitigated exceptions',
      value: `${mitigatedPct}%`,
      helper: data.exceptions.length > 0 ? 'Resolved or closed exceptions as a share of the recorded findings.' : 'No exception backlog recorded in this run.',
      tone: mitigatedPct >= 80 ? 'good' : mitigatedPct >= 50 ? 'warning' : 'critical',
    },
    {
      label: 'Residual high-risk issues',
      value: String(groupedExceptions.filter((group) => group.residualRisk === 'High').length),
      helper: 'Grouped blocker themes still carrying high residual risk.',
      tone: groupedExceptions.some((group) => group.residualRisk === 'High') ? 'critical' : 'good',
    },
    {
      label: 'Open exceptions',
      value: String(data.overview.counts.openExceptions),
      helper: 'Total open exception records across the selected run.',
      tone: data.overview.counts.openExceptions > 0 ? 'warning' : 'good',
    },
  ];
}

function buildDomainReadiness(
  data: EvidencePackData,
  verdict: StreamlinedVerdict,
  evidenceConfidence: EvidenceConfidence,
  groupedExceptions: ExceptionGroup[]
): StreamlinedDomainReadiness[] {
  const mandatoryPopulationFails = data.populationQuality.filter(
    (row) => row.mandatory && row.pass_fail === 'Fail'
  ).length;
  const topDataBlocker = groupedExceptions.find((group) =>
    ['Missing Master Data', 'Data Entry Error', 'Buyer Data Issue'].some((keyword) =>
      group.impact.includes(keyword)
    )
  );

  const hasCreditNoteSignals =
    data.exceptions.some((row) => /credit/i.test(row.rule_id) || /credit note/i.test(row.message)) ||
    data.drCoverage.some((row) => /credit note/i.test(row.business_term));

  const mappingConfidence: EvidenceConfidence =
    data.overview.sourceMode === 'persisted_snapshot' ? 'Low' : 'Medium';

  const domains: StreamlinedDomainReadiness[] = [
    {
      domain: 'Data readiness',
      status: mandatoryPopulationFails > 0 ? 'Conditionally Ready' : verdict,
      confidence: evidenceConfidence,
      mainException:
        topDataBlocker?.title ??
        (mandatoryPopulationFails > 0
          ? `${mandatoryPopulationFails} mandatory data requirement(s) are below the population threshold.`
          : 'No material data-completeness blocker detected.'),
      mitigationStatus: mandatoryPopulationFails > 0 ? 'Improve source completeness and rerun validation.' : 'Controlled',
      residualRisk: mandatoryPopulationFails > 0 ? 'Medium' : deriveResidualRisk(verdict),
      inScope: true,
    },
    {
      domain: 'Mapping readiness',
      status:
        data.overview.counts.drsNoRules > 0
          ? 'Not Ready'
          : data.overview.counts.drsNoControls > 0
            ? 'Conditionally Ready'
            : 'Conditionally Ready',
      confidence: mappingConfidence,
      mainException:
        data.overview.counts.drsNoRules > 0
          ? `${data.overview.counts.drsNoRules} data requirement(s) still have no executable mapped rule.`
          : data.overview.counts.drsNoControls > 0
            ? `${data.overview.counts.drsNoControls} data requirement(s) still have no linked control.`
            : 'Mapping coverage is inferred from the traceability matrix, not a dedicated mapping-readiness model.',
      mitigationStatus:
        data.overview.counts.drsNoRules > 0 || data.overview.counts.drsNoControls > 0
          ? 'Complete the missing traceability and control linkage before sign-off.'
          : 'Partial evidence only',
      residualRisk:
        data.overview.counts.drsNoRules > 0 ? 'High' : data.overview.counts.drsNoControls > 0 ? 'Medium' : 'Medium',
      inScope: true,
    },
    {
      domain: 'UAE conformance',
      status: verdict,
      confidence: evidenceConfidence,
      mainException:
        groupedExceptions[0]?.title ?? 'No material UAE conformance blocker detected in the selected run.',
      mitigationStatus:
        groupedExceptions[0]?.mitigation ?? 'Maintain the current validation posture and monitor reruns.',
      residualRisk: deriveResidualRisk(verdict),
      inScope: true,
    },
  ];

  if (hasCreditNoteSignals) {
    const creditNoteBlocker = groupedExceptions.find((group) => /credit/i.test(group.title) || /credit note/i.test(group.impact));
    domains.push({
      domain: 'Credit note readiness',
      status: creditNoteBlocker ? 'Conditionally Ready' : 'Conditionally Ready',
      confidence: 'Low',
      mainException:
        creditNoteBlocker?.title ?? 'Credit note indicators were detected, but the current evidence model only partially supports scenario-specific readiness.',
      mitigationStatus:
        creditNoteBlocker?.mitigation ?? 'Review credit note source fields and validate the scenario with a focused sample set.',
      residualRisk: creditNoteBlocker ? creditNoteBlocker.residualRisk : 'Medium',
      inScope: true,
    });
  }

  return domains;
}

export function buildStreamlinedEvidenceReport(data: EvidencePackData): StreamlinedEvidenceReport {
  const criticalOpen = data.exceptions.filter(
    (exception) => exception.severity === 'Critical' && exception.exception_status.toLowerCase() === 'open'
  ).length;
  const groupedExceptions = groupExceptions(data);
  const evidenceConfidence = deriveEvidenceConfidence(data);
  const verdict = deriveVerdict(data, criticalOpen);
  const recommendedDecision = deriveRecommendedDecision(verdict);
  const residualRisk = deriveResidualRisk(verdict);
  const topMetrics = buildTopMetrics(data, verdict, criticalOpen, groupedExceptions);
  const mitigationSnapshot = groupedExceptions.slice(0, 3).map((group) => group.mitigation);
  const domainReadiness = buildDomainReadiness(data, verdict, evidenceConfidence, groupedExceptions);

  let summaryText = 'The selected run does not present a material onboarding blocker.';
  if (verdict === 'Not Ready') {
    summaryText = 'Open critical blockers or unmapped rule coverage gaps mean the client should not proceed until remediation is validated.';
  } else if (verdict === 'Conditionally Ready') {
    summaryText = 'The client may proceed only with clear remediation conditions and a follow-up rerun plan.';
  } else if (verdict === 'Insufficient Evidence') {
    summaryText = 'The available historical evidence is incomplete, so DRCS cannot support a decision-grade readiness recommendation.';
  }

  return {
    verdict,
    evidenceConfidence,
    recommendedDecision,
    residualRisk,
    summaryText,
    topMetrics,
    blockers: groupedExceptions.slice(0, 5).map((group) => ({
      title: group.title,
      severity: group.severity,
      impact: group.impact,
      mitigation: group.mitigation,
      owner: group.owner,
      status: group.status,
      residualRisk: group.residualRisk,
      decisionImpact: group.decisionImpact,
    })),
    mitigationSnapshot: mitigationSnapshot.length > 0 ? mitigationSnapshot : ['No mitigation actions are currently recorded for this run.'],
    domainReadiness,
    includedScopeNote:
      'This report assesses data readiness, mapping support, UAE conformance posture, and exception remediation context for the selected run.',
    excludedScopeNote:
      'This streamlined MVP does not assess downstream ASP submission execution, transport, or acknowledgement handling.',
    appendixNote:
      'Full DR coverage, rules, exceptions, controls, and population evidence remain available below as supporting appendices.',
  };
}
