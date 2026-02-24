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
  Severity
} from '@/types/compliance';
import { PintAECheck, PintAEException, RunSummary } from '@/types/pintAE';
import { runAllChecks } from '@/lib/checks/checksRegistry';
import { saveCheckRun, saveEntityScores } from '@/lib/api/checksApi';
import { calculateScore } from '@/types/customChecks';
import { DEFAULT_DIRECTION, Direction, OrganizationProfile } from '@/types/direction';
import { 
  fetchEnabledPintAEChecks, 
  seedUC1CheckPack, 
  saveExceptions, 
  saveRunSummary,
  saveClientRiskScores,
  calculateClientScores,
  generateRunSummary
} from '@/lib/api/pintAEApi';
import { runAllPintAEChecks } from '@/lib/checks/pintAECheckRunner';
import { NewUploadLogEntry, UploadLogEntry } from '@/types/uploadLog';
import { buildOrganizationProfileExceptions, getRulesetForDirection, RULESET_VERSION } from '@/lib/validation/rulesetRouter';
import { resolveDirection } from '@/lib/direction/directionUtils';
import { DatasetType } from '@/types/datasets';
import { InvestigationFlag } from '@/types/customChecks';

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
const UPLOAD_LOGS_STORAGE_KEY = 'drcs_upload_logs_v1';
const DIRECTION_STORAGE_KEY = 'drcs_direction_v1';
const ORG_PROFILE_STORAGE_KEY = 'drcs_org_profile_v1';
const ACTIVE_MAPPING_STORAGE_KEY = 'drcs_active_mapping_profiles_v1';

