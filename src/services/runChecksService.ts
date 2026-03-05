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
import {
  isMofRulebookEnabled,
  isMofRulebookShadowModeEnabled,
  isMofMandatoryGateEnabled,
  getMofMandatoryGateFieldNumbers,
  LoadedRulebookBundle,
  RulebookGovernanceMetadata,
  loadMofRulebookBundle,
} from '@/lib/rulebook/loader';
import { runRulebookShadowChecks } from '@/lib/rulebook/shadowRunner';
import { buildMofRuleTraceability } from '@/lib/rulebook/traceability';
import { getControlsForDR } from '@/lib/registry/controlsRegistry';
import { getInternalFieldByMofFieldNumber } from '@/lib/rulebook/adapter';

export type PersistencePhase =
  | 'saveCheckRun'
  | 'saveExceptions'
  | 'saveClientRiskScores'
  | 'saveRunSummary'
  | 'saveEntityScores';

export interface RunLogStep {
  name: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  counts?: Record<string, number>;
}

export interface RunChecksPlan {
  readonly scope: DatasetRunScope;
  readonly datasetTypesRan: readonly DatasetType[];
}

export interface PlanRunChecksParams {
  options?: { scope?: DatasetRunScope };
  activeDatasetType: DatasetType;
  hasDatasetLoaded: (datasetType: DatasetType) => boolean;
}

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

export interface RunArtifactsOk extends RunArtifactsBase {
  kind: 'ok';
}

export interface RunArtifactsPersistFailed extends RunArtifactsBase {
  kind: 'persist_failed';
  persistenceError: unknown;
  persistencePhase?: PersistencePhase;
}

export type RunArtifacts = RunArtifactsOk | RunArtifactsPersistFailed;

interface RulebookShadowDiffCounts {
  shadowExceptions: number;
  legacyPintMappedExceptions: number;
  shadowOnly: number;
  legacyOnly: number;
  overlap: number;
  shadowDistinctExceptionCodes: number;
  shadowImpactedControls: number;
}

interface RulebookShadowTaxonomySummary {
  distinctExceptionCodes: number;
  topExceptionCodes: Array<{ code: string; count: number }>;
  impactedControlIds: string[];
}

interface MofMandatoryGateResult {
  enforcedFields: string[];
  gateExceptions: Exception[];
}

function buildRulebookGovernance(
  loadedRulebook: LoadedRulebookBundle | null,
  useMofRulebook: boolean,
  useMofShadowMode: boolean
): RulebookGovernanceMetadata {
  if (loadedRulebook) return loadedRulebook.governance;

  return {
    ruleSource: 'PINT_UC1',
    rulebookTitle: 'PINT-AE UC1 Check Pack',
    rulebookVersion: 'runtime',
    rulebookDate: 'runtime',
    crosswalkVersion: 'n/a',
    precedencePolicy: 'PINT_UC1_ONLY',
    mode: useMofRulebook ? 'enforced' : useMofShadowMode ? 'shadow' : 'legacy_only',
  };
}

function getDatasetScopeOrder(scope: DatasetRunScope): DatasetType[] {
  if (scope === 'ALL') return ['AR', 'AP'];
  return [scope];
}

