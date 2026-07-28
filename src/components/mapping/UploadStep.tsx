import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, Database, Calendar, Hash, Type, RefreshCw, Download, Info } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ERPPreviewData, DatasetType, DetectedColumn, DocumentBaseline } from '@/types/fieldMapping';
import { parseCSV } from '@/lib/csvParser';
import { buildBlankTemplateExport, downloadSampleCSV, getSampleData } from '@/lib/sampleData';
import { Direction } from '@/types/direction';
import { detectLikelyDatasetType } from '@/lib/mapping/datasetFieldCatalog';

interface UploadStepProps {
  onDataLoaded: (data: ERPPreviewData) => void;
  previewData: ERPPreviewData | null;
  onReset?: () => void;
  direction?: Direction;
}

const DATASET_TYPES: { value: DatasetType; label: string; description: string; helpText: string }[] = [
  {
    value: 'header',
    label: 'Invoice Headers',
    description: 'One row per invoice with header-level data',
    helpText:
      'Use this when your ERP export contains one invoice per row, with fields such as invoice number, issue date, totals, currency, and seller or buyer references.',
  },
  {
    value: 'lines',
    label: 'Invoice Lines',
    description: 'One row per line item with line-level data',
    helpText:
      'Use this when each row represents an invoice line, including fields such as line number, item description, quantity, unit price, VAT rate, and line totals.',
  },
  {
    value: 'parties',
    label: 'Party Data',
    description: 'Seller/buyer party information',
    helpText:
      'Use this for master data extracts that contain buyer or supplier details such as legal name, TRN, address, city, country, and registration references.',
  },
  {
    value: 'combined',
    label: 'Combined Export',
    description: 'Headers and lines in a single extract',
    helpText:
      'Use this when one source file contains both invoice-level and line-level fields together. This is common in flat transaction exports where invoice headers repeat across multiple line rows.',
  },
];

const DOCUMENT_BASELINE_OPTIONS: Array<{
  value: DocumentBaseline;
  label: string;
  description: string;
  helpText: string;
  disabled?: boolean;
}> = [
  {
    value: '380',
    label: '380 Standard Tax Invoice',
    description: 'Baseline for standard UAE tax invoices',
    helpText:
      'Use this when the uploaded file is expected to contain only standard tax invoices. DRCS will not treat credit-note-only fields as in-scope.',
  },
  {
    value: '381',
    label: '381 Credit Note',
    description: 'Baseline for credit notes with reference fields',
    helpText:
      'Use this when the uploaded file is expected to contain credit notes. DRCS will emphasize credit note reason code, reason text, and preceding invoice references.',
  },
  {
    value: 'mixed',
    label: 'Mixed / Detect From Source',
    description: 'Infer scenario expectations from invoice_type values',
    helpText:
      'Use this when the source may contain a mix of invoice scenarios. DRCS will inspect invoice_type values in the uploaded data and apply scenario-specific expectations where relevant.',
  },
  {
    value: '386',
    label: '386 Prepayment Invoice',
    description: 'Coming soon',
    helpText:
      'Prepayment invoice baseline is not yet modeled end-to-end in the current mapping/template layer.',
    disabled: true,
  },
  {
    value: '388',
    label: '388 Self-Billing Tax Invoice',
    description: 'Coming soon',
    helpText:
      'Self-billing baseline has partial rule awareness in DRCS, but the mapping/template layer is not yet fully scenario-complete.',
    disabled: true,
  },
];

type BuiltInTemplateType = 'buyers' | 'headers' | 'lines';

type BuiltInTemplateOption = {
  sampleType: BuiltInTemplateType;
  title: string;
  description: string;
  wizardDatasetType: DatasetType;
};

const BUILT_IN_TEMPLATE_OPTIONS: Record<DatasetType, BuiltInTemplateOption[]> = {
  header: [
    {
      sampleType: 'headers',
      title: 'Invoice Headers Template',
      description: 'Canonical header-level CSV for one row per invoice.',
      wizardDatasetType: 'header',
    },
  ],
  lines: [
    {
      sampleType: 'lines',
      title: 'Invoice Lines Template',
      description: 'Canonical line-level CSV for one row per invoice line.',
      wizardDatasetType: 'lines',
    },
  ],
  parties: [
    {
      sampleType: 'buyers',
      title: 'Party Data Template',
      description: 'Canonical buyer or supplier master data template.',
      wizardDatasetType: 'parties',
    },
  ],
  combined: [
    {
      sampleType: 'buyers',
      title: 'Party Data Template',
      description: 'Load the party master template separately before mapping.',
      wizardDatasetType: 'parties',
    },
    {
      sampleType: 'headers',
      title: 'Invoice Headers Template',
      description: 'Load the header template when your export is split by invoice.',
      wizardDatasetType: 'header',
    },
    {
      sampleType: 'lines',
      title: 'Invoice Lines Template',
      description: 'Load the line template when your export is split by invoice line.',
      wizardDatasetType: 'lines',
    },
  ],
};

