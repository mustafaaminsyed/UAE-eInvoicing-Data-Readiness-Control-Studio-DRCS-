import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, FileSpreadsheet, AlertCircle, CheckCircle2, Link2, RefreshCw, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useCompliance } from '@/context/ComplianceContext';
import { attachDocumentAdjustments, parseBuyersFile, parseDocumentAdjustmentsFile, parseHeadersFile, parseLinesFile, parseCSV } from '@/lib/csvParser';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { WorkflowPageHeader } from '@/components/shared/WorkflowPageHeader';
import { FileDropZone, FileSummaryCard, analyzeFile, FileStats } from '@/components/upload/FileAnalysis';
import { documentAdjustmentsSample, downloadSampleCSV, SampleScenario } from '@/lib/sampleData';
import { addUploadAuditLog } from '@/lib/uploadAudit';
import { DatasetType } from '@/types/datasets';
import { formatElapsedTime, yieldToBrowser } from '@/lib/processingFeedback';
import { WORKFLOW_MICRO_BADGE_CLASS } from '@/lib/workflowShellStyles';
import '@/components/upload/upload-ingestion.css';

type StepKey = 'upload' | 'validation' | 'run';

const STEPS: { key: StepKey; label: string }[] = [
  { key: 'upload', label: 'Upload' },
  { key: 'validation', label: 'Structural Validation' },
  { key: 'run', label: 'Run Checks' },
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
  const [adjustmentsFile, setAdjustmentsFile] = useState<File | null>(null);
  const [adjustmentsStats, setAdjustmentsStats] = useState<FileStats | null>(null);
  const [stats, setStats] = useState<{ buyers: FileStats | null; headers: FileStats | null; lines: FileStats | null }>({
    buyers: null, headers: null, lines: null,
  });
  const [relationalChecks, setRelationalChecks] = useState<RelationalCheck[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [parsedRows, setParsedRows] = useState<{
    buyers: Record<string, string>[] | null;
    headers: Record<string, string>[] | null;
    lines: Record<string, string>[] | null;
    adjustments: Record<string, string>[] | null;
  }>({ buyers: null, headers: null, lines: null, adjustments: null });
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
    (stats.lines?.rowCount ?? 0) +
    (adjustmentsStats?.rowCount ?? 0);
  const loadElapsedLabel = formatElapsedTime(loadElapsedSeconds);

  // Compute blocking reasons
  const blockingReasons: string[] = [];
  if (!files.buyers) blockingReasons.push('Buyers file not uploaded');
  if (!files.headers) blockingReasons.push('Invoice Headers file not uploaded');
  if (!files.lines) blockingReasons.push('Invoice Lines file not uploaded');
  if (stats.buyers?.requiredMissing.length) blockingReasons.push(`Buyers: missing columns (${stats.buyers.requiredMissing.join(', ')})`);
  if (stats.headers?.requiredMissing.length) blockingReasons.push(`Headers: missing columns (${stats.headers.requiredMissing.join(', ')})`);
  if (stats.lines?.requiredMissing.length) blockingReasons.push(`Lines: missing columns (${stats.lines.requiredMissing.join(', ')})`);
  if (adjustmentsStats?.requiredMissing.length) blockingReasons.push(`Adjustments: missing columns (${adjustmentsStats.requiredMissing.join(', ')})`);

  const hasStructuralErrors = [stats.buyers, stats.headers, stats.lines, adjustmentsStats].some(
    (s) => s && s.requiredMissing.length > 0
  );
  const canProceed = allFilesSelected && !hasStructuralErrors && (!adjustmentsFile || adjustmentsStats !== null);
  const hasCreditNoteHeaders = (parsedRows.headers ?? []).some((row) => {
    const invoiceType = (row.invoice_type_code || row.invoice_type || '').trim().toUpperCase();
    return invoiceType.startsWith('381') || invoiceType.includes('CREDIT');
  });

  // Determine current step
  let currentStep: StepKey = 'upload';
  if (allFilesSelected && allStats) {
    currentStep = canProceed ? 'run' : 'validation';
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

  const handleAdjustmentsFileSelect = useCallback(async (file: File | null) => {
    setAdjustmentsFile(file);
    if (!file) {
      setAdjustmentsStats(null);
      setParsedRows((prev) => ({ ...prev, adjustments: null }));
      return;
    }
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      setAdjustmentsStats(analyzeFile(rows, file, 'adjustments', datasetType, text));
      setParsedRows((prev) => ({ ...prev, adjustments: rows }));
    } catch {
      toast({ title: 'Error reading file', description: 'Could not parse the document adjustments CSV file.', variant: 'destructive' });
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
    if (parsedRows.adjustments && parsedRows.headers) {
      const invoiceIds = new Set(parsedRows.headers.map((r) => r.invoice_id));
      const adjustmentInvoiceIds = parsedRows.adjustments.map((r) => r.invoice_id).filter(Boolean);
      const matched = adjustmentInvoiceIds.filter((id) => invoiceIds.has(id));
      checks.push({
        label: 'adjustments.invoice_id -> headers.invoice_id',
        matchPct: adjustmentInvoiceIds.length > 0 ? (matched.length / adjustmentInvoiceIds.length) * 100 : 100,
        unmatchedCount: adjustmentInvoiceIds.length - matched.length,
        total: adjustmentInvoiceIds.length,
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
      const [buyers, parsedHeaders, lines, adjustments] = await Promise.all([
        parseBuyersFile(files.buyers!, { direction: datasetType }),
        parseHeadersFile(files.headers!, { direction: datasetType }),
        parseLinesFile(files.lines!, { direction: datasetType }),
        adjustmentsFile ? parseDocumentAdjustmentsFile(adjustmentsFile) : Promise.resolve([]),
      ]);
      const headers = attachDocumentAdjustments(parsedHeaders, adjustments);
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
            ...(adjustmentsFile && adjustmentsStats ? [{
              dataset: 'adjustments' as const,
              ingestionStatus: 'accepted' as const,
              fileName: adjustmentsStats.fileName,
              fileSize: adjustmentsStats.fileSize,
              rowCount: adjustments.length,
              columnCount: adjustmentsStats.columnCount,
              requiredMissing: adjustmentsStats.requiredMissing,
              nullWarnings: adjustmentsStats.nullWarnings,
            }] : []),
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
    setParsedRows({ buyers: null, headers: null, lines: null, adjustments: null });
    setAdjustmentsFile(null);
    setAdjustmentsStats(null);
    clearData();
  };

  return (
    <div className="upload-ingestion min-h-[calc(100vh-4rem)]">
      <div className="upload-ingestion-content mx-auto w-full max-w-[1480px] px-3 py-3 md:px-5 md:py-4 xl:px-7">
        <div className="upload-ingestion-heading mb-3 flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/85 px-4 py-3 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <WorkflowPageHeader
            title="Upload invoice data"
            description="Add source files to begin your UAE e-Invoicing readiness assessment."
            icon={<FileSpreadsheet className="h-5 w-5" />}
            className="min-w-0"
            descriptionClassName="text-xs leading-5"
          />
          <ol className="upload-ingestion-steps flex shrink-0 items-center gap-2" aria-label="Ingestion progress">
            {STEPS.map((step, index) => {
              const active = step.key === currentStep;
              const complete = STEPS.findIndex((item) => item.key === currentStep) > index;
              return <li key={step.key} aria-current={active ? 'step' : undefined} className={cn('upload-ingestion-step', active && 'is-active', complete && 'is-complete')}>
                <span>{complete ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}</span>{step.label}
              </li>;
            })}
          </ol>
        </div>

        <div className="upload-ingestion-content-stack animate-slide-up">
          <section className="upload-ingestion-setup grid gap-3 lg:grid-cols-[1.15fr_0.85fr]" aria-label="Dataset setup">
            <div className="upload-ingestion-panel surface-glass rounded-2xl border border-white/70 p-3.5 shadow-sm md:p-4">
              <div className="mb-2">
                <p className="text-sm font-semibold text-foreground">Dataset direction</p>
                <p className="text-xs text-muted-foreground">Choose which side of the invoice flow these files represent.</p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Dataset type">
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
            <div className="upload-ingestion-panel surface-glass flex flex-col justify-center rounded-2xl border border-white/70 p-3.5 shadow-sm md:p-4">
              <div className="mb-2 min-w-0">
                <p className="text-sm font-semibold text-foreground">Test scenario</p>
                <p className="text-xs text-muted-foreground">Choose clean samples or files designed to surface exceptions.</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
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
            <details className="upload-ingestion-reference lg:col-span-2">
              <summary><span><Badge variant="outline" className={`${WORKFLOW_MICRO_BADGE_CLASS} uppercase tracking-wide`}>UC1</Badge> Supported document scenarios</span><ChevronDown className="h-4 w-4" /></summary>
              <div className="upload-ingestion-scenario-grid">
                <div><Badge variant="secondary" className={WORKFLOW_MICRO_BADGE_CLASS}>380</Badge><span><strong>Standard invoice</strong><small>Baseline readiness, structural and validation checks.</small></span></div>
                <div><Badge variant="secondary" className={WORKFLOW_MICRO_BADGE_CLASS}>381</Badge><span><strong>Credit note</strong><small>Requires reason code/text and, except reason VD, the preceding invoice reference/date.</small></span></div>
              </div>
            </details>
          </section>

          {/* File Cards */}
          <section className="upload-ingestion-panel surface-glass rounded-2xl border border-white/70 p-3.5 shadow-sm md:p-4" aria-label="Upload source files">
            <div className="upload-ingestion-files-heading mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Canonical DRCS CSV templates</h2>
                <p className="text-xs text-muted-foreground">Select one canonical CSV template for each required dataset.</p>
              </div>
              <div className="flex items-center gap-2 rounded-full border bg-background/75 px-3 py-1.5 text-xs text-muted-foreground" role="status">
                <span className={cn('h-2 w-2 rounded-full', validFileCount === 3 ? 'bg-[hsl(var(--success))]' : 'bg-amber-500')} />
                <span><strong className="text-foreground">{validFileCount}/3</strong> valid</span><span className="text-border">·</span><span>{selectedFileCount}/3 selected</span>
              </div>
            </div>
            <div className="mb-3 flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
              <span>Using non-canonical ERP/source extracts, aliased columns, or a combined export?</span>
              <Button variant="link" className="h-auto p-0 text-xs" onClick={() => navigate('/mapping?tab=create')}>
                Open Mapping Studio first
              </Button>
            </div>
            <div className="upload-ingestion-file-grid grid gap-3 xl:grid-cols-3">
              {/* Buyers */}
              {stats.buyers ? (
                <FileSummaryCard stats={stats.buyers} type="buyers" direction={datasetType} onRemove={() => handleFileSelect('buyers', null)} />
              ) : (
                <FileDropZone label="Buyers File" description="buyer_id, buyer_name, buyer_trn, buyer_address, buyer_country" sampleType="buyers" sampleScenario={sampleScenario} direction={datasetType} onFileSelect={(f) => handleFileSelect('buyers', f)} />
              )}

              {/* Headers */}
              {stats.headers ? (
                <FileSummaryCard stats={stats.headers} type="headers" direction={datasetType} onRemove={() => handleFileSelect('headers', null)} />
              ) : (
                <FileDropZone label="Invoice Headers File" description="invoice_id, invoice_number, issue_date, invoice_type, seller_trn, buyer_id, currency, ... Credit notes (381) require additional credit note fields." sampleType="headers" sampleScenario={sampleScenario} direction={datasetType} onFileSelect={(f) => handleFileSelect('headers', f)} />
              )}

              {/* Lines */}
              {stats.lines ? (
                <FileSummaryCard stats={stats.lines} type="lines" direction={datasetType} onRemove={() => handleFileSelect('lines', null)} />
              ) : (
                <FileDropZone label="Invoice Lines File" description="line_id, invoice_id, line_number, quantity, unit_price, vat_rate, ..." sampleType="lines" sampleScenario={sampleScenario} direction={datasetType} onFileSelect={(f) => handleFileSelect('lines', f)} />
              )}

              <details className="upload-ingestion-reference upload-ingestion-credit-note xl:col-span-3">
                <summary><span><strong>Credit note requirements</strong>{hasCreditNoteHeaders && <Badge variant="outline" className={WORKFLOW_MICRO_BADGE_CLASS}>381 detected</Badge>}</span><ChevronDown className="h-4 w-4" /></summary>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <p className="text-xs text-muted-foreground">Scenario-specific validation is driven by <code className="font-mono">invoice_type</code>.</p>
                </div>
                <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                  <p>
                    When <code className="font-mono">invoice_type = 381</code>, provide:
                    {' '}<code className="font-mono">credit_note_reason_code</code> and <code className="font-mono">credit_note_reason_text</code>.
                  </p>
                  <p>
                    Unless the reason code is <code className="font-mono">VD</code>, also provide the <code className="font-mono">IBG-03</code> preceding invoice group using:
                    {' '}<code className="font-mono">preceding_invoice_reference</code> and <code className="font-mono">preceding_invoice_issue_date</code>.
                  </p>
                  <p className="md:col-span-2">
                    <code className="font-mono">preceding_invoice_issue_date</code> represents the original invoice issue date and should be in <code className="font-mono">YYYY-MM-DD</code> format when supplied.
                  </p>
                </div>
              </details>

              <details className="upload-ingestion-reference upload-ingestion-adjustments xl:col-span-3">
                <summary><span><strong>Document adjustments</strong><Badge variant="outline" className={WORKFLOW_MICRO_BADGE_CLASS}>Optional</Badge>{adjustmentsFile ? <span className="text-xs text-[hsl(var(--success))]">{adjustmentsFile.name}</span> : null}</span><ChevronDown className="h-4 w-4" /></summary>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">One row per document-level allowance or charge. Required only when header adjustment totals are non-zero.</p>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={() => downloadSampleCSV('document_adjustments_template.csv', documentAdjustmentsSample)}>
                    Download template
                  </Button>
                </div>
                <Label htmlFor="document-adjustments-upload" className="mt-3 block text-xs font-medium">Document Adjustments CSV upload</Label>
                <input id="document-adjustments-upload" type="file" accept=".csv,text/csv" className="mt-2 block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-medium file:text-primary-foreground" onChange={(event) => handleAdjustmentsFileSelect(event.target.files?.[0] ?? null)} />
              </details>
            </div>
          </section>

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
                All canonical files are structurally validated for {datasetType === 'AR' ? 'AR (Outbound)' : 'AP (Inbound)'}.
                Mapping is unnecessary for these already-canonical files. Next: Run Checks.
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
          <div className="upload-ingestion-actions sticky bottom-3 z-20 flex flex-col gap-2 rounded-2xl border border-border/70 bg-background/90 p-2.5 shadow-lg backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
            <Button variant="outline" onClick={handleClearAll} disabled={!files.buyers && !files.headers && !files.lines && !adjustmentsFile}>
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
                      {isLoading ? `Processing data... ${loadElapsedLabel}` : 'Load Data & Continue to Run Checks'}
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