function buildMofMandatoryGateExceptions(
  allRulebookShadowExceptions: Array<{
    ruleId: string;
    exceptionCode: string;
    datasetType: DatasetType;
    invoiceId?: string;
    lineId?: string;
    field?: string;
  }>,
  enforcedFieldNumbers: number[]
): MofMandatoryGateResult {
  const enforcedFields = Array.from(
    new Set(
      enforcedFieldNumbers
        .map((fieldNumber) => getInternalFieldByMofFieldNumber(fieldNumber))
        .filter((field): field is string => Boolean(field))
    )
  );

  if (enforcedFields.length === 0) {
    return { enforcedFields: [], gateExceptions: [] };
  }

  const gateExceptions: Exception[] = [];
  const seen = new Set<string>();
  allRulebookShadowExceptions.forEach((ex) => {
    if (ex.exceptionCode !== 'EINV_MISSING_MANDATORY_FIELD') return;
    if (!ex.field || !enforcedFields.includes(ex.field)) return;

    const key = `${ex.datasetType}|${ex.ruleId}|${ex.invoiceId || '-'}|${ex.lineId || '-'}|${ex.field}`;
    if (seen.has(key)) return;
    seen.add(key);

    gateExceptions.push({
      id: `mof-gate-${gateExceptions.length + 1}-${Date.now()}`,
      checkId: 'MOF-GATE-MANDATORY',
      ruleId: ex.ruleId,
      checkName: 'MoF Mandatory Field Enforcement Gate',
      severity: 'Critical',
      datasetType: ex.datasetType,
      invoiceId: ex.invoiceId,
      lineId: ex.lineId,
      field: ex.field,
      message: `MoF gate failed: mandatory field ${ex.field} is missing`,
      expectedValue: 'Required value (MoF mandatory field)',
      actualValue: '(empty)',
    });
  });

  return { enforcedFields, gateExceptions };
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

export async function runChecksPipeline({
  plan,
  getDataForDataset,
}: RunChecksPipelineParams): Promise<RunArtifacts> {
  const runLog: RunLogStep[] = [];
  let loadedRulebook: LoadedRulebookBundle | null = null;
  let shadowDiffCounts: RulebookShadowDiffCounts | null = null;

  const useMofRulebook = isMofRulebookEnabled();
  const useMofShadowMode = isMofRulebookShadowModeEnabled();
  const useMofMandatoryGate = isMofMandatoryGateEnabled();
  const mofMandatoryGateFieldNumbers = getMofMandatoryGateFieldNumbers();
  if (useMofRulebook || useMofShadowMode) {
    const rulebookStep = startStep('rulebook_shadow_validation');
    const bundle = loadMofRulebookBundle();
    loadedRulebook = bundle;
    endStep(runLog, rulebookStep, {
      rulebookEnabled: useMofRulebook ? 1 : 0,
      shadowModeEnabled: useMofShadowMode ? 1 : 0,
      rulebookValidationErrors: bundle.validation.errors.length,
      rulebookValidationWarnings: bundle.validation.warnings.length,
      adaptedRules: bundle.adapted.checks.length,
      adaptedExecutableRules: bundle.adapted.executableCount,
      adaptedNonExecutableRules: bundle.adapted.nonExecutableCount,
    });
  }

  const fetchChecksStep = startStep('fetch_enabled_pint_checks');
  const pintAEChecks = await fetchEnabledPintAEChecks();
  endStep(runLog, fetchChecksStep, { enabledChecks: pintAEChecks.length });

  const allBuiltInResults: CheckResult[] = [];
  const allPintExceptions: PintAEException[] = [];
  const allLegacyExceptions: Exception[] = [];
  const allHeadersForScope: InvoiceHeader[] = [];
  const allRulebookShadowExceptions: Array<{
    ruleId: string;
    exceptionCode: string;
    datasetType: DatasetType;
    invoiceId?: string;
    lineId?: string;
    field?: string;
  }> = [];

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

    if ((useMofRulebook || useMofShadowMode) && loadedRulebook) {
      const shadow = runRulebookShadowChecks(
        dataContext,
        loadedRulebook.rulebook,
        loadedRulebook.adapted.checks
      );
      allRulebookShadowExceptions.push(
        ...shadow.exceptions.map((ex) => ({
          ruleId: ex.ruleId,
          exceptionCode: ex.exceptionCode,
          datasetType,
          invoiceId: ex.invoiceId,
          lineId: ex.lineId,
          field: ex.field,
        }))
      );
    }
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

  let mofMandatoryGateResult: MofMandatoryGateResult | null = null;
  if (useMofRulebook && useMofMandatoryGate) {
    const gateStep = startStep('rulebook_enforcement_gate');
    mofMandatoryGateResult = buildMofMandatoryGateExceptions(
      allRulebookShadowExceptions,
      mofMandatoryGateFieldNumbers
    );
    allExceptions.push(...mofMandatoryGateResult.gateExceptions);
    endStep(runLog, gateStep, {
      configuredFieldNumbers: mofMandatoryGateFieldNumbers.length,
      resolvedEnforcedFields: mofMandatoryGateResult.enforcedFields.length,
      gateExceptions: mofMandatoryGateResult.gateExceptions.length,
    });
  }

  const stats = calculateStats(allExceptions, allHeadersForScope.length);
  endStep(runLog, mergeStep, {
    mergedCheckResults: mergedBuiltInResults.length,
    allExceptions: allExceptions.length,
  });

  let shadowTaxonomy: RulebookShadowTaxonomySummary | null = null;
  if ((useMofRulebook || useMofShadowMode) && loadedRulebook) {
    const shadowDiffStep = startStep('rulebook_shadow_diff');
    const legacyKeys = new Set(
      allLegacyExceptions.map((ex) => `${ex.invoiceId || '-'}|${ex.lineId || '-'}|${ex.field || '-'}|${ex.checkId}`)
    );
    const shadowKeys = new Set(
      allRulebookShadowExceptions.map((ex) => `${ex.invoiceId || '-'}|${ex.lineId || '-'}|${ex.field || '-'}|${ex.ruleId}`)
    );

    let overlap = 0;
    shadowKeys.forEach((k) => {
      if (legacyKeys.has(k)) overlap++;
    });

    const exceptionCodeCounts = new Map<string, number>();
    allRulebookShadowExceptions.forEach((ex) => {
      const code = ex.exceptionCode || 'UNKNOWN';
      exceptionCodeCounts.set(code, (exceptionCodeCounts.get(code) ?? 0) + 1);
    });

    const ruleTrace = buildMofRuleTraceability(loadedRulebook.rulebook);
    const drIdsByRuleId = new Map(ruleTrace.map((entry) => [entry.rule_id, entry.affected_dr_ids]));
    const impactedControlIds = new Set<string>();
    allRulebookShadowExceptions.forEach((ex) => {
      const drIds = drIdsByRuleId.get(ex.ruleId) || [];
      drIds.forEach((drId) => {
        getControlsForDR(drId).forEach((control) => impactedControlIds.add(control.control_id));
      });
    });

    const topExceptionCodes = Array.from(exceptionCodeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([code, count]) => ({ code, count }));

    shadowTaxonomy = {
      distinctExceptionCodes: exceptionCodeCounts.size,
      topExceptionCodes,
      impactedControlIds: Array.from(impactedControlIds).sort(),
    };

    shadowDiffCounts = {
      shadowExceptions: allRulebookShadowExceptions.length,
      legacyPintMappedExceptions: allLegacyExceptions.length,
      shadowOnly: Math.max(0, allRulebookShadowExceptions.length - overlap),
      legacyOnly: Math.max(0, allLegacyExceptions.length - overlap),
      overlap,
      shadowDistinctExceptionCodes: shadowTaxonomy.distinctExceptionCodes,
      shadowImpactedControls: shadowTaxonomy.impactedControlIds.length,
    };

    endStep(runLog, shadowDiffStep, shadowDiffCounts);
  }

  let runSummary: RunSummary | undefined;
  let persistencePhase: PersistencePhase | undefined;

  try {
    const saveCheckRunStep = startStep('persist_save_check_run');
    persistencePhase = 'saveCheckRun';
    const governance = buildRulebookGovernance(loadedRulebook, useMofRulebook, useMofShadowMode);
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
        ruleGovernance: governance,
        rulebookValidation: loadedRulebook
          ? {
              errors: loadedRulebook.validation.errors.length,
              warnings: loadedRulebook.validation.warnings.length,
              adaptedRules: loadedRulebook.adapted.checks.length,
              executableRules: loadedRulebook.adapted.executableCount,
              nonExecutableRules: loadedRulebook.adapted.nonExecutableCount,
            }
          : null,
        shadowDiff: shadowDiffCounts,
        rulebookShadowTaxonomy: shadowTaxonomy,
        rulebookMandatoryGate: {
          enabled: useMofRulebook && useMofMandatoryGate,
          configuredFieldNumbers: mofMandatoryGateFieldNumbers,
          enforcedFields: mofMandatoryGateResult?.enforcedFields || [],
          gateExceptions: mofMandatoryGateResult?.gateExceptions.length || 0,
        },
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
