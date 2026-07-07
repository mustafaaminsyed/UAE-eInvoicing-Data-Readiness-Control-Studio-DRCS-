import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, FileSpreadsheet, AlertCircle, CheckCircle2, Link2, ArrowRightCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useCompliance } from '@/context/ComplianceContext';
import { parseBuyersFile, parseHeadersFile, parseLinesFile, parseCSV } from '@/lib/csvParser';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { FileDropZone, FileSummaryCard, analyzeFile, FileStats } from '@/components/upload/FileAnalysis';
import { SampleScenario } from '@/lib/sampleData';
import { addUploadAuditLog } from '@/lib/uploadAudit';
import { DatasetType } from '@/types/datasets';
import { formatElapsedTime, yieldToBrowser } from '@/lib/processingFeedback';

type StepKey = 'upload' | 'validation' | 'mapping';

const STEPS: { key: StepKey; label: string }[] = [
  { key: 'upload', label: 'Upload' },
  { key: 'validation', label: 'Structural Validation' },
  { key: 'mapping', label: 'Mapping' },
];

interface RelationalCheck {
  label: string;
  matchPct: number;
  unmatchedCount: number;
  total: number;
}

export default function UploadPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { setData, clearData } = useCompliance();

  const [files, setFiles] = useState<{ buyers: File | null; headers: File | null; lines: File | null }>({
    buyers: null, headers: null, lines: null,
  });
  const [stats, setStats] = useState<{ buyers: FileStats | null; headers: FileStats | null; lines: FileStats | null }>({
    buyers: null, headers: null, lines: null,
  });
  const [relationalChecks, setRelationalChecks] = useState<RelationalCheck[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [parsedRows, setParsedRows] = useState<{
    buyers: Record<string, string>[] | null;
    headers: Record<string, string>[] | null;
    lines: Record<string, string>[] | null;
  }>({ buyers: null, headers: null, lines: null });
  const [loadStartedAt, setLoadStartedAt] = useState<number | null>(null);
  const [loadElapsedSeconds, setLoadElapsedSeconds] = useState(0);
  const [sampleScenario, setSampleScenario] = useState<SampleScenario>('positive');
  const [datasetType, setDatasetType] = useState<DatasetType>('AR');

  const allFilesSelected = files.buyers && files.headers && files.lines;
  const allStats = stats.buyers && stats.headers && stats.lines;
  const selectedFileCount = [files.buyers, files.headers, files.lines].filter(Boolean).length;
  const validFileCount = [stats.buyers, stats.headers, stats.lines].filter(
    (s) => s && s.requiredMissing.length === 0
  ).length;
  const totalSelectedRows =
    (stats.buyers?.rowCount ?? 0) +
    (stats.headers?.rowCount ?? 0) +
    (stats.lines?.rowCount ?? 0);
  const loadElapsedLabel = formatElapsedTime(loadElapsedSeconds);

  // Compute blocking reasons
  const blockingReasons: string[] = [];
  if (!files.buyers) blockingReasons.push('Buyers file not uploaded');
  if (!files.headers) blockingReasons.push('Invoice Headers file not uploaded');
  if (!files.lines) blockingReasons.push('Invoice Lines file not uploaded');
  if (stats.buyers?.requiredMissing.length) blockingReasons.push(`Buyers: missing columns (${stats.buyers.requiredMissing.join(', ')})`);
  if (stats.headers?.requiredMissing.length) blockingReasons.push(`Headers: missing columns (${stats.headers.requiredMissing.join(', ')})`);
  if (stats.lines?.requiredMissing.length) blockingReasons.push(`Lines: missing columns (${stats.lines.requiredMissing.join(', ')})`);

  const hasStructuralErrors = [stats.buyers, stats.headers, stats.lines].some(
    (s) => s && s.requiredMissing.length > 0
  );
  const canProceed = allFilesSelected && !hasStructuralErrors;
  const hasCreditNoteHeaders = (parsedRows.headers ?? []).some((row) => {
    const invoiceType = (row.invoice_type_code || row.invoice_type || '').trim().toUpperCase();
    return invoiceType.startsWith('381') || invoiceType.includes('CREDIT');
  });

  // Determine current step
  let currentStep: StepKey = 'upload';
  if (allFilesSelected && allStats) {
    currentStep = canProceed ? 'mapping' : 'validation';
  }

  // Analyze file on upload
  const handleFileSelect = useCallback(async (type: 'buyers' | 'headers' | 'lines', file: File | null) => {
    setFiles((prev) => ({ ...prev, [type]: file }));
    if (!file) {
      setStats((prev) => ({ ...prev, [type]: null }));
      setParsedRows((prev) => ({ ...prev, [type]: null }));
      return;
    }
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      const analysis = analyzeFile(rows, file, type, datasetType, text);
      setStats((prev) => ({ ...prev, [type]: analysis }));
      setParsedRows((prev) => ({ ...prev, [type]: rows }));
    } catch {
      toast({ title: 'Error reading file', description: 'Could not parse the CSV file.', variant: 'destructive' });
    }
  }, [datasetType, toast]);

  // Relational integrity checks
  useEffect(() => {
    const checks: RelationalCheck[] = [];
    if (parsedRows.headers && parsedRows.buyers) {
      const buyerIds = new Set(parsedRows.buyers.map((r) => r.buyer_id));
      const headerBuyerIds = parsedRows.headers.map((r) => r.buyer_id).filter(Boolean);
      const matched = headerBuyerIds.filter((id) => buyerIds.has(id));
      const unmatched = headerBuyerIds.length - matched.length;
      checks.push({
        label: 'headers.buyer_id -> buyers.buyer_id',
        matchPct: headerBuyerIds.length > 0 ? (matched.length / headerBuyerIds.length) * 100 : 100,
        unmatchedCount: unmatched,
        total: headerBuyerIds.length,
      });
    }
    if (parsedRows.lines && parsedRows.headers) {
      const invoiceIds = new Set(parsedRows.headers.map((r) => r.invoice_id));
      const lineInvoiceIds = parsedRows.lines.map((r) => r.invoice_id).filter(Boolean);
      const matched = lineInvoiceIds.filter((id) => invoiceIds.has(id));
      const unmatched = lineInvoiceIds.length - matched.length;
      checks.push({
        label: 'lines.invoice_id -> headers.invoice_id',
        matchPct: lineInvoiceIds.length > 0 ? (matched.length / lineInvoiceIds.length) * 100 : 100,
        unmatchedCount: unmatched,
        total: lineInvoiceIds.length,
      });
    }
    setRelationalChecks(checks);
  }, [parsedRows]);

  useEffect(() => {
    if (!isLoading || loadStartedAt === null) {
      setLoadElapsedSeconds(0);
      return;
    }

    const updateElapsed = () => {
      setLoadElapsedSeconds(Math.floor((Date.now() - loadStartedAt) / 1000));
    };

    updateElapsed();
    const intervalId = window.setInterval(updateElapsed, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isLoading, loadStartedAt]);

  const handleLoadData = async () => {
    if (!canProceed) return;
    setIsLoading(true);
    setLoadStartedAt(Date.now());
    setLoadElapsedSeconds(0);

    await yieldToBrowser();

    try {
      const [buyers, headers, lines] = await Promise.all([
        parseBuyersFile(files.buyers!, { direction: datasetType }),
        parseHeadersFile(files.headers!, { direction: datasetType }),
        parseLinesFile(files.lines!, { direction: datasetType }),
      ]);
      setData({ buyers, headers, lines }, datasetType);

      if (stats.buyers && stats.headers && stats.lines) {
        addUploadAuditLog({
          datasetType,
          buyersCount: buyers.length,
          headersCount: headers.length,
          linesCount: lines.length,
          datasets: [
            {
              dataset: 'buyers',
              fileName: stats.buyers.fileName,
              fileSize: stats.buyers.fileSize,
              rowCount: stats.buyers.rowCount,
              columnCount: stats.buyers.columnCount,
              requiredMissing: stats.buyers.requiredMissing,
              nullWarnings: stats.buyers.nullWarnings,
            },
            {
              dataset: 'headers',
              fileName: stats.headers.fileName,
              fileSize: stats.headers.fileSize,
              rowCount: stats.headers.rowCount,
              columnCount: stats.headers.columnCount,
              requiredMissing: stats.headers.requiredMissing,
              nullWarnings: stats.headers.nullWarnings,
            },
            {
              dataset: 'lines',
              fileName: stats.lines.fileName,
              fileSize: stats.lines.fileSize,
              rowCount: stats.lines.rowCount,
              columnCount: stats.lines.columnCount,
              requiredMissing: stats.lines.requiredMissing,
              nullWarnings: stats.lines.nullWarnings,
            },
          ],
          relationalChecks: relationalChecks.map((check) => ({
            label: check.label,
            matchPct: check.matchPct,
            unmatchedCount: check.unmatchedCount,
            total: check.total,
          })),
        });
      }

      toast({
        title: 'Data loaded successfully',
        description: `${datasetType === 'AR' ? 'AR' : 'AP'}: ${buyers.length} buyers, ${headers.length} invoices, ${lines.length} line items`,
      });
      navigate('/run');
    } catch {
      toast({ title: 'Error loading data', description: 'Please check your CSV files and try again.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
      setLoadStartedAt(null);
      setLoadElapsedSeconds(0);
    }
  };

  const handleClearAll = () => {
    setFiles({ buyers: null, headers: null, lines: null });
    setStats({ buyers: null, headers: null, lines: null });
    setParsedRows({ buyers: null, headers: null, lines: null });
    clearData();
  };

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="container max-w-4xl py-8 md:py-10">
        {/* Step Indicator */}
        <div className="mb-8 flex flex-wrap items-center justify-center gap-2">
          {STEPS.map((step, i) => (
            <div key={step.key} className="flex items-center gap-2">
              <div className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-center text-xs font-medium transition-colors',
                step.key === currentStep
                  ? 'bg-primary text-primary-foreground'
                  : (STEPS.findIndex(s => s.key === currentStep) > i
                    ? 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]'
                    : 'bg-muted text-muted-foreground')
              )}>
                {STEPS.findIndex(s => s.key === currentStep) > i && <CheckCircle2 className="w-3 h-3" />}
                {step.label}
              </div>
              {i < STEPS.length - 1 && <ArrowRightCircle className="w-4 h-4 text-muted-foreground/40" />}
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary/10 rounded-2xl mb-3">
            <FileSpreadsheet className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Upload Your Invoice Data</h1>
          <p className="text-muted-foreground text-sm max-w-xl mx-auto">
            Upload your invoice datasets to begin readiness and structural validation.
          </p>
        </div>

        <div className="space-y-6 animate-slide-up">
          <div className="surface-glass rounded-2xl border border-white/70 shadow-sm p-4">
            <div className="mb-4">
              <p className="text-sm font-semibold text-foreground">Dataset Type</p>
              <p className="text-xs text-muted-foreground mb-2">
                Select whether these uploads are outbound AR invoices or inbound AP invoices.
              </p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Dataset type">
                <Button
                  size="sm"
                  variant={datasetType === 'AR' ? 'default' : 'outline'}
                  onClick={() => setDatasetType('AR')}
                  role="radio"
                  aria-checked={datasetType === 'AR'}
                >
                  Customer Invoices (AR / Outbound)
                </Button>
                <Button
                  size="sm"
                  variant={datasetType === 'AP' ? 'default' : 'outline'}
                  onClick={() => setDatasetType('AP')}
                  role="radio"
                  aria-checked={datasetType === 'AP'}
                >
                  Vendor Invoices (AP / Inbound)
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Sample Testing Mode</p>
                <p className="text-xs text-muted-foreground">
                  Choose positive samples for baseline pass testing, or negative samples to simulate exceptions.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                <Button
                  size="sm"
                  variant={sampleScenario === 'positive' ? 'default' : 'outline'}
                  onClick={() => setSampleScenario('positive')}
                  className="w-full sm:w-auto"
                >
                  Positive Samples
                </Button>
                <Button
                  size="sm"
                  variant={sampleScenario === 'negative' ? 'default' : 'outline'}
                  onClick={() => setSampleScenario('negative')}
                  className="w-full sm:w-auto"
                >
                  Negative Test Samples
                </Button>
              </div>
            </div>
          </div>

          <div className="surface-glass rounded-2xl border border-white/70 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <p className="text-sm font-semibold text-foreground">Supported Document Scenarios</p>
              <Badge variant="outline" className="text-[10px] uppercase tracking-wide">UC1</Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border bg-background/70 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="secondary">380</Badge>
                  <span className="text-sm font-medium text-foreground">Standard Invoice</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Baseline supported in current readiness, structural, and validation checks.
                </p>
              </div>
              <div className="rounded-xl border bg-background/70 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="secondary">381</Badge>
                  <span className="text-sm font-medium text-foreground">Credit Note</span>
                </div>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p>Supported with additional header fields:</p>
                  <div className="flex flex-wrap gap-2">
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] break-all">credit_note_reason_code</code>
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] break-all">credit_note_reason_text</code>
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] break-all">preceding_invoice_reference</code>
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] break-all">preceding_invoice_issue_date</code>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* File Cards */}
          <div className="surface-glass rounded-2xl border border-white/70 shadow-sm p-6">
            <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <span>
                Upload progress: <span className="font-semibold text-foreground">{validFileCount}/3</span> files structurally valid
              </span>
              <span className="hidden text-muted-foreground/60 sm:inline">|</span>
              <span>
                <span className="font-medium">{selectedFileCount}/3</span> files selected
              </span>
            </div>
            <div className="grid gap-6">
              {/* Buyers */}
              {stats.buyers ? (
                <FileSummaryCard stats={stats.buyers} type="buyers" direction={datasetType} onRemove={() => handleFileSelect('buyers', null)} />
              ) : (
                <FileDropZone label="Buyers File" description="buyer_id, buyer_name, buyer_trn, buyer_address, buyer_country" sampleType="buyers" sampleScenario={sampleScenario} direction={datasetType} onFileSelect={(f) => handleFileSelect('buyers', f)} />
              )}

              <div className="border-t" />

              {/* Headers */}
              {stats.headers ? (
                <FileSummaryCard stats={stats.headers} type="headers" direction={datasetType} onRemove={() => handleFileSelect('headers', null)} />
              ) : (
                <FileDropZone label="Invoice Headers File" description="invoice_id, invoice_number, issue_date, invoice_type, seller_trn, buyer_id, currency, ... Credit notes (381) require additional credit note fields." sampleType="headers" sampleScenario={sampleScenario} direction={datasetType} onFileSelect={(f) => handleFileSelect('headers', f)} />
              )}

              <div className="rounded-xl border bg-muted/20 px-4 py-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <p className="text-xs font-semibold text-foreground">Credit Note Requirements</p>
                  {hasCreditNoteHeaders && (
                    <Badge variant="outline" className="text-[10px]">Credit note rows detected</Badge>
                  )}
                </div>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p>
                    Scenario-specific validation is driven by <code className="font-mono">invoice_type</code>.
                  </p>
                  <p>
                    When <code className="font-mono">invoice_type = 381</code>, provide:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <code className="rounded bg-background px-1.5 py-0.5 font-mono text-[11px] break-all">credit_note_reason_code</code>
                    <code className="rounded bg-background px-1.5 py-0.5 font-mono text-[11px] break-all">credit_note_reason_text</code>
                  </div>
                  <p>
                    Unless the reason code is <code className="font-mono">VD</code>, also provide the <code className="font-mono">IBG-03</code> preceding invoice group using:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <code className="rounded bg-background px-1.5 py-0.5 font-mono text-[11px] break-all">preceding_invoice_reference</code>
                    <code className="rounded bg-background px-1.5 py-0.5 font-mono text-[11px] break-all">preceding_invoice_issue_date</code>
                  </div>
                  <p>
                    <code className="font-mono">preceding_invoice_issue_date</code> represents the original invoice issue date and should be in <code className="font-mono">YYYY-MM-DD</code> format when supplied.
                  </p>
                </div>
              </div>

              <div className="border-t" />

              {/* Lines */}
              {stats.lines ? (
                <FileSummaryCard stats={stats.lines} type="lines" direction={datasetType} onRemove={() => handleFileSelect('lines', null)} />
              ) : (
                <FileDropZone label="Invoice Lines File" description="line_id, invoice_id, line_number, quantity, unit_price, vat_rate, ..." sampleType="lines" sampleScenario={sampleScenario} direction={datasetType} onFileSelect={(f) => handleFileSelect('lines', f)} />
              )}
            </div>
          </div>

          {/* Relational Integrity */}
          {relationalChecks.length > 0 && (
            <div className="surface-glass rounded-2xl border border-white/70 shadow-sm p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Relational Integrity</h3>
              </div>
              <div className="space-y-2">
                {relationalChecks.map((check) => (
                  <div key={check.label} className="flex flex-col gap-2 text-sm md:flex-row md:items-center md:justify-between">
                    <code className="break-all text-xs font-mono text-muted-foreground">{check.label}</code>
                    <div className="flex flex-wrap items-center gap-2 md:justify-end">
                      <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            check.matchPct === 100 ? 'bg-[hsl(var(--success))]' : check.matchPct > 80 ? 'bg-accent' : 'bg-destructive'
                          )}
                          style={{ width: `${check.matchPct}%` }}
                        />
                      </div>
                      <span className={cn(
                        'text-xs font-medium',
                        check.matchPct === 100 ? 'text-[hsl(var(--success))]' : 'text-accent-foreground'
                      )}>
                        {check.matchPct.toFixed(0)}%
                      </span>
                      {check.unmatchedCount > 0 && (
                        <Badge variant="outline" className="text-xs text-accent-foreground border-accent/30">
                          {check.unmatchedCount} unmatched
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dynamic Status */}
          {blockingReasons.length > 0 && (
            <div className="flex items-start gap-2 text-sm bg-muted/50 rounded-lg p-4 border">
              <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="space-y-1">
                {blockingReasons.map((reason, i) => (
                  <p key={i} className="text-muted-foreground">{reason}</p>
                ))}
              </div>
            </div>
          )}

          {canProceed && blockingReasons.length === 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-[hsl(var(--success))]/20 bg-[hsl(var(--success))]/5 p-4 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--success))]" />
              <span className="font-medium text-[hsl(var(--success))]">
                All files uploaded and validated for {datasetType === 'AR' ? 'AR (Outbound)' : 'AP (Inbound)'}.
                Ready to proceed.
              </span>
            </div>
          )}

          {isLoading && (
            <div
              role="status"
              aria-live="polite"
              className="rounded-xl border border-primary/20 bg-primary/5 p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-2">
                  <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">Processing uploaded datasets</p>
                    <p className="text-xs text-muted-foreground">
                      Preparing canonical records and relational integrity checks before validation execution.
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">
                  {loadElapsedLabel} elapsed
                </Badge>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Current payload: <span className="font-medium text-foreground">{totalSelectedRows.toLocaleString()}</span> rows
                across buyers, invoice headers, and invoice lines.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="outline" onClick={handleClearAll} disabled={!files.buyers && !files.headers && !files.lines}>
              Clear All
            </Button>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
	                    <Button
	                      onClick={handleLoadData}
	                      disabled={!canProceed || isLoading}
	                      size="lg"
	                      className="w-full gap-2 sm:w-auto"
	                    >
                      {isLoading ? `Processing data... ${loadElapsedLabel}` : 'Load Data & Continue'}
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </span>
                </TooltipTrigger>
                {!canProceed && (
                  <TooltipContent side="top" className="max-w-xs text-xs">
                    {blockingReasons.length > 0
                      ? blockingReasons.join('. ')
                      : 'Upload all files to continue'}
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>
    </div>
  );
}