const DATASET_ROUTING_GUIDE: Record<
  DatasetType,
  {
    label: string;
    summary: string;
    expectedFields: string[];
    invoiceNumberRule: string;
  }
> = {
  header: {
    label: 'Invoice Headers',
    summary:
      'Use this when one row represents one invoice. The assistant will only suggest header, totals, seller, and related invoice-level fields.',
    expectedFields: ['invoice_number', 'issue_date', 'currency', 'total_excl_vat', 'vat_total', 'total_incl_vat'],
    invoiceNumberRule: 'Invoice number belongs here. It maps to header business term IBT-001.',
  },
  lines: {
    label: 'Invoice Lines',
    summary:
      'Use this when one row represents one invoice line. The assistant will focus on line-level fields and line-tax fields rather than invoice-header business terms.',
    expectedFields: ['line_number', 'description', 'quantity', 'unit_price', 'line_total_excl_vat', 'vat_rate'],
    invoiceNumberRule: 'Invoice number is not the primary target here. Pure line files are expected to cover line fields, with linkage handled through invoice join keys.',
  },
  parties: {
    label: 'Party Data',
    summary:
      'Use this for buyer or supplier master data. The assistant will only suggest counterparty fields such as names, TRNs, addresses, and country details.',
    expectedFields: ['buyer_name', 'buyer_trn', 'buyer_address', 'buyer_country', 'buyer_city'],
    invoiceNumberRule: 'Invoice number should not be mapped in a party-data file.',
  },
  combined: {
    label: 'Combined Export',
    summary:
      'Use this when one source file contains both invoice-header and invoice-line fields. The assistant will allow both header and line mappings together.',
    expectedFields: ['invoice_number', 'issue_date', 'currency', 'line_number', 'description', 'quantity'],
    invoiceNumberRule: 'Invoice number can be mapped here because combined files include invoice-header content as well as line data.',
  },
};

const DOCUMENT_BASELINE_GUIDE: Record<
  Exclude<DocumentBaseline, '386' | '388'>,
  {
    summary: string;
    expectedFields: string[];
    validationNote: string;
  }
> = {
  '380': {
    summary:
      'Standard-invoice baseline focuses on the core invoice, seller, buyer, totals, and line fields needed for a normal UAE tax invoice.',
    expectedFields: ['invoice_number', 'issue_date', 'currency', 'seller_trn', 'total_incl_vat', 'line_total_excl_vat'],
    validationNote: 'Credit-note-only fields are treated as out of scope unless the uploaded headers actually contain credit notes.',
  },
  '381': {
    summary:
      'Credit-note baseline keeps the standard invoice structure, but adds the scenario-specific reference and reason fields expected for invoice type 381.',
    expectedFields: ['credit_note_reason_code', 'credit_note_reason_text', 'preceding_invoice_reference', 'preceding_invoice_issue_date'],
    validationNote: 'Use this when the file is specifically a credit-note population and those additional header fields are expected to be mapped.',
  },
  mixed: {
    summary:
      'Mixed baseline lets DRCS read the invoice_type values in the uploaded data and decide when standard-invoice versus credit-note expectations apply.',
    expectedFields: ['invoice_type', 'invoice_number', 'issue_date', 'credit_note_reason_code', 'preceding_invoice_reference'],
    validationNote: 'This is the safest option for mixed populations because scenario-specific fields only become required when the source rows indicate that scenario.',
  },
};

function detectObservedInvoiceTypes(previewData: ERPPreviewData | null): string[] {
  if (!previewData || (previewData.datasetType !== 'header' && previewData.datasetType !== 'combined')) {
    return [];
  }

  return Array.from(
    new Set(
      previewData.rows
        .map((row) => String(row.invoice_type || row.invoice_type_code || '').trim())
        .filter(Boolean)
    )
  ).sort();
}

