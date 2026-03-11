import {
  Buyer,
  CheckResult,
  DashboardStats,
  DataContext,
  Exception,
  InvoiceHeader,
  InvoiceLine,
  ParsedData,
  Severity,
} from '@/types/compliance';
import { DatasetRunScope, DatasetType } from '@/types/datasets';
import { PintAEException, RunSummary } from '@/types/pintAE';
import { runAllChecks } from '@/lib/checks/checksRegistry';
import { runAllPintAEChecks } from '@/lib/checks/pintAECheckRunner';
import {
  fetchEnabledPintAEChecks,
  saveExceptions,
  saveRunSummary,
  saveClientRiskScores,
  calculateClientScores,
  generateRunSummary,
} from '@/lib/api/pintAEApi';
import { saveCheckRun, saveEntityScores } from '@/lib/api/checksApi';
import { calculateScore } from '@/types/customChecks';

/**
 * @deprecated Legacy/frozen compatibility module.
 *
 * Canonical runtime execution path is:
 * `ComplianceContext.runChecks -> runChecksOrchestrator`.
 *
 * No new call sites should use this module. It is retained only for
 * compatibility and regression coverage pending an explicit removal review.
 */

/** @deprecated Legacy/frozen service contract. */
export type PersistencePhase =
  | 'saveCheckRun'
  | 'saveExceptions'
  | 'saveClientRiskScores'
  | 'saveRunSummary'
  | 'saveEntityScores';

/** @deprecated Legacy/frozen service contract. */
export interface RunLogStep {
  name: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  counts?: Record<string, number>;
}

/** @deprecated Legacy/frozen service contract. */
export interface RunChecksPlan {
  readonly scope: DatasetRunScope;
  readonly datasetTypesRan: readonly DatasetType[];
}

/** @deprecated Legacy/frozen service contract. */
export interface PlanRunChecksParams {
  options?: { scope?: DatasetRunScope };
  activeDatasetType: DatasetType;
  hasDatasetLoaded: (datasetType: DatasetType) => boolean;
}

/** @deprecated Legacy/frozen service contract. */
export interface RunChecksPipelineParams {
  plan: RunChecksPlan;
  getDataForDataset: (datasetType: DatasetType) => ParsedData;
}

interface RunArtifactsBase {
  mergedCheckResults: CheckResult[];
  allExceptions: Exception[];
  allPintAEExceptions: PintAEException[];
  runSummary?: RunSummary;
  runLog?: RunLogStep[];
}

/** @deprecated Legacy/frozen service contract. */
export interface RunArtifactsOk extends RunArtifactsBase {
  kind: 'ok';
}

/** @deprecated Legacy/frozen service contract. */
export interface RunArtifactsPersistFailed extends RunArtifactsBase {
  kind: 'persist_failed';
  persistenceError: unknown;
  persistencePhase?: PersistencePhase;
}

/** @deprecated Legacy/frozen service contract. */
export type RunArtifacts = RunArtifactsOk | RunArtifactsPersistFailed;

function getDatasetScopeOrder(scope: DatasetRunScope): DatasetType[] {
  if (scope === 'ALL') return ['AR', 'AP'];
  return [scope];
}

function mergeCheckResults(results: CheckResult[]): CheckResult[] {
  const map = new Map<string, CheckResult>();

  results.forEach((result) => {
    const existing = map.get(result.checkId);
    if (!existing) {
      map.set(result.checkId, {
        ...result,
        exceptions: [...result.exceptions],
      });
      return;
    }

    existing.passed += result.passed;
    existing.failed += result.failed;
    existing.exceptions.push(...result.exceptions);
  });

  return Array.from(map.values());
}

function annotateDatasetType(exceptions: Exception[], datasetType: DatasetType): Exception[] {
  return exceptions.map((exception) => ({
    ...exception,
    datasetType,
  }));
}

function buildDataContext(buyers: Buyer[], headers: InvoiceHeader[], lines: InvoiceLine[]): DataContext {
  const buyerMap = new Map(buyers.map((buyer) => [buyer.buyer_id, buyer]));
  const headerMap = new Map(headers.map((header) => [header.invoice_id, header]));
  const linesByInvoice = new Map<string, InvoiceLine[]>();

  lines.forEach((line) => {
    if (!linesByInvoice.has(line.invoice_id)) {
      linesByInvoice.set(line.invoice_id, []);
    }
    linesByInvoice.get(line.invoice_id)!.push(line);
  });

  return { buyers, headers, lines, buyerMap, headerMap, linesByInvoice };
}

