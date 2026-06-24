import { useMemo } from 'react';

import type { CheckResult, Exception } from '@/types/compliance';

type DashboardMetricCheckResult = Pick<CheckResult, 'passed' | 'failed' | 'severity'> & {
  exceptions?: Array<Pick<Exception, 'invoiceId' | 'severity'> | undefined> | undefined;
};

type DashboardMetricException = Pick<Exception, 'invoiceId' | 'severity'>;

/**
 * Input required to calculate dashboard validation metrics for the current portfolio scope.
 */
export interface DashboardMetricsInput {
  totalInvoicesInScope: number;
  checkResults: DashboardMetricCheckResult[];
  exceptions?: DashboardMetricException[];
}

/**
 * Distinct dashboard validation metrics for document-level readiness and rule-level conformance.
 */
export interface DashboardMetrics {
  /**
   * Count of in-scope documents with no invoice-linked failed rule outcomes.
   * This is a document-level metric and should not be inferred from aggregate rule pass rate.
   */
  submissionReadyCount: number;
  /**
   * Share of in-scope documents with no invoice-linked failed rule outcomes.
   * Formula: submissionReadyCount / totalInvoicesInScope.
   */
  submissionReadyRate: number;
  /**
   * Share of executed rule outcomes that passed in the active scope.
   * This is a rule-outcome metric and can diverge from submissionReadyRate when one document fails any rule.
   */
  rulePassRate: number;
  /**
   * Total number of executed rule outcomes in the active scope.
   * Formula: sum of passed and failed outcomes across all executed checks.
   */
  totalRuleOutcomes: number;
  /**
   * Count of failed Critical-severity rule outcomes in the active scope.
   * This is an outcome count, so one document can contribute multiple blockers.
   */
  criticalBlockerOutcomes: number;
  /**
   * Count of distinct documents with at least one Critical-severity blocker.
   * This is a document count and should be read separately from criticalBlockerOutcomes.
   */
  criticalBlockerDocumentCount: number;
  /**
   * Average number of Critical-severity blocker outcomes per affected document.
   * Formula: criticalBlockerOutcomes / criticalBlockerDocumentCount, rounded to 1 decimal place.
   */
  avgCriticalBlockersPerDocument: number;
}

function collectFailedInvoiceIds(
  checkResults: DashboardMetricCheckResult[],
  exceptions: DashboardMetricException[] | undefined
) {
  const failedInvoiceIds = new Set<string>();

  checkResults.forEach((result) => {
    result.exceptions?.forEach((exception) => {
      if (exception?.invoiceId) {
        failedInvoiceIds.add(exception.invoiceId);
      }
    });
  });

  if (failedInvoiceIds.size > 0) {
    return failedInvoiceIds;
  }

  exceptions?.forEach((exception) => {
    if (exception.invoiceId) {
      failedInvoiceIds.add(exception.invoiceId);
    }
  });

  return failedInvoiceIds;
}

function collectCriticalBlockerDocumentIds(
  checkResults: DashboardMetricCheckResult[],
  exceptions: DashboardMetricException[] | undefined
) {
  const criticalBlockerDocumentIds = new Set<string>();

  checkResults
    .filter((result) => result.severity === 'Critical')
    .forEach((result) => {
      result.exceptions?.forEach((exception) => {
        if (exception?.invoiceId) {
          criticalBlockerDocumentIds.add(exception.invoiceId);
        }
      });
    });

  if (criticalBlockerDocumentIds.size > 0) {
    return criticalBlockerDocumentIds;
  }

  exceptions?.forEach((exception) => {
    if (exception.severity === 'Critical' && exception.invoiceId) {
      criticalBlockerDocumentIds.add(exception.invoiceId);
    }
  });

  return criticalBlockerDocumentIds;
}

/**
 * Computes the dashboard's document-level readiness and rule-level conformance metrics.
 */
export function computeDashboardMetrics(input: DashboardMetricsInput): DashboardMetrics {
  const totalRuleOutcomes = input.checkResults.reduce((sum, result) => sum + result.passed + result.failed, 0);
  const passedRuleOutcomes = input.checkResults.reduce((sum, result) => sum + result.passed, 0);
  const criticalOutcomeCountFromChecks = input.checkResults.reduce(
    (sum, result) => sum + (result.severity === 'Critical' ? result.failed : 0),
    0
  );
  const criticalOutcomeCountFromExceptions =
    input.exceptions?.filter((exception) => exception.severity === 'Critical').length ?? 0;
  const criticalBlockerOutcomes = Math.max(criticalOutcomeCountFromChecks, criticalOutcomeCountFromExceptions);
  const failedInvoiceIds = collectFailedInvoiceIds(input.checkResults, input.exceptions);
  const criticalBlockerDocumentCount = collectCriticalBlockerDocumentIds(input.checkResults, input.exceptions).size;
  const submissionReadyCount =
    input.totalInvoicesInScope > 0
      ? Math.max(input.totalInvoicesInScope - failedInvoiceIds.size, 0)
      : 0;

  return {
    submissionReadyCount,
    submissionReadyRate:
      input.totalInvoicesInScope > 0 ? (submissionReadyCount / input.totalInvoicesInScope) * 100 : 0,
    rulePassRate: totalRuleOutcomes > 0 ? (passedRuleOutcomes / totalRuleOutcomes) * 100 : 0,
    totalRuleOutcomes,
    criticalBlockerOutcomes,
    criticalBlockerDocumentCount,
    avgCriticalBlockersPerDocument:
      criticalBlockerDocumentCount > 0
        ? Number((criticalBlockerOutcomes / criticalBlockerDocumentCount).toFixed(1))
        : 0,
  };
}

/**
 * Memoized hook wrapper around computeDashboardMetrics for dashboard consumers.
 */
export function useDashboardMetrics(input: DashboardMetricsInput) {
  const { checkResults, exceptions, totalInvoicesInScope } = input;

  return useMemo(
    () => computeDashboardMetrics({ checkResults, exceptions, totalInvoicesInScope }),
    [checkResults, exceptions, totalInvoicesInScope]
  );
}
