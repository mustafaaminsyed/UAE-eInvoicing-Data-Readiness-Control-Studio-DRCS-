import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Plus, FileText, Search, Filter, Eye, Copy, Edit, Archive, MoreHorizontal, Shield, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MappingCoveragePanel } from '@/components/mapping/MappingCoveragePanel';
import { UploadStep } from '@/components/mapping/UploadStep';
import { MappingStep } from '@/components/mapping/MappingStep';
import { AnalysisStep } from '@/components/mapping/AnalysisStep';
import { SaveStep } from '@/components/mapping/SaveStep';
import { 
  ERPPreviewData, 
  FieldMapping, 
  MappingWizardStep, 
  MappingTemplate,
  ERP_TYPES,
  PINT_AE_UC1_FIELDS
} from '@/types/fieldMapping';
import { analyzeCoverage } from '@/lib/mapping/coverageAnalyzer';
import { fetchMappingTemplates, deleteMappingTemplate } from '@/lib/api/mappingApi';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { useCompliance } from '@/context/ComplianceContext';

const STEPS: { id: MappingWizardStep; label: string }[] = [
  { id: 'upload', label: 'Upload Sample' },
  { id: 'mapping', label: 'Map Fields' },
  { id: 'analysis', label: 'Coverage & Validation' },
  { id: 'save', label: 'Transformations & Save' },
];

