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

interface ComplianceContextType {
  buyers: Buyer[];
  headers: InvoiceHeader[];
  lines: InvoiceLine[];
  checkResults: CheckResult[];
  exceptions: Exception[];
  pintAEExceptions: PintAEException[];
  runSummary: RunSummary | null;
  isDataLoaded: boolean;
  isChecksRun: boolean;
  isRunning: boolean;
  setData: (data: ParsedData) => void;
  runChecks: () => Promise<void>;
  clearData: () => void;
  getDashboardStats: () => DashboardStats;
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
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [headers, setHeaders] = useState<InvoiceHeader[]>([]);
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [checkResults, setCheckResults] = useState<CheckResult[]>([]);
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [pintAEExceptions, setPintAEExceptions] = useState<PintAEException[]>([]);
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isChecksRun, setIsChecksRun] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  // Seed UC1 check pack on mount (idempotent - only seeds if UC1 checks don't exist)
  useEffect(() => {
    const initChecks = async () => {
      console.log('[Compliance] Initializing PINT-AE checks...');
      const result = await seedUC1CheckPack(false);
      console.log('[Compliance] Seed result:', result.message);
    };
    initChecks();
  }, []);

  const setData = (data: ParsedData) => {
    setBuyers(data.buyers);
    setHeaders(data.headers);
    setLines(data.lines);
    setIsDataLoaded(true);
    setIsChecksRun(false);
    setCheckResults([]);
    setExceptions([]);
    setPintAEExceptions([]);
    setRunSummary(null);
  };

  const runChecks = async () => {
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

    // Run built-in checks
    const builtInResults = runAllChecks(dataContext);
    
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
    
    const allExceptions = [...builtInResults.flatMap(r => r.exceptions), ...legacyExceptions];
    setCheckResults(builtInResults);
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
      results_summary: { checkCount: builtInResults.length + pintAEChecks.length },
    });

    if (runId) {
      // Save PINT-AE exceptions
      await saveExceptions(runId, pintExceptions);
      
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
    setBuyers([]); setHeaders([]); setLines([]);
    setCheckResults([]); setExceptions([]); setPintAEExceptions([]);
    setRunSummary(null);
    setIsDataLoaded(false); setIsChecksRun(false);
  };

  const getDashboardStats = (): DashboardStats => calculateStats(exceptions, headers.length);

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
      buyers, headers, lines, checkResults, exceptions, pintAEExceptions, runSummary,
      isDataLoaded, isChecksRun, isRunning,
      setData, runChecks, clearData, getDashboardStats, getInvoiceDetails,
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
