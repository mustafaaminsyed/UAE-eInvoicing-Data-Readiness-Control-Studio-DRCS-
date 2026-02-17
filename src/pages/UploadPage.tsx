import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, FileSpreadsheet, AlertCircle, CheckCircle2, Link2, ArrowRightCircle } from 'lucide-react';
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
  const [sampleScenario, setSampleScenario] = useState<SampleScenario>('positive');
  const [datasetType, setDatasetType] = useState<DatasetType>('AR');

  const allFilesSelected = files.buyers && files.headers && files.lines;
  const allStats = stats.buyers && stats.headers && stats.lines;

  // Determine current step
  let currentStep: StepKey = 'upload';
  if (allFilesSelected && allStats) currentStep = 'validation';

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
      const analysis = analyzeFile(rows, file, type);
      setStats((prev) => ({ ...prev, [type]: analysis }));
      setParsedRows((prev) => ({ ...prev, [type]: rows }));
    } catch {
      toast({ title: 'Error reading file', description: 'Could not parse the CSV file.', variant: 'destructive' });
    }
  }, [toast]);

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

  const handleLoadData = async () => {
    if (!canProceed) return;
    setIsLoading(true);
    try {
      const [buyers, headers, lines] = await Promise.all([
        parseBuyersFile(files.buyers!),
        parseHeadersFile(files.headers!),
        parseLinesFile(files.lines!),
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
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((step, i) => (
            <div key={step.key} className="flex items-center gap-2">
              <div className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
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
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-sm font-semibold text-foreground">Sample Testing Mode</p>
                <p className="text-xs text-muted-foreground">
                  Choose positive samples for baseline pass testing, or negative samples to simulate exceptions.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={sampleScenario === 'positive' ? 'default' : 'outline'}
                  onClick={() => setSampleScenario('positive')}
                >
                  Positive Samples
                </Button>
                <Button
                  size="sm"
                  variant={sampleScenario === 'negative' ? 'default' : 'outline'}
                  onClick={() => setSampleScenario('negative')}
                >
                  Negative Test Samples
                </Button>
              </div>
            </div>
          </div>

          {/* File Cards */}
          <div className="surface-glass rounded-2xl border border-white/70 shadow-sm p-6">
            <div className="grid gap-6">
              {/* Buyers */}
              {stats.buyers ? (
                <FileSummaryCard stats={stats.buyers} type="buyers" onRemove={() => handleFileSelect('buyers', null)} />
              ) : (
                <FileDropZone label="Buyers File" description="buyer_id, buyer_name, buyer_trn, buyer_address, buyer_country" sampleType="buyers" sampleScenario={sampleScenario} onFileSelect={(f) => handleFileSelect('buyers', f)} />
              )}

              <div className="border-t" />

              {/* Headers */}
              {stats.headers ? (
                <FileSummaryCard stats={stats.headers} type="headers" onRemove={() => handleFileSelect('headers', null)} />
              ) : (
                <FileDropZone label="Invoice Headers File" description="invoice_id, invoice_number, issue_date, seller_trn, buyer_id, currency, ..." sampleType="headers" sampleScenario={sampleScenario} onFileSelect={(f) => handleFileSelect('headers', f)} />
              )}

              <div className="border-t" />

              {/* Lines */}
              {stats.lines ? (
                <FileSummaryCard stats={stats.lines} type="lines" onRemove={() => handleFileSelect('lines', null)} />
              ) : (
                <FileDropZone label="Invoice Lines File" description="line_id, invoice_id, line_number, quantity, unit_price, vat_rate, ..." sampleType="lines" sampleScenario={sampleScenario} onFileSelect={(f) => handleFileSelect('lines', f)} />
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
                  <div key={check.label} className="flex items-center justify-between text-sm">
                    <code className="text-xs text-muted-foreground font-mono">{check.label}</code>
                    <div className="flex items-center gap-2">
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
            <div className="flex items-center gap-2 text-sm bg-[hsl(var(--success))]/5 rounded-lg p-4 border border-[hsl(var(--success))]/20">
              <CheckCircle2 className="w-4 h-4 text-[hsl(var(--success))]" />
              <span className="text-[hsl(var(--success))] font-medium">
                All files uploaded and validated for {datasetType === 'AR' ? 'AR (Outbound)' : 'AP (Inbound)'}.
                Ready to proceed.
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between">
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
                      className="gap-2"
                    >
                      {isLoading ? 'Loading...' : 'Load Data & Continue'}
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