export default function MappingPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { direction, setDirection, setActiveMappingProfileForDirection } = useCompliance();
  
  // Tab state
  const activeTab = searchParams.get('tab') || 'templates';
  
  // Template list state
  const [templates, setTemplates] = useState<MappingTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [templateSearch, setTemplateSearch] = useState('');
  const [erpTypeFilter, setErpTypeFilter] = useState<string>('all');
  const [docTypeFilter, setDocTypeFilter] = useState<string>('all');
  
  // Wizard state
  const [currentStep, setCurrentStep] = useState<MappingWizardStep>('upload');
  const [previewData, setPreviewData] = useState<ERPPreviewData | null>(null);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [conditionalAnswers, setConditionalAnswers] = useState<Record<string, boolean>>({});
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [templateStatus, setTemplateStatus] = useState<'draft' | 'active'>('draft');
  const [templateName, setTemplateName] = useState<string>('');
  const [showPostSaveCTA, setShowPostSaveCTA] = useState(false);

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);

  // Load templates
  const loadTemplates = useCallback(async () => {
    setIsLoadingTemplates(true);
    const data = await fetchMappingTemplates(direction);
    setTemplates(data);
    setIsLoadingTemplates(false);
  }, [direction]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleTabChange = (tab: string) => {
    setSearchParams({ tab });
    if (tab === 'create') {
      setCurrentStep('upload');
      setPreviewData(null);
      setMappings([]);
      setConditionalAnswers({});
      setEditingTemplateId(null);
      setLastSavedAt(null);
      setTemplateStatus('draft');
      setTemplateName('');
      setShowPostSaveCTA(false);
    }
  };

  // Template list filtering
  const filteredTemplates = templates.filter(t => {
    const matchesSearch = !templateSearch || 
      t.templateName.toLowerCase().includes(templateSearch.toLowerCase()) ||
      t.clientName?.toLowerCase().includes(templateSearch.toLowerCase()) ||
      t.sellerTrn?.includes(templateSearch);
    const matchesErp = erpTypeFilter === 'all' || t.erpType === erpTypeFilter;
    const matchesDoc = docTypeFilter === 'all' || t.documentType === docTypeFilter;
    return matchesSearch && matchesErp && matchesDoc;
  });

  // Template actions
  const handleViewTemplate = (template: MappingTemplate) => {
    setEditingTemplateId(template.id || null);
    setMappings(template.mappings);
    if (template.id) {
      setActiveMappingProfileForDirection(direction, {
        id: template.id,
        version: template.version,
      });
    }
    setSearchParams({ tab: 'create' });
    setCurrentStep('mapping');
  };

  const handleDuplicateTemplate = async (template: MappingTemplate) => {
    setMappings(template.mappings);
    setSearchParams({ tab: 'create' });
    setCurrentStep('save');
    toast({
      title: 'Template duplicated',
      description: 'Edit the details and save as a new template.',
    });
  };

  const handleArchiveTemplate = async (templateId: string) => {
    const success = await deleteMappingTemplate(templateId);
    if (success) {
      toast({ title: 'Template archived' });
      loadTemplates();
    } else {
      toast({ title: 'Failed to archive', variant: 'destructive' });
    }
  };

  // Wizard navigation
  const canGoNext = () => {
    switch (currentStep) {
      case 'upload': return !!previewData;
      case 'mapping': return mappings.some(m => m.isConfirmed);
      case 'analysis': return true;
      case 'save': return false;
      default: return false;
    }
  };

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) setCurrentStep(STEPS[nextIndex].id);
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) setCurrentStep(STEPS[prevIndex].id);
  };

  const handleTemplateSaved = (templateId: string, name?: string, isActive?: boolean) => {
    loadTemplates();
    setActiveMappingProfileForDirection(direction, { id: templateId, version: 1 });
    setLastSavedAt(new Date().toISOString());
    setTemplateStatus(isActive ? 'active' : 'draft');
    if (name) setTemplateName(name);
    setShowPostSaveCTA(true);
    toast({
      title: 'Template saved successfully',
      description: 'You can now use this template when running checks.',
    });
  };

  // Get unique values for filters
  const uniqueErpTypes = [...new Set(templates.map(t => t.erpType).filter(Boolean))];
  const uniqueDocTypes = [...new Set(templates.map(t => t.documentType))];

  return (
    <div className="min-h-screen">
      <div className="container mx-auto max-w-7xl px-6 py-8 md:py-10">
        {/* Profile Banner */}
        <div className="mb-6 flex items-center justify-between rounded-2xl border border-white/70 p-4 surface-glass">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="font-display text-2xl font-semibold">Field Mapping Assistant</h1>
              <p className="text-sm text-muted-foreground">ERP {'->'} PINT-AE Field Transformation Wizard</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={direction === 'AR' ? 'default' : 'outline'}
                onClick={() => setDirection('AR')}
              >
                Outbound (AR)
              </Button>
              <Button
                size="sm"
                variant={direction === 'AP' ? 'default' : 'outline'}
                onClick={() => setDirection('AP')}
              >
                Inbound (AP)
              </Button>
            </div>
            {activeTab === 'create' && (
              <div className="flex items-center gap-2 ml-4">
                <Badge variant={templateStatus === 'active' ? 'default' : 'secondary'}>
                  {templateStatus === 'active' ? 'Active' : templateName ? 'Draft' : 'New Draft'}
                </Badge>
                {templateName && <span className="text-sm font-medium">{templateName}</span>}
                {lastSavedAt && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Saved {format(new Date(lastSavedAt), 'HH:mm')}
                  </span>
                )}
              </div>
            )}
          </div>
          <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
            PINT-AE 2025-Q2 | UAE DR v1.0.1
          </Badge>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="mb-6 surface-glass border border-white/70">
            <TabsTrigger value="templates" className="gap-2">
              <FileText className="h-4 w-4" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="create" className="gap-2">
              <Plus className="h-4 w-4" />
              Create New
            </TabsTrigger>
          </TabsList>

          {/* Templates Tab */}
          <TabsContent value="templates">
            <Card className="surface-glass rounded-2xl border border-white/70">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Mapping Templates</CardTitle>
                    <CardDescription>Manage your saved field mapping configurations</CardDescription>
                  </div>
                  <Button onClick={() => handleTabChange('create')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Template
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Filters */}
                <div className="flex items-center gap-4 mb-6">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search templates..."
                      value={templateSearch}
                      onChange={(e) => setTemplateSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={erpTypeFilter} onValueChange={setErpTypeFilter}>
                    <SelectTrigger className="w-[180px]">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="ERP Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All ERP Types</SelectItem>
                      {uniqueErpTypes.map(erp => (
                        <SelectItem key={erp} value={erp!}>{erp}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={docTypeFilter} onValueChange={setDocTypeFilter}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Document Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Document Types</SelectItem>
                      {uniqueDocTypes.map(doc => (
                        <SelectItem key={doc} value={doc}>{doc}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Templates Table */}
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Template Name</TableHead>
                        <TableHead>ERP Type</TableHead>
                        <TableHead>Entity / TRN</TableHead>
                        <TableHead>Document Type</TableHead>
                        <TableHead className="text-center">Version</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingTemplates ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                            Loading templates...
                          </TableCell>
                        </TableRow>
                      ) : filteredTemplates.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8">
                            <div className="text-muted-foreground mb-4">
                              {templates.length === 0 ? 'No templates yet' : 'No matching templates'}
                            </div>
                            <Button variant="outline" onClick={() => handleTabChange('create')}>
                              <Plus className="h-4 w-4 mr-2" />
                              Create your first template
                            </Button>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredTemplates.map((template) => (
                          <TableRow key={template.id}>
                            <TableCell className="font-medium">{template.templateName}</TableCell>
                            <TableCell>
                              {template.erpType ? (
                                <Badge variant="outline">{template.erpType}</Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {template.legalEntity || template.clientName || '-'}
                              </div>
                              {template.sellerTrn && (
                                <div className="text-xs text-muted-foreground font-mono">
                                  TRN: {template.sellerTrn}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>{template.documentType}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary">v{template.version}</Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {template.updatedAt 
                                ? format(new Date(template.updatedAt), 'MMM d, yyyy')
                                : '-'
                              }
                            </TableCell>
                            <TableCell className="text-center">
                              {template.isActive ? (
                                <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                                  Active
                                </Badge>
                              ) : (
                                <Badge variant="secondary">Archived</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleViewTemplate(template)}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    View
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleDuplicateTemplate(template)}>
                                    <Copy className="h-4 w-4 mr-2" />
                                    Duplicate
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleViewTemplate(template)}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => template.id && handleArchiveTemplate(template.id)}
                                    className="text-destructive"
                                  >
                                    <Archive className="h-4 w-4 mr-2" />
                                    Archive
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Create New Tab (Wizard) */}
          <TabsContent value="create">
            {/* Progress Steps */}
            <Card className="mb-8 surface-glass rounded-2xl border border-white/70">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  {STEPS.map((step, idx) => (
                    <React.Fragment key={step.id}>
                      <button
                        onClick={() => idx <= currentStepIndex && setCurrentStep(step.id)}
                        disabled={idx > currentStepIndex}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                          step.id === currentStep
                            ? 'bg-primary text-primary-foreground'
                            : idx < currentStepIndex
                            ? 'bg-green-100 text-green-700 cursor-pointer hover:bg-green-200'
                            : 'bg-muted text-muted-foreground cursor-not-allowed'
                        }`}
                      >
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${
                          idx < currentStepIndex ? 'bg-green-600 text-white' : 'bg-background/50'
                        }`}>
                          {idx < currentStepIndex ? <Check className="h-4 w-4" /> : idx + 1}
                        </span>
                        <span className="font-medium hidden md:inline">{step.label}</span>
                      </button>
                      {idx < STEPS.length - 1 && (
                        <div className={`flex-1 h-0.5 mx-2 ${idx < currentStepIndex ? 'bg-green-500' : 'bg-muted'}`} />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Step Content */}
            {currentStep === 'upload' && (
              <UploadStep previewData={previewData} onDataLoaded={setPreviewData} />
            )}
            {currentStep === 'mapping' && previewData && (
              <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6">
                <MappingStep previewData={previewData} mappings={mappings} onMappingsChange={setMappings} />
                <div className="hidden xl:block">
                  <div className="sticky top-8">
                    <MappingCoveragePanel mappings={mappings} />
                  </div>
                </div>
              </div>
            )}
            {currentStep === 'analysis' && previewData && (
              <AnalysisStep 
                previewData={previewData} 
                mappings={mappings} 
                conditionalAnswers={conditionalAnswers}
                onConditionalAnswersChange={setConditionalAnswers}
              />
            )}
            {currentStep === 'save' && (
                  <SaveStep 
                    mappings={mappings} 
                    previewData={previewData}
                    direction={direction}
                    onMappingsChange={setMappings}
                    onTemplateSaved={handleTemplateSaved} 
                  />
            )}

            {/* Post-Save CTA */}
            {showPostSaveCTA && currentStep === 'save' && (
              <Card className="mt-6 border-2 border-primary/20 bg-primary/5 rounded-2xl">
                <CardContent className="py-6">
                  {(() => {
                    const confirmed = mappings.filter(m => m.isConfirmed);
                    const cov = analyzeCoverage(confirmed);
                    const hasGaps = cov.unmappedMandatory.length > 0;
                    return hasGaps ? (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Shield className="h-5 w-5 text-amber-500" />
                          <div>
                            <p className="font-medium">Fix mandatory gaps before validation</p>
                            <p className="text-sm text-muted-foreground">{cov.unmappedMandatory.length} mandatory field(s) still unmapped</p>
                          </div>
                        </div>
                        <Button variant="outline" onClick={() => setCurrentStep('mapping')}>
                          <ArrowLeft className="h-4 w-4 mr-2" />
                          Back to Mapping
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Shield className="h-5 w-5 text-green-600" />
                          <div>
                            <p className="font-medium">Mapping profile {templateStatus === 'active' ? 'approved and active' : 'saved as draft'}</p>
                            <p className="text-sm text-muted-foreground">All mandatory fields are covered. Ready for compliance validation.</p>
                          </div>
                        </div>
                        <Button asChild>
                          <Link to="/run">
                            Run Compliance Checks <ArrowRight className="h-4 w-4 ml-2" />
                          </Link>
                        </Button>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8">
              <Button variant="outline" onClick={handleBack} disabled={currentStepIndex === 0}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
              {currentStep !== 'save' && (
                <Button onClick={handleNext} disabled={!canGoNext()}>
                  Next <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}


