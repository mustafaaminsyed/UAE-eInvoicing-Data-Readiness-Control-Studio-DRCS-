import type { EvidencePackData } from './evidenceDataBuilder';

export interface EvidenceSummaryCard {
  label: string;
  value: string;
  helper: string;
}

export interface EvidenceSummaryModel {
  overallStatus: string;
  overallTone: 'controlled' | 'attention' | 'critical';
  topFailureClass: string;
  executionCountNote: string;
  summaryCards: EvidenceSummaryCard[];
  mainIssues: string[];
}

const FAILURE_CLASS_LABELS: Record<string, string> = {
  codelist_failure: 'Codelist failure',
  fixed_rule_failure: 'Fixed-rule failure',
  enumeration_failure: 'Enumeration failure',
  dependency_failure: 'Dependency failure',
  semantic_failure: 'Semantic failure',
  structural_failure: 'Structural failure',
};

function formatFailureClassLabel(value: string): string {
  return FAILURE_CLASS_LABELS[value] ?? value.replace(/_/g, ' ');
}

function pickTopFailureClass(data: EvidencePackData): { label: string; count: number } {
  const counts = new Map<string, number>();
  data.exceptions.forEach((exception) => {
    if (!exception.failure_class) return;
    counts.set(exception.failure_class, (counts.get(exception.failure_class) ?? 0) + 1);
  });

  let topLabel = 'No failures recorded';
  let topCount = 0;
  counts.forEach((count, failureClass) => {
    if (count > topCount) {
      topCount = count;
      topLabel = formatFailureClassLabel(failureClass);
    }
  });

  return { label: topLabel, count: topCount };
}

function pickTopFailingRule(data: EvidencePackData): { name: string; count: number } | null {
  const failingRules = data.ruleExecution
    .filter((row) => row.failure_count > 0)
    .sort((left, right) => right.failure_count - left.failure_count);

  if (failingRules.length === 0) return null;
  return { name: failingRules[0].rule_name, count: failingRules[0].failure_count };
}

export function buildEvidenceSummary(data: EvidencePackData): EvidenceSummaryModel {
  const criticalExceptions = data.exceptions.filter((exception) => exception.severity === 'Critical').length;
  const topFailureClass = pickTopFailureClass(data);
  const topFailingRule = pickTopFailingRule(data);
  const missingCoverage = data.overview.counts.drsNoRules + data.overview.counts.drsNoControls;

  let overallStatus: EvidenceSummaryModel['overallStatus'] = 'Controlled';
  let overallTone: EvidenceSummaryModel['overallTone'] = 'controlled';

  if (criticalExceptions > 0 || data.overview.counts.drsNoRules > 0) {
    overallStatus = 'Immediate review';
    overallTone = 'critical';
  } else if (data.overview.counts.openExceptions > 0 || data.overview.counts.drsNoControls > 0) {
    overallStatus = 'Review required';
    overallTone = 'attention';
  }

  const summaryCards: EvidenceSummaryCard[] = [
    {
      label: 'Overall status',
      value: overallStatus,
      helper: criticalExceptions > 0 ? `${criticalExceptions} critical exception(s)` : 'No critical blockers detected',
    },
    {
      label: 'Open exceptions',
      value: String(data.overview.counts.openExceptions),
      helper: `${data.exceptions.length} total exception record(s) in this run`,
    },
    {
      label: 'Top failure class',
      value: topFailureClass.label,
      helper: topFailureClass.count > 0 ? `${topFailureClass.count} occurrence(s)` : 'No failures recorded',
    },
    {
      label: 'Coverage gaps',
      value: String(missingCoverage),
      helper: `${data.overview.counts.drsNoRules} no-rule and ${data.overview.counts.drsNoControls} no-control gap(s)`,
    },
  ];

  const mainIssues: string[] = [];

  if (criticalExceptions > 0) {
    mainIssues.push(`${criticalExceptions} critical exception(s) need immediate review.`);
  }
  if (topFailingRule) {
    mainIssues.push(`${topFailingRule.count} failure(s) are linked to ${topFailingRule.name}.`);
  }
  if (topFailureClass.count > 0) {
    mainIssues.push(`Most common issue type: ${topFailureClass.label.toLowerCase()}.`);
  }
  if (data.overview.counts.drsNoRules > 0) {
    mainIssues.push(`${data.overview.counts.drsNoRules} data requirement(s) still have no executable mapped rule.`);
  }
  if (data.overview.counts.drsNoControls > 0) {
    mainIssues.push(`${data.overview.counts.drsNoControls} data requirement(s) still have no linked control.`);
  }
  if (mainIssues.length === 0) {
    mainIssues.push('No exceptions or coverage gaps were detected in this run.');
  }

  const executionCountNote = data.ruleExecution.some((row) => row.execution_source === 'estimated')
    ? 'Rule execution counts are currently estimated from runtime scope.'
    : 'Rule execution counts come from runtime telemetry.';

  return {
    overallStatus,
    overallTone,
    topFailureClass: topFailureClass.label,
    executionCountNote,
    summaryCards,
    mainIssues: mainIssues.slice(0, 4),
  };
}
