import { getRegulatoryObligations } from '@/lib/registry/regulatoryObligationRegistry';
import { getRulesForDR } from '@/lib/rules/ruleTraceability';
import { evaluateObligationApplicability } from '@/modules/scenarioContext/obligationApplicability';
import type { ScenarioInvoiceInput } from '@/modules/scenarioLens/types';
import type { ValidationExecutionEvidence } from '@/types/validationExecution';

export type ObligationRuntimeComparisonStatus =
  | 'aligned'
  | 'applicable_not_evaluated'
  | 'not_applicable_but_evaluated'
  | 'unsupported'
  | 'policy_review';

export interface ObligationRuntimeComparisonRow {
  termId: string;
  businessTerm: string;
  shadowApplicableCount: number;
  shadowNotApplicableCount: number;
  shadowUnresolvedCount: number;
  linkedRuleIds: string[];
  runtimeEvaluatedCount: number;
  runtimeNotEvaluatedCount: number;
  status: ObligationRuntimeComparisonStatus;
  reason: string;
}

export interface ObligationRuntimeComparisonReport {
  rows: ObligationRuntimeComparisonRow[];
  summary: Record<ObligationRuntimeComparisonStatus, number>;
  invoiceCount: number;
  shadow: true;
  authoritative: false;
}

export function buildObligationRuntimeComparison(
  invoices: ScenarioInvoiceInput[],
  executions: ValidationExecutionEvidence[]
): ObligationRuntimeComparisonReport {
  const executionByRule = new Map(executions.map((execution) => [execution.ruleId, execution]));
  const rows = getRegulatoryObligations().map((obligation): ObligationRuntimeComparisonRow => {
    const decisions = invoices
      .map((invoice) => evaluateObligationApplicability(obligation.termId, invoice))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    const linkedRuleIds = getRulesForDR(obligation.termId).map((rule) => rule.rule_id);
    const linkedExecutions = linkedRuleIds
      .map((ruleId) => executionByRule.get(ruleId))
      .filter((item): item is ValidationExecutionEvidence => Boolean(item));
    const counts = {
      applicable: decisions.filter((item) => item.state === 'applicable').length,
      notApplicable: decisions.filter((item) => item.state === 'not_applicable').length,
      unresolved: decisions.filter((item) => item.state === 'unresolved').length,
      evaluated: linkedExecutions.reduce((sum, item) => sum + item.evaluatedCount, 0),
      notEvaluated: linkedExecutions.reduce((sum, item) => sum + item.notEvaluatedCount, 0),
    };
    const classification = classifyComparison(counts, linkedRuleIds.length, executions.length > 0);
    return {
      termId: obligation.termId,
      businessTerm: obligation.businessTerm,
      shadowApplicableCount: counts.applicable,
      shadowNotApplicableCount: counts.notApplicable,
      shadowUnresolvedCount: counts.unresolved,
      linkedRuleIds,
      runtimeEvaluatedCount: counts.evaluated,
      runtimeNotEvaluatedCount: counts.notEvaluated,
      ...classification,
    };
  });

  return {
    rows,
    summary: {
      aligned: rows.filter((row) => row.status === 'aligned').length,
      applicable_not_evaluated: rows.filter((row) => row.status === 'applicable_not_evaluated').length,
      not_applicable_but_evaluated: rows.filter((row) => row.status === 'not_applicable_but_evaluated').length,
      unsupported: rows.filter((row) => row.status === 'unsupported').length,
      policy_review: rows.filter((row) => row.status === 'policy_review').length,
    },
    invoiceCount: invoices.length,
    shadow: true,
    authoritative: false,
  };
}

function classifyComparison(
  counts: { applicable: number; notApplicable: number; unresolved: number; evaluated: number; notEvaluated: number },
  linkedRuleCount: number,
  hasCompletedRunEvidence: boolean
): Pick<ObligationRuntimeComparisonRow, 'status' | 'reason'> {
  if (counts.unresolved > 0) {
    return {
      status: 'policy_review',
      reason: `${counts.unresolved} invoice(s) have unresolved shadow applicability; runtime alignment cannot be concluded.`,
    };
  }
  if (counts.applicable > 0 && linkedRuleCount === 0) {
    return { status: 'unsupported', reason: 'Shadow applicability exists, but no direct runtime rule is linked to this obligation.' };
  }
  if (!hasCompletedRunEvidence) {
    return { status: 'policy_review', reason: 'No completed runtime execution evidence is available for comparison.' };
  }
  if (counts.applicable > 0 && counts.evaluated === 0) {
    return { status: 'applicable_not_evaluated', reason: 'At least one invoice is shadow-applicable, but linked runtime rules recorded no evaluated outcomes.' };
  }
  if (counts.applicable === 0 && counts.evaluated > 0) {
    return { status: 'not_applicable_but_evaluated', reason: 'The population is shadow-not-applicable, but linked runtime rules recorded evaluated outcomes.' };
  }
  return { status: 'aligned', reason: 'Population-level shadow applicability and runtime evaluation are directionally aligned.' };
}