function detectColumnType(values: string[]): 'string' | 'number' | 'date' | 'boolean' | 'unknown' {
  const nonEmpty = values.filter(v => v && v.trim() !== '');
  if (nonEmpty.length === 0) return 'unknown';

  // Check for date patterns
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
    /^\d{2}\/\d{2}\/\d{4}$/, // DD/MM/YYYY
    /^\d{2}-\d{2}-\d{4}$/, // DD-MM-YYYY
  ];
  const dateMatches = nonEmpty.filter(v => datePatterns.some(p => p.test(v)));
  if (dateMatches.length / nonEmpty.length > 0.8) return 'date';

  // Check for numbers
  const numberMatches = nonEmpty.filter(v => !isNaN(Number(v.replace(/,/g, ''))));
  if (numberMatches.length / nonEmpty.length > 0.8) return 'number';

  // Check for booleans
  const boolValues = ['true', 'false', 'yes', 'no', '1', '0', 'y', 'n'];
  const boolMatches = nonEmpty.filter(v => boolValues.includes(v.toLowerCase()));
  if (boolMatches.length / nonEmpty.length > 0.8) return 'boolean';

  return 'string';
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'number': return <Hash className="h-3 w-3" />;
    case 'date': return <Calendar className="h-3 w-3" />;
    case 'boolean': return <Database className="h-3 w-3" />;
    default: return <Type className="h-3 w-3" />;
  }
}

function buildPreviewData(
  fileName: string,
  text: string,
  datasetType: DatasetType,
  documentBaseline: DocumentBaseline
): ERPPreviewData {
  const rows = parseCSV(text);

  if (rows.length === 0) {
    throw new Error('File appears to be empty or invalid');
  }

  const columns = Object.keys(rows[0]);
  const detectedColumns: DetectedColumn[] = columns.map((col, index) => {
    const values = rows.slice(0, 100).map((r) => r[col] || '');
    const nonEmpty = values.filter((v) => v && v.trim() !== '');
    const uniqueValues = new Set(nonEmpty);

    return {
      name: col,
      index,
      detectedType: detectColumnType(values),
      sampleValues: values.slice(0, 5),
      nullCount: values.length - nonEmpty.length,
      uniqueCount: uniqueValues.size,
    };
  });

  return {
    fileName,
    columns,
    detectedColumns,
    rows: rows.slice(0, 100),
    totalRows: rows.length,
    datasetType,
    documentBaseline,
  };
}

function isSpreadsheetFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  return lower.endsWith('.xlsx') || lower.endsWith('.xls');
}

function extractWorkbookCSV(file: File, workbook: XLSX.WorkBook): string {
  const candidateSheetName = workbook.SheetNames.find((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet || !worksheet['!ref']) return false;
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    return range.e.r >= range.s.r && range.e.c >= range.s.c;
  });

  if (!candidateSheetName) {
    throw new Error(`Workbook "${file.name}" does not contain a readable worksheet.`);
  }

  const worksheet = workbook.Sheets[candidateSheetName];
  const csv = XLSX.utils.sheet_to_csv(worksheet, { blankrows: false });

  if (!csv.trim()) {
    throw new Error(`Worksheet "${candidateSheetName}" in "${file.name}" is empty.`);
  }

  return csv;
}

async function readUploadText(file: File): Promise<string> {
  if (!isSpreadsheetFile(file)) {
    return file.text();
  }

  const workbookBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(workbookBuffer, { type: 'array' });
  return extractWorkbookCSV(file, workbook);
}

