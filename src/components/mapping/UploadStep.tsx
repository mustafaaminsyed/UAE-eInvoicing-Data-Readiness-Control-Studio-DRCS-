import React, { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, Database, Calendar, Hash, Type, HelpCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ERPPreviewData, DatasetType, DetectedColumn } from '@/types/fieldMapping';
import { parseCSV } from '@/lib/csvParser';

interface UploadStepProps {
  onDataLoaded: (data: ERPPreviewData) => void;
  previewData: ERPPreviewData | null;
}

const DATASET_TYPES: { value: DatasetType; label: string; description: string }[] = [
  { value: 'header', label: 'Invoice Headers', description: 'One row per invoice with header-level data' },
  { value: 'lines', label: 'Invoice Lines', description: 'One row per line item with line-level data' },
  { value: 'parties', label: 'Party Data', description: 'Seller/buyer party information' },
  { value: 'combined', label: 'Combined Export', description: 'Headers and lines in a single extract' },
];

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

export function UploadStep({ onDataLoaded, previewData }: UploadStepProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDatasetType, setSelectedDatasetType] = useState<DatasetType>('combined');

  const processFile = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);

    try {
      const text = await file.text();
      const rows = parseCSV(text);
      
      if (rows.length === 0) {
        setError('File appears to be empty or invalid');
        return;
      }

      const columns = Object.keys(rows[0]);
      
      // Detect column types and gather stats
      const detectedColumns: DetectedColumn[] = columns.map((col, index) => {
        const values = rows.slice(0, 100).map(r => r[col] || '');
        const nonEmpty = values.filter(v => v && v.trim() !== '');
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
      
      onDataLoaded({
        fileName: file.name,
        columns,
        detectedColumns,
        rows: rows.slice(0, 100), // Preview first 100 rows
        totalRows: rows.length,
        datasetType: selectedDatasetType,
      });
    } catch (err) {
      console.error('Error parsing file:', err);
      setError('Failed to parse file. Please ensure it is a valid CSV.');
    } finally {
      setIsLoading(false);
    }
  }, [onDataLoaded, selectedDatasetType]);

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

  const handleDatasetTypeChange = (value: DatasetType) => {
    setSelectedDatasetType(value);
    if (previewData) {
      onDataLoaded({
        ...previewData,
        datasetType: value,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Dataset Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Dataset Type
          </CardTitle>
          <CardDescription>
            Select the type of data you're uploading to help with field mapping suggestions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup 
            value={selectedDatasetType} 
            onValueChange={(v) => handleDatasetTypeChange(v as DatasetType)}
            className="grid grid-cols-2 gap-4"
          >
            {DATASET_TYPES.map(type => (
              <div key={type.value} className="flex items-start space-x-3">
                <RadioGroupItem value={type.value} id={type.value} />
                <Label htmlFor={type.value} className="cursor-pointer">
                  <div className="font-medium">{type.label}</div>
                  <div className="text-sm text-muted-foreground">{type.description}</div>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload ERP Extract
          </CardTitle>
          <CardDescription>
            Upload a sample CSV file from your ERP system. We'll analyze the columns and suggest mappings to PINT-AE fields.
          </CardDescription>
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
              Supports CSV files. Maximum 10MB.
            </p>
            <input
              type="file"
              accept=".csv,.txt"
              className="hidden"
              id="erp-file-input"
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
