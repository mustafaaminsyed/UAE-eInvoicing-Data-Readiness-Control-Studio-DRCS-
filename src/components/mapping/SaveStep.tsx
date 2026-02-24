import React, { useState, useMemo } from 'react';
import { Save, FileText, Building, Hash, Tag, Settings, Play, AlertCircle, Check, X, Trash2, Plus, Shield, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  FieldMapping, 
  MappingTemplate, 
  Transformation, 
  TransformationType,
  ERPPreviewData,
  ERP_TYPES,
  DOCUMENT_TYPES 
} from '@/types/fieldMapping';
import { saveMappingTemplate } from '@/lib/api/mappingApi';
import { applyTransformations } from '@/lib/mapping/transformationEngine';
import { analyzeCoverage } from '@/lib/mapping/coverageAnalyzer';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Direction } from '@/types/direction';

interface SaveStepProps {
  mappings: FieldMapping[];
  previewData: ERPPreviewData | null;
  direction: Direction;
  onMappingsChange: (mappings: FieldMapping[]) => void;
  onTemplateSaved: (templateId: string, name?: string, isActive?: boolean) => void;
}

const TRANSFORMATION_TYPES: { value: TransformationType; label: string; description: string }[] = [
  { value: 'trim', label: 'Trim', description: 'Remove leading/trailing whitespace' },
  { value: 'uppercase', label: 'Uppercase', description: 'Convert to uppercase' },
  { value: 'lowercase', label: 'Lowercase', description: 'Convert to lowercase' },
  { value: 'date_parse', label: 'Date Parse', description: 'Parse date with format' },
  { value: 'static_value', label: 'Static Value', description: 'Use a fixed value' },
  { value: 'combine', label: 'Combine Columns', description: 'Combine multiple columns' },
  { value: 'lookup', label: 'Lookup Table', description: 'Map values using a lookup' },
];

