import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import {
  Buyer,
  InvoiceHeader,
  InvoiceLine,
  Exception,
  CheckResult,
  DataContext,
  ParsedData,
  DashboardStats,
  Severity,
} from '@/types/compliance';
import { PintAEException, RunSummary } from '@/types/pintAE';
import { runAllChecks } from '@/lib/checks/checksRegistry';
import {
  fetchCustomChecks,
  saveCheckRun,
  saveEntityScores,
  saveInvestigationFlags,
} from '@/lib/api/checksApi';
import { calculateScore, CustomCheckConfig, InvestigationFlag } from '@/types/customChecks';
import {
  fetchEnabledPintAEChecks,
  seedUC1CheckPack,
  saveExceptions,
  saveRunSummary,
  saveClientRiskScores,
  calculateClientScores,
  generateRunSummary,
} from '@/lib/api/pintAEApi';
import { runAllPintAEChecks } from '@/lib/checks/pintAECheckRunner';
import { runCustomCheck, runSearchCheck } from '@/lib/checks/customCheckRunner';
import {
  DatasetBundle,
  DatasetRunScope,
  DatasetType,
  DEFAULT_DATASET_TYPE,
} from '@/types/datasets';

interface ComplianceContextType {
  buyers: Buyer[];
  headers: InvoiceHeader[];
  lines: InvoiceLine[];
  checkResults: CheckResult[];
  exceptions: Exception[];
  pintAEExceptions: PintAEException[];
  investigationFlags: InvestigationFlag[];
  runSummary: RunSummary | null;
  isDataLoaded: boolean;
  isChecksRun: boolean;
  isRunning: boolean;
  activeDatasetType: DatasetType;
  setActiveDatasetType: (datasetType: DatasetType) => void;
  setData: (data: ParsedData, datasetType?: DatasetType) => void;
  getDataForDataset: (datasetType: DatasetType) => ParsedData;
  hasDatasetLoaded: (datasetType: DatasetType) => boolean;
  runChecks: (options?: { scope?: DatasetRunScope }) => Promise<void>;
  runCustomChecks: (options?: { scope?: DatasetRunScope }) => Promise<void>;
  runSearchChecks: (options?: { scope?: DatasetRunScope }) => Promise<void>;
  clearData: (scope?: 'active' | 'all') => void;
  getDashboardStats: () => DashboardStats;
  getInvoiceDetails: (
    invoiceId: string,
    datasetType?: DatasetType
  ) => {
    header: InvoiceHeader | undefined;
    lines: InvoiceLine[];
    buyer: Buyer | undefined;
    exceptions: Exception[];
    pintAEExceptions: PintAEException[];
    investigationFlags: InvestigationFlag[];
  };
}

const EMPTY_PARSED_DATA: ParsedData = { buyers: [], headers: [], lines: [] };

const ComplianceContext = createContext<ComplianceContextType | undefined>(undefined);

function createEmptyBundle<T>(value: T): DatasetBundle<T> {
  return { AR: value, AP: value };
}

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

