import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowRight, Check, X, Search, Wand2, ChevronDown, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  DatasetType,
  FieldMapping, 
  ERPPreviewData, 
  getPintFieldById,
  normalizeFieldMappings,
} from '@/types/fieldMapping';
import { 
  generateMappingSuggestions, 
  suggestionsToMappings,
  getAvailableTargetFields 
} from '@/lib/mapping/mappingSuggester';
import { detectLikelyDatasetType, getDatasetTypeLabel } from '@/lib/mapping/datasetFieldCatalog';

interface MappingStepProps {
  previewData: ERPPreviewData;
  mappings: FieldMapping[];
  onMappingsChange: (mappings: FieldMapping[]) => void;
  onDatasetTypeChange?: (datasetType: DatasetType) => void;
}

export function MappingStep({
  previewData,
  mappings,
  onMappingsChange,
  onDatasetTypeChange,
}: MappingStepProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyPending, setShowOnlyPending] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  // Generate suggestions when data changes
  const handleGenerateSuggestions = useCallback(() => {
    setIsGenerating(true);
    setTimeout(() => {
      const newSuggestions = generateMappingSuggestions(previewData.columns, previewData.rows, previewData.datasetType);
      const newMappings = suggestionsToMappings(newSuggestions);
      onMappingsChange(normalizeFieldMappings(newMappings));
      setIsGenerating(false);
    }, 500);
  }, [previewData.columns, previewData.datasetType, previewData.rows, onMappingsChange]);

  useEffect(() => {
    if (mappings.length === 0) {
      handleGenerateSuggestions();
    }
  }, [mappings.length, handleGenerateSuggestions]);

  const handleConfirmMapping = (mappingId: string) => {
    const updated = mappings.map(m => 
      m.id === mappingId ? { ...m, isConfirmed: true } : m
    );
    onMappingsChange(normalizeFieldMappings(updated));
  };

  const handleRejectMapping = (mappingId: string) => {
    const updated = mappings.filter(m => m.id !== mappingId);
    onMappingsChange(normalizeFieldMappings(updated));
  };

  const handleChangeTargetField = (mappingId: string, targetFieldId: string) => {
    // Check for duplicates
    const existingMapping = mappings.find(m => 
      m.id !== mappingId && m.targetField.id === targetFieldId
    );
    
    if (existingMapping) {
      setDuplicateError(`"${getPintFieldById(targetFieldId)?.name}" is already mapped to "${existingMapping.erpColumn}"`);
      setTimeout(() => setDuplicateError(null), 5000);
      return;
    }

    const targetField = getPintFieldById(targetFieldId);
    if (!targetField) return;

    const updated = mappings.map(m => 
      m.id === mappingId ? { ...m, targetField, isConfirmed: true } : m
    );
    onMappingsChange(normalizeFieldMappings(updated));
  };

  const handleAddManualMapping = (erpColumn: string, targetFieldId: string) => {
    // Check for duplicates
    const existingMapping = mappings.find(m => m.targetField.id === targetFieldId);
    if (existingMapping) {
      setDuplicateError(`"${getPintFieldById(targetFieldId)?.name}" is already mapped to "${existingMapping.erpColumn}"`);
      setTimeout(() => setDuplicateError(null), 5000);
      return;
    }

    const targetField = getPintFieldById(targetFieldId);
    if (!targetField) return;

    const colIndex = previewData.columns.indexOf(erpColumn);
    const sampleValues = previewData.rows.slice(0, 5).map(r => r[erpColumn] || '');

    const newMapping: FieldMapping = {
      id: `mapping-${Date.now()}`,
      erpColumn,
      erpColumnIndex: colIndex,
      targetField,
      confidence: 1,
      isConfirmed: true,
      transformations: [],
      sampleValues,
    };

    onMappingsChange(normalizeFieldMappings([...mappings, newMapping]));
  };

  const handleBulkAcceptHighConfidence = () => {
    const updated = mappings.map(m => ({
      ...m,
      isConfirmed: m.confidence >= 0.85 ? true : m.isConfirmed,
    }));
    onMappingsChange(normalizeFieldMappings(updated));
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.9) return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">High ({Math.round(confidence * 100)}%)</Badge>;
    if (confidence >= 0.7) return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Medium ({Math.round(confidence * 100)}%)</Badge>;
    return <Badge variant="outline" className="text-orange-500 border-orange-500/30">Low ({Math.round(confidence * 100)}%)</Badge>;
  };

  const availableTargetFields = useMemo(
    () => getAvailableTargetFields(mappings, previewData.datasetType),
    [mappings, previewData.datasetType]
  );
  const unmappedColumns = useMemo(() => {
    const mappedColumns = new Set(mappings.map(m => m.erpColumn));
    return previewData.columns.filter(c => !mappedColumns.has(c));
  }, [mappings, previewData.columns]);

  const filteredMappings = useMemo(() => {
    return mappings.filter(m => {
      const matchesSearch = !searchTerm || 
        m.erpColumn.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.targetField.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPending = !showOnlyPending || !m.isConfirmed;
      return matchesSearch && matchesPending;
    });
  }, [mappings, searchTerm, showOnlyPending]);

  const confirmedCount = mappings.filter(m => m.isConfirmed).length;
  const pendingCount = mappings.filter(m => !m.isConfirmed).length;
  const highConfidenceUnconfirmed = mappings.filter(m => m.confidence >= 0.85 && !m.isConfirmed).length;
  const recommendedDatasetType = useMemo(() => detectLikelyDatasetType(previewData.columns), [previewData.columns]);
  const shouldSuggestDatasetTypeChange =
    recommendedDatasetType !== null && recommendedDatasetType !== previewData.datasetType;

  const renderTargetFieldSummary = (fieldId: string) => {
    const field = getPintFieldById(fieldId);
    if (!field) return null;

    return (
      <div className="flex min-w-0 items-center gap-2 pr-2">
        {field.isMandatory && (
          <Badge variant="destructive" className="h-5 shrink-0 rounded-full px-1.5 text-[10px] leading-none">
            REQ
          </Badge>
        )}
        <div className="min-w-0 flex flex-1 items-center gap-2">
          <span className="truncate text-sm font-medium leading-5">{field.name}</span>
          <span className="shrink-0 text-[11px] text-muted-foreground">{field.ibtReference}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Duplicate Error Alert */}
      {duplicateError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{duplicateError}</AlertDescription>
        </Alert>
      )}

      {shouldSuggestDatasetTypeChange && (
        <Alert className="border-amber-500/30 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-amber-100">
              This file looks closer to <strong>{getDatasetTypeLabel(recommendedDatasetType)}</strong>, but the wizard
              is currently set to <strong>{getDatasetTypeLabel(previewData.datasetType)}</strong>. That can cause poor
              suggestions like buyer columns mapping to seller fields.
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-amber-400/40 bg-transparent text-amber-100 hover:bg-amber-500/10 hover:text-amber-50"
              onClick={() => recommendedDatasetType && onDatasetTypeChange?.(recommendedDatasetType)}
            >
              Use {getDatasetTypeLabel(recommendedDatasetType)}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{previewData.columns.length}</div>
            <div className="text-sm text-muted-foreground">ERP Columns</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">{confirmedCount}</div>
            <div className="text-sm text-muted-foreground">Confirmed</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
            <div className="text-sm text-muted-foreground">Pending Review</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-muted-foreground">{unmappedColumns.length}</div>
            <div className="text-sm text-muted-foreground">Unmapped</div>
          </CardContent>
        </Card>
      </div>

      {/* Actions Bar */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-4 flex-wrap">
            <Button onClick={handleGenerateSuggestions} disabled={isGenerating} variant="outline">
              <Wand2 className="h-4 w-4 mr-2" />
              {isGenerating ? 'Analyzing...' : 'Re-analyze Columns'}
            </Button>
            {highConfidenceUnconfirmed > 0 && (
              <Button onClick={handleBulkAcceptHighConfidence} variant="default">
                <Check className="h-4 w-4 mr-2" />
                Accept {highConfidenceUnconfirmed} High-Confidence
              </Button>
            )}
            <div className="flex-1" />
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search columns or fields..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox 
                checked={showOnlyPending} 
                onCheckedChange={(c) => setShowOnlyPending(c === true)} 
              />
              Show pending only
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Mappings Table */}
      <Card>
        <CardHeader>
          <CardTitle>Field Mappings</CardTitle>
          <CardDescription>
            Review and confirm the suggested mappings. Each PINT-AE field can only be mapped once.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-auto max-h-[560px]">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-[200px]">ERP Column</TableHead>
                  <TableHead className="w-12 text-center">-&gt;</TableHead>
                  <TableHead className="w-[320px]">PINT-AE Field</TableHead>
                  <TableHead className="w-[120px]">Confidence</TableHead>
                  <TableHead className="w-[240px]">Sample Values</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[110px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMappings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {mappings.length === 0 ? 'No mappings yet. Upload data to start.' : 'No matching mappings'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMappings.map((mapping) => (
                    <TableRow key={mapping.id} className="hover:bg-white/5">
                      <TableCell className="align-middle font-mono text-sm">{mapping.erpColumn}</TableCell>
                      <TableCell className="align-middle text-center">
                        <ArrowRight className="h-4 w-4 mx-auto text-muted-foreground" />
                      </TableCell>
                      <TableCell className="align-middle">
                        <Select
                          value={mapping.targetField.id}
                          onValueChange={(v) => handleChangeTargetField(mapping.id, v)}
                        >
                          <SelectTrigger className="h-10 w-full bg-background/70 text-left">
                            {renderTargetFieldSummary(mapping.targetField.id)}
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={mapping.targetField.id}>
                              {renderTargetFieldSummary(mapping.targetField.id)}
                            </SelectItem>
                            {availableTargetFields.map(f => (
                              <SelectItem key={f.id} value={f.id}>
                                {renderTargetFieldSummary(f.id)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="align-middle">{getConfidenceBadge(mapping.confidence)}</TableCell>
                      <TableCell className="align-middle max-w-[240px] text-xs text-muted-foreground">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="truncate block cursor-help">
                                {mapping.sampleValues.slice(0, 3).filter(Boolean).join(', ') || '-'}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-xs">
                              <p className="text-xs">{mapping.sampleValues.slice(0, 5).join(', ')}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="align-middle">
                        {mapping.isConfirmed ? (
                          <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Confirmed</Badge>
                        ) : (
                          <Badge variant="outline">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell className="align-middle">
                        <div className="flex items-center gap-1">
                          {!mapping.isConfirmed && (
                            <Button size="sm" variant="ghost" className="h-8 w-8 px-0" onClick={() => handleConfirmMapping(mapping.id)}>
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-8 w-8 px-0" onClick={() => handleRejectMapping(mapping.id)}>
                            <X className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Unmapped Columns */}
      {unmappedColumns.length > 0 && (
        <Collapsible defaultOpen={unmappedColumns.length <= 10}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50">
                <CardTitle className="flex items-center gap-2">
                  <ChevronDown className="h-4 w-4" />
                  Unmapped ERP Columns ({unmappedColumns.length})
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <div className="grid grid-cols-1 gap-3">
                  {unmappedColumns.map(col => {
                    const sampleValues = previewData.rows.slice(0, 3).map(r => r[col] || '').join(', ');
                    return (
                      <div key={col} className="flex items-center gap-4 p-3 border rounded-lg bg-background/30">
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-sm truncate">{col}</div>
                          <div className="text-xs text-muted-foreground truncate">{sampleValues || 'No values'}</div>
                        </div>
                        <Select onValueChange={(v) => handleAddManualMapping(col, v)}>
                          <SelectTrigger className="w-[280px] bg-background/70">
                            <SelectValue placeholder="Map to..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableTargetFields.map(f => (
                              <SelectItem key={f.id} value={f.id}>
                                <div className="flex items-center gap-1">
                                  {f.isMandatory && <span className="text-red-500">*</span>}
                                  {f.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}
    </div>
  );
}