export function SaveStep({ mappings, previewData, direction, onMappingsChange, onTemplateSaved }: SaveStepProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, any>[] | null>(null);
  const [testErrors, setTestErrors] = useState<{ field: string; error: string }[]>([]);
  const [editingMappingId, setEditingMappingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    templateName: '',
    description: '',
    clientName: '',
    tenantId: '',
    legalEntity: '',
    sellerTrn: '',
    erpType: '',
    documentType: 'UC1 Standard Tax Invoice',
    effectiveDate: '',
    notes: '',
  });

  const confirmedMappings = mappings.filter(m => m.isConfirmed);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Add transformation to a mapping
  const handleAddTransformation = (mappingId: string, type: TransformationType) => {
    const updated = mappings.map(m => {
      if (m.id !== mappingId) return m;
      const newTransform: Transformation = { type, config: {} };
      
      // Set default config based on type
      if (type === 'date_parse') {
        newTransform.config = { inputFormat: 'DD/MM/YYYY', outputFormat: 'YYYY-MM-DD' };
      } else if (type === 'static_value') {
        newTransform.config = { value: '' };
      } else if (type === 'combine') {
        newTransform.config = { columns: [], separator: ' ' };
      } else if (type === 'lookup') {
        newTransform.config = { mappings: {} };
      }
      
      return { ...m, transformations: [...m.transformations, newTransform] };
    });
    onMappingsChange(updated);
  };

  // Update transformation config
  const handleUpdateTransformConfig = (mappingId: string, transformIndex: number, config: Record<string, any>) => {
    const updated = mappings.map(m => {
      if (m.id !== mappingId) return m;
      const newTransforms = [...m.transformations];
      newTransforms[transformIndex] = { ...newTransforms[transformIndex], config };
      return { ...m, transformations: newTransforms };
    });
    onMappingsChange(updated);
  };

  // Remove transformation
  const handleRemoveTransformation = (mappingId: string, transformIndex: number) => {
    const updated = mappings.map(m => {
      if (m.id !== mappingId) return m;
      return { 
        ...m, 
        transformations: m.transformations.filter((_, i) => i !== transformIndex) 
      };
    });
    onMappingsChange(updated);
  };

  // Test mapping
  const handleTestMapping = () => {
    if (!previewData) return;
    
    setIsTesting(true);
    setTestErrors([]);
    
    try {
      const results: Record<string, any>[] = [];
      const errors: { field: string; error: string }[] = [];
      
      // Transform first 5 rows
      for (let i = 0; i < Math.min(5, previewData.rows.length); i++) {
        const row = previewData.rows[i];
        const transformed: Record<string, any> = {};
        
        for (const mapping of confirmedMappings) {
          try {
            const originalValue = row[mapping.erpColumn] || '';
            const transformedValue = applyTransformations(originalValue, mapping.transformations, row);
            transformed[mapping.targetField.id] = transformedValue;
          } catch (err: any) {
            if (i === 0) {
              errors.push({
                field: mapping.targetField.name,
                error: err.message || 'Transformation failed'
              });
            }
            transformed[mapping.targetField.id] = `ERROR: ${err.message}`;
          }
        }
        
        results.push(transformed);
      }
      
      setTestResults(results);
      setTestErrors(errors);
      
      if (errors.length === 0) {
        toast({ title: 'Test successful', description: 'All transformations applied correctly.' });
      } else {
        toast({ title: 'Test completed with errors', description: `${errors.length} transformation error(s)`, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Test failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsTesting(false);
    }
  };

  const coverage = useMemo(() => analyzeCoverage(confirmedMappings), [confirmedMappings]);
  const hasBlockingGaps = coverage.unmappedMandatory.length > 0;

  const handleSave = async (activate: boolean = false) => {
    if (!formData.templateName.trim()) {
      toast({
        title: 'Template name required',
        description: 'Please enter a name for this mapping template.',
        variant: 'destructive',
      });
      return;
    }

    if (confirmedMappings.length === 0) {
      toast({
        title: 'No confirmed mappings',
        description: 'Please confirm at least one field mapping before saving.',
        variant: 'destructive',
      });
      return;
    }

    if (activate && hasBlockingGaps) {
      toast({
        title: 'Cannot activate with blocking gaps',
        description: `${coverage.unmappedMandatory.length} mandatory field(s) are unmapped. Fix gaps before approving.`,
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    const template: MappingTemplate = {
      templateName: formData.templateName,
      description: formData.description || undefined,
      clientName: formData.clientName || undefined,
      tenantId: formData.tenantId || undefined,
      legalEntity: formData.legalEntity || undefined,
      sellerTrn: formData.sellerTrn || undefined,
      erpType: formData.erpType || undefined,
      documentType: formData.documentType,
      version: 1,
      isActive: activate,
      mappings: confirmedMappings,
      effectiveDate: formData.effectiveDate || undefined,
      notes: formData.notes || undefined,
      direction,
    };

    const templateId = await saveMappingTemplate(template, direction);

    setIsSaving(false);

    if (templateId) {
      toast({
        title: activate ? 'Template approved & activated' : 'Draft saved',
        description: `Mapping template "${formData.templateName}" has been ${activate ? 'activated' : 'saved as draft'}.`,
      });
      onTemplateSaved(templateId, formData.templateName, activate);
    } else {
      toast({
        title: 'Save failed',
        description: 'Failed to save the mapping template. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Transformations Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Field Transformations
          </CardTitle>
          <CardDescription>
            Configure transformations to clean and format your data before validation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-auto max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px]">ERP Column</TableHead>
                  <TableHead className="w-[150px]">PINT-AE Field</TableHead>
                  <TableHead>Transformations</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {confirmedMappings.map((mapping) => (
                  <TableRow key={mapping.id}>
                    <TableCell className="font-mono text-sm">{mapping.erpColumn}</TableCell>
                    <TableCell>{mapping.targetField.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {mapping.transformations.length === 0 ? (
                          <span className="text-sm text-muted-foreground">No transformations</span>
                        ) : (
                          mapping.transformations.map((t, idx) => (
                            <Badge key={idx} variant="secondary" className="gap-1">
                              {t.type}
                              <button onClick={() => handleRemoveTransformation(mapping.id, idx)}>
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" onClick={() => setEditingMappingId(mapping.id)}>
                            <Plus className="h-3 w-3 mr-1" />
                            Add
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add Transformation</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            {TRANSFORMATION_TYPES.map(t => (
                              <button
                                key={t.value}
                                className="w-full p-4 text-left border rounded-lg hover:bg-muted/50 transition-colors"
                                onClick={() => {
                                  handleAddTransformation(mapping.id, t.value);
                                }}
                              >
                                <div className="font-medium">{t.label}</div>
                                <div className="text-sm text-muted-foreground">{t.description}</div>
                              </button>
                            ))}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Test Mapping Button */}
          <div className="mt-4 flex items-center gap-4">
            <Button 
              variant="outline" 
              onClick={handleTestMapping} 
              disabled={isTesting || !previewData || confirmedMappings.length === 0}
            >
              <Play className="h-4 w-4 mr-2" />
              {isTesting ? 'Testing...' : 'Test Mapping'}
            </Button>
            {testErrors.length > 0 && (
              <div className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {testErrors.length} error(s)
              </div>
            )}
          </div>

          {/* Test Results */}
          {testResults && (
            <Collapsible defaultOpen className="mt-4">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-start">
                  Test Results Preview ({testResults.length} rows)
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="border rounded-lg p-4 bg-muted/30 mt-2 overflow-auto max-h-[300px]">
                  <pre className="text-xs">
                    {JSON.stringify(testResults, null, 2)}
                  </pre>
                </div>
                {testErrors.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {testErrors.map((err, idx) => (
                      <div key={idx} className="text-sm text-destructive flex items-center gap-2">
                        <X className="h-3 w-3" />
                        {err.field}: {err.error}
                      </div>
                    ))}
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          )}
        </CardContent>
      </Card>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Mapping Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div>
              <div className="text-3xl font-bold text-green-600">{confirmedMappings.length}</div>
              <div className="text-sm text-muted-foreground">Confirmed Mappings</div>
            </div>
            <div className="h-12 w-px bg-border" />
            <div className="flex flex-wrap gap-2">
              {confirmedMappings.slice(0, 8).map(m => (
                <Badge key={m.id} variant="secondary" className="text-xs">
                  {m.erpColumn} → {m.targetField.name}
                </Badge>
              ))}
              {confirmedMappings.length > 8 && (
                <Badge variant="outline">+{confirmedMappings.length - 8} more</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Template Metadata Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Save className="h-5 w-5" />
            Template Details
          </CardTitle>
          <CardDescription>
            Save this mapping configuration as a reusable template for future data imports.
          </CardDescription>
          <div className="pt-1">
            <Badge variant="outline">Direction: {direction}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Template Name (Required) */}
            <div className="col-span-2">
              <Label htmlFor="templateName" className="flex items-center gap-1">
                Template Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="templateName"
                placeholder="e.g., ACME Corp SAP Export Mapping v1"
                value={formData.templateName}
                onChange={(e) => handleChange('templateName', e.target.value)}
                className="mt-1"
              />
            </div>

            {/* Description */}
            <div className="col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Optional notes about this mapping template..."
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                className="mt-1"
                rows={3}
              />
            </div>

            {/* Client / Tenant */}
            <div>
              <Label htmlFor="clientName" className="flex items-center gap-1">
                <Building className="h-3 w-3" /> Client Name
              </Label>
              <Input
                id="clientName"
                placeholder="e.g., ACME Corporation"
                value={formData.clientName}
                onChange={(e) => handleChange('clientName', e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="tenantId" className="flex items-center gap-1">
                <Hash className="h-3 w-3" /> Tenant ID
              </Label>
              <Input
                id="tenantId"
                placeholder="e.g., ACME-001"
                value={formData.tenantId}
                onChange={(e) => handleChange('tenantId', e.target.value)}
                className="mt-1"
              />
            </div>

            {/* Legal Entity / Seller TRN */}
            <div>
              <Label htmlFor="legalEntity">Legal Entity</Label>
              <Input
                id="legalEntity"
                placeholder="e.g., ACME Trading LLC"
                value={formData.legalEntity}
                onChange={(e) => handleChange('legalEntity', e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="sellerTrn">Seller TRN</Label>
              <Input
                id="sellerTrn"
                placeholder="e.g., 100012345678901"
                value={formData.sellerTrn}
                onChange={(e) => handleChange('sellerTrn', e.target.value)}
                className="mt-1"
                maxLength={15}
              />
            </div>

            {/* ERP Type / Document Type */}
            <div>
              <Label htmlFor="erpType" className="flex items-center gap-1">
                <Tag className="h-3 w-3" /> ERP Type
              </Label>
              <Select value={formData.erpType} onValueChange={(v) => handleChange('erpType', v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select ERP system" />
                </SelectTrigger>
                <SelectContent>
                  {ERP_TYPES.map(erp => (
                    <SelectItem key={erp} value={erp}>{erp}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="documentType">Document Type</Label>
              <Select value={formData.documentType} onValueChange={(v) => handleChange('documentType', v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map(dt => (
                    <SelectItem key={dt} value={dt}>{dt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Effective Date / Notes */}
            <div>
              <Label htmlFor="effectiveDate">Effective Date</Label>
              <Input
                id="effectiveDate"
                type="date"
                value={formData.effectiveDate}
                onChange={(e) => handleChange('effectiveDate', e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                placeholder="Additional notes..."
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          {hasBlockingGaps && (
            <Alert className="bg-amber-500/10 border-amber-500/30">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-700 text-sm">
                {coverage.unmappedMandatory.length} mandatory field(s) unmapped. "Approve & Activate" requires full mandatory coverage.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => handleSave(false)} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save as Draft'}
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button 
                      onClick={() => handleSave(true)} 
                      disabled={isSaving || hasBlockingGaps} 
                      size="lg"
                    >
                      <Shield className="h-4 w-4 mr-2" />
                      {isSaving ? 'Saving...' : 'Approve & Activate'}
                    </Button>
                  </span>
                </TooltipTrigger>
                {hasBlockingGaps && (
                  <TooltipContent>
                    <p>Fix all mandatory mapping gaps before activating</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