function calculateStats(excs: Exception[], totalInvoices: number): DashboardStats {
  const severityCounts: Record<Severity, number> = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  excs.forEach((exception) => severityCounts[exception.severity]++);
  const invoicesWithExceptions = new Set(
    excs.filter((exception) => exception.invoiceId).map((exception) => exception.invoiceId)
  ).size;
  const passRate =
    totalInvoices > 0 ? ((totalInvoices - invoicesWithExceptions) / totalInvoices) * 100 : 100;
  return {
    totalInvoices,
    totalExceptions: excs.length,
    exceptionsBySeverity: severityCounts,
    topFailingChecks: [],
    passRate,
  };
}

function calculateEntityScores(
  excs: Exception[],
  hdrs: InvoiceHeader[],
  type: 'seller' | 'invoice'
) {
  const entityMap = new Map<
    string,
    { critical: number; high: number; medium: number; low: number; name?: string }
  >();

  hdrs.forEach((header) => {
    const id = type === 'seller' ? header.seller_trn : header.invoice_id;
    if (!entityMap.has(id)) {
      entityMap.set(id, {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        name: type === 'invoice' ? header.invoice_number : undefined,
      });
    }
  });

  excs.forEach((exception) => {
    const id = type === 'seller' ? exception.sellerTrn : exception.invoiceId;
    if (id && entityMap.has(id)) {
      const counts = entityMap.get(id)!;
      if (exception.severity === 'Critical') counts.critical++;
      else if (exception.severity === 'High') counts.high++;
      else if (exception.severity === 'Medium') counts.medium++;
      else counts.low++;
    }
  });

  return Array.from(entityMap.entries()).map(([id, counts]) => ({
    entity_type: type as 'seller' | 'invoice',
    entity_id: id,
    entity_name: counts.name,
    score: calculateScore(counts.critical, counts.high, counts.medium, counts.low),
    total_exceptions: counts.critical + counts.high + counts.medium + counts.low,
    critical_count: counts.critical,
    high_count: counts.high,
    medium_count: counts.medium,
    low_count: counts.low,
  }));
}

function startStep(name: string): { name: string; startedAt: string; startedAtMs: number } {
  return {
    name,
    startedAt: new Date().toISOString(),
    startedAtMs: Date.now(),
  };
}

function endStep(
  runLog: RunLogStep[],
  step: { name: string; startedAt: string; startedAtMs: number },
  counts?: Record<string, number>
): void {
  const endedAtMs = Date.now();
  runLog.push({
    name: step.name,
    startedAt: step.startedAt,
    endedAt: new Date(endedAtMs).toISOString(),
    durationMs: Math.max(0, endedAtMs - step.startedAtMs),
    ...(counts ? { counts } : {}),
  });
}

/**
 * @deprecated Legacy/frozen API.
 * Use orchestrator-driven runtime path for active execution.
 */
export function planRunChecks({
  options,
  activeDatasetType,
  hasDatasetLoaded,
}: PlanRunChecksParams): RunChecksPlan {
  const scope = options?.scope || activeDatasetType;
  const datasetTypesRan = getDatasetScopeOrder(scope).filter((datasetType) =>
    hasDatasetLoaded(datasetType)
  );

  return {
    scope,
    datasetTypesRan: [...datasetTypesRan],
  };
}

/**
 * @deprecated Legacy/frozen API.
 * Use orchestrator-driven runtime path for active execution.
 */
