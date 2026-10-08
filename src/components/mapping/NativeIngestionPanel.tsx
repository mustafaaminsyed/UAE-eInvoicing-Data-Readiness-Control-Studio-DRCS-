import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, Download, Play } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCompliance } from '@/context/ComplianceContext';
import { useToast } from '@/hooks/use-toast';
import { buildCanonicalCsv, toCanonicalFieldMappings } from '@/lib/mapping/canonicalIngestionAdapter';
import { canonicalizeSourceRows } from '@/lib/mapping/canonicalizationEngine';
import { downloadSampleCSV, type SampleDataset } from '@/lib/sampleData';
import type { Direction } from '@/types/direction';
import type { ERPPreviewData, FieldMapping } from '@/types/fieldMapping';

interface NativeIngestionPanelProps {
  previewData: ERPPreviewData;
  mappings: FieldMapping[];
  direction: Direction;
}

const DATASETS: SampleDataset[] = ['buyers', 'headers', 'lines'];

function suggestedColumn(columns: string[], candidates: string[]): string {
  return columns.find((column) => candidates.includes(column.toLowerCase())) || '';
}

export function NativeIngestionPanel({ previewData, mappings, direction }: NativeIngestionPanelProps) {
  const { setData } = useCompliance();
  const { toast } = useToast();
  const [buyerColumn, setBuyerColumn] = useState(() => suggestedColumn(previewData.columns, ['buyer_id', 'customer_id', 'customer_code', 'buyer_code']));
  const [invoiceColumn, setInvoiceColumn] = useState(() => suggestedColumn(previewData.columns, ['invoice_id', 'invoice_number', 'document_number', 'invoice_no']));
  const [lineColumn, setLineColumn] = useState(() => suggestedColumn(previewData.columns, ['line_id', 'line_number', 'line_no', 'item_line']));
  const [lineNumberColumn, setLineNumberColumn] = useState(() => suggestedColumn(previewData.columns, ['line_number', 'line_no', 'item_line']));
  const [generateBuyerId, setGenerateBuyerId] = useState(false);
  const [generateInvoiceId, setGenerateInvoiceId] = useState(false);
  const [generateLineId, setGenerateLineId] = useState(true);

  const result = useMemo(() => {
    if (!buyerColumn || !invoiceColumn || !lineColumn) return null;
    const lineSources = generateLineId && invoiceColumn !== lineColumn
      ? [invoiceColumn, lineColumn]
      : [lineColumn];
    return canonicalizeSourceRows({
      sourceFile: previewData.fileName,
      keyScope: `${direction}|${previewData.fileName}`,
      rows: previewData.rows,
      mappings: toCanonicalFieldMappings(mappings, direction),
      relationships: {
        buyerKey: { mode: generateBuyerId ? 'generated' : 'source', sourceColumns: [buyerColumn], prefix: 'BUYER' },
        invoiceKey: { mode: generateInvoiceId ? 'generated' : 'source', sourceColumns: [invoiceColumn], prefix: 'INVOICE' },
        lineKey: { mode: generateLineId ? 'generated' : 'source', sourceColumns: lineSources, prefix: 'LINE' },
        lineNumberColumn: lineNumberColumn || undefined,
      },
    });
  }, [buyerColumn, direction, generateBuyerId, generateInvoiceId, generateLineId, invoiceColumn, lineColumn, lineNumberColumn, mappings, previewData]);

  const downloadDataset = (dataset: SampleDataset) => {
    if (!result?.canExport) return;
    downloadSampleCSV(`canonical_${dataset}.csv`, buildCanonicalCsv(result, dataset, direction));
  };

  const loadDiagnosticDataset = () => {
    if (!result?.canLoadDiagnosticDataset) return;
    const sessionId = `diagnostic-${Date.now()}`;
    setData({ buyers: result.buyers, headers: result.headers, lines: result.lines, direction }, {
      direction,
      uploadSessionId: sessionId,
      uploadManifestId: `${sessionId}-native-mapping`,
    });
    toast({
      title: 'Diagnostic dataset loaded',
      description: `${result.headers.length} document(s) are available for the Run Checks workflow.`,
    });
  };

  const keySelector = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    generated: boolean,
    onGeneratedChange: (value: boolean) => void,
  ) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Select source column" /></SelectTrigger>
        <SelectContent>{previewData.columns.map((column) => <SelectItem key={column} value={column}>{column}</SelectItem>)}</SelectContent>
      </Select>
      <div className="flex items-center gap-2">
        <Checkbox checked={generated} onCheckedChange={(checked) => onGeneratedChange(checked === true)} />
        <span className="text-xs text-muted-foreground">Generate a stable DRCS key from this source value</span>
      </div>
    </div>
  );

  if (previewData.datasetType !== 'combined') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Canonical ingestion preview</CardTitle>
          <CardDescription>Available for combined source files containing buyer, header and line records.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle>Canonical ingestion preview</CardTitle>
        <CardDescription>Define the three relationship keys, review the split datasets, then download or load them for diagnostic checks.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-3">
          {keySelector('Buyer relationship source', buyerColumn, setBuyerColumn, generateBuyerId, setGenerateBuyerId)}
          {keySelector('Invoice relationship source', invoiceColumn, setInvoiceColumn, generateInvoiceId, setGenerateInvoiceId)}
          {keySelector('Line relationship source', lineColumn, setLineColumn, generateLineId, setGenerateLineId)}
        </div>
        <div className="max-w-sm space-y-2">
          <Label>Line number source (optional)</Label>
          <Select value={lineNumberColumn || '__generated__'} onValueChange={(value) => setLineNumberColumn(value === '__generated__' ? '' : value)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__generated__">Generate sequentially per invoice</SelectItem>
              {previewData.columns.map((column) => <SelectItem key={column} value={column}>{column}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {!result ? (
          <Alert><AlertTriangle className="h-4 w-4" /><AlertDescription>Select buyer, invoice and line relationship sources to build the preview.</AlertDescription></Alert>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Badge variant="outline" className="justify-center py-2">{result.buyers.length} buyers</Badge>
              <Badge variant="outline" className="justify-center py-2">{result.headers.length} headers</Badge>
              <Badge variant="outline" className="justify-center py-2">{result.lines.length} lines</Badge>
            </div>
            {result.diagnostics.length > 0 ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{result.diagnostics.length} blocking diagnostic(s) found. Export and diagnostic loading remain disabled.</AlertDescription>
              </Alert>
            ) : (
              <Alert className="border-green-500/30 bg-green-500/5"><CheckCircle className="h-4 w-4 text-green-600" /><AlertDescription>Relationships are valid. Missing business fields remain blank for DRCS assessment.</AlertDescription></Alert>
            )}
            {result.diagnostics.length > 0 && (
              <div className="max-h-56 overflow-auto rounded-lg border">
                <Table>
                  <TableHeader><TableRow><TableHead>Row</TableHead><TableHead>Code</TableHead><TableHead>Message</TableHead></TableRow></TableHeader>
                  <TableBody>{result.diagnostics.slice(0, 20).map((item, index) => <TableRow key={`${item.code}-${item.sourceRow}-${index}`}><TableCell>{item.sourceRow ?? '-'}</TableCell><TableCell><Badge variant="outline">{item.code}</Badge></TableCell><TableCell>{item.message}</TableCell></TableRow>)}</TableBody>
                </Table>
              </div>
            )}
            <p className="text-xs text-muted-foreground">{result.provenance.length} field-level source attribution entries prepared in memory.</p>
            <div className="flex flex-wrap gap-2">
              {DATASETS.map((dataset) => <Button key={dataset} variant="outline" disabled={!result.canExport} onClick={() => downloadDataset(dataset)}><Download className="mr-2 h-4 w-4" />Download {dataset} CSV</Button>)}
              <Button disabled={!result.canLoadDiagnosticDataset} onClick={loadDiagnosticDataset}><Play className="mr-2 h-4 w-4" />Load diagnostic dataset</Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
