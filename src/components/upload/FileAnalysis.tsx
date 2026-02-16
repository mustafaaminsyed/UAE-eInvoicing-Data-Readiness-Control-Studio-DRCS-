import { useState } from 'react';
import { FileText, Check, X, AlertTriangle, ChevronDown, ChevronUp, Key, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { downloadSampleCSV, getSampleData, SampleScenario } from '@/lib/sampleData';
import { getMandatoryColumnsForDataset } from '@/lib/registry/drRegistry';

// Expected customer-provided columns, derived from the downloadable sample templates.
function getManifestColumns(type: 'buyers' | 'headers' | 'lines'): string[] {
  const sample = getSampleData(type, 'positive')?.content ?? '';
  const header = sample.split(/\r?\n/)[0] ?? '';
  return header.split(',').map((c) => c.trim()).filter(Boolean);
}

// Spec-driven: mandatory UC1 columns per dataset, from DR registry (used for gating)
const getRequiredColumns = (type: 'buyers' | 'headers' | 'lines'): string[] =>
  getMandatoryColumnsForDataset(type);

const PK_CANDIDATES: Record<string, string> = {
  buyers: 'buyer_id',
  headers: 'invoice_id',
  lines: 'line_id',
};

export interface FileStats {
  fileName: string;
  fileSize: number;
  rowCount: number;
  columnCount: number;
  columns: string[];
  inferredPK: string | null;
  detectedDelimiter: string;
  detectedEncoding: string;
  previewRows: Record<string, string>[];
  requiredPresent: string[];
  requiredMissing: string[];
  nullWarnings: { column: string; nullRate: number }[];
}

export function analyzeFile(
  rows: Record<string, string>[],
  file: File,
  type: 'buyers' | 'headers' | 'lines',
  rawText?: string
): FileStats {
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  const required = getRequiredColumns(type);
  const requiredPresent = required.filter((c) => columns.includes(c));
  const requiredMissing = required.filter((c) => !columns.includes(c));

  // Detect delimiter from raw text
  let detectedDelimiter = 'comma';
  if (rawText) {
    const firstLine = rawText.split('\n')[0] || '';
    const commas = (firstLine.match(/,/g) || []).length;
    const tabs = (firstLine.match(/\t/g) || []).length;
    const semicolons = (firstLine.match(/;/g) || []).length;
    const pipes = (firstLine.match(/\|/g) || []).length;
    const max = Math.max(commas, tabs, semicolons, pipes);
    if (max === tabs && tabs > 0) detectedDelimiter = 'tab';
    else if (max === semicolons && semicolons > 0) detectedDelimiter = 'semicolon';
    else if (max === pipes && pipes > 0) detectedDelimiter = 'pipe';
  }

  const pkCandidate = PK_CANDIDATES[type];
  let inferredPK: string | null = null;
  if (pkCandidate && columns.includes(pkCandidate)) {
    const values = rows.map((r) => r[pkCandidate]);
    const unique = new Set(values);
    if (unique.size === values.length) inferredPK = pkCandidate;
  }

  const nullWarnings: { column: string; nullRate: number }[] = [];
  for (const col of requiredPresent) {
    const nullCount = rows.filter((r) => !r[col] || r[col].trim() === '').length;
    const rate = nullCount / rows.length;
    if (rate > 0.05) nullWarnings.push({ column: col, nullRate: rate });
  }

  return {
    fileName: file.name,
    fileSize: file.size,
    rowCount: rows.length,
    columnCount: columns.length,
    columns,
    inferredPK,
    detectedDelimiter,
    detectedEncoding: 'UTF-8',
    previewRows: rows.slice(0, 5),
    requiredPresent,
    requiredMissing,
    nullWarnings,
  };
}

interface FileSummaryCardProps {
  stats: FileStats;
  type: 'buyers' | 'headers' | 'lines';
  onRemove: () => void;
}

export function FileSummaryCard({ stats, type, onRemove }: FileSummaryCardProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const hasIssues = stats.requiredMissing.length > 0 || stats.nullWarnings.length > 0;

  return (
    <div className={cn(
      'rounded-lg border p-4 space-y-3 transition-colors overflow-hidden',
      hasIssues ? 'border-accent/40 bg-accent/5' : 'border-[hsl(var(--success))]/40 bg-[hsl(var(--success))]/5'
    )}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center',
            hasIssues ? 'bg-accent/20' : 'bg-[hsl(var(--success))]/10'
          )}>
            {hasIssues
              ? <AlertTriangle className="w-4 h-4 text-accent-foreground" />
              : <Check className="w-4 h-4 text-[hsl(var(--success))]" />}
          </div>
          <div>
            <p className="font-medium text-foreground text-sm">{stats.fileName}</p>
            <p className="text-xs text-muted-foreground">{(stats.fileSize / 1024).toFixed(1)} KB</p>
          </div>
        </div>
        <button onClick={onRemove} className="p-1 hover:bg-muted rounded">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">{stats.rowCount}</p>
          <p className="text-xs text-muted-foreground">Rows</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">{stats.columnCount}</p>
          <p className="text-xs text-muted-foreground">Columns</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground capitalize">{stats.detectedDelimiter}</p>
          <p className="text-xs text-muted-foreground">Delimiter</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">{stats.detectedEncoding}</p>
          <p className="text-xs text-muted-foreground">Encoding</p>
        </div>
        <div className="text-center">
          {stats.inferredPK ? (
            <>
              <div className="flex items-center justify-center gap-1">
                <Key className="w-3 h-3 text-primary" />
                <p className="text-sm font-semibold text-foreground">{stats.inferredPK}</p>
              </div>
              <p className="text-xs text-muted-foreground">Primary Key</p>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">—</p>
              <p className="text-xs text-muted-foreground">No PK</p>
            </>
          )}
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">{(stats.fileSize / 1024).toFixed(1)} KB</p>
          <p className="text-xs text-muted-foreground">Size</p>
        </div>
      </div>

      {/* Structural Validation — driven by template manifest */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Structural Validation</p>
        <div className="flex flex-wrap gap-1.5">
          {(() => {
            const manifestCols = getManifestColumns(type);
            const uploadedCols = new Set(stats.columns);
            const present = manifestCols.filter((c) => uploadedCols.has(c));
            const missing = manifestCols.filter((c) => !uploadedCols.has(c));
            return (
              <>
                {present.map((col) => (
                  <Badge key={col} variant="outline" className="text-xs gap-1 border-[hsl(var(--success))]/30 text-[hsl(var(--success))]">
                    <Check className="w-3 h-3" /> {col}
                  </Badge>
                ))}
                {missing.map((col) => (
                  <Badge key={col} variant="outline" className="text-xs gap-1 border-destructive/30 text-destructive">
                    <X className="w-3 h-3" /> {col}
                  </Badge>
                ))}
              </>
            );
          })()}
        </div>
        {stats.nullWarnings.length > 0 && (
          <div className="space-y-1 mt-2">
            {stats.nullWarnings.map((w) => (
              <p key={w.column} className="text-xs text-accent-foreground flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {w.column}: {(w.nullRate * 100).toFixed(0)}% null rate
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Preview Rows */}
      <Collapsible open={previewOpen} onOpenChange={setPreviewOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full text-xs gap-1 h-7">
            {previewOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            Preview rows ({Math.min(5, stats.rowCount)})
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="w-full max-w-full overflow-x-auto overflow-y-auto max-h-[320px] border rounded-lg mt-2">
            <Table className="min-w-max">
              <TableHeader>
                <TableRow>
                  {stats.columns.map((col) => (
                    <TableHead key={col} className="text-xs whitespace-nowrap">{col}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.previewRows.map((row, i) => (
                  <TableRow key={i}>
                    {stats.columns.map((col) => (
                      <TableCell key={col} className="text-xs py-1 whitespace-nowrap">
                        {row[col] || <span className="text-muted-foreground italic">null</span>}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

interface FileDropZoneProps {
  label: string;
  description: string;
  sampleType: 'buyers' | 'headers' | 'lines';
  sampleScenario?: SampleScenario;
  onFileSelect: (file: File) => void;
}

export function FileDropZone({ label, description, sampleType, sampleScenario = 'positive', onFileSelect }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDownloadSample = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const sample = getSampleData(sampleType, sampleScenario);
    downloadSampleCSV(sample.filename, sample.content);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-foreground text-sm">{label}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleDownloadSample} className="text-primary hover:text-primary/80 text-xs">
          <Download className="w-3 h-3 mr-1" />
          {sampleScenario === 'negative' ? 'Negative Test Template' : 'Positive Sample Template'}
        </Button>
      </div>
      <div
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const f = e.dataTransfer.files[0];
          if (f) onFileSelect(f);
        }}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
        className={cn(
          'relative border-2 border-dashed rounded-lg p-6 transition-all',
          'hover:border-primary/50 hover:bg-primary/5',
          isDragging ? 'border-primary bg-primary/10' : 'border-border'
        )}
      >
        <input
          type="file"
          accept=".csv"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileSelect(f); }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div className="flex flex-col items-center text-center">
          <FileText className="w-8 h-8 text-muted-foreground mb-2" />
          <p className="text-sm font-medium text-foreground">Drop CSV here or click to browse</p>
        </div>
      </div>
    </div>
  );
}