export async function runChecksPipeline({
  plan,
  getDataForDataset,
}: RunChecksPipelineParams): Promise<RunArtifacts> {
  const runLog: RunLogStep[] = [];

  const fetchChecksStep = startStep('fetch_enabled_pint_checks');
  const pintAEChecks = await fetchEnabledPintAEChecks();
  endStep(runLog, fetchChecksStep, { enabledChecks: pintAEChecks.length });

  const allBuiltInResults: CheckResult[] = [];
  const allPintExceptions: PintAEException[] = [];
  const allLegacyExceptions: Exception[] = [];
  const allHeadersForScope: InvoiceHeader[] = [];

  const executeDatasetsStep = startStep('execute_datasets');
  plan.datasetTypesRan.forEach((datasetType) => {
    const dataset = getDataForDataset(datasetType);
    const dataContext = buildDataContext(dataset.buyers, dataset.headers, dataset.lines);
    allHeadersForScope.push(...dataset.headers);

    const builtInResults = runAllChecks(dataContext).map((result) => ({
      ...result,
      exceptions: annotateDatasetType(result.exceptions, datasetType),
    }));
    allBuiltInResults.push(...builtInResults);

    const pintExceptionsForDataset = runAllPintAEChecks(pintAEChecks, dataContext).map(
      (exception) => ({
        ...exception,
        dataset_type: datasetType,
      })
    );
    allPintExceptions.push(...pintExceptionsForDataset);

    const legacyExceptionsForDataset: Exception[] = pintExceptionsForDataset.map((exception) => ({
      id: exception.id,
      checkId: exception.check_id,
      checkName: exception.check_name,
      severity: exception.severity,
      message: exception.message,
      datasetType,
      invoiceId: exception.invoice_id,
      invoiceNumber: exception.invoice_number,
      sellerTrn: exception.seller_trn,
      buyerId: exception.buyer_id,
      lineId: exception.line_id,
      field: exception.field_name,
      expectedValue: exception.expected_value_or_rule,
      actualValue: exception.observed_value,
    }));
    allLegacyExceptions.push(...legacyExceptionsForDataset);
  });
  endStep(runLog, executeDatasetsStep, {
    datasetTypesRan: plan.datasetTypesRan.length,
    builtInResults: allBuiltInResults.length,
    pintExceptions: allPintExceptions.length,
    invoices: allHeadersForScope.length,
  });

  const mergeStep = startStep('merge_results');
  const mergedBuiltInResults = mergeCheckResults(allBuiltInResults);
  const allExceptions = [
    ...mergedBuiltInResults.flatMap((result) => result.exceptions),
    ...allLegacyExceptions,
  ];
  const stats = calculateStats(allExceptions, allHeadersForScope.length);
  endStep(runLog, mergeStep, {
    mergedCheckResults: mergedBuiltInResults.length,
    allExceptions: allExceptions.length,
  });

  let runSummary: RunSummary | undefined;
  let persistencePhase: PersistencePhase | undefined;

  try {
    const saveCheckRunStep = startStep('persist_save_check_run');
    persistencePhase = 'saveCheckRun';
    const runId = await saveCheckRun({
      run_date: new Date().toISOString(),
      dataset_type: plan.scope,
      total_invoices: allHeadersForScope.length,
      total_exceptions: allExceptions.length,
      critical_count: stats.exceptionsBySeverity.Critical,
      high_count: stats.exceptionsBySeverity.High,
      medium_count: stats.exceptionsBySeverity.Medium,
      low_count: stats.exceptionsBySeverity.Low,
      pass_rate: stats.passRate,
      results_summary: {
        checkCount: mergedBuiltInResults.length + pintAEChecks.length,
        scope: plan.scope,
      },
    });
    endStep(runLog, saveCheckRunStep, {
      hasRunId: runId ? 1 : 0,
      totalExceptions: allExceptions.length,
    });

    if (runId) {
      const saveExceptionsStep = startStep('persist_save_exceptions');
      persistencePhase = 'saveExceptions';
      await saveExceptions(runId, allPintExceptions);
      endStep(runLog, saveExceptionsStep, { pintExceptions: allPintExceptions.length });

      const scoresStep = startStep('persist_save_client_scores');
      const clientScores = calculateClientScores(allPintExceptions, allHeadersForScope);
      persistencePhase = 'saveClientRiskScores';
      await saveClientRiskScores(runId, clientScores);
      endStep(runLog, scoresStep, { clientScores: clientScores.length });

      const summaryStep = startStep('persist_save_run_summary');
      const summary = generateRunSummary(
        runId,
        allHeadersForScope.length,
        allPintExceptions,
        clientScores
      );
      persistencePhase = 'saveRunSummary';
      await saveRunSummary(summary);
      runSummary = summary;
      endStep(runLog, summaryStep, { totalExceptions: summary.total_exceptions });

      const entityScoresStep = startStep('persist_save_entity_scores');
      const sellerScores = calculateEntityScores(allExceptions, allHeadersForScope, 'seller');
      const invoiceScores = calculateEntityScores(allExceptions, allHeadersForScope, 'invoice');
      persistencePhase = 'saveEntityScores';
      await saveEntityScores([
        ...sellerScores.map((score) => ({ ...score, run_id: runId })),
        ...invoiceScores.map((score) => ({ ...score, run_id: runId })),
      ]);
      endStep(runLog, entityScoresStep, {
        sellerScores: sellerScores.length,
        invoiceScores: invoiceScores.length,
      });
    }
  } catch (persistenceError) {
    return {
      kind: 'persist_failed',
      mergedCheckResults: mergedBuiltInResults,
      allExceptions,
      allPintAEExceptions: allPintExceptions,
      runSummary,
      runLog,
      persistenceError,
      persistencePhase,
    };
  }

  return {
    kind: 'ok',
    mergedCheckResults: mergedBuiltInResults,
    allExceptions,
    allPintAEExceptions: allPintExceptions,
    runSummary,
    runLog,
  };
}