export function UploadStep({ onDataLoaded, previewData, onReset, direction = 'AR' }: UploadStepProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDatasetType, setSelectedDatasetType] = useState<DatasetType>('combined');
  const [selectedDocumentBaseline, setSelectedDocumentBaseline] = useState<DocumentBaseline>('mixed');
  const [hasUserSelectedDatasetType, setHasUserSelectedDatasetType] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (previewData?.datasetType) {
      setSelectedDatasetType(previewData.datasetType);
    }
  }, [previewData?.datasetType]);

  useEffect(() => {
    if (previewData?.documentBaseline) {
      setSelectedDocumentBaseline(previewData.documentBaseline);
    }
  }, [previewData?.documentBaseline]);

  const processFile = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);

    try {
      const text = await readUploadText(file);
      const rows = parseCSV(text);
      if (rows.length === 0) {
        throw new Error('File appears to be empty or invalid');
      }

      const columns = Object.keys(rows[0]);
      const detectedDatasetType = detectLikelyDatasetType(columns);
      const resolvedDatasetType =
        hasUserSelectedDatasetType
          ? selectedDatasetType
          : detectedDatasetType || selectedDatasetType;

      setSelectedDatasetType(resolvedDatasetType);
      onDataLoaded(buildPreviewData(file.name, text, resolvedDatasetType, selectedDocumentBaseline));
    } catch (err) {
      console.error('Error parsing file:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to parse file. Please upload a valid CSV or Excel workbook.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [hasUserSelectedDatasetType, onDataLoaded, selectedDatasetType, selectedDocumentBaseline]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleReupload = useCallback(() => {
    setError(null);
    onReset?.();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  }, [onReset]);

  const handleDatasetTypeChange = (value: DatasetType) => {
    setHasUserSelectedDatasetType(true);
    setSelectedDatasetType(value);
    if (previewData) {
      onDataLoaded({
        ...previewData,
        datasetType: value,
      });
    }
  };

  const handleDocumentBaselineChange = (value: DocumentBaseline) => {
    if (value === '386' || value === '388') return;
    setSelectedDocumentBaseline(value);
    if (previewData) {
      onDataLoaded({
        ...previewData,
        documentBaseline: value,
      });
    }
  };

  const handleLoadBuiltInTemplate = useCallback((sampleType: BuiltInTemplateType, datasetType: DatasetType) => {
    setIsLoading(true);
    setError(null);

    try {
      const sample = getSampleData(sampleType, 'positive', direction);
      onDataLoaded(buildPreviewData(sample.filename, sample.content, datasetType, selectedDocumentBaseline));
      setHasUserSelectedDatasetType(false);
      setSelectedDatasetType(datasetType);
    } catch (err) {
      console.error('Error loading built-in template:', err);
      setError(err instanceof Error ? err.message : 'Failed to load built-in template.');
    } finally {
      setIsLoading(false);
    }
  }, [direction, onDataLoaded, selectedDocumentBaseline]);

  const handleDownloadBuiltInTemplate = useCallback((sampleType: BuiltInTemplateType) => {
    const blankTemplate = buildBlankTemplateExport(sampleType, direction);
    downloadSampleCSV(blankTemplate.filename, blankTemplate.content);
  }, [direction]);

  const builtInTemplates = BUILT_IN_TEMPLATE_OPTIONS[selectedDatasetType];
  const routingGuide = DATASET_ROUTING_GUIDE[selectedDatasetType];
  const baselineGuide = DOCUMENT_BASELINE_GUIDE[selectedDocumentBaseline as keyof typeof DOCUMENT_BASELINE_GUIDE] ?? DOCUMENT_BASELINE_GUIDE.mixed;
  const observedInvoiceTypes = detectObservedInvoiceTypes(previewData);
  const hasDocumentBaselineMismatch =
    selectedDocumentBaseline !== 'mixed' &&
    observedInvoiceTypes.length > 0 &&
    observedInvoiceTypes.some((invoiceType) => invoiceType !== selectedDocumentBaseline);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5">
            <FileSpreadsheet className="h-5 w-5 shrink-0" />
            <span>Document Baseline</span>
            <TooltipProvider delayDuration={120}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="Explain document baseline choices"
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border/70 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-sm text-xs leading-relaxed">
                  Choose the invoice scenario baseline before mapping so DRCS can show the right conditional-field guidance.
                  This does not rewrite your source data; it only shapes mapping expectations and warnings.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
          <CardDescription>
            Highlight the invoice scenario this file is expected to represent before field mapping begins
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            value={selectedDocumentBaseline}
            onValueChange={(v) => handleDocumentBaselineChange(v as DocumentBaseline)}
            className="grid gap-3 lg:grid-cols-3"
          >
            {DOCUMENT_BASELINE_OPTIONS.map((baseline) => (
              <div
                key={baseline.value}
                className={`rounded-xl border p-4 ${baseline.disabled ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <RadioGroupItem
                    value={baseline.value}
                    id={`doc-baseline-${baseline.value}`}
                    disabled={baseline.disabled}
                  />
                  <Label htmlFor={`doc-baseline-${baseline.value}`} className={baseline.disabled ? 'cursor-not-allowed' : 'cursor-pointer'}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{baseline.label}</span>
                      {baseline.disabled && <Badge variant="outline">Coming soon</Badge>}
                      <TooltipProvider delayDuration={120}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              aria-label={`Explain ${baseline.label}`}
                              className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                              onClick={(event) => event.preventDefault()}
                            >
                              <Info className="h-3.5 w-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                            {baseline.helpText}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="text-sm text-muted-foreground">{baseline.description}</div>
                  </Label>
                </div>
              </div>
            ))}
          </RadioGroup>

          <Alert className="border-emerald-500/15 bg-emerald-500/5">
            <Info className="h-4 w-4 text-emerald-600" />
            <AlertTitle>How DRCS will treat the selected baseline</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>{baselineGuide.summary}</p>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Expected scenario fields</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {baselineGuide.expectedFields.map((field) => (
                    <Badge key={field} variant="outline" className="font-mono text-[11px]">
                      {field}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-border/70 bg-background/80 px-3 py-2">
                <p className="text-sm">{baselineGuide.validationNote}</p>
              </div>
            </AlertDescription>
          </Alert>

          {hasDocumentBaselineMismatch && (
            <Alert className="border-amber-500/20 bg-amber-500/5">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertTitle>Uploaded invoice types do not match the declared baseline</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>
                  You selected <code>{selectedDocumentBaseline}</code>, but the uploaded file contains invoice type value(s):{' '}
                  <strong>{observedInvoiceTypes.join(', ')}</strong>.
                </p>
                <p>
                  Switch to <strong>Mixed / Detect From Source</strong> if this file intentionally contains more than one scenario.
                </p>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Dataset Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5">
            <Database className="h-5 w-5 shrink-0" />
            <span>Dataset Type</span>
            <TooltipProvider delayDuration={120}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="Explain dataset type choices"
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border/70 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-sm text-xs leading-relaxed">
                  <div className="space-y-2">
                    <p className="font-medium text-foreground">Choose the structure that matches your source extract:</p>
                    <ul className="space-y-1">
                      <li><strong>Invoice Headers</strong>: one row per invoice, including invoice number, dates, totals, and currency.</li>
                      <li><strong>Invoice Lines</strong>: one row per line item, including quantities, unit price, VAT, and line totals.</li>
                      <li><strong>Party Data</strong>: buyer or supplier master data such as legal name, TRN, and address.</li>
                      <li><strong>Combined Export</strong>: one flat file containing repeated header fields alongside line rows.</li>
                    </ul>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
          <CardDescription>
            Select the type of data you're uploading to help with field mapping suggestions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>
              Use the overview <span className="font-medium text-foreground">i</span> beside the section title for the quick file-type guide, or the
              smaller <span className="font-medium text-foreground">i</span> beside each option for field-specific examples.
            </p>
          </div>
          <RadioGroup 
            value={selectedDatasetType} 
            onValueChange={(v) => handleDatasetTypeChange(v as DatasetType)}
            className="grid grid-cols-2 gap-4"
          >
            {DATASET_TYPES.map(type => (
              <div key={type.value} className="flex items-start space-x-3">
                <RadioGroupItem value={type.value} id={type.value} />
                <Label htmlFor={type.value} className="cursor-pointer">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{type.label}</span>
                    <TooltipProvider delayDuration={120}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            aria-label={`Explain ${type.label}`}
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                            onClick={(event) => event.preventDefault()}
                          >
                            <Info className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                          {type.helpText}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="text-sm text-muted-foreground">{type.description}</div>
                </Label>
              </div>
            ))}
          </RadioGroup>
          <Alert className="mt-5 border-primary/15 bg-primary/5">
            <Info className="h-4 w-4 text-primary" />
            <AlertTitle>How DRCS will route this file: {routingGuide.label}</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>{routingGuide.summary}</p>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Expected field examples</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {routingGuide.expectedFields.map((field) => (
                    <Badge key={field} variant="outline" className="font-mono text-[11px]">
                      {field}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-border/70 bg-background/80 px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Invoice number example</p>
                <p className="mt-1 text-sm">{routingGuide.invoiceNumberRule}</p>
              </div>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5">
            <FileSpreadsheet className="h-5 w-5 shrink-0" />
            Built-in Template Files
          </CardTitle>
          <CardDescription>
            Load canonical DRCS sample data into the wizard or download a blank CSV structure for offline population.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {builtInTemplates.map((template) => {
            const sample = getSampleData(template.sampleType, 'positive', direction);
            const blankTemplate = buildBlankTemplateExport(template.sampleType, direction);
            return (
              <div
                key={`${selectedDatasetType}-${template.sampleType}`}
                className="grid gap-4 rounded-lg border border-dashed p-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center"
              >
                <div className="min-w-0 space-y-2">
                  <div className="space-y-2">
                    <p className="font-medium">{template.title}</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="max-w-full whitespace-normal break-all text-left">
                        Sample: {sample.filename}
                      </Badge>
                      <Badge variant="secondary" className="max-w-full whitespace-normal break-all text-left">
                        Blank: {blankTemplate.filename}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{template.description}</p>
                  <p className="max-w-[70ch] text-xs text-muted-foreground">
                    Loading inserts illustrative rows for mapping practice. Downloading gives you headers only.
                  </p>
                </div>
                <div className="flex flex-col gap-2 lg:items-stretch">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleDownloadBuiltInTemplate(template.sampleType)}
                    disabled={isLoading}
                    className="h-12 w-full justify-center gap-2.5"
                  >
                    <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
                      <Download className="h-4 w-4" />
                    </span>
                    Download blank template
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleLoadBuiltInTemplate(template.sampleType, template.wizardDatasetType)}
                    disabled={isLoading}
                    className="h-12 w-full justify-center gap-2.5"
                  >
                    Load sample data
                  </Button>
                </div>
              </div>
            );
          })}
          {selectedDatasetType === 'combined' && (
            <p className="text-xs text-muted-foreground">
              Combined export mode does not ship with a single canonical sample file, so the split party/header/line templates are shown instead.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Upload Area */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2.5">
                <Upload className="h-5 w-5 shrink-0" />
                Upload ERP Extract
              </CardTitle>
              <CardDescription>
                Upload a sample CSV file from your ERP system. We'll analyze the columns and suggest mappings to PINT-AE fields.
              </CardDescription>
            </div>
            {previewData && (
              <Button type="button" variant="outline" size="sm" onClick={handleReupload}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Re-upload file
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
            }`}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
          >
            <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium mb-2">
              {isDragging ? 'Drop your file here' : 'Drag and drop your ERP extract'}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Supports CSV and Excel files (`.csv`, `.txt`, `.xlsx`, `.xls`). Maximum 10MB.
            </p>
            <input
              type="file"
              accept=".csv,.txt,.xlsx,.xls"
              className="hidden"
              id="erp-file-input"
              ref={fileInputRef}
              onChange={handleFileInput}
            />
            <Button asChild variant="outline" disabled={isLoading}>
              <label htmlFor="erp-file-input" className="cursor-pointer">
                {isLoading ? 'Processing...' : 'Browse Files'}
              </label>
            </Button>
          </div>

          {error && (
            <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Column Analysis */}
      {previewData && previewData.detectedColumns && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Column Analysis</span>
              <Badge variant="secondary">
                {previewData.detectedColumns.length} columns detected
              </Badge>
            </CardTitle>
            <CardDescription>
              Detected data types and sample values for each column
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-auto max-h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Column Name</TableHead>
                    <TableHead className="w-[100px]">Type</TableHead>
                    <TableHead className="w-[80px] text-center">Unique</TableHead>
                    <TableHead className="w-[80px] text-center">Nulls</TableHead>
                    <TableHead>Sample Values</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.detectedColumns.map((col, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-mono text-sm">{col.name}</TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className="gap-1 cursor-help">
                                {getTypeIcon(col.detectedType)}
                                {col.detectedType}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Detected type based on sample values</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-center text-sm">{col.uniqueCount}</TableCell>
                      <TableCell className="text-center text-sm">
                        {col.nullCount > 0 ? (
                          <span className="text-yellow-600">{col.nullCount}</span>
                        ) : (
                          <span className="text-green-600">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {col.sampleValues.filter(Boolean).slice(0, 3).join(', ') || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Preview */}
      {previewData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Data Preview</span>
              <span className="text-sm font-normal text-muted-foreground">
                {previewData.fileName} • {previewData.columns.length} columns • {previewData.totalRows} rows
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-auto max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 sticky left-0 bg-background">#</TableHead>
                    {previewData.columns.map((col, i) => (
                      <TableHead key={i} className="min-w-[120px]">
                        {col}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.rows.slice(0, 50).map((row, rowIdx) => (
                    <TableRow key={rowIdx}>
                      <TableCell className="sticky left-0 bg-background font-medium">
                        {rowIdx + 1}
                      </TableCell>
                      {previewData.columns.map((col, colIdx) => (
                        <TableCell key={colIdx} className="max-w-[200px] truncate">
                          {row[col] || '-'}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {previewData.totalRows > 50 && (
              <p className="text-sm text-muted-foreground mt-2 text-center">
                Showing 50 of {previewData.totalRows} rows
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
