import React, { createContext, useContext, useState, ReactNode } from 'react';
import { 
  Buyer, 
  InvoiceHeader, 
  InvoiceLine, 
  Exception, 
  CheckResult,
  ParsedData,
  DashboardStats,
  Severity
} from '@/types/compliance';
import { PintAEException, RunSummary } from '@/types/pintAE';
import { saveCheckRun, saveEntityScores } from '@/lib/api/checksApi';
import { calculateScore } from '@/types/customChecks';
import { DEFAULT_DIRECTION, Direction, OrganizationProfile } from '@/types/direction';
import { 
  saveExceptions, 
  saveRunSummary,
  saveClientRiskScores,
  calculateClientScores,
  generateRunSummary
} from '@/lib/api/pintAEApi';
import { NewUploadLogEntry, UploadLogEntry } from '@/types/uploadLog';
import { getRulesetForDirection, RULESET_VERSION } from '@/lib/validation/rulesetRouter';
import { resolveDirection } from '@/lib/direction/directionUtils';
import { DatasetType } from '@/types/datasets';
import { InvestigationFlag } from '@/types/customChecks';
import { runChecksOrchestrator } from '@/engine/orchestrator';
import { buildEvidenceRunSnapshot } from '@/lib/evidence/evidenceRunSnapshot';
import { EvidenceRuleExecutionTelemetryRow } from '@/types/evidence';
import { WorkspaceProvider, useWorkspace } from '@/context/WorkspaceContext';
import { UploadLogProvider, useUploadLogs } from '@/context/UploadLogContext';
import { toast } from 'sonner';

interface ComplianceContextType {
  direction: Direction;
  activeDatasetType: DatasetType;
  setDirection: (direction: Direction) => void;
  setActiveDatasetType: (datasetType: DatasetType) => void;
  organizationProfile: OrganizationProfile;
  setOrganizationProfile: (profile: OrganizationProfile) => void;
  uploadSessionId: string | null;
  uploadManifestId: string | null;
  activeMappingProfileByDirection: Record<Direction, { id: string; version: number } | null>;
  setActiveMappingProfileForDirection: (direction: Direction, profile: { id: string; version: number } | null) => void;
  buyers: Buyer[];
  headers: InvoiceHeader[];
  lines: InvoiceLine[];
  checkResults: CheckResult[];
  exceptions: Exception[];
  investigationFlags: InvestigationFlag[];
  pintAEExceptions: PintAEException[];
  runSummary: RunSummary | null;
  lastPintRuleTelemetry: EvidenceRuleExecutionTelemetryRow[];
  lastChecksRunAt: string | null;
  lastChecksRunDatasetType: DatasetType | null;
  isDataLoaded: boolean;
  isChecksRun: boolean;
  isRunning: boolean;
  uploadLogs: UploadLogEntry[];
  setData: (data: ParsedData, options?: DatasetType | { direction?: Direction; uploadSessionId?: string; uploadManifestId?: string }) => void;
  getDataForDataset: (datasetType: DatasetType) => ParsedData;
  hasDatasetLoaded: (datasetType: DatasetType) => boolean;
  runChecks: (options?: { mappingProfileId?: string; mappingVersion?: number }) => Promise<void>;
  clearData: () => void;
  addUploadLogEntry: (entry: NewUploadLogEntry) => void;
  deleteUploadLogEntry: (id: string) => void;
  clearUploadLogs: () => void;
  getDashboardStats: (directionFilter?: Direction | 'all') => DashboardStats;
  getInvoiceDetails: (invoiceId: string) => {
    header: InvoiceHeader | undefined;
    lines: InvoiceLine[];
    buyer: Buyer | undefined;
    exceptions: Exception[];
    pintAEExceptions: PintAEException[];
  };
}

const ComplianceContext = createContext<ComplianceContextType | undefined>(undefined);

export function ComplianceProvider({ children }: { children: ReactNode }) {
  return (
    <WorkspaceProvider>
      <UploadLogProvider>
        <ComplianceStateProvider>{children}</ComplianceStateProvider>
      </UploadLogProvider>
    </WorkspaceProvider>
  );
}