function annotateDatasetType(
  exceptions: Exception[],
  datasetType: DatasetType
): Exception[] {
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

function getRecordCountForCustomScope(check: CustomCheckConfig, dataContext: DataContext): number {
  if (check.dataset_scope === 'buyers') return dataContext.buyers.length;
  if (check.dataset_scope === 'lines') return dataContext.lines.length;
  return dataContext.headers.length;
}

export function ComplianceProvider({ children }: { children: ReactNode }) {
  const [datasets, setDatasets] = useState<DatasetBundle<ParsedData>>({
    AR: EMPTY_PARSED_DATA,
    AP: EMPTY_PARSED_DATA,
  });
  const [loadedDatasets, setLoadedDatasets] = useState<DatasetBundle<boolean>>(
    createEmptyBundle(false)
  );
  const [activeDatasetType, setActiveDatasetType] = useState<DatasetType>(DEFAULT_DATASET_TYPE);
  const [checkResults, setCheckResults] = useState<CheckResult[]>([]);
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [pintAEExceptions, setPintAEExceptions] = useState<PintAEException[]>([]);
  const [investigationFlags, setInvestigationFlags] = useState<InvestigationFlag[]>([]);
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);
  const [isChecksRun, setIsChecksRun] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const buyers = datasets[activeDatasetType].buyers;
  const headers = datasets[activeDatasetType].headers;
  const lines = datasets[activeDatasetType].lines;
  const isDataLoaded = loadedDatasets[activeDatasetType];

  useEffect(() => {
    const initChecks = async () => {
      console.log('[Compliance] Initializing PINT-AE checks...');
      const result = await seedUC1CheckPack(false);
      console.log('[Compliance] Seed result:', result.message);
    };
    initChecks();
  }, []);

  const setData = (data: ParsedData, datasetType: DatasetType = activeDatasetType) => {
    setDatasets((prev) => ({
      ...prev,
      [datasetType]: data,
    }));
    setLoadedDatasets((prev) => ({
      ...prev,
      [datasetType]: true,
    }));
    setActiveDatasetType(datasetType);
    setIsChecksRun(false);
    setCheckResults([]);
    setExceptions([]);
    setPintAEExceptions([]);
    setInvestigationFlags([]);
    setRunSummary(null);
  };

  const getDataForDataset = (datasetType: DatasetType): ParsedData => datasets[datasetType];
  const hasDatasetLoaded = (datasetType: DatasetType): boolean => loadedDatasets[datasetType];

  const runChecks = async (options?: { scope?: DatasetRunScope }) => {
    const scope = options?.scope || activeDatasetType;
    const datasetsToRun = getDatasetScopeOrder(scope).filter((datasetType) =>
      hasDatasetLoaded(datasetType)
    );

    if (datasetsToRun.length === 0) return;

    setIsRunning(true);
    try {
      const pintAEChecks = await fetchEnabledPintAEChecks();

      const allBuiltInResults: CheckResult[] = [];
      const allPintExceptions: PintAEException[] = [];
      const allLegacyExceptions: Exception[] = [];
      const allHeadersForScope: InvoiceHeader[] = [];

      datasetsToRun.forEach((datasetType) => {
        const dataset = getDataForDataset(datasetType);
        const dataContext = buildDataContext(dataset.buyers, dataset.headers, dataset.lines);
        allHeadersForScope.push(...dataset.headers);

        const builtInResults = runAllChecks(dataContext).map((result) => ({
          ...result,
          exceptions: annotateDatasetType(result.exceptions, datasetType),
        }));
        allBuiltInResults.push(...builtInResults);

        const pintExceptionsForDataset = runAllPintAEChecks(pintAEChecks, dataContext).map((exception) => ({
          ...exception,
          dataset_type: datasetType,
        }));
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

      const mergedBuiltInResults = mergeCheckResults(allBuiltInResults);
      const allExceptions = [
        ...mergedBuiltInResults.flatMap((result) => result.exceptions),
        ...allLegacyExceptions,
      ];

      setCheckResults(mergedBuiltInResults);
      setExceptions(allExceptions);
      setPintAEExceptions(allPintExceptions);
      setIsChecksRun(true);

      const stats = calculateStats(allExceptions, allHeadersForScope.length);
      const runId = await saveCheckRun({
        run_date: new Date().toISOString(),
        dataset_type: scope,
        total_invoices: allHeadersForScope.length,
        total_exceptions: allExceptions.length,
        critical_count: stats.exceptionsBySeverity.Critical,
        high_count: stats.exceptionsBySeverity.High,
        medium_count: stats.exceptionsBySeverity.Medium,
        low_count: stats.exceptionsBySeverity.Low,
        pass_rate: stats.passRate,
        results_summary: {
          checkCount: mergedBuiltInResults.length + pintAEChecks.length,
          scope,
        },
      });

      if (runId) {
        await saveExceptions(runId, allPintExceptions);

        const clientScores = calculateClientScores(allPintExceptions, allHeadersForScope);
        await saveClientRiskScores(runId, clientScores);

        const summary = generateRunSummary(
          runId,
          allHeadersForScope.length,
          allPintExceptions,
          clientScores
        );
        await saveRunSummary(summary);
        setRunSummary(summary);

        const sellerScores = calculateEntityScores(allExceptions, allHeadersForScope, 'seller');
        const invoiceScores = calculateEntityScores(allExceptions, allHeadersForScope, 'invoice');
        await saveEntityScores([
          ...sellerScores.map((score) => ({ ...score, run_id: runId })),
          ...invoiceScores.map((score) => ({ ...score, run_id: runId })),
        ]);
      }
    } finally {
      setIsRunning(false);
    }
  };

  const runCustomChecks = async (options?: { scope?: DatasetRunScope }) => {
    const scope = options?.scope || activeDatasetType;
    const datasetsToRun = getDatasetScopeOrder(scope).filter((datasetType) =>
      hasDatasetLoaded(datasetType)
    );

    if (datasetsToRun.length === 0) return;

    setIsRunning(true);
    try {
      const customChecks = await fetchCustomChecks();
      const validationChecks = customChecks.filter(
        (check) => (check.check_type || 'VALIDATION') !== 'SEARCH_CHECK'
      );

      const allResults: CheckResult[] = [];
      const allExceptions: Exception[] = [];
      const allHeadersForScope: InvoiceHeader[] = [];

      datasetsToRun.forEach((datasetType) => {
        const dataset = getDataForDataset(datasetType);
        const dataContext = buildDataContext(dataset.buyers, dataset.headers, dataset.lines);
        allHeadersForScope.push(...dataset.headers);

        const customResults = validationChecks.map((check) => {
          const exceptionsForCheck = annotateDatasetType(runCustomCheck(check, dataContext), datasetType);
          const totalRecords = getRecordCountForCustomScope(check, dataContext);
          const result: CheckResult = {
            checkId: check.id || `custom-${check.name}`,
            checkName: check.name,
            severity: check.severity,
            passed: Math.max(0, totalRecords - exceptionsForCheck.length),
            failed: exceptionsForCheck.length,
            exceptions: exceptionsForCheck,
          };
          allExceptions.push(...exceptionsForCheck);
          return result;
        });

        allResults.push(...customResults);
      });

      const mergedResults = mergeCheckResults(allResults);
      setCheckResults(mergedResults);
      setExceptions(allExceptions);
      setPintAEExceptions([]);
      setIsChecksRun(true);
      setRunSummary(null);

      const stats = calculateStats(allExceptions, allHeadersForScope.length);
      const runId = await saveCheckRun({
        run_date: new Date().toISOString(),
        dataset_type: scope,
        total_invoices: allHeadersForScope.length,
        total_exceptions: allExceptions.length,
        critical_count: stats.exceptionsBySeverity.Critical,
        high_count: stats.exceptionsBySeverity.High,
        medium_count: stats.exceptionsBySeverity.Medium,
        low_count: stats.exceptionsBySeverity.Low,
        pass_rate: stats.passRate,
        results_summary: {
          checkCount: mergedResults.length,
          runType: 'custom_only',
          scope,
        },
      });

      if (runId) {
        const sellerScores = calculateEntityScores(allExceptions, allHeadersForScope, 'seller');
        const invoiceScores = calculateEntityScores(allExceptions, allHeadersForScope, 'invoice');
        await saveEntityScores([
          ...sellerScores.map((score) => ({ ...score, run_id: runId })),
          ...invoiceScores.map((score) => ({ ...score, run_id: runId })),
        ]);
      }
    } finally {
      setIsRunning(false);
    }
  };

  const runSearchChecks = async (options?: { scope?: DatasetRunScope }) => {
    const scope = options?.scope || activeDatasetType;
    const datasetsToRun = getDatasetScopeOrder(scope)
      .filter((datasetType) => datasetType === 'AP')
      .filter((datasetType) => hasDatasetLoaded(datasetType));

    if (datasetsToRun.length === 0) {
      setInvestigationFlags([]);
      return;
    }

    setIsRunning(true);
    try {
      const customChecks = await fetchCustomChecks();
      const searchChecks = customChecks.filter(
        (check) => (check.check_type || 'VALIDATION') === 'SEARCH_CHECK'
      );

      const flags: InvestigationFlag[] = [];
      datasetsToRun.forEach((datasetType) => {
        const dataset = getDataForDataset(datasetType);
        const dataContext = buildDataContext(dataset.buyers, dataset.headers, dataset.lines);
        searchChecks.forEach((check) => {
          flags.push(...runSearchCheck(check, dataContext, datasetType));
        });
      });

      setInvestigationFlags(flags);
      await saveInvestigationFlags(null, flags);
    } finally {
      setIsRunning(false);
    }
  };

  const clearData = (scope: 'active' | 'all' = 'active') => {
    if (scope === 'all') {
      setDatasets({
        AR: EMPTY_PARSED_DATA,
        AP: EMPTY_PARSED_DATA,
      });
      setLoadedDatasets(createEmptyBundle(false));
    } else {
      setDatasets((prev) => ({
        ...prev,
        [activeDatasetType]: EMPTY_PARSED_DATA,
      }));
      setLoadedDatasets((prev) => ({
        ...prev,
        [activeDatasetType]: false,
      }));
    }

    setCheckResults([]);
    setExceptions([]);
    setPintAEExceptions([]);
    setInvestigationFlags([]);
    setRunSummary(null);
    setIsChecksRun(false);
  };

  const getDashboardStats = (): DashboardStats => calculateStats(exceptions, headers.length);

  const getInvoiceDetails = (invoiceId: string, datasetType?: DatasetType) => {
    const primary = datasetType || activeDatasetType;
    const fallback = primary === 'AR' ? 'AP' : 'AR';
    const orderedDatasets: DatasetType[] = [primary, fallback];

    for (const currentDatasetType of orderedDatasets) {
      const dataset = getDataForDataset(currentDatasetType);
      const header = dataset.headers.find((item) => item.invoice_id === invoiceId);
      if (!header) continue;

      const invoiceLines = dataset.lines.filter((line) => line.invoice_id === invoiceId);
      const buyer = dataset.buyers.find((item) => item.buyer_id === header.buyer_id);
      const invoiceExceptions = exceptions.filter(
        (exception) =>
          exception.invoiceId === invoiceId &&
          (!exception.datasetType || exception.datasetType === currentDatasetType)
      );
      const invoicePintAEExceptions = pintAEExceptions.filter(
        (exception) =>
          exception.invoice_id === invoiceId &&
          (!exception.dataset_type || exception.dataset_type === currentDatasetType)
      );
      const invoiceFlags = investigationFlags.filter(
        (flag) => flag.invoiceId === invoiceId && flag.datasetType === currentDatasetType
      );

      return {
        header,
        lines: invoiceLines,
        buyer,
        exceptions: invoiceExceptions,
        pintAEExceptions: invoicePintAEExceptions,
        investigationFlags: invoiceFlags,
      };
    }

    return {
      header: undefined,
      lines: [],
      buyer: undefined,
      exceptions: [],
      pintAEExceptions: [],
      investigationFlags: [],
    };
  };

  return (
    <ComplianceContext.Provider
      value={{
        buyers,
        headers,
        lines,
        checkResults,
        exceptions,
        pintAEExceptions,
        investigationFlags,
        runSummary,
        isDataLoaded,
        isChecksRun,
        isRunning,
        activeDatasetType,
        setActiveDatasetType,
        setData,
        getDataForDataset,
        hasDatasetLoaded,
        runChecks,
        runCustomChecks,
        runSearchChecks,
        clearData,
        getDashboardStats,
        getInvoiceDetails,
      }}
    >
      {children}
    </ComplianceContext.Provider>
  );
}

export function useCompliance() {
  const context = useContext(ComplianceContext);
  if (context === undefined) throw new Error('useCompliance must be used within a ComplianceProvider');
  return context;
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
