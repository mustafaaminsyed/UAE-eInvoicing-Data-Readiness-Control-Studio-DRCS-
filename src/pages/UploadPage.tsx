import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, FileSpreadsheet, AlertCircle, CheckCircle2, Link2, ArrowRightCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useCompliance } from '@/context/ComplianceContext';
import { parsePartiesFile, parseHeadersFile, parseLinesFile, parseCSV } from '@/lib/csvParser';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { FileDropZone, FileSummaryCard, analyzeFile, FileStats } from '@/components/upload/FileAnalysis';
import { SampleScenario } from '@/lib/sampleData';
import { detectDirectionFromColumns } from '@/lib/direction/directionUtils';
import { Direction } from '@/types/direction';

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
  const { direction, setDirection, setData, clearData, addUploadLogEntry } = useCompliance();

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
  const [detectedDirection, setDetectedDirection] = useState<Direction | null>(null);

  const allFilesSelected = files.headers && files.lines;
  const allStats = stats.headers && stats.lines;

  // Determine current step
  let currentStep: StepKey = 'upload';
  if (allFilesSelected && allStats) currentStep = 'validation';

  // Compute blocking reasons
  const blockingReasons: string[] = [];
  if (!files.headers) blockingReasons.push('Invoice Headers file not uploaded');
  if (!files.lines) blockingReasons.push('Invoice Lines file not uploaded');
  if (stats.buyers?.requiredMissing.length) {
    blockingReasons.push(`${direction === 'AP' ? 'Suppliers' : 'Buyers'}: missing columns (${stats.buyers.requiredMissing.join(', ')})`);
  }
  if (stats.headers?.requiredMissing.length) blockingReasons.push(`Headers: missing columns (${stats.headers.requiredMissing.join(', ')})`);
  if (stats.lines?.requiredMissing.length) blockingReasons.push(`Lines: missing columns (${stats.lines.requiredMissing.join(', ')})`);

  const hasStructuralErrors = [stats.headers, stats.lines].some(
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
      const analysis = analyzeFile(rows, file, type, direction, text);
      setStats((prev) => ({ ...prev, [type]: analysis }));
      setParsedRows((prev) => ({ ...prev, [type]: rows }));

      if (type !== 'lines' && rows.length > 0) {
        const sniffed = detectDirectionFromColumns(Object.keys(rows[0]));
        if (sniffed) setDetectedDirection(sniffed);
      }
    } catch {
      toast({ title: 'Error reading file', description: 'Could not parse the CSV file.', variant: 'destructive' });
    }
  }, [direction, toast]);

  // Relational integrity checks
  useEffect(() => {
    const checks: RelationalCheck[] = [];
    if (parsedRows.headers && parsedRows.buyers) {
      const partyKey = direction === 'AP' ? 'supplier_id' : 'buyer_id';
      const buyerIds = new Set(parsedRows.buyers.map((r) => r[partyKey] || r.buyer_id));
      const headerBuyerIds = parsedRows.headers.map((r) => r[partyKey] || r.buyer_id).filter(Boolean);
      const matched = headerBuyerIds.filter((id) => buyerIds.has(id));
      const unmatched = headerBuyerIds.length - matched.length;
      checks.push({
        label: direction === 'AP' ? 'headers.supplier_id -> suppliers.supplier_id' : 'headers.buyer_id -> buyers.buyer_id',
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
  }, [direction, parsedRows]);

  const handleLoadData = async () => {
    if (!canProceed) return;
    setIsLoading(true);
    try {
      const sessionId = `upl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const manifestId = `man_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const [buyers, headers, lines] = await Promise.all([
        files.buyers
          ? parsePartiesFile(files.buyers, { direction, uploadSessionId: sessionId, uploadManifestId: manifestId })
          : Promise.resolve([]),
        parseHeadersFile(files.headers!, { direction, uploadSessionId: sessionId, uploadManifestId: manifestId }),
        parseLinesFile(files.lines!, { uploadSessionId: sessionId, uploadManifestId: manifestId }),
      ]);
      setData(
        { buyers, headers, lines, direction, uploadSessionId: sessionId, uploadManifestId: manifestId },
        { direction, uploadSessionId: sessionId, uploadManifestId: manifestId },
      );

      addUploadLogEntry({
        fileCount: files.buyers ? 3 : 2,
        uploadSessionId: sessionId,
        uploadManifestId: manifestId,
        files: [
          ...(files.buyers ? [{
            dataset: 'buyers' as const,
            fileName: files.buyers.name,
            fileSize: files.buyers.size,
            rowCount: stats.buyers?.rowCount ?? buyers.length,
            columnCount: stats.buyers?.columnCount ?? 0,
          }] : []),
          {
            dataset: 'headers',
            fileName: files.headers!.name,
            fileSize: files.headers!.size,
            rowCount: stats.headers?.rowCount ?? headers.length,
            columnCount: stats.headers?.columnCount ?? 0,
          },
          {
            dataset: 'lines',
            fileName: files.lines!.name,
            fileSize: files.lines!.size,
            rowCount: stats.lines?.rowCount ?? lines.length,
            columnCount: stats.lines?.columnCount ?? 0,
          },
        ],
        summary: {
          buyersCount: buyers.length,
          headersCount: headers.length,
          linesCount: lines.length,
          totalRows: buyers.length + headers.length + lines.length,
          scenario: sampleScenario,
          direction,
        },
      });

      toast({
        title: 'Data loaded successfully',
        description: `${buyers.length} ${direction === 'AP' ? 'suppliers' : 'buyers'}, ${headers.length} invoices, ${lines.length} line items`,
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
    setDetectedDirection(null);
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
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border bg-card px-2 py-1">
            <Button size="sm" variant={direction === 'AR' ? 'default' : 'ghost'} onClick={() => setDirection('AR')}>
              Outbound (AR)
            </Button>
            <Button size="sm" variant={direction === 'AP' ? 'default' : 'ghost'} onClick={() => setDirection('AP')}>
              Inbound (AP)
            </Button>
          </div>
        </div>

        <div className="space-y-6 animate-slide-up">
          {detectedDirection && detectedDirection !== direction && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-medium">Detected columns look like {detectedDirection} data.</p>
              <p className="mt-1">Current direction is {direction}. Switch to match templates and required columns.</p>
              <div className="mt-3">
                <Button size="sm" variant="outline" onClick={() => setDirection(detectedDirection)}>
                  Switch to {detectedDirection}
                </Button>
              </div>
            </div>
          )}

          <div className="surface-glass rounded-2xl border border-white/70 shadow-sm p-4">
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
                <FileSummaryCard stats={stats.buyers} type="buyers" direction={direction} onRemove={() => handleFileSelect('buyers', null)} />
              ) : (
                <FileDropZone
                  label={direction === 'AP' ? 'Suppliers/Vendors File (Optional)' : 'Buyers/Customers File (Optional)'}
                  description={direction === 'AP' ? 'supplier_id, supplier_name, supplier_trn, supplier_address, supplier_country' : 'buyer_id, buyer_name, buyer_trn, buyer_address, buyer_country'}
                  sampleType="buyers"
                  sampleScenario={sampleScenario}
                  direction={direction}
                  onFileSelect={(f) => handleFileSelect('buyers', f)}
                />
              )}

              <div className="border-t" />

              {/* Headers */}
              {stats.headers ? (
                <FileSummaryCard stats={stats.headers} type="headers" direction={direction} onRemove={() => handleFileSelect('headers', null)} />
              ) : (
                <FileDropZone
                  label="Invoice Headers File"
                  description={direction === 'AP' ? 'invoice_id, invoice_number, issue_date, seller_trn, supplier_id, buyer_trn, currency, ...' : 'invoice_id, invoice_number, issue_date, seller_trn, buyer_id, currency, ...'}
                  sampleType="headers"
                  sampleScenario={sampleScenario}
                  direction={direction}
                  onFileSelect={(f) => handleFileSelect('headers', f)}
                />
              )}

              <div className="border-t" />

              {/* Lines */}
              {stats.lines ? (
                <FileSummaryCard stats={stats.lines} type="lines" direction={direction} onRemove={() => handleFileSelect('lines', null)} />
              ) : (
                <FileDropZone label="Invoice Lines File" description="line_id, invoice_id, line_number, quantity, unit_price, vat_rate, ..." sampleType="lines" sampleScenario={sampleScenario} direction={direction} onFileSelect={(f) => handleFileSelect('lines', f)} />
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
              <span className="text-[hsl(var(--success))] font-medium">All files uploaded and validated. Ready to proceed.</span>
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