export function ComplianceProvider({ children }: { children: ReactNode }) {
  const [direction, setDirectionState] = useState<Direction>(() => {
    try {
      const stored = localStorage.getItem(DIRECTION_STORAGE_KEY);
      return resolveDirection(stored);
    } catch {
      return DEFAULT_DIRECTION;
    }
  });
  const [organizationProfile, setOrganizationProfile] = useState<OrganizationProfile>(() => {
    const envTRNs = (import.meta.env.VITE_OUR_ENTITY_TRNS as string | undefined)?.split(',').map((v) => v.trim()).filter(Boolean) || [];
    try {
      const stored = localStorage.getItem(ORG_PROFILE_STORAGE_KEY);
      if (!stored) return { ourEntityTRNs: envTRNs };
      const parsed = JSON.parse(stored) as OrganizationProfile;
      return { ourEntityTRNs: parsed.ourEntityTRNs || envTRNs, entityIds: parsed.entityIds || [] };
    } catch {
      return { ourEntityTRNs: envTRNs };
    }
  });
  const [uploadSessionId, setUploadSessionId] = useState<string | null>(null);
  const [uploadManifestId, setUploadManifestId] = useState<string | null>(null);
  const [activeMappingProfileByDirection, setActiveMappingProfileByDirection] = useState<Record<Direction, { id: string; version: number } | null>>(() => {
    try {
      const stored = localStorage.getItem(ACTIVE_MAPPING_STORAGE_KEY);
      if (!stored) return { AR: null, AP: null };
      const parsed = JSON.parse(stored) as Record<Direction, { id: string; version: number } | null>;
      return { AR: parsed.AR || null, AP: parsed.AP || null };
    } catch {
      return { AR: null, AP: null };
    }
  });
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [headers, setHeaders] = useState<InvoiceHeader[]>([]);
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [checkResults, setCheckResults] = useState<CheckResult[]>([]);
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [investigationFlags] = useState<InvestigationFlag[]>([]);
  const [pintAEExceptions, setPintAEExceptions] = useState<PintAEException[]>([]);
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isChecksRun, setIsChecksRun] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [uploadLogs, setUploadLogs] = useState<UploadLogEntry[]>([]);
  const [dataByDirection, setDataByDirection] = useState<Record<Direction, ParsedData>>({
    AR: { buyers: [], headers: [], lines: [], direction: 'AR' },
    AP: { buyers: [], headers: [], lines: [], direction: 'AP' },
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(UPLOAD_LOGS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as UploadLogEntry[];
      if (Array.isArray(parsed)) {
        setUploadLogs(parsed);
      }
    } catch (error) {
      console.warn('[Compliance] Failed to load upload logs:', error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(UPLOAD_LOGS_STORAGE_KEY, JSON.stringify(uploadLogs));
    } catch (error) {
      console.warn('[Compliance] Failed to persist upload logs:', error);
    }
  }, [uploadLogs]);

  useEffect(() => {
    localStorage.setItem(DIRECTION_STORAGE_KEY, direction);
  }, [direction]);

  useEffect(() => {
    localStorage.setItem(ORG_PROFILE_STORAGE_KEY, JSON.stringify(organizationProfile));
  }, [organizationProfile]);

  useEffect(() => {
    localStorage.setItem(ACTIVE_MAPPING_STORAGE_KEY, JSON.stringify(activeMappingProfileByDirection));
  }, [activeMappingProfileByDirection]);

  // Seed UC1 check pack on mount (idempotent - only seeds if UC1 checks don't exist)
  useEffect(() => {
    const initChecks = async () => {
      console.log('[Compliance] Initializing PINT-AE checks...');
      const result = await seedUC1CheckPack(false);
      console.log('[Compliance] Seed result:', result.message);
    };
    initChecks();
  }, []);

  const getDataForDataset = (datasetType: DatasetType): ParsedData => {
    return dataByDirection[datasetType] || { buyers: [], headers: [], lines: [], direction: datasetType };
  };

  const hasDatasetLoaded = (datasetType: DatasetType): boolean => {
    const dataset = getDataForDataset(datasetType);
    return dataset.headers.length > 0 || dataset.lines.length > 0 || dataset.buyers.length > 0;
  };

  const applyDatasetToVisibleState = (datasetType: DatasetType) => {
    const target = getDataForDataset(datasetType);
    setDirectionState(datasetType);
    setBuyers(target.buyers);
    setHeaders(target.headers);
    setLines(target.lines);
    setIsDataLoaded(hasDatasetLoaded(datasetType));
  };

  const setActiveDatasetType = (datasetType: DatasetType) => {
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
    setDirectionState(resolvedDirection);
    setBuyers(normalizedData.buyers);
    setHeaders(normalizedData.headers);
    setLines(normalizedData.lines);
    setIsDataLoaded(true);
    setIsChecksRun(false);
    setCheckResults([]);
    setExceptions([]);
    setPintAEExceptions([]);
    setRunSummary(null);
  };

  const runChecks = async (options?: { mappingProfileId?: string; mappingVersion?: number }) => {
    setIsRunning(true);
    
    const buyerMap = new Map(buyers.map(b => [b.buyer_id, b]));
    const headerMap = new Map(headers.map(h => [h.invoice_id, h]));
    const linesByInvoice = new Map<string, InvoiceLine[]>();
    
    lines.forEach(line => {
      if (!linesByInvoice.has(line.invoice_id)) {
        linesByInvoice.set(line.invoice_id, []);
      }
      linesByInvoice.get(line.invoice_id)!.push(line);
    });

    const dataContext: DataContext = { buyers, headers, lines, buyerMap, headerMap, linesByInvoice };

    const activeRuleset = getRulesetForDirection(direction);

    // Run built-in checks
    const builtInResults = runAllChecks(dataContext);
    
    // Ensure the latest UC1 pack is present before running checks.
    await seedUC1CheckPack(true);

    // Fetch and run PINT-AE checks
    const pintAEChecks = await fetchEnabledPintAEChecks();
    const pintExceptions = runAllPintAEChecks(pintAEChecks, dataContext);
    
    // Convert PINT-AE exceptions to legacy format for backward compatibility
    const legacyExceptions: Exception[] = pintExceptions.map(e => ({
      id: e.id,
      checkId: e.check_id,
      checkName: e.check_name,
      severity: e.severity,
      message: e.message,
      invoiceId: e.invoice_id,
      invoiceNumber: e.invoice_number,
      sellerTrn: e.seller_trn,
      buyerId: e.buyer_id,
      lineId: e.line_id,
      field: e.field_name,
      expectedValue: e.expected_value_or_rule,
      actualValue: e.observed_value,
    }));
    
    const orgProfileExceptions = buildOrganizationProfileExceptions(organizationProfile, {
      direction,
      headers,
      buyerMap,
      uploadSessionId: uploadSessionId || undefined,
      uploadManifestId: uploadManifestId || undefined,
      mappingProfileId: options?.mappingProfileId || activeMappingProfileByDirection[direction]?.id,
      rulesetVersion: RULESET_VERSION,
    });

    const allExceptions = [...builtInResults.flatMap(r => r.exceptions), ...legacyExceptions, ...orgProfileExceptions].map((exception) => ({
      ...exception,
      datasetType: direction,
      direction: resolveDirection(exception.direction || direction),
      ruleId: exception.ruleId || exception.checkId,
      uploadSessionId: exception.uploadSessionId || uploadSessionId || undefined,
      uploadManifestId: exception.uploadManifestId || uploadManifestId || undefined,
      mappingProfileId: exception.mappingProfileId || options?.mappingProfileId || activeMappingProfileByDirection[direction]?.id || undefined,
      rulesetVersion: exception.rulesetVersion || RULESET_VERSION,
      status: exception.status || 'Open',
    }));
    setCheckResults(builtInResults.map((result) => ({ ...result, direction, datasetType: direction })));
    setExceptions(allExceptions);
    setPintAEExceptions(pintExceptions);
    setIsChecksRun(true);

    // Calculate and save scores
    const stats = calculateStats(allExceptions, headers.length);
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
        mappingProfileId: options?.mappingProfileId || activeMappingProfileByDirection[direction]?.id || null,
        mappingVersion: options?.mappingVersion || activeMappingProfileByDirection[direction]?.version || null,
      },
    });

    if (runId) {
      // Save PINT-AE exceptions
      await saveExceptions(runId, pintExceptions);
      setExceptions((prev) => prev.map((exception) => ({ ...exception, validationRunId: runId })));
      
      // Calculate and save client risk scores
      const clientScores = calculateClientScores(pintExceptions, headers);
      await saveClientRiskScores(runId, clientScores);
      
      // Generate and save run summary
      const summary = generateRunSummary(runId, headers.length, pintExceptions, clientScores);
      await saveRunSummary(summary);
      setRunSummary(summary);
      
      // Calculate entity scores
      const sellerScores = calculateEntityScores(allExceptions, headers, 'seller');
      const invoiceScores = calculateEntityScores(allExceptions, headers, 'invoice');
      await saveEntityScores([
        ...sellerScores.map(s => ({ ...s, run_id: runId })),
        ...invoiceScores.map(s => ({ ...s, run_id: runId })),
      ]);
    }

    setIsRunning(false);
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
    setIsDataLoaded(false); setIsChecksRun(false);
    setUploadSessionId(null);
    setUploadManifestId(null);
  };

  const setActiveMappingProfileForDirection = (targetDirection: Direction, profile: { id: string; version: number } | null) => {
    setActiveMappingProfileByDirection((prev) => ({ ...prev, [targetDirection]: profile }));
  };

  const addUploadLogEntry = (entry: NewUploadLogEntry) => {
    const newEntry: UploadLogEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      uploadedAt: new Date().toISOString(),
    };
    setUploadLogs((prev) => [newEntry, ...prev]);
  };

  const deleteUploadLogEntry = (id: string) => {
    setUploadLogs((prev) => prev.filter((entry) => entry.id !== id));
  };

  const clearUploadLogs = () => {
    setUploadLogs([]);
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
      activeDatasetType: direction,
      setDirection,
      setActiveDatasetType,
      organizationProfile,
      setOrganizationProfile,
      uploadSessionId,
      uploadManifestId,
      activeMappingProfileByDirection,
      setActiveMappingProfileForDirection,
      buyers, headers, lines, checkResults, exceptions, investigationFlags, pintAEExceptions, runSummary,
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