function ComplianceStateProvider({ children }: { children: ReactNode }) {
  const {
    direction,
    activeDatasetType,
    setDirection: setWorkspaceDirection,
    setActiveDatasetType: setWorkspaceActiveDatasetType,
    organizationProfile,
    setOrganizationProfile,
    uploadSessionId,
    setUploadSessionId,
    uploadManifestId,
    setUploadManifestId,
    activeMappingProfileByDirection,
    setActiveMappingProfileForDirection,
  } = useWorkspace();
  const { uploadLogs, addUploadLogEntry, deleteUploadLogEntry, clearUploadLogs } = useUploadLogs();
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [headers, setHeaders] = useState<InvoiceHeader[]>([]);
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [checkResults, setCheckResults] = useState<CheckResult[]>([]);
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [investigationFlags] = useState<InvestigationFlag[]>([]);
  const [pintAEExceptions, setPintAEExceptions] = useState<PintAEException[]>([]);
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);
  const [lastPintRuleTelemetry, setLastPintRuleTelemetry] = useState<EvidenceRuleExecutionTelemetryRow[]>([]);
  const [lastChecksRunAt, setLastChecksRunAt] = useState<string | null>(null);
  const [lastChecksRunDatasetType, setLastChecksRunDatasetType] = useState<DatasetType | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isChecksRun, setIsChecksRun] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [dataByDirection, setDataByDirection] = useState<Record<Direction, ParsedData>>({
    AR: { buyers: [], headers: [], lines: [], direction: 'AR' },
    AP: { buyers: [], headers: [], lines: [], direction: 'AP' },
  });

  // Intentionally do not auto-seed on mount.
  // Check-pack synchronization is handled explicitly in Run Checks workflow.

  const getDataForDataset = (datasetType: DatasetType): ParsedData => {
    return dataByDirection[datasetType] || { buyers: [], headers: [], lines: [], direction: datasetType };
  };

  const hasDatasetLoaded = (datasetType: DatasetType): boolean => {
    const dataset = getDataForDataset(datasetType);
    return dataset.headers.length > 0 || dataset.lines.length > 0 || dataset.buyers.length > 0;
  };

  const applyDatasetToVisibleState = (datasetType: DatasetType) => {
    const target = getDataForDataset(datasetType);
    setWorkspaceDirection(datasetType);
    setBuyers(target.buyers);
    setHeaders(target.headers);
    setLines(target.lines);
    setIsDataLoaded(hasDatasetLoaded(datasetType));
  };

  const setActiveDatasetType = (datasetType: DatasetType) => {
    setWorkspaceActiveDatasetType(datasetType);
    applyDatasetToVisibleState(datasetType);
  };

  const setDirection = (nextDirection: Direction) => {
    setActiveDatasetType(nextDirection);
  };

  const setData = (
    data: ParsedData,
    options?: DatasetType | { direction?: Direction; uploadSessionId?: string; uploadManifestId?: string },
  ) => {
    const optionsObj =
      typeof options === 'string' ? { direction: options } : options || {};
    const resolvedDirection = optionsObj.direction || data.direction || direction || DEFAULT_DIRECTION;

    if (optionsObj.uploadSessionId) setUploadSessionId(optionsObj.uploadSessionId);
    if (optionsObj.uploadManifestId) setUploadManifestId(optionsObj.uploadManifestId);

    const normalizedData: ParsedData = {
      buyers: data.buyers.map((buyer) => ({
        ...buyer,
        upload_session_id: optionsObj.uploadSessionId || data.uploadSessionId,
        upload_manifest_id: optionsObj.uploadManifestId || data.uploadManifestId,
      })),
      headers: data.headers.map((header) => ({
        ...header,
        direction: resolveDirection(header.direction || resolvedDirection),
        upload_session_id: optionsObj.uploadSessionId || data.uploadSessionId,
        upload_manifest_id: optionsObj.uploadManifestId || data.uploadManifestId,
      })),
      lines: data.lines.map((line) => ({
        ...line,
        upload_session_id: optionsObj.uploadSessionId || data.uploadSessionId,
        upload_manifest_id: optionsObj.uploadManifestId || data.uploadManifestId,
      })),
      direction: resolvedDirection,
      uploadSessionId: optionsObj.uploadSessionId || data.uploadSessionId,
      uploadManifestId: optionsObj.uploadManifestId || data.uploadManifestId,
    };

    setDataByDirection((prev) => ({ ...prev, [resolvedDirection]: normalizedData }));
    setWorkspaceDirection(resolvedDirection);
    setBuyers(normalizedData.buyers);
    setHeaders(normalizedData.headers);
    setLines(normalizedData.lines);
    setIsDataLoaded(true);
    setIsChecksRun(false);
    setCheckResults([]);
    setExceptions([]);
    setPintAEExceptions([]);
    setRunSummary(null);
    setLastChecksRunAt(null);
    setLastChecksRunDatasetType(null);
  };

  const runChecks = async (options?: { mappingProfileId?: string; mappingVersion?: number }) => {
    setIsRunning(true);
    try {
      const activeMappingProfile = activeMappingProfileByDirection[direction];
      const mappingProfileId = options?.mappingProfileId || activeMappingProfile?.id;
      const activeRuleset = getRulesetForDirection(direction);

      const orchestrationResult = await runChecksOrchestrator({
        direction,
        buyers,
        headers,
        lines,
        organizationProfile,
        uploadSessionId: uploadSessionId || undefined,
        uploadManifestId: uploadManifestId || undefined,
        mappingProfileId,
        rulesetVersion: RULESET_VERSION,
      });

      const {
        builtInResults,
        coreTelemetry,
        pintAEChecks,
        pintExceptions,
        pintTelemetry,
        orgProfileTelemetry,
        allExceptions,
      } = orchestrationResult;
      const combinedTelemetry = [...coreTelemetry, ...pintTelemetry, ...orgProfileTelemetry];
      setCheckResults(builtInResults.map((result) => ({ ...result, direction, datasetType: direction })));
      setExceptions(allExceptions);
      setPintAEExceptions(pintExceptions);
      setLastPintRuleTelemetry(combinedTelemetry);
      setIsChecksRun(true);
      setLastChecksRunAt(new Date().toISOString());
      setLastChecksRunDatasetType(direction);

      // Persist run outputs after UI state is updated.
      const stats = calculateStats(allExceptions, headers.length);
      const evidenceSnapshot = buildEvidenceRunSnapshot(buyers, headers, lines);
      const runId = await saveCheckRun({
        run_date: new Date().toISOString(),
        total_invoices: headers.length,
        total_exceptions: allExceptions.length,
        critical_count: stats.exceptionsBySeverity.Critical,
        high_count: stats.exceptionsBySeverity.High,
        medium_count: stats.exceptionsBySeverity.Medium,
        low_count: stats.exceptionsBySeverity.Low,
        pass_rate: stats.passRate,
        results_summary: {
          checkCount: builtInResults.length + pintAEChecks.length,
          direction,
          ruleset: activeRuleset,
          rulesetVersion: RULESET_VERSION,
          uploadSessionId,
          uploadManifestId,
          mappingProfileId: mappingProfileId || null,
          mappingVersion: options?.mappingVersion || activeMappingProfile?.version || null,
          evidenceSnapshot,
          evidenceRuleExecutionTelemetry: combinedTelemetry,
        },
      });

      if (!runId) {
        toast.info('Checks completed, but run history could not be saved.');
        return;
      }

      const clientScores = calculateClientScores(pintExceptions, headers);
      const summary = generateRunSummary(runId, headers.length, pintExceptions, clientScores);
      const sellerScores = calculateEntityScores(allExceptions, headers, 'seller');
      const invoiceScores = calculateEntityScores(allExceptions, headers, 'invoice');

      const [
        exceptionsSaved,
        clientScoresSaved,
        runSummarySaved,
        entityScoresSaved,
      ] = await Promise.all([
        saveExceptions(runId, pintExceptions),
        saveClientRiskScores(runId, clientScores),
        saveRunSummary(summary),
        saveEntityScores([
          ...sellerScores.map(s => ({ ...s, run_id: runId })),
          ...invoiceScores.map(s => ({ ...s, run_id: runId })),
        ]),
      ]);

      if (exceptionsSaved) {
        setExceptions((prev) => prev.map((exception) => ({ ...exception, validationRunId: runId })));
      }
      if (runSummarySaved) {
        setRunSummary(summary);
      }

      if (!exceptionsSaved || !clientScoresSaved || !runSummarySaved || !entityScoresSaved) {
        toast.info('Checks completed, but some run artifacts could not be saved.');
      }
    } catch (error) {
      console.error('Error running checks:', error);
      toast.error(error instanceof Error ? `Run checks failed: ${error.message}` : 'Run checks failed.');
      throw error;
    } finally {
      setIsRunning(false);
    }
  };

  const calculateStats = (excs: Exception[], totalInvoices: number): DashboardStats => {
    const severityCounts: Record<Severity, number> = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    excs.forEach(e => severityCounts[e.severity]++);
    const invoicesWithExceptions = new Set(excs.filter(e => e.invoiceId).map(e => e.invoiceId)).size;
    const passRate = totalInvoices > 0 ? ((totalInvoices - invoicesWithExceptions) / totalInvoices) * 100 : 100;
    return { totalInvoices, totalExceptions: excs.length, exceptionsBySeverity: severityCounts, topFailingChecks: [], passRate };
  };

  const calculateEntityScores = (excs: Exception[], hdrs: InvoiceHeader[], type: 'seller' | 'invoice') => {
    const entityMap = new Map<string, { critical: number; high: number; medium: number; low: number; name?: string }>();
    
    hdrs.forEach(h => {
      const id = type === 'seller' ? h.seller_trn : h.invoice_id;
      if (!entityMap.has(id)) {
        entityMap.set(id, { critical: 0, high: 0, medium: 0, low: 0, name: type === 'invoice' ? h.invoice_number : undefined });
      }
    });

    excs.forEach(e => {
      const id = type === 'seller' ? e.sellerTrn : e.invoiceId;
      if (id && entityMap.has(id)) {
        const counts = entityMap.get(id)!;
        if (e.severity === 'Critical') counts.critical++;
        else if (e.severity === 'High') counts.high++;
        else if (e.severity === 'Medium') counts.medium++;
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
  };

  const clearData = () => {
    setDataByDirection({
      AR: { buyers: [], headers: [], lines: [], direction: 'AR' },
      AP: { buyers: [], headers: [], lines: [], direction: 'AP' },
    });
    setBuyers([]); setHeaders([]); setLines([]);
    setCheckResults([]); setExceptions([]); setPintAEExceptions([]);
    setRunSummary(null);
    setLastPintRuleTelemetry([]);
    setLastChecksRunAt(null);
    setLastChecksRunDatasetType(null);
    setIsDataLoaded(false); setIsChecksRun(false);
    setUploadSessionId(null);
    setUploadManifestId(null);
  };

  const getDashboardStats = (directionFilter: Direction | 'all' = direction): DashboardStats => {
    if (directionFilter === 'all') return calculateStats(exceptions, headers.length);
    const scopedHeaders = headers.filter((header) => resolveDirection(header.direction || direction) === directionFilter);
    const scopedHeaderIds = new Set(scopedHeaders.map((header) => header.invoice_id));
    const scopedExceptions = exceptions.filter(
      (exception) =>
        resolveDirection(exception.direction || direction) === directionFilter ||
        (exception.invoiceId ? scopedHeaderIds.has(exception.invoiceId) : false),
    );
    return calculateStats(scopedExceptions, scopedHeaders.length);
  };

  const getInvoiceDetails = (invoiceId: string) => {
    const header = headers.find(h => h.invoice_id === invoiceId);
    const invoiceLines = lines.filter(l => l.invoice_id === invoiceId);
    const buyer = header ? buyers.find(b => b.buyer_id === header.buyer_id) : undefined;
    const invoiceExceptions = exceptions.filter(e => e.invoiceId === invoiceId);
    const invoicePintAEExceptions = pintAEExceptions.filter(e => e.invoice_id === invoiceId);
    return { header, lines: invoiceLines, buyer, exceptions: invoiceExceptions, pintAEExceptions: invoicePintAEExceptions };
  };

  return (
    <ComplianceContext.Provider value={{
      direction,
      activeDatasetType,
      setDirection,
      setActiveDatasetType,
      organizationProfile,
      setOrganizationProfile,
      uploadSessionId,
      uploadManifestId,
      activeMappingProfileByDirection,
      setActiveMappingProfileForDirection,
      buyers, headers, lines, checkResults, exceptions, investigationFlags, pintAEExceptions, runSummary, lastPintRuleTelemetry, lastChecksRunAt, lastChecksRunDatasetType,
      isDataLoaded, isChecksRun, isRunning,
      uploadLogs,
      setData, runChecks, clearData,
      getDataForDataset, hasDatasetLoaded,
      addUploadLogEntry, deleteUploadLogEntry, clearUploadLogs,
      getDashboardStats, getInvoiceDetails,
    }}>
      {children}
    </ComplianceContext.Provider>
  );
}

export function useCompliance() {
  const context = useContext(ComplianceContext);
  if (context === undefined) throw new Error('useCompliance must be used within a ComplianceProvider');
  return context;
}
